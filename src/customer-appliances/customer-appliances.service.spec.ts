import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CustomerAppliancesService } from './customer-appliances.service';
import {
  CustomerAppliance,
  CustomerApplianceSchema,
} from './schemas/customer-appliance.schema';
import {
  Booking,
  BookingDocument,
  BookingSchema,
} from '../bookings/schemas/booking.schema';
import { User, UserSchema } from '../users/schemas/user.schema';

describe('CustomerAppliancesService', () => {
  jest.setTimeout(30000);

  let service: CustomerAppliancesService;
  let bookingModel: Model<BookingDocument>;
  let mongod: MongoMemoryServer;
  let module: TestingModule;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    module = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        MongooseModule.forFeature([
          { name: CustomerAppliance.name, schema: CustomerApplianceSchema },
          { name: Booking.name, schema: BookingSchema },
          { name: User.name, schema: UserSchema },
        ]),
      ],
      providers: [CustomerAppliancesService],
    }).compile();

    service = module.get(CustomerAppliancesService);
    bookingModel = module.get(getModelToken(Booking.name));
  });

  afterAll(async () => {
    await module.close();
    await mongod.stop();
  });

  it('normalizes phone to last 10 digits', () => {
    expect(service.normalizePhone('+91 98350 09701')).toBe('9835009701');
  });

  it('maps serial to phone and preserves original phone when adding another', async () => {
    const mapped = await service.mapSerialToPhone({
      phone: '9835009701',
      serialNumber: 'wm123456789',
      brand: 'Samsung',
      source: 'ADMIN',
    });

    expect(mapped.serialNumber).toBe('WM123456789');
    expect(mapped.phones).toEqual(['9835009701']);

    const withExtra = await service.addPhoneToSerial('WM123456789', '7004771388');
    expect(withExtra.phones.sort()).toEqual(['7004771388', '9835009701']);

    const byPhone = await service.findByPhone('7004771388');
    expect(byPhone).toHaveLength(1);
    expect(byPhone[0].serialNumber).toBe('WM123456789');
  });

  it('does not create duplicate appliance identities for the same serial', async () => {
    await service.mapSerialToPhone({
      phone: '9123456789',
      serialNumber: 'AC-UNIQUE-1',
      source: 'ADMIN',
    });
    await service.mapSerialToPhone({
      phone: '9988776655',
      serialNumber: 'ac-unique-1',
      source: 'TECHNICIAN',
    });

    const found = await service.findBySerial('AC-UNIQUE-1');
    expect(found.phones.sort()).toEqual(['9123456789', '9988776655']);
  });

  it('syncs from booking product details', async () => {
    const booking = await bookingModel.create({
      userId: new Types.ObjectId(),
      serviceId: new Types.ObjectId(),
      subCategoryId: new Types.ObjectId(),
      contactPhone: '9111222333',
      status: 'PENDING',
      productDetails: {
        brand: 'LG',
        modelNumber: 'X1',
        serialNumber: 'LG-SYNC-99',
      },
      addressData: { text: 'Patna', zip: '800001' },
    });

    const synced = await service.syncFromBooking(booking.toObject(), 'ADMIN');
    expect(synced?.serialNumber).toBe('LG-SYNC-99');
    expect(synced?.phones).toContain('9111222333');
  });
});
