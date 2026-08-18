import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Earning, EarningDocument } from '../schemas/earning.schema';
import { earningDisplayLabel } from '../settlement';

const JOB_PAYOUT_TYPES = ['LABOUR', 'PARTS', 'SELF_PART_FEE'];

@Injectable()
export class EarningsService {
  constructor(
    @InjectModel(Earning.name) private earningModel: Model<EarningDocument>,
  ) {}

  recordEarning(data: {
    technicianId: string;
    bookingId?: string;
    amount: number;
    type: string;
    paymentMethod: string;
    description?: string;
    earnedAt?: Date;
  }) {
    return this.earningModel.create({
      technicianId: new Types.ObjectId(data.technicianId),
      bookingId: data.bookingId ? new Types.ObjectId(data.bookingId) : undefined,
      amount: data.amount,
      type: data.type,
      paymentMethod: data.paymentMethod,
      description: data.description,
      earnedAt: data.earnedAt || new Date(),
    });
  }

  /** True if labour/parts payout lines already exist for this job (not self-part fees). */
  async hasJobPayout(technicianId: string, bookingId: string) {
    const count = await this.earningModel.countDocuments({
      technicianId: new Types.ObjectId(technicianId),
      bookingId: new Types.ObjectId(bookingId),
      type: { $in: ['LABOUR', 'PARTS'] },
    });
    return count > 0;
  }

  /** Replace labour/parts/fee lines for a job with the current settlement split. */
  async replaceJobPayout(data: {
    technicianId: string;
    bookingId: string;
    paymentMethod: string;
    earnedAt: Date;
    lines: Array<{ amount: number; type: string; description: string }>;
  }) {
    await this.earningModel.deleteMany({
      bookingId: new Types.ObjectId(data.bookingId),
      type: { $in: JOB_PAYOUT_TYPES },
    });
    if (!data.lines.length) return [];
    return this.earningModel.insertMany(
      data.lines.map((line) => ({
        technicianId: new Types.ObjectId(data.technicianId),
        bookingId: new Types.ObjectId(data.bookingId),
        amount: line.amount,
        type: line.type,
        paymentMethod: data.paymentMethod,
        description: line.description,
        earnedAt: data.earnedAt,
      })),
    );
  }

  async getSummary(technicianId: string, period: 'daily' | 'weekly' | 'monthly' = 'daily') {
    const techObjectId = new Types.ObjectId(technicianId);
    const now = new Date();
    let from = new Date();

    if (period === 'weekly') from.setDate(now.getDate() - 7);
    else if (period === 'monthly') from.setMonth(now.getMonth() - 1);
    else from.setHours(0, 0, 0, 0);

    const [totals, byType] = await Promise.all([
      this.earningModel.aggregate([
        { $match: { technicianId: techObjectId, earnedAt: { $gte: from } } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      this.earningModel.aggregate([
        { $match: { technicianId: techObjectId, earnedAt: { $gte: from } } },
        { $group: { _id: '$type', total: { $sum: '$amount' } } },
      ]),
    ]);

    const typeMap = Object.fromEntries(byType.map((row) => [row._id, row.total]));
    return {
      period,
      total: totals[0]?.total || 0,
      transactions: totals[0]?.count || 0,
      breakdown: {
        labour: typeMap.LABOUR || 0,
        parts: typeMap.PARTS || 0,
        fees: typeMap.SELF_PART_FEE || 0,
        other: (typeMap.BONUS || 0) + (typeMap.JOINING_FEE_REFUND || 0),
      },
    };
  }

  async getHistory(technicianId: string) {
    const rows = await this.earningModel
      .find({ technicianId: new Types.ObjectId(technicianId) })
      .sort({ earnedAt: -1 })
      .lean()
      .exec();
    return rows.map((row) => this.toHistoryItem(row));
  }

  async getById(technicianId: string, id: string) {
    const earning = await this.earningModel.findOne({
      _id: id,
      technicianId: new Types.ObjectId(technicianId),
    }).lean();
    if (!earning) throw new NotFoundException('Transaction not found');
    return this.toHistoryItem(earning);
  }

  private toHistoryItem(row: Record<string, any>) {
    return {
      ...row,
      label: earningDisplayLabel(row),
    };
  }
}
