import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class AddCartItemDto {
  @IsEnum(['part', 'appliance'])
  productType: 'part' | 'appliance';

  @IsMongoId()
  productId: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(99)
  quantity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  installationOptionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  pincode?: string;
}

export class UpdateCartItemDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(99)
  quantity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  installationOptionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  pincode?: string;
}

export class ApplyCouponDto {
  @IsString()
  @MaxLength(24)
  code: string;
}
