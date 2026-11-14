import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Lead } from './schemas/lead.schema';
import { LeadsService } from './leads.service';

describe('LeadsService', () => {
  let service: LeadsService;
  const leadModel = {
    create: jest.fn(),
    find: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadsService,
        { provide: getModelToken(Lead.name), useValue: leadModel },
      ],
    }).compile();

    service = module.get(LeadsService);
  });

  it('creates a lead for the authenticated user', async () => {
    const dto = { type: 'BUSINESS', name: 'Repair Shop' } as any;
    const created = { ...dto, userId: 'user-1' };
    leadModel.create.mockResolvedValue(created);

    await expect(service.create(dto, 'user-1')).resolves.toBe(created);
    expect(leadModel.create).toHaveBeenCalledWith({ ...dto, userId: 'user-1' });
  });

  it('lists leads newest first', async () => {
    const rows = [{ _id: 'lead-1' }];
    const exec = jest.fn().mockResolvedValue(rows);
    const sort = jest.fn().mockReturnValue({ exec });
    leadModel.find.mockReturnValue({ sort });

    await expect(service.findAll()).resolves.toBe(rows);
    expect(leadModel.find).toHaveBeenCalledWith();
    expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
  });
});
