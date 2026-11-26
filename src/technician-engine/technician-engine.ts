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
 * Completing the job (or payment / reject / cancel / release) returns them to AVAILABLE.
 */
export function availabilityForJobEvent(
  event: TechnicianJobEvent,
  employmentType?: string | null,
): AvailabilityStatus | null {
  // Fixxer staff are scheduled into future slots: being assigned / accepting a job
  // does not take them off the board. They are ON_JOB only once actually working.
  if (employmentType === 'FIXXER_STAFF' && isPreArrivalJobEvent(event)) {
    return null;
  }
  switch (event) {
    case 'CLAIMED':
    case 'ADMIN_ASSIGNED':
    case 'ACCEPTED':
    case 'JOB_IN_PROGRESS':
      return 'ON_JOB';
    case 'REJECTED':
    case 'JOB_COMPLETED':
    case 'JOB_PAYMENT_COLLECTED':
    case 'JOB_CANCELLED':
    case 'RELEASED':
      return 'AVAILABLE';
    default:
      return null;
  }
}

/** Events that happen before the technician is on the way / on site. */
export function isPreArrivalJobEvent(event: TechnicianJobEvent): boolean {
  return event === 'CLAIMED' || event === 'ADMIN_ASSIGNED' || event === 'ACCEPTED';
}

/**
 * Technician's own status switch. They may always go offline (UNAVAILABLE);
 * they may go AVAILABLE only with no open booking; ON_JOB is engine-owned.
 */
export function assertManualAvailabilityChange(
  requested: string,
  hasActiveJob: boolean,
): AvailabilityStatus {
  const status = assertAvailabilityStatus(requested);
  if (status === 'ON_JOB') {
    throw new TechnicianEngineError(
      'ON_JOB is set automatically when you take a job',
    );
  }
  if (status === 'AVAILABLE' && hasActiveJob) {
    throw new TechnicianEngineError(
      'Finish your current job before marking yourself available',
    );
  }
  return status;
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

/**
 * Rescheduled bookings keep their technician linked but do NOT occupy them —
 * the technician is free for other work until the booking is re-activated.
 */
export const NON_OCCUPYING_BOOKING_STATUSES = [
  ...TERMINAL_BOOKING_STATUSES,
  'RESCHEDULED',
] as const;

/** Statuses in which a booking occupies its technician right now. */
export const TECH_OCCUPYING_STATUSES = ['ASSIGNED', 'EN_ROUTE', 'IN_PROGRESS'] as const;

export function isTechOccupyingStatus(status?: string | null): boolean {
  return (TECH_OCCUPYING_STATUSES as readonly string[]).includes(
    String(status || '').toUpperCase(),
  );
}

/**
 * Mongo filter for bookings that occupy a technician (not cancelled/completed/
 * rescheduled, not declined). Callers add `technicianId` (and optionally exclude a
 * booking `_id`). Single definition so every "is this technician busy?" check agrees.
 */
export function activeJobQuery(): Record<string, unknown> {
  return {
    status: { $nin: [...NON_OCCUPYING_BOOKING_STATUSES] },
    assignmentStatus: { $ne: 'DECLINED' },
  };
}

/** Statuses in which a technician is physically on a job (on the way / on site). */
export const LIVE_JOB_STATUSES = ['EN_ROUTE', 'IN_PROGRESS'] as const;

/**
 * Mongo filter for a job the technician is working right now. Fixxer staff hold many
 * future ASSIGNED slots, so for them "busy now" means only this (see technician-schedule).
 */
export function liveJobQuery(): Record<string, unknown> {
  return {
    status: { $in: [...LIVE_JOB_STATUSES] },
    assignmentStatus: { $ne: 'DECLINED' },
  };
}

/**
 * Allowed booking status moves (admin console + technician app). Cancellation has
 * its own path. No way back once COMPLETED — a finished job is not reopened.
 * EN_ROUTE may be skipped (admin has no EN_ROUTE option).
 */
export const BOOKING_STATUS_TRANSITIONS: Record<string, readonly string[]> = {
  PENDING: ['CONFIRMED', 'ASSIGNED', 'RESCHEDULED'],
  CONFIRMED: ['PENDING', 'ASSIGNED', 'RESCHEDULED'],
  ASSIGNED: ['PENDING', 'CONFIRMED', 'EN_ROUTE', 'IN_PROGRESS', 'RESCHEDULED'],
  EN_ROUTE: ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'RESCHEDULED'],
  IN_PROGRESS: ['PENDING', 'CONFIRMED', 'COMPLETED', 'RESCHEDULED'],
  RESCHEDULED: ['PENDING', 'CONFIRMED', 'ASSIGNED', 'IN_PROGRESS'],
  COMPLETED: ['PAYMENT_COLLECTED'],
  PAYMENT_COLLECTED: [],
  CANCELLED: [],
};

export function assertBookingStatusTransition(
  from: string | null | undefined,
  to: string,
): void {
  const current = String(from || '').toUpperCase();
  const next = String(to || '').toUpperCase();
  if (current === next) return;
  const allowed = BOOKING_STATUS_TRANSITIONS[current];
  // Unknown/legacy current status: don't block (nothing to reason about).
  if (!allowed) return;
  if (!allowed.includes(next)) {
    throw new TechnicianEngineError(
      allowed.length
        ? `Cannot move a ${current} booking to ${next}. Allowed: ${allowed.join(', ')}`
        : `A ${current} booking can no longer change status`,
    );
  }
}

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
