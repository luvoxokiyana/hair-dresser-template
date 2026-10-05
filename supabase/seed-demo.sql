-- ============================================================================
-- seed-demo.sql — Demo bookings + clients for screenshots and testing.
-- NOT for production. Run manually when you want a populated dashboard.
-- ============================================================================

-- Safe re-run: clear demo bookings and clients first.
-- Comment this out if you want to preserve real data.
delete from bookings;
delete from clients;

-- ----------------------------------------------------------------------------
-- Clients — realistic South African names
-- ----------------------------------------------------------------------------
insert into clients (name, email, phone, notes) values
  ('Thandi Mokoena',    'thandi.mokoena@gmail.com',    '+27 82 445 1102', 'Prefers Saturday mornings. Sensitive scalp.'),
  ('Rachel Peters',     'rachel.peters@outlook.com',   '+27 83 220 8871', 'Colour every 8 weeks.'),
  ('Sipho Ndlovu',      'sipho.ndlovu@gmail.com',      '+27 71 908 4420', null),
  ('Aisha Patel',       'aisha.patel@gmail.com',       '+27 84 552 7791', 'Wedding in November — growing hair out.'),
  ('Lerato Dlamini',    'lerato.d@webmail.co.za',      '+27 76 118 2245', 'Loves a blunt bob.'),
  ('Zanele Khumalo',    'zanele.k@gmail.com',          '+27 82 661 3308', null),
  ('Chloe van der Merwe','chloe.vdm@gmail.com',        '+27 83 447 9912', 'Allergic to ammonia-based colour.'),
  ('Nadia Botha',       'nadia.botha@yahoo.com',       '+27 72 334 6654', 'Books every 6 weeks like clockwork.'),
  ('Precious Mabaso',   'precious.m@gmail.com',        '+27 78 992 1103', null),
  ('Jordan Naidoo',     'jordan.naidoo@gmail.com',     '+27 84 220 7789', 'Student — books during holidays.');

-- ----------------------------------------------------------------------------
-- Bookings — spread across last week, this week, and next week.
-- Times are anchored to NOW() so they always land in the right range,
-- regardless of when you run this file.
-- ----------------------------------------------------------------------------

-- A view to make the inserts readable.
with
  s as (select id, name, duration_min, price from services),
  c as (select id, name from clients),
  anchors as (
    select
      date_trunc('day', now() at time zone 'Africa/Johannesburg') at time zone 'Africa/Johannesburg'
        as today_start,
      -- Start of this week (Monday) in SAST
      (date_trunc('day', now() at time zone 'Africa/Johannesburg')
        - ((extract(isodow from now() at time zone 'Africa/Johannesburg')::int - 1) || ' days')::interval
      ) at time zone 'Africa/Johannesburg' as week_start
  )

insert into bookings (client_id, service_id, start_at, end_at, status, notes)
select
  (select id from c where name = v.client),
  (select id from s where name = v.service),
  a.week_start + v.offset_interval,
  a.week_start + v.offset_interval + ((select duration_min from s where name = v.service) || ' minutes')::interval,
  v.status::booking_status,
  v.notes
from anchors a,
(values
  -- ── LAST WEEK ────────────────────────────────────────────────────────────
  -- Monday 09:00 — completed, £450
  ('Thandi Mokoena',  'Cut & Finish', interval '0 days 9 hours',   'completed', 'Trim only — happy with length.'),
  -- Monday 11:00 — completed, £950
  ('Rachel Peters',   'Colour',       interval '0 days 11 hours',  'completed', 'Root touch-up, matched existing tone.'),
  -- Tuesday 14:00 — completed, £300
  ('Sipho Ndlovu',    'Treatment',    interval '1 days 14 hours',  'completed', 'Scalp massage requested.'),
  -- Wednesday 10:00 — no-show
  ('Zanele Khumalo',  'Blow-dry',     interval '2 days 10 hours',  'no_show',   null),
  -- Thursday 15:30 — completed, £1250
  ('Aisha Patel',     'Highlights',   interval '3 days 15 hours 30 minutes', 'completed', 'Full head of foils for wedding prep.'),
  -- Friday 16:00 — cancelled
  ('Chloe van der Merwe','Cut & Finish', interval '4 days 16 hours', 'cancelled', 'Rescheduling to next month.'),

  -- ── THIS WEEK ────────────────────────────────────────────────────────────
  -- Monday 09:30 — completed
  ('Nadia Botha',     'Cut & Finish', interval '7 days 9 hours 30 minutes',  'completed', 'Regular six-week trim.'),
  -- Monday 11:00 — completed
  ('Precious Mabaso', 'Blow-dry',     interval '7 days 11 hours',            'completed', null),
  -- Tuesday 13:00 — completed
  ('Jordan Naidoo',   'Cut & Finish', interval '8 days 13 hours',            'completed', 'Student discount applied.'),
  -- Tuesday 15:30 — no-show
  ('Sipho Ndlovu',    'Blow-dry',     interval '8 days 15 hours 30 minutes', 'no_show',   null),
  -- Wednesday 10:00 — confirmed (today or upcoming)
  ('Thandi Mokoena',  'Colour',       interval '9 days 10 hours',            'confirmed', 'Refresh, slightly warmer tone.'),
  -- Wednesday 14:00 — confirmed
  ('Rachel Peters',   'Cut & Finish', interval '9 days 14 hours',            'confirmed', null),
  -- Thursday 09:00 — confirmed
  ('Aisha Patel',     'Treatment',    interval '10 days 9 hours',            'confirmed', 'Deep condition before wedding.'),
  -- Thursday 16:00 — confirmed
  ('Lerato Dlamini',  'Cut & Finish', interval '10 days 16 hours',           'confirmed', 'Blunt bob, chin length.'),
  -- Friday 10:30 — confirmed
  ('Zanele Khumalo',  'Highlights',   interval '11 days 10 hours 30 minutes','confirmed', 'Half-head, honey tones.'),
  -- Friday 13:00 — confirmed
  ('Chloe van der Merwe','Colour',    interval '11 days 13 hours',           'confirmed', 'Ammonia-free only.'),
  -- Saturday 09:00 — confirmed
  ('Precious Mabaso', 'Cut & Finish', interval '12 days 9 hours',            'confirmed', null),
  -- Saturday 11:30 — confirmed
  ('Nadia Botha',     'Blow-dry',     interval '12 days 11 hours 30 minutes','confirmed', 'Event in the evening.'),

  -- ── NEXT WEEK (a couple, for the calendar view) ──────────────────────────
  ('Jordan Naidoo',   'Cut & Finish', interval '14 days 9 hours',            'confirmed', null),
  ('Lerato Dlamini',  'Colour',       interval '15 days 11 hours',           'confirmed', 'Going darker for winter.')
) as v(client, service, offset_interval, status, notes);

-- ----------------------------------------------------------------------------
-- Sanity check — should print counts by status for this week.
-- ----------------------------------------------------------------------------
select
  status,
  count(*) as count
from bookings
where start_at >= (
  date_trunc('day', now() at time zone 'Africa/Johannesburg')
  - ((extract(isodow from now() at time zone 'Africa/Johannesburg')::int - 1) || ' days')::interval
) at time zone 'Africa/Johannesburg'
group by status
order by status;