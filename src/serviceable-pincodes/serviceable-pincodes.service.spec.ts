import { Test, TestingModule } from '@nestjs/testing';
import { ServiceablePincodesService } from './serviceable-pincodes.service';
import { getModelToken } from '@nestjs/mongoose';
import { ServiceablePincode } from './schemas/serviceable-pincode.schema';

describe('ServiceablePincodesService', () => {
  let service: ServiceablePincodesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceablePincodesService,
        { provide: getModelToken(ServiceablePincode.name), useValue: {} },
      ],
    }).compile();

    service = module.get<ServiceablePincodesService>(ServiceablePincodesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
