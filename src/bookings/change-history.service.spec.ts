import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Model, Types } from 'mongoose';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Booking, BookingDocument, BookingSchema } from './schemas/booking.schema';
import { BookingsService } from './bookings.service';

describe('BookingsService change history', () => {
  jest.setTimeout(60000);

  let service: BookingsService;
  let bookingModel: Model<BookingDocument>;
  let mongod: MongoMemoryServer;
  let module: TestingModule;
  let bookingId: string;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    module = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        MongooseModule.forFeature([
          { name: Booking.name, schema: BookingSchema },
          { name: User.name, schema: UserSchema },
        ]),
      ],
      providers: [
        {
          provide: BookingsService,
          useFactory: (model: Model<BookingDocument>) => {
            const svc = Object.create(BookingsService.prototype);
            svc.bookingModel = model;
            svc.populateBookingDetail = async (id: string) =>
              model.findById(id).lean().exec();
            return svc as BookingsService;
          },
          inject: [getModelToken(Booking.name)],
        },
      ],
    }).compile();

    service = module.get(BookingsService);
    bookingModel = module.get(getModelToken(Booking.name));
    await bookingModel.init();
  });

  afterAll(async () => {
    if (module) await module.close();
    if (mongod) await mongod.stop();
  });

  beforeEach(async () => {
    await bookingModel.deleteMany({});
    const booking = await bookingModel.create({
      userId: new Types.ObjectId(),
      serviceId: new Types.ObjectId(),
      subCategoryId: new Types.ObjectId(),
      contactPhone: '9876543210',
      addressData: { zip: '800001', text: 'Patna' },
      status: 'CONFIRMED',
      invoiceData: { serviceTotal: 499 },
    });
    bookingId = String(booking._id);
  });

  it('appends corrections instead of overwriting prior history events', async () => {
    await service.appendChangeHistory(bookingId, [
      {
        field: 'invoice.serviceTotal',
        previous: 499,
        next: 699,
        actorRole: 'ADMIN',
        actorId: String(new Types.ObjectId()),
        reason: 'Extra labour',
      },
    ]);
    await service.appendChangeHistory(bookingId, [
      {
        field: 'invoice.serviceTotal',
        previous: 699,
        next: 599,
        actorRole: 'ADMIN',
        actorId: String(new Types.ObjectId()),
        reason: 'Correction',
      },
    ]);

    const history = await service.getChangeHistory(bookingId);
    expect(history.total).toBe(2);
    expect(history.data[0].next).toBe(599);
    expect(history.data[1].next).toBe(699);
    expect(history.data[0].reason).toBe('Correction');
  });

  it('records service property changes with previous and next values', async () => {
    await service.updateServiceProperties(
      bookingId,
      { paymentStatus: 'PAID_CASH' },
      { actorRole: 'ADMIN', actorId: String(new Types.ObjectId()) },
    );
    const history = await service.getChangeHistory(bookingId);
    expect(history.total).toBe(1);
    expect(history.data[0].field).toBe('paymentStatus');
    expect(history.data[0].previous).toBe('UNPAID');
    expect(history.data[0].next).toBe('PAID_CASH');
  });
});
