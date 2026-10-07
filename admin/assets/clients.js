/* ==========================================================================
   clients.js — Phase 4.
   Client list, search, sort, pagination. Detail slide-over with history.
   ========================================================================== */

import { supabase } from '/assets/js/supabase.js';
import {
  guard, mountSidebar, mountTopbar, mountUser,
  formatTime, toast, openSlideOver,
} from './admin.js';
import { toSastDateStr } from '/assets/js/booking/slots.js';

/* --- Constants ----------------------------------------------------------- */

const PAGE_SIZE = 25;

/* --- State --------------------------------------------------------------- */

const state = {
  search: '',
  sort:   'recent',
  page:   1,
  total:  0,
  rows:   [],
};

const els = {};

/* --- Auth + shell -------------------------------------------------------- */

const session = await guard();
if (session) {
  mountSidebar('clients');
  mountTopbar('Clients');
  await mountUser(session);
  await init();
}

/* --- Init ---------------------------------------------------------------- */

async function init() {
  els.list       = document.getElementById('clients-list');
  els.count      = document.getElementById('results-count');
  els.pagination = document.getElementById('pagination');
  els.search     = document.getElementById('f-search');
  els.sort       = document.getElementById('f-sort');
  els.reset      = document.getElementById('f-reset');

  /* Read URL */
  const p = new URLSearchParams(location.search);
  if (p.get('search')) state.search = p.get('search');
  if (p.get('sort'))   state.sort   = p.get('sort');
  if (p.get('page'))   state.page   = Math.max(1, parseInt(p.get('page'), 10) || 1);

  els.search.value = state.search;
  els.sort.value   = state.sort;

  /* Events */
  let searchTimer;
  els.search.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.search = els.search.value.trim();
      state.page = 1;
      syncAndFetch();
    }, 300);
  });

  els.sort.addEventListener('change', () => {
    state.sort = els.sort.value;
    state.page = 1;
    syncAndFetch();
  });

  els.reset.addEventListener('click', () => {
    state.search = '';
    state.sort = 'recent';
    state.page = 1;
    els.search.value = '';
    els.sort.value = 'recent';
    syncAndFetch();
  });

  await fetchClients();
}

function syncUrl() {
  const p = new URLSearchParams();
  if (state.search)          p.set('search', state.search);
  if (state.sort !== 'recent') p.set('sort', state.sort);
  if (state.page !== 1)      p.set('page', state.page);
  const qs = p.toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}

async function syncAndFetch() {
  syncUrl();
  await fetchClients();
}

/* --- Fetch --------------------------------------------------------------- */

async function fetchClients() {
  els.list.innerHTML = '<div class="a-empty"><h3>Loading…</h3></div>';

  /* Base query — clients with an embedded count of bookings.
     Supabase doesn't support aggregate counts in the select, so we fetch
     bookings separately for the visible page and merge. */

  let q = supabase
    .from('clients')
    .select('id, name, email, phone, notes, created_at', { count: 'exact' });

  if (state.search) {
    const s = state.search.replace(/[%_]/g, '\\$&');
    q = q.or(`name.ilike.%${s}%,phone.ilike.%${s}%,email.ilike.%${s}%`);
  }

  /* Sort. "recent" and "name" both need a bit of custom handling.
     For "recent" we sort by created_at as a proxy for now — real "last
     booking" sort requires a join, which PostgREST can't do cleanly here.
     We'll sort the fetched page by most recent booking in-memory. */
  switch (state.sort) {
    case 'name':
      q = q.order('name', { ascending: true });
      break;
    case 'created':
      q = q.order('created_at', { ascending: false });
      break;
    case 'recent':
    default:
      /* Fetch without order, we'll sort in JS after the join */
      q = q.order('created_at', { ascending: false });
      break;
  }

  const offset = (state.page - 1) * PAGE_SIZE;
  q = q.range(offset, offset + PAGE_SIZE - 1);

  const { data, error, count } = await q;

  if (error) {
    console.error('Clients fetch failed:', error);
    els.list.innerHTML = `<div class="a-empty"><h3>Could not load clients</h3><p>${error.message}</p></div>`;
    return;
  }

  state.rows = data || [];
  state.total = count || 0;

  /* Fetch booking summary for the visible clients */
  if (state.rows.length) {
    const ids = state.rows.map(c => c.id);
    const { data: bookings } = await supabase
      .from('bookings')
      .select('client_id, start_at, status, services ( price )')
      .in('client_id', ids);

    const summary = new Map();
    for (const b of (bookings || [])) {
      if (!summary.has(b.client_id)) {
        summary.set(b.client_id, { total: 0, spent: 0, no_shows: 0, last: null, next: null });
      }
      const s = summary.get(b.client_id);
      s.total += 1;
      if (b.status === 'completed' && b.services?.price) s.spent += Number(b.services.price);
      if (b.status === 'no_show') s.no_shows += 1;

      const when = new Date(b.start_at);
      const now = new Date();
      if (when <= now) {
        if (!s.last || when > s.last) s.last = when;
      } else {
        if (!s.next || when < s.next) s.next = when;
      }
    }

    for (const c of state.rows) {
      c._stats = summary.get(c.id) || { total: 0, spent: 0, no_shows: 0, last: null, next: null };
    }

    /* Sort in-memory for "recent" */
    if (state.sort === 'recent') {
      state.rows.sort((a, b) => {
        const la = a._stats.last ? a._stats.last.getTime() : 0;
        const lb = b._stats.last ? b._stats.last.getTime() : 0;
        if (la !== lb) return lb - la;
        return new Date(b.created_at) - new Date(a.created_at);
      });
    }
  }

  renderList();
  renderCount();
  renderPagination();
}

