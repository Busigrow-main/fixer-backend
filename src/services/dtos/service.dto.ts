import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ServiceSubCategoryDto {
  @ApiPropertyOptional()
  _id?: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ example: '499' })
  price: string;

  @ApiPropertyOptional({ description: 'Price in paise' })
  priceNumeric?: number;
}

export class CreateServiceDto {
  @ApiProperty({ example: 'ac-repair' })
  slug: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ example: '₹249' })
  startingPrice: string;

  @ApiPropertyOptional({ description: 'Starting price in paise' })
  startingPriceNumeric?: number;

  @ApiProperty()
  icon: string;

  @ApiProperty()
  image: string;

  @ApiProperty()
  description: string;

  @ApiPropertyOptional({ type: [String] })
  features?: string[];

  @ApiPropertyOptional({ type: [ServiceSubCategoryDto] })
  subCategories?: ServiceSubCategoryDto[];
}
