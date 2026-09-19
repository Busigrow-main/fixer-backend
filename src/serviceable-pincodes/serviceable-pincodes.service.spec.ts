import { Test, TestingModule } from '@nestjs/testing';
import { ServiceablePincodesService } from './serviceable-pincodes.service';

describe('ServiceablePincodesService', () => {
  let service: ServiceablePincodesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ServiceablePincodesService],
    }).compile();

    service = module.get<ServiceablePincodesService>(ServiceablePincodesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
