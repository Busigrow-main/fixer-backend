import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BookingsService } from '../../bookings/bookings.service';
import { Booking, BookingDocument } from '../../bookings/schemas/booking.schema';
import { VisitsService } from '../../visits/visits.service';
import { SparePartsService } from '../../spare-parts/spare-parts.service';
import { SparePart, SparePartDocument } from '../../spare-parts/schemas/spare-part.schema';
import {
  SparePartUsage,
  SparePartUsageDocument,
} from '../../visits/schemas/spare-part-usage.schema';
import { resolveTechnicianId } from '../common/technician-id.util';
import {
  JOB_SHEET_EDITABLE_STATUSES,
  SELF_PART_PLATFORM_FEE,
} from '../constants';
import {
  collectPartsFromVisits,
  computeTechnicianSettlement,
} from '../settlement';
import { WarrantiesService } from '../../warranties/warranties.service';

export type JobSheetSaveBody = {
  productDetails?: {
    brand?: string;
    modelNumber?: string;
    serialNumber?: string;
  };
  jobDetails?: Record<string, string>;
  invoice?: {
    serviceTotal?: number;
    additionalCharges?: { label: string; amount: number }[];
  };
  expectedRevision?: number;
  images?: string[];
  remarks?: string;
};

@Injectable()
export class JobSheetService {
  constructor(
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
    @InjectModel(SparePart.name) private sparePartModel: Model<SparePartDocument>,
    @InjectModel(SparePartUsage.name)
    private sparePartUsageModel: Model<SparePartUsageDocument>,
    private bookingsService: BookingsService,
    private visitsService: VisitsService,
    private sparePartsService: SparePartsService,
    private warrantiesService: WarrantiesService,
  ) {}

  async getJobSheet(jobId: string, technicianId: string) {
    await this.assertCanAccess(jobId, technicianId);
    const repaired = await this.repairInventoryUsageCosts(jobId);
    if (repaired) {
      await this.bookingsService.generateInvoiceData(jobId);
    }
    // lean() → plain objects so nested product/job details serialize reliably
    const booking = await this.bookingModel.findById(jobId).lean().exec();
    if (!booking) throw new NotFoundException('Job not found');
    const visits = await this.visitsService.findByBooking(jobId);
    return await this.toSheetDto(booking as any, visits);
  }

  async saveJobSheet(jobId: string, technicianId: string, body: JobSheetSaveBody) {
    const booking = await this.getEditableBooking(jobId, technicianId);

    if (
      body.expectedRevision !== undefined &&
      body.expectedRevision !== (booking.jobSheetRevision || 0)
    ) {
      const visits = await this.visitsService.findByBooking(jobId);
      const lean = await this.bookingModel.findById(jobId).lean().exec();
      throw new ConflictException({
        message: 'Job sheet was updated elsewhere',
        sheet: await this.toSheetDto((lean || booking) as any, visits),
      });
    }

    const prevProduct = this.plainSubdoc(booking.productDetails);
    const prevJob = this.plainSubdoc(booking.jobDetails);
    const prevCompletion = this.plainSubdoc(booking.completionData);

    const productDetails = {
      brand: String(body.productDetails?.brand ?? prevProduct.brand ?? ''),
      modelNumber: String(
        body.productDetails?.modelNumber ?? prevProduct.modelNumber ?? '',
      ),
      serialNumber: String(
        body.productDetails?.serialNumber ?? prevProduct.serialNumber ?? '',
      ),
    };

    const jobKeys = [
      'diagnosis',
      'workDone',
      'recommendations',
      'warrantyPeriod',
      'asset',
      'warrantyCode',
      'warrantyDesc',
      'assetSaleDate',
      'assetExpiryDate',
      'contractCode',
      'contractDesc',
      'contractStartDate',
      'contractExpiryDate',
      'visitCategory',
      'invoiceNumber',
    ] as const;

    const jobDetails: Record<string, string> = {};
    for (const key of jobKeys) {
      const incoming = body.jobDetails?.[key];
      const fallback = key === 'warrantyPeriod' ? '60 Days' : '';
      jobDetails[key] = String(
        incoming !== undefined && incoming !== null
          ? incoming
          : (prevJob[key] ?? fallback),
      );
    }

    const labour =
      body.invoice?.serviceTotal !== undefined
        ? Number(body.invoice.serviceTotal) || 0
        : Number(booking.invoiceData?.serviceTotal || prevCompletion.labourCharge || 0);

    const remarks =
      body.remarks !== undefined
        ? String(body.remarks)
        : String(jobDetails.diagnosis || prevCompletion.remarks || '');

    const images =
      body.images !== undefined
        ? body.images
        : prevCompletion.images || [];

    const setPayload: Record<string, unknown> = {
      'productDetails.brand': productDetails.brand,
      'productDetails.modelNumber': productDetails.modelNumber,
      'productDetails.serialNumber': productDetails.serialNumber,
      'completionData.remarks': remarks,
      'completionData.images': images,
      jobSheetRevision: (booking.jobSheetRevision || 0) + 1,
      jobSheetUpdatedAt: new Date(),
      jobSheetUpdatedBy: 'TECHNICIAN',
    };

    for (const key of jobKeys) {
      setPayload[`jobDetails.${key}`] = jobDetails[key];
    }

    if (body.invoice?.serviceTotal !== undefined) {
      setPayload['invoiceData.serviceTotal'] = labour;
      setPayload['invoiceData.manualOverride'] = true;
    }
    if (body.invoice?.additionalCharges !== undefined) {
      setPayload['invoiceData.additionalCharges'] = body.invoice.additionalCharges;
    }

    await this.bookingModel.findByIdAndUpdate(jobId, { $set: setPayload }).exec();

    await this.bookingsService.generateInvoiceData(jobId);

    return this.getJobSheet(jobId, technicianId);
  }

