/* ==========================================================================
   services.js — Phase 2f.
   Services CRUD: list, create, edit, deactivate, reactivate, reorder.
   ========================================================================== */

import { supabase } from '/assets/js/supabase.js';
import {
  guard, mountSidebar, mountTopbar, mountUser,
  toast, openSlideOver,
} from './admin.js';

/* --- State --------------------------------------------------------------- */

const state = {
  services: [],
};

const els = {};

/* --- Auth + shell -------------------------------------------------------- */

const session = await guard();
if (session) {
  mountSidebar('services');
  mountTopbar('Services');
  await mountUser(session);
  await init();
}

/* --- Init ---------------------------------------------------------------- */

async function init() {
  els.active   = document.getElementById('services-active');
  els.inactive = document.getElementById('services-inactive');
  els.activeCount   = document.getElementById('active-count');
  els.inactiveCount = document.getElementById('inactive-count');

  document.getElementById('new-service-btn').addEventListener('click', () => {
    openForm(null);
  });

  await fetchServices();
}

/* --- Fetch --------------------------------------------------------------- */

async function fetchServices() {
  const { data, error } = await supabase
    .from('services')
    .select('id, name, description, duration_min, price, active, sort_order')
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Services fetch failed:', error);
    els.active.innerHTML = `<div class="a-empty"><h3>Could not load services</h3><p>${error.message}</p></div>`;
    return;
  }

  state.services = data || [];
  render();
}

/* --- Render -------------------------------------------------------------- */

function render() {
  const active   = state.services.filter(s => s.active);
  const inactive = state.services.filter(s => !s.active);

  els.activeCount.textContent   = active.length === 1 ? '1 service' : `${active.length} services`;
  els.inactiveCount.textContent = inactive.length === 1 ? '1 service' : `${inactive.length} services`;

  els.active.innerHTML   = renderTable(active, true);
  els.inactive.innerHTML = renderTable(inactive, false);

  /* Wire row actions */
  document.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const id = btn.getAttribute('data-id');
      const action = btn.getAttribute('data-action');
      const svc = state.services.find(s => s.id === id);
      if (!svc) return;

      switch (action) {
        case 'edit':       openForm(svc); break;
        case 'deactivate': setActive(svc, false); break;
        case 'activate':   setActive(svc, true); break;
        case 'up':         move(svc, -1); break;
        case 'down':       move(svc, +1); break;
      }
    });
  });
}

function renderTable(rows, isActive) {
  if (!rows.length) {
    return `
      <div class="a-empty">
        <svg class="a-empty-icon" viewBox="0 0 24 24">
          <circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/>
          <line x1="20" y1="4" x2="8.12" y2="15.88"/>
          <line x1="14.47" y1="14.48" x2="20" y2="20"/>
          <line x1="8.12" y1="8.12" x2="12" y2="12"/>
        </svg>
        <h3>${isActive ? 'No services yet' : 'No inactive services'}</h3>
        <p>${isActive ? 'Add your first service to get started.' : 'Deactivated services appear here.'}</p>
      </div>
    `;
  }

  return `
    <ul class="svc-list">
      ${rows.map((s, i) => `
        <li class="svc-row">
          <div class="svc-order">
            ${isActive ? `
              <button type="button" class="svc-order-btn" data-action="up" data-id="${s.id}" ${i === 0 ? 'disabled' : ''} aria-label="Move up">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>
              </button>
              <button type="button" class="svc-order-btn" data-action="down" data-id="${s.id}" ${i === rows.length - 1 ? 'disabled' : ''} aria-label="Move down">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
            ` : ''}
          </div>

          <div class="svc-main">
            <p class="svc-name">${escapeHtml(s.name)}</p>
            ${s.description ? `<p class="svc-desc">${escapeHtml(s.description)}</p>` : ''}
          </div>

          <div class="svc-meta">
            <span class="svc-meta-value">${formatDuration(s.duration_min)}</span>
          </div>

          <div class="svc-price">
            ${formatZAR(s.price)}
          </div>

          <div class="svc-actions">
            <button type="button" class="a-btn a-btn-ghost a-btn-sm" data-action="edit" data-id="${s.id}">Edit</button>
            ${isActive
              ? `<button type="button" class="a-btn a-btn-ghost a-btn-sm" data-action="deactivate" data-id="${s.id}">Deactivate</button>`
              : `<button type="button" class="a-btn a-btn-ghost a-btn-sm" data-action="activate" data-id="${s.id}">Reactivate</button>`
            }
          </div>
        </li>
      `).join('')}
    </ul>
  `;
}

/* --- Create / Edit slide-over ------------------------------------------- */

