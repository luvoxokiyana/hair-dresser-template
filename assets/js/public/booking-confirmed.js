/* ==========================================================================
   booking-confirmed.js — Phase 3b.
   Reads booking params from the URL, renders the confirmation, wires
   WhatsApp handoff and ICS download. Fetches footer data from settings.
   ========================================================================== */

import { supabase } from '../supabase.js';
import {
  bootPublicPage, formatPrice, formatDuration, esc,
} from './shared.js';
import { utcToSast, toSastDateStr } from '../booking/slots.js';
import { buildIcs, downloadIcs } from '../booking/ics.js';

/* --- State --------------------------------------------------------------- */

const state = {
  settings: null,
  booking: {
    id: null,
    service: '',
    price: null,
    start: null,   // ISO string
    duration: 0,
    name: '',
    phone: '',
  },
};

/* --- Boot ---------------------------------------------------------------- */

const settings = await bootPublicPage();
state.settings = settings;

init();

function init() {
  /* Parse URL params */
  const p = new URLSearchParams(location.search);
  state.booking = {
    id:       p.get('id') || '',
    service:  p.get('svc') || '',
    price:    p.get('price') ? Number(p.get('price')) : null,
    start:    p.get('start') || '',
    duration: p.get('dur') ? Number(p.get('dur')) : 0,
    name:     p.get('name') || '',
    phone:    p.get('phone') || '',
  };

  if (!state.booking.start) {
    /* No valid params — send them back to booking */
    window.location.replace('/booking.html');
    return;
  }

  renderConfirmation();
  wireActions();
  populateFooter();
}

/* --- Render -------------------------------------------------------------- */

function renderConfirmation() {
  const b = state.booking;
  const start = new Date(b.start);
  const end = new Date(start.getTime() + b.duration * 60_000);

  document.getElementById('c-service').textContent  = b.service || '—';
  document.getElementById('c-when').textContent     = formatWhen(start, end);
  document.getElementById('c-duration').textContent = b.duration ? formatDuration(b.duration) : '—';
  document.getElementById('c-price').textContent    = b.price != null ? formatPrice(b.price) : 'On request';
  document.getElementById('c-name').textContent     = b.name || '—';

  /* Address from settings */
  const address = state.settings?.address;
  if (address) {
    document.getElementById('c-address').textContent = address;
    document.getElementById('c-address-row').hidden = false;
  }
}

function wireActions() {
  document.getElementById('whatsapp-btn').addEventListener('click', (e) => {
    e.preventDefault();
    openWhatsApp();
  });

  document.getElementById('ics-btn').addEventListener('click', () => {
    downloadIcsFromBooking();
  });
}

/* --- WhatsApp handoff ---------------------------------------------------- */

function openWhatsApp() {
  const b = state.booking;
  const number = (state.settings?.whatsapp_number || state.settings?.phone || '').replace(/\D/g, '');
  if (!number) return;

  const start = new Date(b.start);
  const message = buildWhatsAppMessage(b, start);
  const url = `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank', 'noopener');
}

function buildWhatsAppMessage(b, start) {
  const salonName = state.settings?.business_name || 'there';
  const { minutes } = utcToSast(start);
  const timeStr = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

  const dateStr = new Intl.DateTimeFormat('en-ZA', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Africa/Johannesburg',
  }).format(start);

  return `Hi ${salonName},

I've just booked an appointment through your site.

Name: ${b.name}
Service: ${b.service}
When: ${dateStr} at ${timeStr}

Looking forward to it.`;
}

/* --- ICS download -------------------------------------------------------- */

function downloadIcsFromBooking() {
  const b = state.booking;
  const start = new Date(b.start);
  const end = new Date(start.getTime() + b.duration * 60_000);

  const ics = buildIcs({
    uid: b.id || `booking-${Date.now()}@salon`,
    start,
    end,
    title: `${b.service} — ${state.settings?.business_name || 'Appointment'}`,
    description: [
      `Service: ${b.service}`,
      b.name ? `Booked by: ${b.name}` : '',
      state.settings?.phone ? `Salon phone: ${state.settings.phone}` : '',
    ].filter(Boolean).join('\n'),
    location: state.settings?.address || '',
  });

  const filename = `appointment-${toSastDateStr(start)}.ics`;
  downloadIcs(ics, filename);
}

/* --- Footer -------------------------------------------------------------- */

function populateFooter() {
  const s = state.settings;
  if (!s) return;

  const visit = document.getElementById('footer-visit');
  if (visit) {
    const rows = [];
    if (s.address) rows.push(`<li>${esc(s.address)}</li>`);
    if (s.phone)   rows.push(`<li><a href="tel:${esc(s.phone)}">${esc(s.phone)}</a></li>`);
    if (s.email)   rows.push(`<li><a href="mailto:${esc(s.email)}">${esc(s.email)}</a></li>`);
    if (rows.length) visit.innerHTML = rows.join('');
  }

  const hours = document.getElementById('footer-hours');
  const h = s.hours || {};
  const order = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  if (hours) {
    const rows = order.filter(k => h[k]).map(k => `<li>${k.toUpperCase()} — ${esc(h[k])}</li>`);
    if (rows.length) hours.innerHTML = rows.join('');
  }

  const social = document.getElementById('footer-social');
  if (social) {
    const sc = s.social || {};
    const rows = [];
    if (sc.instagram) rows.push(`<li><a href="${esc(sc.instagram)}" target="_blank" rel="noopener">Instagram</a></li>`);
    if (sc.facebook)  rows.push(`<li><a href="${esc(sc.facebook)}"  target="_blank" rel="noopener">Facebook</a></li>`);
    if (sc.tiktok)    rows.push(`<li><a href="${esc(sc.tiktok)}"    target="_blank" rel="noopener">TikTok</a></li>`);
    if (rows.length) social.innerHTML = rows.join('');
  }
}

/* --- Helpers ------------------------------------------------------------ */

function formatWhen(start, end) {
  const day = new Intl.DateTimeFormat('en-ZA', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Africa/Johannesburg',
  }).format(start);

  const t1 = formatTime24(start);
  const t2 = formatTime24(end);

  return `${day} · ${t1}–${t2}`;
}

function formatTime24(d) {
  const { minutes } = utcToSast(d instanceof Date ? d : new Date(d));
  const h = String(Math.floor(minutes / 60)).padStart(2, '0');
  const m = String(minutes % 60).padStart(2, '0');
  return `${h}:${m}`;
}