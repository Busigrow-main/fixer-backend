import {
  buildCustomerPricingSummary,
  getCustomerStatusView,
  pickUpcomingVisitSchedule,
  resolveExpectedArrival,
  resolveFrozenEstimatedAmount,
  sanitizeTechnicianForCustomer,
} from './customer-booking.helpers';

describe('customer-booking.helpers', () => {
  describe('sanitizeTechnicianForCustomer', () => {
    it('returns name and phone only', () => {
      expect(
        sanitizeTechnicianForCustomer({
          _id: 'tech1',
          name: 'Ravi Kumar',
          phone: '9876543210',
          bankDetails: { accountNumber: 'secret' },
        }),
      ).toEqual({
        _id: 'tech1',
        name: 'Ravi Kumar',
        phone: '9876543210',
      });
    });

    it('returns null when name missing', () => {
      expect(sanitizeTechnicianForCustomer({ _id: 'x', phone: '1' })).toBeNull();
      expect(sanitizeTechnicianForCustomer(null)).toBeNull();
      expect(sanitizeTechnicianForCustomer(undefined)).toBeNull();
    });

    it('rejects whitespace-only names and missing ids', () => {
      expect(
        sanitizeTechnicianForCustomer({ _id: 't1', name: '   ' }),
      ).toBeNull();
      expect(sanitizeTechnicianForCustomer({ name: 'No Id' })).toBeNull();
    });

    it('accepts id alias and omits empty phone', () => {
      expect(
        sanitizeTechnicianForCustomer({ id: 'alt', name: 'Sam', phone: '' }),
      ).toEqual({ _id: 'alt', name: 'Sam' });
    });

    it('strips sensitive fields from populated technician docs', () => {
      const result = sanitizeTechnicianForCustomer({
        _id: 't2',
        name: 'Priya',
        phone: '9111111111',
        email: 'priya@example.com',
        bankDetails: { ifsc: 'XXXX' },
        averageRating: 4.9,
      });
      expect(result).toEqual({
        _id: 't2',
        name: 'Priya',
        phone: '9111111111',
      });
      expect(result).not.toHaveProperty('email');
      expect(result).not.toHaveProperty('bankDetails');
    });
  });

  describe('getCustomerStatusView', () => {
    it('maps pending and assigned clearly', () => {
      expect(getCustomerStatusView('PENDING').label).toBe(
        'Finding a master technician',
      );
      expect(getCustomerStatusView('ASSIGNED').label).toBe(
        'Master technician assigned',
      );
      expect(getCustomerStatusView('ASSIGNED').tone).toBe('active');
    });

    it('distinguishes en-route vs arrived via arrivalAt', () => {
      expect(getCustomerStatusView('EN_ROUTE').label).toBe(
        'Technician is on the way',
      );
      expect(
        getCustomerStatusView('EN_ROUTE', { arrivalAt: new Date() }).label,
      ).toBe('Technician has arrived');
      expect(
        getCustomerStatusView('EN_ROUTE', { arrivalAt: '' }).label,
      ).toBe('Technician is on the way');
    });

    it('marks cancelled as danger tone', () => {
      expect(getCustomerStatusView('CANCELLED')).toMatchObject({
        label: 'Cancelled',
        tone: 'danger',
        stepIndex: -1,
      });
    });

    it('labels warranty claims even when status is completed', () => {
      expect(
        getCustomerStatusView('COMPLETED', { isWarrantyClaim: true }),
      ).toMatchObject({
        code: 'WARRANTY_CLAIM',
        label: 'Warranty claim',
        tone: 'active',
      });
    });

    it('handles null/undefined/lowercase/unknown statuses', () => {
      expect(getCustomerStatusView(null).code).toBe('PENDING');
      expect(getCustomerStatusView(undefined).label).toContain('Finding');
      expect(getCustomerStatusView('in_progress').label).toBe(
        'Service in progress',
      );
      expect(getCustomerStatusView('SOMETHING_NEW')).toMatchObject({
        code: 'SOMETHING_NEW',
        label: 'something new',
        tone: 'neutral',
      });
    });

    it('maps full happy-path journey tones', () => {
      expect(getCustomerStatusView('CONFIRMED').tone).toBe('active');
      expect(getCustomerStatusView('IN_PROGRESS').stepIndex).toBe(4);
      expect(getCustomerStatusView('COMPLETED').tone).toBe('success');
      expect(getCustomerStatusView('PAYMENT_COLLECTED').tone).toBe('success');
      expect(getCustomerStatusView('RESCHEDULED').tone).toBe('neutral');
    });
  });

  describe('buildCustomerPricingSummary', () => {
    it('shows estimated from frozen amount when no extras', () => {
      const summary = buildCustomerPricingSummary({
        estimatedAmount: 499,
        invoiceData: { serviceTotal: 499, partsTotal: 0, totalAmount: 499 },
      });
      expect(summary.displayLabel).toBe('Estimated');
      expect(summary.estimatedAmount).toBe(499);
      expect(summary.hasExtras).toBe(false);
    });

    it('switches to current total when parts exist', () => {
      const summary = buildCustomerPricingSummary({
        estimatedAmount: 499,
        invoiceData: {
          serviceTotal: 499,
          partsTotal: 800,
          additionalCharges: [{ amount: 50 }],
          totalAmount: 1349,
        },
      });
      expect(summary.displayLabel).toBe('Current total');
      expect(summary.hasExtras).toBe(true);
      expect(summary.totalAmount).toBe(1349);
    });

    it('marks billed jobs as final', () => {
      const summary = buildCustomerPricingSummary({
        estimatedAmount: 499,
        isBilled: true,
        invoiceData: { serviceTotal: 499, partsTotal: 100, totalAmount: 599 },
      });
      expect(summary.displayLabel).toBe('Final');
      expect(summary.isFinal).toBe(true);
    });

    it('falls back estimatedAmount to serviceTotal', () => {
      const summary = buildCustomerPricingSummary({
        estimatedAmount: 0,
        invoiceData: { serviceTotal: 1199, totalAmount: 1199 },
      });
      expect(summary.estimatedAmount).toBe(1199);
    });

    it('treats missing invoice as zero estimate', () => {
      const summary = buildCustomerPricingSummary({});
      expect(summary).toMatchObject({
        estimatedAmount: 0,
        serviceTotal: 0,
        partsTotal: 0,
        totalAmount: 0,
        hasExtras: false,
        isFinal: false,
        displayLabel: 'Estimated',
      });
    });

    it('treats additional charges alone as extras', () => {
      const summary = buildCustomerPricingSummary({
        estimatedAmount: 299,
        invoiceData: {
          serviceTotal: 299,
          partsTotal: 0,
          additionalCharges: [{ amount: 100 }, { amount: undefined as any }],
          totalAmount: 399,
        },
      });
      expect(summary.hasExtras).toBe(true);
      expect(summary.additionalChargesTotal).toBe(100);
      expect(summary.displayLabel).toBe('Current total');
    });

    it('marks final via jobClosed, PAID_ONLINE, and PAYMENT_COLLECTED', () => {
      expect(
        buildCustomerPricingSummary({
          jobClosed: true,
          invoiceData: { serviceTotal: 100, totalAmount: 100 },
        }).isFinal,
      ).toBe(true);
      expect(
        buildCustomerPricingSummary({
          paymentStatus: 'PAID_ONLINE',
          invoiceData: { serviceTotal: 100, totalAmount: 100 },
        }).displayLabel,
      ).toBe('Final');
      expect(
        buildCustomerPricingSummary({
          status: 'PAYMENT_COLLECTED',
          invoiceData: { serviceTotal: 100, partsTotal: 50, totalAmount: 150 },
        }).displayLabel,
      ).toBe('Final');
    });

    it('recomputes total when totalAmount missing', () => {
      const summary = buildCustomerPricingSummary({
        estimatedAmount: 200,
        invoiceData: {
          serviceTotal: 200,
          partsTotal: 50,
          additionalCharges: [{ amount: 25 }],
        },
      });
      expect(summary.totalAmount).toBe(275);
      expect(summary.displayLabel).toBe('Current total');
    });

    it('does not treat zero-amount extras as extras', () => {
      const summary = buildCustomerPricingSummary({
        estimatedAmount: 400,
        invoiceData: {
          serviceTotal: 400,
          partsTotal: 0,
          additionalCharges: [{ amount: 0 }],
          totalAmount: 400,
        },
      });
      expect(summary.hasExtras).toBe(false);
      expect(summary.displayLabel).toBe('Estimated');
    });

    it('final label wins over extras', () => {
      const summary = buildCustomerPricingSummary({
        isBilled: true,
        estimatedAmount: 400,
        invoiceData: {
          serviceTotal: 400,
          partsTotal: 200,
          totalAmount: 600,
        },
      });
      expect(summary.displayLabel).toBe('Final');
    });
  });

  describe('resolveFrozenEstimatedAmount', () => {
    it('freezes the first non-zero estimate', () => {
      expect(resolveFrozenEstimatedAmount(0, 499)).toBe(499);
      expect(resolveFrozenEstimatedAmount(499, 999)).toBe(499);
      expect(resolveFrozenEstimatedAmount(undefined, 250)).toBe(250);
    });

    it('handles null existing and zero service totals', () => {
      expect(resolveFrozenEstimatedAmount(null, 0)).toBe(0);
      expect(resolveFrozenEstimatedAmount(null, 75)).toBe(75);
      expect(resolveFrozenEstimatedAmount(120, 0)).toBe(120);
    });
  });

  describe('pickUpcomingVisitSchedule', () => {
    it('picks earliest non-completed scheduled visit', () => {
      const visit = pickUpcomingVisitSchedule([
        {
          scheduledDate: '2026-09-25T10:00:00.000Z',
          status: 'COMPLETED',
          visitOrder: 1,
        },
        {
          scheduledDate: '2026-09-26T10:00:00.000Z',
          status: 'SCHEDULED',
          visitOrder: 2,
        },
        {
          scheduledDate: '2026-09-24T10:00:00.000Z',
          status: 'SCHEDULED',
          visitOrder: 3,
        },
      ]);
      expect(visit?.visitOrder).toBe(3);
      expect(String(visit?.scheduledDate)).toContain('2026-09-24');
    });

    it('returns null when nothing scheduled', () => {
      expect(pickUpcomingVisitSchedule([{ status: 'SCHEDULED' }])).toBeNull();
      expect(pickUpcomingVisitSchedule([])).toBeNull();
    });

    it('ignores completed visits even if they are earliest', () => {
      expect(
        pickUpcomingVisitSchedule([
          {
            scheduledDate: '2026-09-01T10:00:00.000Z',
            status: 'COMPLETED',
            visitOrder: 1,
          },
          {
            scheduledDate: '2026-09-10T10:00:00.000Z',
            status: 'IN_PROGRESS',
            visitOrder: 2,
          },
        ])?.visitOrder,
      ).toBe(2);
    });

    it('skips visits with null scheduledDate', () => {
      expect(
        pickUpcomingVisitSchedule([
          { scheduledDate: null, status: 'SCHEDULED', visitOrder: 1 },
          {
            scheduledDate: '2026-09-12T08:00:00.000Z',
            status: 'SCHEDULED',
            visitOrder: 2,
          },
        ])?.visitOrder,
      ).toBe(2);
    });
  });

  describe('resolveExpectedArrival', () => {
    it('prefers expectedArrivalAt over visit and preferred', () => {
      const result = resolveExpectedArrival(
        {
          expectedArrivalAt: '2026-09-23T15:00:00.000Z',
          preferredVisitDate: '2026-09-24',
          preferredVisitSlot: 'MORNING',
        },
        { scheduledDate: '2026-09-25T10:00:00.000Z' },
      );
      expect(result.source).toBe('expected');
      expect(result.expectedArrivalAt).toBe('2026-09-23T15:00:00.000Z');
    });

    it('falls back to visit then preferred', () => {
      expect(
        resolveExpectedArrival(
          { preferredVisitDate: '2026-09-24', preferredVisitSlot: 'EVENING' },
          { scheduledDate: '2026-09-25T10:00:00.000Z' },
        ).source,
      ).toBe('visit');

      expect(
        resolveExpectedArrival(
          { preferredVisitDate: '2026-09-24', preferredVisitSlot: 'EVENING' },
          null,
        ),
      ).toMatchObject({
        source: 'preferred',
        preferredVisitDate: '2026-09-24',
        preferredVisitSlot: 'EVENING',
      });
    });

    it('returns none when no schedule signals exist', () => {
      expect(resolveExpectedArrival({}, null)).toEqual({
        expectedArrivalAt: null,
        preferredVisitDate: null,
        preferredVisitSlot: null,
        source: 'none',
      });
    });

    it('preferred without slot still resolves', () => {
      expect(
        resolveExpectedArrival({ preferredVisitDate: '2026-10-01' }, null),
      ).toMatchObject({
        source: 'preferred',
        preferredVisitDate: '2026-10-01',
        preferredVisitSlot: null,
      });
    });
  });
});
