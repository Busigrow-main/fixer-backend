import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { Booking, BookingDocument } from '../bookings/schemas/booking.schema';
import {
  Technician,
  TechnicianDocument,
} from '../technicians/schemas/technician.schema';
import { TERMINAL_BOOKING_STATUSES } from './technician-engine';
import {
  SLOT_HOLDING_STATUSES,
  ScheduledJob,
  SlotWindow,
  freeSlots,
  isWithinWorkingHours,
  nextFreeStart,
  planOverrunShift,
  serviceDayKey,
  slotConflicts,
  workdayBounds,
} from './technician-schedule';

const DAY_MS = 24 * 60 * 60 * 1000;

export function slotCheckHasClash(check: SlotCheck): boolean {
  return check.conflicts.length > 0 || check.technicianUnavailable || check.outsideWorkingHours;
}

/**
 * What the booking needs, for "who else is free" suggestions. Lenient on purpose:
 * a technician is excluded only on an explicit mismatch (admin-added staff often have
 * no service categories / areas filled in).
 */
export interface SlotEligibility {
  categories?: string[];
  zip?: string;
}

export interface SlotCheck {
  conflicts: ScheduledJob[];
  /** Technician is switched off (UNAVAILABLE) — treated as a clash the admin may override. */
  technicianUnavailable: boolean;
  /** Outside 8 AM – 9 PM — a soft limit, treated as a clash the admin may override. */
  outsideWorkingHours: boolean;
  nextFreeStart: Date | null;
  freeTechnicians: { _id: string; name: string }[];
}

/**
 * Read side of Fixxer-staff scheduling plus the per-technician slot lock.
 *
 * Dependency rule: uses the Booking / Technician MODELS only — never BookingsService —
 * so BookingsModule → TechnicianEngineModule stays one-way.
 */
@Injectable()
export class TechnicianScheduleService {
  constructor(
    @InjectModel(Booking.name) private readonly bookingModel: Model<BookingDocument>,
    @InjectModel(Technician.name) private readonly technicianModel: Model<TechnicianDocument>,
  ) {}

  private toJob(b: any): ScheduledJob {
    return {
      bookingId: String(b._id),
      start: new Date(b.scheduledStart),
      end: new Date(b.scheduledEnd),
      status: String(b.status || ''),
      paused: !!b.opsPartsWait,
    };
  }

  /** IST calendar day [00:00, 24:00) containing `at`. */
  private dayRange(at: Date): { from: Date; to: Date } {
    const from = new Date(workdayBounds(at).start.getTime() - 8 * 60 * 60 * 1000);
    return { from, to: new Date(from.getTime() + DAY_MS) };
  }

  /** Slot-holding scheduled bookings of these technicians that overlap [from, to). */
  private async holdingJobs(
    technicianIds: string[],
    from: Date,
    to: Date,
    session?: ClientSession,
  ) {
    if (!technicianIds.length) return [];
    return this.bookingModel
      .find(
        {
          technicianId: { $in: technicianIds.map((id) => new Types.ObjectId(id)) },
          status: { $in: [...SLOT_HOLDING_STATUSES] },
          assignmentStatus: { $ne: 'DECLINED' },
          scheduledStart: { $lt: to },
          scheduledEnd: { $gt: from },
        },
        { _id: 1, technicianId: 1, status: 1, scheduledStart: 1, scheduledEnd: 1, opsPartsWait: 1 },
      )
      .session(session ?? null)
      .lean()
      .exec();
  }

  async jobsForTechnicianDay(
    technicianId: string,
    day: Date,
    session?: ClientSession,
  ): Promise<ScheduledJob[]> {
    const { from, to } = this.dayRange(day);
    const rows = await this.holdingJobs([technicianId], from, to, session);
    return rows.map((b) => this.toJob(b));
  }

