/* ==========================================================================
   calendar.js — Phase 2d-ii.
   Week and day views. Mon–Sun by default, configurable via settings.
   Read-only. Click a booking → slide-over (shared with bookings.js).
   ========================================================================== */

import { supabase, getSettings } from '/assets/js/supabase.js';
import {
  guard, mountSidebar, mountTopbar, mountUser,
  formatTime, openSlideOver,
} from './admin.js';
import {
  startOfDaySast, endOfDaySast,
  startOfWeekSast, endOfWeekSast,
  sastToUtc, utcToSast, sastWeekday, toSastDateStr,
} from '/assets/js/booking/slots.js';

/* --- Constants ----------------------------------------------------------- */

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const WEEKDAY_SHORT = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
const WEEKDAY_LONG = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday',
  fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
};

/* Weekday index → key (JS getUTCDay returns 0=Sun…6=Sat) */
const DOW_KEY = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/* --- State --------------------------------------------------------------- */

const state = {
  view: 'week',          // 'week' | 'day'
  anchor: new Date(),    // any date inside the visible range
  settings: null,
  visibleDays: WEEKDAYS, // derived from settings
  dayStartMin: 8 * 60,   // 08:00
  dayEndMin:   19 * 60,  // 19:00
  bookings: [],
};

const els = {};

/* --- Auth + shell -------------------------------------------------------- */

const session = await guard();
if (session) {
  mountSidebar('calendar');
  mountTopbar('Calendar');
  await mountUser(session);
  await init();
}

/* --- Init ---------------------------------------------------------------- */

async function init() {
  els.scroll    = document.getElementById('cal-scroll');
  els.grid      = document.getElementById('cal-grid');
  els.range     = document.getElementById('cal-range');
  els.prev      = document.getElementById('cal-prev');
  els.next      = document.getElementById('cal-next');
  els.today     = document.getElementById('cal-today');
  els.viewBtns  = document.querySelectorAll('[data-view]');

  /* Read URL */
  const p = new URLSearchParams(location.search);
  if (p.get('view') === 'day' || p.get('view') === 'week') state.view = p.get('view');
  if (p.get('date')) {
    const d = parseSastDate(p.get('date'));
    if (d) state.anchor = d;
  }

  /* Load settings (optional) */
  try {
    state.settings = await getSettings();
  } catch { /* fall back to defaults */ }

  deriveCalendarBounds();

  /* Wire toolbar */
  els.prev.addEventListener('click', () => { shift(-1); });
  els.next.addEventListener('click', () => { shift(1); });
  els.today.addEventListener('click', () => { state.anchor = new Date(); fetchAndRender(); syncUrl(); });
  els.viewBtns.forEach(b => b.addEventListener('click', () => {
    state.view = b.getAttribute('data-view');
    els.viewBtns.forEach(x => x.classList.toggle('is-active', x === b));
    fetchAndRender();
    syncUrl();
  }));
  /* Apply initial active state */
  els.viewBtns.forEach(x => x.classList.toggle('is-active', x.getAttribute('data-view') === state.view));

  await fetchAndRender();

  /* Scroll to now (or 08:00) */
  requestAnimationFrame(scrollToRelevantTime);
}

/* --- Bounds from settings ------------------------------------------------ */

function deriveCalendarBounds() {
  const s = state.settings || {};

  /* Days shown */
  if (Array.isArray(s.calendar_days) && s.calendar_days.length) {
    state.visibleDays = s.calendar_days.filter(k => WEEKDAYS.includes(k));
    if (!state.visibleDays.length) state.visibleDays = WEEKDAYS;
  } else if (state.view === 'week') {
    state.visibleDays = WEEKDAYS;
  }

  /* Hours shown */
  if (s.calendar_hours && s.calendar_hours.start && s.calendar_hours.end) {
    state.dayStartMin = parseHHMM(s.calendar_hours.start) ?? state.dayStartMin;
    state.dayEndMin   = parseHHMM(s.calendar_hours.end)   ?? state.dayEndMin;
  }
}

