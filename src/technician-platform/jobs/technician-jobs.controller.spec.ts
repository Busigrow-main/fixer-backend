import { RequestMethod } from '@nestjs/common';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { TechnicianGuard } from '../common/technician.guard';
import { TechnicianJobsController } from './technician-jobs.controller';

describe('TechnicianJobsController part transaction history', () => {
  it('binds the endpoint to the technician from the guarded request', async () => {
    const visitsService = { listPartInventoryTransactions: jest.fn().mockResolvedValue({ data: [] }) };
    const controller = new TechnicianJobsController({} as any, {} as any, {} as any, visitsService as any);
    const technician = { _id: { toString: () => 'technician-from-auth' } };

    await controller.listPartTransactions(technician, '2', '25');

    expect(visitsService.listPartInventoryTransactions).toHaveBeenCalledWith(
      'technician-from-auth',
      '2',
      '25',
    );
  });

  it('is a GET route protected by JWT authentication and TechnicianGuard', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, TechnicianJobsController) as Function[];
    const handler = TechnicianJobsController.prototype.listPartTransactions;

    expect(guards).toHaveLength(2);
    expect(guards.some((guard) => guard === TechnicianGuard)).toBe(true);
    expect(guards.some((guard) => guard !== TechnicianGuard && typeof guard === 'function')).toBe(true);
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('part-transactions');
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.GET);
  });
});
