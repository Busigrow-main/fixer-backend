import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SparePartsQueryDto {
  @ApiPropertyOptional({ description: 'Free-text search' })
  q?: string;

  @ApiPropertyOptional({ example: 'refrigerator' })
  applianceType?: string;

  @ApiPropertyOptional({ example: 'samsung' })
  brand?: string;

  @ApiPropertyOptional()
  model?: string;

  @ApiPropertyOptional({ example: 'cooling-compressor' })
  partCategory?: string;

  @ApiPropertyOptional()
  isUniversal?: string;

  @ApiPropertyOptional()
  isFeatured?: string;

  @ApiPropertyOptional({ example: 1 })
  page?: number;

  @ApiPropertyOptional({ example: 24 })
  limit?: number;

  @ApiPropertyOptional({
    enum: ['price_asc', 'price_desc', 'popular'],
  })
  sort?: string;
}

export class CreateSparePartDto {
  @ApiProperty({ example: 'SP-REF-SAM-001' })
  sku: string;

  @ApiProperty()
  slug: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ example: 'refrigerator' })
  applianceTypeSlug: string;

  @ApiProperty({ description: 'Price in paise', example: 125000 })
  price: number;

  @ApiPropertyOptional({ description: 'MRP in paise', example: 150000 })
  mrp?: number;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional({ type: [String] })
  imageUrls?: string[];

  @ApiPropertyOptional()
  brandSlug?: string;

  @ApiPropertyOptional()
  partCategory?: string;

  @ApiPropertyOptional()
  partNumber?: string;

  @ApiPropertyOptional()
  stock?: number;

  @ApiPropertyOptional()
  isInStock?: boolean;

  @ApiPropertyOptional()
  isUniversal?: boolean;

  @ApiPropertyOptional()
  isFeatured?: boolean;

  @ApiPropertyOptional()
  warrantyMonths?: number;
}
