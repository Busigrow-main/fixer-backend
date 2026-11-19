import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model, Types } from 'mongoose';
import { InjectConnection } from '@nestjs/mongoose';
import { Visit, VisitDocument } from './schemas/visit.schema';
import { SparePartUsage, SparePartUsageDocument } from './schemas/spare-part-usage.schema';
import { SparePartsService } from '../spare-parts/spare-parts.service';
import { Booking, BookingDocument } from '../bookings/schemas/booking.schema';
import { SparePart, SparePartDocument } from '../spare-parts/schemas/spare-part.schema';
import { WarrantiesService } from '../warranties/warranties.service';
import { buildJobSheetDefaults, partsFromVisits } from '../bookings/job-sheet-defaults';
import {
  BookingAuditContext,
  buildChangeEvent,
} from '../bookings/booking-change-history';
import {
  PartInventoryTransaction,
  PartInventoryTransactionDocument,
} from './schemas/part-inventory-transaction.schema';
import { resolveTechnicianId } from '../technician-platform/common/technician-id.util';
import { JOB_SHEET_EDITABLE_STATUSES } from '../technician-platform/constants';

@Injectable()
export class VisitsService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Visit.name) private visitModel: Model<VisitDocument>,
    @InjectModel(SparePartUsage.name) private sparePartUsageModel: Model<SparePartUsageDocument>,
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
    @InjectModel(SparePart.name) private sparePartModel: Model<SparePartDocument>,
    @InjectModel(PartInventoryTransaction.name)
    private partInventoryTransactionModel: Model<PartInventoryTransactionDocument>,
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

  async listPartInventoryTransactions(
    technicianId: string,
    pageRaw?: string | number,
    limitRaw?: string | number,
  ) {
    const page = this.parsePaginationValue(pageRaw, 1, 'page');
    const limit = this.parsePaginationValue(limitRaw, 20, 'limit');
    if (limit > 100) throw new BadRequestException('limit cannot exceed 100');

    const filter = { technicianId: new Types.ObjectId(technicianId) };
    const [transactions, total] = await Promise.all([
      this.partInventoryTransactionModel
        .find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate({ path: 'sparePartId', select: 'name sku partNumber partCategory brandSlug applianceTypeSlug price' })
        .populate({ path: 'bookingId', select: 'status serviceId createdAt' })
        .populate({ path: 'visitId', select: 'status visitOrder scheduledDate' })
        .populate({ path: 'relatedTransactionId', select: 'type quantity createdAt' })
        .lean()
        .exec(),
      this.partInventoryTransactionModel.countDocuments(filter).exec(),
    ]);

    return {
      data: transactions.map((transaction: any) => ({
        transactionId: String(transaction._id),
        type: transaction.type,
        quantity: transaction.quantity,
        sparePart: this.partTransactionReference(transaction.sparePartId, [
          'name', 'sku', 'partNumber', 'partCategory', 'brandSlug', 'applianceTypeSlug', 'price',
        ]),
        booking: this.partTransactionReference(transaction.bookingId, [
          'status', 'serviceId', 'createdAt',
        ]),
        visit: this.partTransactionReference(transaction.visitId, [
          'status', 'visitOrder', 'scheduledDate',
        ]),
        relatedIssue: transaction.type === 'RETURN'
          ? this.partTransactionReference(transaction.relatedTransactionId, ['type', 'quantity', 'createdAt'])
          : null,
        timestamp: transaction.createdAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  private parsePaginationValue(raw: string | number | undefined, fallback: number, field: string) {
    if (raw === undefined) return fallback;
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value < 1) {
      throw new BadRequestException(`${field} must be a positive integer`);
    }
    return value;
  }

  private partTransactionReference(value: any, fields: string[]) {
    if (!value) return null;
    const populated = typeof value === 'object' && value._id;
    const result: Record<string, unknown> = {
      id: String(populated ? value._id : value),
    };
    if (populated) {
      for (const field of fields) {
        if (value[field] !== undefined) result[field] = value[field];
      }
    }
    return result;
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

  async addSparePartToVisit(
    visitId: string,
    partData: any,
    audit?: BookingAuditContext,
    options: { session?: ClientSession; stockAlreadyDeducted?: boolean } = {},
  ): Promise<SparePartUsage> {
    const payload = { ...partData };
    delete payload._skipSerialAssert;

    if (payload.warrantyMonths != null) {
      const warrantyMonths = Number(payload.warrantyMonths);
      if (
        !Number.isInteger(warrantyMonths) ||
        warrantyMonths < 0 ||
        warrantyMonths > 12
      ) {
        throw new BadRequestException(
          'Spare-part warranty must be between 0 and 12 months',
        );
      }
      payload.warrantyMonths = warrantyMonths;
    }

    const visitQuery = this.visitModel.findById(visitId);
    if (options.session) visitQuery.session(options.session);
    const visit = await visitQuery.exec();
    if (!visit) throw new NotFoundException('Visit not found');

    // Always the units entered for this job. Never the catalog stock balance.
    const quantity = this.normalizeQuantity(payload.quantity);
    payload.quantity = quantity;

    let inventorySpare: SparePartDocument | null = null;
    if (!payload.isThirdParty && payload.sparePartId) {
      const spareQuery = this.sparePartModel.findById(payload.sparePartId);
      if (options.session) spareQuery.session(options.session);
      inventorySpare = await spareQuery.exec();
      if (!inventorySpare || inventorySpare.isActive === false) {
        throw new NotFoundException('Spare part not found in inventory');
      }
      if (!options.stockAlreadyDeducted) {
        const available = Math.max(0, Number(inventorySpare.stock) || 0);
        if (available < 1) {
          throw new BadRequestException('This part is out of stock');
        }
        if (quantity > available) {
          throw new BadRequestException(
            `Quantity cannot exceed available stock (${available})`,
          );
        }
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
        undefined,
        options.session,
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
        options.session,
      );
      payload.replacedUsageId = coverage.originalUsage._id;
      if (coverage.covered) {
        payload.cost = 0;
        payload.warrantyCovered = true;
        payload.platformFeeAmount = 0;
        payload.replacedWarrantyId = coverage.warranty?._id;
      }
    }

    const usage = new this.sparePartUsageModel({
      visitId,
      ...payload,
      stockDeducted: options.stockAlreadyDeducted || false,
    });
    await usage.save(options.session ? { session: options.session } : undefined);

    await this.visitModel.findByIdAndUpdate(
      visitId,
      { $push: { partsUsed: usage._id } },
      options.session ? { session: options.session } : undefined,
    );

    if (inventorySpare && visit.status === 'COMPLETED' && !options.stockAlreadyDeducted) {
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

    if (!options.session) {
      await this.syncJobSheet(String(visit.bookingId)).catch((err) => {
        console.error('Job sheet auto-fill failed', err);
      });
    }

    await this.bookingModel
      .updateOne(
        { _id: visit.bookingId },
        {
          $push: {
            changeHistory: buildChangeEvent({
              field: 'parts',
              previous: null,
              next: {
                action: 'add',
                visitId,
                usageId: String(usage._id),
                partName: usage.partName || payload.partName || null,
                quantity: usage.quantity,
                cost: usage.cost ?? null,
              },
              actorRole: audit?.actorRole || 'ADMIN',
              actorId: audit?.actorId,
              reason: audit?.reason,
            }),
          },
        },
        options.session ? { session: options.session } : undefined,
      )
      .exec();

    return usage;
  }

  /** Resolve a prior issue before the caller performs mutable stock checks. */
  async findExistingInventoryIssue(input: {
    bookingId: string;
    technicianId: string;
    visitId: string;
    sparePartId: string;
    quantity: number;
    idempotencyKey: string;
  }): Promise<SparePartUsageDocument | null> {
    return this.lookupExistingInventoryIssue(input);
  }

  private async lookupExistingInventoryIssue(
    input: {
      bookingId: string;
      technicianId: string;
      visitId: string;
      sparePartId: string;
      quantity: number;
      idempotencyKey: string;
    },
    session?: ClientSession,
  ): Promise<SparePartUsageDocument | null> {
    const key = input.idempotencyKey.trim();
    if (!key || key.length > 200) {
      throw new BadRequestException('idempotencyKey must contain 1 to 200 characters');
    }

    const previousQuery = this.partInventoryTransactionModel.findOne({
      idempotencyKey: key,
    });
    if (session) previousQuery.session(session);
    const previous = await previousQuery.exec();
    if (!previous) return null;

    // Never disclose another technician's transaction, even when a key is
    // accidentally or maliciously reused across accounts.
    if (
      String(previous.technicianId) !== input.technicianId ||
      previous.type !== 'ISSUE' ||
      String(previous.bookingId) !== input.bookingId ||
      String(previous.visitId) !== input.visitId ||
      String(previous.sparePartId) !== input.sparePartId ||
      previous.quantity !== input.quantity
    ) {
      throw new ConflictException('idempotencyKey cannot be reused for a different part issue');
    }

    const usageQuery = this.sparePartUsageModel.findById(previous.sparePartUsageId);
    if (session) usageQuery.session(session);
    const usage = await usageQuery.exec();
    if (!usage) throw new ConflictException('Part issue result is unavailable');
    return usage;
  }

  async issueInventoryPartToVisit(input: {
    bookingId: string;
    technicianId: string;
    visitId: string;
    sparePartId: string;
    quantity: number;
    idempotencyKey: string;
    usage: Record<string, unknown>;
  }): Promise<SparePartUsageDocument> {
    const { bookingId, technicianId, visitId, sparePartId, quantity } = input;
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new BadRequestException('quantity must be a positive integer');
    }

    const key = input.idempotencyKey.trim();
    if (!key || key.length > 200) {
      throw new BadRequestException('idempotencyKey must contain 1 to 200 characters');
    }

    const findPrevious = (session?: ClientSession) =>
      this.lookupExistingInventoryIssue(input, session);

    const existing = await findPrevious();
    if (existing) return existing;

    const session = await this.connection.startSession();
    let issuedUsage: SparePartUsageDocument | null = null;
    try {
      await session.withTransaction(async () => {
        const retry = await findPrevious(session);
        if (retry) {
          issuedUsage = retry as SparePartUsageDocument;
          return;
        }

        const booking = await this.bookingModel
          .findById(bookingId)
          .session(session)
          .exec();
        if (!booking) throw new NotFoundException('Job not found');
        if (resolveTechnicianId(booking.technicianId) !== technicianId) {
          throw new ForbiddenException('You do not have access to this job');
        }
        if (booking.assignmentStatus !== 'ACCEPTED') {
          throw new ForbiddenException('Job must be accepted before editing the sheet');
        }
        if (
          booking.isBilled ||
          booking.jobClosed ||
          booking.sheetLockedAt ||
          !JOB_SHEET_EDITABLE_STATUSES.includes(booking.status as any)
        ) {
          throw new ForbiddenException('Job sheet is locked or cannot be edited');
        }

        const visit = await this.visitModel
          .findById(visitId)
          .session(session)
          .exec();
        if (!visit || String(visit.bookingId) !== bookingId) {
          throw new BadRequestException('Visit does not belong to this job');
        }

        const updatedSpare = await this.sparePartModel
          .findOneAndUpdate(
            {
              _id: sparePartId,
              isActive: true,
              stock: { $gte: quantity },
            },
            { $inc: { stock: -quantity } },
            { returnDocument: 'after', session },
          )
          .exec();
        if (!updatedSpare) {
          const partExists = await this.sparePartModel
            .exists({ _id: sparePartId, isActive: true })
            .session(session);
          if (!partExists) throw new NotFoundException('Spare part not found in inventory');
          throw new BadRequestException(`Not enough stock to issue ${quantity} unit(s)`);
        }
        await this.sparePartModel
          .updateOne(
            { _id: sparePartId },
            { $set: { isInStock: Number(updatedSpare.stock) > 0 } },
            { session },
          )
          .exec();

        issuedUsage = await this.addSparePartToVisit(
          visitId,
          {
            ...input.usage,
            isThirdParty: false,
            sparePartId: new Types.ObjectId(sparePartId),
            quantity,
            sourcedBy: 'INVENTORY',
          },
          { actorRole: 'TECHNICIAN', actorId: technicianId },
          { session, stockAlreadyDeducted: true },
        ) as SparePartUsageDocument;

        await this.partInventoryTransactionModel.create(
          [
            {
              technicianId: new Types.ObjectId(technicianId),
              bookingId: new Types.ObjectId(bookingId),
              visitId: new Types.ObjectId(visitId),
              sparePartId: new Types.ObjectId(sparePartId),
              sparePartUsageId: issuedUsage._id,
              quantity,
              type: 'ISSUE',
              idempotencyKey: key,
            },
          ],
          { session },
        );
      });
    } catch (error: any) {
      if (error?.code === 11000) {
        const duplicate = await findPrevious();
        if (duplicate) return duplicate;
      }
      throw error;
    } finally {
      await session.endSession();
    }

    if (!issuedUsage) throw new ConflictException('Part issue did not complete');
    return issuedUsage;
  }

  async returnInventoryPart(input: {
    bookingId: string;
    technicianId: string;
    visitId: string;
    usageId: string;
    quantity: number;
    idempotencyKey: string;
  }): Promise<{
    transaction: PartInventoryTransactionDocument;
    usage: SparePartUsageDocument;
    replayed: boolean;
  }> {
    if (!Number.isInteger(input.quantity) || input.quantity < 1) {
      throw new BadRequestException('quantity must be a positive integer');
    }
    for (const id of [input.bookingId, input.technicianId, input.visitId, input.usageId]) {
      if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid return reference');
    }
    const key = input.idempotencyKey?.trim();
    if (!key || key.length > 200) {
      throw new BadRequestException('idempotencyKey must contain 1 to 200 characters');
    }

    const findPrevious = (session?: ClientSession) =>
      this.lookupExistingInventoryReturn({ ...input, idempotencyKey: key }, session);
    const existing = await findPrevious();
    if (existing) return { ...existing, replayed: true };

    const session = await this.connection.startSession();
    let result: {
      transaction: PartInventoryTransactionDocument;
      usage: SparePartUsageDocument;
      replayed: boolean;
    } | null = null;
    try {
      await session.withTransaction(async () => {
        const retry = await findPrevious(session);
        if (retry) {
          result = { ...retry, replayed: true };
          return;
        }

        const booking = await this.bookingModel.findById(input.bookingId).session(session).exec();
        if (!booking) throw new NotFoundException('Job not found');
        if (resolveTechnicianId(booking.technicianId) !== input.technicianId) {
          throw new ForbiddenException('You do not have access to this job');
        }
        if (
          booking.assignmentStatus !== 'ACCEPTED' ||
          booking.isBilled ||
          booking.jobClosed ||
          booking.sheetLockedAt ||
          !JOB_SHEET_EDITABLE_STATUSES.includes(booking.status as any)
        ) {
          throw new ForbiddenException('Job sheet is locked or cannot be edited');
        }

        const visit = await this.visitModel.findById(input.visitId).session(session).exec();
        if (!visit || String(visit.bookingId) !== input.bookingId) {
          throw new BadRequestException('Visit does not belong to this job');
        }

        const usage = await this.sparePartUsageModel.findById(input.usageId).session(session).exec();
        if (
          !usage ||
          String(usage.visitId) !== input.visitId ||
          usage.isThirdParty ||
          usage.sourcedBy !== 'INVENTORY' ||
          !usage.stockDeducted ||
          !usage.sparePartId
        ) {
          throw new BadRequestException('Only inventory-issued parts can be returned');
        }

        const issue = await this.partInventoryTransactionModel.findOne({
          type: 'ISSUE',
          bookingId: new Types.ObjectId(input.bookingId),
          visitId: new Types.ObjectId(input.visitId),
          sparePartUsageId: usage._id,
          sparePartId: usage.sparePartId,
          technicianId: new Types.ObjectId(input.technicianId),
        }).session(session).exec();
        if (!issue) throw new BadRequestException('Inventory issue transaction was not found');

        const priorReturns = await this.partInventoryTransactionModel
          .find({ type: 'RETURN', relatedTransactionId: issue._id })
          .select({ quantity: 1 })
          .session(session)
          .lean()
          .exec();
        const returned = priorReturns.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
        const outstanding = Number(issue.quantity) - returned;
        if (Number(usage.quantity) !== outstanding) {
          throw new ConflictException('Issued quantity and return ledger are inconsistent');
        }
        if (input.quantity > outstanding) {
          throw new BadRequestException(`Return quantity exceeds outstanding issued quantity (${Math.max(0, outstanding)})`);
        }

        const updatedUsage = await this.sparePartUsageModel.findOneAndUpdate(
          {
            _id: usage._id,
            quantity: { $gte: input.quantity },
          },
          { $inc: { quantity: -input.quantity } },
          { returnDocument: 'after', session },
        ).exec();
        if (!updatedUsage) {
          throw new BadRequestException('Return quantity exceeds outstanding issued quantity');
        }

        const stockUpdate = await this.sparePartModel.updateOne(
          { _id: usage.sparePartId },
          { $inc: { stock: input.quantity }, $set: { isInStock: true } },
          { session },
        ).exec();
        if (!stockUpdate.matchedCount) throw new NotFoundException('Spare part not found');

        const [transaction] = await this.partInventoryTransactionModel.create(
          [{
            technicianId: new Types.ObjectId(input.technicianId),
            bookingId: new Types.ObjectId(input.bookingId),
            visitId: new Types.ObjectId(input.visitId),
            sparePartId: usage.sparePartId,
            sparePartUsageId: usage._id,
            quantity: input.quantity,
            type: 'RETURN',
            relatedTransactionId: issue._id,
            idempotencyKey: key,
          }],
          { session },
        );

        await this.bookingModel.updateOne(
          { _id: booking._id },
          {
            $push: {
              changeHistory: buildChangeEvent({
                field: 'parts',
                previous: { usageId: String(usage._id), quantity: Number(usage.quantity) },
                next: { usageId: String(usage._id), quantity: Number(updatedUsage.quantity), returned: input.quantity },
                actorRole: 'TECHNICIAN',
                actorId: input.technicianId,
              }),
            },
          },
          { session },
        ).exec();

        result = { transaction, usage: updatedUsage, replayed: false };
      });
    } catch (error: any) {
      if (error?.code === 11000) {
        const duplicate = await findPrevious();
        if (duplicate) return { ...duplicate, replayed: true };
      }
      throw error;
    } finally {
      await session.endSession();
    }

    if (!result) throw new ConflictException('Part return did not complete');
    return result;
  }

  private async lookupExistingInventoryReturn(
    input: {
      bookingId: string;
      technicianId: string;
      visitId: string;
      usageId: string;
      quantity: number;
      idempotencyKey: string;
    },
    session?: ClientSession,
  ): Promise<{ transaction: PartInventoryTransactionDocument; usage: SparePartUsageDocument } | null> {
    const query = this.partInventoryTransactionModel.findOne({ idempotencyKey: input.idempotencyKey });
    if (session) query.session(session);
    const previous = await query.exec();
    if (!previous) return null;
    if (
      String(previous.technicianId) !== input.technicianId ||
      previous.type !== 'RETURN' ||
      String(previous.bookingId) !== input.bookingId ||
      String(previous.visitId) !== input.visitId ||
      String(previous.sparePartUsageId) !== input.usageId ||
      previous.quantity !== input.quantity
    ) {
      throw new ConflictException('idempotencyKey cannot be reused for a different part return');
    }
    const usageQuery = this.sparePartUsageModel.findById(input.usageId);
    if (session) usageQuery.session(session);
    const usage = await usageQuery.exec();
    if (!usage) throw new ConflictException('Part return result is unavailable');
    return { transaction: previous, usage };
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

  async removeSparePartFromVisit(
    visitId: string,
    usageId: string,
    audit?: BookingAuditContext,
  ): Promise<void> {
    const usage = await this.sparePartUsageModel.findById(usageId).exec();
    if (!usage) throw new NotFoundException('Spare part usage not found');
    if (String(usage.visitId) !== String(visitId)) {
      throw new NotFoundException('Spare part usage not found on this visit');
    }

    const inventoryIssue = await this.partInventoryTransactionModel
      .findOne({ type: 'ISSUE', sparePartUsageId: usage._id })
      .exec();
    if (inventoryIssue) {
      throw new BadRequestException('Inventory-issued parts must be returned through the return endpoint');
    }

    const visit = await this.visitModel.findById(visitId).exec();
    if (!visit) throw new NotFoundException('Visit not found');

    if (usage.stockDeducted && !usage.isThirdParty && usage.sparePartId) {
      const quantity = this.normalizeQuantity(usage.quantity);
      await this.sparePartModel.findByIdAndUpdate(usage.sparePartId, {
        $inc: { stock: quantity },
        $set: { isInStock: true },
      });
    }

    const snapshot = {
      action: 'remove',
      visitId,
      usageId,
      partName: usage.partName || null,
      quantity: usage.quantity,
      cost: usage.cost ?? null,
    };

    await this.sparePartUsageModel.findByIdAndDelete(usageId).exec();
    await this.visitModel.findByIdAndUpdate(visitId, {
      $pull: { partsUsed: new Types.ObjectId(usageId) },
    });

    await this.bookingModel
      .updateOne(
        { _id: visit.bookingId },
        {
          $push: {
            changeHistory: buildChangeEvent({
              field: 'parts',
              previous: snapshot,
              next: null,
              actorRole: audit?.actorRole || 'ADMIN',
              actorId: audit?.actorId,
              reason: audit?.reason,
            }),
          },
        },
      )
      .exec();
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
