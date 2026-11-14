import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { VisitsService } from './visits.service';
import { Visit, VisitSchema } from './schemas/visit.schema';
import { SparePartUsage, SparePartUsageSchema } from './schemas/spare-part-usage.schema';
import { Booking, BookingSchema } from '../bookings/schemas/booking.schema';
import { SparePart, SparePartSchema } from '../spare-parts/schemas/spare-part.schema';
import { SparePartsService } from '../spare-parts/spare-parts.service';
import { WarrantiesService } from '../warranties/warranties.service';
import {
  PartInventoryTransaction,
  PartInventoryTransactionSchema,
} from './schemas/part-inventory-transaction.schema';

describe('VisitsService inventory quantity', () => {
  jest.setTimeout(30000);

  let service: VisitsService;
  let sparePartModel: Model<any>;
  let visitModel: Model<any>;
  let usageModel: Model<any>;
  let bookingModel: Model<any>;
  let transactionModel: Model<any>;
  let mongod: MongoMemoryReplSet;
  let module: TestingModule;

  const warranties = {
    resolveInventoryWarrantyMonths: jest.fn().mockReturnValue(0),
    assertSerialAvailable: jest.fn(async (s: string) => s.trim().toUpperCase()),
    applyReplacementCoverage: jest.fn(),
  };

  beforeAll(async () => {
    mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    module = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        MongooseModule.forFeature([
          { name: Visit.name, schema: VisitSchema },
          { name: SparePartUsage.name, schema: SparePartUsageSchema },
          { name: Booking.name, schema: BookingSchema },
          { name: SparePart.name, schema: SparePartSchema },
          {
            name: PartInventoryTransaction.name,
            schema: PartInventoryTransactionSchema,
          },
        ]),
      ],
      providers: [
        VisitsService,
        { provide: SparePartsService, useValue: {} },
        { provide: WarrantiesService, useValue: warranties },
      ],
    }).compile();

    service = module.get(VisitsService);
    sparePartModel = module.get(getModelToken(SparePart.name));
    visitModel = module.get(getModelToken(Visit.name));
    usageModel = module.get(getModelToken(SparePartUsage.name));
    bookingModel = module.get(getModelToken(Booking.name));
    transactionModel = module.get(getModelToken(PartInventoryTransaction.name));
  });

  afterAll(async () => {
    await module?.close();
    await mongod?.stop();
  });

  beforeEach(async () => {
    await usageModel.deleteMany({});
    await visitModel.deleteMany({});
    await sparePartModel.deleteMany({});
    await bookingModel.deleteMany({});
    await transactionModel.deleteMany({});
    warranties.resolveInventoryWarrantyMonths.mockReturnValue(0);
  });

  async function seedPart(stock = 60) {
    return sparePartModel.create({
      sku: `SP-QTY-${new Types.ObjectId().toString()}`,
      slug: `qty-${Date.now()}`,
      name: 'Godrej Turntable Motors - Series 335',
      applianceTypeSlug: 'microwave',
      price: 75750,
      stock,
      isInStock: true,
      isActive: true,
    });
  }

  async function seedVisit(status: string) {
    return visitModel.create({
      bookingId: new Types.ObjectId(),
      technicianId: new Types.ObjectId(),
      visitOrder: 1,
      status,
      jobDescription: 'Parts logging',
    });
  }

  async function seedAssignedJob(technicianId = new Types.ObjectId()) {
    const booking = await bookingModel.create({
      userId: new Types.ObjectId(),
      serviceId: new Types.ObjectId(),
      subCategoryId: new Types.ObjectId(),
      technicianId,
      assignmentStatus: 'ACCEPTED',
      contactPhone: '9999999999',
      addressData: { zip: '110001', text: 'Test address' },
      status: 'IN_PROGRESS',
    });
    const visit = await visitModel.create({
      bookingId: booking._id,
      technicianId,
      visitOrder: 1,
      status: 'IN_PROGRESS',
    });
    return { booking, visit, technicianId };
  }

  async function issueInput(overrides: Record<string, any> = {}) {
    const { booking, visit, technicianId } = await seedAssignedJob();
    const spare = await seedPart(10);
    return {
      bookingId: String(booking._id),
      technicianId: String(technicianId),
      visitId: String(visit._id),
      sparePartId: String(spare._id),
      quantity: 2,
      idempotencyKey: `issue-${new Types.ObjectId()}`,
      usage: { cost: 757.5, partName: spare.name },
      spare,
      booking,
      visit,
      ...overrides,
    };
  }

  it('issues inventory, records the ledger and creates usage with stock marked deducted', async () => {
    const input = await issueInput();

    const usage = await service.issueInventoryPartToVisit(input);

    expect(usage).toMatchObject({ quantity: 2, stockDeducted: true });
    expect(String(usage.visitId)).toBe(input.visitId);
    const transaction = await transactionModel
      .findOne({ idempotencyKey: input.idempotencyKey })
      .lean();
    expect(String(transaction.technicianId)).toBe(input.technicianId);
    expect(String(transaction.bookingId)).toBe(input.bookingId);
    expect(String(transaction.visitId)).toBe(input.visitId);
    expect(String(transaction.sparePartId)).toBe(String(input.spare._id));
    expect(String(transaction.sparePartUsageId)).toBe(String(usage._id));
    expect(transaction).toMatchObject({ quantity: 2, type: 'ISSUE' });
    expect((await sparePartModel.findById(input.spare._id).lean())!.stock).toBe(8);
    expect((await visitModel.findById(input.visit._id).lean())!.partsUsed).toContainEqual(
      usage._id,
    );
  });

  it.each([undefined, null, 0, -1, 1.5])(
    'rejects invalid issue quantity %s without changing stock',
    async (quantity) => {
      const input = await issueInput({ quantity });
      await expect(service.issueInventoryPartToVisit(input)).rejects.toThrow(
        'quantity must be a positive integer',
      );
      expect((await sparePartModel.findById(input.spare._id).lean())!.stock).toBe(10);
      expect(await transactionModel.countDocuments({})).toBe(0);
      expect(await usageModel.countDocuments({})).toBe(0);
    },
  );

  it('rejects insufficient stock without creating a transaction or usage', async () => {
    const input = await issueInput({ quantity: 11 });
    await expect(service.issueInventoryPartToVisit(input)).rejects.toThrow(
      /not enough stock/i,
    );
    expect((await sparePartModel.findById(input.spare._id).lean())!.stock).toBe(10);
    expect(await transactionModel.countDocuments({})).toBe(0);
    expect(await usageModel.countDocuments({})).toBe(0);
  });

  it('rejects nonexistent and inactive inventory parts', async () => {
    const missing = await issueInput({ sparePartId: new Types.ObjectId().toString() });
    await expect(service.issueInventoryPartToVisit(missing)).rejects.toThrow(
      'Spare part not found in inventory',
    );

    const inactive = await issueInput();
    await sparePartModel.updateOne({ _id: inactive.spare._id }, { isActive: false });
    await expect(service.issueInventoryPartToVisit(inactive)).rejects.toThrow(
      'Spare part not found in inventory',
    );
  });

  it('rejects an issue for another technician’s job', async () => {
    const input = await issueInput({ technicianId: new Types.ObjectId().toString() });
    await expect(service.issueInventoryPartToVisit(input)).rejects.toThrow(
      'You do not have access to this job',
    );
    expect((await sparePartModel.findById(input.spare._id).lean())!.stock).toBe(10);
  });

  it('returns the original issue after stock is exhausted without creating another usage or deduction', async () => {
    const input = await issueInput({ quantity: 10 });
    const first = await service.issueInventoryPartToVisit(input);
    const preflightRetry = await service.findExistingInventoryIssue(input);
    const retry = await service.issueInventoryPartToVisit(input);

    expect(String(preflightRetry!._id)).toBe(String(first._id));
    expect(String(retry._id)).toBe(String(first._id));
    expect(await transactionModel.countDocuments({ type: 'ISSUE' })).toBe(1);
    expect(await usageModel.countDocuments({})).toBe(1);
    expect((await visitModel.findById(input.visit._id).lean())!.partsUsed).toHaveLength(1);
    expect((await sparePartModel.findById(input.spare._id).lean())!.stock).toBe(0);
  });

  it('rejects reuse of the same key with a different quantity or part', async () => {
    const input = await issueInput({ quantity: 1 });
    await service.issueInventoryPartToVisit(input);

    await expect(
      service.issueInventoryPartToVisit({ ...input, quantity: 2 }),
    ).rejects.toThrow(ConflictException);

    const otherPart = await seedPart(10);
    await expect(
      service.issueInventoryPartToVisit({
        ...input,
        sparePartId: String(otherPart._id),
      }),
    ).rejects.toThrow(ConflictException);

    expect((await sparePartModel.findById(input.spare._id).lean())!.stock).toBe(9);
    expect(await transactionModel.countDocuments({ type: 'ISSUE' })).toBe(1);
    expect(await usageModel.countDocuments({})).toBe(1);
  });

  it('does not expose or allow reuse of another technician’s idempotency key', async () => {
    const input = await issueInput({ quantity: 1 });
    await service.issueInventoryPartToVisit(input);
    const other = await issueInput({
      technicianId: new Types.ObjectId().toString(),
      idempotencyKey: input.idempotencyKey,
      sparePartId: input.sparePartId,
      quantity: input.quantity,
    });

    await expect(service.findExistingInventoryIssue(other)).rejects.toThrow(
      'idempotencyKey cannot be reused for a different part issue',
    );
    await expect(service.issueInventoryPartToVisit(other)).rejects.toThrow(
      'idempotencyKey cannot be reused for a different part issue',
    );
    expect((await sparePartModel.findById(input.spare._id).lean())!.stock).toBe(9);
    expect(await transactionModel.countDocuments({ type: 'ISSUE' })).toBe(1);
  });

  it('deduplicates concurrent requests with the same key', async () => {
    const input = await issueInput({ quantity: 1 });
    await sparePartModel.updateOne({ _id: input.spare._id }, { stock: 1 });

    const results = await Promise.all([
      service.issueInventoryPartToVisit(input),
      service.issueInventoryPartToVisit(input),
    ]);

    expect(String(results[0]._id)).toBe(String(results[1]._id));
    expect((await sparePartModel.findById(input.spare._id).lean())!.stock).toBe(0);
    expect(await transactionModel.countDocuments({ type: 'ISSUE' })).toBe(1);
    expect(await usageModel.countDocuments({})).toBe(1);
    expect((await visitModel.findById(input.visit._id).lean())!.partsUsed).toHaveLength(1);
  });

  async function issueAndReturnInput(issuedQuantity = 5) {
    const input = await issueInput({ quantity: issuedQuantity });
    const issued = await service.issueInventoryPartToVisit(input);
    return {
      input,
      issued,
      returnInput: {
        bookingId: input.bookingId,
        technicianId: input.technicianId,
        visitId: input.visitId,
        usageId: String(issued._id),
        quantity: 2,
        idempotencyKey: `return-${new Types.ObjectId()}`,
      },
    };
  }

  async function issueForTechnician(technicianId: Types.ObjectId, quantity = 1) {
    const { booking, visit } = await seedAssignedJob(technicianId);
    const spare = await seedPart(10);
    const input = {
      bookingId: String(booking._id),
      technicianId: String(technicianId),
      visitId: String(visit._id),
      sparePartId: String(spare._id),
      quantity,
      idempotencyKey: `history-issue-${new Types.ObjectId()}`,
      usage: { cost: 757.5, partName: spare.name },
    };
    return service.issueInventoryPartToVisit(input);
  }

  describe('technician transaction history', () => {
    it('returns ISSUE and RETURN transactions with related records and newest first', async () => {
      const technicianId = new Types.ObjectId();
      const usage = await issueForTechnician(technicianId, 3);
      const issue = await transactionModel.findOne({ sparePartUsageId: usage._id });
      const spare = await sparePartModel.findById(issue.sparePartId);
      const result = await service.returnInventoryPart({
        bookingId: String(issue.bookingId),
        technicianId: String(technicianId),
        visitId: String(issue.visitId),
        usageId: String(usage._id),
        quantity: 3,
        idempotencyKey: `history-return-${new Types.ObjectId()}`,
      });

      const history = await service.listPartInventoryTransactions(String(technicianId));
      expect(history.data.map((row) => row.type)).toEqual(['RETURN', 'ISSUE']);
      expect(history.data[0]).toMatchObject({
        transactionId: String(result.transaction._id),
        quantity: 3,
        sparePart: { id: String(issue.sparePartId), name: spare.name },
        booking: { id: String(issue.bookingId) },
        visit: { id: String(issue.visitId) },
        relatedIssue: { id: String(issue._id), type: 'ISSUE', quantity: 3 },
      });
      expect(history.data[0].timestamp).toBeInstanceOf(Date);
      expect(history.data[1].relatedIssue).toBeNull();
    });

    it('paginates records and never includes another technician’s transactions', async () => {
      const technicianId = new Types.ObjectId();
      const otherTechnicianId = new Types.ObjectId();
      for (let i = 0; i < 5; i += 1) await issueForTechnician(technicianId);
      await issueForTechnician(otherTechnicianId);

      const firstPage = await service.listPartInventoryTransactions(String(technicianId), 1, 2);
      const secondPage = await service.listPartInventoryTransactions(String(technicianId), 2, 2);
      expect(firstPage).toMatchObject({ total: 5, page: 1, limit: 2, totalPages: 3 });
      expect(firstPage.data).toHaveLength(2);
      expect(secondPage.data).toHaveLength(2);
      expect(firstPage.data.map((row) => row.transactionId)).not.toEqual(
        secondPage.data.map((row) => row.transactionId),
      );
      const allIds = (await service.listPartInventoryTransactions(String(technicianId), 1, 10))
        .data.map((row) => row.transactionId);
      const other = await transactionModel.findOne({ technicianId: otherTechnicianId });
      expect(allIds).not.toContain(String(other._id));
    });

    it('returns an empty page and validates pagination values', async () => {
      const empty = await service.listPartInventoryTransactions(new Types.ObjectId().toString());
      expect(empty).toMatchObject({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 });
      for (const [page, limit] of [[0, 20], [1.5, 20], [1, -1], [1, 101], ['invalid', 20]] as any[]) {
        await expect(service.listPartInventoryTransactions(new Types.ObjectId().toString(), page, limit))
          .rejects.toThrow(BadRequestException);
      }
    });
  });

  it('returns part of an inventory issue, restores stock and links the append-only RETURN', async () => {
    const { input, issued, returnInput } = await issueAndReturnInput(5);
    const result = await service.returnInventoryPart(returnInput);

    expect(result.usage.quantity).toBe(3);
    expect(result.transaction).toMatchObject({ quantity: 2, type: 'RETURN' });
    expect(String(result.transaction.relatedTransactionId)).toBe(
      String(await transactionModel.findOne({ type: 'ISSUE' }).then((row) => row._id)),
    );
    expect(String(result.transaction.sparePartUsageId)).toBe(String(issued._id));
    expect((await sparePartModel.findById(input.spare._id).lean())!.stock).toBe(7);
    expect(await transactionModel.countDocuments({ type: 'ISSUE' })).toBe(1);
    expect(await transactionModel.countDocuments({ type: 'RETURN' })).toBe(1);
  });

  it('supports a full return and leaves the usage at zero billable quantity', async () => {
    const { input, returnInput } = await issueAndReturnInput(3);
    const result = await service.returnInventoryPart({ ...returnInput, quantity: 3 });
    expect(result.usage.quantity).toBe(0);
    expect((await sparePartModel.findById(input.spare._id).lean())!.stock).toBe(10);
  });

  it('allows multiple partial returns up to the original issue and rejects any further amount', async () => {
    const { input, returnInput } = await issueAndReturnInput(5);
    await service.returnInventoryPart(returnInput);
    const second = await service.returnInventoryPart({
      ...returnInput,
      quantity: 3,
      idempotencyKey: `return-${new Types.ObjectId()}`,
    });
    expect(second.usage.quantity).toBe(0);
    await expect(service.returnInventoryPart({
      ...returnInput,
      quantity: 1,
      idempotencyKey: `return-${new Types.ObjectId()}`,
    })).rejects.toThrow(BadRequestException);
    expect((await sparePartModel.findById(input.spare._id).lean())!.stock).toBe(10);
    expect(await transactionModel.countDocuments({ type: 'RETURN' })).toBe(2);
  });

  it('rejects returns above the remaining issued quantity', async () => {
    const { input, returnInput } = await issueAndReturnInput(2);
    await expect(service.returnInventoryPart({ ...returnInput, quantity: 3 })).rejects.toThrow(
      BadRequestException,
    );
    expect((await sparePartModel.findById(input.spare._id).lean())!.stock).toBe(8);
    expect(await transactionModel.countDocuments({ type: 'RETURN' })).toBe(0);
  });

  it.each([undefined, null, 0, -1, 1.5])(
    'rejects invalid return quantity %s',
    async (quantity) => {
      const { input, returnInput } = await issueAndReturnInput(5);
      await expect(service.returnInventoryPart({ ...returnInput, quantity: quantity as any })).rejects.toThrow(
        'quantity must be a positive integer',
      );
      expect((await sparePartModel.findById(input.spare._id).lean())!.stock).toBe(5);
      expect(await transactionModel.countDocuments({ type: 'RETURN' })).toBe(0);
    },
  );

  it('rejects a return by a different technician', async () => {
    const { input, returnInput } = await issueAndReturnInput(5);
    await expect(service.returnInventoryPart({
      ...returnInput,
      technicianId: new Types.ObjectId().toString(),
    })).rejects.toThrow(ForbiddenException);
    expect((await sparePartModel.findById(input.spare._id).lean())!.stock).toBe(5);
  });

  it('rejects self-sourced usage on the inventory return endpoint', async () => {
    const input = await issueInput();
    const selfUsage = await usageModel.create({
      visitId: input.visit._id,
      isThirdParty: true,
      sourcedBy: 'SELF',
      partName: 'Technician supplied part',
      quantity: 1,
    });
    await expect(service.returnInventoryPart({
      bookingId: input.bookingId,
      technicianId: input.technicianId,
      visitId: input.visitId,
      usageId: String(selfUsage._id),
      quantity: 1,
      idempotencyKey: `return-${new Types.ObjectId()}`,
    })).rejects.toThrow('Only inventory-issued parts can be returned');
  });

  it('replays the same return without adding a second ledger entry or stock', async () => {
    const { input, returnInput } = await issueAndReturnInput(5);
    const first = await service.returnInventoryPart(returnInput);
    const retry = await service.returnInventoryPart(returnInput);
    expect(retry.replayed).toBe(true);
    expect(String(retry.transaction._id)).toBe(String(first.transaction._id));
    expect((await sparePartModel.findById(input.spare._id).lean())!.stock).toBe(7);
    expect(await usageModel.countDocuments({})).toBe(1);
    expect(await transactionModel.countDocuments({ type: 'RETURN' })).toBe(1);
  });

  it('deduplicates concurrent returns with the same idempotency key', async () => {
    const { input, returnInput } = await issueAndReturnInput(5);
    const results = await Promise.all([
      service.returnInventoryPart(returnInput),
      service.returnInventoryPart(returnInput),
    ]);
    expect(String(results[0].transaction._id)).toBe(String(results[1].transaction._id));
    expect((await sparePartModel.findById(input.spare._id).lean())!.stock).toBe(7);
    expect(await transactionModel.countDocuments({ type: 'RETURN' })).toBe(1);
  });

  it('rejects a return key reused with a different payload', async () => {
    const { input, returnInput } = await issueAndReturnInput(5);
    await service.returnInventoryPart(returnInput);
    await expect(service.returnInventoryPart({ ...returnInput, quantity: 1 })).rejects.toThrow(
      ConflictException,
    );
    await expect(service.returnInventoryPart({
      ...returnInput,
      usageId: new Types.ObjectId().toString(),
    })).rejects.toThrow(ConflictException);
    expect((await sparePartModel.findById(input.spare._id).lean())!.stock).toBe(7);
    expect(await transactionModel.countDocuments({ type: 'RETURN' })).toBe(1);
  });

  it('does not expose or let another technician reuse an existing return key', async () => {
    const { input, returnInput } = await issueAndReturnInput(5);
    await service.returnInventoryPart(returnInput);
    await expect(service.returnInventoryPart({
      ...returnInput,
      technicianId: new Types.ObjectId().toString(),
    })).rejects.toThrow(ConflictException);
    expect((await sparePartModel.findById(input.spare._id).lean())!.stock).toBe(7);
    expect(await transactionModel.countDocuments({ type: 'RETURN' })).toBe(1);
  });

  it('prevents concurrent returns from exceeding the outstanding issue quantity', async () => {
    const { input, returnInput } = await issueAndReturnInput(5);
    const outcomes = await Promise.allSettled([
      service.returnInventoryPart({ ...returnInput, quantity: 3 }),
      service.returnInventoryPart({
        ...returnInput,
        quantity: 3,
        idempotencyKey: `return-${new Types.ObjectId()}`,
      }),
    ]);
    expect(outcomes.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter((x) => x.status === 'rejected')).toHaveLength(1);
    expect((await sparePartModel.findById(input.spare._id).lean())!.stock).toBe(8);
    expect(await usageModel.findById(returnInput.usageId).then((row) => row.quantity)).toBe(2);
    expect(await transactionModel.countDocuments({ type: 'RETURN' })).toBe(1);
  });

  it('rolls back stock, usage, ledger and booking history when return ledger insert fails', async () => {
    const { input, returnInput } = await issueAndReturnInput(5);
    const historyBefore = (await bookingModel.findById(input.booking._id).lean())!.changeHistory;
    const createFailure = jest
      .spyOn(transactionModel, 'create')
      .mockRejectedValueOnce(new Error('forced return ledger insert failure'));
    try {
      await expect(service.returnInventoryPart(returnInput)).rejects.toThrow(
        'forced return ledger insert failure',
      );
    } finally {
      createFailure.mockRestore();
    }
    expect((await sparePartModel.findById(input.spare._id).lean())!.stock).toBe(5);
    expect(await usageModel.findById(returnInput.usageId).then((row) => row.quantity)).toBe(5);
    expect(await transactionModel.countDocuments({ type: 'RETURN' })).toBe(0);
    expect((await bookingModel.findById(input.booking._id).lean())!.changeHistory).toEqual(historyBefore);
  });

  it('does not deduct returned inventory again when the visit completes', async () => {
    const { input, returnInput } = await issueAndReturnInput(5);
    await service.returnInventoryPart({ ...returnInput, quantity: 2 });
    await service.updateStatus(input.visitId, { status: 'COMPLETED' });
    expect((await sparePartModel.findById(input.spare._id).lean())!.stock).toBe(7);
  });

  it('prevents deleting a ledger-backed issue through the legacy part removal path', async () => {
    const { input, issued } = await issueAndReturnInput(2);
    await expect(
      service.removeSparePartFromVisit(input.visitId, String(issued._id)),
    ).rejects.toThrow('Inventory-issued parts must be returned through the return endpoint');
    expect((await sparePartModel.findById(input.spare._id).lean())!.stock).toBe(8);
    expect(await usageModel.countDocuments({})).toBe(1);
    expect(await transactionModel.countDocuments({ type: 'ISSUE' })).toBe(1);
  });

  it('rolls back stock, usage, visit links and booking history when ledger insert fails', async () => {
    const input = await issueInput({ quantity: 3 });
    const bookingBefore = await bookingModel.findById(input.booking._id).lean();
    const createFailure = jest
      .spyOn(transactionModel, 'create')
      .mockRejectedValueOnce(new Error('forced ledger insert failure'));

    try {
      await expect(service.issueInventoryPartToVisit(input)).rejects.toThrow(
        'forced ledger insert failure',
      );
    } finally {
      createFailure.mockRestore();
    }

    expect((await sparePartModel.findById(input.spare._id).lean())!.stock).toBe(10);
    expect(await usageModel.countDocuments({})).toBe(0);
    expect(await transactionModel.countDocuments({})).toBe(0);
    expect((await visitModel.findById(input.visit._id).lean())!.partsUsed).toHaveLength(0);
    const bookingAfter = await bookingModel.findById(input.booking._id).lean();
    expect(bookingAfter!.changeHistory).toEqual(bookingBefore!.changeHistory);
  });

  it('prevents concurrent issues from reducing stock below zero', async () => {
    const input = await issueInput({ quantity: 1 });
    await sparePartModel.updateOne({ _id: input.spare._id }, { stock: 1 });
    const other = await issueInput({
      sparePartId: String(input.spare._id),
      quantity: 1,
    });

    const outcomes = await Promise.allSettled([
      service.issueInventoryPartToVisit(input),
      service.issueInventoryPartToVisit(other),
    ]);

    expect(outcomes.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect((await sparePartModel.findById(input.spare._id).lean())!.stock).toBe(0);
    expect(await transactionModel.countDocuments({ type: 'ISSUE' })).toBe(1);
  });

  it('does not deduct inventory again when an issued visit is completed', async () => {
    const input = await issueInput({ quantity: 1 });
    await service.issueInventoryPartToVisit(input);
    await service.updateStatus(input.visitId, { status: 'COMPLETED' });

    expect((await sparePartModel.findById(input.spare._id).lean())!.stock).toBe(9);
  });

  it('uses the entered quantity, not the full stock of 60', async () => {
    const spare = await seedPart(60);
    const visit = await seedVisit('COMPLETED');

    const usage = await service.addSparePartToVisit(String(visit._id), {
      isThirdParty: false,
      sparePartId: String(spare._id),
      quantity: 1,
      cost: 0,
      serialNumber: 'UNIT-SERIAL-001',
    });

    expect(usage.quantity).toBe(1);
    expect(usage.cost).toBe(757.5);
    expect(usage.stockDeducted).toBe(true);

    const after = await sparePartModel.findById(spare._id).lean();
    expect(after!.stock).toBe(59);

    await service.updateStatus(String(visit._id), { status: 'COMPLETED' });
    const still = await sparePartModel.findById(spare._id).lean();
    expect(still!.stock).toBe(59);
  });

  it('defaults a missing quantity to 1', async () => {
    const spare = await seedPart(60);
    const visit = await seedVisit('SCHEDULED');

    const usage = await service.addSparePartToVisit(String(visit._id), {
      isThirdParty: false,
      sparePartId: String(spare._id),
    });

    expect(usage.quantity).toBe(1);
    const untouched = await sparePartModel.findById(spare._id).lean();
    expect(untouched!.stock).toBe(60);

    await service.updateStatus(String(visit._id), { status: 'COMPLETED' });
    const deducted = await sparePartModel.findById(spare._id).lean();
    expect(deducted!.stock).toBe(59);

    await service.updateStatus(String(visit._id), { status: 'COMPLETED' });
    const once = await sparePartModel.findById(spare._id).lean();
    expect(once!.stock).toBe(59);
  });

  it('rejects a quantity above stock and restores stock when the line is removed', async () => {
    const spare = await seedPart(60);
    const visit = await seedVisit('COMPLETED');

    await expect(
      service.addSparePartToVisit(String(visit._id), {
        isThirdParty: false,
        sparePartId: String(spare._id),
        quantity: 60,
      }),
    ).resolves.toMatchObject({ quantity: 60, stockDeducted: true });

    const empty = await sparePartModel.findById(spare._id).lean();
    expect(empty!.stock).toBe(0);

    const spare2 = await seedPart(60);
    const visit2 = await seedVisit('COMPLETED');
    await expect(
      service.addSparePartToVisit(String(visit2._id), {
        isThirdParty: false,
        sparePartId: String(spare2._id),
        quantity: 61,
      }),
    ).rejects.toThrow(/cannot exceed available stock \(60\)/);

    const usage = await service.addSparePartToVisit(String(visit2._id), {
      isThirdParty: false,
      sparePartId: String(spare2._id),
      quantity: 1,
    });
    await service.removeSparePartFromVisit(String(visit2._id), String((usage as any)._id));
    const restored = await sparePartModel.findById(spare2._id).lean();
    expect(restored!.stock).toBe(60);
  });
});
