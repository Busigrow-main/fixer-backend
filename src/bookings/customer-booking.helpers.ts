/**
 * Pure helpers for customer-facing booking transparency (pricing, status, technician).
 * Kept free of Nest DI so they can be unit-tested without Mongo.
 */

export type CustomerStatusTone = 'pending' | 'active' | 'success' | 'danger' | 'neutral';

export type CustomerStatusView = {
  code: string;
  label: string;
  tone: CustomerStatusTone;
  stepIndex: number;
};

/** Ordered journey steps shown to customers (excludes terminal cancel/reschedule). */
export const CUSTOMER_STATUS_STEPS = [
  'PENDING',
  'CONFIRMED',
  'ASSIGNED',
  'EN_ROUTE',
  'IN_PROGRESS',
  'COMPLETED',
  'PAYMENT_COLLECTED',
] as const;

export function sanitizeTechnicianForCustomer(
  technician: Record<string, any> | null | undefined,
): { _id: string; name: string; phone?: string } | null {
  if (!technician) return null;
  const id = technician._id ?? technician.id;
  const name = typeof technician.name === 'string' ? technician.name.trim() : '';
  if (!id || !name) return null;
  return {
    _id: String(id),
    name,
    ...(typeof technician.phone === 'string' && technician.phone
      ? { phone: technician.phone }
      : {}),
  };
}

export function getCustomerStatusView(
  status: string | undefined | null,
  opts: { isWarrantyClaim?: boolean; arrivalAt?: Date | string | null } = {},
): CustomerStatusView {
  if (opts.isWarrantyClaim) {
    return {
      code: 'WARRANTY_CLAIM',
      label: 'Warranty claim',
      tone: 'active',
      stepIndex: 2,
    };
  }

  const code = String(status || 'PENDING').toUpperCase();

  switch (code) {
    case 'PENDING':
      return {
        code,
        label: 'Finding a master technician',
        tone: 'pending',
        stepIndex: 0,
      };
    case 'CONFIRMED':
      return {
        code,
        label: 'Booking confirmed',
        tone: 'active',
        stepIndex: 1,
      };
    case 'ASSIGNED':
      return {
        code,
        label: 'Master technician assigned',
        tone: 'active',
        stepIndex: 2,
      };
    case 'EN_ROUTE':
      return opts.arrivalAt
        ? {
            code,
            label: 'Technician has arrived',
            tone: 'active',
            stepIndex: 3,
          }
        : {
            code,
            label: 'Technician is on the way',
            tone: 'active',
            stepIndex: 3,
          };
    case 'IN_PROGRESS':
      return {
        code,
        label: 'Service in progress',
        tone: 'active',
        stepIndex: 4,
      };
    case 'COMPLETED':
      return {
        code,
        label: 'Service completed',
        tone: 'success',
        stepIndex: 5,
      };
    case 'PAYMENT_COLLECTED':
      return {
        code,
        label: 'Payment received',
        tone: 'success',
        stepIndex: 6,
      };
    case 'CANCELLED':
      return {
        code,
        label: 'Cancelled',
        tone: 'danger',
        stepIndex: -1,
      };
    case 'RESCHEDULED':
      return {
        code,
        label: 'Rescheduled',
        tone: 'neutral',
        stepIndex: 1,
      };
    default:
      return {
        code,
        label: code.replace(/_/g, ' ').toLowerCase(),
        tone: 'neutral',
        stepIndex: 0,
      };
  }
}

export type CustomerPricingSummary = {
  estimatedAmount: number;
  serviceTotal: number;
  partsTotal: number;
  additionalChargesTotal: number;
  totalAmount: number;
  hasExtras: boolean;
  isFinal: boolean;
  displayLabel: 'Estimated' | 'Current total' | 'Final';
};

