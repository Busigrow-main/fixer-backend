export const JOINING_FEE_AMOUNT = 2400;
export const ONBOARDING_CALL_COST = 800;

/** Platform fee (₹) charged to technician per self-sourced spare-part line. */
export const SELF_PART_PLATFORM_FEE = 100;

/** Technician commission on Fixxer-inventory spare parts sold on a job. */
export const INVENTORY_PART_COMMISSION_RATE = 0.1;

/** Job lifecycle + sheet rules live in technician-engine; re-exported for platform callers. */
export {
  JOB_SHEET_EDITABLE_STATUSES,
  JOB_STATUS_FLOW,
} from '../technician-engine/technician-engine.types';
export type { TechnicianJobStatus } from '../technician-engine/technician-engine.types';

export const ONBOARDING_EVENTS = [
  'OTP_SENT',
  'OTP_VERIFIED',
  'PROFILE_STARTED',
  'PROFILE_COMPLETED',
  'JOINING_FEE_INITIATED',
  'JOINING_FEE_SUCCESS',
  'ID_REQUESTED',
  'ID_UPLOADED',
  'ID_VERIFIED',
  'ONBOARDING_COMPLETED',
] as const;

export const PAYMENT_GATEWAY = process.env.PAYMENT_GATEWAY || 'RAZORPAY';
