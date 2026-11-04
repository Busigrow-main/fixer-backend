import {
  assertAssignableTechnician,
  assertBookingAssignable,
  assertCanClaimJob,
  assertJobStatusTransition,
  assertAvailabilityStatus,
  availabilityForJobEvent,
  canEditJobSheet,
  jobEventForStatusStep,
  TechnicianEngineError,
} from './technician-engine';
import { JOB_STATUS_FLOW } from './technician-engine.types';

describe('Technician engine (core)', () => {
  describe('availabilityForJobEvent', () => {
    it('puts tech ON_JOB when claimed, assigned, or accepted', () => {
      expect(availabilityForJobEvent('CLAIMED')).toBe('ON_JOB');
      expect(availabilityForJobEvent('ADMIN_ASSIGNED')).toBe('ON_JOB');
      expect(availabilityForJobEvent('ACCEPTED')).toBe('ON_JOB');
      expect(availabilityForJobEvent('JOB_IN_PROGRESS')).toBe('ON_JOB');
    });

    it('restores AVAILABLE when job completed, rejected, or payment collected', () => {
      expect(availabilityForJobEvent('REJECTED')).toBe('AVAILABLE');
      expect(availabilityForJobEvent('JOB_COMPLETED')).toBe('AVAILABLE');
      expect(availabilityForJobEvent('JOB_PAYMENT_COLLECTED')).toBe('AVAILABLE');
      expect(availabilityForJobEvent('RELEASED')).toBe('AVAILABLE');
    });
  });

  describe('claim gate', () => {
    it('allows only active AVAILABLE technicians', () => {
      expect(() =>
        assertCanClaimJob({ isActive: true, availabilityStatus: 'AVAILABLE' }),
      ).not.toThrow();
      expect(() =>
        assertCanClaimJob({ isActive: true, availabilityStatus: 'ON_JOB' }),
      ).toThrow(TechnicianEngineError);
      expect(() =>
        assertCanClaimJob({ isActive: false, availabilityStatus: 'AVAILABLE' }),
      ).toThrow(TechnicianEngineError);
    });
  });

  describe('admin assign gates', () => {
    it('blocks terminal bookings; assign needs active AVAILABLE techs', () => {
      expect(() => assertBookingAssignable('CONFIRMED')).not.toThrow();
      expect(() => assertBookingAssignable('cancelled')).toThrow(/cancelled or completed/i);
      expect(() => assertBookingAssignable('COMPLETED')).toThrow(/cancelled or completed/i);
      expect(() => assertBookingAssignable('PAYMENT_COLLECTED')).toThrow(
        /cancelled or completed/i,
      );

      expect(() =>
        assertAssignableTechnician({
          isActive: true,
          availabilityStatus: 'AVAILABLE',
        }),
      ).not.toThrow();
      expect(() => assertAssignableTechnician(null)).toThrow(/not found/i);
      expect(() =>
        assertAssignableTechnician({
          isActive: false,
          availabilityStatus: 'AVAILABLE',
        }),
      ).toThrow(/not active and available/i);
      expect(() =>
        assertAssignableTechnician({
          isActive: true,
          availabilityStatus: 'ON_JOB',
        }),
      ).toThrow(/not active and available/i);
    });
  });

  describe('job status flow', () => {
    it('exposes the sequential flow', () => {
      expect([...JOB_STATUS_FLOW]).toEqual([
        'ASSIGNED',
        'EN_ROUTE',
        'IN_PROGRESS',
        'COMPLETED',
        'PAYMENT_COLLECTED',
      ]);
    });

    it('allows one-step advances only', () => {
      expect(assertJobStatusTransition('ASSIGNED', 'EN_ROUTE')).toBe('EN_ROUTE');
      expect(() => assertJobStatusTransition('ASSIGNED', 'IN_PROGRESS')).toThrow(
        /Cannot skip/,
      );
      expect(jobEventForStatusStep('IN_PROGRESS')).toBe('JOB_IN_PROGRESS');
      expect(jobEventForStatusStep('COMPLETED')).toBe('JOB_COMPLETED');
      expect(jobEventForStatusStep('PAYMENT_COLLECTED')).toBe(
        'JOB_PAYMENT_COLLECTED',
      );
      expect(jobEventForStatusStep('EN_ROUTE')).toBeNull();
    });
  });

  describe('manual availability + job sheet', () => {
    it('rejects unknown availability labels', () => {
      expect(() => assertAvailabilityStatus('ONLINE')).toThrow(/AVAILABLE/);
      expect(assertAvailabilityStatus('UNAVAILABLE')).toBe('UNAVAILABLE');
    });

    it('job sheet editable only for accepted EN_ROUTE/IN_PROGRESS open jobs', () => {
      expect(
        canEditJobSheet({
          status: 'IN_PROGRESS',
          assignmentStatus: 'ACCEPTED',
        }),
      ).toBe(true);
      expect(
        canEditJobSheet({
          status: 'ASSIGNED',
          assignmentStatus: 'ACCEPTED',
        }),
      ).toBe(false);
      expect(
        canEditJobSheet({
          status: 'IN_PROGRESS',
          assignmentStatus: 'PENDING_ACCEPTANCE',
        }),
      ).toBe(false);
      expect(
        canEditJobSheet({
          status: 'IN_PROGRESS',
          assignmentStatus: 'ACCEPTED',
          isBilled: true,
        }),
      ).toBe(false);
    });
  });
});
