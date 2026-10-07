/* ==========================================================================
   blog.js — public blog list page.
   ========================================================================== */

import { supabase } from '../supabase.js';
import { bootPublicPage, esc } from './shared.js';

const settings = await bootPublicPage();

/* Populate footer (same pattern as booking-confirmed) */
populateFooter(settings);

const container = document.getElementById('post-list');
if (!container) throw new Error('No #post-list element.');

const { data, error } = await supabase
  .from('posts')
  .select('title, slug, body, cover_cloudinary_id, published_at')
  .eq('status', 'published')
  .order('published_at', { ascending: false });

if (error) {
  console.error('Posts fetch failed:', error);
  container.innerHTML = '<p class="muted">Could not load posts.</p>';
} else if (!data?.length) {
  container.innerHTML = `
    <div class="blog-empty">
      <p>No posts yet. Check back soon.</p>
    </div>
  `;
} else {
  container.innerHTML = data.map(p => {
    const excerpt = excerptFrom(p.body, 160);
    const date = formatDate(p.published_at);
    const cover = p.cover_cloudinary_id;

    return `
      <a class="post-card" href="/post.html?slug=${encodeURIComponent(p.slug)}">
        ${cover ? `
          <div class="post-card-cover">
            <img src="${esc(cover)}" alt="${esc(p.title)}" loading="lazy">
          </div>
        ` : ''}
        <div class="post-card-body">
          <p class="post-card-date">${esc(date)}</p>
          <h2 class="post-card-title">${esc(p.title)}</h2>
          <p class="post-card-excerpt">${esc(excerpt)}</p>
          <span class="post-card-more">Read →</span>
        </div>
      </a>
    `;
  }).join('');
}

/* --- Helpers ------------------------------------------------------------ */

function excerptFrom(body, max = 160) {
  if (!body) return '';
  const plain = body.replace(/\s+/g, ' ').trim();
  if (plain.length <= max) return plain;
  return plain.slice(0, max).replace(/\s+\S*$/, '') + '…';
}

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