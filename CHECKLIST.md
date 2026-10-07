

# Kaya — New Client Checklist

Copy this file for each client and tick things off as you go.

---

## Database

- [ ] Supabase project created
- [ ] `supabase/schema.sql` run
- [ ] `supabase/seed.sql` run
- [ ] Verified: `settings` has 1 row, `services` has 5 rows, `availability` has 6 rows
- [ ] Owner user created in Authentication → Users
- [ ] pg_cron keepalive scheduled (or GitHub Actions workflow added)

## Config

- [ ] `assets/js/config.js` has correct `SUPABASE_URL`
- [ ] `assets/js/config.js` has correct `SUPABASE_ANON_KEY`
- [ ] `assets/js/config.js` has correct `SITE_SLUG` and `SITE_NAME`
- [ ] Cloudinary account created
- [ ] Cloudinary unsigned upload preset created (`kaya_unsigned`)
- [ ] `CLOUDINARY_CLOUD` and `CLOUDINARY_UPLOAD_PRESET` filled in

## Content (via admin, after deploy)

- [ ] Business name, tagline set (Settings → Business)
- [ ] Phone, WhatsApp, email, address set
- [ ] Map embed URL set
- [ ] Social links set (Instagram, Facebook, TikTok)
- [ ] Display hours filled in (Mon–Sun)
- [ ] Client privacy text written (or left blank to use the default)
- [ ] Booking rules confirmed (slot interval, buffer, min notice, max advance)
- [ ] Calendar preferences set (days shown, grid hours)
- [ ] Services added (name, description, duration, price)
- [ ] Availability set (weekly hours, multiple windows if needed)
- [ ] At least 6 gallery photos uploaded
- [ ] Cover image uploaded for each blog post (if any)

## Testing (before handing over)

- [ ] Public site loads on mobile and desktop
- [ ] All five public pages render correctly (Home, Services, Gallery, About, Contact)
- [ ] Booking flow completes end to end
- [ ] Confirmation page shows correct details
- [ ] WhatsApp button opens with the correct number
- [ ] ICS download works on phone
- [ ] Admin login works
- [ ] Dashboard shows today's bookings
- [ ] Calendar renders week and day views
- [ ] Bookings list filters and searches work
- [ ] New booking can be created manually
- [ ] Services can be edited, deactivated, reordered
- [ ] Availability can be changed, blocks can be added
- [ ] Clients list shows dedupe working (booking twice with same phone → one client)
- [ ] Blog post can be created, published, unpublished

## Deployment

- [ ] Pushed to client's GitHub repo
- [ ] Netlify site created, no build command, publish dir `.`
- [ ] Site renamed (if using `.netlify.app`)
- [ ] Custom domain added (if the client has one)
- [ ] HTTPS working
- [ ] Live smoke test: public site, booking flow, admin login

## Handover

- [ ] Admin URL sent to owner
- [ ] Owner email + temporary password sent
- [ ] Owner told to change password in Settings → Account
- [ ] One-page quick-start written for the owner
- [ ] Owner told NOT to share their login
- [ ] You've confirmed: don't give them Supabase or Netlify access