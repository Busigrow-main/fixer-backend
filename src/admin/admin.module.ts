import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { BookingsModule } from '../bookings/bookings.module';
import { SparePartsModule } from '../spare-parts/spare-parts.module';
import { PartOrdersModule } from '../part-orders/part-orders.module';
import { WarrantiesModule } from '../warranties/warranties.module';
import { ServiceablePincodesModule } from '../serviceable-pincodes/serviceable-pincodes.module';
import { ShopModule } from '../shop/shop.module';
import { OpsModule } from '../ops/ops.module';
import { TechnicianEngineModule } from '../technician-engine/technician-engine.module';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Booking, BookingSchema } from '../bookings/schemas/booking.schema';
import {
  CustomerAppliance,
  CustomerApplianceSchema,
} from '../customer-appliances/schemas/customer-appliance.schema';
import { Visit, VisitSchema } from '../visits/schemas/visit.schema';
import {
  PartInventoryTransaction,
  PartInventoryTransactionSchema,
} from '../visits/schemas/part-inventory-transaction.schema';
import { Feedback, FeedbackSchema } from '../feedback/schemas/feedback.schema';
import {
  Warranty,
  WarrantySchema,
} from '../warranties/schemas/warranty.schema';
import {
  FeedbackFollowUp,
  FeedbackFollowUpSchema,
} from '../feedback/schemas/feedback-follow-up.schema';
import { CustomerServiceHistoryService } from './customer-service-history.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Booking.name, schema: BookingSchema },
      { name: CustomerAppliance.name, schema: CustomerApplianceSchema },
      { name: Visit.name, schema: VisitSchema },
      {
        name: PartInventoryTransaction.name,
        schema: PartInventoryTransactionSchema,
      },
      { name: Feedback.name, schema: FeedbackSchema },
      { name: Warranty.name, schema: WarrantySchema },
      { name: FeedbackFollowUp.name, schema: FeedbackFollowUpSchema },
    ]),
    AuthModule,
    UsersModule,
    BookingsModule,
    SparePartsModule,
    PartOrdersModule,
    WarrantiesModule,
    ServiceablePincodesModule,
    ShopModule,
    OpsModule,
    TechnicianEngineModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, CustomerServiceHistoryService],
})
export class AdminModule {}
