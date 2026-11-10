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
import { TechnicianEngineService } from '../../technician-engine/technician-engine.service';
import { assertAssignmentAccepted } from '../../technician-engine/technician-engine';
import { technicianIdQuery, resolveTechnicianId } from '../common/technician-id.util';
import { Booking, BookingDocument } from '../../bookings/schemas/booking.schema';
import { JobDispatchService } from '../dispatch/job-dispatch.service';
import { categoriesForServiceSlug } from '../dispatch/service-category.util';
import { stripFixxerCodeSecrets } from '../../bookings/fixxer-code';
import { omitTechnicianForbiddenBookingFields } from '../../bookings/booking-change-history';

function presentTechnicianBooking(booking: any) {
  const plain = booking?.toObject ? booking.toObject() : { ...(booking || {}) };
  return omitTechnicianForbiddenBookingFields(stripFixxerCodeSecrets(plain));
}

@Injectable()
export class TechnicianJobsService {
  constructor(
    private bookingsService: BookingsService,
    private techniciansService: TechniciansService,
    private jobDispatch: JobDispatchService,
    private technicianEngine: TechnicianEngineService,
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

    const jobs = await this.bookingModel
      .find(query)
      .populate('userId', 'fullName phone')
      .populate('serviceId', 'name icon slug')
      .sort({ assignedAt: -1, createdAt: -1 })
      .exec();

    return jobs.map((job) => presentTechnicianBooking(job));
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

    return open
      .filter((booking: any) => {
        const slug = booking.serviceId?.slug as string | undefined;
        const required = categoriesForServiceSlug(slug);
        return required.some((c) => categories.map((x) => x.toLowerCase()).includes(c.toLowerCase()));
      })
      .map((booking) => presentTechnicianBooking(booking));
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
    this.technicianEngine.assertCanClaim(tech);

    const existing = await this.bookingModel.findById(jobId).populate('serviceId', 'slug name').exec();
    if (!existing) throw new NotFoundException('Job not found');

    if (!(await this.isEligibleForOpenJob(technicianId, existing))) {
      throw new ForbiddenException('You are not eligible for this job');
    }

    const now = new Date();
    const issued = this.bookingsService.prepareAssignmentCode();
    const claimed = await this.bookingModel
      .findOneAndUpdate(
        {
          _id: jobId,
          dispatchStatus: 'OPEN',
          $or: [{ technicianId: null }, { technicianId: { $exists: false } }],
        },
        {
          $set: {
            technicianId: new Types.ObjectId(technicianId),
            status: 'ASSIGNED',
            assignmentStatus: 'ACCEPTED',
            assignedAt: now,
            acceptedAt: now,
            dispatchStatus: 'CLAIMED',
            ...issued.fields,
            fixxerCodeVerifiedAt: null,
          },
          $unset: { assignmentEmailSentAt: 1 },
        },
        { returnDocument: 'after' },
      )
      .populate('userId', 'fullName phone')
      .populate('serviceId', 'name icon slug')
      .exec();

    if (!claimed) {
      throw new ConflictException('Job was already claimed by another technician');
    }

    await this.technicianEngine.applyJobEvent(technicianId, 'CLAIMED');

    const notified = (existing.notifiedTechnicianIds ?? []) as Types.ObjectId[];
    void this.jobDispatch.notifyJobTaken(jobId, technicianId, notified);
    await this.bookingsService.deliverAssignmentCode(jobId, issued.code);

    return this.formatJobDetail(claimed);
  }

  async acceptJob(technicianId: string, jobId: string) {
    const booking = await this.bookingModel.findById(jobId).exec();
    if (!booking) throw new NotFoundException('Job not found');
    this.assertOwnership(booking, technicianId);

    this.technicianEngine.assertCanAccept(booking.assignmentStatus);

    const updated = await this.bookingModel
      .findByIdAndUpdate(
        jobId,
        { assignmentStatus: 'ACCEPTED', acceptedAt: new Date(), status: 'ASSIGNED' },
        { returnDocument: 'after' },
      )
      .populate('userId', 'fullName phone')
      .populate('serviceId', 'name')
      .exec();

    await this.technicianEngine.applyJobEvent(technicianId, 'ACCEPTED');

    return presentTechnicianBooking(updated);
  }

  async rejectJob(technicianId: string, jobId: string, reason: string) {
    if (!reason?.trim()) throw new BadRequestException('Rejection reason is required');

    const booking = await this.bookingModel.findById(jobId).exec();
    if (!booking) throw new NotFoundException('Job not found');
    this.assertOwnership(booking, technicianId);

    this.technicianEngine.assertCanReject(booking.assignmentStatus);

    const updated = await this.bookingModel
      .findByIdAndUpdate(
        jobId,
        {
          $set: {
            assignmentStatus: 'DECLINED',
            declinedAt: new Date(),
            declineReason: reason,
            technicianId: null,
            status: 'CONFIRMED',
            dispatchStatus: 'OPEN',
          },
          $unset: {
            fixxerCodeCiphertext: 1,
            fixxerCodeIv: 1,
            fixxerCodeAuthTag: 1,
            fixxerCodeIssuedAt: 1,
            fixxerCodeVerifiedAt: 1,
            assignmentEmailSentAt: 1,
          },
        },
        { returnDocument: 'after' },
      )
      .exec();

    await this.technicianEngine.applyJobEvent(technicianId, 'REJECTED');

    // Re-broadcast to eligible technicians
    void this.jobDispatch.broadcastJob(jobId);

    return presentTechnicianBooking(updated);
  }

  async updateStatus(
    technicianId: string,
    jobId: string,
    nextStatus: string,
    fixxerCode?: string,
  ) {
    const booking = await this.bookingModel.findById(jobId).exec();
    if (!booking) throw new NotFoundException('Job not found');
    this.assertOwnership(booking, technicianId);

    try {
      assertAssignmentAccepted(booking.assignmentStatus);
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Job must be accepted first',
      );
    }

    const { next } = this.technicianEngine.planStatusStep(booking.status, nextStatus);

    const updated = await this.bookingsService.updateStatus(
      jobId,
      next,
      undefined,
      fixxerCode,
      { actorRole: 'TECHNICIAN', actorId: technicianId },
    );

    await this.technicianEngine.applyStatusStepAvailability(technicianId, next);

    return presentTechnicianBooking(updated);
  }

  async markArrival(technicianId: string, jobId: string, lat: number, lng: number) {
    const booking = await this.bookingModel.findById(jobId).exec();
    if (!booking) throw new NotFoundException('Job not found');
    this.assertOwnership(booking, technicianId);

    this.technicianEngine.assertCanMarkArrival(booking.status);

    return presentTechnicianBooking(
      await this.bookingModel
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
        .exec(),
    );
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

  private assertOwnership(booking: Booking, technicianId: string) {
    if (resolveTechnicianId(booking.technicianId) !== technicianId) {
      throw new ForbiddenException('You do not have access to this job');
    }
  }

  private formatJobDetail(booking: any) {
    return omitTechnicianForbiddenBookingFields(
      stripFixxerCodeSecrets({
        ...(booking.toObject?.() || booking),
        customer: booking.userId,
        address: booking.addressData,
        problem: booking.description,
        estimatedAmount: booking.estimatedAmount || booking.invoiceData?.totalAmount || 0,
        location: booking.arrivalGps,
        otpRequired: booking.otpRequired,
      }),
    );
  }
}
