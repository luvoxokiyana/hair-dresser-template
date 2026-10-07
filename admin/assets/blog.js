/* ==========================================================================
   blog.js — Phase 5.
   Blog CRUD. Drafts and published posts. Simple textarea editor.
   ========================================================================== */

import { supabase } from '/assets/js/supabase.js';
import {
  guard, mountSidebar, mountTopbar, mountUser,
  toast, openSlideOver,
} from './admin.js';
import { CONFIG } from '/assets/js/config.js';


/* --- State --------------------------------------------------------------- */

const state = {
  posts: [],
};

const els = {};

/* --- Auth + shell -------------------------------------------------------- */

const session = await guard();
if (session) {
  mountSidebar('blog');
  mountTopbar('Blog');
  await mountUser(session);
  await init();
}

/* --- Init ---------------------------------------------------------------- */

async function init() {
  els.published = document.getElementById('posts-published');
  els.draft = document.getElementById('posts-draft');
  els.pubCount = document.getElementById('published-count');
  els.draftCount = document.getElementById('drafts-count');

  document.getElementById('new-post-btn').addEventListener('click', () => openForm(null));

  await fetchPosts();
}

/* --- Fetch --------------------------------------------------------------- */

async function fetchPosts() {
  const { data, error } = await supabase
    .from('posts')
    .select('id, title, slug, body, cover_cloudinary_id, status, published_at, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Posts fetch failed:', error);
    els.published.innerHTML = `<div class="a-empty"><h3>Could not load posts</h3><p>${error.message}</p></div>`;
    return;
  }

  state.posts = data || [];
  render();
}

/* --- Render -------------------------------------------------------------- */

function render() {
  const published = state.posts.filter(p => p.status === 'published');
  const drafts = state.posts.filter(p => p.status === 'draft');

  els.pubCount.textContent = published.length === 1 ? '1 post' : `${published.length} posts`;
  els.draftCount.textContent = drafts.length === 1 ? '1 draft' : `${drafts.length} drafts`;

  els.published.innerHTML = renderList(published, true);
  els.draft.innerHTML = renderList(drafts, false);

  document.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const action = btn.getAttribute('data-action');
      const post = state.posts.find(p => p.id === id);
      if (!post) return;

      switch (action) {
        case 'edit': openForm(post); break;
        case 'publish': setStatus(post, 'published'); break;
        case 'unpublish': setStatus(post, 'draft'); break;
        case 'view': window.open(`/post.html?slug=${encodeURIComponent(post.slug)}`, '_blank'); break;
        case 'delete': removePost(post); break;
      }
    });
  });
}

function renderList(rows, isPublished) {
  if (!rows.length) {
    return `
      <div class="a-empty">
        <svg class="a-empty-icon" viewBox="0 0 24 24">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
        <h3>${isPublished ? 'No published posts yet' : 'No drafts'}</h3>
        <p>${isPublished ? 'Your published posts will show here.' : 'Drafts you save will appear here.'}</p>
      </div>
    `;
  }

  return `
    <ul class="bl-list">
      ${rows.map(p => `
        <li class="bl-row">
          <div class="bl-main">
            <p class="bl-title">${escapeHtml(p.title)}</p>
            <p class="bl-meta">
              <span class="bl-slug">/post.html?slug=${escapeHtml(p.slug)}</span>
              ${isPublished && p.published_at
      ? ` · <span class="bl-date">Published ${formatDate(p.published_at)}</span>`
      : ` · <span class="bl-date">Created ${formatDate(p.created_at)}</span>`
    }
            </p>
          </div>
          <div class="bl-actions">
            <button type="button" class="a-btn a-btn-ghost a-btn-sm" data-action="edit" data-id="${p.id}">Edit</button>
            ${isPublished
      ? `<button type="button" class="a-btn a-btn-ghost a-btn-sm" data-action="view" data-id="${p.id}">View</button>
                 <button type="button" class="a-btn a-btn-ghost a-btn-sm" data-action="unpublish" data-id="${p.id}">Unpublish</button>`
      : `<button type="button" class="a-btn a-btn-ghost a-btn-sm" data-action="publish" data-id="${p.id}">Publish</button>`
    }
            <button type="button" class="a-btn a-btn-danger a-btn-sm" data-action="delete" data-id="${p.id}">Delete</button>
          </div>
        </li>
      `).join('')}
    </ul>
  `;
}

