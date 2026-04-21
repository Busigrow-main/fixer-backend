import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SparePartsController } from './spare-parts.controller';
import { SparePartsService } from './spare-parts.service';
import { SparePart, SparePartSchema } from './schemas/spare-part.schema';
import { ApplianceType, ApplianceTypeSchema } from './schemas/appliance-type.schema';
import { Brand, BrandSchema } from './schemas/brand.schema';
import { Model, ModelSchema } from './schemas/model.schema';
import { CategoryTree, CategoryTreeSchema } from './schemas/category-tree.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SparePart.name, schema: SparePartSchema },
      { name: ApplianceType.name, schema: ApplianceTypeSchema },
      { name: Brand.name, schema: BrandSchema },
      { name: Model.name, schema: ModelSchema },
      { name: CategoryTree.name, schema: CategoryTreeSchema },
    ]),
  ],
  controllers: [SparePartsController],
  providers: [SparePartsService],
  exports: [SparePartsService],
})
export class SparePartsModule {}
