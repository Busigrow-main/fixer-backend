import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BookingsService } from './bookings.service';
import { Booking, BookingSchema, BookingDocument } from './schemas/booking.schema';
import { Service, ServiceSchema, ServiceDocument } from '../services/schemas/service.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Technician, TechnicianSchema } from '../technicians/schemas/technician.schema';
import { WarrantiesService } from '../warranties/warranties.service';
import { JobDispatchService } from '../technician-platform/dispatch/job-dispatch.service';
import { NotificationDispatchService } from '../technician-platform/common/notification-dispatch.service';
import { VisitsService } from '../visits/visits.service';
import { CustomerAppliancesService } from '../customer-appliances/customer-appliances.service';
import { ServiceablePincodesService } from '../serviceable-pincodes/serviceable-pincodes.service';
import { TechnicianEngineService } from '../technician-engine/technician-engine.service';
import { GstService } from '../gst/gst.service';
import { issueFixxerCode } from './fixxer-code';

process.env.FIXXER_CODE_KEY = Buffer.alloc(32, 7).toString('base64');

describe('BookingsService – State Machine', () => {
  jest.setTimeout(30000);

  let service: BookingsService;
  let bookingModel: Model<BookingDocument>;
  let mongod: MongoMemoryServer;
  let module: TestingModule;

  const mockWarranties = { create: jest.fn().mockResolvedValue({}), findByBooking: jest.fn().mockResolvedValue([]), registerPartsForBooking: jest.fn(), listInstalledParts: jest.fn().mockResolvedValue([]), listOriginalPartsForClaim: jest.fn().mockResolvedValue([]) };
  const mockDispatch = { broadcastJob: jest.fn() };
  const mockNotification = { notify: jest.fn() };
  const mockVisits = {
    findByBooking: jest.fn().mockResolvedValue([]),
    correctCatalogCost: jest.fn(async (usage: any) => Number(usage?.cost) || 0),
  };
  const mockTechnicianEngine = {
    onAdminAssigned: jest.fn().mockImplementation(async ({ technicianId, previousTechnicianId }) => {
      const techModel = module.get(getModelToken(Technician.name)) as Model<any>;
      await techModel.findByIdAndUpdate(technicianId, { availabilityStatus: 'ON_JOB' });
      if (previousTechnicianId && previousTechnicianId !== String(technicianId)) {
        await techModel.findByIdAndUpdate(previousTechnicianId, {
          availabilityStatus: 'AVAILABLE',
        });
      }
    }),
    markAvailable: jest.fn().mockImplementation(async (technicianId: string) => {
      const techModel = module.get(getModelToken(Technician.name)) as Model<any>;
      await techModel.updateOne(
        { _id: technicianId, availabilityStatus: 'ON_JOB' },
        { availabilityStatus: 'AVAILABLE' },
      );
      return 'AVAILABLE';
    }),
    markOnJob: jest.fn().mockImplementation(async (technicianId: string) => {
      const techModel = module.get(getModelToken(Technician.name)) as Model<any>;
      await techModel.findByIdAndUpdate(technicianId, { availabilityStatus: 'ON_JOB' });
      return 'ON_JOB';
    }),
    onJobCancelled: jest.fn().mockImplementation(async (technicianId: string) => {
      const techModel = module.get(getModelToken(Technician.name)) as Model<any>;
      await techModel.findByIdAndUpdate(technicianId, { availabilityStatus: 'AVAILABLE' });
      return 'AVAILABLE';
    }),
    applyJobEvent: jest.fn(),
    applyStatusStepAvailability: jest.fn(),
  };

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    module = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        MongooseModule.forFeature([
          { name: Booking.name, schema: BookingSchema },
          { name: Service.name, schema: ServiceSchema },
          { name: User.name, schema: UserSchema },
          { name: Technician.name, schema: TechnicianSchema },
        ]),
      ],
      providers: [
        BookingsService,
        GstService,
        { provide: TechnicianEngineService, useValue: mockTechnicianEngine },
        { provide: WarrantiesService, useValue: mockWarranties },
        { provide: JobDispatchService, useValue: mockDispatch },
        { provide: NotificationDispatchService, useValue: mockNotification },
        { provide: VisitsService, useValue: mockVisits },
        { provide: CustomerAppliancesService, useValue: { syncFromBooking: jest.fn(), linkBookingByPhone: jest.fn().mockResolvedValue([]) } },
        { provide: ServiceablePincodesService, useValue: { isServiceable: jest.fn().mockResolvedValue(true) } },
      ],
    }).compile();

    service = module.get(BookingsService);
    bookingModel = module.get(getModelToken(Booking.name));
  });

  afterAll(async () => {
    await module.close();
    await mongod.stop();
  });

  let serviceDoc: any;
  beforeEach(async () => {
    await bookingModel.deleteMany({});
    const serviceModel = module.get<Model<ServiceDocument>>(getModelToken(Service.name));
    await serviceModel.deleteMany({});
    serviceDoc = await serviceModel.create({
      slug: 'test',
      name: 'Test',
      title: 'Test',
      startingPrice: '₹100',
      icon: 'i',
      image: 'i',
      description: 'd',
      subCategories: [{ _id: new Types.ObjectId(), name: 'Sub', price: '₹100', priceNumeric: 10000 }],
    });
  });

  async function createBooking(overrides: any = {}) {
    return bookingModel.create({
      userId: new Types.ObjectId(),
      serviceId: serviceDoc._id,
      subCategoryId: serviceDoc.subCategories[0]._id,
      contactPhone: '9999999999',
      addressData: { zip: '110001', text: 'Test' },
      status: 'IN_PROGRESS',
      ...overrides,
    });
  }

  async function sealCode(booking: { _id: Types.ObjectId }) {
    const issued = issueFixxerCode();
    await bookingModel.findByIdAndUpdate(booking._id, {
      ...issued.fields,
      technicianId: new Types.ObjectId(),
    });
    return issued.code;
  }

  it('tech can write in IN_PROGRESS', async () => {
    const b = await createBooking();
    await expect(
      service.updateJobDetails(b._id.toString(), { diagnosis: 'test' }, 'TECHNICIAN'),
    ).resolves.toBeDefined();
  });

  it('tech rejected after finalize (locked)', async () => {
    const b = await createBooking();
    const code = await sealCode(b);
    await service.finalizeInvoice(b._id.toString(), code);
    await expect(
      service.updateJobDetails(b._id.toString(), { diagnosis: 'nope' }, 'TECHNICIAN'),
    ).rejects.toThrow('locked');
  });

  it('admin can still write after finalize', async () => {
    const b = await createBooking();
    const code = await sealCode(b);
    await service.finalizeInvoice(b._id.toString(), code);
    await expect(
      service.updateJobDetails(b._id.toString(), { diagnosis: 'admin fix' }, 'ADMIN'),
    ).resolves.toBeDefined();
  });

  it('admin unlock re-enables tech writes', async () => {
    const b = await createBooking();
    const code = await sealCode(b);
    await service.finalizeInvoice(b._id.toString(), code);

    await service.unlockSheet(b._id.toString());

    // Need to set status back to IN_PROGRESS for tech to write
    await bookingModel.findByIdAndUpdate(b._id, { status: 'IN_PROGRESS', isBilled: false, jobClosed: false });

    await expect(
      service.updateJobDetails(b._id.toString(), { diagnosis: 'tech again' }, 'TECHNICIAN'),
    ).resolves.toBeDefined();
  });

  it('finalizeInvoice sets sheetLockedAt and isBilled', async () => {
    const b = await createBooking();
    const code = await sealCode(b);
    await service.finalizeInvoice(b._id.toString(), code);
    const doc = await bookingModel.findById(b._id).lean().exec();
    expect(doc!.sheetLockedAt).toBeInstanceOf(Date);
    expect(doc!.sheetLockedBy).toBe('SYSTEM');
    expect(doc!.isBilled).toBe(true);
    expect(doc!.status).toBe('COMPLETED');
  });

  async function createEligibleTech(overrides: Record<string, unknown> = {}) {
    const techModel = module.get(getModelToken(Technician.name)) as Model<any>;
    return techModel.create({
      name: 'Tech',
      phone: String(9000000000 + Math.floor(Math.random() * 99999999)),
      skills: ['ac'],
      availabilityStatus: 'AVAILABLE',
      isActive: true,
      ...overrides,
    });
  }

  it('assignment stores an encrypted FIXXER CODE and close requires it', async () => {
    const userId = new Types.ObjectId();
    const b = await createBooking({ userId, status: 'CONFIRMED' });
    const techA = (await createEligibleTech())._id.toString();
    const techB = (await createEligibleTech())._id.toString();

    await service.assignTechnician(b._id.toString(), techA);
    const first = await bookingModel.findById(b._id).lean().exec();
    const list = await service.findAllByUser(userId.toString());
    expect(list[0].fixxerCode).toMatch(/^\d{6}$/);
    expect(list[0].fixxerCodeCiphertext).toBeUndefined();
    expect(first!.fixxerCodeCiphertext).toBeTruthy();
    expect(first!.fixxerCodeCiphertext).not.toContain(list[0].fixxerCode);

    const adminView = await service.populateBookingDetail(b._id.toString());
    expect(adminView.fixxerCode).toBeUndefined();
    expect(adminView.fixxerCodeCiphertext).toBeUndefined();

    await service.assignTechnician(b._id.toString(), techA);
    const kept = await bookingModel.findById(b._id).lean().exec();
    expect(kept!.fixxerCodeCiphertext).toBe(first!.fixxerCodeCiphertext);

    await service.assignTechnician(b._id.toString(), techB);
    const rotated = await bookingModel.findById(b._id).lean().exec();
    expect(rotated!.fixxerCodeCiphertext).not.toBe(first!.fixxerCodeCiphertext);
    const after = await service.findAllByUser(userId.toString());
    const wrong = after[0].fixxerCode.replace(/.$/, (digit: string) => (digit === '0' ? '1' : '0'));

    await expect(
      service.finalizeInvoice(b._id.toString(), wrong),
    ).rejects.toThrow('does not match');
    await service.finalizeInvoice(b._id.toString(), after[0].fixxerCode);
    const closed = await service.findAllByUser(userId.toString());
    expect(closed[0].fixxerCode).toBeUndefined();
    expect(closed[0].status).toBe('COMPLETED');
  });

  it('rejects finalize and COMPLETED when the code is missing, wrong, or not issued', async () => {
    const bare = await createBooking();
    await expect(service.finalizeInvoice(bare._id.toString(), '123456')).rejects.toThrow(
      'Assign a technician',
    );
    expect((await bookingModel.findById(bare._id).lean().exec())!.status).toBe('IN_PROGRESS');

    const issued = await createBooking({ technicianId: new Types.ObjectId() });
    await expect(service.finalizeInvoice(issued._id.toString(), '123456')).rejects.toThrow(
      'has not been issued',
    );
    await expect(
      service.updateStatus(issued._id.toString(), 'COMPLETED', undefined, '123456'),
    ).rejects.toThrow('has not been issued');
    expect((await bookingModel.findById(issued._id).lean().exec())!.status).toBe('IN_PROGRESS');

    const code = await sealCode(issued);
    const wrong = code.replace(/.$/, (digit) => (digit === '0' ? '1' : '0'));
    await expect(
      service.updateStatus(issued._id.toString(), 'COMPLETED', undefined, wrong),
    ).rejects.toThrow('does not match');
    await expect(
      service.updateStatus(issued._id.toString(), 'COMPLETED', undefined, ''),
    ).rejects.toThrow('does not match');
    expect((await bookingModel.findById(issued._id).lean().exec())!.status).toBe('IN_PROGRESS');

    await service.updateStatus(issued._id.toString(), 'COMPLETED', undefined, ` ${code.slice(0, 3)} ${code.slice(3)} `);
    const doc = await bookingModel.findById(issued._id).lean().exec();
    expect(doc!.status).toBe('COMPLETED');
    expect(doc!.fixxerCodeVerifiedAt).toBeInstanceOf(Date);
    expect((doc as any).fixxerCode).toBeUndefined(); // plaintext code must never be persisted

    await service.requireFixxerCode(issued._id.toString());
  });

  it('assignTechnician sets the tech ON_JOB and frees the previous tech', async () => {
    const techModel = module.get(getModelToken(Technician.name)) as Model<any>;
    await techModel.deleteMany({});
    const techA = await createEligibleTech({ name: 'Tech A', phone: '9000000001' });
    const techB = await createEligibleTech({ name: 'Tech B', phone: '9000000002' });

    const b = await createBooking({ status: 'CONFIRMED' });
    await service.assignTechnician(b._id.toString(), techA._id.toString());
    expect((await techModel.findById(techA._id).lean().exec())!.availabilityStatus).toBe(
      'ON_JOB',
    );

    await service.assignTechnician(b._id.toString(), techB._id.toString());
    expect((await techModel.findById(techA._id).lean().exec())!.availabilityStatus).toBe(
      'AVAILABLE',
    );
    expect((await techModel.findById(techB._id).lean().exec())!.availabilityStatus).toBe(
      'ON_JOB',
    );
  });

  it('clears the code when the assignment is removed', async () => {
    const userId = new Types.ObjectId();
    const b = await createBooking({ userId, status: 'CONFIRMED' });
    const tech = await createEligibleTech();
    await service.assignTechnician(b._id.toString(), tech._id.toString());
    expect((await service.findAllByUser(userId.toString()))[0].fixxerCode).toMatch(/^\d{6}$/);

    await service.clearAssignmentCode(b._id.toString());
    const doc = await bookingModel.findById(b._id).lean().exec();
    expect(doc!.fixxerCodeCiphertext).toBeUndefined();
    expect(doc!.fixxerCodeIv).toBeUndefined();
    expect(doc!.fixxerCodeAuthTag).toBeUndefined();
    expect(doc!.fixxerCodeVerifiedAt).toBeUndefined();
    expect((await service.findAllByUser(userId.toString()))[0].fixxerCode).toBeUndefined();
    const adminView = await service.populateBookingDetail(b._id.toString());
    expect(adminView.fixxerCodeIv).toBeUndefined();
    expect(adminView.fixxerCodeAuthTag).toBeUndefined();
  });

  it('normalizes lowercase completed so FIXXER CODE is still required', async () => {
    const issued = await createBooking({ technicianId: new Types.ObjectId() });
    const code = await sealCode(issued);
    await expect(
      service.updateStatus(issued._id.toString(), 'completed', undefined, '000000'),
    ).rejects.toThrow('does not match');
    expect((await bookingModel.findById(issued._id).lean().exec())!.status).toBe('IN_PROGRESS');

    await service.updateStatus(issued._id.toString(), 'completed', undefined, code);
    const doc = await bookingModel.findById(issued._id).lean().exec();
    expect(doc!.status).toBe('COMPLETED');
    expect(doc!.fixxerCodeVerifiedAt).toBeInstanceOf(Date);
  });

  it('rejects assign on cancelled/completed jobs and ineligible technicians', async () => {
    const tech = await createEligibleTech();
    const cancelled = await createBooking({ status: 'CANCELLED' });
    await expect(
      service.assignTechnician(cancelled._id.toString(), tech._id.toString()),
    ).rejects.toThrow(/cancelled or completed/i);

    const completed = await createBooking({ status: 'COMPLETED' });
    await expect(
      service.assignTechnician(completed._id.toString(), tech._id.toString()),
    ).rejects.toThrow(/cancelled or completed/i);

    const open = await createBooking({ status: 'CONFIRMED' });
    await expect(
      service.assignTechnician(open._id.toString(), new Types.ObjectId().toString()),
    ).rejects.toThrow(/not found/i);

    const inactive = await createEligibleTech({ isActive: false });
    await expect(
      service.assignTechnician(open._id.toString(), inactive._id.toString()),
    ).rejects.toThrow(/not active and available/i);

    const onJob = await createEligibleTech({ availabilityStatus: 'ON_JOB' });
    await createBooking({ status: 'ASSIGNED', technicianId: onJob._id });
    await expect(
      service.assignTechnician(open._id.toString(), onJob._id.toString()),
    ).rejects.toThrow(/not active and available/i);
  });

  describe('technician is released when a job is cancelled', () => {
    const techModel = () => module.get(getModelToken(Technician.name)) as Model<any>;
    const availability = async (id: Types.ObjectId) =>
      (await techModel().findById(id).lean().exec())!.availabilityStatus;

    it('admin cancel frees the technician so they can be assigned to the next job', async () => {
      const tech = await createEligibleTech();
      const first = await createBooking({ status: 'CONFIRMED' });
      await service.assignTechnician(first._id.toString(), tech._id.toString());
      expect(await availability(tech._id)).toBe('ON_JOB');

      await service.updateStatus(first._id.toString(), 'CANCELLED', 'Customer not home');
      expect(await availability(tech._id)).toBe('AVAILABLE');

      const next = await createBooking({ status: 'CONFIRMED' });
      await service.assignTechnician(next._id.toString(), tech._id.toString());
      const doc = await bookingModel.findById(next._id).lean().exec();
      expect(String(doc!.technicianId)).toBe(String(tech._id));
      expect(await availability(tech._id)).toBe('ON_JOB');
    });

    it('customer cancel frees the technician', async () => {
      const tech = await createEligibleTech();
      const userId = new Types.ObjectId();
      const b = await createBooking({ userId, status: 'CONFIRMED' });
      await service.assignTechnician(b._id.toString(), tech._id.toString());

      await service.cancelBooking(b._id.toString(), userId.toString(), 'Changed my mind');
      expect(await availability(tech._id)).toBe('AVAILABLE');
    });

    it('does not free a technician who is still on another active job', async () => {
      const tech = await createEligibleTech({ availabilityStatus: 'ON_JOB' });
      await createBooking({ status: 'IN_PROGRESS', technicianId: tech._id });
      const cancelled = await createBooking({ status: 'ASSIGNED', technicianId: tech._id });

      await service.updateStatus(cancelled._id.toString(), 'CANCELLED', 'Duplicate booking');
      expect(await availability(tech._id)).toBe('ON_JOB');
    });

    it('heals a technician left ON_JOB by an old cancelled job and assigns them', async () => {
      const tech = await createEligibleTech({ availabilityStatus: 'ON_JOB' });
      await createBooking({ status: 'CANCELLED', technicianId: tech._id });

      const next = await createBooking({ status: 'CONFIRMED' });
      await service.assignTechnician(next._id.toString(), tech._id.toString());
      const doc = await bookingModel.findById(next._id).lean().exec();
      expect(String(doc!.technicianId)).toBe(String(tech._id));
    });
  });

  describe('admin-managed flows keep technician availability correct', () => {
    const techModel = () => module.get(getModelToken(Technician.name)) as Model<any>;
    const availability = async (id: Types.ObjectId) =>
      (await techModel().findById(id).lean().exec())!.availabilityStatus;

    it('RESCHEDULED frees the technician but keeps them linked to the booking', async () => {
      const tech = await createEligibleTech();
      const b = await createBooking({ status: 'CONFIRMED' });
      await service.assignTechnician(b._id.toString(), tech._id.toString());

      await service.updateStatus(b._id.toString(), 'RESCHEDULED', 'Customer moved to next week');

      expect(await availability(tech._id)).toBe('AVAILABLE');
      const doc = await bookingModel.findById(b._id).lean().exec();
      expect(String(doc!.technicianId)).toBe(String(tech._id));

      // ...and is assignable to other work meanwhile.
      const other = await createBooking({ status: 'CONFIRMED' });
      await service.assignTechnician(other._id.toString(), tech._id.toString());
      expect(await availability(tech._id)).toBe('ON_JOB');
    });

    it('re-activating a RESCHEDULED booking marks the technician busy if they are free', async () => {
      const tech = await createEligibleTech();
      const b = await createBooking({ status: 'CONFIRMED' });
      await service.assignTechnician(b._id.toString(), tech._id.toString());
      await service.updateStatus(b._id.toString(), 'RESCHEDULED', 'Moved');

      await service.updateStatus(b._id.toString(), 'ASSIGNED');

      expect(await availability(tech._id)).toBe('ON_JOB');
    });

    it('re-activating a RESCHEDULED booking fails while its technician is on another job', async () => {
      const tech = await createEligibleTech();
      const b = await createBooking({ status: 'CONFIRMED' });
      await service.assignTechnician(b._id.toString(), tech._id.toString());
      await service.updateStatus(b._id.toString(), 'RESCHEDULED', 'Moved');
      const other = await createBooking({ status: 'CONFIRMED' });
      await service.assignTechnician(other._id.toString(), tech._id.toString());

      await expect(service.updateStatus(b._id.toString(), 'ASSIGNED')).rejects.toThrow(
        /another job/i,
      );
      // Re-selecting them in the dropdown is refused too.
      await expect(
        service.assignTechnician(b._id.toString(), tech._id.toString()),
      ).rejects.toThrow(/not active and available/i);
    });

    it('reassigning a rescheduled booking does not free the old technician who is on another job', async () => {
      const oldTech = await createEligibleTech();
      const newTech = await createEligibleTech();
      const b = await createBooking({ status: 'CONFIRMED' });
      await service.assignTechnician(b._id.toString(), oldTech._id.toString());
      await service.updateStatus(b._id.toString(), 'RESCHEDULED', 'Moved');
      const other = await createBooking({ status: 'CONFIRMED' });
      await service.assignTechnician(other._id.toString(), oldTech._id.toString());

      await service.assignTechnician(b._id.toString(), newTech._id.toString());

      expect(await availability(oldTech._id)).toBe('ON_JOB');
      expect(await availability(newTech._id)).toBe('ON_JOB');
    });

    it('moving an assigned job back to CONFIRMED unassigns and frees the technician', async () => {
      const tech = await createEligibleTech();
      const b = await createBooking({ status: 'CONFIRMED' });
      await service.assignTechnician(b._id.toString(), tech._id.toString());

      await service.updateStatus(b._id.toString(), 'CONFIRMED');

      const doc = await bookingModel.findById(b._id).lean().exec();
      expect(doc!.technicianId).toBeNull();
      expect(doc!.status).toBe('CONFIRMED');
      expect(doc!.fixxerCodeCiphertext).toBeUndefined();
      expect(await availability(tech._id)).toBe('AVAILABLE');
    });

    it('unassignTechnician frees the technician without cancelling the booking', async () => {
      const tech = await createEligibleTech();
      const b = await createBooking({ status: 'CONFIRMED' });
      await service.assignTechnician(b._id.toString(), tech._id.toString());

      await service.unassignTechnician(b._id.toString(), { actorRole: 'ADMIN' });

      const doc = await bookingModel.findById(b._id).lean().exec();
      expect(doc!.technicianId).toBeNull();
      expect(doc!.status).toBe('CONFIRMED');
      expect(doc!.dispatchStatus).toBe('NEEDS_ADMIN');
      expect(await availability(tech._id)).toBe('AVAILABLE');
      await expect(service.unassignTechnician(b._id.toString())).rejects.toThrow(
        /No technician/,
      );
    });

    it('unassign is refused on finished jobs', async () => {
      const done = await createBooking({ status: 'COMPLETED', technicianId: new Types.ObjectId() });
      await expect(service.unassignTechnician(done._id.toString())).rejects.toThrow(
        /cancelled or completed/,
      );
    });

    it('blocks reopening a finished job and skipping straight to PAYMENT_COLLECTED', async () => {
      const done = await createBooking({ status: 'COMPLETED', technicianId: new Types.ObjectId() });
      await expect(service.updateStatus(done._id.toString(), 'IN_PROGRESS')).rejects.toThrow(
        /Cannot move a COMPLETED booking to IN_PROGRESS/,
      );

      const running = await createBooking({ status: 'IN_PROGRESS', technicianId: new Types.ObjectId() });
      await expect(
        service.updateStatus(running._id.toString(), 'PAYMENT_COLLECTED'),
      ).rejects.toThrow(/Cannot move a IN_PROGRESS booking to PAYMENT_COLLECTED/);
    });
  });
});
