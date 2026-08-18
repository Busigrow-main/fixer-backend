export const JOINING_FEE_AMOUNT = 2400;
export const ONBOARDING_CALL_COST = 800;

/** Platform fee (₹) charged to technician per self-sourced spare-part line. */
export const SELF_PART_PLATFORM_FEE = 100;

/** Technician commission on Fixxer-inventory spare parts sold on a job. */
export const INVENTORY_PART_COMMISSION_RATE = 0.1;

export const JOB_SHEET_EDITABLE_STATUSES = ['EN_ROUTE', 'IN_PROGRESS'] as const;

export const JOB_STATUS_FLOW = [
  'ASSIGNED',
  'EN_ROUTE',
  'IN_PROGRESS',
  'COMPLETED',
  'PAYMENT_COLLECTED',
] as const;

export type TechnicianJobStatus = (typeof JOB_STATUS_FLOW)[number];

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
