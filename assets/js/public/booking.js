/* ==========================================================================
   booking.js — Phase 3a.
   Public booking flow: service → date → time → details → confirm.
   Single screen, four steps. Uses the slot engine.
   ========================================================================== */

import { supabase } from '../supabase.js';
import {
  getAvailableSlots, sastToUtc, toSastDateStr, utcToSast, sastWeekday,
} from '../booking/slots.js';
import { bootPublicPage, formatPrice, formatDuration, esc } from './shared.js';

/* --- State --------------------------------------------------------------- */

const state = {
  settings: null,
  services: [],
  availability: [],
  serviceId: null,
  date: null,
  slot: null,
  slots: [],
  loadingSlots: false,
  submitting: false,
};

const els = {};

/* --- Boot ---------------------------------------------------------------- */

const settings = await bootPublicPage();
state.settings = settings;

await init();

async function init() {
  els.services      = document.getElementById('services');
  els.dates         = document.getElementById('dates');
  els.slots         = document.getElementById('slots');
  els.error         = document.getElementById('book-error');
  els.sumService    = document.getElementById('sum-service');
  els.sumWhen       = document.getElementById('sum-when');
  els.sumPrice      = document.getElementById('sum-price');
  els.confirmBtn    = document.getElementById('confirm-btn');
  els.sticky        = document.getElementById('book-sticky');
  els.stickyPrice   = document.getElementById('sticky-price');
  els.stickyWhen    = document.getElementById('sticky-when');
  els.stickyConfirm = document.getElementById('sticky-confirm');

  /* Wire input listeners on details fields */
  const nameEl  = document.getElementById('b-name');
  const phoneEl = document.getElementById('b-phone');
  if (nameEl)  nameEl.addEventListener('input', updateSummary);
  if (phoneEl) phoneEl.addEventListener('input', updateSummary);

  if (els.confirmBtn)    els.confirmBtn.addEventListener('click', submitBooking);
  if (els.stickyConfirm) els.stickyConfirm.addEventListener('click', submitBooking);

  /* Load services + availability in parallel */
  const [servicesRes, availabilityRes] = await Promise.all([
    supabase
      .from('services')
      .select('id, name, description, duration_min, price')
      .eq('active', true)
      .order('sort_order'),
    supabase
      .from('availability')
      .select('weekday, start_time, end_time, active')
      .eq('active', true),
  ]);

  if (servicesRes.error) {
    console.error('Services fetch failed:', servicesRes.error);
    if (els.services) {
      els.services.innerHTML = '<p class="book-empty">Services are temporarily unavailable.</p>';
    }
    return;
  }

  state.services = servicesRes.data || [];
  state.availability = (availabilityRes.data || []).map(a => ({
    weekday: a.weekday,
    start_min: hhmmToMin(a.start_time),
    end_min:   hhmmToMin(a.end_time),
    active:    a.active,
  }));

  renderServices();
  renderDates();
}

/* ==========================================================================
   Step 1 — Services
   ========================================================================== */

function renderServices() {
  if (!els.services) return;

  if (!state.services.length) {
    els.services.innerHTML = '<p class="book-empty">No services available right now.</p>';
    return;
  }

  els.services.innerHTML = state.services.map(s => `
    <button type="button" class="book-service" data-id="${s.id}">
      <span class="book-service-name">${esc(s.name)}</span>
      ${s.description ? `<span class="book-service-desc">${esc(s.description)}</span>` : ''}
      <span class="book-service-meta">
        <span class="book-service-duration">${esc(formatDuration(s.duration_min))}</span>
        <span class="book-service-price">${esc(formatPrice(s.price))}</span>
      </span>
    </button>
  `).join('');

  els.services.querySelectorAll('.book-service').forEach(btn => {
    btn.addEventListener('click', () => {
      state.serviceId = btn.getAttribute('data-id');
      state.slot = null;
      els.services.querySelectorAll('.book-service').forEach(b => {
        b.classList.toggle('is-selected', b === btn);
      });
      updateSummary();
      revealStep('date');
      if (state.date) loadSlots();
    });
  });
}

/* ==========================================================================
   Step 2 — Dates
   ========================================================================== */

