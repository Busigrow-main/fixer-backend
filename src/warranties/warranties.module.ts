import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WarrantiesService } from './warranties.service';
import { Warranty, WarrantySchema } from './schemas/warranty.schema';
import {
  SparePartUsage,
  SparePartUsageSchema,
} from '../visits/schemas/spare-part-usage.schema';
import { Visit, VisitSchema } from '../visits/schemas/visit.schema';
import { Booking, BookingSchema } from '../bookings/schemas/booking.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Warranty.name, schema: WarrantySchema },
      { name: SparePartUsage.name, schema: SparePartUsageSchema },
      { name: Visit.name, schema: VisitSchema },
      { name: Booking.name, schema: BookingSchema },
    ]),
  ],
  providers: [WarrantiesService],
  exports: [WarrantiesService],
})
export class WarrantiesModule {}