function parseHHMM(s) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

/* --- URL ----------------------------------------------------------------- */

function syncUrl() {
  const p = new URLSearchParams();
  if (state.view !== 'week') p.set('view', state.view);
  const anchorStr = toSastDateStr(state.anchor);
  p.set('date', anchorStr);
  history.replaceState(null, '', `?${p.toString()}`);
}

function parseSastDate(str) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  const [y, m, d] = str.split('-').map(Number);
  return sastToUtc(str, 12 * 60); // noon SAST to avoid DST edges
}

/* --- Navigation ---------------------------------------------------------- */

function shift(dir) {
  if (state.view === 'week') {
    state.anchor = new Date(state.anchor.getTime() + dir * 7 * 24 * 60 * 60 * 1000);
  } else {
    state.anchor = new Date(state.anchor.getTime() + dir * 24 * 60 * 60 * 1000);
  }
  fetchAndRender();
  syncUrl();
}

/* --- Fetch --------------------------------------------------------------- */

function visibleRange() {
  if (state.view === 'week') {
    const start = startOfWeekSast(state.anchor);
    const end   = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
    return { from: start, to: end, days: weekDaysFrom(start) };
  }
  const start = startOfDaySast(state.anchor);
  const end   = endOfDaySast(state.anchor);
  return { from: start, to: end, days: [start] };
}

function weekDaysFrom(weekStart) {
  return Array.from({ length: 7 }, (_, i) =>
    new Date(weekStart.getTime() + i * 24 * 60 * 60 * 1000)
  );
}

async function fetchAndRender() {
  els.grid.innerHTML = `<div class="a-empty"><h3>Loading…</h3></div>`;

  const { from, to } = visibleRange();

  const { data, error } = await supabase
    .from('bookings')
    .select(`
      id, start_at, end_at, status, notes,
      clients ( id, name, phone, email ),
      services ( id, name, price, duration_min )
    `)
    .gte('start_at', from.toISOString())
    .lt('start_at', to.toISOString())
    .in('status', ['confirmed', 'completed'])
    .order('start_at', { ascending: true });

  if (error) {
    console.error('Calendar fetch failed:', error);
    els.grid.innerHTML = `<div class="a-empty"><h3>Could not load calendar</h3><p>${error.message}</p></div>`;
    return;
  }

  state.bookings = data || [];
  render();
}

/* --- Render -------------------------------------------------------------- */

function render() {
  const { from, days } = visibleRange();

  /* Range label */
  const first = days[0];
  const last  = days[days.length - 1];
  els.range.textContent = state.view === 'week'
    ? `${fmtShort(first)} – ${fmtShort(last, true)}`
    : fmtLong(days[0]);

  /* Grid */
  els.grid.innerHTML = '';
  els.grid.style.gridTemplateColumns = `64px repeat(${days.length}, minmax(0, 1fr))`;

  /* Header row (week view only — day view has the date in the toolbar) */
  if (state.view === 'week') {
    const corner = document.createElement('div');
    corner.className = 'a-cal-corner';
    els.grid.appendChild(corner);

    for (const d of days) {
      const head = document.createElement('div');
      head.className = 'a-cal-day-head' + (isSameSastDay(d, new Date()) ? ' is-today' : '');
      head.innerHTML = `
        <span class="a-cal-day-name">${WEEKDAY_SHORT[DOW_KEY[sastWeekday(toSastDateStr(d))]]}</span>
        <span class="a-cal-day-num">${sastDayNum(d)}</span>
      `;
      els.grid.appendChild(head);
    }
  }

  /* Time gutter */
  const gutter = document.createElement('div');
  gutter.className = 'a-cal-gutter';
  for (let m = state.dayStartMin; m <= state.dayEndMin; m += 60) {
    const slot = document.createElement('div');
    slot.className = 'a-cal-gutter-slot';
    slot.style.height = `${60 / (state.dayEndMin - state.dayStartMin) * 100}%`;
    slot.textContent = fmtMinLabel(m);
    gutter.appendChild(slot);
  }
  els.grid.appendChild(gutter);

  /* Day columns */
  const dayColumns = days.map(d => createDayColumn(d));
  dayColumns.forEach(col => els.grid.appendChild(col));

  /* Lay out bookings */
  days.forEach((d, i) => {
    const col = dayColumns[i];
    const dayBookings = state.bookings.filter(b => isSameSastDay(b.start_at, d));
    layoutBookings(col, dayBookings);
  });

  /* "Now" indicator */
  if (state.view === 'day' && isSameSastDay(days[0], new Date())) {
    addNowLine(dayColumns[0]);
  } else if (state.view === 'week') {
    for (let i = 0; i < days.length; i++) {
      if (isSameSastDay(days[i], new Date())) addNowLine(dayColumns[i]);
    }
  }
}

