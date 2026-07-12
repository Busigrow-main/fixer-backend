import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TechniciansController } from './technicians.controller';
import { TechniciansService } from './technicians.service';
import { Technician, TechnicianSchema } from './schemas/technician.schema';
import { Booking, BookingSchema } from '../bookings/schemas/booking.schema';
import { AuthModule } from '../auth/auth.module';
import {
  VerificationDocument,
  VerificationDocumentSchema,
} from '../technician-platform/schemas/verification-document.schema';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: Technician.name, schema: TechnicianSchema },
      { name: Booking.name, schema: BookingSchema },
      { name: VerificationDocument.name, schema: VerificationDocumentSchema },
    ]),
  ],
  controllers: [TechniciansController],
  providers: [TechniciansService],
  exports: [TechniciansService],
})
export class TechniciansModule {}
