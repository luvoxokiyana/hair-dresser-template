/* ==========================================================================
   slots.js — Pure slot generation engine.
   No DOM, no Supabase, no dependencies. Testable in isolation.

   All absolute times are JS Date objects (interpreted as UTC ms).
   All window inputs use minutes-from-midnight in the salon's local timezone.
   ========================================================================== */

export const SAST_OFFSET_MIN = 120; // UTC+2, no DST

/* --- Helpers ------------------------------------------------------------- */

/* --- Date boundary helpers (used by admin dashboard) -------------------- */

/**
 * Start of a SAST day, as a UTC Date.
 * @param {Date|string} when
 */
export function startOfDaySast(when = new Date()) {
  const { dateStr } = utcToSast(when instanceof Date ? when : new Date(when));
  return sastToUtc(dateStr, 0);
}

/**
 * End of a SAST day (exclusive — 00:00 next day), as a UTC Date.
 */
export function endOfDaySast(when = new Date()) {
  const start = startOfDaySast(when);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

/**
 * Start of the SAST week (Monday 00:00), as a UTC Date.
 * ISO weeks start Monday; JS getUTCDay() returns 0 for Sunday.
 */
export function startOfWeekSast(when = new Date()) {
  const startToday = startOfDaySast(when);
  const { dateStr } = utcToSast(startToday);
  const weekday = sastWeekday(dateStr); // 0=Sun … 6=Sat
  const offset = weekday === 0 ? 6 : weekday - 1; // days since Monday
  return new Date(startToday.getTime() - offset * 24 * 60 * 60 * 1000);
}

/**
 * End of the SAST week (exclusive — next Monday 00:00), as a UTC Date.
 */
export function endOfWeekSast(when = new Date()) {
  return new Date(startOfWeekSast(when).getTime() + 7 * 24 * 60 * 60 * 1000);
}

/**
 * Return ISO YYYY-MM-DD for a UTC Date, in SAST.
 */
export function toSastDateStr(when) {
  return utcToSast(when instanceof Date ? when : new Date(when)).dateStr;
}

/**
 * Convert a SAST calendar date (YYYY-MM-DD) + minutes-from-midnight
 * into a UTC Date.
 */
export function sastToUtc(dateStr, minutesFromMidnight) {
  const [y, m, d] = dateStr.split('-').map(Number);
  // Build a UTC timestamp for that local time, then subtract the offset.
  const utcMs = Date.UTC(y, m - 1, d, 0, 0, 0, 0)
    + minutesFromMidnight * 60_000
    - SAST_OFFSET_MIN * 60_000;
  return new Date(utcMs);
}

/**
 * Convert a UTC Date to { dateStr, minutes } in SAST.
 */
export function utcToSast(date) {
  const shifted = new Date(date.getTime() + SAST_OFFSET_MIN * 60_000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  const minutes = shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
  return { dateStr: `${y}-${m}-${d}`, minutes };
}

/**
 * Weekday (0=Sun … 6=Sat) for a SAST date string.
 */
export function sastWeekday(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  // Use UTC noon to avoid edge-of-day issues.
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return dt.getUTCDay();
}

/**
 * Return true if two half-open intervals [aStart, aEnd) and [bStart, bEnd)
 * overlap. Zero-length intervals are treated as non-overlapping.
 */
export function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

/* --- Main engine --------------------------------------------------------- */

/**
 * Generate available booking slots for a single day.
 *
 * @param {object}   opts
 * @param {string}   opts.date              YYYY-MM-DD (SAST)
 * @param {Array}    opts.availability      [{weekday, start_min, end_min, active}]
 * @param {Array}    opts.bookings          [{start: Date, end: Date, status}]
 * @param {Array}    opts.blocks            [{start: Date, end: Date}]
 * @param {number}   opts.serviceDuration   minutes
 * @param {number}   opts.bufferMin         minutes after each booking
 * @param {number}   opts.slotIntervalMin   minutes between candidate slots
 * @param {number}   opts.minNoticeHours    minimum hours from now
 * @param {number}   opts.maxAdvanceDays    maximum days from today
 * @param {Date}     [opts.now]             injectable for tests
 * @returns {{ start: Date, end: Date }[]}
 */
export function getAvailableSlots(opts) {
  const {
    date,
    availability = [],
    bookings = [],
    blocks = [],
    serviceDuration,
    bufferMin = 0,
    slotIntervalMin = 30,
    minNoticeHours = 0,
    maxAdvanceDays = 365,
    now = new Date(),
  } = opts;

  if (!date || !serviceDuration || serviceDuration <= 0) return [];

  /* --- Guard: advance window ------------------------------------------- */
  const startOfDayUtc = sastToUtc(date, 0);
  const dayMs = 24 * 60 * 60 * 1000;
  const todayUtc = sastToUtc(utcToSast(now).dateStr, 0);
  const daysFromToday = Math.round((startOfDayUtc - todayUtc) / dayMs);
  if (daysFromToday < 0) return [];                    // past day
  if (daysFromToday > maxAdvanceDays) return [];       // too far ahead

  /* --- Filter availability for this weekday ---------------------------- */
  const weekday = sastWeekday(date);
  const windows = availability
    .filter(a => a.active !== false && a.weekday === weekday)
    .sort((a, b) => a.start_min - b.start_min);

  if (!windows.length) return [];

  /* --- Normalise bookings + blocks to Date intervals ------------------- */
  const busy = [];
  for (const b of bookings) {
    if (b.status && b.status !== 'confirmed' && b.status !== 'completed') continue;
    busy.push({ start: toDate(b.start), end: toDate(b.end) });
  }
  for (const bl of blocks) {
    busy.push({ start: toDate(bl.start), end: toDate(bl.end) });
  }
  busy.sort((a, b) => a.start - b.start);

  /* --- Compute earliest bookable time from min notice ------------------ */
  const earliestFromNotice = new Date(now.getTime() + minNoticeHours * 60 * 60 * 1000);

  /* --- Walk each window, generate candidates --------------------------- */
  const slots = [];
  const durMs = serviceDuration * 60_000;
  const bufMs = bufferMin * 60_000;
  const stepMs = slotIntervalMin * 60_000;

  for (const w of windows) {
    const windowStart = sastToUtc(date, w.start_min);
    const windowEnd   = sastToUtc(date, w.end_min);

    for (let t = windowStart.getTime(); t + durMs <= windowEnd.getTime(); t += stepMs) {
      const slotStart = new Date(t);
      const slotEnd   = new Date(t + durMs);

      /* Skip slots before min notice */
      if (slotStart < earliestFromNotice) continue;

      /* Skip if overlapping any busy interval (with buffer on both sides) */
      let conflict = false;
      for (const b of busy) {
        const bStart = b.start.getTime() - bufMs;
        const bEnd   = b.end.getTime() + bufMs;
        if (overlaps(slotStart.getTime(), slotEnd.getTime(), bStart, bEnd)) {
          conflict = true;
          break;
        }
      }
      if (conflict) continue;

      slots.push({ start: slotStart, end: slotEnd });
    }
  }

  return slots;
}

/* --- Internal ------------------------------------------------------------ */

function toDate(x) {
  return x instanceof Date ? x : new Date(x);
}