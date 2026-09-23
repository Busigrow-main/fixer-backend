import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { ServiceablePincodesService } from './serviceable-pincodes.service';

import {
  ServiceablePincode,
  ServiceablePincodeSchema,
} from './schemas/serviceable-pincode.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: ServiceablePincode.name,
        schema: ServiceablePincodeSchema,
      },
    ]),
  ],
  providers: [ServiceablePincodesService],
  exports: [ServiceablePincodesService],
})
export class ServiceablePincodesModule {}