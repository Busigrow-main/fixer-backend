import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Booking,
  BookingDocument,
  OPS_PENDING_REASONS,
} from '../bookings/schemas/booking.schema';
import { Visit, VisitDocument } from '../visits/schemas/visit.schema';
import { OpsSettingsService, OpsThresholds } from './ops-settings.service';

export type OpsPendingReason = (typeof OPS_PENDING_REASONS)[number];

export type OpsOverdueRow = {
  bookingId: string;
  reason: OpsPendingReason;
  nextAction: string;
  ownerId?: string | null;
  ownerName?: string | null;
  dueAt?: string | null;
  ageMs: number;
  ageLabel: string;
  firstPendingAt: string;
  createdAt?: string;
  status?: string;
  dispatchStatus?: string;
  contactPhone?: string;
  opsPartsWait?: boolean;
};

const NEXT_ACTION: Record<OpsPendingReason, string> = {
  UNASSIGNED: 'Assign a technician',
  ACCEPTED_NOT_STARTED: 'Chase technician to start the job',
  PARTS_WAIT: 'Chase parts / unblock the job',
  OVERDUE_VISIT: 'Reschedule or complete the visit',
  OVERDUE_REVIEW: 'Complete supervisor quality review',
};

const REASON_PRIORITY: OpsPendingReason[] = [
  'UNASSIGNED',
  'OVERDUE_VISIT',
  'PARTS_WAIT',
  'ACCEPTED_NOT_STARTED',
  'OVERDUE_REVIEW',
];

@Injectable()
export class OpsQueueService {
  private readonly logger = new Logger(OpsQueueService.name);

  constructor(
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<BookingDocument>,
    @InjectModel(Visit.name)
    private readonly visitModel: Model<VisitDocument>,
    private readonly opsSettings: OpsSettingsService,
  ) {}

  async listOverdue(reason?: string): Promise<{
    data: OpsOverdueRow[];
    total: number;
    thresholds: OpsThresholds;
  }> {
    const thresholds = await this.opsSettings.getThresholds();
    const rows = await this.collectOverdueRows(thresholds);
    const filtered =
      reason && reason !== 'ALL'
        ? rows.filter((row) => row.reason === reason)
        : rows;
    filtered.sort((a, b) => b.ageMs - a.ageMs);
    return { data: filtered, total: filtered.length, thresholds };
  }

  async updatePendingWork(
    bookingId: string,
    input: {
      reason?: OpsPendingReason | null;
      nextAction?: string;
      ownerId?: string | null;
      dueAt?: string | null;
      partsWait?: boolean;
    },
  ) {
    if (!Types.ObjectId.isValid(bookingId)) {
      throw new NotFoundException('Booking not found');
    }
    const booking = await this.bookingModel.findById(bookingId).exec();
    if (!booking) throw new NotFoundException('Booking not found');

    const $set: Record<string, unknown> = {};
    const $unset: Record<string, 1> = {};

    if (input.reason !== undefined) {
      if (input.reason === null) {
        $unset.opsPendingReason = 1;
      } else if ((OPS_PENDING_REASONS as readonly string[]).includes(input.reason)) {
        $set.opsPendingReason = input.reason;
        if (!input.nextAction) {
          $set.opsNextAction = NEXT_ACTION[input.reason];
        }
      } else {
        throw new BadRequestException('Invalid pending reason');
      }
    }

    if (input.nextAction !== undefined) {
      const trimmed = String(input.nextAction || '').trim();
      if (trimmed) $set.opsNextAction = trimmed.slice(0, 500);
      else $unset.opsNextAction = 1;
    }

    if (input.ownerId !== undefined) {
      if (!input.ownerId) $unset.opsOwnerId = 1;
      else if (!Types.ObjectId.isValid(input.ownerId)) {
        throw new BadRequestException('Invalid ownerId');
      } else {
        $set.opsOwnerId = new Types.ObjectId(input.ownerId);
      }
    }

    if (input.dueAt !== undefined) {
      if (!input.dueAt) $unset.opsDueAt = 1;
      else {
        const due = new Date(input.dueAt);
        if (Number.isNaN(due.getTime())) {
          throw new BadRequestException('Invalid dueAt');
        }
        $set.opsDueAt = due;
      }
    }

    if (typeof input.partsWait === 'boolean') {
      $set.opsPartsWait = input.partsWait;
      if (input.partsWait && input.reason === undefined) {
        $set.opsPendingReason = 'PARTS_WAIT';
        $set.opsNextAction = NEXT_ACTION.PARTS_WAIT;
      }
    }

    // Age anchor: set once, never reset when reason/next action changes.
    if (!booking.opsFirstPendingAt) {
      $set.opsFirstPendingAt = new Date();
    }

    const update: Record<string, unknown> = {};
    if (Object.keys($set).length) update.$set = $set;
    if (Object.keys($unset).length) update.$unset = $unset;
    if (!Object.keys(update).length) {
      return booking;
    }

    return this.bookingModel
      .findByIdAndUpdate(bookingId, update, { returnDocument: 'after' })
      .populate('opsOwnerId', '-passwordHash')
      .exec();
  }

