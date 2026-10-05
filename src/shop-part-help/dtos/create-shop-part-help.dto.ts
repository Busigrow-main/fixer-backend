import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsDefined,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsMongoId,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class ShopPartHelpContactDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  phone: string;

  @Transform(trimString)
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  address: string;
}

export class CreateShopPartHelpDto {
  @IsOptional()
  @IsMongoId()
  requestedSparePartId?: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  applianceType: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  applianceBrand?: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  applianceModel?: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  partDescription: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsDefined()
  @ValidateNested()
  @Type(() => ShopPartHelpContactDto)
  contactData: ShopPartHelpContactDto;
}
