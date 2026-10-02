-- ============================================================================
-- Seed data — enough to build Phase 1 against.
-- ============================================================================

-- Settings ---------------------------------------------------------------
insert into settings (
  id, business_name, tagline, phone, whatsapp_number, email, address,
  social, hours
) values (
  1,
  'Demo Salon',
  'Hair, done properly.',
  '+27 11 000 0000',
  '+27 82 000 0000',
  'hello@demosalon.co.za',
  '123 Main Road, Johannesburg',
  '{"instagram":"https://instagram.com/demosalon","facebook":""}'::jsonb,
  '{"mon":"09:00–17:00","tue":"09:00–17:00","wed":"09:00–17:00","thu":"09:00–19:00","fri":"09:00–19:00","sat":"09:00–14:00","sun":"Closed"}'::jsonb
);

-- Services ---------------------------------------------------------------
insert into services (name, description, duration_min, price, sort_order) values
  ('Cut & Finish',  'Consultation, wash, cut, and finish.',           45,  450.00, 1),
  ('Colour',        'Full colour application and gloss.',             90,  950.00, 2),
  ('Highlights',    'Partial or full foil highlights.',              120, 1250.00, 3),
  ('Treatment',     'Deep conditioning and scalp massage.',           30,  300.00, 4),
  ('Blow-dry',      'Wash and professional blow-dry.',                30,  250.00, 5);

-- Availability (Mon–Sat) -------------------------------------------------
insert into availability (weekday, start_time, end_time) values
  (1, '09:00', '17:00'),
  (2, '09:00', '17:00'),
  (3, '09:00', '17:00'),
  (4, '09:00', '19:00'),
  (5, '09:00', '19:00'),
  (6, '09:00', '14:00');

-- Gallery placeholders (Cloudinary ids to be swapped in Phase 2) ---------
insert into gallery (cloudinary_id, url, caption, sort_order) values
  ('demo/placeholder-1', 'https://res.cloudinary.com/demo/image/upload/w_800/sample.jpg', 'Balayage, natural light', 1),
  ('demo/placeholder-2', 'https://res.cloudinary.com/demo/image/upload/w_800/sample.jpg', 'Precision bob',           2),
  ('demo/placeholder-3', 'https://res.cloudinary.com/demo/image/upload/w_800/sample.jpg', 'Soft curls',              3);