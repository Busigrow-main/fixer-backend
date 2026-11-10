import { Types } from 'mongoose';

/** Critical fields tracked for admin change history. */
export const BOOKING_AUDIT_FIELDS = [
  'technicianId',
  'status',
  'priority',
  'invoice.serviceTotal',
  'invoice.additionalCharges',
  'estimatedAmount',
  'parts',
  'warrantyExpiry',
  'paymentStatus',
  'serviceType',
  'reviewStatus',
] as const;

export type BookingAuditField = (typeof BOOKING_AUDIT_FIELDS)[number];

export type BookingAuditActorRole =
  | 'ADMIN'
  | 'TECHNICIAN'
  | 'SYSTEM'
  | 'CUSTOMER';

export type BookingAuditContext = {
  actorRole: BookingAuditActorRole;
  actorId?: string;
  reason?: string;
};

export type BookingChangeEventInput = {
  field: BookingAuditField;
  previous: unknown;
  next: unknown;
  actorRole: BookingAuditActorRole;
  actorId?: string;
  reason?: string;
  at?: Date;
};

/**
 * Build one append-only history event. Callers must $push — never $set/$pull
 * existing changeHistory entries. Corrections = new events.
 */
export function buildChangeEvent(input: BookingChangeEventInput) {
  const actorId =
    input.actorId && Types.ObjectId.isValid(input.actorId)
      ? new Types.ObjectId(input.actorId)
      : undefined;
  const reason = String(input.reason || '').trim().slice(0, 2000) || undefined;

  return {
    at: input.at || new Date(),
    actorRole: input.actorRole,
    ...(actorId ? { actorId } : {}),
    field: input.field,
    previous: normalizeAuditValue(input.previous),
    next: normalizeAuditValue(input.next),
    ...(reason ? { reason } : {}),
  };
}

export function normalizeAuditValue(value: unknown): unknown {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Types.ObjectId) return String(value);
  if (typeof value === 'object' && value !== null && '_id' in (value as any)) {
    return String((value as any)._id);
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.slice(0, 2000);
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return String(value).slice(0, 2000);
  }
}

/** Fields technicians must not see or edit. */
export const TECHNICIAN_OMIT_BOOKING_FIELDS = [
  'changeHistory',
  'adminNotes',
  'reviewHistory',
  'reviewRemarks',
] as const;

export function omitTechnicianForbiddenBookingFields<T extends Record<string, any>>(
  booking: T,
): T {
  if (!booking || typeof booking !== 'object') return booking;
  const next = { ...booking };
  for (const key of TECHNICIAN_OMIT_BOOKING_FIELDS) {
    delete next[key];
  }
  return next;
}
