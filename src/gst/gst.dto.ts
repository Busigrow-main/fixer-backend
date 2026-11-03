import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class GstLineDto {
  @ApiPropertyOptional({ example: 'Samsung 1 Ton Split AC' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({
    example: 49999,
    description: 'Unit price as displayed (GST-inclusive by default)',
  })
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @ApiPropertyOptional({ example: '8415' })
  @IsOptional()
  @IsString()
  hsn?: string;
}

export class GstBreakdownDto {
  @ApiProperty({ type: [GstLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GstLineDto)
  lineItems: GstLineDto[];

  @ApiPropertyOptional({ example: 18, description: 'Total GST rate %' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  taxPercent?: number;

  @ApiPropertyOptional({
    enum: ['INCLUSIVE', 'EXCLUSIVE'],
    default: 'INCLUSIVE',
    description:
      'INCLUSIVE = display price already has GST (Rule 35 reverse). EXCLUSIVE = add GST on top.',
  })
  @IsOptional()
  @IsIn(['INCLUSIVE', 'EXCLUSIVE'])
  priceMode?: 'INCLUSIVE' | 'EXCLUSIVE';

  @ApiPropertyOptional({
    enum: ['INTRA', 'INTER'],
    default: 'INTRA',
  })
  @IsOptional()
  @IsIn(['INTRA', 'INTER'])
  supplyType?: 'INTRA' | 'INTER';
}

export class GstExtractDto {
  @ApiProperty({ example: 1180, description: 'GST-inclusive amount' })
  @IsNumber()
  @Min(0)
  inclusiveAmount: number;

  @ApiProperty({ example: 18 })
  @IsNumber()
  @Min(0)
  taxPercent: number;

  @ApiPropertyOptional({ enum: ['INTRA', 'INTER'], default: 'INTRA' })
  @IsOptional()
  @IsIn(['INTRA', 'INTER'])
  supplyType?: 'INTRA' | 'INTER';
}
