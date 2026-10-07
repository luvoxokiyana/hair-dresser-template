/* ==========================================================================
   admin.js — shared admin behaviour.
   Loaded by every admin page after supabase.js.
   ========================================================================== */

import { supabase, getSession, signOut } from '/assets/js/supabase.js';
import { CONFIG } from '/assets/js/config.js';

/* --- Auth guard ---------------------------------------------------------- */
/**
 * Redirect to login if no session. Returns the session or null.
 * Call at the top of every admin page except login.
 */
export async function guard() {
  const session = await getSession();
  if (!session) {
    window.location.replace('/admin/index.html');
    return null;
  }
  return session;
}

/* --- Sign out ------------------------------------------------------------ */
export async function handleSignOut() {
  await signOut();
  window.location.replace('/admin/index.html');
}

/* --- Mount sidebar ------------------------------------------------------- */
/**
 * Render the sidebar. Marks the current page active.
 * @param {string} active - which nav key is current, e.g. 'dashboard'
 */
export function mountSidebar(active = '') {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  const items = [
    { key: 'dashboard',    href: '/admin/dashboard.html',    label: 'Dashboard',    icon: 'grid' },
    { key: 'calendar',     href: '/admin/calendar.html',     label: 'Calendar',     icon: 'calendar' },
    { key: 'bookings',     href: '/admin/bookings.html',     label: 'Bookings',     icon: 'list' },
  ];

  const manage = [
  { key: 'services',     href: '/admin/services.html',     label: 'Services',     icon: 'scissors' },
  { key: 'availability', href: '/admin/availability.html', label: 'Availability', icon: 'clock' },
  { key: 'clients',      href: '/admin/clients.html',      label: 'Clients',      icon: 'users' },
  { key: 'blog',         href: '/admin/blog.html',         label: 'Blog',         icon: 'file' },
]; 

  const settings = [
    { key: 'settings',     href: '/admin/settings.html',     label: 'Settings',     icon: 'settings' },
  ];

  const icon = (name) => {
    const icons = {
      grid:      '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
      calendar:  '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
      list:      '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
      scissors:  '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/>',
      clock:     '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
      file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>',
      users:     '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
      settings:  '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    };
    return icons[name] || '';
  };

  const renderGroup = (label, list) => `
    <div class="a-nav-group">
      <p class="a-nav-label">${label}</p>
      <ul class="a-nav-list">
        ${list.map(it => `
          <li class="a-nav-item ${it.key === active ? 'is-active' : ''}">
            <a href="${it.href}">
              <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">${icon(it.icon)}</svg>
              <span>${it.label}</span>
            </a>
          </li>
        `).join('')}
      </ul>
    </div>
  `;

  sidebar.innerHTML = `
    <div class="a-sidebar-head">
      <p class="a-sidebar-brand">${CONFIG.SITE_NAME}</p>
      <p class="a-sidebar-sub">Admin</p>
    </div>

    <nav class="a-nav" aria-label="Admin">
      ${renderGroup('Daily', items)}
      ${renderGroup('Manage', manage)}
      ${renderGroup('Account', settings)}
    </nav>

    <div class="a-sidebar-foot">
      <div class="a-user">
        <div class="a-user-avatar" id="user-avatar">·</div>
        <div class="a-user-meta">
          <p class="a-user-email" id="user-email">—</p>
        </div>
        <button class="a-signout" id="signout" type="button">Sign out</button>
      </div>
    </div>
  `;

  document.getElementById('signout')?.addEventListener('click', handleSignOut);
}

/* --- Mount topbar -------------------------------------------------------- */
export function mountTopbar(title = '') {
  const topbar = document.getElementById('topbar');
  if (!topbar) return;

  topbar.innerHTML = `
    <button class="a-mobile-toggle" id="mobile-toggle" aria-label="Menu">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <line x1="3" y1="6" x2="21" y2="6"/>
        <line x1="3" y1="12" x2="21" y2="12"/>
        <line x1="3" y1="18" x2="21" y2="18"/>
      </svg>
    </button>
    <h1 class="a-topbar-title">${title}</h1>
    <div class="a-topbar-actions" id="topbar-actions"></div>
  `;

  document.getElementById('mobile-toggle')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.toggle('is-open');
  });

  /* Close sidebar on nav click (mobile) */
  sidebar?.addEventListener('click', (e) => {
    if (e.target.closest('.a-nav-item a') && window.innerWidth <= 820) {
      document.getElementById('sidebar')?.classList.remove('is-open');
    }
  });
}

