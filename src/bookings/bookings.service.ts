import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Booking, BookingDocument } from './schemas/booking.schema';

@Injectable()
export class BookingsService {
  constructor(@InjectModel(Booking.name) private bookingModel: Model<BookingDocument>) {}

  async findAllByUser(userId: string): Promise<Booking[]> {
    return this.bookingModel.find({ userId }).populate('serviceId').exec();
  }

  async findAllForAdmin(): Promise<Booking[]> {
    return this.bookingModel.find().populate('userId serviceId').exec();
  }

  async findOne(id: string): Promise<Booking> {
    const booking = await this.bookingModel.findById(id).populate('serviceId').exec();
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  async create(createBookingDto: any, userId: string): Promise<Booking> {
    const createdBooking = new this.bookingModel({ ...createBookingDto, userId });
    return createdBooking.save();
  }

  async updateStatus(id: string, status: string): Promise<Booking> {
    const updatedBooking = await this.bookingModel.findByIdAndUpdate(id, { status }, { new: true }).exec();
    if (!updatedBooking) throw new NotFoundException('Booking not found');
    return updatedBooking;
  }

  async addAdminNote(id: string, note: string): Promise<Booking> {
    const booking = await this.bookingModel.findByIdAndUpdate(
      id,
      { $push: { adminNotes: note } },
      { new: true }
    ).exec();
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }
}
