import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { LeadsService } from './leads.service';
import { Lead } from './schemas/lead.schema';

describe('LeadsService', () => {
  let service: LeadsService;
  const exec = jest.fn();
  const sort = jest.fn(() => ({ exec }));
  const leadModel = {
    create: jest.fn(async (doc: unknown) => doc),
    find: jest.fn(() => ({ sort })),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [LeadsService, { provide: getModelToken(Lead.name), useValue: leadModel }],
    }).compile();

    service = module.get(LeadsService);
  });

  it('creates a lead owned by the given user', async () => {
    const dto = { name: 'Test Lead' } as any;
    const result = await service.create(dto, 'user-1');

    expect(leadModel.create).toHaveBeenCalledWith({ name: 'Test Lead', userId: 'user-1' });
    expect(result).toEqual({ name: 'Test Lead', userId: 'user-1' });
  });

  it('lists leads newest first', async () => {
    exec.mockResolvedValueOnce([{ name: 'b' }, { name: 'a' }]);
    const result = await service.findAll();

    expect(leadModel.find).toHaveBeenCalledWith();
    expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(result).toEqual([{ name: 'b' }, { name: 'a' }]);
  });
});
