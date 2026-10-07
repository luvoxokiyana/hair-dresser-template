# Kaya — Architecture

A two-minute read for anyone who needs to work on this codebase.

---

## The shape

**Single-tenant template.** Every client gets their own Supabase project and their own Netlify deploy. No shared database, no shared domain.

**No build step.** HTML, CSS, and JavaScript deploy as-is. The only toolchain file is `package.json` with `"type": "module"`, and it exists only so `node` can run the slot engine tests. It has no effect on the browser or the deploy.

**Two repos per client** (only one if they don't need a landing page):
- The app itself — this repo
- The Kaya landing page — separate, only belongs to you

## The moving parts

**Public site** (`*.html` at root) — Home, Services, Gallery, About, Contact, Booking, Confirmation, Privacy, Blog, Post. All static HTML + a matching module in `assets/js/public/`.

**Admin panel** (`/admin/`) — Dashboard, Calendar, Bookings, Services, Availability, Clients, Blog, Settings. All gated by Supabase Auth, all using the shared shell in `admin/assets/admin.js`.

**Slot engine** (`assets/js/booking/slots.js`) — pure JS, no dependencies. Given availability, existing bookings, blocks, service duration, and rules, it returns available time slots. This is the piece that matters most; everything else is CRUD around it.

**Database** (`supabase/schema.sql`) — Postgres via Supabase. RLS on every table. Public can read services/gallery/settings/published posts; can insert bookings/clients. Owner (authenticated) can do everything else.

## The rules that matter

1. **Timezone**: store UTC, render SAST. Use the helpers in `slots.js` for every conversion.
2. **No build step**: if a feature can't be built without one, don't build it.
3. **Module pattern**: all `const` declarations at the top of a module, before any top-level `await`.
4. **Auth guard**: every admin page calls `guard()` at the top of its module.
5. **RLS**: every table has policies. Public reads are limited to what the public site needs.

## What's not built

Staff management, testimonials, recurring blocks, multi-staff calendars, email notifications, customer accounts, drag-to-reschedule. All possible; none needed for v1.