/* --- Create / Edit slide-over ------------------------------------------- */

function openForm(post) {
  const isEdit = !!post;
  const p = post || {
    title: '',
    slug: '',
    body: '',
    cover_cloudinary_id: '',
    status: 'draft',
  };

  const body = `
    <form class="bl-form" id="bl-form" onsubmit="return false;">
      <div class="bl-field">
        <label class="bl-label" for="p-title">Title <span class="bl-required">*</span></label>
        <input class="a-input" id="p-title" type="text" value="${escapeAttr(p.title)}" placeholder="How to look after coloured hair" autocomplete="off">
      </div>

      <div class="bl-field">
        <label class="bl-label" for="p-slug">Slug <span class="bl-required">*</span></label>
        <input class="a-input" id="p-slug" type="text" value="${escapeAttr(p.slug)}" placeholder="how-to-look-after-coloured-hair" autocomplete="off">
        <p class="bl-hint">Auto-generated from the title. Only lowercase letters, numbers, and hyphens.</p>
      </div>

        <div class="bl-field">
        <label class="bl-label" for="p-cover">Cover image <span class="bl-optional">(optional)</span></label>
        <div class="bl-cover-row">
          <input class="a-input" id="p-cover" type="url" value="${escapeAttr(p.cover_cloudinary_id || '')}" placeholder="https://res.cloudinary.com/…">
          <button type="button" class="a-btn a-btn-ghost" id="p-cover-upload">Upload</button>
        </div>
        <div class="bl-cover-preview" id="p-cover-preview" ${p.cover_cloudinary_id ? '' : 'hidden'}>
          <img src="${escapeAttr(p.cover_cloudinary_id || '')}" alt="">
        </div>
      </div>

      <div class="bl-field">
        <label class="bl-label" for="p-body">Body <span class="bl-required">*</span></label>
        <textarea class="a-input bl-body" id="p-body" rows="12" placeholder="Write your post here. Two blank lines between paragraphs.">${escapeHtml(p.body || '')}</textarea>
        <p class="bl-hint">Blank lines become paragraph breaks.</p>
      </div>

      <div class="bl-field bl-field--row">
        <label class="bl-label">Status</label>
        <div class="bl-radio-group">
          <label class="bl-radio">
            <input type="radio" name="p-status" value="draft" ${p.status === 'draft' ? 'checked' : ''}>
            <span>Draft</span>
          </label>
          <label class="bl-radio">
            <input type="radio" name="p-status" value="published" ${p.status === 'published' ? 'checked' : ''}>
            <span>Published</span>
          </label>
        </div>
      </div>

      <p class="bl-error" id="p-error" role="alert"></p>
    </form>
  `;

  openSlideOver({
    title: isEdit ? 'Edit post' : 'New post',
    body,
    actions: [
      { label: 'Cancel', onClick: (c) => c() },
      {
        label: isEdit ? 'Save changes' : 'Create post',
        variant: 'primary',
        onClick: async (c) => {
          const ok = await submit(isEdit, post, c);
          if (ok) {
            c();
            await fetchPosts();
          }
        },
      },
    ],
  });

  /* Wire title → slug auto-generation (only on new posts, or when slug is empty) */
  const titleEl = document.getElementById('p-title');
  const slugEl = document.getElementById('p-slug');

  titleEl.addEventListener('input', () => {
    if (!isEdit || !slugEl.dataset.touched) {
      if (!isEdit) {
        slugEl.value = slugify(titleEl.value);
      }
    }
  });

  slugEl.addEventListener('input', () => {
    slugEl.dataset.touched = '1';
  });

  setTimeout(() => document.getElementById('p-title')?.focus(), 50);
   /* Cover upload + preview */
  const coverInput = document.getElementById('p-cover');
  const coverPreview = document.getElementById('p-cover-preview');
  const coverUpload = document.getElementById('p-cover-upload');

  coverUpload?.addEventListener('click', async () => {
    coverUpload.disabled = true;
    coverUpload.textContent = 'Uploading…';
    try {
      const result = await uploadImage({
        folder: `salons/${CONFIG.SITE_SLUG}/blog`,
        croppingAspect: '16:9',
      });
      coverInput.value = result.url;
      showCoverPreview(result.url);
    } catch (err) {
      if (err?.message) toast(err.message);
    } finally {
      coverUpload.disabled = false;
      coverUpload.textContent = 'Upload';
    }
  });

  coverInput?.addEventListener('input', () => {
    showCoverPreview(coverInput.value.trim());
  });

  function showCoverPreview(url) {
    if (!url) {
      coverPreview.hidden = true;
      coverPreview.innerHTML = '';
      return;
    }
    coverPreview.hidden = false;
    coverPreview.innerHTML = `<img src="${escapeAttr(url)}" alt="">`;
  }
}

