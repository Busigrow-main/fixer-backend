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
import {
  PartCategory,
  PartCategoryDocument,
} from './schemas/part-category.schema';

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
    @InjectModel(PartCategory.name)
    private partCategoryModel: Model<PartCategoryDocument>,
  ) {}

  // ================================================================
  // CATEGORY-DRIVEN NAVIGATION (no search coupling)
  // ================================================================

  /** Get full navigation tree — all appliance types with their part categories */
  async getNavigationTree(): Promise<CategoryTreeDocument[]> {
    return this.categoryTreeModel.find().sort({ sortOrder: 1 }).exec();
  }

  /** Get a single appliance type's tree (part categories + brands) */
  async getTypeTree(applianceTypeSlug: string): Promise<CategoryTreeDocument> {
    const tree = await this.categoryTreeModel
      .findOne({ applianceTypeSlug })
      .exec();
    if (!tree) throw new NotFoundException(`Appliance type '${applianceTypeSlug}' not found`);
    return tree;
  }

  /** Get parts by category (structured query — no $text search) */
  async getPartsByCategory(
    applianceTypeSlug: string,
    partCategorySlug: string,
    brandSlug?: string,
    isUniversal?: boolean,
    page: number = 1,
    limit: number = 24,
    sort?: string,
  ): Promise<any> {
    // Resolve partCategory slug to name
    const partCat = await this.partCategoryModel
      .findOne({ slug: partCategorySlug, applianceTypeSlug })
      .exec();
    if (!partCat) throw new NotFoundException(`Part category '${partCategorySlug}' not found`);

    const filter: any = {
      applianceTypeSlug,
      partCategory: partCat.name,
      isActive: true,
    };

    if (brandSlug) {
      filter.brandSlug = brandSlug;
    }

    if (isUniversal !== undefined) {
      filter.isUniversal = isUniversal;
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
        .limit(limit)
        .exec(),
      this.sparePartModel.countDocuments(filter).exec(),
    ]);

    return {
      data,
      metadata: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      context: {
        applianceType: applianceTypeSlug,
        partCategory: { slug: partCat.slug, name: partCat.name },
        brand: brandSlug || null,
      },
    };
  }

  // ================================================================
  // SEARCH (independent, never triggered by navigation)
  // ================================================================

  async searchParts(queryObj: any): Promise<any> {
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

  // ================================================================
  // LOOKUP HELPERS
  // ================================================================

  async getBrandsForType(applianceTypeSlug: string): Promise<any> {
    const brands = await this.brandModel
      .find({ applianceTypes: applianceTypeSlug, isActive: true })
      .exec();

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

  async getPartCategories(): Promise<string[]> {
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

  // ================================================================
  // CRUD
  // ================================================================

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
        if (err.result) {
          totalInserted += err.result.nUpserted || 0;
          totalUpdated += err.result.nModified || 0;
        }
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
      errors: errors.slice(0, 100),
    };
  }

  // ================================================================
  // CATEGORY TREE REFRESH
  // ================================================================

  async refreshCategoryTree(): Promise<void> {
    this.logger.log('Refreshing navigation category tree...');
    const applianceTypes = await this.applianceTypeModel
      .find({ isActive: true })
      .sort({ sortOrder: 1 })
      .exec();

    for (const type of applianceTypes) {
      // Get all part categories for this appliance type
      const partCategories = await this.partCategoryModel
        .find({ applianceTypeSlug: type.slug, isActive: true })
        .sort({ sortOrder: 1 })
        .exec();

      const partCategoriesWithCounts = await Promise.all(
        partCategories.map(async (cat) => {
          const catPartCount = await this.sparePartModel.countDocuments({
            applianceTypeSlug: type.slug,
            partCategory: cat.name,
            isActive: true,
          });

          // Get brands that have parts in this category
          const brandsInCategory = await this.sparePartModel.aggregate([
            {
              $match: {
                applianceTypeSlug: type.slug,
                partCategory: cat.name,
                isActive: true,
                brandSlug: { $ne: null },
              },
            },
            {
              $group: {
                _id: '$brandSlug',
                partCount: { $sum: 1 },
              },
            },
          ]);

          // Resolve brand names
          const brandsWithNames = await Promise.all(
            brandsInCategory.map(async (b) => {
              const brand = await this.brandModel
                .findOne({ slug: b._id })
                .exec();
              return {
                brandSlug: b._id,
                brandName: brand?.name || b._id,
                partCount: b.partCount,
              };
            }),
          );

          // Update denormalized count on the PartCategory doc
          await this.partCategoryModel.findByIdAndUpdate(cat._id, {
            partCount: catPartCount,
          });

          return {
            slug: cat.slug,
            name: cat.name,
            icon: cat.icon || 'category',
            partCount: catPartCount,
            brands: brandsWithNames,
          };
        }),
      );

      // Top-level brand summary
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

          return {
            brandSlug: brand.slug,
            brandName: brand.name,
            logoUrl: brand.logoUrl || '',
            partCount: count,
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
          partCategories: partCategoriesWithCounts,
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
