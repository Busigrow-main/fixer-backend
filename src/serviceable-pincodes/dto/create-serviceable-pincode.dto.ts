import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class CreateServiceablePincodeDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}$/, {
    message: 'Pincode must be a valid 6-digit number',
  })
  pincode: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  state: string;
}