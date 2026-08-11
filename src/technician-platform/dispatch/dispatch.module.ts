import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MongooseModule } from '@nestjs/mongoose';
import { Booking, BookingSchema } from '../../bookings/schemas/booking.schema';
import { Service, ServiceSchema } from '../../services/schemas/service.schema';
import { Technician, TechnicianSchema } from '../../technicians/schemas/technician.schema';
import { Notification, NotificationSchema } from '../schemas/notification.schema';
import { NotificationDispatchService } from '../common/notification-dispatch.service';
import { JobDispatchService } from './job-dispatch.service';
import { DispatchEscalationScheduler } from './dispatch-escalation.scheduler';

/**
 * Shared dispatch + notification providers so BookingsModule can broadcast
 * without a circular import on TechnicianPlatformModule.
 */
@Module({
  imports: [
    ScheduleModule.forRoot(),
    MongooseModule.forFeature([
      { name: Booking.name, schema: BookingSchema },
      { name: Service.name, schema: ServiceSchema },
      { name: Technician.name, schema: TechnicianSchema },
      { name: Notification.name, schema: NotificationSchema },
    ]),
  ],
  providers: [NotificationDispatchService, JobDispatchService, DispatchEscalationScheduler],
  exports: [NotificationDispatchService, JobDispatchService, MongooseModule],
})
export class DispatchModule {}
