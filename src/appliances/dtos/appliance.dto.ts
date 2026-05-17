import {
  IsString, IsNumber, IsArray, IsBoolean, IsOptional,
  IsEnum, Min, Max, IsObject, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class DimensionDto {
  @IsNumber() width: number;
  @IsNumber() height: number;
  @IsNumber() depth: number;
}

export class PerformanceSpecsDto {
  @IsOptional() @IsString()  coolingCapacityBtu?: string;
  @IsOptional() @IsNumber()  iseerRating?: number;
  @IsOptional() @IsNumber()  annualEnergyUnits?: number;
  @IsOptional() @IsNumber()  energyConsumptionW?: number;
  @IsOptional() @IsString()  refrigerant?: string;
  @IsOptional() @IsString()  compressorType?: string;
  @IsOptional() @IsString()  ambientTempRangeC?: string;
}

export class SmartSpecsDto {
  @IsOptional() @IsBoolean() wifiEnabled?: boolean;
  @IsOptional() @IsBoolean() autoCleanEnabled?: boolean;
  @IsOptional() @IsBoolean() pm25Filter?: boolean;
  @IsOptional() @IsBoolean() sleepMode?: boolean;
  @IsOptional() @IsBoolean() selfDiagnosis?: boolean;
  @IsOptional() @IsArray()   @IsString({ each: true }) operatingModes?: string[];
  @IsOptional() @IsNumber()  noiseLevelIndoorDb?: number;
  @IsOptional() @IsNumber()  noiseLevelOutdoorDb?: number;
}

export class PhysicalSpecsDto {
  @IsOptional() @ValidateNested() @Type(() => DimensionDto) indoorDimensions?: DimensionDto;
  @IsOptional() @ValidateNested() @Type(() => DimensionDto) outdoorDimensions?: DimensionDto;
  @IsOptional() @IsNumber() indoorWeightKg?: number;
  @IsOptional() @IsNumber() outdoorWeightKg?: number;
  @IsOptional() @IsString() colour?: string;
  @IsOptional() @IsString() voltageRequirement?: string;
  @IsOptional() @IsNumber() pipeLengthM?: number;
}

export class HighlightDto {
  @IsString() icon: string;
  @IsString() title: string;
  @IsString() description: string;
}

export const DESCRIPTION_SECTION_TYPES = [
  'hero',
  'image_text',
  'feature_grid',
  'banner',
  'html',
  'image_full',
] as const;

export type DescriptionSectionTypeDto = (typeof DESCRIPTION_SECTION_TYPES)[number];

export class DescriptionFeatureDto {
  @IsString() icon: string;
  @IsString() title: string;
  @IsString() description: string;
}

export class DescriptionSectionDto {
  @IsEnum(DESCRIPTION_SECTION_TYPES)
  type: DescriptionSectionTypeDto;

  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() subtitle?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsString() imageAlt?: string;
  @IsOptional() @IsString() html?: string;
  @IsOptional() @IsNumber() order?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DescriptionFeatureDto)
  features?: DescriptionFeatureDto[];
}

export class TechnicalSpecDto {
  @IsString() label: string;
  @IsString() value: string;
}

export class TechnicalSectionDto {
  @IsString() title: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TechnicalSpecDto)
  specs: TechnicalSpecDto[];
}

export class TechnicalDescriptionDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TechnicalSectionDto)
  sections: TechnicalSectionDto[];
}

// ── Create ──────────────────────────────────────────────────────
export class CreateApplianceDto {
  @IsString()  slug: string;
  @IsString()  name: string;
  @IsString()  brand: string;
  @IsString()  modelNumber: string;
  @IsString()  sku: string;
  @IsOptional() @IsString() series?: string;
  @IsOptional() @IsString() descriptionCode?: string;

  @IsNumber()  price: number;
  @IsOptional() @IsNumber() originalPrice?: number;
  @IsNumber()  nlcPrice: number;

  @IsNumber()  capacityTon: number;
  @IsNumber()  @Min(1) @Max(5) starRating: number;
  @IsEnum(['split', 'window', 'cassette', 'portable']) acType: string;
  @IsBoolean() isInverter: boolean;
  @IsOptional() @IsString() roomSizeRecommendation?: string;

  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() shortDescription?: string;
  @IsArray()   @IsString({ each: true }) images: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DescriptionSectionDto)
  descriptionSections?: DescriptionSectionDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => TechnicalDescriptionDto)
  technicalDescription?: TechnicalDescriptionDto;

  @IsOptional() @IsObject() specsPerformance?: PerformanceSpecsDto;
  @IsOptional() @IsObject() specsSmart?: SmartSpecsDto;
  @IsOptional() @IsObject() specsPhysical?: PhysicalSpecsDto;

  @IsOptional() @IsArray() highlights?: HighlightDto[];
  @IsOptional() @IsArray() @IsString({ each: true }) whatsInBox?: string[];

  @IsOptional() @IsBoolean() inStock?: boolean;
  @IsOptional() @IsBoolean() installationIncluded?: boolean;
  @IsOptional() @IsNumber()  compressorWarrantyYears?: number;
  @IsOptional() @IsNumber()  productWarrantyYears?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

// ── Update ──────────────────────────────────────────────────────
export class UpdateApplianceDto {
  @IsOptional() @IsString()  name?: string;
  @IsOptional() @IsNumber()  price?: number;
  @IsOptional() @IsNumber()  originalPrice?: number;
  @IsOptional() @IsString()  description?: string;
  @IsOptional() @IsString()  shortDescription?: string;
  @IsOptional() @IsArray()   @IsString({ each: true }) images?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DescriptionSectionDto)
  descriptionSections?: DescriptionSectionDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => TechnicalDescriptionDto)
  technicalDescription?: TechnicalDescriptionDto;
  @IsOptional() @IsObject()  specsPerformance?: PerformanceSpecsDto;
  @IsOptional() @IsObject()  specsSmart?: SmartSpecsDto;
  @IsOptional() @IsObject()  specsPhysical?: PhysicalSpecsDto;
  @IsOptional() @IsArray()   highlights?: HighlightDto[];
  @IsOptional() @IsArray()   @IsString({ each: true }) whatsInBox?: string[];
  @IsOptional() @IsBoolean() inStock?: boolean;
  @IsOptional() @IsNumber()  compressorWarrantyYears?: number;
  @IsOptional() @IsNumber()  productWarrantyYears?: number;
  @IsOptional() @IsBoolean() installationIncluded?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

// ── Filter ──────────────────────────────────────────────────────
export class FilterApplianceDto {
  @IsOptional() @IsNumber()  capacity?: number;
  @IsOptional() @IsNumber()  stars?: number;
  @IsOptional() @IsString()  brand?: string;
  @IsOptional() @IsString()  series?: string;
  @IsOptional() @IsEnum(['split', 'window', 'cassette', 'portable', 'inverter', 'fixed-speed']) type?: string;
  @IsOptional() @IsNumber()  minPrice?: number;
  @IsOptional() @IsNumber()  maxPrice?: number;
  @IsOptional() @IsBoolean() inStock?: boolean;
  @IsOptional() @IsEnum(['price_asc', 'price_desc', 'rating_desc', 'newest']) sort?: string;
  @IsOptional() @IsNumber()  page?: number;
  @IsOptional() @IsNumber()  perPage?: number;
}

// ── Response ────────────────────────────────────────────────────
export class ApplianceResponseDto {
  status: string;
  total: number;
  page: number;
  perPage: number;
  products: any[];
}
