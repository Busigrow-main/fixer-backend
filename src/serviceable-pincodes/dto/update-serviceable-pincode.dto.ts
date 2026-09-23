import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class UpdateServiceablePincodeDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}$/, {
    message: 'Pincode must be a valid 6-digit number',
  })
  pincode?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  city?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  state?: string;
}
