/* ==========================================================================
   settings.js — Phase 2h.
   Four tabs: business, booking rules, calendar, account.
   ========================================================================== */

import { supabase, signOut } from '/assets/js/supabase.js';
import {
  guard, mountSidebar, mountTopbar, mountUser, toast,
} from './admin.js';

/* --- State --------------------------------------------------------------- */

const state = {
  settings: null,
  session: null,
  availability: [],
};

/* --- Auth + shell -------------------------------------------------------- */

const session = await guard();
if (session) {
  state.session = session;
  mountSidebar('settings');
  mountTopbar('Settings');
  await mountUser(session);
  await init();
}

/* --- Init ---------------------------------------------------------------- */

async function init() {
  setupTabs();

  /* Load settings + availability in parallel */
  const [settingsRes, availabilityRes] = await Promise.all([
    supabase.from('settings').select('*').eq('id', 1).single(),
    supabase.from('availability').select('weekday, start_time, end_time, active'),
  ]);

  if (settingsRes.error) {
    toast('Could not load settings: ' + settingsRes.error.message);
    return;
  }
  state.settings = settingsRes.data;
  state.availability = availabilityRes.data || [];

  fillBusinessForm();
  fillRulesForm();
  fillCalendarForm();
  fillAccountPanel();

  wireForms();
}

/* --- Tabs ---------------------------------------------------------------- */

function setupTabs() {
  const tabs = document.querySelectorAll('.st-tab');
  const panels = document.querySelectorAll('.st-panel');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const key = tab.getAttribute('data-tab');
      tabs.forEach(t => t.classList.toggle('is-active', t === tab));
      panels.forEach(p => p.classList.toggle('is-active', p.getAttribute('data-panel') === key));
    });
  });
}

/* ==========================================================================
   Business
   ========================================================================== */

function fillBusinessForm() {
  const s = state.settings;

  set('b-business_name', s.business_name);
  set('b-tagline', s.tagline);
  set('b-phone', s.phone);
  set('b-whatsapp_number', s.whatsapp_number);
  set('b-email', s.email);
  set('b-address', s.address);
  set('b-map_url', s.map_url);

  const social = s.social || {};
  set('b-instagram', social.instagram);
  set('b-facebook', social.facebook);
  set('b-tiktok', social.tiktok);

  const hours = s.hours || {};
  set('h-mon', hours.mon);
  set('h-tue', hours.tue);
  set('h-wed', hours.wed);
  set('h-thu', hours.thu);
  set('h-fri', hours.fri);
  set('h-sat', hours.sat);
  set('h-sun', hours.sun);

  set('b-client_privacy_text', s.client_privacy_text);
}

async function saveBusiness(e) {
  e.preventDefault();
  const msg = document.getElementById('b-message');
  msg.textContent = '';
  msg.className = 'st-message';

  const businessName = get('b-business_name').trim();
  if (!businessName) {
    msg.textContent = 'Business name is required.';
    msg.className = 'st-message is-error';
    return;
  }

  const payload = {
    business_name: businessName,
    tagline: get('b-tagline').trim() || null,
    phone: get('b-phone').trim() || null,
    whatsapp_number: get('b-whatsapp_number').trim() || null,
    email: get('b-email').trim() || null,
    address: get('b-address').trim() || null,
    map_url: get('b-map_url').trim() || null,
    social: {
      instagram: get('b-instagram').trim() || null,
      facebook: get('b-facebook').trim() || null,
      tiktok: get('b-tiktok').trim() || null,
    },
    hours: {
      mon: get('h-mon').trim() || null,
      tue: get('h-tue').trim() || null,
      wed: get('h-wed').trim() || null,
      thu: get('h-thu').trim() || null,
      fri: get('h-fri').trim() || null,
      sat: get('h-sat').trim() || null,
      sun: get('h-sun').trim() || null,
    },
    client_privacy_text: get('b-client_privacy_text').trim() || null,
  };

  const { error } = await supabase
    .from('settings')
    .update(payload)
    .eq('id', 1);

  if (error) {
    msg.textContent = 'Could not save: ' + error.message;
    msg.className = 'st-message is-error';
    return;
  }

  state.settings = { ...state.settings, ...payload };
  msg.textContent = 'Saved.';
  msg.className = 'st-message is-success';
  toast('Business details saved');
}

/* ==========================================================================
   Booking rules
   ========================================================================== */

function fillRulesForm() {
  const s = state.settings;
  set('r-slot_interval_min', s.slot_interval_min ?? 30);
  set('r-buffer_min', s.buffer_min ?? 0);
  set('r-booking_min_notice_hours', s.booking_min_notice_hours ?? 2);
  set('r-booking_max_advance_days', s.booking_max_advance_days ?? 60);
}

