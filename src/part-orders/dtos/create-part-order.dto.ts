import {
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { plainText } from '../../common/sanitize';

export class ContactDataDto {
  @Transform(({ value }) => plainText(value, 80))
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;

  @Transform(({ value }) => String(value || '').replace(/\D/g, '').slice(-10))
  @IsString()
  @Matches(/^\d{10}$/)
  phone: string;

  @IsOptional()
  @Transform(({ value }) => (value ? plainText(value, 120) : undefined))
  @IsEmail()
  @MaxLength(120)
  email?: string;

  @Transform(({ value }) => plainText(value, 240))
  @IsString()
  @IsNotEmpty()
  @MaxLength(240)
  address: string;

  @IsOptional()
  @Transform(({ value }) => (value ? plainText(value, 40) : undefined))
  @IsString()
  @MaxLength(40)
  preferredDate?: string;

  @IsOptional()
  @Transform(({ value }) => (value ? plainText(value, 40) : undefined))
  @IsString()
  @MaxLength(40)
  preferredTime?: string;

  @IsOptional()
  @Transform(({ value }) => (value ? plainText(value, 400) : undefined))
  @IsString()
  @MaxLength(400)
  notes?: string;
}

export class OrderItemDto {
  @IsMongoId()
  partId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(99)
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

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(99)
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
