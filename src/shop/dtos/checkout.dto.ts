import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ContactDataDto } from '../../part-orders/dtos/create-part-order.dto';

export class CheckoutQuoteDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}$/)
  pincode: string;
}

export class CreateCheckoutDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}$/)
  pincode: string;

  @IsEnum(['COD'])
  paymentMethod: 'COD';

  @ValidateNested()
  @Type(() => ContactDataDto)
  contactData: ContactDataDto;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  notes?: string;
}

export class InstallationOptionsQueryDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}$/)
  pincode: string;

  @IsOptional()
  @IsEnum(['part', 'appliance'])
  productType?: 'part' | 'appliance';
}
