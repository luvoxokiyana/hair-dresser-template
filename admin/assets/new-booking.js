/* ==========================================================================
   new-booking.js — Phase 2e.
   Shared manual booking form. Called from bookings list and calendar.
   Renders as a slide-over. Uses the slot engine to compute availability.
   ========================================================================== */

import { supabase, getSettings } from '/assets/js/supabase.js';
import { toast, openSlideOver } from './admin.js';
import { getAvailableSlots, sastToUtc, toSastDateStr, utcToSast } from '/assets/js/booking/slots.js';

/* --- Public entry point -------------------------------------------------- */

/**
 * Open the new-booking slide-over.
 * @param {object} [prefill] — optional { date: 'YYYY-MM-DD', timeMin: minutes }
 * @param {Function} [onCreated] — callback after successful insert
 */
export async function openNewBooking(prefill = {}, onCreated) {
  /* Load services + settings once. */
  const [{ data: services }, settings] = await Promise.all([
    supabase.from('services').select('id, name, duration_min, price').eq('active', true).order('sort_order'),
    getSettings().catch(() => null),
  ]);

  if (!services?.length) {
    toast('Add at least one service before booking.');
    return;
  }

  /* Pull availability + blocks once. Availability is small (7 rows max per window). */
  const { data: availability } = await supabase
    .from('availability')
    .select('weekday, start_time, end_time, active')
    .eq('active', true);

  const formState = {
    serviceId: services[0].id,
    date: prefill.date || toSastDateStr(new Date()),
    slotStart: prefill.timeMin != null ? sastToUtc(prefill.date, prefill.timeMin).toISOString() : null,
    name: '',
    phone: '',
    email: '',
    notes: '',
    slots: [],
    loadingSlots: false,
  };

  /* --- Build the slide-over body ---------------------------------------- */

  const body = `
    <div class="nb-form">

      <div class="nb-field">
        <label class="nb-label" for="nb-service">Service</label>
        <select class="a-input" id="nb-service">
          ${services.map(s => `
            <option value="${s.id}" data-duration="${s.duration_min}">
              ${escapeHtml(s.name)} · ${s.duration_min} min · ${formatZAR(s.price)}
            </option>
          `).join('')}
        </select>
      </div>

      <div class="nb-row">
        <div class="nb-field">
          <label class="nb-label" for="nb-date">Date</label>
          <input class="a-input" id="nb-date" type="date" value="${formState.date}">
        </div>
        <div class="nb-field nb-field--grow">
          <label class="nb-label">Available times</label>
          <div class="nb-slots" id="nb-slots">
            <p class="nb-slots-empty">Loading…</p>
          </div>
        </div>
      </div>

      <div class="nb-section">
        <p class="nb-section-title">Client</p>

        <div class="nb-field">
          <label class="nb-label" for="nb-name">Name <span class="nb-required">*</span></label>
          <input class="a-input" id="nb-name" type="text" autocomplete="off" placeholder="Thandi Mokoena">
        </div>

        <div class="nb-field">
          <label class="nb-label" for="nb-phone">Phone <span class="nb-required">*</span></label>
          <input class="a-input" id="nb-phone" type="tel" autocomplete="off" placeholder="+27 82 123 4567">
          <p class="nb-hint" id="nb-client-hint"></p>
        </div>

        <div class="nb-field">
          <label class="nb-label" for="nb-email">Email <span class="nb-optional">(optional)</span></label>
          <input class="a-input" id="nb-email" type="email" autocomplete="off" placeholder="thandi@example.com">
        </div>

        <div class="nb-field">
          <label class="nb-label" for="nb-notes">Notes <span class="nb-optional">(optional)</span></label>
          <textarea class="a-input" id="nb-notes" rows="3" placeholder="Allergies, preferences, colour formula…"></textarea>
        </div>
      </div>

      <p class="nb-error" id="nb-error" role="alert"></p>
    </div>
  `;

  const close = openSlideOver({
    title: 'New booking',
    body,
    actions: [
      { label: 'Cancel', onClick: (c) => c() },
      {
        label: 'Create booking',
        variant: 'primary',
        onClick: async (c) => {
          const ok = await submit(c, formState, settings);
          if (ok && typeof onCreated === 'function') onCreated();
        },
      },
    ],
  });

  /* --- Wire the form ---------------------------------------------------- */

  const $service = document.getElementById('nb-service');
  const $date    = document.getElementById('nb-date');
  const $slots   = document.getElementById('nb-slots');
  const $name    = document.getElementById('nb-name');
  const $phone   = document.getElementById('nb-phone');
  const $email   = document.getElementById('nb-email');
  const $notes   = document.getElementById('nb-notes');
  const $error   = document.getElementById('nb-error');
  const $hint    = document.getElementById('nb-client-hint');

  $service.value = formState.serviceId;

  /* Service change → reload slots */
  $service.addEventListener('change', () => {
    formState.serviceId = $service.value;
    formState.slotStart = null;
    loadSlots();
  });

  /* Date change → reload slots */
  $date.addEventListener('change', () => {
    formState.date = $date.value || toSastDateStr(new Date());
    formState.slotStart = null;
    loadSlots();
  });

  /* Phone blur → check for existing client */
  let phoneLookupTimer;
  $phone.addEventListener('input', () => {
    clearTimeout(phoneLookupTimer);
    phoneLookupTimer = setTimeout(async () => {
      const phone = $phone.value.trim();
      if (phone.length < 6) {
        $hint.textContent = '';
        return;
      }
      const { data } = await supabase
        .from('clients')
        .select('id, name, phone, email')
        .eq('phone', phone)
        .maybeSingle();
      if (data) {
        $hint.textContent = `Existing client — ${data.name}`;
        $hint.className = 'nb-hint nb-hint--found';
        if (!$name.value) $name.value = data.name;
        if (!$email.value && data.email) $email.value = data.email;
      } else {
        $hint.textContent = 'New client';
        $hint.className = 'nb-hint';
      }
    }, 400);
  });

  /* --- Slot loader ------------------------------------------------------ */

  async function loadSlots() {
    formState.loadingSlots = true;
    $slots.innerHTML = '<p class="nb-slots-empty">Loading…</p>';

    const svc = services.find(s => s.id === formState.serviceId);
    if (!svc) return;

    /* Compute start and end of the target day, in UTC */
    const dayStart = sastToUtc(formState.date, 0);
    const dayEnd   = sastToUtc(formState.date, 24 * 60);

    /* Fetch bookings and blocks that touch this day */
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

    const bookingRows = (bookingsRes.data || []).map(b => ({
      start: new Date(b.start_at),
      end:   new Date(b.end_at),
      status: b.status,
    }));
    const blockRows = (blocksRes.data || []).map(b => ({
      start: new Date(b.start_at),
      end:   new Date(b.end_at),
    }));

    /* Convert availability rows to the shape the engine expects */
    const availRows = (availability || []).map(a => ({
      weekday: a.weekday,
      start_min: hhmmToMin(a.start_time),
      end_min:   hhmmToMin(a.end_time),
      active:    a.active,
    }));

    const slots = getAvailableSlots({
      date: formState.date,
      availability: availRows,
      bookings: bookingRows,
      blocks: blockRows,
      serviceDuration: svc.duration_min,
      bufferMin: settings?.buffer_min ?? 0,
      slotIntervalMin: settings?.slot_interval_min ?? 30,
      minNoticeHours: settings?.booking_min_notice_hours ?? 2,
      maxAdvanceDays: settings?.booking_max_advance_days ?? 60,
    });

    formState.slots = slots;
    formState.loadingSlots = false;

    if (!slots.length) {
      $slots.innerHTML = '<p class="nb-slots-empty">No slots available on this day.</p>';
      return;
    }

    $slots.innerHTML = slots.map(s => {
      const iso = s.start.toISOString();
      const active = formState.slotStart === iso ? ' is-active' : '';
      return `
        <button type="button" class="nb-slot${active}" data-iso="${iso}">
          ${formatTime24(s.start)}
        </button>
      `;
    }).join('');

    $slots.querySelectorAll('.nb-slot').forEach(btn => {
      btn.addEventListener('click', () => {
        formState.slotStart = btn.getAttribute('data-iso');
        $slots.querySelectorAll('.nb-slot').forEach(b => b.classList.toggle('is-active', b === btn));
      });
    });
  }

  /* --- Submit ----------------------------------------------------------- */

  async function submit(c, state, settings) {
    $error.textContent = '';

    /* Validation */
    if (!state.slotStart) {
      $error.textContent = 'Pick an available time.';
      return false;
    }
    const name = $name.value.trim();
    const phone = $phone.value.trim();
    if (!name) {
      $error.textContent = 'Client name is required.';
      $name.focus();
      return false;
    }
    if (!phone) {
      $error.textContent = 'Phone number is required.';
      $phone.focus();
      return false;
    }

    const svc = services.find(s => s.id === state.serviceId);
    if (!svc) {
      $error.textContent = 'Service is missing.';
      return false;
    }

    /* Find or create the client */
    let clientId;
    const { data: existingClient } = await supabase
      .from('clients')
      .select('id')
      .eq('phone', phone)
      .maybeSingle();

    if (existingClient) {
      clientId = existingClient.id;
      /* Update name and email if they've changed */
      await supabase
        .from('clients')
        .update({
          name,
          email: $email.value.trim() || null,
        })
        .eq('id', clientId);
    } else {
      const { data: newClient, error: clientErr } = await supabase
        .from('clients')
        .insert({
          name,
          phone,
          email: $email.value.trim() || null,
        })
        .select('id')
        .single();

      if (clientErr) {
        $error.textContent = 'Could not save client: ' + clientErr.message;
        return false;
      }
      clientId = newClient.id;
    }

    /* Compute end time */
    const start = new Date(state.slotStart);
    const end = new Date(start.getTime() + svc.duration_min * 60_000);

    /* Insert the booking */
    const { error: bookingErr } = await supabase
      .from('bookings')
      .insert({
        client_id: clientId,
        service_id: svc.id,
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        status: 'confirmed',
        notes: $notes.value.trim() || null,
      });

    if (bookingErr) {
      $error.textContent = 'Could not create booking: ' + bookingErr.message;
      return false;
    }

    c(); /* close the slide-over */
    toast(`Booking created — ${name} at ${formatTime24(start)}`);
    return true;
  }

  /* --- Initial load ----------------------------------------------------- */

  await loadSlots();
}

/* --- Helpers ------------------------------------------------------------ */

function hhmmToMin(hhmm) {
  if (!hhmm) return 0;
  const [h, m] = String(hhmm).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function formatTime24(d) {
  const { minutes } = utcToSast(d instanceof Date ? d : new Date(d));
  const h = String(Math.floor(minutes / 60)).padStart(2, '0');
  const m = String(minutes % 60).padStart(2, '0');
  return `${h}:${m}`;
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