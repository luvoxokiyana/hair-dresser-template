import { supabase } from '../supabase.js';
import { bootPublicPage, esc } from './shared.js';

await bootPublicPage();

try {
  const { data, error } = await supabase
    .from('gallery')
    .select('url, caption')
    .order('sort_order');

  if (error) throw error;

  const grid = document.getElementById('gallery-full');
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
  console.warn('Gallery failed:', err.message);
  document.getElementById('gallery-full').innerHTML =
    '<div class="empty-state">Gallery unavailable.</div>';
}