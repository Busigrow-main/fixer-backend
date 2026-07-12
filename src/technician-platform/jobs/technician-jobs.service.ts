import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BookingsService } from '../../bookings/bookings.service';
import { TechniciansService } from '../../technicians/technicians.service';
import { JOB_STATUS_FLOW } from '../constants';
import { Booking, BookingDocument } from '../../bookings/schemas/booking.schema';

@Injectable()
export class TechnicianJobsService {
  constructor(
    private bookingsService: BookingsService,
    private techniciansService: TechniciansService,
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
  ) {}

  async listJobs(technicianId: string, filter?: string) {
    const query: Record<string, unknown> = {
      technicianId: new Types.ObjectId(technicianId),
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

  async getJob(technicianId: string, jobId: string) {
    const booking = await this.bookingsService.findOne(jobId);
    this.assertOwnership(booking, technicianId);
    return this.formatJobDetail(booking);
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

    return this.bookingModel
      .findByIdAndUpdate(
        jobId,
        {
          assignmentStatus: 'DECLINED',
          declinedAt: new Date(),
          declineReason: reason,
          technicianId: null,
          status: 'CONFIRMED',
        },
        { returnDocument: 'after' },
      )
      .exec();
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

  private async technicianModelIncrement(technicianId: string) {
    await this.techniciansService.update(technicianId, {
      totalCompletedJobs: (await this.techniciansService.findOne(technicianId)).totalCompletedJobs + 1,
    });
  }

  private assertOwnership(booking: Booking, technicianId: string) {
    if (booking.technicianId?.toString() !== technicianId) {
      throw new ForbiddenException('You do not have access to this job');
    }
  }

  private formatJobDetail(booking: any) {
    return {
      ...booking.toObject?.() || booking,
      customer: booking.userId,
      address: booking.addressData,
      problem: booking.description,
      estimatedAmount: booking.estimatedAmount || booking.invoiceData?.totalAmount || 0,
      location: booking.arrivalGps,
      otpRequired: booking.otpRequired,
    };
  }
}
