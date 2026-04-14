import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ServicesModule } from './services/services.module';
import { SparePartsModule } from './spare-parts/spare-parts.module';
import { BookingsModule } from './bookings/bookings.module';
import { PartOrdersModule } from './part-orders/part-orders.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    MongooseModule.forRoot(process.env.MONGO_URI || 'mongodb://localhost:27017/fixxer'),
    UsersModule,
    AuthModule,
    ServicesModule,
    SparePartsModule,
    BookingsModule,
    PartOrdersModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
