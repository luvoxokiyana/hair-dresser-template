/* ==========================================================================
   gallery.js — Phase 6d.
   Gallery CRUD: list, add via Cloudinary upload, edit caption, reorder, delete.
   ========================================================================== */

import { supabase } from '/assets/js/supabase.js';
import { CONFIG } from '/assets/js/config.js';
import {
  guard, mountSidebar, mountTopbar, mountUser,
  toast, uploadImage,
} from './admin.js';

/* --- State --------------------------------------------------------------- */

const state = {
  photos: [],
};

const els = {};

/* --- Auth + shell -------------------------------------------------------- */

const session = await guard();
if (session) {
  mountSidebar('gallery');
  mountTopbar('Gallery');
  await mountUser(session);
  await init();
}

/* --- Init ---------------------------------------------------------------- */

async function init() {
  els.grid = document.getElementById('photos-grid');
  els.count = document.getElementById('photos-count');

  document.getElementById('add-photos-btn').addEventListener('click', () => {
    addPhotos();
  });

  await fetchPhotos();
}

/* --- Fetch --------------------------------------------------------------- */

async function fetchPhotos() {
  const { data, error } = await supabase
    .from('gallery')
    .select('id, cloudinary_id, url, caption, sort_order')
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Gallery fetch failed:', error);
    els.grid.innerHTML = `<div class="a-empty"><h3>Could not load gallery</h3><p>${error.message}</p></div>`;
    return;
  }

  state.photos = data || [];
  render();
}

/* --- Render -------------------------------------------------------------- */

function render() {
  els.count.textContent = state.photos.length === 1 ? '1 photo' : `${state.photos.length} photos`;

  if (!state.photos.length) {
    els.grid.innerHTML = `
      <div class="a-empty">
        <svg class="a-empty-icon" viewBox="0 0 24 24">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
        <h3>No photos yet</h3>
        <p>Upload your first photos to build the gallery.</p>
      </div>
    `;
    return;
  }

  els.grid.innerHTML = `
    <ul class="gl-grid">
      ${state.photos.map((p, i) => `
        <li class="gl-card" data-photo-id="${p.id}">
          <div class="gl-photo">
            <img src="${escapeAttr(p.url)}" alt="${escapeAttr(p.caption || '')}" loading="lazy">
          </div>

          <div class="gl-order">
            <button type="button" class="gl-order-btn" data-action="up" data-id="${p.id}" ${i === 0 ? 'disabled' : ''} aria-label="Move up">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
            </button>
            <button type="button" class="gl-order-btn" data-action="down" data-id="${p.id}" ${i === state.photos.length - 1 ? 'disabled' : ''} aria-label="Move down">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
          </div>

          <div class="gl-caption-wrap">
            <input
              class="gl-caption"
              type="text"
              value="${escapeAttr(p.caption || '')}"
              placeholder="Add a caption…"
              data-caption-id="${p.id}"
            >
          </div>

          <div class="gl-actions">
            <button type="button" class="a-btn a-btn-danger a-btn-sm" data-action="delete" data-id="${p.id}">Delete</button>
          </div>
        </li>
      `).join('')}
    </ul>
  `;

  wireRowActions();
  wireCaptionInputs();
}

function wireRowActions() {
  els.grid.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const id = btn.getAttribute('data-id');
      const action = btn.getAttribute('data-action');
      const photo = state.photos.find(p => p.id === id);
      if (!photo) return;

      switch (action) {
        case 'up':     move(photo, -1); break;
        case 'down':   move(photo, +1); break;
        case 'delete': remove(photo); break;
      }
    });
  });
}

function wireCaptionInputs() {
  els.grid.querySelectorAll('[data-caption-id]').forEach(input => {
    let originalValue = input.value;

    /* Save on blur if changed */
    input.addEventListener('blur', async () => {
      const value = input.value.trim();
      if (value === originalValue) return;

      const id = input.getAttribute('data-caption-id');
      const { error } = await supabase
        .from('gallery')
        .update({ caption: value || null })
        .eq('id', id);

      if (error) {
        toast('Could not save caption: ' + error.message);
        input.value = originalValue;
        return;
      }

      const photo = state.photos.find(p => p.id === id);
      if (photo) photo.caption = value || null;
      originalValue = value;
      toast('Caption saved');
    });

    /* Enter saves */
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        input.blur();
      }
    });
  });
}

/* --- Add photos ---------------------------------------------------------- */

async function addPhotos() {
  const addBtn = document.getElementById('add-photos-btn');
  addBtn.disabled = true;
  addBtn.textContent = 'Opening…';

  try {
    /* uploadImage() only handles one at a time in its current form,
       but the Cloudinary widget supports multi-select. For simplicity,
       we call it repeatedly and let the owner pick one per invocation.
       If they want bulk, they click again. */
    const result = await uploadImage({
      folder: `salons/${CONFIG.SITE_SLUG}/gallery`,
    });

    /* Find the next sort order */
    const maxOrder = state.photos.reduce((max, p) => Math.max(max, p.sort_order || 0), 0);

    const { error } = await supabase
      .from('gallery')
      .insert({
        cloudinary_id: result.publicId,
        url: result.url,
        caption: null,
        sort_order: maxOrder + 1,
      });

    if (error) {
      toast('Could not save photo: ' + error.message);
      return;
    }

    toast('Photo added');
    await fetchPhotos();
  } catch (err) {
    if (err?.message) toast(err.message);
  } finally {
    addBtn.disabled = false;
    addBtn.textContent = '+ Add photos';
  }
}

/* --- Reorder ------------------------------------------------------------- */

async function move(photo, direction) {
  const idx = state.photos.findIndex(p => p.id === photo.id);
  const swapIdx = idx + direction;

  if (swapIdx < 0 || swapIdx >= state.photos.length) return;

  const other = state.photos[swapIdx];
  const aOrder = photo.sort_order;
  const bOrder = other.sort_order;

  /* Optimistic reorder */
  photo.sort_order = bOrder;
  other.sort_order = aOrder;
  state.photos.sort((a, b) => a.sort_order - b.sort_order);
  render();

  /* Write both — parallel */
  const [r1, r2] = await Promise.all([
    supabase.from('gallery').update({ sort_order: bOrder }).eq('id', photo.id),
    supabase.from('gallery').update({ sort_order: aOrder }).eq('id', other.id),
  ]);

  if (r1.error || r2.error) {
    toast('Could not reorder. Refreshing.');
    await fetchPhotos();
  }
}

/* --- Delete -------------------------------------------------------------- */

async function remove(photo) {
  if (!confirm('Delete this photo? It will be removed from your public gallery.')) return;

  const { error } = await supabase.from('gallery').delete().eq('id', photo.id);

  if (error) {
    toast('Could not delete: ' + error.message);
    return;
  }
  toast('Photo deleted');
  await fetchPhotos();
}

/* --- Helpers ------------------------------------------------------------ */

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function escapeAttr(s) {
  return escapeHtml(s);
}