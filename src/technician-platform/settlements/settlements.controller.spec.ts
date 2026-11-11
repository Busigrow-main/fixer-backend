import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthGuard } from '@nestjs/passport';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Model, Types } from 'mongoose';
import request from 'supertest';

import { Earning, EarningDocument, EarningSchema } from '../schemas/earning.schema';
import { RolesGuard } from '../../auth/guards/roles.guard';
import {
  Settlement,
  SettlementDocument,
  SettlementSchema,
  SettlementStatus,
} from './schemas/settlement.schema';
import {
  SettlementItem,
  SettlementItemDocument,
  SettlementItemSchema,
} from './schemas/settlement-item.schema';
import { SettlementsController } from './settlements.controller';
import { SettlementsService } from './settlements.service';

jest.setTimeout(120_000);

describe('SettlementsController API', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;
  let moduleRef: TestingModule;
  let earningModel: Model<EarningDocument>;
  let settlementModel: Model<SettlementDocument>;
  let settlementItemModel: Model<SettlementItemDocument>;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const jwtGuard = AuthGuard('jwt');
    moduleRef = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        MongooseModule.forFeature([
          { name: Earning.name, schema: EarningSchema },
          { name: Settlement.name, schema: SettlementSchema },
          { name: SettlementItem.name, schema: SettlementItemSchema },
        ]),
      ],
      controllers: [SettlementsController],
      providers: [SettlementsService, RolesGuard],
    })
      .overrideGuard(jwtGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => { getRequest: () => { headers: Record<string, string>; user?: object } };
        }) => {
          const request = context.switchToHttp().getRequest();
          const role = request.headers['x-test-role'];
          if (role) {
            request.user = {
              userId: new Types.ObjectId().toString(),
              role,
            };
          }
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }));
    await app.init();
    earningModel = moduleRef.get(getModelToken(Earning.name));
    settlementModel = moduleRef.get(getModelToken(Settlement.name));
    settlementItemModel = moduleRef.get(getModelToken(SettlementItem.name));
  });

  beforeEach(async () => {
    await Promise.all([
      earningModel.deleteMany({}),
      settlementModel.deleteMany({}),
      settlementItemModel.deleteMany({}),
    ]);
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  it('prepares settlements through the admin API and is idempotent on repeat', async () => {
    const technicianId = new Types.ObjectId();
    await earningModel.create({
      technicianId,
      amount: 1250,
      type: 'LABOUR',
      paymentMethod: 'UPI',
      earnedAt: new Date('2026-11-09T10:00:00.000Z'),
    });

    const body = { cutoffAt: '2026-11-10T16:00:00.000Z' };
    const first = await request(app.getHttpServer())
      .post('/v1/admin/settlements/prepare')
      .set('x-test-role', 'ADMIN')
      .send(body)
      .expect(201);
    const second = await request(app.getHttpServer())
      .post('/v1/admin/settlements/prepare')
      .set('x-test-role', 'ADMIN')
      .send(body)
      .expect(201);

    expect(first.body).toHaveLength(1);
    expect(second.body).toHaveLength(1);
    expect(await settlementModel.countDocuments()).toBe(1);
    expect(await settlementItemModel.countDocuments()).toBe(1);
    await expect(settlementModel.findOne().lean()).resolves.toMatchObject({
      status: SettlementStatus.PREPARED,
      totalEarnings: 1250,
    });
  });

  it('rejects invalid preparation input and non-admin callers', async () => {
    await request(app.getHttpServer())
      .post('/v1/admin/settlements/prepare')
      .set('x-test-role', 'ADMIN')
      .send({ cutoffAt: 'not-a-date' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/v1/admin/settlements/prepare')
      .set('x-test-role', 'CUSTOMER')
      .send({})
      .expect(403);

    await request(app.getHttpServer())
      .get('/v1/admin/settlements')
      .set('x-test-role', 'CUSTOMER')
      .expect(403);
  });

  it('enforces approval and payment confirmation through lifecycle APIs', async () => {
    const paidTechnicianId = new Types.ObjectId();
    const rejectedTechnicianId = new Types.ObjectId();
    const cancelledTechnicianId = new Types.ObjectId();
    await earningModel.create([
      {
        technicianId: paidTechnicianId,
        amount: 100,
        type: 'LABOUR',
        paymentMethod: 'UPI',
        earnedAt: new Date('2026-11-09T10:00:00.000Z'),
      },
      {
        technicianId: rejectedTechnicianId,
        amount: 200,
        type: 'LABOUR',
        paymentMethod: 'UPI',
        earnedAt: new Date('2026-11-09T10:00:00.000Z'),
      },
      {
        technicianId: cancelledTechnicianId,
        amount: 300,
        type: 'LABOUR',
        paymentMethod: 'UPI',
        earnedAt: new Date('2026-11-09T10:00:00.000Z'),
      },
    ]);

    const prepared = await request(app.getHttpServer())
      .post('/v1/admin/settlements/prepare')
      .set('x-test-role', 'ADMIN')
      .send({ cutoffAt: '2026-11-10T16:00:00.000Z' })
      .expect(201);
    const byTechnician = new Map(
      prepared.body.map((settlement: { technicianId: string; _id: string }) => [
        settlement.technicianId,
        settlement._id,
      ]),
    );
    const paidId = byTechnician.get(paidTechnicianId.toString());
    const rejectedId = byTechnician.get(rejectedTechnicianId.toString());
    const cancelledId = byTechnician.get(cancelledTechnicianId.toString());

    await request(app.getHttpServer())
      .post(`/v1/admin/settlements/${paidId}/payment`)
      .set('x-test-role', 'ADMIN')
      .send({ paymentReference: 'UTR-BEFORE-APPROVAL', successful: true })
      .expect(409);

    await request(app.getHttpServer())
      .post(`/v1/admin/settlements/${paidId}/approve`)
      .set('x-test-role', 'ADMIN')
      .send({})
      .expect(201);

    await request(app.getHttpServer())
      .post(`/v1/admin/settlements/${paidId}/payment`)
      .set('x-test-role', 'ADMIN')
      .send({ paymentReference: 'UTR-FAILED', successful: false })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/v1/admin/settlements/${paidId}/payment`)
      .set('x-test-role', 'ADMIN')
      .send({
        paymentReference: 'UTR-PAID',
        paymentMethod: 'BANK_TRANSFER',
        successful: true,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/v1/admin/settlements/${rejectedId}/reject`)
      .set('x-test-role', 'ADMIN')
      .send({ reason: 'Incorrect amount' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/v1/admin/settlements/${cancelledId}/cancel`)
      .set('x-test-role', 'ADMIN')
      .send({ reason: 'Duplicate batch' })
      .expect(201);

    await expect(settlementModel.find({}).sort({ totalEarnings: 1 }).lean()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: SettlementStatus.PAID, totalEarnings: 100 }),
        expect.objectContaining({ status: SettlementStatus.REJECTED, totalEarnings: 200 }),
        expect.objectContaining({ status: SettlementStatus.CANCELLED, totalEarnings: 300 }),
      ]),
    );
  });
});
