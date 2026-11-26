import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { Model, Types } from 'mongoose';

import {
  Earning,
  EarningDocument,
} from '../schemas/earning.schema';
import {
  Settlement,
  SettlementDocument,
  SettlementPaymentStatus,
  SettlementReconciliationStatus,
  SettlementStatus,
} from './schemas/settlement.schema';
import {
  SettlementItem,
  SettlementItemClaimStatus,
  SettlementItemDocument,
} from './schemas/settlement-item.schema';
import {
  AddSettlementAdjustmentDto,
  MarkSettlementPayableDto,
  RecordSettlementPaymentDto,
  ReconcileSettlementDto,
} from './settlements.dto';

const IST_TIME_ZONE = 'Asia/Kolkata';
const PREPARATION_LEASE_MS = 10 * 60 * 1000;
const TERMINAL_SETTLEMENT_STATUSES = [
  SettlementStatus.PREPARED,
  SettlementStatus.APPROVED,
  SettlementStatus.PAYABLE,
  SettlementStatus.REJECTED,
  SettlementStatus.PAID,
  SettlementStatus.RECONCILED,
  SettlementStatus.CANCELLED,
];

type AuthenticatedAdmin = { userId: string };

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error &&
    (error as { code?: number }).code === 11000;
}

function businessDate(at: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(at);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function parseBusinessDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new BadRequestException('settlementDate must use YYYY-MM-DD');
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (date.toISOString().slice(0, 10) !== value) {
    throw new BadRequestException('settlementDate is invalid');
  }
  return date;
}

