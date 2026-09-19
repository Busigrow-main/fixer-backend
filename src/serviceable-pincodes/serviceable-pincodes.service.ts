import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  ServiceablePincode,
  ServiceablePincodeDocument,
} from './schemas/serviceable-pincode.schema';

@Injectable()
export class ServiceablePincodesService {
  constructor(
    @InjectModel(ServiceablePincode.name)
    private readonly serviceablePincodeModel: Model<ServiceablePincodeDocument>,
  ) {}

  async isServiceable(pincode: string): Promise<boolean> {
    console.log('Database:', this.serviceablePincodeModel.db.name);
    console.log('Collection:', this.serviceablePincodeModel.collection.name);
  
    const count = await this.serviceablePincodeModel.countDocuments();
  
    console.log('Pincode collection count:', count);
    console.log('Checking pincode:', pincode);
  
    const result = await this.serviceablePincodeModel.findOne({
      pincode,
      isActive: true,
    }).lean();
  
    console.log('Matched pincode:', result);
  
    return !!result;
  }
}