/* --- Fill user info ------------------------------------------------------ */
export async function mountUser(session) {
  const emailEl = document.getElementById('user-email');
  const avatarEl = document.getElementById('user-avatar');
  if (!emailEl) return;

  const email = session?.user?.email || '—';
  emailEl.textContent = email;
  if (avatarEl) avatarEl.textContent = email.charAt(0).toUpperCase();
}

/* --- Format helpers (shared with public via re-export later) ------------- */
export function formatDate(d, opts = {}) {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  return new Intl.DateTimeFormat('en-ZA', {
    timeZone: 'Africa/Johannesburg',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...opts,
  }).format(date);
}

export function formatTime(d) {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  return new Intl.DateTimeFormat('en-ZA', {
    timeZone: 'Africa/Johannesburg',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}


/* --- Toast ----------------------------------------------------------- */


/* --- Toast --------------------------------------------------------------- */

/**
 * Show a small toast at the bottom of the screen.
 * @param {string} message
 * @param {{label?: string, onClick?: Function, duration?: number}} [action]
 */
export function toast(message, action) {
  let el = document.getElementById('a-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'a-toast';
    el.className = 'a-toast';
    document.body.appendChild(el);
  }
  el.innerHTML = '';

  const span = document.createElement('span');
  span.textContent = message;
  el.appendChild(span);

  if (action && action.label && typeof action.onClick === 'function') {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = action.label;
    btn.className = 'a-toast-action';
    btn.addEventListener('click', () => {
      action.onClick();
      hide();
    });
    el.appendChild(btn);
  }

  el.classList.add('is-visible');
  const timeout = setTimeout(hide, action?.duration ?? 5000);

  function hide() {
    clearTimeout(timeout);
    el.classList.remove('is-visible');
  }
}

/* --- Slide-over --------------------------------------------------------- */

/**
 * Open a slide-over panel with content.
 * Returns a close() function.
 */
export function openSlideOver({ title, body, actions }) {
  /* Remove any existing panel */
  document.getElementById('a-slideover')?.remove();
  document.getElementById('a-slideover-backdrop')?.remove();

  const backdrop = document.createElement('div');
  backdrop.id = 'a-slideover-backdrop';
  backdrop.className = 'a-slideover-backdrop';
  backdrop.addEventListener('click', close);

  const panel = document.createElement('aside');
  panel.id = 'a-slideover';
  panel.className = 'a-slideover';
  panel.innerHTML = `
    <header class="a-slideover-head">
      <h2 class="a-slideover-title">${title || ''}</h2>
      <button type="button" class="a-slideover-close" aria-label="Close">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </header>
    <div class="a-slideover-body"></div>
    ${actions ? '<footer class="a-slideover-foot" id="a-slideover-actions"></footer>' : ''}
  `;

  panel.querySelector('.a-slideover-body').innerHTML = body || '';
  panel.querySelector('.a-slideover-close').addEventListener('click', close);

  if (actions) {
    const foot = panel.querySelector('#a-slideover-actions');
    for (const a of actions) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `a-btn ${a.variant === 'primary' ? 'a-btn-primary' : 'a-btn-ghost'}`;
      btn.textContent = a.label;
      btn.addEventListener('click', () => a.onClick(close));
      foot.appendChild(btn);
    }
  }

  document.body.appendChild(backdrop);
  document.body.appendChild(panel);
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => {
    backdrop.classList.add('is-visible');
    panel.classList.add('is-visible');
  });

  /* Esc to close */
  const escHandler = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', escHandler);

  function close() {
    document.removeEventListener('keydown', escHandler);
    backdrop.classList.remove('is-visible');
    panel.classList.remove('is-visible');
    document.body.style.overflow = '';
    setTimeout(() => {
      backdrop.remove();
      panel.remove();
    }, 220);
  }

  return close;
}