  /** Active staff technicians (not switched off) with nothing overlapping `window`. */
  async freeStaffFor(
    window: SlotWindow,
    excludeTechnicianId?: string,
    excludeBookingId?: string,
    eligibility?: SlotEligibility,
  ): Promise<{ _id: string; name: string }[]> {
    const allStaff = await this.technicianModel
      .find(
        {
          employmentType: 'FIXXER_STAFF',
          isActive: true,
          availabilityStatus: { $ne: 'UNAVAILABLE' },
        },
        { _id: 1, name: 1, serviceCategories: 1, serviceAreas: 1, pincode: 1 },
      )
      .sort({ name: 1 })
      .lean()
      .exec();
    const staff = allStaff.filter((t) => fitsBooking(t, eligibility));
    const ids = staff.map((t) => String(t._id)).filter((id) => id !== excludeTechnicianId);
    const busy = await this.holdingJobs(ids, window.start, window.end);
    const busyIds = new Set(
      busy.filter((b) => String(b._id) !== excludeBookingId).map((b) => String(b.technicianId)),
    );
    return staff
      .filter((t) => ids.includes(String(t._id)) && !busyIds.has(String(t._id)))
      .map((t) => ({ _id: String(t._id), name: t.name }));
  }

  /** Everything the admin needs to decide on a slot for one technician. */
  async checkSlot(
    technicianId: string,
    window: SlotWindow,
    excludeBookingId?: string,
    session?: ClientSession,
    eligibility?: SlotEligibility,
  ): Promise<SlotCheck> {
    // Sequential on purpose: a transaction session can't run operations in parallel.
    const tech = await this.technicianModel
      .findById(technicianId, { availabilityStatus: 1 })
      .session(session ?? null)
      .lean()
      .exec();
    const jobs = await this.jobsForTechnicianDay(technicianId, window.start, session);
    const conflicts = slotConflicts(window, jobs, excludeBookingId);
    const technicianUnavailable = tech?.availabilityStatus === 'UNAVAILABLE';
    const outsideWorkingHours = !isWithinWorkingHours(window);
    const clash = conflicts.length > 0 || technicianUnavailable;
    return {
      conflicts,
      technicianUnavailable,
      outsideWorkingHours,
      nextFreeStart: clash && !technicianUnavailable
        ? nextFreeStart(window, jobs, excludeBookingId)
        : null,
      freeTechnicians: clash
        ? await this.freeStaffFor(window, technicianId, excludeBookingId, eligibility)
        : [],
    };
  }

  async freeSlotsFor(technicianId: string, day: Date, durationMinutes: number) {
    const jobs = await this.jobsForTechnicianDay(technicianId, day);
    return freeSlots(day, jobs, durationMinutes, new Date());
  }

