-- Optional label nutrients (Phase 4). All nullable, so existing rows are untouched.
-- Foods store them per serving; log entries keep a per-serving snapshot like the macros.
alter table public.foods
  add column if not exists sugar_g numeric(6, 1) check (sugar_g >= 0),
  add column if not exists sat_fat_g numeric(6, 1) check (sat_fat_g >= 0),
  add column if not exists trans_fat_g numeric(6, 1) check (trans_fat_g >= 0),
  add column if not exists cholesterol_mg numeric(7, 1) check (cholesterol_mg >= 0),
  add column if not exists sodium_mg numeric(8, 1) check (sodium_mg >= 0);

alter table public.food_log_entries
  add column if not exists fiber_g_per_serving numeric(6, 1) check (fiber_g_per_serving >= 0),
  add column if not exists sugar_g_per_serving numeric(6, 1) check (sugar_g_per_serving >= 0),
  add column if not exists sat_fat_g_per_serving numeric(6, 1) check (sat_fat_g_per_serving >= 0),
  add column if not exists trans_fat_g_per_serving numeric(6, 1) check (trans_fat_g_per_serving >= 0),
  add column if not exists cholesterol_mg_per_serving numeric(7, 1) check (cholesterol_mg_per_serving >= 0),
  add column if not exists sodium_mg_per_serving numeric(8, 1) check (sodium_mg_per_serving >= 0);

-- PostgREST caches the table shape; tell it to reload so the new columns are accepted immediately.
notify pgrst, 'reload schema';