/* --- Cloudinary image upload ------------------------------------------- */

let cloudinaryScriptPromise = null;

/**
 * Load the Cloudinary upload widget script lazily.
 * Returns a promise that resolves when `window.cloudinary` is available.
 */
function loadCloudinaryScript() {
  if (window.cloudinary) return Promise.resolve();
  if (cloudinaryScriptPromise) return cloudinaryScriptPromise;

  cloudinaryScriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://widget.cloudinary.com/v2.0/global/all.js';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load Cloudinary widget'));
    document.head.appendChild(s);
  });

  return cloudinaryScriptPromise;
}

/**
 * Open the Cloudinary upload widget and return the uploaded image.
 * Requires CONFIG.CLOUDINARY_CLOUD and CONFIG.CLOUDINARY_UPLOAD_PRESET.
 *
 * @param {object} [opts]
 * @param {string} [opts.folder]        — Cloudinary folder, e.g. `salons/tiffany-hair/gallery`
 * @param {string[]} [opts.sources]     — allowed sources, default: local, camera, url
 * @param {string} [opts.croppingAspect] — e.g. '1:1' or '16:9', optional
 * @returns {Promise<{ url: string, publicId: string, width: number, height: number, format: string }>}
 */
export async function uploadImage(opts = {}) {
  await loadCloudinaryScript();

  const { CLOUDINARY_CLOUD, CLOUDINARY_UPLOAD_PRESET, SITE_SLUG } = CONFIG;

  if (!CLOUDINARY_CLOUD || !CLOUDINARY_UPLOAD_PRESET) {
    throw new Error('Cloudinary is not configured. Set CLOUDINARY_CLOUD and CLOUDINARY_UPLOAD_PRESET in config.js.');
  }

  const folder = opts.folder || `salons/${SITE_SLUG || 'unassigned'}`;

  return new Promise((resolve, reject) => {
    const widget = window.cloudinary.createUploadWidget(
      {
        cloudName: CLOUDINARY_CLOUD,
        uploadPreset: CLOUDINARY_UPLOAD_PRESET,
        folder,
        sources: opts.sources || ['local', 'camera', 'url'],
        multiple: false,
        maxFileSize: 8000000,            // 8 MB
        clientAllowedFormats: ['png', 'jpg', 'jpeg', 'webp', 'heic'],
        cropping: !!opts.croppingAspect,
        croppingAspectRatio: opts.croppingAspect
          ? parseFloat(opts.croppingAspect.split(':')[0]) / parseFloat(opts.croppingAspect.split(':')[1])
          : undefined,
        showAdvancedOptions: false,
        styles: {
          palette: {
            window: '#FFFFFF',
            windowBorder: '#D0CCC3',
            tabIcon: '#5C4A3A',
            menuIcons: '#1F1D1A',
            textDark: '#1F1D1A',
            textLight: '#FFFFFF',
            link: '#5C4A3A',
            action: '#5C4A3A',
            inactiveTabIcon: '#9A958C',
            error: '#A85144',
            inProgress: '#5C4A3A',
            complete: '#5F7A5F',
            sourceBg: '#F7F6F3',
          },
          fonts: {
            default: null,
            "'Inter', sans-serif": {
              url: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap',
              active: true,
            },
          },
        },
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        if (result?.event === 'success') {
          widget.close({ quiet: true });
          const info = result.info;
          resolve({
            url: info.secure_url,
            publicId: info.public_id,
            width: info.width,
            height: info.height,
            format: info.format,
          });
        }
        /* 'close' event without success means the user cancelled — do nothing,
           the promise stays pending until they try again or navigate away. */
      }
    );

    widget.open();
  });
}