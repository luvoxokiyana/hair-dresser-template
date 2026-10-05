/* ==========================================================================
   bookings.js — Phase 2d-i.
   Filterable bookings list, status changes, slide-over detail, pagination.
   ========================================================================== */

import { supabase } from '/assets/js/supabase.js';
import {
  guard, mountSidebar, mountTopbar, mountUser,
  formatTime, toast, openSlideOver,
} from './admin.js';
import {
  startOfDaySast, endOfDaySast,
  startOfWeekSast, endOfWeekSast,
  toSastDateStr,
} from '/assets/js/booking/slots.js';

/* --- Constants ----------------------------------------------------------- */

const PAGE_SIZE = 25;

const STATUS_LABEL = {
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show:   'No-show',
};

/* --- State --------------------------------------------------------------- */

const state = {
  status:  'active',
  range:   'week',
  service: '',
  search:  '',
  sort:    'asc',
  page:    1,
  total:   0,
  rows:    [],
};

const els = {};


/* --- Auth + shell -------------------------------------------------------- */

const session = await guard();
if (session) {
  mountSidebar('bookings');
  mountTopbar('Bookings');
  await mountUser(session);
  await init();
}

/* --- Init ---------------------------------------------------------------- */

async function init() {
  els.list = document.getElementById('bookings-list');
  els.title = document.getElementById('results-title');
  els.count = document.getElementById('results-count');
  els.pagination = document.getElementById('pagination');

  els.status  = document.getElementById('f-status');
  els.range   = document.getElementById('f-range');
  els.service = document.getElementById('f-service');
  els.search  = document.getElementById('f-search');
  els.sort    = document.getElementById('f-sort');
  els.reset   = document.getElementById('f-reset');

  /* Load filters from URL */
  readUrlIntoState();
  applyStateToInputs();

  /* Populate service dropdown */
  await loadServices();

  /* Wire events */
  els.status.addEventListener('change', () => { state.status = els.status.value; state.page = 1; syncAndFetch(); });
  els.range.addEventListener('change',  () => { state.range  = els.range.value;  state.page = 1; syncAndFetch(); });
  els.service.addEventListener('change', () => { state.service = els.service.value; state.page = 1; syncAndFetch(); });
  els.sort.addEventListener('change',   () => { state.sort   = els.sort.value;   state.page = 1; syncAndFetch(); });

  let searchTimer;
  els.search.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.search = els.search.value.trim();
      state.page = 1;
      syncAndFetch();
    }, 300);
  });

  els.reset.addEventListener('click', () => {
    Object.assign(state, { status: 'active', range: 'week', service: '', search: '', sort: 'asc', page: 1 });
    applyStateToInputs();
    syncAndFetch();
  });

  await fetch();
}

/* --- URL sync ------------------------------------------------------------ */

function readUrlIntoState() {
  const p = new URLSearchParams(location.search);
  if (p.get('status'))  state.status  = p.get('status');
  if (p.get('range'))   state.range   = p.get('range');
  if (p.get('service')) state.service = p.get('service');
  if (p.get('search'))  state.search  = p.get('search');
  if (p.get('sort'))    state.sort    = p.get('sort');
  if (p.get('page'))    state.page    = Math.max(1, parseInt(p.get('page'), 10) || 1);
}

function syncUrl() {
  const p = new URLSearchParams();
  if (state.status  !== 'active') p.set('status',  state.status);
  if (state.range   !== 'week')   p.set('range',   state.range);
  if (state.service)              p.set('service', state.service);
  if (state.search)               p.set('search',  state.search);
  if (state.sort    !== 'asc')    p.set('sort',    state.sort);
  if (state.page    !== 1)        p.set('page',    state.page);
  const qs = p.toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}

function applyStateToInputs() {
  els.status.value  = state.status;
  els.range.value   = state.range;
  els.sort.value    = state.sort;
  els.search.value  = state.search;
}

async function syncAndFetch() {
  syncUrl();
  await fetch();
}

/* --- Services dropdown --------------------------------------------------- */

async function loadServices() {
  const { data } = await supabase
    .from('services')
    .select('id, name')
    .order('sort_order');
  if (!data) return;

  for (const s of data) {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.name;
    els.service.appendChild(opt);
  }
  if (state.service) els.service.value = state.service;
}

/* --- Date range → [from, to) -------------------------------------------- */

function rangeBounds(range) {
  const now = new Date();
  switch (range) {
    case 'today': return [startOfDaySast(now), endOfDaySast(now)];
    case 'week':  return [startOfWeekSast(now), endOfWeekSast(now)];
    case 'next7': {
      const from = startOfDaySast(now);
      const to = new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);
      return [from, to];
    }
    case 'month': {
      const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) - 120 * 60 * 1000);
      const to   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1) - 120 * 60 * 1000);
      return [from, to];
    }
    case 'past':  return [new Date(0), startOfDaySast(now)];
    case 'all':
    default:      return [null, null];
  }
}

