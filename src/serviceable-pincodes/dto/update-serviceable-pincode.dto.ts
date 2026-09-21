import { PartialType } from '@nestjs/mapped-types';
import { CreateServiceablePincodeDto } from './create-serviceable-pincode.dto';

export class UpdateServiceablePincodeDto extends PartialType(
  CreateServiceablePincodeDto,
) {}