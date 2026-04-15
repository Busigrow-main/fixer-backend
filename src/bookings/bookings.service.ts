import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Booking, BookingDocument } from './schemas/booking.schema';

@Injectable()
export class BookingsService {
  constructor(@InjectModel(Booking.name) private bookingModel: Model<BookingDocument>) {}

  async findAllByUser(userId: string): Promise<Booking[]> {
    return this.bookingModel.find({ userId }).populate('serviceId').sort({ createdAt: -1 }).exec();
  }

  async findAllForAdmin(page = 1, limit = 20, status?: string): Promise<{ data: Booking[]; total: number }> {
    const filter: any = {};
    if (status && status !== 'ALL') filter.status = status;

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.bookingModel.find(filter).populate('userId serviceId').skip(skip).limit(limit).sort({ createdAt: -1 }).exec(),
      this.bookingModel.countDocuments(filter).exec(),
    ]);
    return { data, total };
  }

  async findOne(id: string): Promise<Booking> {
    const booking = await this.bookingModel.findById(id)
      .populate('userId serviceId technicianId')
      .populate({
        path: 'visits',
        populate: {
          path: 'partsUsed',
          populate: 'sparePartId' // Assuming you want deep population of the actual spare part docs
        }
      })
      .exec();
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
    
    // Automatically generate the invoice when completed
    if (status === 'COMPLETED') {
      try {
        await this.generateInvoiceData(id);
      } catch (err) {
        console.error("Failed to generate invoice automatically", err);
      }
    }
    
    return updatedBooking;
  }

  async assignTechnician(id: string, technicianId: string): Promise<Booking> {
    const updatedBooking = await this.bookingModel.findByIdAndUpdate(
      id,
      { technicianId, status: 'ASSIGNED' },
      { new: true }
    ).exec();
    if (!updatedBooking) throw new NotFoundException('Booking not found');
    return updatedBooking;
  }

  async updateJobDetails(id: string, details: any): Promise<Booking> {
    const booking = await this.bookingModel.findByIdAndUpdate(
      id, 
      { jobDetails: details },
      { new: true }
    ).exec();
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  async finalizeInvoice(id: string): Promise<Booking> {
    // First generate the total amounts based on current visits/parts
    await this.generateInvoiceData(id);
    
    // Then lock it
    const booking = await this.bookingModel.findByIdAndUpdate(
      id,
      { isBilled: true, status: 'COMPLETED' },
      { new: true }
    ).exec();
    
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
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

  async generateInvoiceData(id: string): Promise<Booking> {
    const booking = await this.bookingModel.findById(id)
      .populate('serviceId')
      .populate({
        path: 'visits',
        populate: {
          path: 'partsUsed',
          populate: 'sparePartId'
        }
      })
      .exec();
    
    if (!booking) throw new NotFoundException('Booking not found');
    
    let partsTotal = 0;
    const serviceTotal = (booking.serviceId as any)?.price || 0; // Using price from serviceId if it exists

    if (booking.visits && booking.visits.length > 0) {
      for (const visit of booking.visits as any[]) {
        if (visit.partsUsed) {
          for (const usage of visit.partsUsed) {
            if (usage.isThirdParty) {
              partsTotal += (usage.cost || 0) * (usage.quantity || 1);
            } else if (usage.sparePartId) {
              const rawPrice = usage.sparePartId.price || "0";
              const numericPrice = parseFloat(rawPrice.replace(/[₹,\s]/g, '')) || 0;
              partsTotal += numericPrice * (usage.quantity || 1);
            }
          }
        }
      }
    }

    const totalAmount = serviceTotal + partsTotal;

    const updatedBooking = await this.bookingModel.findByIdAndUpdate(
      id,
      {
        invoiceData: {
          generatedAt: new Date(),
          partsTotal,
          serviceTotal,
          totalAmount,
          url: `/api/v1/user/bookings/${id}/invoice` // Dummy URL for now
        }
      },
      { new: true }
    ).exec();

    return updatedBooking as Booking;
  }

  async countByStatus(): Promise<Record<string, number>> {
    const results = await this.bookingModel.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]).exec();

    const counts: Record<string, number> = {};
    results.forEach((r: any) => { counts[r._id] = r.count; });
    return counts;
  }

  async countAll(): Promise<number> {
    return this.bookingModel.countDocuments().exec();
  }
}
