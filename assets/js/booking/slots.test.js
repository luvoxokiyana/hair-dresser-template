/* ==========================================================================
   slots.test.js — plain-node tests for the slot engine.
   Run: node assets/js/booking/slots.test.js
   ========================================================================== */

import {
  getAvailableSlots,
  sastToUtc,
  utcToSast,
  sastWeekday,
  overlaps,
} from './slots.js';

/* --- Tiny assertion harness --------------------------------------------- */

let passed = 0, failed = 0;
function eq(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { passed++; return; }
  failed++;
  console.error(`✗ ${label}\n   expected: ${e}\n   actual:   ${a}`);
}
function ok(cond, label) {
  if (cond) { passed++; return; }
  failed++;
  console.error(`✗ ${label}`);
}

/* --- Fixed "now" for deterministic tests -------------------------------- */
// Wed 2026-06-10, 08:00 SAST
const NOW = sastToUtc('2026-06-10', 8 * 60);

/* --- Helper: format slot list as SAST "HH:MM" --------------------------- */
function hm(date) {
  const { minutes } = utcToSast(date);
  const h = String(Math.floor(minutes / 60)).padStart(2, '0');
  const m = String(minutes % 60).padStart(2, '0');
  return `${h}:${m}`;
}
function slotStarts(slots) { return slots.map(s => hm(s.start)); }

/* ========================================================================
   Timezone helpers
   ======================================================================== */

eq(sastWeekday('2026-06-10'), 3, 'Wed is weekday 3');
eq(sastWeekday('2026-06-14'), 0, 'Sun is weekday 0');
eq(hm(sastToUtc('2026-06-10', 9 * 60)), '09:00', 'sastToUtc + utcToSast roundtrip');

ok(overlaps(0, 10, 5, 15) === true,  'overlaps: partial');
ok(overlaps(0, 10, 10, 20) === false, 'overlaps: touching is not overlap');
ok(overlaps(0, 10, 20, 30) === false, 'overlaps: disjoint');

/* ========================================================================
   Availability windows
   ======================================================================== */

const AVAIL = [{ weekday: 3, start_min: 9 * 60, end_min: 17 * 60, active: true }];

/* Empty day — a Wednesday with no bookings
   Window 09:00–17:00, service 60, no buffer, 30 min interval.
   Expected starts: 09:00, 09:30, 10:00, ..., 16:00 (17 slots) */
{
  const slots = getAvailableSlots({
    date: '2026-06-10',
    availability: AVAIL,
    bookings: [],
    blocks: [],
    serviceDuration: 60,
    bufferMin: 0,
    slotIntervalMin: 30,
    minNoticeHours: 0,
    maxAdvanceDays: 60,
    now: NOW,
  });
  eq(slots.length, 15, 'empty day, 60min service: 15 slots');
  eq(hm(slots[0].start), '09:00', 'first slot is 09:00');
  eq(hm(slots[slots.length - 1].start), '16:00', 'last slot is 16:00');
  eq(hm(slots[slots.length - 1].end), '17:00', 'last slot ends 17:00');
}

/* Same but service 90 min — last possible start is 15:30 */
{
  const slots = getAvailableSlots({
    date: '2026-06-10',
    availability: AVAIL,
    bookings: [], blocks: [],
    serviceDuration: 90,
    bufferMin: 0, slotIntervalMin: 30,
    minNoticeHours: 0, maxAdvanceDays: 60,
    now: NOW,
  });
  eq(hm(slots[slots.length - 1].start), '15:30', '90min service: last start 15:30');
}

/* No availability → no slots */
{
  const slots = getAvailableSlots({
    date: '2026-06-10',
    availability: [{ weekday: 1, start_min: 540, end_min: 1020, active: true }],
    bookings: [], blocks: [],
    serviceDuration: 60, bufferMin: 0, slotIntervalMin: 30,
    minNoticeHours: 0, maxAdvanceDays: 60, now: NOW,
  });
  eq(slots.length, 0, 'no matching weekday → no slots');
}

/* ========================================================================
   Existing bookings
   ======================================================================== */

/* Booking 10:00–11:00 blocks anything overlapping it.
   Service 60, no buffer.
   Slots that should be gone: 09:30, 10:00, 10:30, 11:00 */
{
  const slots = getAvailableSlots({
    date: '2026-06-10',
    availability: AVAIL,
    bookings: [{
      start: sastToUtc('2026-06-10', 10 * 60),
      end:   sastToUtc('2026-06-10', 11 * 60),
      status: 'confirmed',
    }],
    blocks: [],
    serviceDuration: 60, bufferMin: 0, slotIntervalMin: 30,
    minNoticeHours: 0, maxAdvanceDays: 60, now: NOW,
  });
  const starts = slotStarts(slots);
  ok(!starts.includes('09:30'), 'booking kills 09:30 start');
  ok(!starts.includes('10:00'), 'booking kills 10:00 start');
  ok(!starts.includes('10:30'), 'booking kills 10:30 start');
  ok(starts.includes('11:00'), 'booking kills 11:00 start (touching end)');
  ok(starts.includes('09:00'),  'booking does not kill 09:00 start');
  ok(starts.includes('11:30'),  'booking does not kill 11:30 start');
}

