import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PartOrdersController } from './part-orders.controller';
import { PartOrdersService } from './part-orders.service';
import { PartOrder, PartOrderSchema } from './schemas/part-order.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: PartOrder.name, schema: PartOrderSchema }])],
  controllers: [PartOrdersController],
  providers: [PartOrdersService],
  exports: [PartOrdersService],
})
export class PartOrdersModule {}
