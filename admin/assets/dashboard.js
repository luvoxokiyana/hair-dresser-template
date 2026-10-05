/* ==========================================================================
   dashboard.js — Phase 2c.
   Read-only summary: today, this week, no-shows, revenue.
   ========================================================================== */

import { supabase } from '/assets/js/supabase.js';
import { guard, mountSidebar, mountTopbar, mountUser, formatTime } from './admin.js';
import {
  startOfDaySast, endOfDaySast,
  startOfWeekSast, endOfWeekSast,
  toSastDateStr,
} from '/assets/js/booking/slots.js';

const session = await guard();
if (!session) {
  // guard() already redirected
} else {
  mountSidebar('dashboard');
  mountTopbar('Dashboard');
  await mountUser(session);

  const now = new Date();
  const todayStart = startOfDaySast(now);
  const todayEnd   = endOfDaySast(now);
  const weekStart  = startOfWeekSast(now);
  const weekEnd    = endOfWeekSast(now);

  /* --- Run all queries in parallel -------------------------------------- */

  const [
    todayBookingsRes,
    weekCountRes,
    noShowsRes,
    revenueRes,
  ] = await Promise.all([
    /* Today's schedule — full rows with client + service */
    supabase
      .from('bookings')
      .select(`
        id,
        start_at,
        end_at,
        status,
        notes,
        clients ( name, phone ),
        services ( name, price, duration_min )
      `)
      .gte('start_at', todayStart.toISOString())
      .lt('start_at', todayEnd.toISOString())
      .in('status', ['confirmed', 'completed', 'no_show'])
      .order('start_at', { ascending: true }),

    /* This week count */
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .gte('start_at', weekStart.toISOString())
      .lt('start_at', weekEnd.toISOString())
      .in('status', ['confirmed', 'completed']),

    /* No-shows this week */
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .gte('start_at', weekStart.toISOString())
      .lt('start_at', weekEnd.toISOString())
      .eq('status', 'no_show'),

    /* Revenue this week — completed only, service price joined */
    supabase
      .from('bookings')
      .select('services ( price )')
      .gte('start_at', weekStart.toISOString())
      .lt('start_at', weekEnd.toISOString())
      .eq('status', 'completed'),
  ]);

  /* --- Stats ------------------------------------------------------------ */

  const todayCount = todayBookingsRes.data?.length ?? 0;
  const weekCount = weekCountRes.count ?? 0;
  const noShowCount = noShowsRes.count ?? 0;
  const revenue = (revenueRes.data || [])
    .reduce((sum, row) => sum + Number(row.services?.price ?? 0), 0);

  setStat('stat-today', todayCount);
  setStat('stat-week', weekCount);
  setStat('stat-noshows', noShowCount);
  setStat('stat-revenue', formatZAR(revenue));

  /* --- Today's schedule ------------------------------------------------- */

  renderToday(todayBookingsRes.data || []);

  /* --- Week summary (small table under schedule) ------------------------ */

  renderWeek(weekStart, weekEnd, weekCount, revenue, noShowCount);
}

/* ==========================================================================
   Helpers
   ========================================================================== */

function setStat(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function formatZAR(n) {
  if (!n) return 'R0';
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: 0,
  }).format(n);
}

function statusLabel(status) {
  return {
    confirmed: 'Confirmed',
    completed: 'Completed',
    cancelled: 'Cancelled',
    no_show:   'No-show',
  }[status] || status;
}

function renderToday(rows) {
  const container = document.getElementById('today-list');
  if (!container) return;

  if (!rows.length) {
    container.innerHTML = `
      <div class="a-empty">
        <svg class="a-empty-icon" viewBox="0 0 24 24">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <h3>Nothing booked today</h3>
        <p>Enjoy the quiet. Tomorrow is a new day.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <ul class="a-schedule">
      ${rows.map(b => `
        <li class="a-schedule-row">
          <div class="a-schedule-time">${formatTime(b.start_at)}</div>
          <div class="a-schedule-main">
            <p class="a-schedule-client">${escapeHtml(b.clients?.name || 'Client')}</p>
            <p class="a-schedule-service">
              ${escapeHtml(b.services?.name || 'Service')} · ${b.services?.duration_min || 0} min
            </p>
          </div>
          <div class="a-schedule-meta">
            <span class="a-badge a-badge--${b.status}">${statusLabel(b.status)}</span>
            <span class="a-schedule-price">${formatZAR(b.services?.price)}</span>
          </div>
        </li>
      `).join('')}
    </ul>
  `;
}

function renderWeek(weekStart, weekEnd, count, revenue, noShows) {
  const container = document.getElementById('week-summary');
  if (!container) return;

  const start = toSastDateStr(weekStart);
  const endExcl = new Date(weekEnd.getTime() - 1);
  const end = toSastDateStr(endExcl);

  container.innerHTML = `
    <dl class="a-week-list">
      <div class="a-week-row">
        <dt>Week range</dt>
        <dd>${start} → ${end}</dd>
      </div>
      <div class="a-week-row">
        <dt>Total bookings</dt>
        <dd>${count}</dd>
      </div>
      <div class="a-week-row">
        <dt>Completed revenue</dt>
        <dd>${formatZAR(revenue)}</dd>
      </div>
      <div class="a-week-row">
        <dt>No-shows</dt>
        <dd>${noShows}</dd>
      </div>
    </dl>
  `;
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}