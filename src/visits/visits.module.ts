import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VisitsController } from './visits.controller';
import { VisitsService } from './visits.service';
import { Visit, VisitSchema } from './schemas/visit.schema';
import {
  SparePartUsage,
  SparePartUsageSchema,
} from './schemas/spare-part-usage.schema';
import { SparePartsModule } from '../spare-parts/spare-parts.module';
import { Booking, BookingSchema } from '../bookings/schemas/booking.schema';
import { SparePartSchema } from '../spare-parts/schemas/spare-part.schema';
import { WarrantiesModule } from '../warranties/warranties.module';
import { AuthModule } from '../auth/auth.module';
import {
  PartInventoryTransaction,
  PartInventoryTransactionSchema,
} from './schemas/part-inventory-transaction.schema';
import {
  TechnicianPartRequest,
  TechnicianPartRequestSchema,
} from './schemas/technician-part-request.schema';
import { TechnicianPartRequestsService } from './technician-part-requests.service';
import { AdminPartRequestsController } from './part-requests-admin.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Visit.name, schema: VisitSchema },
      { name: SparePartUsage.name, schema: SparePartUsageSchema },
      {
        name: PartInventoryTransaction.name,
        schema: PartInventoryTransactionSchema,
      },
      { name: TechnicianPartRequest.name, schema: TechnicianPartRequestSchema },
      { name: Booking.name, schema: BookingSchema },
      { name: 'SparePart', schema: SparePartSchema },
    ]),
    SparePartsModule,
    WarrantiesModule,
    AuthModule,
  ],
  controllers: [VisitsController, AdminPartRequestsController],
  providers: [VisitsService, TechnicianPartRequestsService],
  exports: [VisitsService, TechnicianPartRequestsService],
})
export class VisitsModule {}
