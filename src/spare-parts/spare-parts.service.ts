import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SparePart, SparePartDocument } from './schemas/spare-part.schema';
import {
  ApplianceType,
  ApplianceTypeDocument,
} from './schemas/appliance-type.schema';
import { Brand, BrandDocument } from './schemas/brand.schema';
import { Model as ModelSpec, ModelDocument } from './schemas/model.schema';
import {
  CategoryTree,
  CategoryTreeDocument,
} from './schemas/category-tree.schema';

@Injectable()
export class SparePartsService {
  private readonly logger = new Logger(SparePartsService.name);

  constructor(
    @InjectModel(SparePart.name)
    private sparePartModel: Model<SparePartDocument>,
    @InjectModel(ApplianceType.name)
    private applianceTypeModel: Model<ApplianceTypeDocument>,
    @InjectModel(Brand.name) private brandModel: Model<BrandDocument>,
    @InjectModel(ModelSpec.name) private modelModel: Model<ModelDocument>,
    @InjectModel(CategoryTree.name)
    private categoryTreeModel: Model<CategoryTreeDocument>,
  ) {}

  async findAll(queryObj: any): Promise<any> {
    const {
      q,
      applianceType,
      brand,
      model,
      partCategory,
      isUniversal,
      isFeatured,
      page = 1,
      limit = 24,
      sort,
    } = queryObj;

    const filter: any = { isActive: true };

    if (q) {
      filter.$text = { $search: q };
    }

    if (applianceType) {
      filter.applianceTypeSlug = applianceType;
    }

    if (brand) {
      filter.brandSlug = brand;
    }

    if (model) {
      filter['compatibleModels.modelNumber'] = model;
    }

    if (partCategory) {
      filter.partCategory = partCategory;
    }

    if (isUniversal !== undefined) {
      filter.isUniversal = isUniversal === 'true';
    }

    if (isFeatured !== undefined) {
      filter.isFeatured = isFeatured === 'true';
    }

    const skip = (page - 1) * limit;

    let sortOptions: any = { createdAt: -1 };
    if (sort === 'price_asc') sortOptions = { price: 1 };
    if (sort === 'price_desc') sortOptions = { price: -1 };
    if (sort === 'popular') sortOptions = { soldCount: -1 };

    const [data, total] = await Promise.all([
      this.sparePartModel
        .find(filter)
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .exec(),
      this.sparePartModel.countDocuments(filter).exec(),
    ]);

    return {
      data,
      metadata: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getNavigationTree(): Promise<CategoryTreeDocument[]> {
    return this.categoryTreeModel.find().sort({ sortOrder: 1 }).exec();
  }

  async getBrandsForType(applianceTypeSlug: string): Promise<any> {
    const brands = await this.brandModel
      .find({ applianceTypes: applianceTypeSlug, isActive: true })
      .exec();

    // Also check for universal parts to see if we should show the "Generic" card
    const universalCount = await this.sparePartModel.countDocuments({
      applianceTypeSlug,
      isUniversal: true,
      isActive: true,
    });

    return {
      brands,
      hasUniversalParts: universalCount > 0,
      universalPartsCount: universalCount,
    };
  }

  async getModelsForBrand(
    brandSlug: string,
    applianceTypeSlug: string,
  ): Promise<ModelDocument[]> {
    return this.modelModel
      .find({ brandSlug, applianceTypeSlug, isActive: true })
      .exec();
  }

  async getCategories(): Promise<string[]> {
    return this.sparePartModel.distinct('partCategory').exec();
  }

  async findBySku(sku: string): Promise<SparePartDocument> {
    const sparePart = await this.sparePartModel
      .findOne({ sku, isActive: true })
      .exec();
    if (!sparePart) throw new NotFoundException('Spare Part not found');
    return sparePart;
  }

  async findById(id: string): Promise<SparePartDocument> {
    const sparePart = await this.sparePartModel.findById(id).exec();
    if (!sparePart) throw new NotFoundException('Spare Part not found');
    return sparePart;
  }

  async create(createSparePartDto: any): Promise<SparePart> {
    const createdSparePart = new this.sparePartModel(createSparePartDto);
    return createdSparePart.save();
  }

  async update(id: string, updateSparePartDto: any): Promise<SparePart> {
    const updatedSparePart = await this.sparePartModel
      .findByIdAndUpdate(id, updateSparePartDto, { returnDocument: 'after' })
      .exec();
    if (!updatedSparePart) throw new NotFoundException('Spare Part not found');
    return updatedSparePart;
  }

  async delete(id: string): Promise<SparePart> {
    const deletedSparePart = await this.sparePartModel
      .findByIdAndDelete(id)
      .exec();
    if (!deletedSparePart) throw new NotFoundException('Spare Part not found');
    return deletedSparePart;
  }

  async countAll(): Promise<number> {
    return this.sparePartModel.countDocuments().exec();
  }

  async bulkUpsert(documents: any[]): Promise<any> {
    const BATCH_SIZE = 500;
    let totalInserted = 0;
    let totalUpdated = 0;
    const errors: { row: number; reason: string }[] = [];

    for (let i = 0; i < documents.length; i += BATCH_SIZE) {
      const batch = documents.slice(i, i + BATCH_SIZE);

      const operations = batch.map((doc, idx) => ({
        updateOne: {
          filter: { partNumber: doc.partNumber },
          update: { $set: doc },
          upsert: true,
        },
      }));

      try {
        const result = await this.sparePartModel.bulkWrite(operations, {
          ordered: false,
        });
        totalInserted += result.upsertedCount;
        totalUpdated += result.modifiedCount;
      } catch (err: any) {
        // Handle partial failures from ordered: false
        if (err.result) {
          totalInserted += err.result.nUpserted || 0;
          totalUpdated += err.result.nModified || 0;
        }
        // Capture individual write errors
        if (err.writeErrors) {
          err.writeErrors.forEach((we: any) => {
            errors.push({
              row: i + we.index + 1,
              reason: we.errmsg || 'Write error',
            });
          });
        }
      }
    }

    return {
      totalProcessed: documents.length,
      inserted: totalInserted,
      updated: totalUpdated,
      failed: errors.length,
      errors: errors.slice(0, 100), // Cap error reporting
    };
  }

  async refreshCategoryTree(): Promise<void> {
    this.logger.log('Refreshing navigation category tree...');
    const applianceTypes = await this.applianceTypeModel
      .find({ isActive: true })
      .sort({ sortOrder: 1 })
      .exec();

    for (const type of applianceTypes) {
      const brands = await this.brandModel
        .find({ applianceTypes: type.slug, isActive: true })
        .exec();

      const brandsWithCounts = await Promise.all(
        brands.map(async (brand) => {
          const count = await this.sparePartModel.countDocuments({
            applianceTypeSlug: type.slug,
            brandSlug: brand.slug,
            isActive: true,
          });

          const hasUniversal = await this.sparePartModel.exists({
            applianceTypeSlug: type.slug,
            brandSlug: brand.slug,
            isUniversal: true,
            isActive: true,
          });

          return {
            brandSlug: brand.slug,
            brandName: brand.name,
            logoUrl: brand.logoUrl,
            partCount: count,
            hasUniversalParts: !!hasUniversal,
          };
        }),
      );

      const universalCount = await this.sparePartModel.countDocuments({
        applianceTypeSlug: type.slug,
        isUniversal: true,
        isActive: true,
      });

      const totalCount = await this.sparePartModel.countDocuments({
        applianceTypeSlug: type.slug,
        isActive: true,
      });

      await this.categoryTreeModel.findOneAndUpdate(
        { applianceTypeSlug: type.slug },
        {
          applianceTypeName: type.name,
          applianceTypeIcon: type.icon,
          sortOrder: type.sortOrder,
          brands: brandsWithCounts,
          universalPartsCount: universalCount,
          totalPartsCount: totalCount,
        },
        { upsert: true },
      );
    }
    this.logger.log('Navigation category tree refreshed successfully.');
  }

  // --- Helpers for CRUD with tree refresh ---
  async createPart(data: any) {
    const part = await this.sparePartModel.create(data);
    this.refreshCategoryTree(); // Fire and forget
    return part;
  }

  async updatePart(id: string, data: any) {
    const part = await this.sparePartModel.findByIdAndUpdate(id, data, {
      new: true,
    });
    this.refreshCategoryTree();
    return part;
  }

  async exportAll(): Promise<SparePartDocument[]> {
    return this.sparePartModel.find().lean().exec();
  }
}
