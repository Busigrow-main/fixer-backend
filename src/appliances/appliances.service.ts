import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Appliance, ApplianceDocument } from './schemas/appliance.schema';
import {
  CreateApplianceDto, UpdateApplianceDto,
  FilterApplianceDto, ApplianceResponseDto,
} from './dtos/appliance.dto';

@Injectable()
export class AppliancesService {
  constructor(
    @InjectModel(Appliance.name)
    private applianceModel: Model<ApplianceDocument>,
  ) {}

  async findAll(filters: FilterApplianceDto): Promise<ApplianceResponseDto> {
    const {
      capacity, stars, brand, series, type,
      minPrice, maxPrice, inStock,
      sort = 'newest', page = 1, perPage = 12,
    } = filters;

    const query: any = { applianceCategory: 'ac', isActive: true };

    if (capacity)  query.capacityTon = capacity;
    if (stars)     query.starRating = { $gte: Number(stars) };
    if (brand)     query.brand = { $regex: brand, $options: 'i' };
    if (series)    query.series = { $regex: series, $options: 'i' };

    if (type) {
      if (type === 'inverter')      query.isInverter = true;
      else if (type === 'fixed-speed') query.isInverter = false;
      else                           query.acType = type;
    }

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    if (inStock !== undefined) query.inStock = inStock;

    let sortOptions: any = { createdAt: -1 };
    switch (sort) {
      case 'price_asc':   sortOptions = { price: 1 };       break;
      case 'price_desc':  sortOptions = { price: -1 };      break;
      case 'rating_desc': sortOptions = { starRating: -1 }; break;
      default:            sortOptions = { capacityTon: 1, price: 1 }; // logical default
    }

    const skip = (Number(page) - 1) * Number(perPage);

    const [products, total] = await Promise.all([
      this.applianceModel.find(query).sort(sortOptions).skip(skip).limit(Number(perPage)).lean().exec(),
      this.applianceModel.countDocuments(query),
    ]);

    return {
      status: 'success',
      total,
      page: Number(page),
      perPage: Number(perPage),
      products: products.map((p) => this.formatProduct(p)),
    };
  }

  async findBySlug(slug: string): Promise<any> {
    const product = await this.applianceModel.findOne({ slug, isActive: true }).lean().exec();
    if (!product) throw new NotFoundException(`Product "${slug}" not found`);
    return { status: 'success', product: this.formatProduct(product) };
  }

  async create(createDto: CreateApplianceDto): Promise<any> {
    const existing = await this.applianceModel.findOne({ slug: createDto.slug });
    if (existing) throw new BadRequestException(`Slug "${createDto.slug}" already exists`);
    const appliance = new this.applianceModel({ ...createDto, applianceCategory: 'ac', isActive: createDto.isActive !== false });
    const saved = await appliance.save();
    return { status: 'success', product: this.formatProduct(saved.toObject()) };
  }

  async update(slug: string, updateDto: UpdateApplianceDto): Promise<any> {
    const product = await this.applianceModel.findOneAndUpdate({ slug }, updateDto, { new: true, runValidators: true });
    if (!product) throw new NotFoundException(`Product "${slug}" not found`);
    return { status: 'success', product: this.formatProduct(product.toObject()) };
  }

  private formatProduct(p: any): any {
    return {
      id:               p._id?.toString(),
      slug:             p.slug,
      name:             p.name,
      brand:            p.brand,
      modelNumber:      p.modelNumber,
      sku:              p.sku,
      series:           p.series,
      descriptionCode:  p.descriptionCode,
      price:            p.price,
      originalPrice:    p.originalPrice,
      nlcPrice:         p.nlcPrice,
      capacityTon:      p.capacityTon,
      starRating:       p.starRating,
      acType:           p.acType,
      isInverter:       p.isInverter,
      roomSizeRecommendation: p.roomSizeRecommendation,
      description:      p.description,
      descriptionSections: p.descriptionSections ?? [],
      technicalDescription: p.technicalDescription ?? null,
      shortDescription: p.shortDescription,
      images:           p.images,
      specsPerformance: p.specsPerformance,
      specsSmart:       p.specsSmart,
      specsPhysical:    p.specsPhysical,
      highlights:       p.highlights ?? [],
      whatsInBox:       p.whatsInBox ?? [],
      inStock:          p.inStock,
      installationIncluded: p.installationIncluded,
      compressorWarrantyYears: p.compressorWarrantyYears,
      productWarrantyYears:    p.productWarrantyYears,
      createdAt:        p.createdAt,
      updatedAt:        p.updatedAt,
    };
  }
}
