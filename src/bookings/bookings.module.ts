import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { Booking, BookingSchema } from './schemas/booking.schema';
import { Service, ServiceSchema } from '../services/schemas/service.schema';
import { Technician, TechnicianSchema } from '../technicians/schemas/technician.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { WarrantiesModule } from '../warranties/warranties.module';
import { DispatchModule } from '../technician-platform/dispatch/dispatch.module';
import { VisitsModule } from '../visits/visits.module';
import { CustomerAppliancesModule } from '../customer-appliances/customer-appliances.module';
import { ServiceablePincodesModule } from '../serviceable-pincodes/serviceable-pincodes.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Booking.name, schema: BookingSchema },
      { name: Service.name, schema: ServiceSchema },
      { name: Technician.name, schema: TechnicianSchema },
      { name: User.name, schema: UserSchema },
    ]),
    WarrantiesModule,
    DispatchModule,
    forwardRef(() => VisitsModule),
    CustomerAppliancesModule,
    ServiceablePincodesModule,
  ],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
