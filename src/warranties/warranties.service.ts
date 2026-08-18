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
import { Booking, BookingDocument } from '../bookings/schemas/booking.schema';

const DEFAULT_PART_WARRANTY_MONTHS = 6;

@Injectable()
export class WarrantiesService {
  constructor(
    @InjectModel(Warranty.name) private warrantyModel: Model<WarrantyDocument>,
    @InjectModel(SparePartUsage.name)
    private sparePartUsageModel: Model<SparePartUsageDocument>,
    @InjectModel(Visit.name) private visitModel: Model<VisitDocument>,
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
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

  async listInstalledParts(bookingId: string): Promise<Array<{
    usageId: string;
    visitId?: string;
    partName: string;
    serialNumber?: string;
    sparePartId?: string;
    quantity: number;
    cost?: number;
    installedAt?: Date;
    warrantyMonths?: number;
    warrantyEnd?: Date;
    warrantyStatus: 'ACTIVE' | 'EXPIRED' | 'CLAIMED' | 'NONE';
    covered: boolean;
    warrantyCovered?: boolean;
    sourcedBy?: string;
    isThirdParty?: boolean;
  }>> {
    const oid = Types.ObjectId.isValid(bookingId)
      ? new Types.ObjectId(bookingId)
      : null;
    const visits = await this.visitModel
      .find(
        oid
          ? { $or: [{ bookingId: oid }, { bookingId }] }
          : { bookingId },
      )
      .populate({ path: 'partsUsed', populate: { path: 'sparePartId' } })
      .sort({ visitOrder: 1 })
      .exec();

    const usageIds = visits.flatMap((v) =>
      (v.partsUsed || [])
        .map((u: any) => u?._id || u)
        .filter(Boolean),
    );
    const warranties = usageIds.length
      ? await this.warrantyModel
          .find({ sparePartUsageId: { $in: usageIds }, type: 'PART' })
          .exec()
      : [];
    const warrantyByUsage = new Map(
      warranties.map((w) => [String(w.sparePartUsageId), w]),
    );
    const now = new Date();
    const out: any[] = [];

    for (const visit of visits) {
      for (const usage of (visit.partsUsed || []) as any[]) {
        const warranty = warrantyByUsage.get(String(usage._id));
        let warrantyStatus: 'ACTIVE' | 'EXPIRED' | 'CLAIMED' | 'NONE' = 'NONE';
        let covered = false;
        if (warranty) {
          warrantyStatus = warranty.status as any;
          if (
            warranty.status === 'ACTIVE' &&
            warranty.endDate &&
            new Date(warranty.endDate) >= now
          ) {
            covered = true;
          } else if (warranty.status === 'ACTIVE' && warranty.endDate && new Date(warranty.endDate) < now) {
            warrantyStatus = 'EXPIRED';
          }
        } else if (usage.warrantyMonths && usage.installedAt) {
          const end = new Date(usage.installedAt);
          end.setMonth(end.getMonth() + Number(usage.warrantyMonths));
          if (end >= now) {
            warrantyStatus = 'ACTIVE';
            covered = true;
          } else {
            warrantyStatus = 'EXPIRED';
          }
        }

        const spareId =
          usage.sparePartId?._id ||
          (usage.sparePartId && Types.ObjectId.isValid(usage.sparePartId)
            ? usage.sparePartId
            : undefined);

        out.push({
          usageId: String(usage._id),
          visitId: String(visit._id),
          partName:
            usage.partName ||
            usage.sparePartId?.name ||
            'Spare part',
          serialNumber: usage.serialNumber || undefined,
          sparePartId: spareId ? String(spareId) : undefined,
          quantity: usage.quantity || 1,
          cost: usage.cost,
          installedAt: usage.installedAt,
          warrantyMonths: usage.warrantyMonths,
          warrantyEnd: warranty?.endDate,
          warrantyStatus,
          covered,
          warrantyCovered: !!usage.warrantyCovered,
          sourcedBy: usage.sourcedBy,
          isThirdParty: !!usage.isThirdParty,
        });
      }
    }
    return out;
  }

  /**
   * Walk parentId chain (nested warranty claims) and return every previously
   * installed part, root job first. Falls back to the ancestor invoice lines
   * when visit records are missing.
   */
  async listOriginalPartsForClaim(parentId?: string | null) {
    if (!parentId || !Types.ObjectId.isValid(parentId)) return [];
    const layers: Array<Awaited<ReturnType<WarrantiesService['listInstalledParts']>>> = [];
    const seen = new Set<string>();
    let currentId: string | null = parentId;

    while (currentId && !seen.has(currentId) && Types.ObjectId.isValid(currentId)) {
      seen.add(currentId);
      const installed = await this.listInstalledParts(currentId);
      const ancestor = await this.bookingModel
        .findById(currentId)
        .select('invoiceData parentId')
        .lean()
        .exec();
      if (installed.length) {
        layers.push(installed);
      } else {
        const invoiceParts = ((ancestor as any)?.invoiceData?.spareParts || []) as Array<{
          partName?: string;
          quantity?: number;
          cost?: number;
          isThirdParty?: boolean;
          serialNumber?: string;
          warrantyCovered?: boolean;
        }>;
        if (invoiceParts.length) {
          layers.push(
            invoiceParts.map((p, idx) => ({
              usageId: `invoice:${currentId}:${idx}`,
              partName: p.partName || 'Spare part',
              serialNumber: p.serialNumber || undefined,
              quantity: p.quantity || 1,
              cost: p.cost,
              warrantyStatus: 'NONE' as const,
              covered: false,
              warrantyCovered: !!p.warrantyCovered,
              isThirdParty: !!p.isThirdParty,
            })),
          );
        }
      }
      currentId = (ancestor as any)?.parentId ? String((ancestor as any).parentId) : null;
    }

    return layers.reverse().flat();
  }

  /**
   * If this original part still has an active warranty, mark it claimed
   * so the replacement is issued at no charge.
   */
  async applyReplacementCoverage(replacedUsageId: string) {
    if (!Types.ObjectId.isValid(replacedUsageId)) {
      throw new BadRequestException('replacedUsageId is invalid');
    }
    const originalUsage = await this.sparePartUsageModel
      .findById(replacedUsageId)
      .exec();
    if (!originalUsage) {
      throw new BadRequestException('Original spare part usage not found');
    }

    const now = new Date();
    const warranty = await this.warrantyModel
      .findOne({
        sparePartUsageId: originalUsage._id,
        type: 'PART',
      })
      .sort({ createdAt: -1 })
      .exec();

    let covered = false;
    if (
      warranty &&
      warranty.status === 'ACTIVE' &&
      warranty.endDate &&
      new Date(warranty.endDate) >= now
    ) {
      covered = true;
      warranty.status = 'CLAIMED';
      await warranty.save();
    } else if (!warranty && originalUsage.warrantyMonths && originalUsage.installedAt) {
      const end = new Date(originalUsage.installedAt);
      end.setMonth(end.getMonth() + Number(originalUsage.warrantyMonths));
      covered = end >= now;
    }

    return { covered, originalUsage, warranty: warranty || undefined };
  }
}
