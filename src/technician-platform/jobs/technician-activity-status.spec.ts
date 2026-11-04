import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { TechnicianJobsService } from './technician-jobs.service';
import { TechnicianProfileService } from '../profile/technician-profile.service';
import { TechnicianEngineService } from '../../technician-engine/technician-engine.service';
import { JOB_STATUS_FLOW } from '../constants';

/**
 * Activity / availability / assignment status breakpoints for the technician flow.
 * Presence is `availabilityStatus` (AVAILABLE | ON_JOB | UNAVAILABLE) — there is no
 * separate activityStatus / ONLINE / OFFLINE enum.
 */
describe('Technician activity + job status flow', () => {
  const technicianId = new Types.ObjectId().toString();
  const jobId = new Types.ObjectId().toString();

  function buildJobsService(overrides: {
    booking?: Record<string, unknown>;
    tech?: Record<string, unknown>;
  } = {}) {
    const tech = {
      _id: technicianId,
      isActive: true,
      availabilityStatus: 'AVAILABLE',
      idVerified: true,
      totalCompletedJobs: 2,
      pincode: '400001',
      serviceAreas: ['400001'],
      serviceCategories: ['ac-repair'],
      skills: ['ac-repair'],
      ...overrides.tech,
    };

    const booking = {
      _id: jobId,
      technicianId,
      status: 'ASSIGNED',
      assignmentStatus: 'ACCEPTED',
      dispatchStatus: 'ADMIN_ASSIGNED',
      addressData: { zip: '400001', text: 'Andheri' },
      serviceId: { slug: 'ac', name: 'Air Conditioner' },
      ...overrides.booking,
    };

    const bookingModel: any = {
      findById: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(booking),
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(booking),
          }),
          exec: jest.fn().mockResolvedValue(booking),
        }),
      }),
      findByIdAndUpdate: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue({
              ...booking,
              toObject() {
                return this;
              },
            }),
          }),
          exec: jest.fn().mockResolvedValue({
            ...booking,
            toObject() {
              return this;
            },
          }),
        }),
        exec: jest.fn().mockResolvedValue(booking),
      }),
      findOneAndUpdate: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(null),
          }),
        }),
      }),
    };

    const bookingsService: any = {
      findOne: jest.fn(),
      updateStatus: jest.fn().mockResolvedValue({ ...booking, status: 'IN_PROGRESS' }),
      prepareAssignmentCode: jest.fn().mockReturnValue({
        code: '123456',
        fields: {
          fixxerCodeCiphertext: 'c',
          fixxerCodeIv: 'i',
          fixxerCodeAuthTag: 't',
          fixxerCodeIssuedAt: new Date(),
        },
      }),
      deliverAssignmentCode: jest.fn(),
    };

    const techniciansService: any = {
      findOne: jest.fn().mockResolvedValue(tech),
      update: jest.fn().mockImplementation((_id: string, patch: any) =>
        Promise.resolve({ ...tech, ...patch }),
      ),
    };

    const jobDispatch: any = {
      expireIfNeeded: jest.fn(),
      escalateUnclaimedJobs: jest.fn(),
      notifyJobTaken: jest.fn(),
      resolveCategorySlugs: jest.fn().mockResolvedValue(['ac-repair']),
      broadcastJob: jest.fn(),
    };

    const technicianEngine = new TechnicianEngineService(techniciansService);

    const service = new TechnicianJobsService(
      bookingsService,
      techniciansService,
      jobDispatch,
      technicianEngine,
      bookingModel,
    );

    return {
      service,
      bookingModel,
      bookingsService,
      techniciansService,
      technicianEngine,
      jobDispatch,
      tech,
      booking,
    };
  }

  describe('JOB_STATUS_FLOW contract', () => {
    it('enforces sequential ASSIGNED → EN_ROUTE → IN_PROGRESS → COMPLETED → PAYMENT_COLLECTED', () => {
      expect([...JOB_STATUS_FLOW]).toEqual([
        'ASSIGNED',
        'EN_ROUTE',
        'IN_PROGRESS',
        'COMPLETED',
        'PAYMENT_COLLECTED',
      ]);
    });
  });

  describe('accept / reject (admin-assigned path)', () => {
    it('acceptJob requires PENDING_ACCEPTANCE and sets availability to ON_JOB', async () => {
      const { service, techniciansService, bookingModel } = buildJobsService({
        booking: { assignmentStatus: 'PENDING_ACCEPTANCE', status: 'ASSIGNED' },
      });

      await service.acceptJob(technicianId, jobId);

      expect(bookingModel.findByIdAndUpdate).toHaveBeenCalledWith(
        jobId,
        expect.objectContaining({
          assignmentStatus: 'ACCEPTED',
          status: 'ASSIGNED',
        }),
        expect.any(Object),
      );
      expect(techniciansService.update).toHaveBeenCalledWith(technicianId, {
        availabilityStatus: 'ON_JOB',
      });
    });

    it('rejects accept when already ACCEPTED', async () => {
      const { service } = buildJobsService({
        booking: { assignmentStatus: 'ACCEPTED' },
      });
      await expect(service.acceptJob(technicianId, jobId)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejectJob clears technician, restores AVAILABLE, and rebroadcasts', async () => {
      const { service, bookingModel, jobDispatch, techniciansService } =
        buildJobsService({
          booking: { assignmentStatus: 'PENDING_ACCEPTANCE' },
        });

      await service.rejectJob(technicianId, jobId, 'Too far');

      expect(bookingModel.findByIdAndUpdate).toHaveBeenCalledWith(
        jobId,
        expect.objectContaining({
          $set: expect.objectContaining({
            assignmentStatus: 'DECLINED',
            technicianId: null,
            status: 'CONFIRMED',
            dispatchStatus: 'OPEN',
          }),
        }),
        expect.any(Object),
      );
      expect(techniciansService.update).toHaveBeenCalledWith(technicianId, {
        availabilityStatus: 'AVAILABLE',
      });
      expect(jobDispatch.broadcastJob).toHaveBeenCalledWith(jobId);
    });
  });

  describe('updateStatus ↔ availabilityStatus', () => {
    it('blocks status steps until assignmentStatus is ACCEPTED', async () => {
      const { service } = buildJobsService({
        booking: { assignmentStatus: 'PENDING_ACCEPTANCE', status: 'ASSIGNED' },
      });
      await expect(
        service.updateStatus(technicianId, jobId, 'EN_ROUTE'),
      ).rejects.toThrow(/accepted first/i);
    });

    it('rejects skipping EN_ROUTE', async () => {
      const { service } = buildJobsService({
        booking: { assignmentStatus: 'ACCEPTED', status: 'ASSIGNED' },
      });
      await expect(
        service.updateStatus(technicianId, jobId, 'IN_PROGRESS'),
      ).rejects.toThrow(/Cannot skip states/);
    });

    it('sets availabilityStatus ON_JOB when moving to IN_PROGRESS', async () => {
      const { service, techniciansService, bookingsService } = buildJobsService({
        booking: { assignmentStatus: 'ACCEPTED', status: 'EN_ROUTE' },
      });

      await service.updateStatus(technicianId, jobId, 'IN_PROGRESS');

      expect(bookingsService.updateStatus).toHaveBeenCalledWith(
        jobId,
        'IN_PROGRESS',
        undefined,
        undefined,
      );
      expect(techniciansService.update).toHaveBeenCalledWith(technicianId, {
        availabilityStatus: 'ON_JOB',
      });
    });

    it('sets availabilityStatus AVAILABLE on PAYMENT_COLLECTED via status step', async () => {
      const { service, techniciansService } = buildJobsService({
        booking: { assignmentStatus: 'ACCEPTED', status: 'COMPLETED' },
        tech: { totalCompletedJobs: 4 },
      });

      await service.updateStatus(technicianId, jobId, 'PAYMENT_COLLECTED');

      expect(techniciansService.update).toHaveBeenCalledWith(
        technicianId,
        expect.objectContaining({ availabilityStatus: 'AVAILABLE' }),
      );
    });
  });

  describe('markArrival', () => {
    it('sets status EN_ROUTE + arrivalAt without flipping availability to ON_JOB', async () => {
      const { service, techniciansService, bookingModel } = buildJobsService({
        booking: { assignmentStatus: 'ACCEPTED', status: 'ASSIGNED' },
      });

      await service.markArrival(technicianId, jobId, 19.1, 72.8);

      expect(bookingModel.findByIdAndUpdate).toHaveBeenCalledWith(
        jobId,
        expect.objectContaining({
          status: 'EN_ROUTE',
          arrivalAt: expect.any(Date),
          arrivalGps: expect.objectContaining({ lat: 19.1, lng: 72.8 }),
        }),
        expect.any(Object),
      );
      expect(techniciansService.update).not.toHaveBeenCalled();
    });

    it('rejects arrival outside ASSIGNED/EN_ROUTE', async () => {
      const { service } = buildJobsService({
        booking: { assignmentStatus: 'ACCEPTED', status: 'IN_PROGRESS' },
      });
      await expect(
        service.markArrival(technicianId, jobId, 1, 2),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('claim updates availability automatically', () => {
    it('claimJob sets availabilityStatus ON_JOB so dispatch will not double-book', async () => {
      const claimed = {
        _id: jobId,
        dispatchStatus: 'CLAIMED',
        technicianId,
        assignmentStatus: 'ACCEPTED',
        status: 'ASSIGNED',
        toObject() {
          return this;
        },
      };
      const { service, techniciansService, bookingModel } = buildJobsService({});
      bookingModel.findOneAndUpdate = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(claimed),
          }),
        }),
      });
      bookingModel.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            _id: jobId,
            dispatchStatus: 'OPEN',
            technicianId: null,
            addressData: { zip: '400001' },
            serviceId: { slug: 'ac' },
            notifiedTechnicianIds: [],
          }),
        }),
      });

      await service.claimJob(technicianId, jobId);

      expect(techniciansService.update).toHaveBeenCalledWith(technicianId, {
        availabilityStatus: 'ON_JOB',
      });
    });
  });

  describe('profile availability override (breakpoint)', () => {
    it('allows forcing AVAILABLE with no check against active IN_PROGRESS jobs', async () => {
      const techniciansService: any = {
        update: jest.fn().mockResolvedValue({ availabilityStatus: 'AVAILABLE' }),
      };
      const engine = new TechnicianEngineService(techniciansService);
      const profile = new TechnicianProfileService(techniciansService, engine);

      await profile.updateAvailability(technicianId, 'AVAILABLE');

      expect(techniciansService.update).toHaveBeenCalledWith(technicianId, {
        availabilityStatus: 'AVAILABLE',
      });
    });

    it('rejects unknown availability values', () => {
      const techniciansService: any = { update: jest.fn() };
      const engine = new TechnicianEngineService(techniciansService);
      const profile = new TechnicianProfileService(techniciansService, engine);
      expect(() => profile.updateAvailability(technicianId, 'ONLINE')).toThrow(
        BadRequestException,
      );
    });
  });
});
