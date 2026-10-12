import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PartOrdersController } from './part-orders.controller';
import { PartOrdersService } from './part-orders.service';
import { PartOrder, PartOrderSchema } from './schemas/part-order.schema';
import { SparePart, SparePartSchema } from '../spare-parts/schemas/spare-part.schema';
import { Appliance, ApplianceSchema } from '../appliances/schemas/appliance.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PartOrder.name, schema: PartOrderSchema },
      { name: SparePart.name, schema: SparePartSchema },
      { name: Appliance.name, schema: ApplianceSchema },
    ]),
  ],
  controllers: [PartOrdersController],
  providers: [PartOrdersService],
  exports: [PartOrdersService],
})
export class PartOrdersModule {}