/* --- Render -------------------------------------------------------------- */

function renderCount() {
  els.count.textContent = state.total === 1 ? '1 client' : `${state.total} clients`;
}

function renderList() {
  if (!state.rows.length) {
    els.list.innerHTML = `
      <div class="a-empty">
        <svg class="a-empty-icon" viewBox="0 0 24 24">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
        <h3>${state.search ? 'No matching clients' : 'No clients yet'}</h3>
        <p>${state.search ? 'Try a different search.' : 'Clients appear here once they book.'}</p>
      </div>
    `;
    return;
  }

  els.list.innerHTML = `
    <ul class="cl-list">
      ${state.rows.map(c => {
        const s = c._stats;
        return `
          <li class="cl-row" data-client-id="${c.id}">
            <div class="cl-main">
              <p class="cl-name">${escapeHtml(c.name)}</p>
              <p class="cl-contact">${escapeHtml(c.phone || '—')}${c.email ? ' · ' + escapeHtml(c.email) : ''}</p>
            </div>
            <div class="cl-stat">
              <span class="cl-stat-value">${s.total}</span>
              <span class="cl-stat-label">${s.total === 1 ? 'booking' : 'bookings'}</span>
            </div>
            <div class="cl-stat">
              <span class="cl-stat-value">${formatZAR(s.spent)}</span>
              <span class="cl-stat-label">spent</span>
            </div>
            <div class="cl-last">
              ${s.last
                ? `<span class="cl-last-label">Last</span><span class="cl-last-value">${formatDate(s.last)}</span>`
                : '<span class="cl-last-value cl-last-value--none">No bookings</span>'}
            </div>
            <div class="cl-next">
              ${s.next
                ? `<span class="cl-next-label">Next</span><span class="cl-next-value">${formatDate(s.next)}</span>`
                : ''}
            </div>
          </li>
        `;
      }).join('')}
    </ul>
  `;

  els.list.querySelectorAll('[data-client-id]').forEach(row => {
    row.addEventListener('click', () => {
      const id = row.getAttribute('data-client-id');
      const client = state.rows.find(c => c.id === id);
      if (client) openClient(client);
    });
  });
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

/* --- Detail slide-over -------------------------------------------------- */

async function openClient(client) {
  const stats = client._stats;

  /* Fetch recent bookings */
  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, start_at, end_at, status, notes, services ( name, price, duration_min )')
    .eq('client_id', client.id)
    .order('start_at', { ascending: false })
    .limit(10);

  const bookingRows = (bookings || []).map(b => `
    <li class="cd-booking">
      <div class="cd-booking-when">
        <span class="cd-booking-date">${formatDate(b.start_at)}</span>
        <span class="cd-booking-time">${formatTime(b.start_at)}</span>
      </div>
      <div class="cd-booking-main">
        <span class="cd-booking-service">${escapeHtml(b.services?.name || 'Service')}</span>
      </div>
      <div class="cd-booking-meta">
        <span class="a-badge a-badge--${b.status}">${statusLabel(b.status)}</span>
        <span class="cd-booking-price">${formatZAR(b.services?.price)}</span>
      </div>
    </li>
  `).join('');

  const body = `
    <div class="cd">
      <div class="cd-stats">
        <div class="cd-stat">
          <span class="cd-stat-value">${stats.total}</span>
          <span class="cd-stat-label">Bookings</span>
        </div>
        <div class="cd-stat">
          <span class="cd-stat-value">${formatZAR(stats.spent)}</span>
          <span class="cd-stat-label">Spent</span>
        </div>
        <div class="cd-stat">
          <span class="cd-stat-value">${stats.no_shows}</span>
          <span class="cd-stat-label">No-shows</span>
        </div>
      </div>

      <div class="cd-section">
        <p class="cd-section-title">Contact</p>
        <div class="cd-field">
          <span class="cd-label">Phone</span>
          <span class="cd-value">
            ${client.phone
              ? `<a href="tel:${escapeHtml(client.phone)}">${escapeHtml(client.phone)}</a>
                 &nbsp;·&nbsp;
                 <a href="https://wa.me/${client.phone.replace(/\D/g, '')}" target="_blank" rel="noopener">WhatsApp</a>`
              : '—'}
          </span>
        </div>
        <div class="cd-field">
          <span class="cd-label">Email</span>
          <span class="cd-value">${client.email ? `<a href="mailto:${escapeHtml(client.email)}">${escapeHtml(client.email)}</a>` : '—'}</span>
        </div>
      </div>

      <div class="cd-section">
        <p class="cd-section-title">Notes</p>
        <textarea class="a-input cd-notes" id="cd-notes" rows="3" placeholder="Allergies, preferences, anything worth remembering…">${escapeHtml(client.notes || '')}</textarea>
        <button type="button" class="a-btn a-btn-primary a-btn-sm" id="cd-save-notes" style="margin-top: 8px;">Save notes</button>
      </div>

      <div class="cd-section">
        <p class="cd-section-title">Recent bookings</p>
        ${bookingRows || '<p class="cd-empty">No bookings yet.</p>'}
        ${bookings?.length >= 10
          ? '<a href="/admin/bookings.html?search=' + encodeURIComponent(client.name) + '&range=all&status=all" class="cd-more">See all bookings →</a>'
          : ''}
      </div>

      ${stats.total === 0
        ? `<div class="cd-section cd-section--danger">
             <p class="cd-section-title">Danger zone</p>
             <p class="cd-hint">This client has no bookings. Deleting them will remove them permanently.</p>
             <button type="button" class="a-btn a-btn-danger a-btn-sm" id="cd-delete">Delete client</button>
           </div>`
        : ''
      }
    </div>
  `;

  const actions = [];

  openSlideOver({
    title: client.name,
    body,
    actions,
  });

  /* Wire after open */
  setTimeout(() => {
    document.getElementById('cd-save-notes')?.addEventListener('click', async () => {
      const notes = document.getElementById('cd-notes').value.trim();
      const { error } = await supabase
        .from('clients')
        .update({ notes: notes || null })
        .eq('id', client.id);
      if (error) {
        toast('Could not save: ' + error.message);
        return;
      }
      client.notes = notes;
      toast('Notes saved');
    });

    document.getElementById('cd-delete')?.addEventListener('click', async () => {
      if (!confirm(`Delete ${client.name}? This cannot be undone.`)) return;
      const { error } = await supabase.from('clients').delete().eq('id', client.id);
      if (error) {
        toast('Could not delete: ' + error.message);
        return;
      }
      toast('Client deleted');
      /* Close slide-over and refresh */
      document.querySelector('.a-slideover-close')?.click();
      await fetchClients();
    });
  }, 50);
}

/* --- Helpers ------------------------------------------------------------ */

function statusLabel(status) {
  return {
    confirmed: 'Confirmed',
    completed: 'Completed',
    cancelled: 'Cancelled',
    no_show:   'No-show',
  }[status] || status;
}

function formatZAR(n) {
  if (!n) return 'R0';
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency', currency: 'ZAR', maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(d) {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  return new Intl.DateTimeFormat('en-ZA', {
    timeZone: 'Africa/Johannesburg',
    day: 'numeric', month: 'short', year: 'numeric',
  }).format(date);
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}