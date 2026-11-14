import { Types } from 'mongoose';
import { WarrantiesService } from './warranties.service';

describe('WarrantiesService returned inventory handling', () => {
  it('does not register a part warranty when all issued units were returned', async () => {
    const usage = {
      _id: new Types.ObjectId(),
      quantity: 0,
      serialNumber: 'RETURNED-UNIT',
      warrantyMonths: 12,
    };
    const populate = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([{ _id: new Types.ObjectId(), partsUsed: [usage] }]) });
    const visits = { find: jest.fn().mockReturnValue({ populate }) };
    const warranties = { findOne: jest.fn() };
    const service = new WarrantiesService(
      warranties as any,
      {} as any,
      visits as any,
      {} as any,
    );

    await expect(service.registerPartsForBooking(new Types.ObjectId().toString())).resolves.toEqual([]);
    expect(warranties.findOne).not.toHaveBeenCalled();
  });
});