export function buildCustomerPricingSummary(booking: {
  estimatedAmount?: number;
  invoiceData?: {
    serviceTotal?: number;
    partsTotal?: number;
    additionalCharges?: { amount?: number }[];
    totalAmount?: number;
  };
  isBilled?: boolean;
  jobClosed?: boolean;
  paymentStatus?: string;
  status?: string;
}): CustomerPricingSummary {
  const serviceTotal = Number(booking.invoiceData?.serviceTotal || 0);
  const partsTotal = Number(booking.invoiceData?.partsTotal || 0);
  const additionalChargesTotal = (booking.invoiceData?.additionalCharges || []).reduce(
    (sum, c) => sum + Number(c?.amount || 0),
    0,
  );
  const totalAmount =
    booking.invoiceData?.totalAmount != null
      ? Number(booking.invoiceData.totalAmount)
      : serviceTotal + partsTotal + additionalChargesTotal;

  const estimatedAmount =
    Number(booking.estimatedAmount) > 0
      ? Number(booking.estimatedAmount)
      : serviceTotal;

  const hasExtras = partsTotal > 0 || additionalChargesTotal > 0;
  const isFinal =
    booking.isBilled === true ||
    booking.jobClosed === true ||
    booking.paymentStatus === 'PAID_CASH' ||
    booking.paymentStatus === 'PAID_ONLINE' ||
    booking.status === 'PAYMENT_COLLECTED';

  let displayLabel: CustomerPricingSummary['displayLabel'] = 'Estimated';
  if (isFinal) displayLabel = 'Final';
  else if (hasExtras) displayLabel = 'Current total';

  return {
    estimatedAmount,
    serviceTotal,
    partsTotal,
    additionalChargesTotal,
    totalAmount,
    hasExtras,
    isFinal,
    displayLabel,
  };
}

/**
 * Freeze estimated amount only once — first non-zero service total wins.
 */
export function resolveFrozenEstimatedAmount(
  existingEstimated: number | undefined | null,
  serviceTotal: number,
): number {
  const existing = Number(existingEstimated || 0);
  if (existing > 0) return existing;
  return Number(serviceTotal || 0);
}

export function pickUpcomingVisitSchedule(
  visits: Array<{
    scheduledDate?: Date | string | null;
    status?: string;
    visitOrder?: number;
  }>,
): { scheduledDate: Date | string; status: string; visitOrder?: number } | null {
  const open = visits
    .filter((v) => v.scheduledDate && v.status !== 'COMPLETED')
    .sort((a, b) => {
      const da = new Date(a.scheduledDate as any).getTime();
      const db = new Date(b.scheduledDate as any).getTime();
      return da - db;
    });

  if (open.length === 0) return null;
  const v = open[0];
  return {
    scheduledDate: v.scheduledDate as Date | string,
    status: v.status || 'SCHEDULED',
    visitOrder: v.visitOrder,
  };
}

export function resolveExpectedArrival(
  booking: {
    expectedArrivalAt?: Date | string | null;
    preferredVisitDate?: string | null;
    preferredVisitSlot?: string | null;
  },
  upcomingVisit: { scheduledDate: Date | string } | null,
): {
  expectedArrivalAt: Date | string | null;
  preferredVisitDate: string | null;
  preferredVisitSlot: string | null;
  source: 'expected' | 'visit' | 'preferred' | 'none';
} {
  if (booking.expectedArrivalAt) {
    return {
      expectedArrivalAt: booking.expectedArrivalAt,
      preferredVisitDate: booking.preferredVisitDate || null,
      preferredVisitSlot: booking.preferredVisitSlot || null,
      source: 'expected',
    };
  }
  if (upcomingVisit?.scheduledDate) {
    return {
      expectedArrivalAt: upcomingVisit.scheduledDate,
      preferredVisitDate: booking.preferredVisitDate || null,
      preferredVisitSlot: booking.preferredVisitSlot || null,
      source: 'visit',
    };
  }
  if (booking.preferredVisitDate) {
    return {
      expectedArrivalAt: null,
      preferredVisitDate: booking.preferredVisitDate,
      preferredVisitSlot: booking.preferredVisitSlot || null,
      source: 'preferred',
    };
  }
  return {
    expectedArrivalAt: null,
    preferredVisitDate: null,
    preferredVisitSlot: null,
    source: 'none',
  };
}
