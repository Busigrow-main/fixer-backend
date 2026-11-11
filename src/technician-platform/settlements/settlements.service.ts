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
  RecordSettlementPaymentDto,
  ReconcileSettlementDto,
} from './settlements.dto';

const IST_TIME_ZONE = 'Asia/Kolkata';
const PREPARATION_LEASE_MS = 10 * 60 * 1000;
const TERMINAL_SETTLEMENT_STATUSES = [
  SettlementStatus.PREPARED,
  SettlementStatus.APPROVED,
  SettlementStatus.REJECTED,
  SettlementStatus.PAID,
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

  async prepareAll(cutoffAt = new Date()) {
    const settlementDate = businessDate(cutoffAt);
    const technicianIds = await this.earningModel.distinct('technicianId', {
      earnedAt: { $lte: cutoffAt },
    }).exec();
    const prepared = [];

    for (const technicianId of technicianIds) {
      try {
        prepared.push(await this.prepareTechnician(
          String(technicianId),
          settlementDate,
          cutoffAt,
        ));
      } catch (error) {
        this.logger.error(
          `Settlement preparation failed for technician ${String(technicianId)}`,
          error,
        );
      }
    }

    return prepared;
  }

  async prepareTechnician(
    technicianId: string,
    settlementDate = businessDate(new Date()),
    cutoffAt = new Date(),
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
      earnedAt: { $lte: cutoffAt },
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
    const status = successful ? SettlementStatus.PAID : SettlementStatus.APPROVED;
    const paymentStatus = successful
      ? SettlementPaymentStatus.SUCCESS
      : SettlementPaymentStatus.FAILED;
    return this.transition(id, SettlementStatus.APPROVED, {
      $set: {
        status,
        paymentStatus,
        paymentReference: dto.paymentReference,
        paymentMethod: dto.paymentMethod,
        paymentInitiatedAt: new Date(),
        ...(successful ? { paidAt: new Date() } : { paymentFailureReason: dto.failureReason }),
      },
      $push: {
        auditTrail: {
          action: successful ? 'PAID' : 'PAYMENT_FAILED',
          performedBy: adminId,
          performedAt: new Date(),
          metadata: { paymentReference: dto.paymentReference },
          reason: dto.failureReason,
        },
      },
    });
  }

  async reconcile(id: string, dto: ReconcileSettlementDto, admin: AuthenticatedAdmin) {
    const adminId = this.toObjectId(admin.userId, 'admin ID');
    const settlementId = this.toObjectId(id, 'settlement ID');
    const result = await this.settlementModel.findOneAndUpdate(
      {
        _id: settlementId,
        status: SettlementStatus.PAID,
        paymentReference: { $exists: true, $ne: '' },
      },
      {
        $set: {
          reconciliationStatus: dto.status,
          reconciledAt: new Date(),
          reconciledBy: adminId,
          reconciliationNotes: dto.notes,
        },
        $push: {
          auditTrail: {
            action: 'RECONCILED',
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
        status: { $in: [SettlementStatus.PREPARED, SettlementStatus.APPROVED] },
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
