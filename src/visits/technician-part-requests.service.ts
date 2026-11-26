import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model, Types } from 'mongoose';
import { Booking, BookingDocument } from '../bookings/schemas/booking.schema';
import { Visit, VisitDocument } from './schemas/visit.schema';
import { SparePart, SparePartDocument } from '../spare-parts/schemas/spare-part.schema';
import {
  SparePartUsage,
  SparePartUsageDocument,
} from './schemas/spare-part-usage.schema';
import {
  PartInventoryTransaction,
  PartInventoryTransactionDocument,
} from './schemas/part-inventory-transaction.schema';
import {
  TechnicianPartRequest,
  TechnicianPartRequestDocument,
  TechnicianPartRequestStatus,
} from './schemas/technician-part-request.schema';
import {
  CreateTechnicianPartRequestDto,
  TechnicianPartRequestOperationDto,
} from './dtos/technician-part-request.dto';
import { resolveTechnicianId } from '../technician-platform/common/technician-id.util';
import { JOB_SHEET_EDITABLE_STATUSES } from '../technician-platform/constants';
import { VisitsService } from './visits.service';

type ReturnCondition = 'UNUSED' | 'DEFECTIVE';

@Injectable()
export class TechnicianPartRequestsService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(TechnicianPartRequest.name)
    private readonly requestModel: Model<TechnicianPartRequestDocument>,
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<BookingDocument>,
    @InjectModel(Visit.name)
    private readonly visitModel: Model<VisitDocument>,
    @InjectModel(SparePart.name)
    private readonly sparePartModel: Model<SparePartDocument>,
    @InjectModel(SparePartUsage.name)
    private readonly usageModel: Model<SparePartUsageDocument>,
    @InjectModel(PartInventoryTransaction.name)
    private readonly transactionModel: Model<PartInventoryTransactionDocument>,
    private readonly visitsService: VisitsService,
  ) {}

  async create(technicianId: string, bookingId: string, body: CreateTechnicianPartRequestDto) {
    this.assertObjectIds([technicianId, bookingId, body.visitId, body.sparePartId]);
    this.assertQuantity(body.quantity);
    const key = this.idempotencyKey(body.idempotencyKey);
    const previous = await this.requestModel.findOne({ idempotencyKey: key }).exec();
    if (previous) {
      this.assertSameRequest(previous, technicianId, bookingId, body);
      return previous;
    }

    await this.assertTechnicianJob(technicianId, bookingId, body.visitId);
    const part = await this.sparePartModel.findById(body.sparePartId).exec();
    if (!part || part.isActive === false) throw new NotFoundException('Spare part not found in inventory');

    try {
      return await this.requestModel.create({
        technicianId: new Types.ObjectId(technicianId),
        bookingId: new Types.ObjectId(bookingId),
        visitId: new Types.ObjectId(body.visitId),
        sparePartId: new Types.ObjectId(body.sparePartId),
        requestedQuantity: body.quantity,
        idempotencyKey: key,
        status: 'PENDING',
        events: [{
          action: 'REQUESTED',
          quantity: body.quantity,
          actorRole: 'TECHNICIAN',
          actorId: new Types.ObjectId(technicianId),
          idempotencyKey: key,
          occurredAt: new Date(),
        }],
      });
    } catch (error: any) {
      if (error?.code !== 11000) throw error;
      const duplicate = await this.requestModel.findOne({ idempotencyKey: key }).exec();
      if (!duplicate) throw error;
      this.assertSameRequest(duplicate, technicianId, bookingId, body);
      return duplicate;
    }
  }

  async listForTechnician(technicianId: string, bookingId: string, pageRaw = 1, limitRaw = 20) {
    this.assertObjectIds([technicianId, bookingId]);
    await this.assertTechnicianJob(technicianId, bookingId);
    const { page, limit } = this.pagination(pageRaw, limitRaw);
    const filter = {
      technicianId: new Types.ObjectId(technicianId),
      bookingId: new Types.ObjectId(bookingId),
    };
    const [data, total] = await Promise.all([
      this.requestModel.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate({ path: 'sparePartId', select: 'name sku partNumber partCategory price stock warrantyMonths' })
        .populate({ path: 'visitId', select: 'visitOrder status scheduledDate' })
        .lean()
        .exec(),
      this.requestModel.countDocuments(filter).exec(),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async listForAdmin(status?: string, pageRaw = 1, limitRaw = 20) {
    const { page, limit } = this.pagination(pageRaw, limitRaw);
    if (status && !['PENDING', 'APPROVED', 'PARTIALLY_ISSUED', 'ISSUED', 'FULFILLED', 'DENIED', 'CANCELLED'].includes(status)) {
      throw new BadRequestException('Invalid part request status');
    }
    const filter = status ? { status } : {};
    const [data, total] = await Promise.all([
      this.requestModel.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate({ path: 'sparePartId', select: 'name sku partNumber partCategory price stock reservedStock quarantinedStock' })
        .populate({ path: 'bookingId', select: 'status serviceType createdAt contactPhone productDetails technicianId' })
        .populate({ path: 'visitId', select: 'visitOrder status scheduledDate' })
        .lean()
        .exec(),
      this.requestModel.countDocuments(filter).exec(),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async approve(requestId: string, adminId: string) {
    this.assertObjectIds([requestId, adminId]);
    const request = await this.requestModel.findById(requestId).exec();
    if (!request) throw new NotFoundException('Part request not found');
    if (request.status === 'APPROVED' || request.status === 'PARTIALLY_ISSUED' || request.status === 'ISSUED' || request.status === 'FULFILLED') return request;
    if (request.status !== 'PENDING') throw new ConflictException('Only pending part requests can be approved');

    const session = await this.connection.startSession();
    let result: TechnicianPartRequestDocument | null = null;
    try {
      await session.withTransaction(async () => {
        const current = await this.requestModel.findById(requestId).session(session).exec();
        if (!current) throw new NotFoundException('Part request not found');
        if (current.status !== 'PENDING') throw new ConflictException('Part request is no longer pending');
        const reservedPart = await this.sparePartModel.findOneAndUpdate(
          { _id: current.sparePartId, isActive: true, stock: { $gte: current.requestedQuantity } },
          {
            $inc: {
              stock: -current.requestedQuantity,
              reservedStock: current.requestedQuantity,
            },
          },
          { new: true, session },
        ).exec();
        if (!reservedPart) {
          const exists = await this.sparePartModel.exists({ _id: current.sparePartId, isActive: true }).session(session);
          if (!exists) throw new NotFoundException('Spare part not found in inventory');
          throw new ConflictException('Not enough saleable stock to approve this request');
        }
        await this.sparePartModel.updateOne(
          { _id: reservedPart._id },
          { $set: { isInStock: Number(reservedPart.stock) > 0 } },
          { session },
        ).exec();
        const now = new Date();
        const updated = await this.requestModel.findOneAndUpdate(
          { _id: requestId, status: 'PENDING' },
          {
            $set: {
              status: 'APPROVED',
              approvedQuantity: current.requestedQuantity,
              reviewedBy: new Types.ObjectId(adminId),
              reviewedAt: now,
            },
            $push: { events: {
              action: 'APPROVED_AND_RESERVED',
              quantity: current.requestedQuantity,
              actorRole: 'ADMIN',
              actorId: new Types.ObjectId(adminId),
              occurredAt: now,
            } },
          },
          { new: true, session },
        ).exec();
        if (!updated) throw new ConflictException('Part request changed while approving');
        await this.transactionModel.create([{
          technicianId: current.technicianId,
          bookingId: current.bookingId,
          visitId: current.visitId,
          sparePartId: current.sparePartId,
          partRequestId: current._id,
          quantity: current.requestedQuantity,
          type: 'RESERVE',
          actorRole: 'ADMIN',
          actorId: new Types.ObjectId(adminId),
          reason: 'Approved technician request and reserved saleable stock',
          idempotencyKey: `part-request:${String(current._id)}:reserve`,
        }], { session });
        result = updated;
      });
    } finally {
      await session.endSession();
    }
    if (!result) throw new ConflictException('Unable to approve part request');
    return result;
  }

  async deny(requestId: string, adminId: string, reason: string) {
    const note = this.requiredReason(reason);
    this.assertObjectIds([requestId, adminId]);
    const request = await this.requestModel.findById(requestId).exec();
    if (!request) throw new NotFoundException('Part request not found');
    if (request.status === 'DENIED') return request;
    if (request.status !== 'PENDING') throw new ConflictException('Only pending part requests can be denied');
    const now = new Date();
    const updated = await this.requestModel.findOneAndUpdate(
      { _id: requestId, status: 'PENDING' },
      {
        $set: { status: 'DENIED', reviewedBy: new Types.ObjectId(adminId), reviewedAt: now },
        $push: { events: {
          action: 'DENIED', actorRole: 'ADMIN', actorId: new Types.ObjectId(adminId),
          reason: note, occurredAt: now,
        } },
      },
      { new: true },
    ).exec();
    if (!updated) throw new ConflictException('Part request changed while denying');
    return updated;
  }

  async cancel(requestId: string, adminId: string, reason: string) {
    const note = this.requiredReason(reason);
    this.assertObjectIds([requestId, adminId]);
    const session = await this.connection.startSession();
    let result: TechnicianPartRequestDocument | null = null;
    try {
      await session.withTransaction(async () => {
        const request = await this.requestModel.findById(requestId).session(session).exec();
        if (!request) throw new NotFoundException('Part request not found');
        if (request.status === 'CANCELLED') { result = request; return; }
        if (!['APPROVED', 'PARTIALLY_ISSUED', 'ISSUED'].includes(request.status)) {
          throw new ConflictException('Only approved part requests can be cancelled');
        }
        const outstanding = request.issuedQuantity - request.consumedQuantity - request.unusedReturnedQuantity - request.defectiveReturnedQuantity;
        if (outstanding > 0) throw new ConflictException('Return or consume issued parts before cancelling the remaining reservation');
        const unissued = request.approvedQuantity - request.issuedQuantity;
        if (unissued > 0) {
          const restored = await this.sparePartModel.updateOne(
            { _id: request.sparePartId, reservedStock: { $gte: unissued } },
            { $inc: { reservedStock: -unissued, stock: unissued }, $set: { isInStock: true } },
            { session },
          ).exec();
          if (restored.modifiedCount !== 1) throw new ConflictException('Reserved inventory no longer matches this request');
          await this.transactionModel.create([{
            technicianId: request.technicianId,
            bookingId: request.bookingId,
            visitId: request.visitId,
            sparePartId: request.sparePartId,
            partRequestId: request._id,
            quantity: unissued,
            type: 'RELEASE',
            actorRole: 'ADMIN',
            actorId: new Types.ObjectId(adminId),
            reason: note,
            idempotencyKey: `part-request:${String(request._id)}:release`,
          }], { session });
        }
        const now = new Date();
        result = await this.requestModel.findOneAndUpdate(
          { _id: requestId, status: { $in: ['APPROVED', 'PARTIALLY_ISSUED', 'ISSUED'] } },
          {
            $set: { status: 'CANCELLED' },
            $push: { events: {
              action: 'CANCELLED', quantity: unissued, actorRole: 'ADMIN',
              actorId: new Types.ObjectId(adminId), reason: note, occurredAt: now,
            } },
          },
          { new: true, session },
        ).exec();
        if (!result) throw new ConflictException('Part request changed while cancelling');
      });
    } finally {
      await session.endSession();
    }
    if (!result) throw new ConflictException('Unable to cancel part request');
    return result;
  }

  async issue(technicianId: string, bookingId: string, requestId: string, body: TechnicianPartRequestOperationDto) {
    return this.runTechnicianOperation(technicianId, bookingId, requestId, body, 'ISSUE');
  }

  async consume(technicianId: string, bookingId: string, requestId: string, body: TechnicianPartRequestOperationDto) {
    return this.runTechnicianOperation(technicianId, bookingId, requestId, body, 'CONSUME');
  }

  async returnPart(
    technicianId: string,
    bookingId: string,
    requestId: string,
    body: TechnicianPartRequestOperationDto & { condition: ReturnCondition; reason?: string },
  ) {
    if (!['UNUSED', 'DEFECTIVE'].includes(body.condition)) throw new BadRequestException('condition must be UNUSED or DEFECTIVE');
    return this.runTechnicianOperation(technicianId, bookingId, requestId, body, 'RETURN', body.condition);
  }

  private async runTechnicianOperation(
    technicianId: string,
    bookingId: string,
    requestId: string,
    body: TechnicianPartRequestOperationDto & { condition?: ReturnCondition; reason?: string },
    operation: 'ISSUE' | 'CONSUME' | 'RETURN',
    condition?: ReturnCondition,
  ) {
    this.assertObjectIds([technicianId, bookingId, requestId]);
    this.assertQuantity(body.quantity);
    const key = this.idempotencyKey(body.idempotencyKey);
    const previous = await this.findOperation(key, operation, technicianId, bookingId, requestId, body.quantity, condition);
    if (previous) {
      const request = await this.requestModel.findById(requestId).exec();
      return { request, transaction: previous, replayed: true };
    }

    const session = await this.connection.startSession();
    let result: { request: TechnicianPartRequestDocument; transaction: PartInventoryTransactionDocument; replayed: boolean } | null = null;
    try {
      await session.withTransaction(async () => {
        const retry = await this.findOperation(key, operation, technicianId, bookingId, requestId, body.quantity, condition, session);
        if (retry) {
          const current = await this.requestModel.findById(requestId).session(session).exec();
          if (!current) throw new NotFoundException('Part request not found');
          result = { request: current, transaction: retry, replayed: true };
          return;
        }
        const request = await this.requestModel.findById(requestId).session(session).exec();
        if (!request || String(request.bookingId) !== bookingId || String(request.technicianId) !== technicianId) {
          throw new NotFoundException('Part request not found');
        }
        await this.assertTechnicianJob(technicianId, bookingId, String(request.visitId), session);

        const values = {
          issuedQuantity: request.issuedQuantity,
          consumedQuantity: request.consumedQuantity,
          unusedReturnedQuantity: request.unusedReturnedQuantity,
          defectiveReturnedQuantity: request.defectiveReturnedQuantity,
        };
        const outstanding = values.issuedQuantity - values.consumedQuantity - values.unusedReturnedQuantity - values.defectiveReturnedQuantity;
        if (operation === 'ISSUE') {
          if (!['APPROVED', 'PARTIALLY_ISSUED'].includes(request.status)) throw new ConflictException('Part request is not ready to issue');
          const canIssue = request.approvedQuantity - request.issuedQuantity;
          if (body.quantity > canIssue) throw new BadRequestException(`Issue quantity cannot exceed reserved quantity (${canIssue})`);
          const part = await this.sparePartModel.updateOne(
            { _id: request.sparePartId, reservedStock: { $gte: body.quantity } },
            { $inc: { reservedStock: -body.quantity } },
            { session },
          ).exec();
          if (part.modifiedCount !== 1) throw new ConflictException('Reserved stock is unavailable');
          values.issuedQuantity += body.quantity;
        } else if (operation === 'CONSUME') {
          if (!['APPROVED', 'PARTIALLY_ISSUED', 'ISSUED'].includes(request.status)) throw new ConflictException('Part request cannot be consumed in its current state');
          if (body.quantity > outstanding) throw new BadRequestException(`Consumption quantity cannot exceed unconsumed issued quantity (${Math.max(0, outstanding)})`);
          const part = await this.sparePartModel.findById(request.sparePartId).session(session).exec();
          if (!part) throw new NotFoundException('Spare part not found in inventory');
          const usage = await this.visitsService.addSparePartToVisit(
            String(request.visitId),
            {
              isThirdParty: false,
              sparePartId: String(request.sparePartId),
              partRequestId: request._id,
              quantity: body.quantity,
              sourcedBy: 'INVENTORY',
              stockDeducted: true,
              partName: part.name,
              cost: part.price,
              ...(body.serialNumber ? { serialNumber: body.serialNumber } : {}),
              ...(body.warrantyMonths !== undefined ? { warrantyMonths: body.warrantyMonths } : {}),
            },
            { actorRole: 'TECHNICIAN', actorId: technicianId },
            { session, stockAlreadyDeducted: true, approvedPartRequestId: requestId },
          );
          values.consumedQuantity += body.quantity;
          const updated = await this.updateRequestCounters(request, values, operation, technicianId, body, session);
          const transaction = await this.createTransaction(request, operation, body.quantity, key, session, String((usage as any)._id));
          result = { request: updated, transaction, replayed: false };
          return;
        } else {
          if (!['APPROVED', 'PARTIALLY_ISSUED', 'ISSUED'].includes(request.status)) throw new ConflictException('Part request is not ready for returns');
          if (body.quantity > outstanding) throw new BadRequestException(`Return quantity cannot exceed unconsumed issued quantity (${Math.max(0, outstanding)})`);
          if (condition === 'UNUSED') {
          const restored = await this.sparePartModel.updateOne(
              { _id: request.sparePartId },
              { $inc: { stock: body.quantity }, $set: { isInStock: true } },
              { session },
          ).exec();
          if (restored.matchedCount !== 1) throw new NotFoundException('Spare part not found in inventory');
            values.unusedReturnedQuantity += body.quantity;
          } else {
            await this.sparePartModel.updateOne(
              { _id: request.sparePartId },
              { $inc: { quarantinedStock: body.quantity } },
              { session },
            ).exec();
            values.defectiveReturnedQuantity += body.quantity;
          }
        }

        const updated = await this.updateRequestCounters(request, values, operation === 'RETURN' ? `RETURN_${condition}` : operation, technicianId, body, session, condition);
        const transaction = await this.createTransaction(request, operation, body.quantity, key, session, undefined, condition);
        result = { request: updated, transaction, replayed: false };
      });
    } catch (error: any) {
      if (error?.code === 11000) {
        const duplicate = await this.findOperation(key, operation, technicianId, bookingId, requestId, body.quantity, condition);
        if (duplicate) {
          const request = await this.requestModel.findById(requestId).exec();
          return { request, transaction: duplicate, replayed: true };
        }
      }
      throw error;
    } finally {
      await session.endSession();
    }
    if (!result) throw new ConflictException('Part request operation did not complete');
    return result;
  }

  private async updateRequestCounters(
    request: TechnicianPartRequestDocument,
    values: { issuedQuantity: number; consumedQuantity: number; unusedReturnedQuantity: number; defectiveReturnedQuantity: number },
    action: string,
    technicianId: string,
    body: TechnicianPartRequestOperationDto & { reason?: string },
    session: ClientSession,
    condition?: ReturnCondition,
  ) {
    const resolved = values.consumedQuantity + values.unusedReturnedQuantity + values.defectiveReturnedQuantity;
    let status: TechnicianPartRequestStatus = 'APPROVED';
    if (values.issuedQuantity >= request.approvedQuantity) {
      status = resolved >= values.issuedQuantity ? 'FULFILLED' : 'ISSUED';
    } else if (values.issuedQuantity > 0) {
      status = 'PARTIALLY_ISSUED';
    }
    const updated = await this.requestModel.findOneAndUpdate(
      { _id: request._id, status: request.status },
      {
        $set: {
          issuedQuantity: values.issuedQuantity,
          consumedQuantity: values.consumedQuantity,
          unusedReturnedQuantity: values.unusedReturnedQuantity,
          defectiveReturnedQuantity: values.defectiveReturnedQuantity,
          status,
        },
        $push: { events: {
          action,
          quantity: body.quantity,
          actorRole: 'TECHNICIAN',
          actorId: new Types.ObjectId(technicianId),
          ...(condition === 'DEFECTIVE' && body.reason?.trim() ? { reason: body.reason.trim() } : {}),
          idempotencyKey: body.idempotencyKey,
          occurredAt: new Date(),
        } },
      },
      { new: true, session },
    ).exec();
    if (!updated) throw new ConflictException('Part request changed during this operation');
    return updated;
  }

  private async createTransaction(
    request: TechnicianPartRequestDocument,
    operation: 'ISSUE' | 'CONSUME' | 'RETURN',
    quantity: number,
    idempotencyKey: string,
    session: ClientSession,
    usageId?: string,
    condition?: ReturnCondition,
  ) {
    const relatedTransaction = operation === 'RETURN'
      ? await this.transactionModel.findOne({ partRequestId: request._id, type: 'ISSUE' }).sort({ createdAt: -1 }).session(session).exec()
      : null;
    const [transaction] = await this.transactionModel.create([{
      technicianId: request.technicianId,
      bookingId: request.bookingId,
      visitId: request.visitId,
      sparePartId: request.sparePartId,
      partRequestId: request._id,
      ...(usageId ? { sparePartUsageId: new Types.ObjectId(usageId) } : {}),
      quantity,
      type: operation,
      ...(condition ? { returnCondition: condition } : {}),
      ...(relatedTransaction ? { relatedTransactionId: relatedTransaction._id } : {}),
      idempotencyKey,
    }], { session });
    return transaction;
  }

  private async findOperation(
    key: string,
    operation: 'ISSUE' | 'CONSUME' | 'RETURN',
    technicianId: string,
    bookingId: string,
    requestId: string,
    quantity: number,
    condition?: ReturnCondition,
    session?: ClientSession,
  ) {
    let query = this.transactionModel.findOne({ idempotencyKey: key });
    if (session) query = query.session(session);
    const previous = await query.exec();
    if (!previous) return null;
    if (
      String(previous.technicianId) !== technicianId ||
      String(previous.bookingId) !== bookingId ||
      String(previous.partRequestId) !== requestId ||
      previous.type !== operation ||
      previous.quantity !== quantity ||
      (previous.returnCondition || undefined) !== condition
    ) {
      throw new ConflictException('idempotencyKey cannot be reused for a different part request operation');
    }
    return previous;
  }

  private async assertTechnicianJob(technicianId: string, bookingId: string, visitId?: string, session?: ClientSession) {
    let bookingQuery = this.bookingModel.findById(bookingId);
    if (session) bookingQuery = bookingQuery.session(session);
    const booking = await bookingQuery.exec();
    if (!booking) throw new NotFoundException('Job not found');
    if (resolveTechnicianId(booking.technicianId) !== technicianId) throw new ForbiddenException('You do not have access to this job');
    if (booking.assignmentStatus !== 'ACCEPTED') throw new ForbiddenException('Job must be accepted before requesting or handling parts');
    if (booking.isBilled || booking.jobClosed || booking.sheetLockedAt || !JOB_SHEET_EDITABLE_STATUSES.includes(booking.status as any)) {
      throw new ForbiddenException('Job sheet is locked or cannot be edited');
    }
    if (visitId) {
      let visitQuery = this.visitModel.findById(visitId);
      if (session) visitQuery = visitQuery.session(session);
      const visit = await visitQuery.exec();
      if (!visit || String(visit.bookingId) !== bookingId) throw new BadRequestException('Visit does not belong to this job');
    }
    return booking;
  }

  private assertSameRequest(request: TechnicianPartRequestDocument, technicianId: string, bookingId: string, body: CreateTechnicianPartRequestDto) {
    if (
      String(request.technicianId) !== technicianId ||
      String(request.bookingId) !== bookingId ||
      String(request.visitId) !== body.visitId ||
      String(request.sparePartId) !== body.sparePartId ||
      request.requestedQuantity !== body.quantity
    ) throw new ConflictException('idempotencyKey cannot be reused for a different part request');
  }

  private pagination(pageRaw: number, limitRaw: number) {
    const page = Number(pageRaw);
    const limit = Number(limitRaw);
    if (!Number.isSafeInteger(page) || page < 1) throw new BadRequestException('page must be a positive integer');
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new BadRequestException('limit must be from 1 to 100');
    return { page, limit };
  }

  private assertObjectIds(values: string[]) {
    if (values.some((value) => !Types.ObjectId.isValid(value))) throw new BadRequestException('Invalid part request reference');
  }

  private assertQuantity(value: number) {
    if (!Number.isInteger(value) || value < 1) throw new BadRequestException('quantity must be a positive integer');
  }

  private idempotencyKey(value: string) {
    const key = String(value || '').trim();
    if (!key || key.length > 200) throw new BadRequestException('idempotencyKey must contain 1 to 200 characters');
    return key;
  }

  private requiredReason(value: string) {
    const reason = String(value || '').trim();
    if (!reason || reason.length > 500) throw new BadRequestException('A reason of 1 to 500 characters is required');
    return reason;
  }
}
