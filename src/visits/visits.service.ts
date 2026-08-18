import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Visit, VisitDocument } from './schemas/visit.schema';
import { SparePartUsage, SparePartUsageDocument } from './schemas/spare-part-usage.schema';
import { SparePartsService } from '../spare-parts/spare-parts.service';
import { Booking, BookingDocument } from '../bookings/schemas/booking.schema';
import { SparePart, SparePartDocument } from '../spare-parts/schemas/spare-part.schema';
import { WarrantiesService } from '../warranties/warranties.service';

@Injectable()
export class VisitsService {
  constructor(
    @InjectModel(Visit.name) private visitModel: Model<VisitDocument>,
    @InjectModel(SparePartUsage.name) private sparePartUsageModel: Model<SparePartUsageDocument>,
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
    @InjectModel(SparePart.name) private sparePartModel: Model<SparePartDocument>,
    private sparePartsService: SparePartsService,
    private warrantiesService: WarrantiesService,
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
    return this.visitModel
      .find({ bookingId: new Types.ObjectId(bookingId) })
      .populate({
        path: 'partsUsed',
        populate: { path: 'sparePartId' },
      })
      .sort({ visitOrder: 1 })
      .exec();
  }

  async findOne(id: string): Promise<VisitDocument> {
    const visit = await this.visitModel
      .findById(id)
      .populate({
        path: 'partsUsed',
        populate: { path: 'sparePartId' },
      })
      .exec();
    if (!visit) throw new NotFoundException('Visit not found');
    return visit;
  }

  async updateStatus(id: string, updateData: any): Promise<Visit> {
    const existingVisit = await this.visitModel
      .findByIdAndUpdate(id, updateData, { returnDocument: 'after' })
      .populate({
        path: 'partsUsed',
        populate: { path: 'sparePartId' },
      })
      .exec();
    
    if (!existingVisit) throw new NotFoundException('Visit not found');
    
    // If completed, we should ideally trigger stock deductions here.
    if (updateData.status === 'COMPLETED') {
      const visitObj = existingVisit.toObject() as any;
      if (visitObj.partsUsed && visitObj.partsUsed.length > 0) {
        for (const usage of visitObj.partsUsed) {
          if (!usage.isThirdParty && usage.sparePartId && usage.quantity) {
            const spareId =
              usage.sparePartId._id || usage.sparePartId;
            await this.sparePartModel.findByIdAndUpdate(spareId, {
              $inc: { stock: -Math.abs(usage.quantity) }
            }).exec();
          }
        }
      }
    }
    
    return existingVisit;
  }

  async addSparePartToVisit(visitId: string, partData: any): Promise<SparePartUsage> {
    const payload = { ...partData };
    delete payload._skipSerialAssert;

    // Admin path: resolve inventory warranty months + require serial when covered
    if (!payload.isThirdParty && payload.sparePartId && payload.warrantyMonths == null) {
      const spare = await this.sparePartModel.findById(payload.sparePartId).exec();
      if (spare) {
        const months = this.warrantiesService.resolveInventoryWarrantyMonths(
          spare.warrantyMonths,
          null,
        );
        if (months > 0) {
          payload.warrantyMonths = months;
          if (!payload.serialNumber?.trim()) {
            throw new BadRequestException(
              'Serial number is required for inventory parts under warranty',
            );
          }
        }
      }
    }

    if (payload.serialNumber) {
      payload.serialNumber = await this.warrantiesService.assertSerialAvailable(
        payload.serialNumber,
      );
    } else {
      delete payload.serialNumber;
    }

    if (payload.installedAt) {
      payload.installedAt = new Date(payload.installedAt);
    } else if (payload.serialNumber || payload.warrantyMonths) {
      payload.installedAt = new Date();
    }

    if (!payload.sourcedBy) {
      payload.sourcedBy = payload.isThirdParty ? 'SELF' : 'INVENTORY';
    }

    const usage = new this.sparePartUsageModel({ visitId, ...payload });
    await usage.save();
    
    await this.visitModel.findByIdAndUpdate(visitId, {
      $push: { partsUsed: usage._id }
    });

    return usage;
  }

  async removeSparePartFromVisit(visitId: string, usageId: string): Promise<void> {
    const usage = await this.sparePartUsageModel.findById(usageId).exec();
    if (!usage) throw new NotFoundException('Spare part usage not found');
    if (String(usage.visitId) !== visitId) {
      throw new NotFoundException('Spare part usage not found on this visit');
    }

    await this.sparePartUsageModel.findByIdAndDelete(usageId).exec();
    await this.visitModel.findByIdAndUpdate(visitId, {
      $pull: { partsUsed: new Types.ObjectId(usageId) },
    });
  }
}
