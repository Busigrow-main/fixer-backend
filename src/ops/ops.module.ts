import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { Booking, BookingSchema } from '../bookings/schemas/booking.schema';
import { Visit, VisitSchema } from '../visits/schemas/visit.schema';
import { OpsController } from './ops.controller';
import { OpsQueueScheduler } from './ops-queue.scheduler';
import { OpsQueueService } from './ops-queue.service';
import { OpsSettingsService } from './ops-settings.service';
import { OpsSettings, OpsSettingsSchema } from './schemas/ops-settings.schema';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: OpsSettings.name, schema: OpsSettingsSchema },
      { name: Booking.name, schema: BookingSchema },
      { name: Visit.name, schema: VisitSchema },
    ]),
  ],
  controllers: [OpsController],
  providers: [OpsSettingsService, OpsQueueService, OpsQueueScheduler],
  exports: [OpsSettingsService, OpsQueueService],
})
export class OpsModule {}
