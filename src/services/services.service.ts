import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Service, ServiceDocument } from './schemas/service.schema';

@Injectable()
export class ServicesService {
  constructor(@InjectModel(Service.name) private serviceModel: Model<ServiceDocument>) {}

  async findAll(): Promise<Service[]> {
    return this.serviceModel.find().exec();
  }

  async findBySlug(slug: string): Promise<Service> {
    const service = await this.serviceModel.findOne({ slug }).exec();
    if (!service) throw new NotFoundException('Service not found');
    return service;
  }

  async create(createServiceDto: any): Promise<Service> {
    const createdService = new this.serviceModel(createServiceDto);
    return createdService.save();
  }

  async update(id: string, updateServiceDto: any): Promise<Service> {
    const updatedService = await this.serviceModel.findByIdAndUpdate(id, updateServiceDto, { returnDocument: 'after' }).exec();
    if (!updatedService) throw new NotFoundException('Service not found');
    return updatedService;
  }

  async delete(id: string): Promise<Service> {
    const deletedService = await this.serviceModel.findByIdAndDelete(id).exec();
    if (!deletedService) throw new NotFoundException('Service not found');
    return deletedService;
  }
}
