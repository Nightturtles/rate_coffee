-- Idempotent reference seeds (brew methods, tasting tags). Migrations run as a privileged role.

insert into public.brew_methods (slug, label, sort_order)
values
  ('espresso', 'Espresso', 10),
  ('pourover', 'Pour over', 20),
  ('french-press', 'French press', 30),
  ('aeropress', 'AeroPress', 40),
  ('cold-brew', 'Cold brew', 50),
  ('drip', 'Drip / batch brew', 60),
  ('moka-pot', 'Moka pot', 70)
on conflict (slug) do nothing;

insert into public.tags (slug, label, sort_order)
values
  ('fruity', 'Fruity', 10),
  ('chocolate', 'Chocolate', 20),
  ('nutty', 'Nutty', 30),
  ('citrus', 'Citrus', 40),
  ('floral', 'Floral', 50),
  ('caramel', 'Caramel', 60),
  ('roasty', 'Roasty', 70)
on conflict (slug) do nothing;
