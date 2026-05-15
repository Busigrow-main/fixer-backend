import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Appliance, ApplianceSchema } from './schemas/appliance.schema';
import { AppliancesController } from './appliances.controller';
import { AppliancesService } from './appliances.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Appliance.name, schema: ApplianceSchema },
    ]),
  ],
  controllers: [AppliancesController],
  providers: [AppliancesService],
  exports: [AppliancesService],
})
export class AppliancesModule {}
