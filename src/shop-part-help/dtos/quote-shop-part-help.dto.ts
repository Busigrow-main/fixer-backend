import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class QuoteShopPartHelpDto {
  @IsOptional()
  @IsMongoId()
  suggestedSparePartId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  quotedPrice?: number;

  @IsBoolean()
  isAvailable: boolean;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  adminResponse: string;
}
