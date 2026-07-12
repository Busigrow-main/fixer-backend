import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Earning, EarningDocument } from '../schemas/earning.schema';

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
  }) {
    return this.earningModel.create({
      technicianId: new Types.ObjectId(data.technicianId),
      bookingId: data.bookingId ? new Types.ObjectId(data.bookingId) : undefined,
      amount: data.amount,
      type: data.type,
      paymentMethod: data.paymentMethod,
      description: data.description,
      earnedAt: new Date(),
    });
  }

  async getSummary(technicianId: string, period: 'daily' | 'weekly' | 'monthly' = 'daily') {
    const techObjectId = new Types.ObjectId(technicianId);
    const now = new Date();
    let from = new Date();

    if (period === 'weekly') from.setDate(now.getDate() - 7);
    else if (period === 'monthly') from.setMonth(now.getMonth() - 1);
    else from.setHours(0, 0, 0, 0);

    const result = await this.earningModel.aggregate([
      { $match: { technicianId: techObjectId, earnedAt: { $gte: from } } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]);

    return {
      period,
      total: result[0]?.total || 0,
      transactions: result[0]?.count || 0,
    };
  }

  getHistory(technicianId: string) {
    return this.earningModel
      .find({ technicianId: new Types.ObjectId(technicianId) })
      .sort({ earnedAt: -1 })
      .exec();
  }

  async getById(technicianId: string, id: string) {
    const earning = await this.earningModel.findOne({
      _id: id,
      technicianId: new Types.ObjectId(technicianId),
    });
    if (!earning) throw new NotFoundException('Transaction not found');
    return earning;
  }
}
