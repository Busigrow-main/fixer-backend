import { Types } from 'mongoose';
import { JobDispatchService } from './job-dispatch.service';

describe('JobDispatchService', () => {
  const bookingId = new Types.ObjectId().toString();
  const techA = { _id: new Types.ObjectId(), name: 'A' };
  const techB = { _id: new Types.ObjectId(), name: 'B' };

  function build(eligible: any[] = [techA, techB]) {
    const booking = {
      _id: bookingId,
      serviceId: new Types.ObjectId(),
      addressData: { zip: '400001', text: 'Test' },
      dispatchStatus: 'OPEN',
      technicianId: null,
    };

    const bookingModel: any = {
      findById: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(booking),
      }),
      findByIdAndUpdate: jest.fn().mockResolvedValue(booking),
    };
    const technicianModel: any = {
      find: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(eligible),
      }),
    };
    const serviceModel: any = {
      findById: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue({ slug: 'ac', name: 'AC' }),
          }),
        }),
      }),
    };
    const notificationDispatch: any = {
      notify: jest.fn().mockResolvedValue({}),
    };

    const service = new JobDispatchService(
      bookingModel,
      technicianModel,
      serviceModel,
      notificationDispatch,
    );

    return { service, bookingModel, technicianModel, notificationDispatch, booking };
  }

  it('broadcastJob fans out NEW_JOB to all eligible technicians', async () => {
    const { service, notificationDispatch, bookingModel } = build();
    const result = await service.broadcastJob(bookingId);

    expect(result.notified).toBe(2);
    expect(notificationDispatch.notify).toHaveBeenCalledTimes(2);
    expect(notificationDispatch.notify).toHaveBeenCalledWith(
      techA._id.toString(),
      'NEW_JOB',
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ bookingId }),
    );
    expect(bookingModel.findByIdAndUpdate).toHaveBeenCalledWith(
      bookingId,
      expect.objectContaining({
        dispatchStatus: 'OPEN',
        notifiedTechnicianIds: [techA._id, techB._id],
      }),
    );
    // 10-minute claim window
    const updateArg = bookingModel.findByIdAndUpdate.mock.calls[0][1];
    const ttlMs =
      new Date(updateArg.dispatchExpiresAt).getTime() - new Date(updateArg.dispatchedAt).getTime();
    expect(ttlMs).toBe(10 * 60 * 1000);
  });

  it('escalateUnclaimedJobs marks OPEN past-TTL jobs as NEEDS_ADMIN', async () => {
    const past = new Date(Date.now() - 1000);
    const openBooking = {
      _id: bookingId,
      dispatchStatus: 'OPEN',
      technicianId: null,
      dispatchExpiresAt: past,
      status: 'PENDING',
      addressData: { zip: '400001' },
    };

    const bookingModel: any = {
      find: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([openBooking]),
      }),
      findOneAndUpdate: jest.fn().mockResolvedValue({
        ...openBooking,
        dispatchStatus: 'NEEDS_ADMIN',
        _id: bookingId,
      }),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      countDocuments: jest.fn(),
    };
    const technicianModel: any = { find: jest.fn() };
    const serviceModel: any = { findById: jest.fn() };
    const notificationDispatch: any = { notify: jest.fn() };

    const service = new JobDispatchService(
      bookingModel,
      technicianModel,
      serviceModel,
      notificationDispatch,
    );

    const count = await service.escalateUnclaimedJobs();
    expect(count).toBe(1);
    expect(bookingModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ dispatchStatus: 'OPEN', technicianId: null }),
      expect.objectContaining({ dispatchStatus: 'NEEDS_ADMIN' }),
      expect.any(Object),
    );
  });

  it('broadcastJob returns 0 when booking missing', async () => {
    const { service, bookingModel, notificationDispatch } = build([]);
    bookingModel.findById = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });
    const result = await service.broadcastJob(bookingId);
    expect(result.notified).toBe(0);
    expect(notificationDispatch.notify).not.toHaveBeenCalled();
  });

  it('findEligibleTechnicians queries by pin + categories + available', async () => {
    const { service, technicianModel } = build();
    await service.findEligibleTechnicians({
      serviceId: new Types.ObjectId(),
      addressData: { zip: '400001' },
    });

    expect(technicianModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        isActive: true,
        availabilityStatus: 'AVAILABLE',
        idVerified: true,
        $or: [{ serviceAreas: '400001' }, { pincode: '400001' }],
      }),
    );
  });
});
