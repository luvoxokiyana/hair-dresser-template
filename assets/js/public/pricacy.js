/* ==========================================================================
   privacy.js — reads settings.client_privacy_text, renders it.
   Falls back to a plain-language default if empty.
   ========================================================================== */

import { bootPublicPage, esc } from './shared.js';

const settings = await bootPublicPage();
const container = document.getElementById('privacy-content');
if (!container) throw new Error('No #privacy-content element.');

const customText = (settings?.client_privacy_text || '').trim();

if (customText) {
  /* Split on blank lines into paragraphs for readability */
  const paras = customText.split(/\n\s*\n/).map(p => `<p>${esc(p.trim()).replace(/\n/g, '<br>')}</p>`);
  container.innerHTML = paras.join('');
} else {
  /* Generic fallback */
  container.innerHTML = `
    <p>When you book with us, we collect only the information we need to confirm and run your appointment: your name, your phone number, and optionally your email address.</p>
    <p>We use this information for one purpose — to manage your booking. We don't sell it, share it with third parties for marketing, or use it to contact you about anything other than your appointment.</p>
    <p>If you'd like us to delete your details, or if you'd like to see what we hold on you, just ask. You can reach us using the details on our <a href="/contact.html">contact page</a>.</p>
    <p>Your information is stored securely and only for as long as needed to run our service.</p>
  `;
}