function openForm(svc) {
  const isEdit = !!svc;
  const data = svc || {
    name: '', description: '', duration_min: 45, price: null, active: true,
  };

  const body = `
    <form class="svc-form" id="svc-form" onsubmit="return false;">
      <div class="svc-field">
        <label class="svc-label" for="svc-name">Name <span class="svc-required">*</span></label>
        <input class="a-input" id="svc-name" type="text" value="${escapeAttr(data.name)}" placeholder="Cut & Finish" autocomplete="off">
      </div>

      <div class="svc-field">
        <label class="svc-label" for="svc-description">Description <span class="svc-optional">(optional)</span></label>
        <textarea class="a-input" id="svc-description" rows="3" placeholder="Consultation, wash, cut, and finish.">${escapeHtml(data.description || '')}</textarea>
      </div>

      <div class="svc-row-fields">
        <div class="svc-field">
          <label class="svc-label" for="svc-duration">Duration (minutes) <span class="svc-required">*</span></label>
          <input class="a-input" id="svc-duration" type="number" min="5" step="5" value="${data.duration_min}" required>
        </div>
        <div class="svc-field">
          <label class="svc-label" for="svc-price">Price (ZAR) <span class="svc-optional">(blank = on request)</span></label>
          <input class="a-input" id="svc-price" type="number" min="0" step="10" value="${data.price ?? ''}" placeholder="450">
        </div>
      </div>

      <p class="svc-error" id="svc-error" role="alert"></p>
    </form>
  `;

  openSlideOver({
    title: isEdit ? 'Edit service' : 'New service',
    body,
    actions: [
      { label: 'Cancel', onClick: (c) => c() },
      {
        label: isEdit ? 'Save changes' : 'Create service',
        variant: 'primary',
        onClick: async (c) => {
          const ok = await submit(isEdit, svc, c);
          if (ok) {
            c();
            await fetchServices();
          }
        },
      },
    ],
  });

  setTimeout(() => document.getElementById('svc-name')?.focus(), 50);
}

async function submit(isEdit, svc, close) {
  const nameEl = document.getElementById('svc-name');
  const descEl = document.getElementById('svc-description');
  const durEl  = document.getElementById('svc-duration');
  const priceEl = document.getElementById('svc-price');
  const errEl  = document.getElementById('svc-error');

  errEl.textContent = '';

  const name = nameEl.value.trim();
  const duration = parseInt(durEl.value, 10);

  if (!name) { errEl.textContent = 'Name is required.'; nameEl.focus(); return false; }
  if (!duration || duration < 5) { errEl.textContent = 'Duration must be at least 5 minutes.'; durEl.focus(); return false; }

  const priceRaw = priceEl.value.trim();
  const price = priceRaw === '' ? null : Number(priceRaw);
  if (price !== null && (isNaN(price) || price < 0)) {
    errEl.textContent = 'Price must be a positive number or left blank.';
    priceEl.focus();
    return false;
  }

  const payload = {
    name,
    description: descEl.value.trim() || null,
    duration_min: duration,
    price,
    active: isEdit ? svc.active : true,
  };

  if (isEdit) {
    const { error } = await supabase
      .from('services')
      .update(payload)
      .eq('id', svc.id);
    if (error) { errEl.textContent = 'Could not save: ' + error.message; return false; }
    toast('Service updated');
    return true;
  }

  /* New service — put it at the end of the sort order */
  const maxOrder = state.services.reduce((max, s) => Math.max(max, s.sort_order || 0), 0);
  payload.sort_order = maxOrder + 1;

  const { error } = await supabase.from('services').insert(payload);
  if (error) { errEl.textContent = 'Could not create: ' + error.message; return false; }
  toast('Service created');
  return true;
}

/* --- Deactivate / Reactivate -------------------------------------------- */

async function setActive(svc, active) {
  if (!active && !confirm(`Deactivate "${svc.name}"?\n\nClients won't be able to book it, but existing bookings keep their link.`)) {
    return;
  }

  const { error } = await supabase
    .from('services')
    .update({ active })
    .eq('id', svc.id);

  if (error) {
    toast('Could not update: ' + error.message);
    return;
  }
  toast(active ? 'Service reactivated' : 'Service deactivated');
  await fetchServices();
}

/* --- Reorder ------------------------------------------------------------ */

async function move(svc, direction) {
  /* Find neighbours in the active list, sorted by sort_order */
  const active = state.services
    .filter(s => s.active)
    .sort((a, b) => a.sort_order - b.sort_order);
  const idx = active.findIndex(s => s.id === svc.id);
  const swapIdx = idx + direction;

  if (swapIdx < 0 || swapIdx >= active.length) return;

  const other = active[swapIdx];
  const aOrder = svc.sort_order;
  const bOrder = other.sort_order;

  /* Optimistic reorder */
  svc.sort_order = bOrder;
  other.sort_order = aOrder;
  render();

  /* Write both — parallel */
  const [r1, r2] = await Promise.all([
    supabase.from('services').update({ sort_order: bOrder }).eq('id', svc.id),
    supabase.from('services').update({ sort_order: aOrder }).eq('id', other.id),
  ]);

  if (r1.error || r2.error) {
    toast('Could not reorder. Refreshing.');
    await fetchServices();
  }
}

/* --- Helpers ------------------------------------------------------------ */

function formatDuration(min) {
  if (!min) return '';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function formatZAR(n) {
  if (n == null) return 'On request';
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

function escapeAttr(s) {
  return escapeHtml(s);
}