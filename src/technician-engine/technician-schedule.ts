/**
 * Pure slot rules for admin-scheduled Fixxer staff technicians.
 * No Nest / Mongoose imports — callers pass plain windows in, get plain answers back.
 *
 * Rules (product decisions):
 * - Working day is 08:00–21:00 IST — a SOFT limit for the admin (warning + override),
 *   a hard limit for the automatic overrun shift. Duration is always admin-entered.
 * - No slots in the past (15-minute grace so "starting now" works).
 * - No travel gap: a job ending 12:00 and one starting 12:00 do not clash.
 * - A clash is a warning — the admin may still assign (override).
 * - Overrun: when a job is past its end and not closed, later not-started jobs of that
 *   technician move forward in 1-hour steps, cascading. Jobs already EN_ROUTE /
 *   IN_PROGRESS are never moved. A move that would end after 21:00 is not made (overflow).
 */
import { TechnicianEngineError } from './technician-engine';

export const SERVICE_UTC_OFFSET_MINUTES = 330; // IST, no DST
export const WORKDAY_START_MINUTES = 8 * 60;
export const WORKDAY_END_MINUTES = 21 * 60;
export const OVERRUN_SHIFT_MINUTES = 60;

const MINUTE = 60_000;
const SHIFT_MS = OVERRUN_SHIFT_MINUTES * MINUTE;

/** Statuses in which a scheduled booking holds its slot. */
export const SLOT_HOLDING_STATUSES = ['ASSIGNED', 'EN_ROUTE', 'IN_PROGRESS'] as const;

/** Pre-arrival: the only status the overrun shift may move. */
export const SLOT_MOVABLE_STATUSES = ['ASSIGNED'] as const;

export interface SlotWindow {
  start: Date;
  end: Date;
}

export interface ScheduledJob extends SlotWindow {
  bookingId: string;
  status: string;
  /** Waiting for parts: its overrun never pushes the rest of the day. */
  paused?: boolean;
}

export interface SlotShift {
  bookingId: string;
  from: SlotWindow;
  to: SlotWindow;
}

export function isFixxerStaff(tech?: { employmentType?: string | null } | null): boolean {
  return tech?.employmentType === 'FIXXER_STAFF';
}

function holdsSlot(status: string): boolean {
  return (SLOT_HOLDING_STATUSES as readonly string[]).includes(String(status).toUpperCase());
}

function isMovable(status: string): boolean {
  return (SLOT_MOVABLE_STATUSES as readonly string[]).includes(String(status).toUpperCase());
}

/** IST calendar day key (YYYY-MM-DD) for an instant. */
export function serviceDayKey(at: Date): string {
  return new Date(at.getTime() + SERVICE_UTC_OFFSET_MINUTES * MINUTE).toISOString().slice(0, 10);
}

/** Minutes since IST midnight for an instant. */
function serviceMinuteOfDay(at: Date): number {
  const local = new Date(at.getTime() + SERVICE_UTC_OFFSET_MINUTES * MINUTE);
  return local.getUTCHours() * 60 + local.getUTCMinutes() + local.getUTCSeconds() / 60;
}

/** 08:00 and 21:00 IST of the IST day containing `at`, as UTC instants. */
export function workdayBounds(at: Date): SlotWindow {
  const midnightUtc =
    Date.parse(`${serviceDayKey(at)}T00:00:00.000Z`) - SERVICE_UTC_OFFSET_MINUTES * MINUTE;
  return {
    start: new Date(midnightUtc + WORKDAY_START_MINUTES * MINUTE),
    end: new Date(midnightUtc + WORKDAY_END_MINUTES * MINUTE),
  };
}

/** Touching windows (end === start) do not overlap. */
export function windowsOverlap(a: SlotWindow, b: SlotWindow): boolean {
  return a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime();
}

/** Grace for "starting now": a slot may start up to this long before the current time. */
export const PAST_SLOT_GRACE_MINUTES = 15;

/**
 * Validate an admin-entered slot (hard rules): real dates, positive duration, within a
 * single IST calendar day. Working hours are checked separately (soft — see
 * isWithinWorkingHours) so the admin can override them.
 */
