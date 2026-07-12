import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Booking, BookingDocument } from '../../bookings/schemas/booking.schema';
import { Earning, EarningDocument } from '../schemas/earning.schema';

@Injectable()
export class TechnicianDashboardService {
  constructor(
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
    @InjectModel(Earning.name) private earningModel: Model<EarningDocument>,
  ) {}

  async getDashboard(technicianId: string) {
    const techObjectId = new Types.ObjectId(technicianId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      todaysJobs,
      pendingJobs,
      completedJobs,
      earningsAgg,
      allAssigned,
      completedCount,
    ] = await Promise.all([
      this.bookingModel.countDocuments({
        technicianId: techObjectId,
        assignedAt: { $gte: today, $lt: tomorrow },
      }),
      this.bookingModel.countDocuments({
        technicianId: techObjectId,
        status: { $in: ['ASSIGNED', 'EN_ROUTE', 'IN_PROGRESS'] },
      }),
      this.bookingModel.countDocuments({
        technicianId: techObjectId,
        status: { $in: ['COMPLETED', 'PAYMENT_COLLECTED'] },
      }),
      this.earningModel.aggregate([
        { $match: { technicianId: techObjectId } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      this.bookingModel.countDocuments({ technicianId: techObjectId }),
      this.bookingModel.countDocuments({
        technicianId: techObjectId,
        status: { $in: ['COMPLETED', 'PAYMENT_COLLECTED', 'CANCELLED'] },
      }),
    ]);

    const earnings = earningsAgg[0]?.total || 0;
    const completionRate =
      allAssigned > 0 ? Math.round((completedJobs / allAssigned) * 100) : 0;

    return {
      todaysJobs,
      earnings,
      completedJobs,
      pendingJobs,
      rating: 0,
      completionRate,
    };
  }

  async getStats(technicianId: string) {
    const techObjectId = new Types.ObjectId(technicianId);
    const statusBreakdown = await this.bookingModel.aggregate([
      { $match: { technicianId: techObjectId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const weeklyEarnings = await this.earningModel.aggregate([
      {
        $match: {
          technicianId: techObjectId,
          earnedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    return {
      statusBreakdown,
      weeklyEarnings: weeklyEarnings[0]?.total || 0,
    };
  }
}
