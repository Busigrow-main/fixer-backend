import { ConflictException } from '@nestjs/common';
import { Types } from 'mongoose';
import { TechnicianJobsService } from '../jobs/technician-jobs.service';

describe('TechnicianJobsService claim + available (mocked)', () => {
  const technicianId = new Types.ObjectId().toString();
  const bookingId = new Types.ObjectId().toString();

  function buildService(overrides: {
    findOneAndUpdateResult?: any;
    tech?: any;
    booking?: any;
  }) {
    const tech = overrides.tech ?? {
      _id: technicianId,
      isActive: true,
      availabilityStatus: 'AVAILABLE',
      idVerified: true,
      pincode: '400001',
      serviceAreas: ['400001'],
      serviceCategories: ['ac-repair'],
      skills: ['ac-repair'],
    };

    const booking = overrides.booking ?? {
      _id: bookingId,
      dispatchStatus: 'OPEN',
      technicianId: null,
      addressData: { zip: '400001', text: 'Andheri' },
      serviceId: { slug: 'ac', name: 'Air Conditioner' },
      status: 'PENDING',
      notifiedTechnicianIds: [new Types.ObjectId(technicianId)],
    };

    const bookingModel: any = {
      findById: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(booking),
        }),
        exec: jest.fn().mockResolvedValue(booking),
      }),
      findOneAndUpdate: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(overrides.findOneAndUpdateResult ?? null),
          }),
        }),
      }),
      find: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            sort: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue([booking]),
            }),
          }),
        }),
      }),
      updateMany: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
    };

    const bookingsService: any = {
      findOne: jest.fn(),
      updateStatus: jest.fn(),
    };
    const techniciansService: any = {
      findOne: jest.fn().mockResolvedValue(tech),
      update: jest.fn(),
    };
    const jobDispatch: any = {
      expireIfNeeded: jest.fn().mockResolvedValue(false),
      escalateUnclaimedJobs: jest.fn().mockResolvedValue(0),
      notifyJobTaken: jest.fn().mockResolvedValue(undefined),
      resolveCategorySlugs: jest.fn().mockResolvedValue(['ac-repair']),
      broadcastJob: jest.fn().mockResolvedValue({ notified: 1 }),
    };

    const service = new TechnicianJobsService(
      bookingsService,
      techniciansService,
      jobDispatch,
      bookingModel,
    );

    return { service, bookingModel, jobDispatch, tech, booking };
  }

  it('listAvailableJobs returns open jobs matching pincode + category', async () => {
    const { service } = buildService({});
    const jobs = await service.listAvailableJobs(technicianId);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]._id).toBe(bookingId);
  });

  it('claimJob succeeds when findOneAndUpdate returns the booking', async () => {
    const claimed = {
      _id: bookingId,
      dispatchStatus: 'CLAIMED',
      technicianId: technicianId,
      assignmentStatus: 'ACCEPTED',
      status: 'ASSIGNED',
      addressData: { zip: '400001' },
      toObject() {
        return this;
      },
    };
    const { service, bookingModel, jobDispatch } = buildService({
      findOneAndUpdateResult: claimed,
    });

    const result = await service.claimJob(technicianId, bookingId);
    expect(result.status).toBe('ASSIGNED');
    expect(bookingModel.findOneAndUpdate).toHaveBeenCalled();
    expect(jobDispatch.notifyJobTaken).toHaveBeenCalled();
  });

  it('claimJob throws ConflictException when another tech already claimed', async () => {
    const { service } = buildService({ findOneAndUpdateResult: null });
    await expect(service.claimJob(technicianId, bookingId)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('rejectJob rebroadcasts the job', async () => {
    const booking = {
      _id: bookingId,
      technicianId: technicianId,
      assignmentStatus: 'PENDING_ACCEPTANCE',
    };
    const { service, jobDispatch, bookingModel } = buildService({ booking });
    bookingModel.findById = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(booking),
    });
    bookingModel.findByIdAndUpdate = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue({ ...booking, dispatchStatus: 'OPEN' }),
    });

    await service.rejectJob(technicianId, bookingId, 'Busy today');
    expect(jobDispatch.broadcastJob).toHaveBeenCalledWith(bookingId);
  });
});
