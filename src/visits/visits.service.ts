import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Visit, VisitDocument } from './schemas/visit.schema';
import { SparePartUsage, SparePartUsageDocument } from './schemas/spare-part-usage.schema';
import { SparePartsService } from '../spare-parts/spare-parts.service';
import { Booking, BookingDocument } from '../bookings/schemas/booking.schema';
import { SparePart, SparePartDocument } from '../spare-parts/schemas/spare-part.schema';

@Injectable()
export class VisitsService {
  constructor(
    @InjectModel(Visit.name) private visitModel: Model<VisitDocument>,
    @InjectModel(SparePartUsage.name) private sparePartUsageModel: Model<SparePartUsageDocument>,
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
    @InjectModel(SparePart.name) private sparePartModel: Model<SparePartDocument>,
    private sparePartsService: SparePartsService
  ) {}

  async create(createData: any): Promise<Visit> {
    const createdVisit = new this.visitModel(createData);
    const savedVisit = await createdVisit.save();
    
    // Link to booking
    await this.bookingModel.findByIdAndUpdate(createData.bookingId, {
      $push: { visits: savedVisit._id }
    }).exec();

    return savedVisit;
  }

  async findByBooking(bookingId: string): Promise<Visit[]> {
    return this.visitModel.find({ bookingId: new Types.ObjectId(bookingId) }).populate('partsUsed').exec();
  }

  async updateStatus(id: string, updateData: any): Promise<Visit> {
    const existingVisit = await this.visitModel
      .findByIdAndUpdate(id, updateData, { returnDocument: 'after' })
      .populate('partsUsed')
      .exec();
    
    if (!existingVisit) throw new NotFoundException('Visit not found');
    
    // If completed, we should ideally trigger stock deductions here.
    if (updateData.status === 'COMPLETED') {
      const visitObj = existingVisit.toObject() as any;
      if (visitObj.partsUsed && visitObj.partsUsed.length > 0) {
        for (const usage of visitObj.partsUsed) {
          if (!usage.isThirdParty && usage.sparePartId && usage.quantity) {
            await this.sparePartModel.findByIdAndUpdate(usage.sparePartId, {
              $inc: { stock: -Math.abs(usage.quantity) }
            }).exec();
          }
        }
      }
    }
    
    return existingVisit;
  }

  async addSparePartToVisit(visitId: string, partData: any): Promise<SparePartUsage> {
    const usage = new this.sparePartUsageModel({ visitId, ...partData });
    await usage.save();
    
    await this.visitModel.findByIdAndUpdate(visitId, {
      $push: { partsUsed: usage._id }
    });

    return usage;
  }
}
