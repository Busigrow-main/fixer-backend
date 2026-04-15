import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TechniciansController } from './technicians.controller';
import { TechniciansService } from './technicians.service';
import { Technician, TechnicianSchema } from './schemas/technician.schema';
import { Booking, BookingSchema } from '../bookings/schemas/booking.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Technician.name, schema: TechnicianSchema },
      { name: Booking.name, schema: BookingSchema },
    ]),
  ],
  controllers: [TechniciansController],
  providers: [TechniciansService],
  exports: [TechniciansService],
})
export class TechniciansModule {}
