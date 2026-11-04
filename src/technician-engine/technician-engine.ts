import {
  ASSIGNMENT_STATUSES,
  AssignmentStatus,
  AVAILABILITY_STATUSES,
  AvailabilityStatus,
  JOB_SHEET_EDITABLE_STATUSES,
  JOB_STATUS_FLOW,
  TechnicianJobEvent,
  TechnicianJobStatus,
} from './technician-engine.types';

export class TechnicianEngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TechnicianEngineError';
  }
}

export function isAvailabilityStatus(value: unknown): value is AvailabilityStatus {
  return (
    typeof value === 'string' &&
    (AVAILABILITY_STATUSES as readonly string[]).includes(value)
  );
}

export function isJobStatusInFlow(value: unknown): value is TechnicianJobStatus {
  return (
    typeof value === 'string' &&
    (JOB_STATUS_FLOW as readonly string[]).includes(value)
  );
}

export function assertAvailabilityStatus(value: string): AvailabilityStatus {
  if (!isAvailabilityStatus(value)) {
    throw new TechnicianEngineError(
      `status must be ${AVAILABILITY_STATUSES.join(', ')}`,
    );
  }
  return value;
}

/**
 * Core rule: putting a technician on a job removes them from the AVAILABLE pool.
 * Completing the job (or payment / reject / release) returns them to AVAILABLE.
 */
export function availabilityForJobEvent(
  event: TechnicianJobEvent,
): AvailabilityStatus | null {
  switch (event) {
    case 'CLAIMED':
    case 'ADMIN_ASSIGNED':
    case 'ACCEPTED':
    case 'JOB_IN_PROGRESS':
      return 'ON_JOB';
    case 'REJECTED':
    case 'JOB_COMPLETED':
    case 'JOB_PAYMENT_COLLECTED':
    case 'RELEASED':
      return 'AVAILABLE';
    default:
      return null;
  }
}

/** Marketplace claim requires an active, AVAILABLE technician. */
export function assertCanClaimJob(input: {
  isActive?: boolean;
  availabilityStatus?: string | null;
}): void {
  if (!input.isActive) {
    throw new TechnicianEngineError('You must be active and available to claim a job');
  }
  if (input.availabilityStatus !== 'AVAILABLE') {
    throw new TechnicianEngineError('You must be active and available to claim a job');
  }
}

/** Terminal booking statuses — assignment requires an explicit reopen (not built here). */
export const TERMINAL_BOOKING_STATUSES = [
  'CANCELLED',
  'COMPLETED',
  'PAYMENT_COLLECTED',
] as const;

export function assertBookingAssignable(status?: string | null): void {
  const code = String(status || '').toUpperCase();
  if ((TERMINAL_BOOKING_STATUSES as readonly string[]).includes(code)) {
    throw new TechnicianEngineError(
      'Cannot assign a technician to a cancelled or completed job. Reopen the booking first.',
    );
  }
}

/** Active + AVAILABLE — same pool as claim / admin assign. */
export function isAvailableForAssignment(tech: {
  isActive?: boolean;
  availabilityStatus?: string | null;
}): boolean {
  return !!tech.isActive && tech.availabilityStatus === 'AVAILABLE';
}

/** Admin assign: technician must exist and be in the AVAILABLE pool. */
export function assertAssignableTechnician(
  tech:
    | { isActive?: boolean; availabilityStatus?: string | null }
    | null
    | undefined,
): void {
  if (!tech) {
    throw new TechnicianEngineError('Technician not found');
  }
  if (!isAvailableForAssignment(tech)) {
    throw new TechnicianEngineError(
      'Technician is not active and available',
    );
  }
}

export function assertCanAcceptAssignment(assignmentStatus?: string | null): void {
  if (assignmentStatus !== 'PENDING_ACCEPTANCE') {
    throw new TechnicianEngineError('Job is not pending acceptance');
  }
}

export function assertCanRejectAssignment(assignmentStatus?: string | null): void {
  assertCanAcceptAssignment(assignmentStatus);
}

/** Status steps require an accepted assignment. */
export function assertAssignmentAccepted(assignmentStatus?: string | null): void {
  if (assignmentStatus !== 'ACCEPTED') {
    throw new TechnicianEngineError('Job must be accepted first');
  }
}

/**
 * Enforce one-step advances along JOB_STATUS_FLOW.
 * Returns the normalized next status.
 */
export function assertJobStatusTransition(
  currentStatus: string | null | undefined,
  nextStatus: string,
): TechnicianJobStatus {
  if (!isJobStatusInFlow(nextStatus)) {
    throw new TechnicianEngineError('Invalid job status');
  }

  const current = String(currentStatus || '');
  const currentIndex = (JOB_STATUS_FLOW as readonly string[]).indexOf(current);
  const nextIndex = (JOB_STATUS_FLOW as readonly string[]).indexOf(nextStatus);

  if (currentIndex === -1 && nextStatus !== 'ASSIGNED') {
    throw new TechnicianEngineError(
      `Cannot transition from ${current || 'unknown'} to ${nextStatus}`,
    );
  }
  if (currentIndex !== -1 && nextIndex !== currentIndex + 1) {
    throw new TechnicianEngineError(
      `Cannot skip states. Current: ${current}, requested: ${nextStatus}`,
    );
  }

  return nextStatus;
}

/** Job-event implied by a successful sequential status step. */
export function jobEventForStatusStep(
  nextStatus: TechnicianJobStatus,
): TechnicianJobEvent | null {
  if (nextStatus === 'IN_PROGRESS') return 'JOB_IN_PROGRESS';
  if (nextStatus === 'COMPLETED') return 'JOB_COMPLETED';
  if (nextStatus === 'PAYMENT_COLLECTED') return 'JOB_PAYMENT_COLLECTED';
  return null;
}

export function canEditJobSheet(input: {
  status?: string | null;
  assignmentStatus?: string | null;
  isBilled?: boolean;
  jobClosed?: boolean;
  sheetLockedAt?: unknown;
}): boolean {
  if (input.assignmentStatus !== 'ACCEPTED') return false;
  if (input.isBilled || input.jobClosed || input.sheetLockedAt) return false;
  return (JOB_SHEET_EDITABLE_STATUSES as readonly string[]).includes(
    String(input.status || ''),
  );
}

export function assertCanEditJobSheet(input: {
  status?: string | null;
  assignmentStatus?: string | null;
  isBilled?: boolean;
  jobClosed?: boolean;
  sheetLockedAt?: unknown;
}): void {
  if (input.assignmentStatus !== 'ACCEPTED') {
    throw new TechnicianEngineError(
      'Job must be accepted before editing the sheet',
    );
  }
  if (input.isBilled || input.jobClosed || input.sheetLockedAt) {
    throw new TechnicianEngineError('Job sheet is locked');
  }
  if (
    !(JOB_SHEET_EDITABLE_STATUSES as readonly string[]).includes(
      String(input.status || ''),
    )
  ) {
    throw new TechnicianEngineError(
      `Job sheet can only be edited while status is ${JOB_SHEET_EDITABLE_STATUSES.join(' or ')}`,
    );
  }
}

export function assertCanMarkArrival(status?: string | null): void {
  if (status !== 'ASSIGNED' && status !== 'EN_ROUTE') {
    throw new TechnicianEngineError('Job is not in a valid state for arrival');
  }
}

export function isAssignmentStatus(value: unknown): value is AssignmentStatus {
  return (
    typeof value === 'string' &&
    (ASSIGNMENT_STATUSES as readonly string[]).includes(value)
  );
}
