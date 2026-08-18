import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BookingsService } from '../../bookings/bookings.service';
import { TechniciansService } from '../../technicians/technicians.service';
import { JOB_STATUS_FLOW } from '../constants';
import { technicianIdQuery, resolveTechnicianId } from '../common/technician-id.util';
import { Booking, BookingDocument } from '../../bookings/schemas/booking.schema';
import { JobDispatchService } from '../dispatch/job-dispatch.service';
import { categoriesForServiceSlug } from '../dispatch/service-category.util';

@Injectable()
export class TechnicianJobsService {
  constructor(
    private bookingsService: BookingsService,
    private techniciansService: TechniciansService,
    private jobDispatch: JobDispatchService,
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
  ) {}

  async listJobs(technicianId: string, filter?: string) {
    const query: Record<string, unknown> = {
      technicianId: technicianIdQuery(technicianId),
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    switch (filter?.toUpperCase()) {
      case 'ASSIGNED':
        query.status = 'ASSIGNED';
        query.assignmentStatus = 'ACCEPTED';
        break;
      case 'COMPLETED':
        query.status = { $in: ['COMPLETED', 'PAYMENT_COLLECTED'] };
        break;
      case 'CANCELLED':
        query.status = 'CANCELLED';
        break;
      case 'TODAY':
        query.assignedAt = { $gte: today, $lt: tomorrow };
        break;
      default:
        break;
    }

    return this.bookingModel
      .find(query)
      .populate('userId', 'fullName phone')
      .populate('serviceId', 'name icon slug')
      .sort({ assignedAt: -1, createdAt: -1 })
      .exec();
  }

  /** Open marketplace jobs matching this technician's pincode + categories. */
  async listAvailableJobs(technicianId: string) {
    const tech = await this.techniciansService.findOne(technicianId);
    const categories = [
      ...new Set([...(tech.serviceCategories ?? []), ...(tech.skills ?? [])]),
    ];
    const pin = tech.pincode;
    const areas = tech.serviceAreas?.length ? tech.serviceAreas : pin ? [pin] : [];

    if (!areas.length || !categories.length) {
      return [];
    }

    await this.expireStaleOpenJobs();

    const open = await this.bookingModel
      .find({
        dispatchStatus: 'OPEN',
        technicianId: null,
        'addressData.zip': { $in: areas },
        status: { $in: ['PENDING', 'CONFIRMED'] },
      })
      .populate('userId', 'fullName phone')
      .populate('serviceId', 'name icon slug')
      .sort({ createdAt: -1 })
      .exec();

    return open.filter((booking: any) => {
      const slug = booking.serviceId?.slug as string | undefined;
      const required = categoriesForServiceSlug(slug);
      return required.some((c) => categories.map((x) => x.toLowerCase()).includes(c.toLowerCase()));
    });
  }

  async getJob(technicianId: string, jobId: string) {
    await this.jobDispatch.expireIfNeeded(jobId);
    const booking = await this.bookingsService.findOne(jobId);

    const ownerId = resolveTechnicianId(booking.technicianId);
    if (ownerId === technicianId) {
      return this.formatJobDetail(booking);
    }

    // Allow viewing open jobs the tech is eligible for (pre-claim).
    if (
      !ownerId &&
      (booking as any).dispatchStatus === 'OPEN' &&
      (await this.isEligibleForOpenJob(technicianId, booking))
    ) {
      return this.formatJobDetail(booking);
    }

    throw new ForbiddenException('You do not have access to this job');
  }

  async claimJob(technicianId: string, jobId: string) {
    await this.jobDispatch.expireIfNeeded(jobId);

    const tech = await this.techniciansService.findOne(technicianId);
    if (!tech.isActive || tech.availabilityStatus !== 'AVAILABLE') {
      throw new BadRequestException('You must be active and available to claim a job');
    }

    const existing = await this.bookingModel.findById(jobId).populate('serviceId', 'slug name').exec();
    if (!existing) throw new NotFoundException('Job not found');

    if (!(await this.isEligibleForOpenJob(technicianId, existing))) {
      throw new ForbiddenException('You are not eligible for this job');
    }

    const now = new Date();
    const claimed = await this.bookingModel
      .findOneAndUpdate(
        {
          _id: jobId,
          dispatchStatus: 'OPEN',
          $or: [{ technicianId: null }, { technicianId: { $exists: false } }],
        },
        {
          technicianId: new Types.ObjectId(technicianId),
          status: 'ASSIGNED',
          assignmentStatus: 'ACCEPTED',
          assignedAt: now,
          acceptedAt: now,
          dispatchStatus: 'CLAIMED',
        },
        { returnDocument: 'after' },
      )
      .populate('userId', 'fullName phone')
      .populate('serviceId', 'name icon slug')
      .exec();

    if (!claimed) {
      throw new ConflictException('Job was already claimed by another technician');
    }

    const notified = (existing.notifiedTechnicianIds ?? []) as Types.ObjectId[];
    void this.jobDispatch.notifyJobTaken(jobId, technicianId, notified);

    return this.formatJobDetail(claimed);
  }

  async acceptJob(technicianId: string, jobId: string) {
    const booking = await this.bookingModel.findById(jobId).exec();
    if (!booking) throw new NotFoundException('Job not found');
    this.assertOwnership(booking, technicianId);

    if (booking.assignmentStatus !== 'PENDING_ACCEPTANCE') {
      throw new BadRequestException('Job is not pending acceptance');
    }

    const updated = await this.bookingModel
      .findByIdAndUpdate(
        jobId,
        { assignmentStatus: 'ACCEPTED', acceptedAt: new Date(), status: 'ASSIGNED' },
        { returnDocument: 'after' },
      )
      .populate('userId', 'fullName phone')
      .populate('serviceId', 'name')
      .exec();

    return updated;
  }

  async rejectJob(technicianId: string, jobId: string, reason: string) {
    if (!reason?.trim()) throw new BadRequestException('Rejection reason is required');

    const booking = await this.bookingModel.findById(jobId).exec();
    if (!booking) throw new NotFoundException('Job not found');
    this.assertOwnership(booking, technicianId);

    if (booking.assignmentStatus !== 'PENDING_ACCEPTANCE') {
      throw new BadRequestException('Job is not pending acceptance');
    }

    const updated = await this.bookingModel
      .findByIdAndUpdate(
        jobId,
        {
          assignmentStatus: 'DECLINED',
          declinedAt: new Date(),
          declineReason: reason,
          technicianId: null,
          status: 'CONFIRMED',
          dispatchStatus: 'OPEN',
        },
        { returnDocument: 'after' },
      )
      .exec();

    // Re-broadcast to eligible technicians
    void this.jobDispatch.broadcastJob(jobId);

    return updated;
  }

  async updateStatus(technicianId: string, jobId: string, nextStatus: string) {
    const booking = await this.bookingModel.findById(jobId).exec();
    if (!booking) throw new NotFoundException('Job not found');
    this.assertOwnership(booking, technicianId);

    if (booking.assignmentStatus !== 'ACCEPTED') {
      throw new BadRequestException('Job must be accepted first');
    }

    const current = booking.status;
    const currentIndex = JOB_STATUS_FLOW.indexOf(current as any);
    const nextIndex = JOB_STATUS_FLOW.indexOf(nextStatus as any);

    if (nextIndex === -1) {
      throw new BadRequestException('Invalid job status');
    }
    if (currentIndex === -1 && nextStatus !== 'ASSIGNED') {
      throw new BadRequestException(`Cannot transition from ${current} to ${nextStatus}`);
    }
    if (currentIndex !== -1 && nextIndex !== currentIndex + 1) {
      throw new BadRequestException(`Cannot skip states. Current: ${current}, requested: ${nextStatus}`);
    }

    const updated = await this.bookingsService.updateStatus(jobId, nextStatus);

    if (nextStatus === 'IN_PROGRESS') {
      await this.techniciansService.update(technicianId, { availabilityStatus: 'ON_JOB' });
    }
    if (nextStatus === 'PAYMENT_COLLECTED') {
      await this.technicianModelIncrement(technicianId);
      await this.techniciansService.update(technicianId, { availabilityStatus: 'AVAILABLE' });
    }

    return updated;
  }

  async markArrival(technicianId: string, jobId: string, lat: number, lng: number) {
    const booking = await this.bookingModel.findById(jobId).exec();
    if (!booking) throw new NotFoundException('Job not found');
    this.assertOwnership(booking, technicianId);

    if (booking.status !== 'ASSIGNED' && booking.status !== 'EN_ROUTE') {
      throw new BadRequestException('Job is not in a valid state for arrival');
    }

    return this.bookingModel
      .findByIdAndUpdate(
        jobId,
        {
          status: 'EN_ROUTE',
          arrivalAt: new Date(),
          arrivalGps: { lat, lng, capturedAt: new Date() },
        },
        { returnDocument: 'after' },
      )
      .populate('userId', 'fullName phone')
      .populate('serviceId', 'name')
      .exec();
  }

  private async expireStaleOpenJobs() {
    await this.jobDispatch.escalateUnclaimedJobs();
  }

  private async isEligibleForOpenJob(technicianId: string, booking: any): Promise<boolean> {
    if (booking.dispatchStatus !== 'OPEN') return false;
    if (booking.technicianId) return false;

    const tech = await this.techniciansService.findOne(technicianId);
    if (!tech.isActive || tech.availabilityStatus !== 'AVAILABLE' || !tech.idVerified) {
      return false;
    }

    const zip = booking.addressData?.zip?.trim();
    if (!zip) return false;
    const inArea =
      tech.pincode === zip || (tech.serviceAreas ?? []).includes(zip);
    if (!inArea) return false;

    const slug =
      typeof booking.serviceId === 'object' && booking.serviceId?.slug
        ? booking.serviceId.slug
        : undefined;
    const required = slug
      ? categoriesForServiceSlug(slug)
      : await this.jobDispatch.resolveCategorySlugs(booking.serviceId);
    const offered = [...(tech.serviceCategories ?? []), ...(tech.skills ?? [])].map((s) =>
      s.toLowerCase(),
    );
    return required.some((c) => offered.includes(c.toLowerCase()));
  }

  private async technicianModelIncrement(technicianId: string) {
    await this.techniciansService.update(technicianId, {
      totalCompletedJobs: (await this.techniciansService.findOne(technicianId)).totalCompletedJobs + 1,
    });
  }

  private assertOwnership(booking: Booking, technicianId: string) {
    if (resolveTechnicianId(booking.technicianId) !== technicianId) {
      throw new ForbiddenException('You do not have access to this job');
    }
  }

  private formatJobDetail(booking: any) {
    // #region agent log
    fetch('http://127.0.0.1:7355/ingest/99926b9b-4ef7-4fac-b539-22a58883fa42',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7c1315'},body:JSON.stringify({sessionId:'7c1315',runId:'pre-fix',hypothesisId:'H2',location:'technician-jobs.service.ts:formatJobDetail',message:'job detail invoice payload for payment screen',data:{bookingId:String(booking._id),invoiceKeys:booking.invoiceData?Object.keys(booking.invoiceData):[],serviceTotal:booking.invoiceData?.serviceTotal??null,partsTotal:booking.invoiceData?.partsTotal??null,totalAmount:booking.invoiceData?.totalAmount??null,labourCharge:booking.invoiceData?.labourCharge??null,partsCharge:booking.invoiceData?.partsCharge??null,completionLabour:booking.completionData?.labourCharge??null,completionParts:booking.completionData?.partsCharge??null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return {
      ...(booking.toObject?.() || booking),
      customer: booking.userId,
      address: booking.addressData,
      problem: booking.description,
      estimatedAmount: booking.estimatedAmount || booking.invoiceData?.totalAmount || 0,
      location: booking.arrivalGps,
      otpRequired: booking.otpRequired,
    };
  }
}
