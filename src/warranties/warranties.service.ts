import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Warranty, WarrantyDocument } from './schemas/warranty.schema';
import {
  SparePartUsage,
  SparePartUsageDocument,
} from '../visits/schemas/spare-part-usage.schema';
import { Visit, VisitDocument } from '../visits/schemas/visit.schema';

const DEFAULT_PART_WARRANTY_MONTHS = 6;

@Injectable()
export class WarrantiesService {
  constructor(
    @InjectModel(Warranty.name) private warrantyModel: Model<WarrantyDocument>,
    @InjectModel(SparePartUsage.name)
    private sparePartUsageModel: Model<SparePartUsageDocument>,
    @InjectModel(Visit.name) private visitModel: Model<VisitDocument>,
  ) {}

  static normalizeSerial(raw?: string | null): string | undefined {
    if (!raw) return undefined;
    const s = String(raw).trim().toUpperCase();
    return s || undefined;
  }

  async create(createData: any): Promise<Warranty> {
    const created = new this.warrantyModel(createData);
    return created.save();
  }

  async findByBooking(bookingId: string): Promise<Warranty[]> {
    return this.warrantyModel
      .find({ bookingId: new Types.ObjectId(bookingId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async findBySerial(serial: string): Promise<Warranty | null> {
    const serialNumber = WarrantiesService.normalizeSerial(serial);
    if (!serialNumber) return null;
    return this.warrantyModel
      .findOne({ serialNumber, type: 'PART' })
      .sort({ createdAt: -1 })
      .populate('bookingId')
      .exec();
  }

  async assertSerialAvailable(serialRaw: string, excludeUsageId?: string) {
    const serialNumber = WarrantiesService.normalizeSerial(serialRaw);
    if (!serialNumber) {
      throw new BadRequestException('Serial number is required');
    }

    const active = await this.warrantyModel
      .findOne({ serialNumber, type: 'PART', status: 'ACTIVE' })
      .exec();
    if (active) {
      throw new ConflictException(
        `An active part warranty already exists for serial ${serialNumber}`,
      );
    }

    const usageFilter: any = { serialNumber };
    if (excludeUsageId) {
      usageFilter._id = { $ne: new Types.ObjectId(excludeUsageId) };
    }
    const existingUsage = await this.sparePartUsageModel.findOne(usageFilter).exec();
    if (existingUsage) {
      throw new ConflictException(
        `Serial ${serialNumber} is already registered on another spare-part usage`,
      );
    }

    return serialNumber;
  }

  /**
   * Create PART warranties for usages that have serial + months.
   * Idempotent: skips usages that already have a linked PART warranty.
   */
  async registerPartsForBooking(bookingId: string): Promise<Warranty[]> {
    const visits = await this.visitModel
      .find({ bookingId: new Types.ObjectId(bookingId) })
      .populate('partsUsed')
      .exec();

    const created: Warranty[] = [];

    for (const visit of visits) {
      for (const usage of (visit.partsUsed || []) as any[]) {
        const serialNumber = WarrantiesService.normalizeSerial(usage.serialNumber);
        const months = Number(usage.warrantyMonths);
        if (!serialNumber || !Number.isFinite(months) || months <= 0) continue;

        const existing = await this.warrantyModel
          .findOne({
            sparePartUsageId: usage._id,
            type: 'PART',
          })
          .exec();
        if (existing) continue;

        const startDate = usage.installedAt
          ? new Date(usage.installedAt)
          : new Date();
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + months);

        const partName =
          usage.partName ||
          (usage.sparePartId && typeof usage.sparePartId === 'object'
            ? usage.sparePartId.name
            : undefined) ||
          'Spare Part';

        const sparePartId =
          usage.sparePartId?._id ||
          (Types.ObjectId.isValid(usage.sparePartId) ? usage.sparePartId : undefined);

        try {
          const warranty = await this.create({
            bookingId: new Types.ObjectId(bookingId),
            visitId: visit._id,
            sparePartUsageId: usage._id,
            sparePartId,
            type: 'PART',
            warrantyType:
              usage.isThirdParty || usage.sourcedBy === 'SELF'
                ? 'THIRD_PARTY'
                : 'IN_HOUSE',
            description: `Part warranty (${months} months) — ${partName} [${serialNumber}]`,
            partName,
            serialNumber,
            startDate,
            endDate,
            status: 'ACTIVE',
          });
          created.push(warranty);
        } catch (err: any) {
          // Race on unique index — treat as already registered
          if (err?.code === 11000) continue;
          throw err;
        }
      }
    }

    return created;
  }

  resolveInventoryWarrantyMonths(
    catalogMonths?: number | null,
    override?: number | null,
  ): number {
    if (override != null && Number.isFinite(Number(override)) && Number(override) > 0) {
      return Math.floor(Number(override));
    }
    if (catalogMonths != null && Number.isFinite(Number(catalogMonths))) {
      const n = Math.floor(Number(catalogMonths));
      if (n > 0) return n;
      return 0;
    }
    return DEFAULT_PART_WARRANTY_MONTHS;
  }
}
