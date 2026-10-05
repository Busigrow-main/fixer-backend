import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { SHOP_PART_HELP_STATUSES } from '../schemas/shop-part-help.schema';

export class ShopPartHelpQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @IsIn(SHOP_PART_HELP_STATUSES)
  status?: (typeof SHOP_PART_HELP_STATUSES)[number];
}
