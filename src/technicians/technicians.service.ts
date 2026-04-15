import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Technician, TechnicianDocument } from './schemas/technician.schema';
import { Booking, BookingDocument } from '../bookings/schemas/booking.schema';

@Injectable()
export class TechniciansService {
  constructor(
    @InjectModel(Technician.name) private technicianModel: Model<TechnicianDocument>,
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
  ) {}

  async create(createData: any): Promise<Technician> {
    const createdTechnician = new this.technicianModel(createData);
    return createdTechnician.save();
  }

  async findAll(): Promise<Technician[]> {
    return this.technicianModel.find().exec();
  }

  async findOne(id: string): Promise<Technician> {
    const technician = await this.technicianModel.findById(id).exec();
    if (!technician) throw new NotFoundException('Technician not found');
    return technician;
  }

  async getTechnicianWithJobs(id: string) {
    const technician = await this.findOne(id);
    const jobs = await this.bookingModel
      .find({ technicianId: id })
      .populate('userId', 'fullName phone')
      .populate('serviceId', 'name')
      .sort({ createdAt: -1 })
      .exec();
      
    return {
      technician,
      jobs
    };
  }

  async update(id: string, updateData: any): Promise<Technician> {
    const existingTechnician = await this.technicianModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();
    if (!existingTechnician) {
      throw new NotFoundException('Technician not found');
    }
    return existingTechnician;
  }

  async remove(id: string): Promise<any> {
    return this.technicianModel.findByIdAndDelete(id).exec();
  }
}