function createDayColumn(day) {
  const col = document.createElement('div');
  col.className = 'a-cal-col';
  col.dataset.date = toSastDateStr(day);

  /* Hour cells */
  for (let m = state.dayStartMin; m < state.dayEndMin; m += 60) {
    const cell = document.createElement('div');
    cell.className = 'a-cal-cell';
    cell.style.height = `${60 / (state.dayEndMin - state.dayStartMin) * 100}%`;
    col.appendChild(cell);
  }

  /* Booking layer */
  const layer = document.createElement('div');
  layer.className = 'a-cal-layer';
  col.appendChild(layer);

  return col;
}

/* --- Booking layout ----------------------------------------------------- */

function layoutBookings(col, bookings) {
  const layer = col.querySelector('.a-cal-layer');
  const total = state.dayEndMin - state.dayStartMin;
  if (total <= 0) return;

  /* Filter out anything that doesn't intersect the visible window */
  const visible = bookings
    .map(b => ({ b, s: minutesIntoDay(b.start_at), e: minutesIntoDay(b.end_at) }))
    .filter(({ s, e }) => e > state.dayStartMin && s < state.dayEndMin)
    .map(({ b, s, e }) => ({
      b,
      s: Math.max(s, state.dayStartMin),
      e: Math.min(e, state.dayEndMin),
    }))
    .sort((a, x) => a.s - x.s);

  /* Lanes: greedy assignment of overlapping blocks */
  const lanes = [];
  for (const item of visible) {
    let lane = lanes.find(l => l[l.length - 1].e <= item.s);
    if (!lane) { lane = []; lanes.push(lane); }
    lane.push(item);
  }

  const totalLanes = lanes.length;
  for (let li = 0; li < lanes.length; li++) {
    for (const item of lanes[li]) {
      const el = renderBookingBlock(item.b);
      const topPct    = ((item.s - state.dayStartMin) / total) * 100;
      const heightPct = ((item.e - item.s) / total) * 100;
      const widthPct  = 100 / totalLanes;
      const leftPct   = (li / totalLanes) * 100;

      el.style.top    = topPct + '%';
      el.style.height = heightPct + '%';
      el.style.left   = leftPct + '%';
      el.style.width  = widthPct + '%';

      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        openBookingDetail(item.b);
      });

      layer.appendChild(el);
    }
  }
}

function renderBookingBlock(b) {
  const client  = b.clients || {};
  const service = b.services || {};

  const el = document.createElement('button');
  el.type = 'button';
  el.className = `a-cal-block a-cal-block--${b.status}`;
  el.innerHTML = `
    <span class="a-cal-block-time">${formatTime(b.start_at)}</span>
    <span class="a-cal-block-client">${escapeHtml(client.name || 'Client')}</span>
    <span class="a-cal-block-service">${escapeHtml(service.name || '')}</span>
  `;
  return el;
}

/* --- Now line ----------------------------------------------------------- */