export function assertValidSlot(window: { start?: unknown; end?: unknown }): SlotWindow {
  const start = window.start instanceof Date ? window.start : new Date(String(window.start ?? ''));
  const end = window.end instanceof Date ? window.end : new Date(String(window.end ?? ''));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new TechnicianEngineError('Slot start and end must be valid date-times');
  }
  if (end.getTime() <= start.getTime()) {
    throw new TechnicianEngineError('Slot end must be after its start');
  }
  const dayEnd = workdayBounds(start).start.getTime() + 16 * 60 * MINUTE; // next IST midnight
  if (end.getTime() > dayEnd) {
    throw new TechnicianEngineError('A slot must start and end on the same day');
  }
  return { start, end };
}

/** No new slot in the past (with a short grace for "starting now"). */
export function assertNotInPast(window: SlotWindow, now: Date): void {
  if (window.start.getTime() < now.getTime() - PAST_SLOT_GRACE_MINUTES * MINUTE) {
    throw new TechnicianEngineError('That time has already passed. Pick a time from now on.');
  }
}

/** Inside 08:00–21:00 IST of its day (soft rule for the admin). */
export function isWithinWorkingHours(window: SlotWindow): boolean {
  const day = workdayBounds(window.start);
  return (
    window.start.getTime() >= day.start.getTime() && window.end.getTime() <= day.end.getTime()
  );
}

/** Slot-holding jobs that overlap `window` (optionally ignoring one booking). */
export function slotConflicts(
  window: SlotWindow,
  jobs: readonly ScheduledJob[],
  excludeBookingId?: string,
): ScheduledJob[] {
  return jobs.filter(
    (job) =>
      job.bookingId !== excludeBookingId &&
      holdsSlot(job.status) &&
      windowsOverlap(window, job),
  );
}

