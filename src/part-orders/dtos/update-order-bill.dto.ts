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

export class BillLineItemDto {
  @IsString()
  description: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;
}

export class InvoiceSoldByDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  gstin?: string;

  @IsOptional()
  @IsString()
  pan?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  website?: string;
}

export class UpdateOrderBillDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BillLineItemDto)
  lineItems: BillLineItemDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  taxPercent?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  placeOfSupply?: string;

  @IsOptional()
  @IsIn(['INTRA', 'INTER'])
  supplyType?: 'INTRA' | 'INTER';

  @IsOptional()
  @IsIn(['INCLUSIVE', 'EXCLUSIVE'])
  priceMode?: 'INCLUSIVE' | 'EXCLUSIVE';

  @IsOptional()
  @ValidateNested()
  @Type(() => InvoiceSoldByDto)
  soldBy?: InvoiceSoldByDto;
}
