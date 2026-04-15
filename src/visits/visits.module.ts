import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VisitsController } from './visits.controller';
import { VisitsService } from './visits.service';
import { Visit, VisitSchema } from './schemas/visit.schema';
import { SparePartUsage, SparePartUsageSchema } from './schemas/spare-part-usage.schema';
import { SparePartsModule } from '../spare-parts/spare-parts.module';
import { Booking, BookingSchema } from '../bookings/schemas/booking.schema';
import { SparePartSchema } from '../spare-parts/schemas/spare-part.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Visit.name, schema: VisitSchema },
      { name: SparePartUsage.name, schema: SparePartUsageSchema },
      { name: Booking.name, schema: BookingSchema },
      { name: 'SparePart', schema: SparePartSchema }
    ]),
    SparePartsModule
  ],
  controllers: [VisitsController],
  providers: [VisitsService],
  exports: [VisitsService],
})
export class VisitsModule {}
