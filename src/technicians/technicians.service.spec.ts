import { Types } from 'mongoose';
import { TechniciansService } from './technicians.service';

describe('TechniciansService – availability helpers', () => {
  const technicianId = new Types.ObjectId().toString();

  function build() {
    const technicianModel: any = {
      updateOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      }),
      findByIdAndUpdate: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: technicianId, isActive: false }),
      }),
    };
    const bookingModel: any = {
      exists: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
      countDocuments: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(7) }),
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

  it('hasActiveJob ignores cancelled/completed/rescheduled/declined bookings and can exclude one booking', async () => {
    const { service, bookingModel } = build();
    const excludeId = new Types.ObjectId().toString();

    await expect(service.hasActiveJob(technicianId, excludeId)).resolves.toBe(false);

    const filter = bookingModel.exists.mock.calls[0][0];
    expect(String(filter.technicianId)).toBe(technicianId);
    expect(filter.status.$nin).toEqual([
      'CANCELLED',
      'COMPLETED',
      'PAYMENT_COLLECTED',
      'RESCHEDULED',
    ]);
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

  it('recountCompletedJobs stores the real number of completed bookings', async () => {
    const { service, technicianModel, bookingModel } = build();

    await expect(service.recountCompletedJobs(technicianId)).resolves.toBe(7);

    const filter = bookingModel.countDocuments.mock.calls[0][0];
    expect(filter.status).toEqual({ $in: ['COMPLETED', 'PAYMENT_COLLECTED'] });
    expect(technicianModel.updateOne).toHaveBeenCalledWith(
      { _id: technicianId },
      { $set: { totalCompletedJobs: 7 } },
    );
  });

  it('deactivate is refused while the technician holds an open job', async () => {
    const { service, technicianModel, bookingModel } = build();
    bookingModel.exists.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ _id: new Types.ObjectId() }),
    });

    await expect(service.deactivate(technicianId)).rejects.toThrow(/open job/);
    expect(technicianModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('deactivate works when the technician has no open job', async () => {
    const { service, technicianModel } = build();

    await service.deactivate(technicianId);

    expect(technicianModel.findByIdAndUpdate).toHaveBeenCalledWith(
      technicianId,
      { isActive: false },
      expect.any(Object),
    );
  });
});
