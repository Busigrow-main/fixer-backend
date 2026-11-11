import { MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Model, Types } from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';

import { Earning, EarningDocument, EarningSchema } from '../schemas/earning.schema';
import {
  Settlement,
  SettlementDocument,
  SettlementSchema,
  SettlementPaymentStatus,
  SettlementReconciliationStatus,
  SettlementStatus,
} from './schemas/settlement.schema';
import {
  SettlementItem,
  SettlementItemDocument,
  SettlementItemSchema,
  SettlementItemClaimStatus,
} from './schemas/settlement-item.schema';
import { SettlementsService } from './settlements.service';
import { SettlementsController } from './settlements.controller';
import { ROLES_KEY } from '../../auth/decorators/roles.decorator';
import { RecordSettlementPaymentDto } from './settlements.dto';

jest.setTimeout(120_000);

describe('SettlementsService', () => {
  let mongod: MongoMemoryServer;
  let moduleRef: TestingModule;
  let service: SettlementsService;
  let earningModel: Model<EarningDocument>;
  let settlementModel: Model<SettlementDocument>;
  let settlementItemModel: Model<SettlementItemDocument>;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    moduleRef = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        MongooseModule.forFeature([
          { name: Earning.name, schema: EarningSchema },
          { name: Settlement.name, schema: SettlementSchema },
          { name: SettlementItem.name, schema: SettlementItemSchema },
        ]),
      ],
      providers: [SettlementsService],
    }).compile();
    service = moduleRef.get(SettlementsService);
    earningModel = moduleRef.get(getModelToken(Earning.name));
    settlementModel = moduleRef.get(getModelToken(Settlement.name));
    settlementItemModel = moduleRef.get(getModelToken(SettlementItem.name));
  });

  afterEach(async () => {
    await Promise.all([
      earningModel.deleteMany({}),
      settlementModel.deleteMany({}),
      settlementItemModel.deleteMany({}),
    ]);
  });

  afterAll(async () => {
    await moduleRef.close();
    await mongod.stop();
  });

  it('is idempotent across duplicate preparation runs and sums item snapshots once', async () => {
    const technicianId = new Types.ObjectId();
    await earningModel.create([
      {
        technicianId,
        amount: 1000,
        type: 'LABOUR',
        paymentMethod: 'UPI',
        earnedAt: new Date('2026-11-10T10:00:00.000Z'),
      },
      {
        technicianId,
        amount: -100,
        type: 'SELF_PART_FEE',
        paymentMethod: 'UPI',
        earnedAt: new Date('2026-11-10T11:00:00.000Z'),
      },
    ]);

    const cutoff = new Date('2026-11-10T16:00:00.000Z');
    await service.prepareAll(cutoff);
    await service.prepareAll(cutoff);

    expect(await settlementModel.countDocuments()).toBe(1);
    expect(await settlementItemModel.countDocuments()).toBe(2);
    await expect(settlementModel.findOne().lean()).resolves.toMatchObject({
      status: SettlementStatus.PREPARED,
      totalEarnings: 900,
      netPayable: 900,
    });
  });

  it('handles concurrent workers without duplicate settlements or earning claims', async () => {
    const technicianId = new Types.ObjectId();
    await earningModel.create({
      technicianId,
      amount: 800,
      type: 'LABOUR',
      paymentMethod: 'UPI',
      earnedAt: new Date('2026-11-09T10:00:00.000Z'),
    });

    await Promise.all([
      service.prepareTechnician(technicianId.toString(), '2026-11-10', new Date('2026-11-10T16:00:00.000Z')),
      service.prepareTechnician(technicianId.toString(), '2026-11-10', new Date('2026-11-10T16:00:00.000Z')),
    ]);

    expect(await settlementModel.countDocuments()).toBe(1);
    expect(await settlementItemModel.countDocuments()).toBe(1);
  });

  it('includes older unsettled earnings and excludes future and already claimed earnings', async () => {
    const technicianId = new Types.ObjectId();
    const [older, claimed, future] = await earningModel.create([
      {
        technicianId,
        amount: 100,
        type: 'BONUS',
        paymentMethod: 'CASH',
        earnedAt: new Date('2026-01-01T10:00:00.000Z'),
      },
      {
        technicianId,
        amount: 200,
        type: 'BONUS',
        paymentMethod: 'CASH',
        earnedAt: new Date('2026-01-02T10:00:00.000Z'),
      },
      {
        technicianId,
        amount: 300,
        type: 'BONUS',
        paymentMethod: 'CASH',
        earnedAt: new Date('2026-11-11T10:00:00.000Z'),
      },
    ]);
    const priorSettlement = await settlementModel.create({
      technicianId,
      settlementDate: '2026-11-09',
      cutoffAt: new Date('2026-11-09T16:00:00.000Z'),
      status: SettlementStatus.PREPARED,
      paymentStatus: SettlementPaymentStatus.NOT_INITIATED,
      reconciliationStatus: SettlementReconciliationStatus.PENDING,
    });
    await settlementItemModel.create({
      settlementId: priorSettlement._id,
      earningId: claimed._id,
      technicianId,
      amount: claimed.amount,
      earningType: claimed.type,
      earnedAt: claimed.earnedAt,
      customerPaymentMethod: claimed.paymentMethod,
      claimStatus: SettlementItemClaimStatus.FINALIZED,
    });

    const [prepared] = await service.prepareAll(new Date('2026-11-10T16:00:00.000Z'));
    const result = await service.getById(prepared!._id.toString());
    expect(result.items.map((item) => String(item.earningId))).toEqual([String(older._id)]);
    expect(result.totalEarnings).toBe(100);
    expect(result.items.some((item) => String(item.earningId) === String(future._id))).toBe(false);
  });

  it('recovers stale claimed items after a partial preparation failure', async () => {
    const technicianId = new Types.ObjectId();
    const earning = await earningModel.create({
      technicianId,
      amount: 750,
      type: 'LABOUR',
      paymentMethod: 'CASH',
      earnedAt: new Date('2026-11-10T10:00:00.000Z'),
    });
    const settlement = await settlementModel.create({
      technicianId,
      settlementDate: '2026-11-10',
      cutoffAt: new Date('2026-11-10T16:00:00.000Z'),
      status: SettlementStatus.PREPARING,
      paymentStatus: SettlementPaymentStatus.NOT_INITIATED,
      reconciliationStatus: SettlementReconciliationStatus.PENDING,
      preparationToken: 'stale-run',
      preparationLeaseUntil: new Date(Date.now() - 1000),
    });
    await settlementItemModel.create({
      settlementId: settlement._id,
      earningId: earning._id,
      technicianId,
      amount: earning.amount,
      earningType: earning.type,
      earnedAt: earning.earnedAt,
      customerPaymentMethod: earning.paymentMethod,
      claimStatus: SettlementItemClaimStatus.CLAIMED,
    });

    await service.prepareTechnician(
      technicianId.toString(),
      '2026-11-10',
      new Date('2026-11-10T16:00:00.000Z'),
    );

    expect(await settlementItemModel.countDocuments({
      settlementId: settlement._id,
      claimStatus: SettlementItemClaimStatus.FINALIZED,
    })).toBe(1);
    expect(await settlementItemModel.countDocuments({
      settlementId: settlement._id,
      claimStatus: SettlementItemClaimStatus.RELEASED,
    })).toBe(0);
    await expect(settlementModel.findById(settlement._id).lean()).resolves.toMatchObject({
      status: SettlementStatus.PREPARED,
      totalEarnings: 750,
    });
  });

  it('recovers a failed settlement without creating a second earning claim', async () => {
    const technicianId = new Types.ObjectId();
    const earning = await earningModel.create({
      technicianId,
      amount: 600,
      type: 'BONUS',
      paymentMethod: 'ONLINE',
      earnedAt: new Date('2026-11-10T10:00:00.000Z'),
    });
    const settlement = await settlementModel.create({
      technicianId,
      settlementDate: '2026-11-10',
      cutoffAt: new Date('2026-11-10T16:00:00.000Z'),
      status: SettlementStatus.PREPARATION_FAILED,
      paymentStatus: SettlementPaymentStatus.NOT_INITIATED,
      reconciliationStatus: SettlementReconciliationStatus.PENDING,
    });
    await settlementItemModel.create({
      settlementId: settlement._id,
      earningId: earning._id,
      technicianId,
      amount: earning.amount,
      earningType: earning.type,
      earnedAt: earning.earnedAt,
      customerPaymentMethod: earning.paymentMethod,
      claimStatus: SettlementItemClaimStatus.FINALIZED,
    });

    await service.prepareTechnician(
      technicianId.toString(),
      '2026-11-10',
      new Date('2026-11-10T16:00:00.000Z'),
    );

    expect(await settlementItemModel.countDocuments({ earningId: earning._id })).toBe(1);
    await expect(settlementModel.findById(settlement._id).lean()).resolves.toMatchObject({
      status: SettlementStatus.PREPARED,
      totalEarnings: 600,
    });
  });

  it('requires approval before payment and supports paid reconciliation', async () => {
    const technicianId = new Types.ObjectId();
    const adminId = new Types.ObjectId().toString();
    await earningModel.create({
      technicianId,
      amount: 500,
      type: 'BONUS',
      paymentMethod: 'ONLINE',
      earnedAt: new Date('2026-11-10T10:00:00.000Z'),
    });
    const [prepared] = await service.prepareAll(new Date('2026-11-10T16:00:00.000Z'));

    await expect(service.recordPayment(prepared!._id.toString(), {
      paymentReference: 'UTR-1',
    }, { userId: adminId })).rejects.toThrow();

    const approved = await service.approve(prepared!._id.toString(), { userId: adminId });
    expect(approved.status).toBe(SettlementStatus.APPROVED);
    await expect(service.recordPayment(prepared!._id.toString(), {
      paymentReference: 'UTR-1',
    } as RecordSettlementPaymentDto, { userId: adminId })).resolves.toMatchObject({
      status: SettlementStatus.APPROVED,
      paymentStatus: SettlementPaymentStatus.FAILED,
    });

    const paid = await service.recordPayment(prepared!._id.toString(), {
      paymentReference: 'UTR-1',
      paymentMethod: 'BANK_TRANSFER',
      successful: true,
    }, { userId: adminId });
    expect(paid.status).toBe(SettlementStatus.PAID);
    expect(paid.paymentStatus).toBe(SettlementPaymentStatus.SUCCESS);

    const reconciled = await service.reconcile(prepared!._id.toString(), {
      status: SettlementReconciliationStatus.MATCHED,
      notes: 'Bank statement matched',
    }, { userId: adminId });
    expect(reconciled.reconciliationStatus).toBe(SettlementReconciliationStatus.MATCHED);
    expect(reconciled.paymentReference).toBe('UTR-1');
  });

  it('keeps rejected and cancelled settlement earnings finalized', async () => {
    const adminId = new Types.ObjectId().toString();
    const rejectedTechnicianId = new Types.ObjectId();
    const cancelledTechnicianId = new Types.ObjectId();
    await earningModel.create([
      {
        technicianId: rejectedTechnicianId,
        amount: 250,
        type: 'BONUS',
        paymentMethod: 'ONLINE',
        earnedAt: new Date('2026-11-10T10:00:00.000Z'),
      },
      {
        technicianId: cancelledTechnicianId,
        amount: 350,
        type: 'BONUS',
        paymentMethod: 'ONLINE',
        earnedAt: new Date('2026-11-10T10:00:00.000Z'),
      },
    ]);
    const [rejected] = await service.prepareAll(new Date('2026-11-10T16:00:00.000Z'));
    await service.reject(rejected!._id.toString(), 'Incorrect amount', { userId: adminId });
    const cancelled = await service.prepareTechnician(
      cancelledTechnicianId.toString(),
      '2026-11-10',
      new Date('2026-11-10T16:00:00.000Z'),
    );
    await service.cancel(cancelled!._id.toString(), 'Duplicate batch', { userId: adminId });

    expect(await settlementItemModel.countDocuments({
      claimStatus: SettlementItemClaimStatus.FINALIZED,
    })).toBe(2);
    await expect(service.prepareTechnician(
      rejectedTechnicianId.toString(),
      '2026-11-10',
      new Date('2026-11-10T16:00:00.000Z'),
    )).resolves.toMatchObject({ status: SettlementStatus.REJECTED });
  });

  it('restricts settlement operations to administrators', () => {
    expect(Reflect.getMetadata(ROLES_KEY, SettlementsController)).toEqual(['ADMIN']);
  });
});