  /**
   * Serialize slot changes per technician: bump `scheduleVersion` inside a transaction,
   * then run `fn` (check + write) in the same session. Concurrent assigns to the same
   * technician hit a write conflict and the driver retries them against fresh data.
   */
  async withTechnicianLock<T>(
    technicianId: string,
    fn: (session: ClientSession) => Promise<T>,
  ): Promise<T> {
    const session = await this.technicianModel.db.startSession();
    try {
      let out!: T;
      await session.withTransaction(async () => {
        await this.technicianModel
          .updateOne({ _id: technicianId }, { $inc: { scheduleVersion: 1 } }, { session })
          .exec();
        out = await fn(session);
      });
      return out;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Admin day board: every staff technician's slots for the IST day, which of them the
   * overrun rule would leave past 9 PM, and the day's unassigned bookings (by the
   * customer's preferred date).
   */
  async daySchedule(day: Date) {
    const dayKey = serviceDayKey(day);
    const { from, to } = this.dayRange(day);
    const staff = await this.technicianModel
      .find(
        { employmentType: 'FIXXER_STAFF', isActive: true },
        { _id: 1, name: 1, phone: 1, availabilityStatus: 1 },
      )
      .sort({ name: 1 })
      .lean()
      .exec();
    const staffIds = staff.map((t) => t._id);

    const bookingFields =
      '_id status technicianId scheduledStart scheduledEnd preferredVisitDate preferredVisitSlot addressData contactPhone serviceId description opsPartsWait';

    const todayKey = serviceDayKey(new Date());
    const isToday = dayKey === todayKey;
    const unassignedFilter: Record<string, unknown> = {
      technicianId: null,
      status: { $nin: [...TERMINAL_BOOKING_STATUSES] },
      // Today also shows the backlog: no preferred day, or a preferred day already past.
      ...(isToday
        ? {
            $or: [
              { preferredVisitDate: dayKey },
              { preferredVisitDate: null },
              { preferredVisitDate: '' },
              { preferredVisitDate: { $lt: dayKey } },
            ],
          }
        : { preferredVisitDate: dayKey }),
    };

    const [scheduled, unassigned, needsTime] = await Promise.all([
      this.bookingModel
        .find({
          technicianId: { $in: staffIds },
          scheduledStart: { $lt: to },
          scheduledEnd: { $gt: from },
          status: { $ne: 'CANCELLED' },
        })
        .select(bookingFields)
        .populate('serviceId', 'name')
        .sort({ scheduledStart: 1 })
        .lean()
        .exec(),
      this.bookingModel
        .find(unassignedFilter)
        .select(bookingFields)
        .populate('serviceId', 'name')
        .sort({ preferredVisitDate: 1, createdAt: 1 })
        .lean()
        .exec(),
      // Staff jobs with no slot (e.g. assigned before scheduling existed): any date.
      this.bookingModel
        .find({
          technicianId: { $in: staffIds },
          status: { $in: [...SLOT_HOLDING_STATUSES] },
          scheduledStart: null,
        })
        .select(`${bookingFields} assignmentStatus`)
        .populate('serviceId', 'name')
        .populate('technicianId', 'name')
        .sort({ createdAt: 1 })
        .lean()
        .exec(),
    ]);

    const now = new Date();
    const technicians = staff.map((t) => {
      const rows = scheduled.filter((b) => String(b.technicianId) === String(t._id));
      const { overflow } = planOverrunShift(rows.map((b) => this.toJob(b)), now);
      const overflowIds = new Set(overflow);
      return {
        _id: String(t._id),
        name: t.name,
        phone: t.phone,
        availabilityStatus: t.availabilityStatus,
        bookings: rows.map((b) => ({ ...b, overflow: overflowIds.has(String(b._id)) })),
      };
    });

    const overflowCount = technicians.reduce(
      (n, t) => n + t.bookings.filter((b) => b.overflow).length,
      0,
    );
    return {
      date: dayKey,
      workday: workdayBounds(day),
      technicians,
      unassigned: unassigned.map((b) => ({
        ...b,
        backlog: b.preferredVisitDate !== dayKey,
      })),
      needsTime,
      overflowCount,
    };
  }

  /** Staff technicians that currently have scheduled, slot-holding work today (for the cron). */
  async staffWithOpenSlotsOn(day: Date): Promise<string[]> {
    const { from, to } = this.dayRange(day);
    const ids = await this.bookingModel
      .distinct('technicianId', {
        technicianId: { $ne: null },
        status: { $in: [...SLOT_HOLDING_STATUSES] },
        scheduledStart: { $gte: from, $lt: to },
      })
      .exec();
    if (!ids.length) return [];
    const staff = await this.technicianModel
      .find({ _id: { $in: ids }, employmentType: 'FIXXER_STAFF' }, { _id: 1 })
      .lean()
      .exec();
    return staff.map((t) => String(t._id));
  }
}

function fitsBooking(
  tech: { serviceCategories?: string[]; serviceAreas?: string[]; pincode?: string },
  eligibility?: SlotEligibility,
): boolean {
  if (!eligibility) return true;
  const cats = eligibility.categories ?? [];
  if (cats.length && tech.serviceCategories?.length) {
    if (!tech.serviceCategories.some((c) => cats.includes(c))) return false;
  }
  const zip = eligibility.zip?.trim();
  const areas = [...(tech.serviceAreas ?? []), ...(tech.pincode ? [tech.pincode] : [])];
  if (zip && areas.length && !areas.includes(zip)) return false;
  return true;
}