  /** Convert Mongoose subdocuments / lean docs to plain JSON-safe objects. */
  private plainSubdoc(value: unknown): Record<string, any> {
    if (!value) return {};
    if (typeof value === 'object' && value !== null && typeof (value as any).toObject === 'function') {
      return (value as any).toObject();
    }
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return { ...(value as Record<string, any>) };
    }
  }

  private async assertCanAccess(jobId: string, technicianId: string) {
    const booking = await this.bookingModel.findById(jobId).exec();
    if (!booking) throw new NotFoundException('Job not found');
    if (resolveTechnicianId(booking.technicianId) !== technicianId) {
      throw new ForbiddenException('You do not have access to this job');
    }
    if (booking.assignmentStatus !== 'ACCEPTED') {
      throw new ForbiddenException('Job must be accepted before editing the sheet');
    }
    return booking;
  }

  async createOrUpdateVisit(
    jobId: string,
    technicianId: string,
    body: {
      visitId?: string;
      jobDescription?: string;
      timeIn?: string;
      timeOut?: string;
      scheduledDate?: string;
    },
  ) {
    await this.getEditableBooking(jobId, technicianId);

    const scheduledDate =
      body.scheduledDate || new Date().toISOString().slice(0, 10);
    const timeIn = this.parseVisitTime(body.timeIn, scheduledDate);
    const timeOut = this.parseVisitTime(body.timeOut, scheduledDate);

    if (body.visitId) {
      const visit = await this.visitsService.findOne(body.visitId);
      if (String(visit.bookingId) !== jobId) {
        throw new BadRequestException('Visit does not belong to this job');
      }
      const patch: Record<string, unknown> = {
        jobDescription: body.jobDescription,
      };
      if (body.scheduledDate !== undefined) patch.scheduledDate = scheduledDate;
      if (body.timeIn !== undefined) patch.timeIn = timeIn;
      if (body.timeOut !== undefined) patch.timeOut = timeOut;

      const updated = await this.visitsService.updateStatus(body.visitId, patch);
      await this.bumpSheetRevision(jobId);
      return updated;
    }

    const existing = await this.visitsService.findByBooking(jobId);
    const visit = await this.visitsService.create({
      bookingId: new Types.ObjectId(jobId),
      technicianId: new Types.ObjectId(technicianId),
      visitOrder: existing.length + 1,
      scheduledDate,
      timeIn,
      timeOut,
      jobDescription: body.jobDescription || 'Service Visit',
      status: 'IN_PROGRESS',
    });
    await this.bumpSheetRevision(jobId);
    return visit;
  }

  /**
   * Accept HH:mm / H:mm (mobile job sheet) or ISO datetimes.
   * Combines clock times with scheduledDate so Mongoose Date fields persist.
   */
  private parseVisitTime(
    value?: string | null,
    scheduledDate?: string,
  ): Date | undefined {
    if (value == null) return undefined;
    const raw = String(value).trim();
    if (!raw) return undefined;

    const hm = raw.match(/^(\d{1,2}):(\d{2})$/);
    if (hm) {
      const hours = Number(hm[1]);
      const minutes = Number(hm[2]);
      if (hours > 23 || minutes > 59) {
        throw new BadRequestException(`Invalid time "${raw}"`);
      }
      const day = (scheduledDate || new Date().toISOString().slice(0, 10)).slice(
        0,
        10,
      );
      const iso = `${day}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) {
        throw new BadRequestException(`Invalid time "${raw}"`);
      }
      return d;
    }

    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException(`Invalid time "${raw}"`);
    }
    return d;
  }

  async addPart(
    jobId: string,
    technicianId: string,
    visitId: string,
    partData: {
      isThirdParty: boolean;
      sparePartId?: string;
      quantity?: number;
      partName?: string;
      cost?: number;
      vendor?: string;
      warrantyInfo?: string;
      serialNumber?: string;
      installedAt?: string;
      warrantyMonths?: number;
      replacedUsageId?: string;
    },
  ) {
    await this.getEditableBooking(jobId, technicianId);
    const visit = await this.visitsService.findOne(visitId);
    if (String(visit.bookingId) !== jobId) {
      throw new BadRequestException('Visit does not belong to this job');
    }

    const rawQty = Number(partData.quantity);
    let quantity = Number.isFinite(rawQty) ? Math.floor(rawQty) : 1;
    if (quantity < 1) quantity = 1;

    const installedAt = partData.installedAt
      ? new Date(partData.installedAt)
      : new Date();

    if (!partData.isThirdParty) {
      if (!partData.sparePartId) {
        throw new BadRequestException('sparePartId is required for inventory parts');
      }
      const spare = await this.sparePartModel.findById(partData.sparePartId).exec();
      if (!spare || !spare.isActive) {
        throw new NotFoundException('Spare part not found in inventory');
      }
      const available = Math.max(0, Number(spare.stock) || 0);
      if (available < 1) {
        throw new BadRequestException('This part is out of stock');
      }
      if (quantity > available) {
        throw new BadRequestException(
          `Quantity cannot exceed available stock (${available})`,
        );
      }

      // Catalog price is stored in paise — invoice/cost always in INR rupees
      const pricePaise =
        typeof spare.price === 'number' ? spare.price : Number(spare.price) || 0;
      const unitPriceRupees = Math.round((pricePaise / 100) * 100) / 100;

      const warrantyMonths = this.warrantiesService.resolveInventoryWarrantyMonths(
        spare.warrantyMonths,
        partData.warrantyMonths,
      );

      let serialNumber: string | undefined;
      if (warrantyMonths > 0) {
        if (!partData.serialNumber?.trim()) {
          throw new BadRequestException(
            'Serial number is required for inventory parts under warranty',
          );
        }
        serialNumber = await this.warrantiesService.assertSerialAvailable(
          partData.serialNumber,
        );
      } else if (partData.serialNumber?.trim()) {
        serialNumber = await this.warrantiesService.assertSerialAvailable(
          partData.serialNumber,
        );
      }

      const usage = await this.visitsService.addSparePartToVisit(visitId, {
        isThirdParty: false,
        sparePartId: new Types.ObjectId(partData.sparePartId),
        quantity, // only the units used on this job — never the full stock
        partName: spare.name,
        cost: unitPriceRupees,
        sourcedBy: 'INVENTORY',
        platformFeeAmount: 0,
        platformFeeApplied: false,
        serialNumber,
        installedAt,
        warrantyMonths: warrantyMonths > 0 ? warrantyMonths : undefined,
        replacedUsageId: partData.replacedUsageId,
      });
      await this.afterPartChange(jobId);
      return usage;
    }

    if (!partData.partName?.trim()) {
      throw new BadRequestException('partName is required for self-sourced parts');
    }
    if (
      !partData.replacedUsageId &&
      (partData.cost === undefined || Number.isNaN(Number(partData.cost)))
    ) {
      throw new BadRequestException('cost is required for self-sourced parts');
    }

    const selfSerial = WarrantiesService.normalizeSerial(partData.serialNumber);
    const selfMonths =
      partData.warrantyMonths != null && Number(partData.warrantyMonths) > 0
        ? Math.floor(Number(partData.warrantyMonths))
        : undefined;

    if (selfSerial && !selfMonths) {
      throw new BadRequestException(
        'warrantyMonths is required when registering a serial for a self-sourced part',
      );
    }
    if (selfMonths && !selfSerial) {
      throw new BadRequestException(
        'serialNumber is required when registering warranty months for a self-sourced part',
      );
    }

    let serialNumber: string | undefined;
    if (selfSerial) {
      serialNumber = await this.warrantiesService.assertSerialAvailable(selfSerial);
    }

    const usage = await this.visitsService.addSparePartToVisit(visitId, {
      isThirdParty: true,
      partName: partData.partName.trim(),
      cost: Number(partData.cost) || 0,
      vendor: partData.vendor,
      warrantyInfo: partData.warrantyInfo,
      quantity,
      sourcedBy: 'SELF',
      platformFeeAmount: SELF_PART_PLATFORM_FEE,
      platformFeeApplied: false,
      serialNumber,
      installedAt: serialNumber ? installedAt : undefined,
      warrantyMonths: selfMonths,
      replacedUsageId: partData.replacedUsageId,
    });
    await this.afterPartChange(jobId);
    return usage;
  }

  async removePart(
    jobId: string,
    technicianId: string,
    visitId: string,
    usageId: string,
  ) {
    await this.getEditableBooking(jobId, technicianId);
    const visit = await this.visitsService.findOne(visitId);
    if (String(visit.bookingId) !== jobId) {
      throw new BadRequestException('Visit does not belong to this job');
    }

    const usage = await this.sparePartUsageModel.findById(usageId).exec();
    if (!usage) throw new NotFoundException('Part usage not found');
    if (usage.platformFeeApplied) {
      throw new BadRequestException('Cannot remove part after platform fee was applied');
    }

    await this.visitsService.removeSparePartFromVisit(visitId, usageId);
    await this.afterPartChange(jobId);
    return { removed: true };
  }

  async searchInventory(query: {
    q?: string;
    category?: string;
    limit?: string | number;
    page?: string | number;
  }) {
    const result = await this.sparePartsService.searchParts({
      q: query.q,
      partCategory: query.category,
      limit: query.limit || 50,
      page: query.page || 1,
    });

    const data = (result.data || [])
      .filter((p: any) => (p.stock || 0) > 0)
      .map((p: any) => {
        const pricePaise =
          typeof p.price === 'number' ? p.price : Number(p.price) || 0;
        return {
          _id: p._id,
          sku: p.sku,
          name: p.name,
          /** Unit price in INR rupees (catalog stores paise). */
          price: Math.round((pricePaise / 100) * 100) / 100,
          pricePaise,
          stock: p.stock,
          partNumber: p.partNumber,
          partCategory: p.partCategory,
          brandSlug: p.brandSlug,
          applianceTypeSlug: p.applianceTypeSlug,
          warrantyMonths: p.warrantyMonths ?? null,
        };
      });

    return { data, total: data.length };
  }

  private async afterPartChange(jobId: string) {
    await this.repairInventoryUsageCosts(jobId);
    await this.bumpSheetRevision(jobId);
    await this.bookingsService.generateInvoiceData(jobId);
  }

  /**
   * Catalog `price` is paise. Older job-sheet adds stored that value as `cost` (INR).
   * Rewrite those lines to rupees so mobile/admin/invoice stay correct.
   * @returns true if any usage was updated
   */
  private async repairInventoryUsageCosts(jobId: string): Promise<boolean> {
    let changed = false;
    const visits = await this.visitsService.findByBooking(jobId);
    for (const visit of visits as any[]) {
      for (const usage of visit.partsUsed || []) {
        if (usage.isThirdParty || usage.sourcedBy === 'SELF') continue;
        const catalog = usage.sparePartId;
        if (!catalog || typeof catalog !== 'object' || catalog.price == null) continue;
        const pricePaise = Number(catalog.price) || 0;
        const rupees = Math.round((pricePaise / 100) * 100) / 100;
        const stored = Number(usage.cost);
        // Legacy: cost equals raw paise, or wildly larger than catalog rupees
        if (stored === pricePaise || (pricePaise > 0 && stored > rupees * 50)) {
          await this.sparePartUsageModel.findByIdAndUpdate(usage._id, {
            cost: rupees,
          });
          changed = true;
        }
      }
    }
    return changed;
  }

  private async bumpSheetRevision(jobId: string) {
    await this.bookingModel.findByIdAndUpdate(jobId, {
      $inc: { jobSheetRevision: 1 },
      $set: {
        jobSheetUpdatedAt: new Date(),
        jobSheetUpdatedBy: 'TECHNICIAN',
      },
    });
  }

  private async toSheetDto(booking: BookingDocument, visits: any[]) {
    const chargeableSelf = visits.flatMap((v) =>
      (v.partsUsed || []).filter(
        (p: any) =>
          (p.isThirdParty || p.sourcedBy === 'SELF') && !p.warrantyCovered,
      ),
    );
    const parentId = booking.parentId ? String(booking.parentId) : null;
    const originalParts = parentId
      ? await this.warrantiesService.listInstalledParts(parentId)
      : [];
    const isWarrantyClaim =
      booking.serviceType === 'WARRANTY_CHECK' || !!parentId;
    return {
      jobId: booking._id,
      status: booking.status,
      assignmentStatus: booking.assignmentStatus,
      isBilled: booking.isBilled,
      jobClosed: booking.jobClosed,
      jobSheetRevision: booking.jobSheetRevision || 0,
      jobSheetUpdatedAt: booking.jobSheetUpdatedAt,
      jobSheetUpdatedBy: booking.jobSheetUpdatedBy,
      productDetails: this.plainSubdoc(booking.productDetails),
      jobDetails: this.plainSubdoc(booking.jobDetails),
      invoiceData: this.plainSubdoc(booking.invoiceData),
      completionData: this.plainSubdoc(booking.completionData),
      visits,
      serviceType: booking.serviceType,
      parentId,
      isWarrantyClaim,
      originalParts,
      selfPartFeePreview: {
        feePerLine: SELF_PART_PLATFORM_FEE,
        selfPartCount: chargeableSelf.length,
        totalFee: chargeableSelf.length * SELF_PART_PLATFORM_FEE,
      },
      technicianSettlement: computeTechnicianSettlement({
        serviceTotal: booking.invoiceData?.serviceTotal || 0,
        additionalCharges: booking.invoiceData?.additionalCharges || [],
        parts: collectPartsFromVisits(visits),
      }),
      editable:
        JOB_SHEET_EDITABLE_STATUSES.includes(booking.status as any) &&
        !booking.isBilled &&
        !booking.jobClosed &&
        booking.assignmentStatus === 'ACCEPTED',
    };
  }

  private async getEditableBooking(
    jobId: string,
    technicianId: string,
    opts: { requireEditable?: boolean } = { requireEditable: true },
  ) {
    const booking = await this.bookingModel.findById(jobId).exec();
    if (!booking) throw new NotFoundException('Job not found');
    if (resolveTechnicianId(booking.technicianId) !== technicianId) {
      throw new ForbiddenException('You do not have access to this job');
    }
    if (booking.assignmentStatus !== 'ACCEPTED') {
      throw new ForbiddenException('Job must be accepted before editing the sheet');
    }
    if (opts.requireEditable !== false) {
      if (booking.isBilled || booking.jobClosed || (booking as any).sheetLockedAt) {
        throw new ForbiddenException('Job sheet is locked');
      }
      if (!JOB_SHEET_EDITABLE_STATUSES.includes(booking.status as any)) {
        throw new BadRequestException(
          `Job sheet can only be edited while status is ${JOB_SHEET_EDITABLE_STATUSES.join(' or ')}`,
        );
      }
    }
    return booking;
  }
}
