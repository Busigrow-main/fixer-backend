import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ServicesModule } from './services/services.module';
import { SparePartsModule } from './spare-parts/spare-parts.module';
import { AppliancesModule } from './appliances/appliances.module';
import { BookingsModule } from './bookings/bookings.module';
import { PartOrdersModule } from './part-orders/part-orders.module';
import { AdminModule } from './admin/admin.module';
import { TechniciansModule } from './technicians/technicians.module';
import { VisitsModule } from './visits/visits.module';
import { WarrantiesModule } from './warranties/warranties.module';

@Module({
  imports: [
    MongooseModule.forRoot(
      process.env.MONGO_URI || 'mongodb://localhost:27017/fixxer',
    ),
    UsersModule,
    AuthModule,
    ServicesModule,
    SparePartsModule,
    AppliancesModule,
    BookingsModule,
    PartOrdersModule,
    AdminModule,
    TechniciansModule,
    VisitsModule,
    WarrantiesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
