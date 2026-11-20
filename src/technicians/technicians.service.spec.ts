import { Types } from 'mongoose';
import { TechniciansService } from './technicians.service';

describe('TechniciansService – availability helpers', () => {
  const technicianId = new Types.ObjectId().toString();

  function build() {
    const technicianModel: any = {
      updateOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      }),
    };
    const bookingModel: any = {
      exists: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
    };
    const service = new TechniciansService(technicianModel, bookingModel, {} as any);
    return { service, technicianModel, bookingModel };
  }

  it('releaseFromJob only flips ON_JOB to AVAILABLE (off-duty UNAVAILABLE is kept)', async () => {
    const { service, technicianModel } = build();

    await expect(service.releaseFromJob(technicianId)).resolves.toBe(true);

    expect(technicianModel.updateOne).toHaveBeenCalledWith(
      { _id: technicianId, availabilityStatus: 'ON_JOB' },
      { $set: { availabilityStatus: 'AVAILABLE' } },
    );
  });

  it('hasActiveJob ignores cancelled/completed/declined bookings and can exclude one booking', async () => {
    const { service, bookingModel } = build();
    const excludeId = new Types.ObjectId().toString();

    await expect(service.hasActiveJob(technicianId, excludeId)).resolves.toBe(false);

    const filter = bookingModel.exists.mock.calls[0][0];
    expect(String(filter.technicianId)).toBe(technicianId);
    expect(filter.status.$nin).toEqual(['CANCELLED', 'COMPLETED', 'PAYMENT_COLLECTED']);
    expect(filter.assignmentStatus).toEqual({ $ne: 'DECLINED' });
    expect(String(filter._id.$ne)).toBe(excludeId);
  });

  it('hasActiveJob is true when an open booking exists', async () => {
    const { service, bookingModel } = build();
    bookingModel.exists.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ _id: new Types.ObjectId() }),
    });

    await expect(service.hasActiveJob(technicianId)).resolves.toBe(true);
  });
});