function renderDates() {
  if (!els.dates) return;

  const today = new Date();
  const maxAdvance = state.settings?.booking_max_advance_days ?? 60;

  const days = [];
  for (let i = 0; i <= maxAdvance; i++) {
    const d = new Date(today.getTime() + i * 24 * 60 * 60 * 1000);
    const dateStr = toSastDateStr(d);
    const weekday = sastWeekday(dateStr);
    const hasAvailability = state.availability.some(a => a.weekday === weekday);
    if (!hasAvailability) continue;
    days.push({ dateStr, d });
  }

  if (!days.length) {
    els.dates.innerHTML = '<p class="book-empty">No bookable days in the next two months.</p>';
    return;
  }

  els.dates.innerHTML = days.slice(0, 30).map(({ dateStr, d }) => {
    const isToday    = dateStr === toSastDateStr(new Date());
    const isTomorrow = dateStr === toSastDateStr(new Date(Date.now() + 24 * 60 * 60 * 1000));
    const dow = new Intl.DateTimeFormat('en-ZA', {
      weekday: 'short', timeZone: 'Africa/Johannesburg',
    }).format(d);
    const dayNum = new Intl.DateTimeFormat('en-ZA', {
      day: 'numeric', timeZone: 'Africa/Johannesburg',
    }).format(d);
    const month = new Intl.DateTimeFormat('en-ZA', {
      month: 'short', timeZone: 'Africa/Johannesburg',
    }).format(d);

    const label = isToday ? 'Today' : isTomorrow ? 'Tomorrow' : dow;
    return `
      <button type="button" class="book-date" data-date="${dateStr}">
        <span class="book-date-dow">${esc(label)}</span>
        <span class="book-date-num">${esc(dayNum)}</span>
        <span class="book-date-month">${esc(month)}</span>
      </button>
    `;
  }).join('');

  els.dates.querySelectorAll('.book-date').forEach(btn => {
    btn.addEventListener('click', () => {
      state.date = btn.getAttribute('data-date');
      state.slot = null;
      els.dates.querySelectorAll('.book-date').forEach(b => {
        b.classList.toggle('is-selected', b === btn);
      });
      updateSummary();
      revealStep('time');
      loadSlots();
    });
  });
}

/* ==========================================================================
   Step 3 — Slots
   ========================================================================== */

async function loadSlots() {
  if (!els.slots) return;
  if (!state.serviceId || !state.date) return;

  state.loadingSlots = true;
  els.slots.innerHTML = '<p class="book-empty">Loading…</p>';

  const svc = state.services.find(s => s.id === state.serviceId);
  if (!svc) {
    els.slots.innerHTML = '<p class="book-empty">Pick a service first.</p>';
    return;
  }

  const dayStart = sastToUtc(state.date, 0);
  const dayEnd   = sastToUtc(state.date, 24 * 60);

  const [bookingsRes, blocksRes] = await Promise.all([
    supabase
      .from('bookings')
      .select('start_at, end_at, status')
      .gte('start_at', new Date(dayStart.getTime() - 24 * 60 * 60 * 1000).toISOString())
      .lt('start_at', new Date(dayEnd.getTime() + 24 * 60 * 60 * 1000).toISOString())
      .in('status', ['confirmed', 'completed']),
    supabase
      .from('blocks')
      .select('start_at, end_at')
      .gte('start_at', new Date(dayStart.getTime() - 24 * 60 * 60 * 1000).toISOString())
      .lt('start_at', new Date(dayEnd.getTime() + 24 * 60 * 60 * 1000).toISOString()),
  ]);

  const bookings = (bookingsRes.data || []).map(b => ({
    start: new Date(b.start_at),
    end: new Date(b.end_at),
    status: b.status,
  }));

  const blocks = (blocksRes.data || []).map(b => ({
    start: new Date(b.start_at),
    end: new Date(b.end_at),
  }));

  const slots = getAvailableSlots({
    date: state.date,
    availability: state.availability,
    bookings,
    blocks,
    serviceDuration: svc.duration_min,
    bufferMin: state.settings?.buffer_min ?? 0,
    slotIntervalMin: state.settings?.slot_interval_min ?? 30,
    minNoticeHours: state.settings?.booking_min_notice_hours ?? 2,
    maxAdvanceDays: state.settings?.booking_max_advance_days ?? 60,
  });

  state.slots = slots;
  state.loadingSlots = false;

  if (!slots.length) {
    els.slots.innerHTML = '<p class="book-empty">No times available on this day. Try another.</p>';
    return;
  }

  els.slots.innerHTML = slots.map(s => {
    const iso = s.start.toISOString();
    return `<button type="button" class="book-slot" data-iso="${iso}">${formatTime24(s.start)}</button>`;
  }).join('');

  els.slots.querySelectorAll('.book-slot').forEach(btn => {
    btn.addEventListener('click', () => {
      state.slot = btn.getAttribute('data-iso');
      els.slots.querySelectorAll('.book-slot').forEach(b => {
        b.classList.toggle('is-selected', b === btn);
      });
      updateSummary();
      revealStep('details');
    });
  });
}

/* ==========================================================================
   Summary — fully null-guarded
   ========================================================================== */

function updateSummary() {
  const svc = state.services.find(s => s.id === state.serviceId);

  /* Service */
  if (els.sumService) els.sumService.textContent = svc ? svc.name : '—';

  /* When */
  if (els.sumWhen) {
    if (state.slot) {
      els.sumWhen.textContent = `${formatDateLong(state.date)} · ${formatTime24(new Date(state.slot))}`;
    } else if (state.date) {
      els.sumWhen.textContent = formatDateLong(state.date);
    } else {
      els.sumWhen.textContent = '—';
    }
  }

  /* Price */
  if (els.sumPrice) els.sumPrice.textContent = svc ? formatPrice(svc.price) : '—';

  /* Details — inputs may not be in the DOM yet */
  const nameEl  = document.getElementById('b-name');
  const phoneEl = document.getElementById('b-phone');
  const name  = nameEl  ? nameEl.value.trim()  : '';
  const phone = phoneEl ? phoneEl.value.trim() : '';
  const ready = !!(svc && state.date && state.slot && name && phone);

  if (els.confirmBtn)    els.confirmBtn.disabled = !ready;
  if (els.stickyConfirm) els.stickyConfirm.disabled = !ready;

  /* Sticky bar (mobile) */
  if (els.sticky) {
    if (state.serviceId && state.date && state.slot) {
      els.sticky.hidden = false;
      if (els.stickyPrice) els.stickyPrice.textContent = svc ? formatPrice(svc.price) : '';
      if (els.stickyWhen)  els.stickyWhen.textContent  = `${formatDateShort(state.date)} · ${formatTime24(new Date(state.slot))}`;
    } else {
      els.sticky.hidden = true;
    }
  }
}