function addNowLine(col) {
  const nowMin = minutesIntoDay(new Date());
  if (nowMin < state.dayStartMin || nowMin > state.dayEndMin) return;

  const layer = col.querySelector('.a-cal-layer');
  const total = state.dayEndMin - state.dayStartMin;
  const topPct = ((nowMin - state.dayStartMin) / total) * 100;

  const line = document.createElement('div');
  line.className = 'a-cal-now';
  line.style.top = topPct + '%';
  layer.appendChild(line);
}

/* --- Scroll to relevant time -------------------------------------------- */

function scrollToRelevantTime() {
  const total = state.dayEndMin - state.dayStartMin;
  const nowMin = minutesIntoDay(new Date());
  const target = Math.max(state.dayStartMin, nowMin - 60);
  const pct = (target - state.dayStartMin) / total;
  if (els.scroll) {
    els.scroll.scrollTop = els.scroll.scrollHeight * pct;
  }
}

/* --- Slide-over --------------------------------------------------------- */

function openBookingDetail(b) {
  const client  = b.clients || {};
  const service = b.services || {};

  const STATUS_LABEL = {
    confirmed: 'Confirmed', completed: 'Completed',
    cancelled: 'Cancelled', no_show: 'No-show',
  };

  const body = `
    <div class="a-detail">
      <div class="a-detail-row">
        <span class="a-detail-key">Status</span>
        <span><span class="a-badge a-badge--${b.status}">${STATUS_LABEL[b.status] || b.status}</span></span>
      </div>
      <div class="a-detail-row">
        <span class="a-detail-key">When</span>
        <span>${fmtLong(b.start_at)} · ${formatTime(b.start_at)}–${formatTime(b.end_at)}</span>
      </div>
      <div class="a-detail-row">
        <span class="a-detail-key">Client</span>
        <span>${escapeHtml(client.name || '—')}</span>
      </div>
      ${client.phone ? `
        <div class="a-detail-row">
          <span class="a-detail-key">Phone</span>
          <span>
            <a href="tel:${escapeHtml(client.phone)}">${escapeHtml(client.phone)}</a>
            &nbsp;·&nbsp;
            <a href="https://wa.me/${client.phone.replace(/\D/g, '')}" target="_blank" rel="noopener">WhatsApp</a>
          </span>
        </div>
      ` : ''}
      <div class="a-detail-row">
        <span class="a-detail-key">Service</span>
        <span>${escapeHtml(service.name || '—')} · ${service.duration_min || 0} min · ${formatZAR(service.price)}</span>
      </div>
      ${b.notes ? `
        <div class="a-detail-row a-detail-row--stack">
          <span class="a-detail-key">Notes</span>
          <p class="a-detail-notes">${escapeHtml(b.notes)}</p>
        </div>
      ` : ''}
    </div>
  `;

  openSlideOver({
    title: client.name || 'Booking',
    body,
    actions: [
      { label: 'Open in bookings', onClick: (close) => {
        close();
        const q = new URLSearchParams({ search: client.name || '', range: 'all', status: 'all' });
        location.href = `/admin/bookings.html?${q.toString()}`;
      }},
    ],
  });
}

/* --- Helpers ------------------------------------------------------------ */

function minutesIntoDay(d) {
  const { minutes } = utcToSast(d instanceof Date ? d : new Date(d));
  return minutes;
}

function isSameSastDay(a, b) {
  return toSastDateStr(a) === toSastDateStr(b);
}

function sastDayNum(date) {
  const { dateStr } = utcToSast(date);
  return dateStr.slice(8, 10).replace(/^0/, '');
}

function fmtMinLabel(m) {
  const h = Math.floor(m / 60);
  return `${String(h).padStart(2, '0')}:00`;
}

function fmtShort(date, withYear = false) {
  return new Intl.DateTimeFormat('en-ZA', {
    timeZone: 'Africa/Johannesburg',
    day: 'numeric', month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
  }).format(date);
}

function fmtLong(date) {
  const d = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat('en-ZA', {
    timeZone: 'Africa/Johannesburg',
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  }).format(d);
}

function formatZAR(n) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency', currency: 'ZAR', maximumFractionDigits: 0,
  }).format(n);
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}