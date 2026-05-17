import {
  IsArray,
  IsEmail,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ContactDataDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsOptional()
  @IsString()
  preferredDate?: string;

  @IsOptional()
  @IsString()
  preferredTime?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class OrderItemDto {
  @IsMongoId()
  partId: string;

  @IsNumber()
  @Min(1)
  quantity: number;
}

export class ApplianceOrderItemDto {
  @IsOptional()
  @IsMongoId()
  applianceId?: string;

  @IsString()
  @IsNotEmpty()
  slug: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  modelNumber?: string;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsNumber()
  @Min(1)
  quantity: number;
}

export class CreatePartOrderDto {
  @IsEnum(['part', 'appliance'])
  @IsOptional()
  orderType?: 'part' | 'appliance';

  @ValidateNested()
  @Type(() => ContactDataDto)
  contactData: ContactDataDto;

  @ValidateIf((o) => (o.orderType ?? 'part') === 'part')
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items?: OrderItemDto[];

  @ValidateIf((o) => o.orderType === 'appliance')
  @ValidateNested()
  @Type(() => ApplianceOrderItemDto)
  applianceItem?: ApplianceOrderItemDto;
}
