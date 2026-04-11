import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SparePart, SparePartDocument } from './schemas/spare-part.schema';

@Injectable()
export class SparePartsService {
  constructor(@InjectModel(SparePart.name) private sparePartModel: Model<SparePartDocument>) {}

  async findAll(): Promise<SparePart[]> {
    return this.sparePartModel.find().exec();
  }

  async findBySlug(slug: string): Promise<SparePart> {
    const sparePart = await this.sparePartModel.findOne({ slug }).exec();
    if (!sparePart) throw new NotFoundException('Spare Part not found');
    return sparePart;
  }

  async create(createSparePartDto: any): Promise<SparePart> {
    const createdSparePart = new this.sparePartModel(createSparePartDto);
    return createdSparePart.save();
  }

  async update(id: string, updateSparePartDto: any): Promise<SparePart> {
    const updatedSparePart = await this.sparePartModel.findByIdAndUpdate(id, updateSparePartDto, { new: true }).exec();
    if (!updatedSparePart) throw new NotFoundException('Spare Part not found');
    return updatedSparePart;
  }

  async delete(id: string): Promise<SparePart> {
    const deletedSparePart = await this.sparePartModel.findByIdAndDelete(id).exec();
    if (!deletedSparePart) throw new NotFoundException('Spare Part not found');
    return deletedSparePart;
  }
}
