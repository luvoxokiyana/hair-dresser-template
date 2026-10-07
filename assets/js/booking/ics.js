/* ==========================================================================
   ics.js — Minimal ICS (iCalendar) generator.
   Produces a single VEVENT that phone calendars can import.
   ========================================================================== */

/**
 * Build a valid ICS string for a single event.
 * @param {object} ev
 * @param {string} ev.uid
 * @param {Date}   ev.start
 * @param {Date}   ev.end
 * @param {string} ev.title
 * @param {string} [ev.description]
 * @param {string} [ev.location]
 * @returns {string}
 */
export function buildIcs(ev) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Kaya//Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${ev.uid}`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(ev.start)}`,
    `DTEND:${icsDate(ev.end)}`,
    `SUMMARY:${icsEscape(ev.title || 'Appointment')}`,
    ev.description ? `DESCRIPTION:${icsEscape(ev.description)}` : '',
    ev.location ? `LOCATION:${icsEscape(ev.location)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);

  return lines.join('\r\n') + '\r\n';
}

/**
 * Trigger a browser download of an ICS string.
 */
export function downloadIcs(content, filename) {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'appointment.ics';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* --- Internal ----------------------------------------------------------- */

/**
 * Format a Date as an ICS UTC timestamp: YYYYMMDDTHHMMSSZ
 */
function icsDate(d) {
  const date = d instanceof Date ? d : new Date(d);
  const pad = (n) => String(n).padStart(2, '0');
  return (
    date.getUTCFullYear() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) + 'T' +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) + 'Z'
  );
}

/**
 * Escape special characters per RFC 5545.
 */
function icsEscape(s) {
  if (s == null) return '';
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}