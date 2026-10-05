# Hairdresser Template

A reusable, single-tenant website template for hairdressers and salons.
Public marketing site, self-service booking, and an admin panel for managing
bookings, services, availability, and clients.

Built with vanilla HTML, CSS, and JavaScript. Supabase backend. Cloudinary for
media. No frameworks, no build step — every file deploys as-is.

## Status

- ✅ **Phase 0 — Foundations** (tokens, config, Supabase client, schema, auth shell)
- ⬜ Phase 1 — Public site
- ⬜ Phase 2 — Admin content management
- ⬜ Phase 3 — Booking system
- ⬜ Phase 4 — Clients (CRM-lite)
- ⬜ Phase 5 — Blog
- ⬜ Phase 6 — Polish & template-isation

## Setup

1. Create a Supabase project.
2. Run `supabase/schema.sql`, then `supabase/seed.sql` in the SQL editor.
3. Create an owner user in **Authentication → Users**.
4. Paste your project URL and anon key into `assets/js/config.js`.
5. Serve the folder with any static server (`python3 -m http.server` works).

## Deploying for a new client

1. Fork / clone this repo.
2. Create a new Supabase project. Run the SQL files.
3. Edit `assets/js/config.js` with the new keys.
4. Deploy to Netlify / Vercel / cPanel.

`config.js` is the only file that changes per client.

## License

TBD