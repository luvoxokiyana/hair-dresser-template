import { supabase } from '../supabase.js';
import { bootPublicPage, formatPrice, formatDuration, esc } from './shared.js';

await bootPublicPage();

const placeholders = [
  'https://images.unsplash.com/photo-1522336572468-97b06e8ef143?w=800&q=80',
  'https://images.unsplash.com/photo-1560869713-7d0a29430803?w=800&q=80',
  'https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?w=800&q=80',
  'https://images.unsplash.com/photo-1605497788044-5a32c7078486?w=800&q=80',
  'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80',
  'https://images.unsplash.com/photo-1633681926022-84c23e8cb2d6?w=800&q=80'
];

try {
  const { data, error } = await supabase
    .from('services')
    .select('name, description, duration_min, price')
    .eq('active', true)
    .order('sort_order');

  if (error) throw error;

  const grid = document.getElementById('services-full');
  if (!data?.length) {
    grid.innerHTML = '<div class="empty-state">No services listed yet.</div>';
  } else {
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
  console.warn('Services failed:', err.message);
  document.getElementById('services-full').innerHTML =
    '<div class="empty-state">Services unavailable.</div>';
}