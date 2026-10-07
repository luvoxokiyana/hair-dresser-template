# Kaya — Client Setup

How to deploy Kaya for a new salon. From empty repo to live site in about an hour.

**Before you start, you'll need:**

- A GitHub account
- A Netlify account (free tier is fine)
- A Supabase account (free tier is fine)
- A Cloudinary account (free tier is fine)
- The salon's business details (name, phone, WhatsApp, email, address, hours, services, prices)

---

## Overview

Kaya is a single-tenant template. **Every salon gets its own Supabase project and its own Netlify site.** They don't share a database or a domain.

This is deliberately simple. It means:

- No cross-tenant data risks
- No shared failure modes
- Each client's data is theirs alone
- If one project is compromised, the others are unaffected

The cost: you repeat this process for every new client, and each Supabase project needs to stay active (see "Keeping Supabase awake" at the end).

---

## 1. Fork the repo

1. Go to the Kaya template repo on GitHub.
2. Click **Fork**, choose the new client's GitHub account (or your own).
3. Rename the fork to something client-specific, e.g. `kaya-tiffany-hair`.
4. Clone it locally.

```bash
git clone git@github.com:you/kaya-tiffany-hair.git
cd kaya-tiffany-hair
```

---

## 2. Create a Supabase project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard).
2. **New project**. Name it after the client, e.g. `tiffany-hair`.
3. Choose a strong database password — **save it somewhere**. You won't need it for the app, but keep it.
4. Region: **Europe West (Ireland)** or **EU Central (Frankfurt)**. Both are fast enough from South Africa. Pick the one with lower latency for you.
5. Wait for provisioning (~2 minutes).

---

## 3. Set up the database

In the Supabase dashboard, go to **SQL Editor** and run the files from the repo, **in this order**:

1. `supabase/schema.sql` — creates all tables, RLS policies, and the settings trigger.
2. `supabase/seed.sql` — inserts one settings row, five services, and Mon–Sat availability.

**Do NOT run `supabase/seed-demo.sql`.** That's for the demo only. It contains sample clients and bookings that should never land in a real project.

After running both, verify in **Table Editor** that you have:

- `settings` — 1 row
- `services` — 5 rows
- `availability` — 6 rows (Mon–Sat)
- `clients`, `bookings`, `blocks`, `gallery`, `posts` — 0 rows

---

## 4. Create the owner account

1. Go to **Authentication → Users**.
2. **Add user → Create new user**.
3. Email: the salon owner's email.
4. Password: set a temporary one, they can change it later from `/admin/settings.html` (Account tab).
5. Confirm email: **off** (so they can sign in immediately).
6. **Create user**.

That's the login for `/admin/`. There is only one user per salon — the owner.

---

## 5. Get the Supabase keys

1. Go to **Project Settings → API**.
2. Copy the **Project URL** — looks like `https://xxxxx.supabase.co`.
3. Copy the **anon public** key — the long JWT-looking string.

**Do not copy the `service_role` key.** That bypasses all security and must never touch the frontend.

---

## 6. Create a Cloudinary account

