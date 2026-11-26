import { BadRequestException, Injectable } from '@nestjs/common';
import { TechniciansService } from '../technicians/technicians.service';
import {
  assertAssignableTechnician,
  assertManualAvailabilityChange,
  assertBookingAssignable as assertBookingNotTerminal,
  assertCanAcceptAssignment,
  assertCanClaimJob,
  assertCanMarkArrival,
  assertCanRejectAssignment,
  assertJobStatusTransition,
  availabilityForJobEvent,
  isPreArrivalJobEvent,
  jobEventForStatusStep,
  TechnicianEngineError,
} from './technician-engine';
import {
  AvailabilityStatus,
  TechnicianJobEvent,
  TechnicianJobStatus,
} from './technician-engine.types';

function toHttp(err: unknown): never {
  if (err instanceof TechnicianEngineError) {
    throw new BadRequestException(err.message);
  }
  throw err;
}

/**
 * Nest adapter over the pure technician engine.
 * Platform controllers/services call this — they should not encode availability rules.
 */
@Injectable()
export class TechnicianEngineService {
  constructor(private readonly techniciansService: TechniciansService) {}

  async applyJobEvent(
    technicianId: string,
    event: TechnicianJobEvent,
  ): Promise<AvailabilityStatus | null> {
    let next = availabilityForJobEvent(event);
    if (!next) return null;
    if (isPreArrivalJobEvent(event)) {
      // Staff stay AVAILABLE while holding future slots — needs the technician's type.
      const tech = await this.techniciansService.findOne(technicianId);
      next = availabilityForJobEvent(event, tech?.employmentType);
      if (!next) return null;
    }
    if (next === 'AVAILABLE') {
      // Only free a technician who is ON_JOB — never override UNAVAILABLE (off duty).
      await this.techniciansService.releaseFromJob(technicianId);
      return next;
    }
    await this.techniciansService.update(technicianId, {
      availabilityStatus: next,
    });
    return next;
  }

  async markOnJob(technicianId: string) {
    return this.applyJobEvent(technicianId, 'CLAIMED');
  }

  async markAvailable(technicianId: string) {
    return this.applyJobEvent(technicianId, 'RELEASED');
  }

  /** Booking was cancelled — the assigned technician goes back to the AVAILABLE pool. */
  async onJobCancelled(technicianId: string) {
    return this.applyJobEvent(technicianId, 'JOB_CANCELLED');
  }

  /**
   * Release previous tech (if any) back to AVAILABLE and put the new tech ON_JOB.
   */
  async onAdminAssigned(input: {
    technicianId: string;
    previousTechnicianId?: string | null;
  }) {
    await this.applyJobEvent(input.technicianId, 'ADMIN_ASSIGNED');
    if (
      input.previousTechnicianId &&
      input.previousTechnicianId !== String(input.technicianId)
    ) {
      await this.applyJobEvent(input.previousTechnicianId, 'RELEASED');
    }
  }

  assertCanClaim(tech: {
    isActive?: boolean;
    availabilityStatus?: string | null;
  }) {
    try {
      assertCanClaimJob(tech);
    } catch (err) {
      toHttp(err);
    }
  }

  assertBookingAssignable(status?: string | null) {
    try {
      assertBookingNotTerminal(status);
    } catch (err) {
      toHttp(err);
    }
  }

  async assertTechnicianAssignable(technicianId: string) {
    try {
      const tech = await this.techniciansService.findOne(technicianId);
      assertAssignableTechnician(tech);
      return tech;
    } catch (err) {
      if (err instanceof TechnicianEngineError) toHttp(err);
      throw err;
    }
  }

  /** Active AVAILABLE technicians for admin assign / visit scheduling. */
  listAvailable() {
    return this.techniciansService.findAvailable();
  }

  assertCanAccept(assignmentStatus?: string | null) {
    try {
      assertCanAcceptAssignment(assignmentStatus);
    } catch (err) {
      toHttp(err);
    }
  }

  assertCanReject(assignmentStatus?: string | null) {
    try {
      assertCanRejectAssignment(assignmentStatus);
    } catch (err) {
      toHttp(err);
    }
  }

  assertCanMarkArrival(status?: string | null) {
    try {
      assertCanMarkArrival(status);
    } catch (err) {
      toHttp(err);
    }
  }

  /** Technician's own switch — see assertManualAvailabilityChange for the rules. */
  assertManualAvailability(
    status: string,
    hasActiveJob = false,
  ): AvailabilityStatus {
    try {
      return assertManualAvailabilityChange(status, hasActiveJob);
    } catch (err) {
      toHttp(err);
    }
  }

  /**
   * Validate sequential status transition and return the availability event (if any).
   */
  planStatusStep(
    currentStatus: string | null | undefined,
    nextStatus: string,
  ): { next: TechnicianJobStatus; availabilityEvent: TechnicianJobEvent | null } {
    try {
      const next = assertJobStatusTransition(currentStatus, nextStatus);
      return { next, availabilityEvent: jobEventForStatusStep(next) };
    } catch (err) {
      toHttp(err);
    }
  }

  async applyStatusStepAvailability(
    technicianId: string,
    nextStatus: TechnicianJobStatus,
  ) {
    const event = jobEventForStatusStep(nextStatus);
    if (!event) return;

    if (event === 'JOB_COMPLETED' || event === 'JOB_PAYMENT_COLLECTED') {
      await this.techniciansService.recountCompletedJobs(technicianId);
    }

    await this.applyJobEvent(technicianId, event);
  }
}
