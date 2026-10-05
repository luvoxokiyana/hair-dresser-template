import { supabase } from '../supabase.js';
import { bootPublicPage, formatPrice, formatDuration, esc } from './shared.js';

const settings = await bootPublicPage();

/* Footer: visit */
if (settings) {
  const visit = document.getElementById('footer-visit');
  const rows = [];
  if (settings.address) visit.innerHTML = `<li>${esc(settings.address)}</li>`;
  if (settings.phone)   visit.insertAdjacentHTML('beforeend', `<li><a href="tel:${esc(settings.phone)}">${esc(settings.phone)}</a></li>`);
  if (settings.email)   visit.insertAdjacentHTML('beforeend', `<li><a href="mailto:${esc(settings.email)}">${esc(settings.email)}</a></li>`);

  /* Footer: hours */
  const hours = document.getElementById('footer-hours');
  const h = settings.hours || {};
  const order = ['mon','tue','wed','thu','fri','sat','sun'];
  const hourRows = order.filter(k => h[k]).map(k =>
    `<li>${k.toUpperCase()} — ${esc(h[k])}</li>`
  );
  if (hourRows.length) hours.innerHTML = hourRows.join('');

  /* Footer: social */
  const social = document.getElementById('footer-social');
  const s = settings.social || {};
  const socialRows = [];
  if (s.instagram) socialRows.push(`<li><a href="${esc(s.instagram)}" target="_blank" rel="noopener">Instagram</a></li>`);
  if (s.facebook)  socialRows.push(`<li><a href="${esc(s.facebook)}"  target="_blank" rel="noopener">Facebook</a></li>`);
  if (s.tiktok)    socialRows.push(`<li><a href="${esc(s.tiktok)}"    target="_blank" rel="noopener">TikTok</a></li>`);
  if (socialRows.length) social.innerHTML = socialRows.join('');
}

/* Services — numbered cards, first 4 */
try {
  const { data, error } = await supabase
    .from('services')
    .select('name, description, duration_min, price')
    .eq('active', true)
    .order('sort_order')
    .limit(4);

  if (error) throw error;

  const grid = document.getElementById('services-preview');
  if (!data?.length) {
    grid.innerHTML = '<div class="empty-state">No services yet.</div>';
  } else {
    /* Use a stable placeholder image set for now */
    const placeholders = [
      'https://images.unsplash.com/photo-1522336572468-97b06e8ef143?w=800&q=80',
      'https://images.unsplash.com/photo-1560869713-7d0a29430803?w=800&q=80',
      'https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?w=800&q=80',
      'https://images.unsplash.com/photo-1605497788044-5a32c7078486?w=800&q=80'
    ];
    grid.innerHTML = data.map((s, i) => `
      <a class="num-card" href="/booking.html">
        <span class="num">${String(i + 1).padStart(2, '0')}</span>
        <div class="num-photo">
          <img src="${placeholders[i % placeholders.length]}" alt="${esc(s.name)}" loading="lazy">
        </div>
        <h3>${esc(s.name)}</h3>
        <p>${esc(formatDuration(s.duration_min))} · ${esc(formatPrice(s.price))}</p>
      </a>
    `).join('');
  }
} catch (err) {
  console.warn('Services preview failed:', err.message);
  document.getElementById('services-preview').innerHTML =
    '<div class="empty-state">Services unavailable.</div>';
}

/* Gallery — collage */
try {
  const { data, error } = await supabase
    .from('gallery')
    .select('url, caption')
    .order('sort_order')
    .limit(6);

  if (error) throw error;

  const grid = document.getElementById('gallery-preview');
  if (!data?.length) {
    grid.innerHTML = '<div class="empty-state">No photos yet.</div>';
  } else {
    grid.innerHTML = data.map(g => `
      <figure>
        <img src="${esc(g.url)}" alt="${esc(g.caption || '')}" loading="lazy">
      </figure>
    `).join('');
  }
} catch (err) {
  console.warn('Gallery preview failed:', err.message);
  document.getElementById('gallery-preview').innerHTML =
    '<div class="empty-state">Gallery unavailable.</div>';
}