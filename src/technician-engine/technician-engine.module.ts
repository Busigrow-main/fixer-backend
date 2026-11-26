import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TechniciansModule } from '../technicians/technicians.module';
import { Booking, BookingSchema } from '../bookings/schemas/booking.schema';
import { Technician, TechnicianSchema } from '../technicians/schemas/technician.schema';
import { TechnicianEngineService } from './technician-engine.service';
import { TechnicianScheduleService } from './technician-schedule.service';

/**
 * Must never import BookingsModule (BookingsModule imports this one).
 * Scheduling reads Booking/Technician through their models only.
 */
@Module({
  imports: [
    TechniciansModule,
    MongooseModule.forFeature([
      { name: Booking.name, schema: BookingSchema },
      { name: Technician.name, schema: TechnicianSchema },
    ]),
  ],
  providers: [TechnicianEngineService, TechnicianScheduleService],
  exports: [TechnicianEngineService, TechnicianScheduleService],
})
export class TechnicianEngineModule {}
