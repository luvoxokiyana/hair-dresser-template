/* ==========================================================================
   post.js — public individual post page.
   Reads ?slug=..., fetches the post, renders it.
   ========================================================================== */

import { supabase } from '../supabase.js';
import { bootPublicPage, esc } from './shared.js';

const settings = await bootPublicPage();
populateFooter(settings);

const slug = new URLSearchParams(location.search).get('slug');
if (!slug) {
  window.location.replace('/blog.html');
} else {
  await renderPost(slug);
}

async function renderPost(slug) {
  const { data, error } = await supabase
    .from('posts')
    .select('title, slug, body, cover_cloudinary_id, published_at')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();

  if (error || !data) {
    document.getElementById('post-title').textContent = 'Post not found';
    document.getElementById('post-body').innerHTML =
      '<p class="muted">That post doesn\'t exist, or has been unpublished.</p>';
    document.getElementById('post-date').textContent = '';
    return;
  }

  /* Update document title */
  document.title = data.title;

  /* Fill the page */
  document.getElementById('post-date').textContent = formatDate(data.published_at);
  document.getElementById('post-title').textContent = data.title;

  /* Cover */
  if (data.cover_cloudinary_id) {
    const coverEl = document.getElementById('post-cover');
    coverEl.hidden = false;
    coverEl.innerHTML = `<img src="${esc(data.cover_cloudinary_id)}" alt="${esc(data.title)}">`;
  }

  /* Body — split on blank lines into paragraphs */
  const paragraphs = (data.body || '')
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean);

  document.getElementById('post-body').innerHTML = paragraphs
    .map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/* --- Helpers ------------------------------------------------------------ */

function formatDate(d) {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  return new Intl.DateTimeFormat('en-ZA', {
    timeZone: 'Africa/Johannesburg',
    day: 'numeric', month: 'long', year: 'numeric',
  }).format(date);
}

function populateFooter(settings) {
  if (!settings) return;
  const visit = document.getElementById('footer-visit');
  if (visit) {
    const rows = [];
    if (settings.address) rows.push(`<li>${esc(settings.address)}</li>`);
    if (settings.phone)   rows.push(`<li><a href="tel:${esc(settings.phone)}">${esc(settings.phone)}</a></li>`);
    if (settings.email)   rows.push(`<li><a href="mailto:${esc(settings.email)}">${esc(settings.email)}</a></li>`);
    if (rows.length) visit.innerHTML = rows.join('');
  }
  const hours = document.getElementById('footer-hours');
  const h = settings.hours || {};
  const order = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  if (hours) {
    const rows = order.filter(k => h[k]).map(k => `<li>${k.toUpperCase()} — ${esc(h[k])}</li>`);
    if (rows.length) hours.innerHTML = rows.join('');
  }
  const social = document.getElementById('footer-social');
  if (social) {
    const sc = settings.social || {};
    const rows = [];
    if (sc.instagram) rows.push(`<li><a href="${esc(sc.instagram)}" target="_blank" rel="noopener">Instagram</a></li>`);
    if (sc.facebook)  rows.push(`<li><a href="${esc(sc.facebook)}" target="_blank" rel="noopener">Facebook</a></li>`);
    if (sc.tiktok)    rows.push(`<li><a href="${esc(sc.tiktok)}" target="_blank" rel="noopener">TikTok</a></li>`);
    if (rows.length) social.innerHTML = rows.join('');
  }
}