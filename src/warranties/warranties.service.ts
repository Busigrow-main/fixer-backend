import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Warranty, WarrantyDocument } from './schemas/warranty.schema';

@Injectable()
export class WarrantiesService {
  constructor(
    @InjectModel(Warranty.name) private warrantyModel: Model<WarrantyDocument>,
  ) {}

  async create(createData: any): Promise<Warranty> {
    const created = new this.warrantyModel(createData);
    return created.save();
  }

  async findByBooking(bookingId: string): Promise<Warranty[]> {
    return this.warrantyModel.find({ bookingId: new Types.ObjectId(bookingId) }).exec();
  }
}