async function saveRules(e) {
  e.preventDefault();
  const msg = document.getElementById('r-message');
  msg.textContent = '';
  msg.className = 'st-message';

  const slotInterval = parseInt(get('r-slot_interval_min'), 10);
  const buffer = parseInt(get('r-buffer_min'), 10);
  const minNotice = parseInt(get('r-booking_min_notice_hours'), 10);
  const maxAdvance = parseInt(get('r-booking_max_advance_days'), 10);

  if (!slotInterval || slotInterval < 5) {
    msg.textContent = 'Slot interval must be at least 5 minutes.';
    msg.className = 'st-message is-error';
    return;
  }
  if (buffer < 0) {
    msg.textContent = 'Buffer cannot be negative.';
    msg.className = 'st-message is-error';
    return;
  }
  if (minNotice < 0) {
    msg.textContent = 'Minimum notice cannot be negative.';
    msg.className = 'st-message is-error';
    return;
  }
  if (!maxAdvance || maxAdvance < 1) {
    msg.textContent = 'Maximum advance must be at least 1 day.';
    msg.className = 'st-message is-error';
    return;
  }

  const payload = {
    slot_interval_min: slotInterval,
    buffer_min: buffer,
    booking_min_notice_hours: minNotice,
    booking_max_advance_days: maxAdvance,
  };

  const { error } = await supabase
    .from('settings')
    .update(payload)
    .eq('id', 1);

  if (error) {
    msg.textContent = 'Could not save: ' + error.message;
    msg.className = 'st-message is-error';
    return;
  }

  state.settings = { ...state.settings, ...payload };
  msg.textContent = 'Saved.';
  msg.className = 'st-message is-success';
  toast('Booking rules saved');
}

/* ==========================================================================
   Calendar
   ========================================================================== */

function fillCalendarForm() {
  const s = state.settings;

  /* Days checkboxes */
  const days = Array.isArray(s.calendar_days) && s.calendar_days.length
    ? s.calendar_days
    : ['mon','tue','wed','thu','fri','sat','sun'];
  document.querySelectorAll('#cal-days input[type="checkbox"]').forEach(cb => {
    cb.checked = days.includes(cb.value);
  });

  /* Hours */
  const h = s.calendar_hours || { start: '08:00', end: '19:00' };
  set('c-start', h.start || '08:00');
  set('c-end',   h.end   || '19:00');
}

async function saveCalendar(e) {
  e.preventDefault();
  const msg = document.getElementById('c-message');
  msg.textContent = '';
  msg.className = 'st-message';

  const days = Array.from(document.querySelectorAll('#cal-days input[type="checkbox"]'))
    .filter(cb => cb.checked)
    .map(cb => cb.value);

  if (!days.length) {
    msg.textContent = 'Pick at least one day.';
    msg.className = 'st-message is-error';
    return;
  }

  const start = get('c-start');
  const end = get('c-end');

  if (!start || !end) {
    msg.textContent = 'Both start and end times are required.';
    msg.className = 'st-message is-error';
    return;
  }
  if (end <= start) {
    msg.textContent = 'End time must be after start time.';
    msg.className = 'st-message is-error';
    return;
  }

  const payload = {
    calendar_days: days,
    calendar_hours: { start, end },
  };

  const { error } = await supabase
    .from('settings')
    .update(payload)
    .eq('id', 1);

  if (error) {
    msg.textContent = 'Could not save: ' + error.message;
    msg.className = 'st-message is-error';
    return;
  }

  state.settings = { ...state.settings, ...payload };
  msg.textContent = 'Saved.';
  msg.className = 'st-message is-success';
  toast('Calendar preferences saved');
}

/* ==========================================================================
   Account
   ========================================================================== */

function fillAccountPanel() {
  set('a-email', state.session.user.email || '');
}

function wireForms() {
  document.getElementById('form-business').addEventListener('submit', saveBusiness);
  document.getElementById('form-rules').addEventListener('submit', saveRules);
  document.getElementById('form-calendar').addEventListener('submit', saveCalendar);
  document.getElementById('form-password').addEventListener('submit', changePassword);
  document.getElementById('a-signout-all').addEventListener('click', signOutEverywhere);
}

async function changePassword(e) {
  e.preventDefault();
  const msg = document.getElementById('a-password-message');
  msg.textContent = '';
  msg.className = 'st-message';

  const pwd = document.getElementById('a-new-password').value;
  const confirm = document.getElementById('a-confirm-password').value;

  if (pwd.length < 8) {
    msg.textContent = 'Password must be at least 8 characters.';
    msg.className = 'st-message is-error';
    return;
  }
  if (pwd !== confirm) {
    msg.textContent = 'Passwords do not match.';
    msg.className = 'st-message is-error';
    return;
  }

  const { error } = await supabase.auth.updateUser({ password: pwd });
  if (error) {
    msg.textContent = 'Could not change password: ' + error.message;
    msg.className = 'st-message is-error';
    return;
  }

  document.getElementById('a-new-password').value = '';
  document.getElementById('a-confirm-password').value = '';
  msg.textContent = 'Password changed.';
  msg.className = 'st-message is-success';
  toast('Password updated');
}

async function signOutEverywhere() {
  if (!confirm('Sign out of Kaya everywhere, including this device?')) return;
  await signOut();
  window.location.replace('/admin/index.html');
}

/* --- Helpers ------------------------------------------------------------ */

function set(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value ?? '';
}

function get(id) {
  const el = document.getElementById(id);
  return el ? el.value : '';
}