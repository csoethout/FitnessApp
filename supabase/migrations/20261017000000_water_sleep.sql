-- Water and sleep tracking (UX pass, owner request 2026-10-16). Same conventions as every user table:
-- client UUIDs, user_id + RLS (owner only), soft deletes, server-owned updated_at, sync index.
-- Safe to run more than once.

-- One row per drink ("+8 oz", "+ my bottle"); the day's total is the sum. Amounts in ml.
create table if not exists public.water_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  logged_on date not null, -- local date
  amount_ml numeric(7, 1) not null check (amount_ml > 0 and amount_ml <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- One row per night, keyed by the morning you woke up. Clock times are local ("23:15", "06:40").
create table if not exists public.sleep_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  wake_date date not null,
  bed_time time not null,
  wake_time time not null,
  duration_min smallint not null check (duration_min between 0 and 1440),
  quality smallint check (quality between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, wake_date)
);

do $$
declare
  t text;
begin
  foreach t in array array['water_entries', 'sleep_entries'] loop
    if not exists (select 1 from pg_trigger where tgname = 'set_updated_at' and tgrelid = format('public.%I', t)::regclass) then
      execute format('create trigger set_updated_at before update on public.%I
                      for each row execute function public.set_updated_at()', t);
    end if;
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('create index if not exists %I on public.%I (user_id, updated_at)', t || '_sync', t);
    execute format('drop policy if exists "owner can do everything" on public.%I', t);
    execute format('create policy "owner can do everything" on public.%I for all to authenticated
                    using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end;
$$;

create index if not exists water_entries_user_day on public.water_entries (user_id, logged_on);

-- PostgREST caches the table list; tell it to reload so the new tables work immediately.
notify pgrst, 'reload schema';
