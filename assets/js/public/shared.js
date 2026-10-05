import { getSettings } from '../supabase.js';

/* --- Mobile nav toggle --------------------------------------------------- */
export function initNav() {
  const toggle = document.querySelector('.nav-toggle');
  const clusters = document.querySelectorAll('.nav-cluster');
  if (!toggle || !clusters.length) return;

  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!open));
    clusters.forEach(c => c.classList.toggle('is-open', !open));
  });
}

/* --- Active nav link ----------------------------------------------------- */
export function markActiveNav() {
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  document.querySelectorAll('.nav-cluster a').forEach(a => {
    const href = (a.getAttribute('href') || '').replace(/\/$/, '') || '/';
    if (href === path) a.classList.add('is-active');
  });
}

/* --- Footer year --------------------------------------------------------- */
export function setYear() {
  const el = document.getElementById('year');
  if (el) el.textContent = new Date().getFullYear();
}

/* --- Business name in wordmark / footer / title -------------------------- */
export function applyBusinessName(name) {
  document.querySelectorAll('[data-business-name]').forEach(el => {
    el.textContent = name;
  });
  if (name) {
    const parts = document.title.split(' — ');
    document.title = name + (parts[1] ? ' — ' + parts[1] : '');
  }
}

/* --- Format helpers ------------------------------------------------------ */
export function formatPrice(value, currency = 'ZAR') {
  if (value == null) return 'On request';
  try {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency', currency, maximumFractionDigits: 0
    }).format(value);
  } catch {
    return 'R' + Number(value).toFixed(0);
  }
}
export function formatDuration(minutes) {
  if (!minutes) return '';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/* --- Escape -------------------------------------------------------------- */
export function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* --- Boot ---------------------------------------------------------------- */
export async function bootPublicPage() {
  initNav();
  markActiveNav();
  setYear();
  try {
    const settings = await getSettings();
    if (settings?.business_name) applyBusinessName(settings.business_name);
    return settings;
  } catch (err) {
    console.warn('Settings unavailable:', err.message);
    return null;
  }
}