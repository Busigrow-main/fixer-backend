import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { BookingsModule } from '../bookings/bookings.module';
import { SparePartsModule } from '../spare-parts/spare-parts.module';
import { PartOrdersModule } from '../part-orders/part-orders.module';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    BookingsModule,
    SparePartsModule,
    PartOrdersModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
