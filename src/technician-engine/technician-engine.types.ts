/** Technician presence — the only activity/availability model. */
export const AVAILABILITY_STATUSES = [
  'AVAILABLE',
  'ON_JOB',
  'UNAVAILABLE',
] as const;

export type AvailabilityStatus = (typeof AVAILABILITY_STATUSES)[number];

/** Sequential job statuses the technician advances through after accept/claim. */
export const JOB_STATUS_FLOW = [
  'ASSIGNED',
  'EN_ROUTE',
  'IN_PROGRESS',
  'COMPLETED',
  'PAYMENT_COLLECTED',
] as const;

export type TechnicianJobStatus = (typeof JOB_STATUS_FLOW)[number];

export const JOB_SHEET_EDITABLE_STATUSES = ['EN_ROUTE', 'IN_PROGRESS'] as const;

export type JobSheetEditableStatus = (typeof JOB_SHEET_EDITABLE_STATUSES)[number];

export const ASSIGNMENT_STATUSES = [
  'PENDING_ACCEPTANCE',
  'ACCEPTED',
  'DECLINED',
] as const;

export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

/**
 * Domain events that move a technician onto / off a job.
 * Platform adapters fire these; the engine decides availability.
 */
export type TechnicianJobEvent =
  | 'CLAIMED'
  | 'ADMIN_ASSIGNED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'JOB_IN_PROGRESS'
  | 'JOB_COMPLETED'
  | 'JOB_PAYMENT_COLLECTED'
  | 'RELEASED';