/* --- Fetch --------------------------------------------------------------- */

async function fetch() {
  els.list.innerHTML = `<div class="a-empty"><h3>Loading…</h3></div>`;

  const [from, to] = rangeBounds(state.range);

  let q = supabase
    .from('bookings')
    .select(`
      id, start_at, end_at, status, notes, created_at,
      cancelled_at, cancelled_reason,
      clients ( id, name, phone, email ),
      services ( id, name, price, duration_min )
    `, { count: 'exact' });

  if (state.status === 'active')   q = q.in('status', ['confirmed', 'completed']);
  else if (state.status !== 'all') q = q.eq('status', state.status);

  if (from) q = q.gte('start_at', from.toISOString());
  if (to)   q = q.lt('start_at', to.toISOString());

  if (state.service) q = q.eq('service_id', state.service);

  if (state.search) {
    /* Supabase supports .or() with ilike on joined columns via filter syntax */
    const s = state.search.replace(/[%_]/g, '\\$&');
    q = q.or(`clients.name.ilike.%${s}%,clients.phone.ilike.%${s}%`);
  }

  q = q.order('start_at', { ascending: state.sort === 'asc' });

  const offset = (state.page - 1) * PAGE_SIZE;
  q = q.range(offset, offset + PAGE_SIZE - 1);

  const { data, error, count } = await q;

  if (error) {
    console.error('Bookings fetch failed:', error);
    els.list.innerHTML = `<div class="a-empty"><h3>Could not load bookings</h3><p>${error.message}</p></div>`;
    els.title.textContent = 'Bookings';
    els.count.textContent = '';
    els.pagination.innerHTML = '';
    return;
  }

  state.rows = data || [];
  state.total = count || 0;

  renderTitle();
  renderList();
  renderPagination();
}

/* --- Title --------------------------------------------------------------- */

function renderTitle() {
  const label = {
    active: 'Active bookings',
    all: 'All bookings',
    confirmed: 'Confirmed bookings',
    completed: 'Completed bookings',
    cancelled: 'Cancelled bookings',
    no_show: 'No-shows',
  }[state.status] || 'Bookings';

  els.title.textContent = label;
  els.count.textContent = state.total === 1 ? '1 booking' : `${state.total} bookings`;
}

/* --- List ---------------------------------------------------------------- */

function renderList() {
  if (!state.rows.length) {
    els.list.innerHTML = `
      <div class="a-empty">
        <svg class="a-empty-icon" viewBox="0 0 24 24">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <h3>No bookings match</h3>
        <p>Try adjusting the filters, or clearing the search.</p>
      </div>
    `;
    return;
  }

  /* Group by day (SAST) */
  const groups = new Map();
  for (const b of state.rows) {
    const key = toSastDateStr(b.start_at);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(b);
  }

  const parts = [];
  for (const [day, rows] of groups) {
    parts.push(`
      <div class="a-day-group">
        <div class="a-day-head">
          <span class="a-day-label">${formatDayLabel(day)}</span>
          <span class="a-day-count">${rows.length} ${rows.length === 1 ? 'booking' : 'bookings'}</span>
        </div>
        <ul class="a-booking-list">
          ${rows.map(renderRow).join('')}
        </ul>
      </div>
    `);
  }
  els.list.innerHTML = parts.join('');

  /* Row click → slide-over */
  els.list.querySelectorAll('[data-booking-id]').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-action]')) return;
      const id = el.getAttribute('data-booking-id');
      const booking = state.rows.find(r => r.id === id);
      if (booking) openDetail(booking);
    });
  });

  /* Row actions */
  els.list.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const action = btn.getAttribute('data-action');
      const booking = state.rows.find(r => r.id === id);
      if (booking) await changeStatus(booking, action);
    });
  });
}

function renderRow(b) {
  const client = b.clients || {};
  const service = b.services || {};
  return `
    <li class="a-booking-row" data-booking-id="${b.id}">
      <div class="a-booking-time">${formatTime(b.start_at)}</div>
      <div class="a-booking-main">
        <p class="a-booking-client">${escapeHtml(client.name || 'Client')}</p>
        <p class="a-booking-service">${escapeHtml(service.name || 'Service')} · ${service.duration_min || 0} min</p>
      </div>
      <div class="a-booking-meta">
        <span class="a-badge a-badge--${b.status}">${STATUS_LABEL[b.status] || b.status}</span>
        <span class="a-booking-price">${formatZAR(service.price)}</span>
      </div>
      <div class="a-booking-actions">
        ${b.status === 'confirmed' ? `
          <button class="a-btn a-btn-ghost a-btn-sm" data-action="completed" data-id="${b.id}">Complete</button>
          <button class="a-btn a-btn-ghost a-btn-sm" data-action="no_show"   data-id="${b.id}">No-show</button>
        ` : ''}
      </div>
    </li>
  `;
}

/* --- Pagination ---------------------------------------------------------- */

