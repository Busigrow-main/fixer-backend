import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Appliance, ApplianceDocument } from './schemas/appliance.schema';
import {
  CreateApplianceDto,
  UpdateApplianceDto,
  FilterApplianceDto,
  ApplianceResponseDto,
} from './dtos/appliance.dto';

@Injectable()
export class AppliancesService {
  constructor(
    @InjectModel(Appliance.name)
    private applianceModel: Model<ApplianceDocument>,
  ) {}

  /**
   * Find all appliances with filtering, sorting, and pagination
   */
  async findAll(filters: FilterApplianceDto): Promise<ApplianceResponseDto> {
    const {
      capacity,
      stars,
      type,
      minPrice,
      maxPrice,
      inStock,
      sort = 'newest',
      page = 1,
      perPage = 12,
    } = filters;

    // Build filter query
    const query: any = {
      applianceCategory: 'ac',
      isActive: true,
    };

    if (capacity) {
      query.capacityTon = capacity;
    }

    if (stars) {
      query.starRating = { $gte: stars };
    }

    if (type) {
      // Handle "inverter" type filter - it's a property, not just ac_type
      if (type === 'inverter') {
        query.isInverter = true;
      } else {
        query.acType = type;
      }
    }

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = minPrice;
      if (maxPrice) query.price.$lte = maxPrice;
    }

    if (inStock !== undefined) {
      query.inStock = inStock;
    }

    // Build sort
    let sortOptions: any = { createdAt: -1 }; // default: newest
    switch (sort) {
      case 'price_asc':
        sortOptions = { price: 1 };
        break;
      case 'price_desc':
        sortOptions = { price: -1 };
        break;
      case 'rating_desc':
        sortOptions = { starRating: -1 };
        break;
      case 'newest':
      default:
        sortOptions = { createdAt: -1 };
    }

    // Pagination
    const skip = (page - 1) * perPage;

    // Execute queries
    const [products, total] = await Promise.all([
      this.applianceModel
        .find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(perPage)
        .lean()
        .exec(),
      this.applianceModel.countDocuments(query),
    ]);

    return {
      status: 'success',
      total,
      page,
      perPage,
      products: products.map((p) => this.formatProduct(p)),
    };
  }

  /**
   * Find single appliance by slug
   */
  async findBySlug(slug: string): Promise<any> {
    const product = await this.applianceModel
      .findOne({ slug, isActive: true })
      .lean()
      .exec();

    if (!product) {
      throw new NotFoundException(`Product with slug "${slug}" not found`);
    }

    return {
      status: 'success',
      product: this.formatProduct(product),
    };
  }

  /**
   * Create new appliance (admin only)
   */
  async create(createDto: CreateApplianceDto): Promise<any> {
    // Validate slug uniqueness
    const existing = await this.applianceModel.findOne({
      slug: createDto.slug,
    });
    if (existing) {
      throw new BadRequestException(`Slug "${createDto.slug}" already exists`);
    }

    // Ensure appliance category is set
    const applianceData = {
      ...createDto,
      applianceCategory: 'ac',
      isActive: createDto.isActive !== false,
    };

    const appliance = new this.applianceModel(applianceData);
    const saved = await appliance.save();

    return {
      status: 'success',
      product: this.formatProduct(saved.toObject()),
    };
  }

  /**
   * Update appliance (admin only)
   */
  async update(slug: string, updateDto: UpdateApplianceDto): Promise<any> {
    const product = await this.applianceModel.findOneAndUpdate(
      { slug },
      updateDto,
      { new: true, runValidators: true },
    );

    if (!product) {
      throw new NotFoundException(`Product with slug "${slug}" not found`);
    }

    return {
      status: 'success',
      product: this.formatProduct(product.toObject()),
    };
  }

  /**
   * Helper: Format product response (snake_case to camelCase conversion for API)
   */
  private formatProduct(product: any): any {
    return {
      id: product._id.toString(),
      slug: product.slug,
      name: product.name,
      brand: product.brand,
      modelNumber: product.modelNumber,
      price: product.price,
      originalPrice: product.originalPrice,
      capacityTon: product.capacityTon,
      starRating: product.starRating,
      acType: product.acType,
      isInverter: product.isInverter,
      description: product.description,
      shortDescription: product.shortDescription,
      images: product.images,
      specs: product.specs,
      inStock: product.inStock,
      warrantyYears: product.warrantyYears,
      installationIncluded: product.installationIncluded,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }
}
