import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  CustomerAppliance,
  CustomerApplianceSchema,
} from './schemas/customer-appliance.schema';
import { Booking, BookingSchema } from '../bookings/schemas/booking.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { CustomerAppliancesService } from './customer-appliances.service';
import {
  AdminApplianceMappingsController,
  CustomerAppliancesController,
} from './customer-appliances.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CustomerAppliance.name, schema: CustomerApplianceSchema },
      { name: Booking.name, schema: BookingSchema },
      { name: User.name, schema: UserSchema },
    ]),
    AuthModule,
  ],
  controllers: [
    CustomerAppliancesController,
    AdminApplianceMappingsController,
  ],
  providers: [CustomerAppliancesService],
  exports: [CustomerAppliancesService],
})
export class CustomerAppliancesModule {}