  /**
   * Refresh stored ops fields for overdue jobs and emit deduped alerts.
   * Does not touch dispatch escalation / payment / earnings.
   */
  async syncAndNotify(): Promise<{ synced: number; notified: number }> {
    const thresholds = await this.opsSettings.getThresholds();
    const rows = await this.collectOverdueRows(thresholds);
    let synced = 0;
    let notified = 0;
    const now = new Date();
    const cooldownMs = thresholds.alertCooldownMinutes * 60 * 1000;

    for (const row of rows) {
      const booking = await this.bookingModel.findById(row.bookingId).exec();
      if (!booking) continue;

      const $set: Record<string, unknown> = {
        opsPendingReason: row.reason,
        opsNextAction: booking.opsNextAction || row.nextAction,
        opsDueAt: row.dueAt ? new Date(row.dueAt) : booking.opsDueAt,
      };
      if (!booking.opsFirstPendingAt) {
        $set.opsFirstPendingAt = new Date(row.firstPendingAt);
      }

      await this.bookingModel.updateOne({ _id: booking._id }, { $set }).exec();
      synced += 1;

      const lastReason = booking.opsAlertReason;
      const lastSent = booking.opsAlertSentAt
        ? new Date(booking.opsAlertSentAt).getTime()
        : 0;
      const withinCooldown =
        lastReason === row.reason && now.getTime() - lastSent < cooldownMs;
      if (withinCooldown) continue;

      const note = `[OPS] ${row.reason}: ${row.nextAction} (age ${row.ageLabel})`;
      await this.bookingModel
        .updateOne(
          { _id: booking._id },
          {
            $set: {
              opsAlertReason: row.reason,
              opsAlertSentAt: now,
            },
            $push: { adminNotes: note },
          },
        )
        .exec();
      this.logger.log(`Ops alert ${row.bookingId} ${row.reason}`);
      notified += 1;
    }

    return { synced, notified };
  }

