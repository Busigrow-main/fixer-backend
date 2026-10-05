import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { PartOrdersModule } from '../part-orders/part-orders.module';
import { SparePartsModule } from '../spare-parts/spare-parts.module';
import { ShopPartHelpController } from './shop-part-help.controller';
import { ShopPartHelpService } from './shop-part-help.service';
import {
  ShopPartHelpRequest,
  ShopPartHelpRequestSchema,
} from './schemas/shop-part-help.schema';

@Module({
  imports: [
    AuthModule,
    PartOrdersModule,
    SparePartsModule,
    MongooseModule.forFeature([
      { name: ShopPartHelpRequest.name, schema: ShopPartHelpRequestSchema },
    ]),
  ],
  controllers: [ShopPartHelpController],
  providers: [ShopPartHelpService],
})
export class ShopPartHelpModule {}
