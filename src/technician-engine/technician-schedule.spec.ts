import {
  TechnicianEngineError,
  availabilityForJobEvent,
  liveJobQuery,
} from './technician-engine';
import {
  ScheduledJob,
  assertNotInPast,
  assertValidSlot,
  describeSlotClash,
  isWithinWorkingHours,
  freeSlots,
  isFixxerStaff,
  nextFreeStart,
  planOverrunShift,
  planPushAfter,
  serviceDayKey,
  slotConflicts,
  windowsOverlap,
  workdayBounds,
} from './technician-schedule';

/** IST wall-clock → UTC instant. ist('2026-11-24', '08:00') */
const ist = (day: string, hhmm: string) => new Date(`${day}T${hhmm}:00.000+05:30`);
const D = '2026-11-24';
const job = (
  bookingId: string,
  from: string,
  to: string,
  status = 'ASSIGNED',
): ScheduledJob => ({ bookingId, start: ist(D, from), end: ist(D, to), status });

describe('technician schedule (pure)', () => {
  describe('workday + validation', () => {
    it('uses 08:00–21:00 IST of the IST day', () => {
      const b = workdayBounds(ist(D, '23:30'));
      expect(b.start.toISOString()).toBe(ist(D, '08:00').toISOString());
      expect(b.end.toISOString()).toBe(ist(D, '21:00').toISOString());
      // 01:00 IST is still the same IST day even though UTC is the previous day
      expect(serviceDayKey(ist(D, '01:00'))).toBe(D);
    });

    it('accepts any admin-entered duration inside working hours', () => {
      expect(() => assertValidSlot({ start: ist(D, '08:00'), end: ist(D, '08:20') })).not.toThrow();
      expect(() => assertValidSlot({ start: ist(D, '19:00'), end: ist(D, '21:00') })).not.toThrow();
      expect(() =>
        assertValidSlot({ start: ist(D, '08:00').toISOString(), end: ist(D, '09:00').toISOString() }),
      ).not.toThrow();
    });

    it('working hours are soft: outside 8–21 is valid but flagged', () => {
      expect(() => assertValidSlot({ start: ist(D, '07:30'), end: ist(D, '09:00') })).not.toThrow();
      expect(isWithinWorkingHours({ start: ist(D, '07:30'), end: ist(D, '09:00') })).toBe(false);
      expect(isWithinWorkingHours({ start: ist(D, '20:00'), end: ist(D, '21:30') })).toBe(false);
      expect(isWithinWorkingHours({ start: ist(D, '08:00'), end: ist(D, '21:00') })).toBe(true);
    });

    it('rejects past slots (15-minute grace) and slots crossing midnight', () => {
      const now = ist(D, '12:00');
      expect(() => assertNotInPast({ start: ist(D, '11:50'), end: ist(D, '13:00') }, now)).not.toThrow();
      expect(() => assertNotInPast({ start: ist(D, '11:30'), end: ist(D, '13:00') }, now)).toThrow(/already passed/);
      expect(() =>
        assertValidSlot({ start: ist(D, '23:00'), end: new Date(ist(D, '23:00').getTime() + 2 * 3600_000) }),
      ).toThrow(/same day/);
    });

    it('rejects zero/negative length or bad dates', () => {
      expect(() => assertValidSlot({ start: ist(D, '10:00'), end: ist(D, '10:00') })).toThrow(/after its start/);
      expect(() => assertValidSlot({ start: 'nope', end: ist(D, '10:00') })).toThrow(TechnicianEngineError);
    });
  });

  describe('conflicts', () => {
    const day = [job('b1', '08:00', '10:00'), job('b2', '12:00', '14:00'), job('b3', '16:00', '18:00')];

    it('back-to-back slots do not clash (no travel gap)', () => {
      expect(windowsOverlap({ start: ist(D, '10:00'), end: ist(D, '12:00') }, day[0])).toBe(false);
      expect(slotConflicts({ start: ist(D, '10:00'), end: ist(D, '12:00') }, day)).toEqual([]);
    });

    it('finds the overlapping booking', () => {
      const c = slotConflicts({ start: ist(D, '13:00'), end: ist(D, '15:00') }, day);
      expect(c.map((j) => j.bookingId)).toEqual(['b2']);
    });

    it('ignores the booking being moved and bookings that no longer hold a slot', () => {
      expect(slotConflicts({ start: ist(D, '12:30'), end: ist(D, '13:30') }, day, 'b2')).toEqual([]);
      const done = [job('x', '12:00', '14:00', 'COMPLETED'), job('y', '12:00', '14:00', 'CANCELLED')];
      expect(slotConflicts({ start: ist(D, '12:00'), end: ist(D, '14:00') }, done)).toEqual([]);
    });
  });

  describe('free slots', () => {
    const day = [job('b1', '08:00', '10:00'), job('b2', '12:00', '14:00'), job('b3', '16:00', '18:00')];

    it('lists gaps that fit the duration', () => {
      const gaps = freeSlots(ist(D, '09:00'), day, 120).map((g) => [g.start, g.end]);
      expect(gaps).toEqual([
        [ist(D, '10:00'), ist(D, '12:00')],
        [ist(D, '14:00'), ist(D, '16:00')],
        [ist(D, '18:00'), ist(D, '21:00')],
      ]);
      expect(freeSlots(ist(D, '09:00'), day, 150).map((g) => g.start)).toEqual([ist(D, '18:00')]);
    });

    it('never offers time already past', () => {
      const gaps = freeSlots(ist(D, '09:00'), day, 60, ist(D, '15:00'));
      expect(gaps[0].start).toEqual(ist(D, '15:00'));
    });

    it('next free start: busy at 12, free after 1 hour', () => {
      const busy = [job('b1', '11:00', '13:00')];
      expect(nextFreeStart({ start: ist(D, '12:00'), end: ist(D, '14:00') }, busy)).toEqual(ist(D, '13:00'));
      expect(nextFreeStart({ start: ist(D, '20:00'), end: ist(D, '22:00') }, [])).toBeNull();
    });
  });

  describe('overrun shift', () => {
    it('does nothing while the job is within its slot', () => {
      const r = planOverrunShift([job('b1', '08:00', '10:00', 'IN_PROGRESS'), job('b2', '10:00', '12:00')], ist(D, '09:59'));
      expect(r).toEqual({ shifts: [], overflow: [] });
    });

    it('pushes the next not-started job by 1 hour when the previous is not closed', () => {
      const r = planOverrunShift([job('b1', '08:00', '10:00', 'IN_PROGRESS'), job('b2', '10:00', '12:00')], ist(D, '10:05'));
      expect(r.shifts).toEqual([
        { bookingId: 'b2', from: { start: ist(D, '10:00'), end: ist(D, '12:00') }, to: { start: ist(D, '11:00'), end: ist(D, '13:00') } },
      ]);
    });

    it('is idempotent within the same hour and steps again an hour later', () => {
      const shifted = [job('b1', '08:00', '10:00', 'IN_PROGRESS'), job('b2', '11:00', '13:00')];
      expect(planOverrunShift(shifted, ist(D, '10:40')).shifts).toEqual([]);
      expect(planOverrunShift(shifted, ist(D, '11:05')).shifts[0].to.start).toEqual(ist(D, '12:00'));
    });

    it('cascades inward through the day', () => {
      const r = planOverrunShift(
        [job('b1', '08:00', '10:00', 'IN_PROGRESS'), job('b2', '10:00', '12:00'), job('b3', '12:00', '14:00'), job('b4', '16:00', '17:00')],
        ist(D, '10:01'),
      );
      expect(r.shifts.map((s) => [s.bookingId, s.to.start])).toEqual([
        ['b2', ist(D, '11:00')],
        ['b3', ist(D, '13:00')],
      ]);
    });

    it('stops once the previous job is closed', () => {
      const r = planOverrunShift([job('b1', '08:00', '10:00', 'COMPLETED'), job('b2', '10:00', '12:00')], ist(D, '10:30'));
      expect(r.shifts).toEqual([]);
    });

    it('never moves a job that is already en route / in progress', () => {
      const r = planOverrunShift(
        [job('b1', '08:00', '10:00', 'IN_PROGRESS'), job('b2', '10:00', '12:00', 'EN_ROUTE')],
        ist(D, '10:10'),
      );
      expect(r.shifts).toEqual([]);
    });

    it('keeps a deliberate admin overlap until there is a real overrun', () => {
      const r = planOverrunShift([job('b1', '08:00', '10:00', 'IN_PROGRESS'), job('b2', '09:00', '11:00')], ist(D, '09:30'));
      expect(r.shifts).toEqual([]);
    });

    it('a job waiting for parts never pushes the day', () => {
      const r = planOverrunShift(
        [{ ...job('b1', '08:00', '10:00', 'IN_PROGRESS'), paused: true }, job('b2', '10:00', '12:00')],
        ist(D, '10:30'),
      );
      expect(r.shifts).toEqual([]);
    });

    it('admin extension pushes overlapping later jobs right away, cascading', () => {
      const r = planPushAfter(
        [job('b1', '08:00', '12:00', 'IN_PROGRESS'), job('b2', '10:00', '12:00'), job('b3', '12:00', '13:00'), job('b4', '16:00', '17:00')],
        'b1',
        ist(D, '09:00'),
      );
      expect(r.shifts.map((s) => [s.bookingId, s.to.start])).toEqual([
        ['b2', ist(D, '12:00')],
        ['b3', ist(D, '14:00')],
      ]);
    });

    it('reports overflow instead of pushing past 9 PM', () => {
      const r = planOverrunShift([job('b1', '17:00', '19:00', 'IN_PROGRESS'), job('b2', '19:00', '21:00')], ist(D, '19:05'));
      expect(r).toEqual({ shifts: [], overflow: ['b2'] });
    });
  });

  describe('staff availability', () => {
    it('staff stay AVAILABLE when assigned/accepted, ON_JOB once working', () => {
      expect(isFixxerStaff({ employmentType: 'FIXXER_STAFF' })).toBe(true);
      expect(availabilityForJobEvent('ADMIN_ASSIGNED', 'FIXXER_STAFF')).toBeNull();
      expect(availabilityForJobEvent('ACCEPTED', 'FIXXER_STAFF')).toBeNull();
      expect(availabilityForJobEvent('JOB_IN_PROGRESS', 'FIXXER_STAFF')).toBe('ON_JOB');
      expect(availabilityForJobEvent('JOB_COMPLETED', 'FIXXER_STAFF')).toBe('AVAILABLE');
    });

    it('partners are unchanged', () => {
      expect(availabilityForJobEvent('ADMIN_ASSIGNED', 'PARTNER')).toBe('ON_JOB');
      expect(availabilityForJobEvent('ADMIN_ASSIGNED')).toBe('ON_JOB');
    });
  });

  describe('staff guards + messages', () => {
    it('live job = on the way or on site only', () => {
      expect((liveJobQuery().status as any).$in).toEqual(['EN_ROUTE', 'IN_PROGRESS']);
    });

    it('explains a clash with the next free time', () => {
      const msg = describeSlotClash({
        conflicts: [job('b1', '12:00', '14:00')],
        technicianUnavailable: false,
        nextFreeStart: ist(D, '14:00'),
      });
      expect(msg).toMatch(/busy 12:00\s?pm–2:00\s?pm/i);
      expect(msg).toMatch(/Free from 2:00\s?pm/i);
      expect(
        describeSlotClash({ conflicts: [], technicianUnavailable: true, nextFreeStart: null }),
      ).toMatch(/unavailable/);
      expect(
        describeSlotClash({ conflicts: [], technicianUnavailable: false, nextFreeStart: null, outsideWorkingHours: true }),
      ).toMatch(/outside working hours/);
    });
  });
});