/* Cancelled bookings do not block */
{
  const slots = getAvailableSlots({
    date: '2026-06-10',
    availability: AVAIL,
    bookings: [{
      start: sastToUtc('2026-06-10', 10 * 60),
      end:   sastToUtc('2026-06-10', 11 * 60),
      status: 'cancelled',
    }],
    blocks: [],
    serviceDuration: 60, bufferMin: 0, slotIntervalMin: 30,
    minNoticeHours: 0, maxAdvanceDays: 60, now: NOW,
  });
  ok(slotStarts(slots).includes('10:00'), 'cancelled booking does not block');
}

/* ========================================================================
   Buffer
   ======================================================================== */

/* Booking 10:00–11:00 with 15-min buffer → blocked region 09:45–11:15.
   Service 30, no buffer needed from us.
   Starts 09:30 ends 10:00 → would extend into 09:45 buffer → blocked.
   Starts 09:00 ends 09:30 → fine.
   Starts 11:30 ends 12:00 → fine. */
{
  const slots = getAvailableSlots({
    date: '2026-06-10',
    availability: AVAIL,
    bookings: [{
      start: sastToUtc('2026-06-10', 10 * 60),
      end:   sastToUtc('2026-06-10', 11 * 60),
      status: 'confirmed',
    }],
    blocks: [],
    serviceDuration: 30, bufferMin: 15, slotIntervalMin: 30,
    minNoticeHours: 0, maxAdvanceDays: 60, now: NOW,
  });
  const starts = slotStarts(slots);
  ok(starts.includes('09:00'),  'buffer: 09:00 allowed');
  ok(!starts.includes('09:30'), 'buffer: 09:30 blocked (ends in buffer)');
  ok(!starts.includes('10:00'), 'buffer: 10:00 blocked');
  ok(!starts.includes('10:30'), 'buffer: 10:30 blocked (starts in buffer)');
  ok(!starts.includes('11:00'), 'buffer: 11:00 blocked (starts before 11:15)');
  ok(starts.includes('11:30'),  'buffer: 11:30 allowed');
}

/* ========================================================================
   Blocks (owner "this slot is taken")
   ======================================================================== */

{
  const slots = getAvailableSlots({
    date: '2026-06-10',
    availability: AVAIL,
    bookings: [],
    blocks: [{
      start: sastToUtc('2026-06-10', 14 * 60),
      end:   sastToUtc('2026-06-10', 16 * 60),
    }],
    serviceDuration: 60, bufferMin: 0, slotIntervalMin: 30,
    minNoticeHours: 0, maxAdvanceDays: 60, now: NOW,
  });
  const starts = slotStarts(slots);
  ok(!starts.includes('13:30'), 'block: 13:30 overlaps 14:00 block');
  ok(!starts.includes('14:00'), 'block: 14:00 blocked');
  ok(!starts.includes('15:00'), 'block: 15:00 blocked');
  ok(starts.includes('13:00'),  'block: 13:00 allowed');
  ok(starts.includes('16:00'),  'block: 16:00 allowed');
}

/* ========================================================================
   Minimum notice
   ======================================================================== */

/* now = 08:00 SAST, min notice = 4h → earliest 12:00 */
{
  const slots = getAvailableSlots({
    date: '2026-06-10',
    availability: AVAIL,
    bookings: [], blocks: [],
    serviceDuration: 60, bufferMin: 0, slotIntervalMin: 30,
    minNoticeHours: 4, maxAdvanceDays: 60, now: NOW,
  });
  const starts = slotStarts(slots);
  ok(!starts.includes('11:30'), 'notice: 11:30 too soon');
  ok(starts.includes('12:00'),  'notice: 12:00 is earliest');
}

/* ========================================================================
   Advance limit
   ======================================================================== */

{
  const slots = getAvailableSlots({
    date: '2026-09-10', // far future
    availability: AVAIL,
    bookings: [], blocks: [],
    serviceDuration: 60, bufferMin: 0, slotIntervalMin: 30,
    minNoticeHours: 0, maxAdvanceDays: 30, now: NOW,
  });
  eq(slots.length, 0, 'advance: too far in future → no slots');
}

/* Past dates → no slots */
{
  const slots = getAvailableSlots({
    date: '2026-06-03', // last week
    availability: AVAIL,
    bookings: [], blocks: [],
    serviceDuration: 60, bufferMin: 0, slotIntervalMin: 30,
    minNoticeHours: 0, maxAdvanceDays: 60, now: NOW,
  });
  eq(slots.length, 0, 'past date → no slots');
}

/* Exact-fit: 60min service in a 60min window */
{
  const slots = getAvailableSlots({
    date: '2026-06-10',
    availability: [{ weekday: 3, start_min: 9 * 60, end_min: 10 * 60, active: true }],
    bookings: [], blocks: [],
    serviceDuration: 60, bufferMin: 0, slotIntervalMin: 30,
    minNoticeHours: 0, maxAdvanceDays: 60, now: NOW,
  });
  eq(slots.length, 1, 'exact fit: one slot');
  eq(hm(slots[0].start), '09:00', 'exact fit: starts at window open');
  eq(hm(slots[0].end), '10:00', 'exact fit: ends at window close');
}

/* ========================================================================
   Result summary
   ======================================================================== */

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);