1. Go to [cloudinary.com](https://cloudinary.com) and sign up (free tier).
2. Once in, note your **Cloud Name** on the dashboard.
3. Go to **Settings → Upload → Upload presets**.
4. **Add upload preset**:
   - Name: `kaya_unsigned`
   - Signing mode: **Unsigned**
   - Folder: `salons/{client-slug}` (optional, keeps images organised)
5. Save.

The upload preset is what lets the admin upload images without a backend.

---

## 7. Configure the app

Open `assets/js/config.js`. It's the **only file that changes per client**.

```js
export const CONFIG = {
  SITE_SLUG: 'tiffany-hair',      // used for Cloudinary folders, cache keys
  SITE_NAME: 'Tiffany Hair',      // shown in admin sidebar and browser tab

  SUPABASE_URL:      'https://xxxxx.supabase.co',
  SUPABASE_ANON_KEY: 'eyJ...',

  CLOUDINARY_CLOUD:         'your-cloud-name',
  CLOUDINARY_UPLOAD_PRESET: 'kaya_unsigned',

  TZ:       'Africa/Johannesburg',
  CURRENCY: 'ZAR',
  LOCALE:   'en-ZA',
};
```

Save.

---

## 8. Test locally

```bash
python3 -m http.server 8000
```

Then open:

- `http://localhost:8000` — the public site
- `http://localhost:8000/booking.html` — the booking flow
- `http://localhost:8000/admin/` — log in with the owner account you created

Walk through:

- Add a service in `/admin/services.html`
- Add availability in `/admin/availability.html`
- Create a test booking via `/booking.html`
- Confirm it appears in `/admin/bookings.html` and `/admin/calendar.html`
- Delete the test booking when done

If any of that fails, see **Troubleshooting** at the bottom.

---

## 9. Deploy to Netlify

1. Push your local changes to the client's GitHub repo.
2. Go to [app.netlify.com](https://app.netlify.com).
3. **Add new site → Import an existing project**.
4. Connect to GitHub, select the client's repo.
5. **Build command:** *(leave empty)*
6. **Publish directory:** `.`
7. **Deploy site**.
8. Netlify assigns a random URL like `kaya-tiffany-hair.netlify.app`. Rename it in **Site settings → Change site name** to something cleaner.

**No build step is required.** The site is static.

---

## 10. Point the client's domain (if they have one)

If the salon already owns a domain:

1. Netlify → **Domain settings → Add custom domain**.
2. Enter the domain, e.g. `tiffanyhair.co.za`.
3. Netlify shows DNS records to add. Either:
   - **Delegate nameservers** to Netlify (simplest), or
   - **Add the records** at their existing registrar.
4. Wait for DNS to propagate (usually 10 minutes to an hour).
5. Netlify provisions HTTPS automatically via Let's Encrypt.

If they don't have a domain, the `*.netlify.app` URL works fine. Kaya's booking page and admin all live under it.

---

## 11. Hand over to the owner

Give them:

- The admin URL: `https://their-site.co.za/admin/`
- The email you used
- The temporary password (they should change it in Settings → Account)
- A one-page guide: how to add a service, how to see bookings, how to block time off

**Do not give them the Supabase or Netlify login.** Those are yours. If they need something changed at that level, they ask you.

---

## Keeping Supabase awake

Free-tier Supabase projects **pause after 7 days of inactivity**. If a client doesn't touch their dashboard for a week, the next visitor will see a 2-minute delay while the project wakes up. That's bad.

**Fix:** schedule a keepalive ping every 3 days.

### With pg_cron (if available on your project)

In the SQL editor:

```sql
create extension if not exists pg_cron;

select cron.schedule(
  'keepalive',
  '0 3 */3 * *',
  $$ select count(*) from settings; $$
);
```

Check availability first:

```sql
select * from pg_available_extensions where name = 'pg_cron';
```

If it returns a row, you're good. If not, use the external option below.

### With an external cron (if pg_cron isn't available)

Create a GitHub Actions workflow in the client's repo at `.github/workflows/keepalive.yml`:

```yaml
name: Supabase keepalive
on:
  schedule:
    - cron: '0 3 */3 * *'
  workflow_dispatch:

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping Supabase
        run: |
          curl -sSf "${{ secrets.SUPABASE_URL }}/rest/v1/settings?select=id&limit=1" \
            -H "apikey: ${{ secrets.SUPABASE_ANON_KEY }}"
```

Then add `SUPABASE_URL` and `SUPABASE_ANON_KEY` to the repo's **Settings → Secrets and variables → Actions**.

That's it. Free, and it doesn't need a paid Supabase plan.

---

## Troubleshooting

**"No services available" on `/booking.html`**

- Check `services` table has active rows.
- Check RLS is enabled and the "services read active" policy exists.

**"Could not load settings" in admin**

- Check the `settings` table has exactly one row with `id = 1`.
- Check the anon key in `config.js` is correct.

**Sign-in fails with "Invalid login credentials"**

- Check the user exists in **Authentication → Users**.
- Check the password was set correctly (you can reset it from the dashboard).

**Images 404 or don't load**

- Check the Cloudinary URL is absolute (starts with `https://`).
- Check the upload preset is **Unsigned** in Cloudinary settings.

**The public site loads but fonts look wrong**

- Check the Google Fonts `<link>` hasn't been edited.
- Check `tokens.css` hasn't been modified (its `--font-*` variables should match the `<link>` href).

**Booking flow shows "Services are temporarily unavailable"**

- Open the browser console. A CORS error means the Supabase URL is wrong.
- A 401 means the anon key is wrong.

---

## What NOT to change per client

These files are template-wide. Don't edit them for a client — if they need changing, change them in the template and pull the update:

- `assets/css/tokens.css` — design tokens
- `assets/css/base.css` — reset and typography
- `assets/css/components.css` — buttons, cards, forms
- `assets/js/booking/slots.js` — the slot engine
- `supabase/schema.sql` — the schema
- `admin/assets/admin.js` — the admin shell

If a client wants a different palette, that's a Phase 7 job — make a themed override, don't fork the tokens.