  private async collectOverdueRows(
    thresholds: OpsThresholds,
  ): Promise<OpsOverdueRow[]> {
    const now = new Date();
    const byBooking = new Map<string, OpsOverdueRow>();

    const add = (row: OpsOverdueRow) => {
      const existing = byBooking.get(row.bookingId);
      if (!existing) {
        byBooking.set(row.bookingId, row);
        return;
      }
      const existingRank = REASON_PRIORITY.indexOf(existing.reason);
      const nextRank = REASON_PRIORITY.indexOf(row.reason);
      if (nextRank >= 0 && (existingRank < 0 || nextRank < existingRank)) {
        byBooking.set(row.bookingId, {
          ...row,
          // Preserve the earliest age anchor across reason flips.
          firstPendingAt:
            new Date(existing.firstPendingAt) < new Date(row.firstPendingAt)
              ? existing.firstPendingAt
              : row.firstPendingAt,
          ageMs: Math.max(existing.ageMs, row.ageMs),
          ageLabel: formatAge(Math.max(existing.ageMs, row.ageMs)),
          ownerId: existing.ownerId || row.ownerId,
          ownerName: existing.ownerName || row.ownerName,
        });
      }
    };

    const unassigned = await this.bookingModel
      .find({
        dispatchStatus: 'NEEDS_ADMIN',
        technicianId: null,
        status: { $ne: 'CANCELLED' },
      })
      .populate('opsOwnerId', 'fullName phone')
      .lean()
      .exec();
    for (const booking of unassigned as any[]) {
      add(
        this.toRow(booking, 'UNASSIGNED', now, {
          dueAt:
            booking.opsDueAt ||
            booking.adminEscalatedAt ||
            booking.dispatchExpiresAt,
        }),
      );
    }

    const acceptedCutoff = new Date(
      now.getTime() - thresholds.acceptedNotStartedHours * 60 * 60 * 1000,
    );
    const acceptedNotStarted = await this.bookingModel
      .find({
        assignmentStatus: 'ACCEPTED',
        status: 'ASSIGNED',
        acceptedAt: { $lte: acceptedCutoff },
      })
      .populate('opsOwnerId', 'fullName phone')
      .lean()
      .exec();
    for (const booking of acceptedNotStarted as any[]) {
      const dueAt = new Date(
        new Date(booking.acceptedAt).getTime() +
          thresholds.acceptedNotStartedHours * 60 * 60 * 1000,
      );
      add(this.toRow(booking, 'ACCEPTED_NOT_STARTED', now, { dueAt }));
    }

    const partsCutoff = new Date(
      now.getTime() - thresholds.partsWaitHours * 60 * 60 * 1000,
    );
    const partsWaits = await this.bookingModel
      .find({
        status: { $ne: 'CANCELLED' },
        $or: [
          { opsPartsWait: true },
          { opsPendingReason: 'PARTS_WAIT' },
        ],
        $and: [
          {
            $or: [
              { opsDueAt: { $lte: now } },
              {
                opsDueAt: { $exists: false },
                opsFirstPendingAt: { $lte: partsCutoff },
              },
              {
                opsDueAt: { $exists: false },
                opsFirstPendingAt: { $exists: false },
                createdAt: { $lte: partsCutoff },
              },
            ],
          },
        ],
      })
      .populate('opsOwnerId', 'fullName phone')
      .lean()
      .exec();
    for (const booking of partsWaits as any[]) {
      const dueAt =
        booking.opsDueAt ||
        new Date(
          new Date(booking.opsFirstPendingAt || booking.createdAt).getTime() +
            thresholds.partsWaitHours * 60 * 60 * 1000,
        );
      add(this.toRow(booking, 'PARTS_WAIT', now, { dueAt }));
    }

    const visitCutoff = new Date(
      now.getTime() - thresholds.visitOverdueHours * 60 * 60 * 1000,
    );
    const overdueVisits = await this.visitModel
      .find({
        status: { $in: ['SCHEDULED', 'IN_PROGRESS'] },
        scheduledDate: { $lte: visitCutoff },
      })
      .select('bookingId scheduledDate')
      .lean()
      .exec();
    const visitBookingIds = [
      ...new Set(overdueVisits.map((v) => String(v.bookingId))),
    ];
    if (visitBookingIds.length) {
      const visitBookings = await this.bookingModel
        .find({
          _id: { $in: visitBookingIds.map((id) => new Types.ObjectId(id)) },
          status: { $nin: ['CANCELLED', 'COMPLETED', 'PAYMENT_COLLECTED'] },
        })
        .populate('opsOwnerId', 'fullName phone')
        .lean()
        .exec();
      const visitByBooking = new Map(
        overdueVisits.map((v) => [String(v.bookingId), v.scheduledDate]),
      );
      for (const booking of visitBookings as any[]) {
        const scheduled = visitByBooking.get(String(booking._id));
        const dueAt = scheduled
          ? new Date(
              new Date(scheduled).getTime() +
                thresholds.visitOverdueHours * 60 * 60 * 1000,
            )
          : undefined;
        add(this.toRow(booking, 'OVERDUE_VISIT', now, { dueAt }));
      }
    }

    const reviewCutoff = new Date(
      now.getTime() - thresholds.reviewOverdueHours * 60 * 60 * 1000,
    );
    const reviews = await this.bookingModel
      .find({
        reviewStatus: 'PENDING',
        $or: [
          { jobClosed: true },
          { status: { $in: ['COMPLETED', 'PAYMENT_COLLECTED'] } },
        ],
        $and: [
          {
            $or: [
              { jobClosedAt: { $lte: reviewCutoff } },
              {
                jobClosedAt: { $exists: false },
                updatedAt: { $lte: reviewCutoff },
              },
            ],
          },
        ],
      })
      .populate('opsOwnerId', 'fullName phone')
      .lean()
      .exec();
    for (const booking of reviews as any[]) {
      const anchor = booking.jobClosedAt || booking.updatedAt || booking.createdAt;
      const dueAt = new Date(
        new Date(anchor).getTime() +
          thresholds.reviewOverdueHours * 60 * 60 * 1000,
      );
      add(this.toRow(booking, 'OVERDUE_REVIEW', now, { dueAt }));
    }

    return [...byBooking.values()];
  }

  private toRow(
    booking: any,
    reason: OpsPendingReason,
    now: Date,
    opts: { dueAt?: Date | string | null } = {},
  ): OpsOverdueRow {
    const firstPendingAt = new Date(
      booking.opsFirstPendingAt || booking.createdAt || now,
    );
    const ageMs = Math.max(0, now.getTime() - firstPendingAt.getTime());
    const owner =
      booking.opsOwnerId && typeof booking.opsOwnerId === 'object'
        ? booking.opsOwnerId
        : null;
    const due = opts.dueAt || booking.opsDueAt || null;
    return {
      bookingId: String(booking._id),
      reason,
      nextAction: booking.opsNextAction || NEXT_ACTION[reason],
      ownerId: owner
        ? String(owner._id)
        : booking.opsOwnerId
          ? String(booking.opsOwnerId)
          : null,
      ownerName: owner?.fullName || owner?.phone || null,
      dueAt: due ? new Date(due).toISOString() : null,
      ageMs,
      ageLabel: formatAge(ageMs),
      firstPendingAt: firstPendingAt.toISOString(),
      createdAt: booking.createdAt
        ? new Date(booking.createdAt).toISOString()
        : undefined,
      status: booking.status,
      dispatchStatus: booking.dispatchStatus,
      contactPhone: booking.contactPhone,
      opsPartsWait: Boolean(booking.opsPartsWait),
    };
  }
}

function formatAge(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}
