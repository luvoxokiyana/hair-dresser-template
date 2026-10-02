-- ============================================================================
-- Hairdresser Template — Schema v1
-- Single-tenant. Run once per client in the Supabase SQL editor.
-- ============================================================================

-- --- Extensions -------------------------------------------------------------
create extension if not exists "uuid-ossp";

-- --- Enums ------------------------------------------------------------------
create type booking_status as enum ('confirmed', 'completed', 'cancelled', 'no_show');
create type post_status    as enum ('draft', 'published');

-- --- settings (single row) --------------------------------------------------
create table settings (
  id                          int primary key default 1,
  business_name               text not null default 'Demo Salon',
  tagline                     text,
  phone                       text,
  whatsapp_number             text,
  email                       text,
  address                     text,
  map_url                     text,
  social                      jsonb not null default '{}'::jsonb,   -- {instagram, facebook, tiktok}
  hours                       jsonb not null default '{}'::jsonb,   -- display-only human text per weekday
  slot_interval_min           int  not null default 30,
  booking_min_notice_hours    int  not null default 2,
  booking_max_advance_days    int  not null default 60,
  buffer_min                  int  not null default 0,
  updated_at                  timestamptz not null default now(),
  constraint settings_singleton check (id = 1)
);

-- --- services ---------------------------------------------------------------
create table services (
  id                uuid primary key default uuid_generate_v4(),
  name              text not null,
  description       text,
  duration_min      int  not null check (duration_min > 0),
  price             numeric(10,2),                 -- null = "on request"
  active            boolean not null default true,
  sort_order        int not null default 0,
  requires_approval boolean not null default false, -- future hook; default off
  created_at        timestamptz not null default now()
);

-- --- availability (weekly recurring working hours) --------------------------
create table availability (
  id          uuid primary key default uuid_generate_v4(),
  weekday     int  not null check (weekday between 0 and 6),   -- 0 = Sunday
  start_time  time not null,
  end_time    time not null,
  active      boolean not null default true,
  check (end_time > start_time)
);

-- --- blocks (time off + manual "this slot is taken" blocks) -----------------
create table blocks (
  id         uuid primary key default uuid_generate_v4(),
  start_at   timestamptz not null,
  end_at     timestamptz not null,
  reason     text,
  all_day    boolean not null default false,
  created_at timestamptz not null default now(),
  check (end_at > start_at)
);

-- --- clients ----------------------------------------------------------------
create table clients (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null,
  email      text,
  phone      text,
  notes      text,
  created_at timestamptz not null default now()
);
create index clients_email_idx on clients (lower(email));
create index clients_phone_idx on clients (phone);

-- --- bookings ---------------------------------------------------------------
create table bookings (
  id           uuid primary key default uuid_generate_v4(),
  client_id    uuid references clients(id) on delete set null,
  service_id   uuid references services(id) on delete restrict,
  start_at     timestamptz not null,
  end_at       timestamptz not null,
  status       booking_status not null default 'confirmed',
  notes        text,
  created_at   timestamptz not null default now(),
  -- cancel_token uuid  -- future hook: magic-link cancellation. Uncomment when needed.
  check (end_at > start_at)
);
create index bookings_start_idx  on bookings (start_at);
create index bookings_status_idx on bookings (status);

-- --- gallery ----------------------------------------------------------------
create table gallery (
  id             uuid primary key default uuid_generate_v4(),
  cloudinary_id  text not null,
  url            text not null,
  caption        text,
  sort_order     int not null default 0,
  created_at     timestamptz not null default now()
);

-- --- posts ------------------------------------------------------------------
create table posts (
  id                  uuid primary key default uuid_generate_v4(),
  title               text not null,
  slug                text not null unique,
  body                text,
  cover_cloudinary_id text,
  status              post_status not null default 'draft',
  published_at        timestamptz,
  created_at          timestamptz not null default now()
);
create index posts_slug_idx   on posts (slug);
create index posts_status_idx on posts (status);

-- ============================================================================
-- Row Level Security
-- Public (anon) can: read services/gallery/settings/published posts,
--                    insert bookings + clients.
-- Owner (authenticated) can: everything.
-- ============================================================================

alter table settings     enable row level security;
alter table services     enable row level security;
alter table availability enable row level security;
alter table blocks       enable row level security;
alter table clients      enable row level security;
alter table bookings     enable row level security;
alter table gallery      enable row level security;
alter table posts        enable row level security;

-- --- settings ---------------------------------------------------------------
create policy "settings read public"   on settings for select using (true);
create policy "settings write owner"   on settings for all    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- --- services ---------------------------------------------------------------
create policy "services read active"   on services for select using (active = true or auth.role() = 'authenticated');
create policy "services write owner"   on services for all    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- --- availability -----------------------------------------------------------
create policy "availability read public" on availability for select using (true);
create policy "availability write owner" on availability for all    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- --- blocks -----------------------------------------------------------------
-- Public needs to *read* blocks so the slot engine can exclude them.
create policy "blocks read public" on blocks for select using (true);
create policy "blocks write owner" on blocks for all    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- --- clients ----------------------------------------------------------------
create policy "clients insert public" on clients for insert with check (true);
create policy "clients read owner"    on clients for select using (auth.role() = 'authenticated');
create policy "clients write owner"   on clients for all    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- --- bookings ---------------------------------------------------------------
create policy "bookings insert public" on bookings for insert with check (true);
-- Public may read only its own booking by id would require a token; not built in v1.
create policy "bookings read owner"    on bookings for select using (auth.role() = 'authenticated');
create policy "bookings write owner"   on bookings for all    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- --- gallery ----------------------------------------------------------------
create policy "gallery read public" on gallery for select using (true);
create policy "gallery write owner" on gallery for all    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- --- posts ------------------------------------------------------------------
create policy "posts read published" on posts for select using (status = 'published' or auth.role() = 'authenticated');
create policy "posts write owner"    on posts for all    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ============================================================================
-- Trigger: keep settings.updated_at fresh
-- ============================================================================
create or replace function touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger settings_touch
before update on settings
for each row execute function touch_updated_at();