import { bootPublicPage, esc } from './shared.js';

const settings = await bootPublicPage();

if (settings) {
  const meta = document.getElementById('contact-meta');
  const hours = document.getElementById('contact-hours');
  const actions = document.getElementById('contact-actions');

  /* --- Contact meta rows --- */
  const rows = [];
  if (settings.phone)    rows.push(['Phone',    `<a href="tel:${esc(settings.phone)}">${esc(settings.phone)}</a>`]);
  if (settings.email)    rows.push(['Email',    `<a href="mailto:${esc(settings.email)}">${esc(settings.email)}</a>`]);
  if (settings.address)  rows.push(['Address',  esc(settings.address)]);
  if (settings.whatsapp_number) rows.push(['WhatsApp', esc(settings.whatsapp_number)]);

  meta.innerHTML = rows.length
    ? rows.map(([k, v]) => `<li><span class="meta-key">${esc(k)}</span><span>${v}</span></li>`).join('')
    : '<li><span>No contact details yet.</span></li>';

  /* --- Action buttons --- */
  const btns = [];
  if (settings.whatsapp_number) {
    const num = settings.whatsapp_number.replace(/\D/g, '');
    btns.push(`<a class="btn btn-primary" href="https://wa.me/${esc(num)}" target="_blank" rel="noopener">Chat on WhatsApp</a>`);
  }
  if (settings.phone) {
    btns.push(`<a class="btn btn-ghost" href="tel:${esc(settings.phone)}">Call us</a>`);
  }
  actions.innerHTML = btns.join('');

  /* --- Hours from settings.hours JSON --- */
  const labels = { mon:'Monday', tue:'Tuesday', wed:'Wednesday', thu:'Thursday', fri:'Friday', sat:'Saturday', sun:'Sunday' };
  const h = settings.hours || {};
  const keys = ['mon','tue','wed','thu','fri','sat','sun'];
  const hourRows = keys
    .filter(k => h[k])
    .map(k => `<li><span class="meta-key">${labels[k]}</span><span>${esc(h[k])}</span></li>`);

  hours.innerHTML = hourRows.length
    ? hourRows.join('')
    : '<li><span>Hours not set.</span></li>';

  /* --- Map: swap placeholder for iframe if map_url exists --- */
  if (settings.map_url) {
    document.getElementById('contact-map').outerHTML =
      `<div style="margin-top: var(--sp-6); aspect-ratio: 16/10; border-radius: var(--r-lg); overflow: hidden;">
         <iframe src="${esc(settings.map_url)}" style="width:100%; height:100%; border:0;" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
       </div>`;
  }
}