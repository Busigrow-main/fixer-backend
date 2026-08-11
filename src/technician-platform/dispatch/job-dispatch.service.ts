import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Booking, BookingDocument } from '../../bookings/schemas/booking.schema';
import { Service, ServiceDocument } from '../../services/schemas/service.schema';
import { Technician, TechnicianDocument } from '../../technicians/schemas/technician.schema';
import { NotificationDispatchService } from '../common/notification-dispatch.service';
import { categoriesForServiceSlug } from './service-category.util';

/** Open marketplace window before escalating to admin. */
const DISPATCH_TTL_MS = 10 * 60 * 1000; // 10 minutes

@Injectable()
export class JobDispatchService {
  private readonly logger = new Logger(JobDispatchService.name);

  constructor(
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
    @InjectModel(Technician.name) private technicianModel: Model<TechnicianDocument>,
    @InjectModel(Service.name) private serviceModel: Model<ServiceDocument>,
    private notificationDispatch: NotificationDispatchService,
  ) {}

  async resolveCategorySlugs(serviceId: string | Types.ObjectId): Promise<string[]> {
    const service = await this.serviceModel.findById(serviceId).select('slug').lean().exec();
    return categoriesForServiceSlug(service?.slug);
  }

  /**
   * Active, available technicians whose pincode/areas and categories match the booking.
   */
  async findEligibleTechnicians(booking: {
    serviceId: Types.ObjectId | string;
    addressData?: { zip?: string };
  }): Promise<TechnicianDocument[]> {
    const zip = booking.addressData?.zip?.trim();
    if (!zip) return [];

    const categories = await this.resolveCategorySlugs(booking.serviceId);
    if (!categories.length) return [];

    const candidates = await this.technicianModel
      .find({
        isActive: true,
        availabilityStatus: 'AVAILABLE',
        idVerified: true,
        $or: [{ serviceAreas: zip }, { pincode: zip }],
        $and: [
          {
            $or: [
              { serviceCategories: { $in: categories } },
              { skills: { $in: categories } },
            ],
          },
        ],
      })
      .exec();

    return candidates;
  }

  /**
   * Mark booking OPEN and fan-out NEW_JOB to eligible technicians.
   * Never throws to the caller — booking create must succeed even if notify fails.
   */
  async broadcastJob(bookingId: string): Promise<{ notified: number }> {
    try {
      const booking = await this.bookingModel.findById(bookingId).exec();
      if (!booking) return { notified: 0 };

      // Don't rebroadcast claimed/admin jobs unless explicitly reopened.
      if (
        booking.dispatchStatus === 'CLAIMED' ||
        (booking.technicianId && booking.dispatchStatus === 'ADMIN_ASSIGNED')
      ) {
        return { notified: 0 };
      }

      const now = new Date();
      const expiresAt = new Date(now.getTime() + DISPATCH_TTL_MS);
      const eligible = await this.findEligibleTechnicians(booking);
      const ids = eligible.map((t) => t._id as Types.ObjectId);

      await this.bookingModel.findByIdAndUpdate(bookingId, {
        dispatchStatus: 'OPEN',
        dispatchedAt: now,
        dispatchExpiresAt: expiresAt,
        adminEscalatedAt: null,
        notifiedTechnicianIds: ids,
        technicianId: null,
        assignmentStatus: null,
      });

      const service = await this.serviceModel
        .findById(booking.serviceId)
        .select('name')
        .lean()
        .exec();
      const serviceName = service?.name ?? 'a service';
      const pin = booking.addressData?.zip ?? '';

      await Promise.all(
        eligible.map((tech) =>
          this.notificationDispatch.notify(
            (tech._id as Types.ObjectId).toString(),
            'NEW_JOB',
            'New job available',
            `${serviceName} job in ${pin} — claim it before another technician does.`,
            { bookingId, dispatchStatus: 'OPEN' },
          ),
        ),
      );

      this.logger.log(
        `Broadcast booking ${bookingId} to ${eligible.length} technician(s) for pin ${pin}`,
      );
      return { notified: eligible.length };
    } catch (err) {
      this.logger.error(`broadcastJob failed for ${bookingId}`, err as Error);
      return { notified: 0 };
    }
  }

  /**
   * Escalate a single OPEN job past TTL → NEEDS_ADMIN so ops can assign manually.
   */
  async escalateIfNeeded(bookingId: string): Promise<boolean> {
    const booking = await this.bookingModel.findById(bookingId).exec();
    if (!booking || booking.dispatchStatus !== 'OPEN') return false;
    if (!booking.dispatchExpiresAt || booking.dispatchExpiresAt > new Date()) return false;
    if (booking.technicianId) return false;

    return this.markNeedsAdmin(booking);
  }

  /**
   * Cron entry: escalate all OPEN jobs whose claim window has expired.
   */
  async escalateUnclaimedJobs(): Promise<number> {
    const due = await this.bookingModel
      .find({
        dispatchStatus: 'OPEN',
        technicianId: null,
        dispatchExpiresAt: { $lte: new Date() },
      })
      .exec();

    let count = 0;
    for (const booking of due) {
      const ok = await this.markNeedsAdmin(booking);
      if (ok) count += 1;
    }
    if (count > 0) {
      this.logger.warn(`[ADMIN ESCALATION] ${count} unclaimed job(s) need manual assignment`);
    }
    return count;
  }

  /** @deprecated use escalateIfNeeded — kept for callers that previously expired to EXPIRED */
  async expireIfNeeded(bookingId: string): Promise<boolean> {
    return this.escalateIfNeeded(bookingId);
  }

  async notifyJobTaken(bookingId: string, winnerTechnicianId: string, notifiedIds: Types.ObjectId[]) {
    const others = notifiedIds.filter((id) => id.toString() !== winnerTechnicianId);
    await Promise.all(
      others.map((id) =>
        this.notificationDispatch.notify(
          id.toString(),
          'JOB_TAKEN',
          'Job claimed by another technician',
          'This job is no longer available.',
          { bookingId },
        ),
      ),
    );
  }

  async countNeedsAdmin(): Promise<number> {
    return this.bookingModel.countDocuments({
      dispatchStatus: 'NEEDS_ADMIN',
      technicianId: null,
    });
  }

  private async markNeedsAdmin(booking: BookingDocument): Promise<boolean> {
    const now = new Date();
    const note = `[AUTO] Unclaimed for 10 minutes — escalated to admin for manual assignment at ${now.toISOString()}`;

    const updated = await this.bookingModel.findOneAndUpdate(
      {
        _id: booking._id,
        dispatchStatus: 'OPEN',
        technicianId: null,
      },
      {
        dispatchStatus: 'NEEDS_ADMIN',
        adminEscalatedAt: now,
        status: booking.status === 'PENDING' ? 'CONFIRMED' : booking.status,
        $push: { adminNotes: note },
      },
      { returnDocument: 'after' },
    );

    if (!updated) return false;

    const pin = updated.addressData?.zip ?? 'unknown';
    this.logger.warn(
      `[ADMIN ESCALATION] Booking ${updated._id} (pin ${pin}) unclaimed after 10m — needs admin assignment`,
    );
    return true;
  }
}
