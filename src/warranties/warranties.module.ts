import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WarrantiesService } from './warranties.service';
import { Warranty, WarrantySchema } from './schemas/warranty.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Warranty.name, schema: WarrantySchema },
    ]),
  ],
  providers: [WarrantiesService],
  exports: [WarrantiesService],
})
export class WarrantiesModule {}