function renderPagination() {
  const pages = Math.max(1, Math.ceil(state.total / PAGE_SIZE));
  if (pages <= 1) {
    els.pagination.innerHTML = '';
    return;
  }

  const p = state.page;
  const prev = p > 1 ? `<button class="a-btn a-btn-ghost a-btn-sm" data-page="${p - 1}">← Prev</button>` : '';
  const next = p < pages ? `<button class="a-btn a-btn-ghost a-btn-sm" data-page="${p + 1}">Next →</button>` : '';

  els.pagination.innerHTML = `
    ${prev}
    <span class="a-pagination-info">Page ${p} of ${pages}</span>
    ${next}
  `;

  els.pagination.querySelectorAll('[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.page = parseInt(btn.getAttribute('data-page'), 10);
      syncAndFetch();
      document.querySelector('.a-content')?.scrollIntoView({ behavior: 'smooth' });
    });
  });
}

/* --- Detail slide-over --------------------------------------------------- */

function openDetail(b) {
  const client = b.clients || {};
  const service = b.services || {};

  const body = `
    <div class="a-detail">
      <div class="a-detail-row">
        <span class="a-detail-key">Status</span>
        <span><span class="a-badge a-badge--${b.status}">${STATUS_LABEL[b.status] || b.status}</span></span>
      </div>
      <div class="a-detail-row">
        <span class="a-detail-key">When</span>
        <span>${formatFullDate(b.start_at)} · ${formatTime(b.start_at)}–${formatTime(b.end_at)}</span>
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
      ${client.email ? `
        <div class="a-detail-row">
          <span class="a-detail-key">Email</span>
          <span><a href="mailto:${escapeHtml(client.email)}">${escapeHtml(client.email)}</a></span>
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
      ${b.cancelled_at ? `
        <div class="a-detail-row a-detail-row--stack">
          <span class="a-detail-key">Cancelled</span>
          <p class="a-detail-notes">${formatFullDate(b.cancelled_at)}${b.cancelled_reason ? ' — ' + escapeHtml(b.cancelled_reason) : ''}</p>
        </div>
      ` : ''}
      <div class="a-detail-row">
        <span class="a-detail-key">Booked</span>
        <span>${formatFullDate(b.created_at)}</span>
      </div>
    </div>
  `;

  const actions = [];
  if (b.status === 'confirmed') {
    actions.push({ label: 'Mark completed', variant: 'primary', onClick: (close) => { close(); changeStatus(b, 'completed'); } });
    actions.push({ label: 'No-show', onClick: (close) => { close(); changeStatus(b, 'no_show'); } });
    actions.push({ label: 'Cancel', onClick: (close) => { close(); changeStatus(b, 'cancelled'); } });
  } else if (b.status === 'completed' || b.status === 'no_show' || b.status === 'cancelled') {
    actions.push({ label: 'Reopen (confirmed)', onClick: (close) => { close(); changeStatus(b, 'confirmed'); } });
  }

  openSlideOver({
    title: client.name || 'Booking',
    body,
    actions,
  });
}

/* --- Status change ------------------------------------------------------- */

async function changeStatus(booking, newStatus) {
  if (newStatus === 'cancelled') {
    const confirmed = confirm(`Cancel ${booking.clients?.name || 'this'}'s booking?\n\nThis cannot be undone from here, but you can reopen it.`);
    if (!confirmed) return;
  }

  const previous = booking.status;
  const patch = { status: newStatus };
  if (newStatus === 'cancelled') {
    patch.cancelled_at = new Date().toISOString();
  } else {
    patch.cancelled_at = null;
    patch.cancelled_reason = null;
  }

  /* Optimistic update */
  booking.status = newStatus;

  const { error } = await supabase
    .from('bookings')
    .update(patch)
    .eq('id', booking.id);

  if (error) {
    /* Rollback */
    booking.status = previous;
    toast('Could not update booking: ' + error.message);
    renderList();
    return;
  }

  toast(`Marked as ${STATUS_LABEL[newStatus] || newStatus}`, {
    label: 'Undo',
    onClick: async () => {
      await supabase
        .from('bookings')
        .update({ status: previous, cancelled_at: null, cancelled_reason: null })
        .eq('id', booking.id);
      await fetch();
    },
  });

  await fetch();
}

/* --- Helpers ------------------------------------------------------------- */

function formatZAR(n) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency', currency: 'ZAR', maximumFractionDigits: 0,
  }).format(n);
}

function formatDayLabel(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  const today = toSastDateStr(new Date());
  if (dateStr === today) return 'Today';
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  if (dateStr === toSastDateStr(tomorrow)) return 'Tomorrow';
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  if (dateStr === toSastDateStr(yesterday)) return 'Yesterday';
  return new Intl.DateTimeFormat('en-ZA', {
    weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC',
  }).format(date);
}

function formatFullDate(d) {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  return new Intl.DateTimeFormat('en-ZA', {
    timeZone: 'Africa/Johannesburg',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}