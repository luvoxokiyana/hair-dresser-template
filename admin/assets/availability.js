/* ==========================================================================
   availability.js — Phase 2g.
   Weekly hours + one-off blocks. Both feed the slot engine.
   ========================================================================== */

import { supabase } from '/assets/js/supabase.js';
import {
  guard, mountSidebar, mountTopbar, mountUser,
  toast, openSlideOver, formatTime,
} from './admin.js';
import {
  sastToUtc, utcToSast, toSastDateStr, sastWeekday,
} from '/assets/js/booking/slots.js';

/* --- Constants ----------------------------------------------------------- */

const WEEKDAYS = [
  { num: 1, key: 'mon', label: 'Monday' },
  { num: 2, key: 'tue', label: 'Tuesday' },
  { num: 3, key: 'wed', label: 'Wednesday' },
  { num: 4, key: 'thu', label: 'Thursday' },
  { num: 5, key: 'fri', label: 'Friday' },
  { num: 6, key: 'sat', label: 'Saturday' },
  { num: 0, key: 'sun', label: 'Sunday' },
];

/* --- State --------------------------------------------------------------- */

const state = {
  availability: [],
  blocks: [],
};

const els = {};

/* --- Auth + shell -------------------------------------------------------- */

const session = await guard();
if (session) {
  mountSidebar('availability');
  mountTopbar('Availability');
  await mountUser(session);
  await init();
}

/* --- Init ---------------------------------------------------------------- */

async function init() {
  els.weekly = document.getElementById('weekly-list');
  els.weeklyCount = document.getElementById('weekly-count');
  els.blocks = document.getElementById('blocks-list');

  document.getElementById('new-block-btn').addEventListener('click', () => {
    openBlockForm();
  });

  await Promise.all([fetchAvailability(), fetchBlocks()]);
}

/* ==========================================================================
   Weekly availability
   ========================================================================== */

async function fetchAvailability() {
  const { data, error } = await supabase
    .from('availability')
    .select('id, weekday, start_time, end_time, active')
    .order('weekday', { ascending: true })
    .order('start_time', { ascending: true });

  if (error) {
    console.error('Availability fetch failed:', error);
    els.weekly.innerHTML = `<div class="a-empty"><h3>Could not load hours</h3><p>${error.message}</p></div>`;
    return;
  }

  state.availability = data || [];
  renderWeekly();
}

function renderWeekly() {
  const activeWindows = state.availability.filter(a => a.active);
  els.weeklyCount.textContent = activeWindows.length === 1
    ? '1 window'
    : `${activeWindows.length} windows`;

  els.weekly.innerHTML = WEEKDAYS.map(day => {
    const dayWindows = state.availability
      .filter(a => a.weekday === day.num && a.active)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));

    return `
      <div class="av-day" data-weekday="${day.num}">
        <div class="av-day-name">${day.label}</div>
        <div class="av-day-windows">
          ${dayWindows.length
            ? dayWindows.map(w => `
                <span class="av-chip">
                  <span class="av-chip-time">${shortTime(w.start_time)}–${shortTime(w.end_time)}</span>
                  <button type="button" class="av-chip-remove" data-id="${w.id}" aria-label="Remove">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </span>
              `).join('')
            : '<span class="av-none">Closed</span>'
          }
        </div>
        <button type="button" class="a-btn a-btn-ghost a-btn-sm av-add-btn" data-weekday="${day.num}">+ Add</button>
      </div>
    `;
  }).join('');

  /* Wire remove buttons */
  els.weekly.querySelectorAll('.av-chip-remove').forEach(btn => {
    btn.addEventListener('click', () => removeWindow(btn.getAttribute('data-id')));
  });

  /* Wire add buttons */
  els.weekly.querySelectorAll('.av-add-btn').forEach(btn => {
    btn.addEventListener('click', () => addWindow(parseInt(btn.getAttribute('data-weekday'), 10)));
  });
}

async function addWindow(weekday) {
  /* Default: 09:00 – 17:00 */
  const { error } = await supabase
    .from('availability')
    .insert({
      weekday,
      start_time: '09:00',
      end_time: '17:00',
      active: true,
    });

  if (error) {
    toast('Could not add window: ' + error.message);
    return;
  }
  await fetchAvailability();
}

async function removeWindow(id) {
  /* Fetch the row first so we can warn if it's the last window on that day */
  const row = state.availability.find(a => a.id === id);
  if (!row) return;

  const sameDay = state.availability.filter(a => a.weekday === row.weekday && a.active);
  if (sameDay.length === 1) {
    if (!confirm(`This is the last window on this day. Remove it and the salon will be closed?`)) return;
  }

  const { error } = await supabase
    .from('availability')
    .delete()
    .eq('id', id);

  if (error) {
    toast('Could not remove: ' + error.message);
    return;
  }
  await fetchAvailability();
}

/* ==========================================================================
   Blocks
   ========================================================================== */

async function fetchBlocks() {
  const now = new Date();
  const { data, error } = await supabase
    .from('blocks')
    .select('id, start_at, end_at, reason, all_day')
    .gte('end_at', now.toISOString())
    .order('start_at', { ascending: true });

  if (error) {
    console.error('Blocks fetch failed:', error);
    els.blocks.innerHTML = `<div class="a-empty"><h3>Could not load blocks</h3><p>${error.message}</p></div>`;
    return;
  }

  state.blocks = data || [];
  renderBlocks();
}

