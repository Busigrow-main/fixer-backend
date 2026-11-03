import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class WishlistItemRefDto {
  @IsEnum(['part', 'appliance'])
  productType: 'part' | 'appliance';

  @IsMongoId()
  productId: string;
}

export class AddWishlistItemDto extends WishlistItemRefDto {}

export class SyncWishlistDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => WishlistItemRefDto)
  items: WishlistItemRefDto[];
}

export class WishlistItemIdParams {
  @IsEnum(['part', 'appliance'])
  productType: 'part' | 'appliance';

  @IsMongoId()
  productId: string;
}

/** Optional client snapshot fields ignored by the server (server loads product). */
export class SoftWishlistSnapshotDto {
  @IsOptional()
  @IsString()
  @MaxLength(240)
  name?: string;
}
