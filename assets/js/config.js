/* ==========================================================================
   CONFIG — the ONLY file that changes per client deployment.
   Copy this repo, edit these values, deploy. Nothing else changes.
   ========================================================================== */

export const CONFIG = {
  // Identity
  SITE_SLUG: 'demo-salon',
  SITE_NAME: 'Demo Salon',

  // Supabase (each client gets their own project)
  SUPABASE_URL:      'https://ifwpchqbavzkhvhslbbh.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlmd3BjaHFiYXZ6a2h2aHNsYmJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5MzI2MDYsImV4cCI6MjEwNjUwODYwNn0.wk-W4H1u24-lhEPq1wtRKVS-XnzKK3ONVA-9jqeBYpM',

  // Cloudinary
  CLOUDINARY_CLOUD:         'your-cloud-name',
  CLOUDINARY_UPLOAD_PRESET: 'unsigned-preset',

  // Locale
  TZ:       'Africa/Johannesburg',   // SAST, UTC+2, no DST
  CURRENCY: 'ZAR',
  LOCALE:   'en-ZA',
};