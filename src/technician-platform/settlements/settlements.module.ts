
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  Settlement,
  SettlementSchema,
} from './schemas/settlement.schema';

import {
  SettlementItem,
  SettlementItemSchema,
} from './schemas/settlement-item.schema';

import {
  Earning,
  EarningSchema,
} from '../schemas/earning.schema';
import { SettlementsService } from './settlements.service';
import { SettlementsController } from './settlements.controller';
import { SettlementScheduler } from './settlement.scheduler';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Settlement.name, schema: SettlementSchema },
      { name: SettlementItem.name, schema: SettlementItemSchema },
      { name: Earning.name, schema: EarningSchema },
    ]),
  ],
  providers: [SettlementsService, SettlementScheduler],
  controllers: [SettlementsController],
  exports: [MongooseModule, SettlementsService],
})
export class SettlementsModule {}