function holdingWindowsSorted(jobs: readonly ScheduledJob[], excludeBookingId?: string) {
  return jobs
    .filter((j) => j.bookingId !== excludeBookingId && holdsSlot(j.status))
    .map((j) => ({ start: j.start, end: j.end }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

/**
 * Free gaps of at least `durationMinutes` in the working day containing `day`.
 * Gaps before `now` (if given) are trimmed so past time is never offered.
 */
export function freeSlots(
  day: Date,
  jobs: readonly ScheduledJob[],
  durationMinutes: number,
  now?: Date,
): SlotWindow[] {
  if (!(durationMinutes > 0)) {
    throw new TechnicianEngineError('Duration must be greater than zero');
  }
  const bounds = workdayBounds(day);
  let cursor = Math.max(bounds.start.getTime(), now ? now.getTime() : 0);
  const endOfDay = bounds.end.getTime();
  const need = durationMinutes * MINUTE;
  const gaps: SlotWindow[] = [];
  for (const w of holdingWindowsSorted(jobs)) {
    const ws = w.start.getTime();
    const we = w.end.getTime();
    if (we <= cursor) continue;
    if (ws >= endOfDay) break;
    if (ws - cursor >= need) gaps.push({ start: new Date(cursor), end: new Date(ws) });
    cursor = Math.max(cursor, we);
  }
  if (endOfDay - cursor >= need) gaps.push({ start: new Date(cursor), end: new Date(endOfDay) });
  return gaps;
}

/**
 * Earliest start ≥ `window.start` on the same working day where a slot of the same
 * length fits ("busy now, free after 1 hour"). Null if nothing fits before 21:00.
 */
export function nextFreeStart(
  window: SlotWindow,
  jobs: readonly ScheduledJob[],
  excludeBookingId?: string,
): Date | null {
  const need = window.end.getTime() - window.start.getTime();
  const endOfDay = workdayBounds(window.start).end.getTime();
  let candidate = window.start.getTime();
  for (const w of holdingWindowsSorted(jobs, excludeBookingId)) {
    if (w.end.getTime() <= candidate) continue;
    if (w.start.getTime() >= candidate + need) break;
    candidate = w.end.getTime();
  }
  return candidate + need <= endOfDay ? new Date(candidate) : null;
}

/** Smallest whole number of 1-hour steps that moves `from` strictly/at-least past `to`. */
function stepsToReach(from: number, to: number, strict: boolean): number {
  const diff = to - from;
  if (strict ? diff < 0 : diff <= 0) return strict ? 1 : 0;
  const steps = Math.ceil(diff / SHIFT_MS);
  return strict && from + steps * SHIFT_MS <= to ? steps + 1 : steps;
}

/**
 * Overrun plan for ONE technician's jobs on ONE day.
 *
 * A job that is past its scheduled end and still holds its slot is "overrunning": its
 * effective end grows in 1-hour steps until it is closed. Later movable (ASSIGNED) jobs
 * that start before the running cursor are pushed by whole hours to start at/after it;
 * each pushed job then pushes the next. Jobs that are neither overrunning nor pushed do
 * not move anything — an admin's deliberate overlap stays as planned until a real overrun.
 * Jobs waiting for parts (`paused`) never push anything.
 *
 * Idempotent: running again at a later `now` only moves jobs further when the overrun
 * itself has grown.
 */
export function planOverrunShift(
  jobs: readonly ScheduledJob[],
  now: Date,
): { shifts: SlotShift[]; overflow: string[] } {
  return cascade(jobs, now);
}

/**
 * The admin extended (or re-timed) `sourceBookingId`: push that technician's later
 * not-started jobs that now overlap it, by whole hours, cascading — same rules as the
 * overrun shift (never past 9 PM, never moves EN_ROUTE / IN_PROGRESS).
 */
export function planPushAfter(
  jobs: readonly ScheduledJob[],
  sourceBookingId: string,
  now: Date,
): { shifts: SlotShift[]; overflow: string[] } {
  return cascade(jobs, now, sourceBookingId);
}

function cascade(
  jobs: readonly ScheduledJob[],
  now: Date,
  sourceBookingId?: string,
): { shifts: SlotShift[]; overflow: string[] } {
  const nowMs = now.getTime();
  const sorted = [...jobs]
    .filter((j) => holdsSlot(j.status))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const shifts: SlotShift[] = [];
  const overflow: string[] = [];
  let cursor = -Infinity;

  for (const job of sorted) {
    const isSource = job.bookingId === sourceBookingId;
    let start = job.start.getTime();
    let end = job.end.getTime();
    let pushedByCursor = false;

    if (!isSource && !job.paused && isMovable(job.status) && start < cursor) {
      const steps = stepsToReach(start, cursor, false);
      const nextStart = start + steps * SHIFT_MS;
      const nextEnd = end + steps * SHIFT_MS;
      if (nextEnd > workdayBounds(job.start).end.getTime()) {
        overflow.push(job.bookingId);
        // Leave it where it is, but later jobs still queue behind the intended end.
        cursor = Math.max(cursor, nextEnd);
        continue;
      }
      shifts.push({
        bookingId: job.bookingId,
        from: { start: job.start, end: job.end },
        to: { start: new Date(nextStart), end: new Date(nextEnd) },
      });
      start = nextStart;
      end = nextEnd;
      pushedByCursor = true;
    }

    if (job.paused) continue;

    let effectiveEnd = end;
    const overrunning = end <= nowMs;
    if (overrunning) {
      effectiveEnd = end + stepsToReach(end, nowMs, true) * SHIFT_MS;
    }

    if (overrunning || pushedByCursor || isSource) {
      cursor = Math.max(cursor, effectiveEnd);
    }
  }

  return { shifts, overflow };
}

/** "12:30 pm" in IST — for admin/technician-facing messages. */
export function formatServiceTime(at: Date): string {
  return at.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** "Tue, 24 Nov, 12:30 pm" in IST. */
export function formatServiceDateTime(at: Date): string {
  return at.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Admin-facing explanation of a clash, e.g. "Busy 12:00 pm–2:00 pm. Free from 2:00 pm." */
export function describeSlotClash(input: {
  conflicts: readonly SlotWindow[];
  technicianUnavailable: boolean;
  nextFreeStart: Date | null;
  outsideWorkingHours?: boolean;
}): string {
  if (input.technicianUnavailable) {
    return 'Technician is marked unavailable (off duty).';
  }
  if (!input.conflicts.length && input.outsideWorkingHours) {
    return 'This slot is outside working hours (8:00 AM – 9:00 PM).';
  }
  const busy = input.conflicts
    .map((c) => `${formatServiceTime(c.start)}–${formatServiceTime(c.end)}`)
    .join(', ');
  const free = input.nextFreeStart
    ? ` Free from ${formatServiceTime(input.nextFreeStart)}.`
    : ' No free slot of this length left today.';
  const hours = input.outsideWorkingHours ? ' Also outside working hours (8 AM – 9 PM).' : '';
  return `Technician is busy ${busy}.${free}${hours}`;
}
