import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Booking, BookingSchema } from '../../bookings/schemas/booking.schema';
import { Earning, EarningSchema } from '../schemas/earning.schema';
import {
  Settlement,
  SettlementSchema,
} from '../settlements/schemas/settlement.schema';
import { PerformanceSummaryController } from './performance-summary.controller';
import { PerformanceSummaryScheduler } from './performance-summary.scheduler';
import { PerformanceSummaryService } from './performance-summary.service';
import {
  ServicePerformanceSummary,
  ServicePerformanceSummarySchema,
} from './schemas/service-performance-summary.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ServicePerformanceSummary.name, schema: ServicePerformanceSummarySchema },
      { name: Booking.name, schema: BookingSchema },
      { name: Earning.name, schema: EarningSchema },
      { name: Settlement.name, schema: SettlementSchema },
    ]),
  ],
  providers: [PerformanceSummaryService, PerformanceSummaryScheduler],
  controllers: [PerformanceSummaryController],
  exports: [PerformanceSummaryService],
})
export class PerformanceSummaryModule {}
