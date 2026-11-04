import { BadRequestException } from '@nestjs/common';

/**
 * Accepts YYYY-MM-DD only when year/month/day form a real calendar day
 * (rejects 2026-02-31, 2026-13-01, etc.).
 */
export function isValidCalendarDate(iso: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '').trim());
  if (!m) return false;
  const y = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const dt = new Date(Date.UTC(y, month - 1, day));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === month - 1 &&
    dt.getUTCDate() === day
  );
}

export function assertValidCalendarDate(iso: string, label = 'date'): void {
  if (!isValidCalendarDate(iso)) {
    throw new BadRequestException(
      `Invalid ${label}: use a real YYYY-MM-DD calendar day`,
    );
  }
}