function renderBlocks() {
  if (!state.blocks.length) {
    els.blocks.innerHTML = `
      <div class="a-empty">
        <svg class="a-empty-icon" viewBox="0 0 24 24">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <h3>No upcoming blocks</h3>
        <p>Time off, lunch, appointments — block them here.</p>
      </div>
    `;
    return;
  }

  els.blocks.innerHTML = `
    <ul class="bl-list">
      ${state.blocks.map(b => `
        <li class="bl-row">
          <div class="bl-when">
            <span class="bl-date">${formatDateRange(b.start_at, b.end_at, b.all_day)}</span>
            ${!b.all_day ? `<span class="bl-time">${formatTime(b.start_at)} – ${formatTime(b.end_at)}</span>` : ''}
          </div>
          <div class="bl-reason">
            ${b.reason ? escapeHtml(b.reason) : '<span class="bl-no-reason">No reason</span>'}
          </div>
          <div class="bl-actions">
            <button type="button" class="a-btn a-btn-ghost a-btn-sm" data-block-id="${b.id}">Remove</button>
          </div>
        </li>
      `).join('')}
    </ul>
  `;

  els.blocks.querySelectorAll('[data-block-id]').forEach(btn => {
    btn.addEventListener('click', () => removeBlock(btn.getAttribute('data-block-id')));
  });
}

async function removeBlock(id) {
  if (!confirm('Remove this block?')) return;
  const { error } = await supabase.from('blocks').delete().eq('id', id);
  if (error) {
    toast('Could not remove: ' + error.message);
    return;
  }
  toast('Block removed');
  await fetchBlocks();
}

/* --- Block form --------------------------------------------------------- */

function openBlockForm() {
  const today = toSastDateStr(new Date());

  const body = `
    <form class="bl-form" id="bl-form" onsubmit="return false;">
      <div class="bl-field bl-field--check">
        <label>
          <input type="checkbox" id="bl-allday">
          <span>All day</span>
        </label>
      </div>

      <div class="bl-field">
        <label class="bl-label" for="bl-date">Date <span class="bl-required">*</span></label>
        <input class="a-input" id="bl-date" type="date" value="${today}">
      </div>

      <div class="bl-time-row" id="bl-time-row">
        <div class="bl-field">
          <label class="bl-label" for="bl-start">Start <span class="bl-required">*</span></label>
          <input class="a-input" id="bl-start" type="time" value="12:00" step="900">
        </div>
        <div class="bl-field">
          <label class="bl-label" for="bl-end">End <span class="bl-required">*</span></label>
          <input class="a-input" id="bl-end" type="time" value="13:00" step="900">
        </div>
      </div>

      <div class="bl-field">
        <label class="bl-label" for="bl-reason">Reason <span class="bl-optional">(optional)</span></label>
        <input class="a-input" id="bl-reason" type="text" placeholder="Lunch, dentist, training…" autocomplete="off">
      </div>

      <p class="bl-error" id="bl-error" role="alert"></p>
    </form>
  `;

  openSlideOver({
    title: 'Block time',
    body,
    actions: [
      { label: 'Cancel', onClick: (c) => c() },
      {
        label: 'Block it',
        variant: 'primary',
        onClick: async (c) => {
          const ok = await submitBlock(c);
          if (ok) {
            c();
            await fetchBlocks();
          }
        },
      },
    ],
  });

  /* Wire all-day toggle */
  const alldayEl = document.getElementById('bl-allday');
  const timeRow = document.getElementById('bl-time-row');
  alldayEl.addEventListener('change', () => {
    timeRow.style.display = alldayEl.checked ? 'none' : '';
  });
}

async function submitBlock(close) {
  const allday  = document.getElementById('bl-allday').checked;
  const date    = document.getElementById('bl-date').value;
  const start   = document.getElementById('bl-start').value;
  const end     = document.getElementById('bl-end').value;
  const reason  = document.getElementById('bl-reason').value.trim();
  const errEl   = document.getElementById('bl-error');

  errEl.textContent = '';

  if (!date) { errEl.textContent = 'Pick a date.'; return false; }

  let startUtc, endUtc;

  if (allday) {
    startUtc = sastToUtc(date, 0);
    endUtc   = sastToUtc(date, 24 * 60);
  } else {
    if (!start || !end) { errEl.textContent = 'Start and end times are required.'; return false; }
    if (end <= start)  { errEl.textContent = 'End time must be after start time.'; return false; }
    startUtc = sastToUtc(date, hhmmToMin(start));
    endUtc   = sastToUtc(date, hhmmToMin(end));
  }

  const { error } = await supabase
    .from('blocks')
    .insert({
      start_at: startUtc.toISOString(),
      end_at: endUtc.toISOString(),
      reason: reason || null,
      all_day: allday,
    });

  if (error) { errEl.textContent = 'Could not save: ' + error.message; return false; }
  toast('Time blocked');
  return true;
}

/* --- Helpers ------------------------------------------------------------ */

function shortTime(hhmm) {
  if (!hhmm) return '';
  return String(hhmm).slice(0, 5);
}

function hhmmToMin(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function formatDateRange(start, end, allDay) {
  const startDate = toSastDateStr(new Date(start));
  const endDate   = toSastDateStr(new Date(end));

  const fmt = (dateStr) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d, 12));
    return new Intl.DateTimeFormat('en-ZA', {
      weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
    }).format(dt);
  };

  if (startDate === endDate) return fmt(startDate);
  return `${fmt(startDate)} → ${fmt(endDate)}`;
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}