import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Visit, VisitDocument } from './schemas/visit.schema';
import { SparePartUsage, SparePartUsageDocument } from './schemas/spare-part-usage.schema';
import { SparePartsService } from '../spare-parts/spare-parts.service';
import { Booking, BookingDocument } from '../bookings/schemas/booking.schema';
import { SparePart, SparePartDocument } from '../spare-parts/schemas/spare-part.schema';
import { WarrantiesService } from '../warranties/warranties.service';
import { buildJobSheetDefaults, partsFromVisits } from '../bookings/job-sheet-defaults';

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
    const oid = Types.ObjectId.isValid(bookingId)
      ? new Types.ObjectId(bookingId)
      : null;
    return this.visitModel
      .find(
        oid
          ? { $or: [{ bookingId: oid }, { bookingId }] }
          : { bookingId },
      )
      .populate({
        path: 'partsUsed',
        populate: { path: 'sparePartId' },
      })
      .sort({ visitOrder: 1 })
      .exec();
  }

  async findByBookingIds(bookingIds: string[]): Promise<Visit[]> {
    if (!bookingIds.length) return [];
    const oids = bookingIds
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));
    const ids = [...oids, ...bookingIds.map(String)];
    if (!ids.length) return [];
    return this.visitModel
      .find({ bookingId: { $in: ids } })
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
    
    // Deduct only lines that have not already reduced stock (admin adds onto a
    // visit that is already COMPLETED deduct at insert time).
    if (updateData.status === 'COMPLETED') {
      const visitObj = existingVisit.toObject() as any;
      for (const usage of visitObj.partsUsed || []) {
        if (usage.isThirdParty || usage.sourcedBy === 'SELF') continue;
        if (!usage.sparePartId || usage.stockDeducted) continue;
        const quantity = this.normalizeQuantity(usage.quantity);
        const spareId = usage.sparePartId._id || usage.sparePartId;
        await this.deductStock(spareId, quantity);
        await this.sparePartUsageModel.findByIdAndUpdate(usage._id, {
          stockDeducted: true,
          quantity,
        });
      }
    }
    
    return existingVisit;
  }

  async addSparePartToVisit(visitId: string, partData: any): Promise<SparePartUsage> {
    const payload = { ...partData };
    delete payload._skipSerialAssert;

    const visit = await this.visitModel.findById(visitId).exec();
    if (!visit) throw new NotFoundException('Visit not found');

    // Always the units entered for this job. Never the catalog stock balance.
    const quantity = this.normalizeQuantity(payload.quantity);
    payload.quantity = quantity;

    let inventorySpare: SparePartDocument | null = null;
    if (!payload.isThirdParty && payload.sparePartId) {
      inventorySpare = await this.sparePartModel.findById(payload.sparePartId).exec();
      if (!inventorySpare || inventorySpare.isActive === false) {
        throw new NotFoundException('Spare part not found in inventory');
      }
      const available = Math.max(0, Number(inventorySpare.stock) || 0);
      if (available < 1) {
        throw new BadRequestException('This part is out of stock');
      }
      if (quantity > available) {
        throw new BadRequestException(
          `Quantity cannot exceed available stock (${available})`,
        );
      }

      const pricePaise =
        typeof inventorySpare.price === 'number'
          ? inventorySpare.price
          : Number(inventorySpare.price) || 0;
      const unitPriceRupees = Math.round(pricePaise) / 100;
      const rawCost = Number(payload.cost);
      // Catalog `price` is paise. A blank cost, or a cost copied from the raw
      // paise figure, is the unit price in rupees — not price × stock.
      if (!Number.isFinite(rawCost) || rawCost <= 0 || rawCost === pricePaise) {
        payload.cost = unitPriceRupees;
      }
      if (!payload.partName) payload.partName = inventorySpare.name;

      if (payload.warrantyMonths == null) {
        const months = this.warrantiesService.resolveInventoryWarrantyMonths(
          inventorySpare.warrantyMonths,
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

    if (payload.replacedUsageId) {
      const coverage = await this.warrantiesService.applyReplacementCoverage(
        String(payload.replacedUsageId),
      );
      payload.replacedUsageId = coverage.originalUsage._id;
      if (coverage.covered) {
        payload.cost = 0;
        payload.warrantyCovered = true;
        payload.platformFeeAmount = 0;
        payload.replacedWarrantyId = coverage.warranty?._id;
      }
    }

    const usage = new this.sparePartUsageModel({ visitId, ...payload, stockDeducted: false });
    await usage.save();
    
    await this.visitModel.findByIdAndUpdate(visitId, {
      $push: { partsUsed: usage._id }
    });

    if (inventorySpare && visit.status === 'COMPLETED') {
      try {
        await this.deductStock(inventorySpare._id, quantity);
      } catch (err) {
        await this.sparePartUsageModel.findByIdAndDelete(usage._id).exec();
        await this.visitModel.findByIdAndUpdate(visitId, {
          $pull: { partsUsed: usage._id },
        });
        throw err;
      }
      usage.stockDeducted = true;
      await usage.save();
    }

    await this.syncJobSheet(String(visit.bookingId)).catch((err) => {
      console.error('Job sheet auto-fill failed', err);
    });
    return usage;
  }

  private async syncJobSheet(bookingId: string) {
    if (!bookingId || !Types.ObjectId.isValid(bookingId)) return;
    const booking = await this.bookingModel.findById(bookingId).lean().exec();
    if (!booking) return;
    const visits = await this.findByBooking(bookingId);
    const patch = buildJobSheetDefaults({
      bookingId,
      createdAt: (booking as any).createdAt,
      serviceType: (booking as any).serviceType,
      jobDetails: (booking as any).jobDetails,
      parts: partsFromVisits(
        visits.map((visit) =>
          typeof (visit as any).toObject === 'function' ? (visit as any).toObject() : visit,
        ),
      ),
    });
    if (!Object.keys(patch).length) return;
    await this.bookingModel.findByIdAndUpdate(bookingId, {
      $set: Object.fromEntries(
        Object.entries(patch).map(([key, value]) => [`jobDetails.${key}`, value]),
      ),
    });
  }

  async removeSparePartFromVisit(visitId: string, usageId: string): Promise<void> {
    const usage = await this.sparePartUsageModel.findById(usageId).exec();
    if (!usage) throw new NotFoundException('Spare part usage not found');
    if (String(usage.visitId) !== String(visitId)) {
      throw new NotFoundException('Spare part usage not found on this visit');
    }

    if (usage.stockDeducted && !usage.isThirdParty && usage.sparePartId) {
      const quantity = this.normalizeQuantity(usage.quantity);
      await this.sparePartModel.findByIdAndUpdate(usage.sparePartId, {
        $inc: { stock: quantity },
        $set: { isInStock: true },
      });
    }

    await this.sparePartUsageModel.findByIdAndDelete(usageId).exec();
    await this.visitModel.findByIdAndUpdate(visitId, {
      $pull: { partsUsed: new Types.ObjectId(usageId) },
    });
  }

  /**
   * Catalog price is paise. A line stored at the raw paise figure is rewritten
   * to rupees so the admin bill and the customer bill use the same unit cost.
   */
  async correctCatalogCost(usage: any): Promise<number> {
    if (usage?.warrantyCovered) return 0;
    const raw = Number(usage?.cost);
    let cost = Number.isFinite(raw) ? raw : 0;
    if (usage?.isThirdParty || usage?.sourcedBy === 'SELF') return cost;

    const catalog = usage?.sparePartId;
    if (!catalog || typeof catalog !== 'object' || catalog.price == null) {
      return cost;
    }
    const pricePaise = Number(catalog.price) || 0;
    const rupees = Math.round(pricePaise) / 100;
    const storedAsPaise =
      pricePaise > 0 && (cost === pricePaise || (rupees > 0 && cost > rupees * 50));
    if (!storedAsPaise) return cost;

    cost = rupees;
    if (usage._id) {
      await this.sparePartUsageModel.findByIdAndUpdate(usage._id, { cost }).exec();
      usage.cost = cost;
    }
    return cost;
  }

  /** Positive integer quantity for this line. Missing or invalid values mean 1, never the on-hand stock. */
  private normalizeQuantity(raw: unknown): number {
    const n = Number(raw);
    if (!Number.isFinite(n)) return 1;
    const quantity = Math.floor(n);
    return quantity < 1 ? 1 : quantity;
  }

  private async deductStock(sparePartId: any, quantity: number) {
    const updated = await this.sparePartModel
      .findOneAndUpdate(
        { _id: sparePartId, stock: { $gte: quantity } },
        { $inc: { stock: -quantity } },
        { returnDocument: 'after' },
      )
      .exec();
    if (!updated) {
      throw new BadRequestException(
        `Not enough stock to use ${quantity} unit${quantity === 1 ? '' : 's'}`,
      );
    }
    if ((updated.stock || 0) <= 0) {
      await this.sparePartModel.updateOne({ _id: sparePartId }, { isInStock: false }).exec();
    }
  }
}
