import { BadRequestException } from '@nestjs/common';
import { assertValidCalendarDate, isValidCalendarDate } from './calendar-date';

describe('calendar-date', () => {
  it('accepts real YYYY-MM-DD days and rejects impossible ones', () => {
    expect(isValidCalendarDate('2026-02-28')).toBe(true);
    expect(isValidCalendarDate('2024-02-29')).toBe(true);
    expect(isValidCalendarDate('2026-02-29')).toBe(false);
    expect(isValidCalendarDate('2026-02-31')).toBe(false);
    expect(isValidCalendarDate('2026-13-01')).toBe(false);
    expect(isValidCalendarDate('2026-00-10')).toBe(false);
    expect(isValidCalendarDate('not-a-date')).toBe(false);
    expect(isValidCalendarDate('2026/02/28')).toBe(false);
  });

  it('assertValidCalendarDate throws BadRequestException', () => {
    expect(() => assertValidCalendarDate('2026-02-31', 'preferredVisitDate')).toThrow(
      BadRequestException,
    );
    expect(() => assertValidCalendarDate('2026-09-24')).not.toThrow();
  });
});