async function submit(isEdit, post, close) {
  const titleEl = document.getElementById('p-title');
  const slugEl = document.getElementById('p-slug');
  const coverEl = document.getElementById('p-cover');
  const bodyEl = document.getElementById('p-body');
  const errEl = document.getElementById('p-error');

  errEl.textContent = '';

  const title = titleEl.value.trim();
  const slug = slugify(slugEl.value.trim());
  const body = bodyEl.value.trim();
  const cover = coverEl.value.trim() || null;
  const status = document.querySelector('input[name="p-status"]:checked')?.value || 'draft';

  if (!title) { errEl.textContent = 'Title is required.'; titleEl.focus(); return false; }
  if (!slug) { errEl.textContent = 'Slug is required.'; slugEl.focus(); return false; }
  if (!body) { errEl.textContent = 'Body is required.'; bodyEl.focus(); return false; }

  const payload = {
    title,
    slug,
    body,
    cover_cloudinary_id: cover,
    status,
  };

  if (status === 'published' && (!post || post.status !== 'published')) {
    payload.published_at = new Date().toISOString();
  }

  if (isEdit) {
    const { error } = await supabase.from('posts').update(payload).eq('id', post.id);
    if (error) {
      errEl.textContent = humanError(error);
      return false;
    }
    toast('Post saved');
    return true;
  }

  /* New post — retry with -2, -3, etc. if slug collides */
  const originalSlug = payload.slug;
  for (let i = 1; i <= 5; i++) {
    const { error } = await supabase.from('posts').insert(payload);
    if (!error) {
      toast('Post created');
      return true;
    }
    if (error.code === '23505') {
      /* Unique violation on slug — try next suffix */
      payload.slug = `${originalSlug}-${i + 1}`;
      continue;
    }
    errEl.textContent = humanError(error);
    return false;
  }
  errEl.textContent = 'Could not find a unique slug. Try a different title.';
  return false;
}

/* --- Status / delete ---------------------------------------------------- */

async function setStatus(post, status) {
  const payload = { status };
  if (status === 'published') {
    payload.published_at = post.published_at || new Date().toISOString();
  }
  const { error } = await supabase.from('posts').update(payload).eq('id', post.id);
  if (error) {
    toast('Could not update: ' + error.message);
    return;
  }
  toast(status === 'published' ? 'Post published' : 'Post unpublished');
  await fetchPosts();
}

async function removePost(post) {
  if (!confirm(`Delete "${post.title}"? This cannot be undone.`)) return;
  const { error } = await supabase.from('posts').delete().eq('id', post.id);
  if (error) {
    toast('Could not delete: ' + error.message);
    return;
  }
  toast('Post deleted');
  await fetchPosts();
}

/* --- Helpers ------------------------------------------------------------ */

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function formatDate(d) {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  return new Intl.DateTimeFormat('en-ZA', {
    timeZone: 'Africa/Johannesburg',
    day: 'numeric', month: 'short', year: 'numeric',
  }).format(date);
}

function humanError(err) {
  if (err.code === '23505') return 'A post with that slug already exists.';
  return err.message || 'Something went wrong.';
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