function revealStep(step) {
  const stepEl = document.querySelector(`.book-step[data-step="${step}"]`);
  if (!stepEl) return;
  stepEl.hidden = false;
  stepEl.classList.add('is-active');
}

/* ==========================================================================
   Submit
   ========================================================================== */

async function submitBooking() {
  if (state.submitting) return;
  if (els.error) els.error.textContent = '';

  const svc = state.services.find(s => s.id === state.serviceId);
  const name  = (document.getElementById('b-name')?.value  || '').trim();
  const phone = (document.getElementById('b-phone')?.value || '').trim();
  const email = (document.getElementById('b-email')?.value || '').trim();
  const notes = (document.getElementById('b-notes')?.value || '').trim();

  if (!svc) { showError('Pick a service.'); return; }
  if (!state.date || !state.slot) { showError('Pick a date and time.'); return; }
  if (!name)  { showError('Your name is required.'); return; }
  if (!phone) { showError('Your phone number is required.'); return; }

  state.submitting = true;
  if (els.confirmBtn) {
    els.confirmBtn.disabled = true;
    els.confirmBtn.textContent = 'Confirming…';
  }

  const svcEnd = new Date(new Date(state.slot).getTime() + svc.duration_min * 60_000);

  /* Re-check the slot is free just before inserting */
  const { data: conflicting } = await supabase
    .from('bookings')
    .select('id')
    .lt('start_at', svcEnd.toISOString())
    .gt('end_at', state.slot)
    .in('status', ['confirmed', 'completed'])
    .limit(1);

  if (conflicting?.length) {
    state.submitting = false;
    if (els.confirmBtn) {
      els.confirmBtn.disabled = false;
      els.confirmBtn.textContent = 'Confirm booking';
    }
    showError('Sorry, that slot was just taken. Please pick another time.');
    await loadSlots();
    return;
  }

  /* Find or create client by phone */
  let clientId;
  const { data: existingClient } = await supabase
    .from('clients')
    .select('id')
    .eq('phone', phone)
    .maybeSingle();

  if (existingClient) {
    clientId = existingClient.id;
    await supabase
      .from('clients')
      .update({ name, email: email || null })
      .eq('id', clientId);
  } else {
    const { data: newClient, error: clientErr } = await supabase
      .from('clients')
      .insert({ name, phone, email: email || null })
      .select('id')
      .single();

    if (clientErr) {
      state.submitting = false;
      if (els.confirmBtn) {
        els.confirmBtn.disabled = false;
        els.confirmBtn.textContent = 'Confirm booking';
      }
      showError('Could not save your details: ' + clientErr.message);
      return;
    }
    clientId = newClient.id;
  }

  /* Insert booking */
  const { data: booking, error: bookingErr } = await supabase
    .from('bookings')
    .insert({
      client_id: clientId,
      service_id: svc.id,
      start_at: state.slot,
      end_at: svcEnd.toISOString(),
      status: 'confirmed',
      notes: notes || null,
    })
    .select('id')
    .single();

  if (bookingErr) {
    state.submitting = false;
    if (els.confirmBtn) {
      els.confirmBtn.disabled = false;
      els.confirmBtn.textContent = 'Confirm booking';
    }
    showError('Could not complete booking: ' + bookingErr.message);
    return;
  }

  /* Redirect to the confirmation page */
  const params = new URLSearchParams({
    id: booking.id,
    svc: svc.name,
    price: svc.price ?? '',
    start: state.slot,
    dur: svc.duration_min,
    name,
    phone,
  });
  window.location.href = '/booking-confirmed.html?' + params.toString();
}

function showError(msg) {
  if (!els.error) return;
  els.error.textContent = msg;
  els.error.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* --- Helpers ------------------------------------------------------------ */

function hhmmToMin(hhmm) {
  const [h, m] = String(hhmm || '00:00').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function formatTime24(d) {
  const { minutes } = utcToSast(d instanceof Date ? d : new Date(d));
  const h = String(Math.floor(minutes / 60)).padStart(2, '0');
  const m = String(minutes % 60).padStart(2, '0');
  return `${h}:${m}`;
}

function formatDateLong(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  return new Intl.DateTimeFormat('en-ZA', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
  }).format(dt);
}

function formatDateShort(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  return new Intl.DateTimeFormat('en-ZA', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
  }).format(dt);
}