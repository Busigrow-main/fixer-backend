import {
  IsString,
  IsNumber,
  IsArray,
  IsBoolean,
  IsOptional,
  IsEnum,
  Min,
  Max,
} from 'class-validator';

export class CreateApplianceDto {
  @IsString()
  slug: string;

  @IsString()
  name: string;

  @IsString()
  brand: string;

  @IsString()
  modelNumber: string;

  @IsNumber()
  price: number;

  @IsOptional()
  @IsNumber()
  originalPrice?: number;

  @IsNumber()
  capacityTon: number;

  @IsNumber()
  @Min(1)
  @Max(5)
  starRating: number;

  @IsEnum(['split', 'window', 'cassette', 'portable'])
  acType: string;

  @IsBoolean()
  isInverter: boolean;

  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  shortDescription?: string;

  @IsArray()
  @IsString({ each: true })
  images: string[];

  @IsOptional()
  specs?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  inStock?: boolean;

  @IsOptional()
  @IsNumber()
  warrantyYears?: number;

  @IsOptional()
  @IsBoolean()
  installationIncluded?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateApplianceDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsNumber()
  originalPrice?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  shortDescription?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  specs?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  inStock?: boolean;

  @IsOptional()
  @IsNumber()
  warrantyYears?: number;

  @IsOptional()
  @IsBoolean()
  installationIncluded?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class FilterApplianceDto {
  @IsOptional()
  @IsNumber()
  capacity?: number;

  @IsOptional()
  @IsNumber()
  stars?: number;

  @IsOptional()
  @IsEnum(['split', 'window', 'cassette', 'portable', 'inverter'])
  type?: string;

  @IsOptional()
  @IsNumber()
  minPrice?: number;

  @IsOptional()
  @IsNumber()
  maxPrice?: number;

  @IsOptional()
  @IsBoolean()
  inStock?: boolean;

  @IsOptional()
  @IsEnum(['price_asc', 'price_desc', 'rating_desc', 'newest'])
  sort?: string;

  @IsOptional()
  @IsNumber()
  page?: number;

  @IsOptional()
  @IsNumber()
  perPage?: number;
}

export class ApplianceResponseDto {
  status: string;
  total: number;
  page: number;
  perPage: number;
  products: any[];
}
