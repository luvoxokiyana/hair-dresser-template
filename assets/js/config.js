/* ==========================================================================
   CONFIG — the ONLY file that changes per client deployment.
   Copy this repo, edit these values, deploy. Nothing else changes.
   ========================================================================== */

export const CONFIG = {
  // Identity
  SITE_SLUG: 'demo-salon',
  SITE_NAME: 'Demo Salon',

  // Supabase (each client gets their own project)
  SUPABASE_URL:      'https://YOUR-PROJECT.supabase.co',
  SUPABASE_ANON_KEY: 'YOUR-ANON-KEY',

  // Cloudinary
  CLOUDINARY_CLOUD:         'your-cloud-name',
  CLOUDINARY_UPLOAD_PRESET: 'unsigned-preset',

  // Locale
  TZ:       'Africa/Johannesburg',   // SAST, UTC+2, no DST
  CURRENCY: 'ZAR',
  LOCALE:   'en-ZA',
};