function previousBusinessDate(at: Date): string {
  const date = parseBusinessDate(businessDate(at));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function windowForBusinessDate(settlementDate: string) {
  const utcDate = parseBusinessDate(settlementDate);
  const startAt = new Date(utcDate.getTime() - (5 * 60 + 30) * 60 * 1000);
  return { startAt, cutoffAt: new Date(startAt.getTime() + 24 * 60 * 60 * 1000) };
}

@Injectable()
export class SettlementsService {
  private readonly logger = new Logger(SettlementsService.name);

  constructor(
    @InjectModel(Settlement.name)
    private readonly settlementModel: Model<SettlementDocument>,
    @InjectModel(SettlementItem.name)
    private readonly settlementItemModel: Model<SettlementItemDocument>,
    @InjectModel(Earning.name)
    private readonly earningModel: Model<EarningDocument>,
  ) {}

  async prepareAll(anchorAt?: Date, requestedSettlementDate?: string) {
    if (anchorAt && Number.isNaN(anchorAt.getTime())) {
      throw new BadRequestException('cutoffAt is invalid');
    }
    if (requestedSettlementDate && anchorAt) {
      throw new BadRequestException('Provide settlementDate or cutoffAt, not both');
    }
    const settlementDate = requestedSettlementDate || previousBusinessDate(anchorAt || new Date());
    parseBusinessDate(settlementDate);
    const window = windowForBusinessDate(settlementDate);
    const technicianIds = await this.earningModel.distinct('technicianId', {
      earnedAt: { $gte: window.startAt, $lt: window.cutoffAt },
    }).exec();
    const prepared = [];
    const errors: Array<{ technicianId: string; reason: string }> = [];

    for (const technicianId of technicianIds) {
      try {
        prepared.push(await this.prepareTechnician(
          String(technicianId),
          settlementDate,
          window.cutoffAt,
        ));
      } catch (error) {
        this.logger.error(
          `Settlement preparation failed for technician ${String(technicianId)}`,
          error,
        );
        errors.push({
          technicianId: String(technicianId),
          reason: 'Preparation failed; inspect the settlement audit trail for details.',
        });
      }
    }

    return {
      settlementDate,
      windowStart: window.startAt,
      cutoffAt: window.cutoffAt,
      candidateTechnicians: technicianIds.length,
      settlements: prepared,
      errors,
    };
  }

  async prepareTechnician(
    technicianId: string,
    settlementDate = previousBusinessDate(new Date()),
    cutoffAt = windowForBusinessDate(settlementDate).cutoffAt,
  ) {
    const technicianObjectId = this.toObjectId(technicianId, 'technician ID');
    const token = randomUUID();
    const leaseUntil = new Date(Date.now() + PREPARATION_LEASE_MS);
    let settlement: SettlementDocument | null;
    try {
      settlement = await this.settlementModel.findOneAndUpdate(
        { technicianId: technicianObjectId, settlementDate },
        {
          $setOnInsert: {
            technicianId: technicianObjectId,
            settlementDate,
            cutoffAt,
            totalEarnings: 0,
            adjustments: 0,
            netPayable: 0,
            currency: 'INR',
            status: SettlementStatus.PREPARING,
            paymentStatus: SettlementPaymentStatus.NOT_INITIATED,
            reconciliationStatus: SettlementReconciliationStatus.PENDING,
            auditTrail: [{
              action: 'PREPARATION_STARTED',
              performedAt: new Date(),
              metadata: { cutoffAt },
            }],
            preparationToken: token,
            preparationLeaseUntil: leaseUntil,
          },
        },
        { upsert: true, new: true },
      ).exec();
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      settlement = await this.settlementModel.findOne({
        technicianId: technicianObjectId,
        settlementDate,
      }).exec();
    }

    if (!settlement) {
      throw new ConflictException('Unable to create settlement');
    }
    // If another concurrent worker won the upsert and holds an active lease,
    // return the existing settlement without preparing again.
    if (
      settlement.preparationToken &&
      settlement.preparationToken !== token &&
      settlement.preparationLeaseUntil &&
      settlement.preparationLeaseUntil > new Date()
    ) {
      return settlement;
    }
    if (TERMINAL_SETTLEMENT_STATUSES.includes(settlement.status)) {
      return settlement;
    }

    const acquired = await this.settlementModel.findOneAndUpdate(
      {
        _id: settlement._id,
        status: {
          $in: [SettlementStatus.PREPARING, SettlementStatus.PREPARATION_FAILED],
        },
        $or: [
          { preparationLeaseUntil: { $exists: false } },
          { preparationLeaseUntil: { $lte: new Date() } },
          { preparationToken: token },
        ],
      },
      {
        $set: {
          status: SettlementStatus.PREPARING,
          cutoffAt,
          preparationToken: token,
          preparationLeaseUntil: leaseUntil,
        },
        $push: {
          auditTrail: {
            action: 'PREPARATION_STARTED',
            performedAt: new Date(),
            metadata: { cutoffAt, recovery: true },
          },
        },
      },
      { new: true },
    ).exec();

    if (!acquired) {
      return settlement;
    }
    settlement = acquired;

    try {
      const existingFinalized = await this.settlementItemModel.countDocuments({
        settlementId: settlement._id,
        claimStatus: SettlementItemClaimStatus.FINALIZED,
      }).exec();

      if (existingFinalized === 0) {
        await this.claimEligibleEarnings(
          settlement._id,
          technicianObjectId,
          windowForBusinessDate(settlementDate).startAt,
          cutoffAt,
        );
      }

      const items = await this.settlementItemModel.find({
        settlementId: settlement._id,
        claimStatus: {
          $in: [
            SettlementItemClaimStatus.CLAIMED,
            SettlementItemClaimStatus.FINALIZED,
          ],
        },
      }).lean().exec();
      const totalEarnings = items.reduce((total, item) => total + item.amount, 0);

      await this.settlementItemModel.updateMany(
        {
          settlementId: settlement._id,
          claimStatus: SettlementItemClaimStatus.CLAIMED,
        },
        { $set: { claimStatus: SettlementItemClaimStatus.FINALIZED } },
      ).exec();

      return await this.settlementModel.findOneAndUpdate(
        { _id: settlement._id, preparationToken: token },
        {
          $set: {
            status: SettlementStatus.PREPARED,
            totalEarnings,
            netPayable: totalEarnings + settlement.adjustments,
          },
          $unset: {
            preparationToken: 1,
            preparationLeaseUntil: 1,
          },
          $push: {
            auditTrail: {
              action: 'PREPARED',
              performedAt: new Date(),
              metadata: { itemCount: items.length, totalEarnings },
            },
          },
        },
        { new: true },
      ).exec();
    } catch (error) {
      await this.settlementModel.updateOne(
        { _id: settlement._id, preparationToken: token },
        {
          $set: {
            status: SettlementStatus.PREPARATION_FAILED,
            preparationFailureReason: error instanceof Error ? error.message : 'Unknown preparation error',
          },
          $unset: { preparationToken: 1, preparationLeaseUntil: 1 },
          $push: {
            auditTrail: {
              action: 'PREPARATION_FAILED',
              performedAt: new Date(),
              reason: error instanceof Error ? error.message : 'Unknown preparation error',
            },
          },
        },
      ).exec();
      this.logger.error(`Settlement preparation failed for ${technicianId}`, error);
      throw error;
    }
  }

  private async claimEligibleEarnings(
    settlementId: Types.ObjectId,
    technicianId: Types.ObjectId,
    startAt: Date,
    cutoffAt: Date,
  ) {
    const existingClaims = await this.settlementItemModel.find({
      technicianId,
      claimStatus: {
        $in: [
          SettlementItemClaimStatus.CLAIMED,
          SettlementItemClaimStatus.FINALIZED,
        ],
      },
    }).select({ earningId: 1 }).lean().exec();
    const claimedIds = new Set(existingClaims.map((item) => String(item.earningId)));
    const earnings = await this.earningModel.find({
      technicianId,
      earnedAt: { $gte: startAt, $lt: cutoffAt },
    }).sort({ earnedAt: 1, _id: 1 }).lean().exec();

    for (const earning of earnings) {
      if (claimedIds.has(String(earning._id))) continue;
      try {
        await this.settlementItemModel.create({
          settlementId,
          earningId: earning._id,
          technicianId: earning.technicianId,
          bookingId: earning.bookingId,
          amount: earning.amount,
          earningType: earning.type,
          description: earning.description,
          earnedAt: earning.earnedAt,
          customerPaymentMethod: earning.paymentMethod,
          claimStatus: SettlementItemClaimStatus.CLAIMED,
        });
      } catch (error) {
        if (!isDuplicateKeyError(error)) throw error;
      }
    }
  }

  async list() {
    return this.settlementModel.find().sort({ settlementDate: -1, createdAt: -1 }).lean().exec();
  }

  async getById(id: string) {
    const settlementId = this.toObjectId(id, 'settlement ID');
    const settlement = await this.settlementModel.findById(settlementId).lean().exec();
    if (!settlement) throw new NotFoundException('Settlement not found');
    const items = await this.settlementItemModel.find({ settlementId }).sort({ earnedAt: 1 }).lean().exec();
    return { ...settlement, items };
  }

  async approve(id: string, admin: AuthenticatedAdmin) {
    const adminId = this.toObjectId(admin.userId, 'admin ID');
    return this.transition(id, SettlementStatus.PREPARED, {
      $set: { status: SettlementStatus.APPROVED, approvedBy: adminId, approvedAt: new Date() },
      $push: { auditTrail: { action: 'APPROVED', performedBy: adminId, performedAt: new Date() } },
    });
  }

  async markPayable(id: string, dto: MarkSettlementPayableDto, admin: AuthenticatedAdmin) {
    const adminId = this.toObjectId(admin.userId, 'admin ID');
    return this.transition(id, SettlementStatus.APPROVED, {
      $set: { status: SettlementStatus.PAYABLE },
      $push: {
        auditTrail: {
          action: 'MARKED_PAYABLE',
          performedBy: adminId,
          performedAt: new Date(),
          reason: dto.notes?.trim() || undefined,
        },
      },
    });
  }

  async addAdjustment(
    id: string,
    dto: AddSettlementAdjustmentDto,
    admin: AuthenticatedAdmin,
  ) {
    const adminId = this.toObjectId(admin.userId, 'admin ID');
    if (!Number.isFinite(dto.amount) || dto.amount === 0) {
      throw new BadRequestException('Adjustment amount must be a non-zero number');
    }
    const reason = dto.reason.trim();
    if (!reason) throw new BadRequestException('Adjustment reason is required');
    const idempotencyKey = dto.idempotencyKey?.trim();
    if (!idempotencyKey) throw new BadRequestException('Adjustment idempotency key is required');
    const settlementId = this.toObjectId(id, 'settlement ID');
    const result = await this.settlementModel.findOneAndUpdate(
      {
        _id: settlementId,
        status: { $in: [SettlementStatus.APPROVED, SettlementStatus.PAYABLE] },
        netPayable: { $gte: Math.max(0, -dto.amount) },
        'adjustmentEntries.idempotencyKey': { $ne: idempotencyKey },
      },
      {
        $inc: { adjustments: dto.amount, netPayable: dto.amount },
        $push: {
          adjustmentEntries: {
            idempotencyKey,
            amount: dto.amount,
            reason,
            performedBy: adminId,
            performedAt: new Date(),
          },
          auditTrail: {
            action: 'ADJUSTMENT_ADDED',
            performedBy: adminId,
            performedAt: new Date(),
            reason,
            metadata: { amount: dto.amount },
          },
        },
      },
      { new: true },
    ).exec();
    if (result) return result;
    const existing = await this.settlementModel.findById(settlementId).lean().exec();
    if (!existing) throw new NotFoundException('Settlement not found');
    const priorAdjustment = (existing.adjustmentEntries || []).find(
      (entry) => entry.idempotencyKey === idempotencyKey,
    );
    if (priorAdjustment) {
      if (
        Number(priorAdjustment.amount) === dto.amount &&
        priorAdjustment.reason === reason &&
        String(priorAdjustment.performedBy) === String(adminId)
      ) return existing;
      throw new ConflictException('Adjustment idempotency key was already used for a different adjustment');
    }
    if (![SettlementStatus.APPROVED, SettlementStatus.PAYABLE].includes(existing.status)) {
      throw new ConflictException('Adjustments are only allowed after approval and before payment');
    }
    throw new ConflictException('Adjustment cannot reduce the payable amount below zero');
  }

  async reject(id: string, reason: string, admin: AuthenticatedAdmin) {
    const adminId = this.toObjectId(admin.userId, 'admin ID');
    return this.transition(id, SettlementStatus.PREPARED, {
      $set: { status: SettlementStatus.REJECTED, rejectedBy: adminId, rejectedAt: new Date(), rejectionReason: reason },
      $push: { auditTrail: { action: 'REJECTED', performedBy: adminId, performedAt: new Date(), reason } },
    });
  }

  async recordPayment(id: string, dto: RecordSettlementPaymentDto, admin: AuthenticatedAdmin) {
    const adminId = this.toObjectId(admin.userId, 'admin ID');
    const successful = dto.successful === true;
    if (successful && !dto.paymentReference?.trim()) {
      throw new BadRequestException('Payment reference is required for successful confirmation');
    }
    if (!successful && !dto.failureReason?.trim()) {
      throw new BadRequestException('Failure reason is required when payment fails');
    }
    const settlementId = this.toObjectId(id, 'settlement ID');
    const now = new Date();
    const update: Record<string, unknown> = successful
      ? {
          $set: {
            status: SettlementStatus.PAID,
            paymentStatus: SettlementPaymentStatus.SUCCESS,
            paymentReference: dto.paymentReference!.trim(),
            paymentMethod: dto.paymentMethod?.trim() || undefined,
            paymentInitiatedAt: now,
            paidAt: now,
          },
          $unset: { paymentFailureReason: 1 },
          $push: {
            auditTrail: {
              action: 'PAID',
              performedBy: adminId,
              performedAt: now,
              metadata: { paymentReference: dto.paymentReference!.trim() },
            },
          },
        }
      : {
          $set: {
            status: SettlementStatus.PAYABLE,
            paymentStatus: SettlementPaymentStatus.FAILED,
            paymentInitiatedAt: now,
            paymentFailureReason: dto.failureReason!.trim(),
          },
          $push: {
            auditTrail: {
              action: 'PAYMENT_FAILED',
              performedBy: adminId,
              performedAt: now,
              reason: dto.failureReason!.trim(),
              metadata: dto.paymentReference?.trim()
                ? { paymentReference: dto.paymentReference.trim() }
                : undefined,
            },
          },
        };
    try {
      const result = await this.settlementModel.findOneAndUpdate(
        {
          _id: settlementId,
          status: SettlementStatus.PAYABLE,
          paymentStatus: { $in: [SettlementPaymentStatus.NOT_INITIATED, SettlementPaymentStatus.FAILED] },
        },
        update,
        { new: true },
      ).exec();
      if (result) return result;
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ConflictException('Payment reference is already recorded on another settlement');
      }
      throw error;
    }
    const existing = await this.settlementModel.findById(settlementId).lean().exec();
    if (!existing) throw new NotFoundException('Settlement not found');
    if (
      successful && [SettlementStatus.PAID, SettlementStatus.RECONCILED].includes(existing.status) &&
      existing.paymentReference === dto.paymentReference?.trim() &&
      (!dto.paymentMethod?.trim() || existing.paymentMethod === dto.paymentMethod.trim())
    ) return existing;
    throw new ConflictException(`Settlement must be PAYABLE before recording payment; current status is ${existing.status}`);
  }

  async reconcile(id: string, dto: ReconcileSettlementDto, admin: AuthenticatedAdmin) {
    const adminId = this.toObjectId(admin.userId, 'admin ID');
    const settlementId = this.toObjectId(id, 'settlement ID');
    const result = await this.settlementModel.findOneAndUpdate(
      {
        _id: settlementId,
        status: { $in: [SettlementStatus.PAID, SettlementStatus.RECONCILED] },
        paymentReference: { $exists: true, $ne: '' },
      },
      {
        $set: {
          reconciliationStatus: dto.status,
          reconciledAt: new Date(),
          reconciledBy: adminId,
          reconciliationNotes: dto.notes,
          status: dto.status === SettlementReconciliationStatus.MATCHED
            ? SettlementStatus.RECONCILED
            : SettlementStatus.PAID,
        },
        $push: {
          auditTrail: {
            action: dto.status === SettlementReconciliationStatus.MATCHED
              ? 'RECONCILED'
              : 'RECONCILIATION_DISPUTED',
            performedBy: adminId,
            performedAt: new Date(),
            reason: dto.notes,
            metadata: { status: dto.status },
          },
        },
      },
      { new: true },
    ).exec();
    if (!result) throw new ConflictException('Only a paid settlement with a payment reference can be reconciled');
    return result;
  }

  async cancel(id: string, reason: string, admin: AuthenticatedAdmin) {
    const adminId = this.toObjectId(admin.userId, 'admin ID');
    const settlementId = this.toObjectId(id, 'settlement ID');
    const result = await this.settlementModel.findOneAndUpdate(
      {
        _id: settlementId,
        status: { $in: [SettlementStatus.PREPARED, SettlementStatus.APPROVED, SettlementStatus.PAYABLE] },
      },
      {
        $set: { status: SettlementStatus.CANCELLED },
        $push: {
          auditTrail: {
            action: 'CANCELLED',
            performedBy: adminId,
            performedAt: new Date(),
            reason,
          },
        },
      },
      { new: true },
    ).exec();
    if (result) return result;
    const existing = await this.settlementModel.findById(settlementId).select({ status: 1 }).lean().exec();
    if (!existing) throw new NotFoundException('Settlement not found');
    throw new ConflictException(`Settlement cannot be cancelled from ${existing.status}`);
  }

  private async transition(
    id: string,
    expectedStatus: SettlementStatus,
    update: Record<string, unknown>,
  ) {
    const settlementId = this.toObjectId(id, 'settlement ID');
    const result = await this.settlementModel.findOneAndUpdate(
      { _id: settlementId, status: expectedStatus },
      update,
      { new: true },
    ).exec();
    if (result) return result;
    const existing = await this.settlementModel.findById(settlementId).select({ status: 1 }).lean().exec();
    if (!existing) throw new NotFoundException('Settlement not found');
    throw new ConflictException(`Settlement must be ${expectedStatus}, but is ${existing.status}`);
  }

  private toObjectId(value: string, label: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException(`Invalid ${label}`);
    }
    return new Types.ObjectId(value);
  }
}
