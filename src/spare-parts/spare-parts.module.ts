import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SparePartsController } from './spare-parts.controller';
import { SparePartsService } from './spare-parts.service';
import { SparePart, SparePartSchema } from './schemas/spare-part.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: SparePart.name, schema: SparePartSchema }])],
  controllers: [SparePartsController],
  providers: [SparePartsService],
})
export class SparePartsModule {}
