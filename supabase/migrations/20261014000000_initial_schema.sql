-- Initial schema for FitnessApp. See CLAUDE.md → "Data model (approved)".
--
-- Conventions
--   * id: uuid, normally generated on the phone so rows can be created offline.
--   * user_id on every user-owned row; RLS policy is always user_id = auth.uid().
--   * Child tables reference parents with composite FKs (parent_id, user_id) so a row can never
--     point at another user's data.
--   * created_at / updated_at / deleted_at: deleted_at is a soft delete so deletions sync.
--   * Weights in kg. Allowed values use text + CHECK (easier to extend than Postgres enums).

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- People and settings
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  sex text check (sex in ('male', 'female')),
  birth_date date,
  height_cm numeric(5, 1) check (height_cm between 100 and 250),
  activity_level text check (activity_level in ('sedentary', 'light', 'moderate', 'very', 'extra')),
  unit_system text not null default 'imperial' check (unit_system in ('imperial', 'metric')),
  timezone text,
  week_start_day smallint not null default 0 check (week_start_day between 0 and 6), -- 0 = Sunday
  session_minutes_min smallint check (session_minutes_min between 10 and 240),
  session_minutes_max smallint check (session_minutes_max between 10 and 240),
  preferred_time text check (preferred_time in ('morning', 'midday', 'evening', 'flexible')),
  settings jsonb not null default '{}'::jsonb, -- rest timer, RIR toggle, default rest times
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (session_minutes_min is null or session_minutes_max is null or session_minutes_min <= session_minutes_max)
);

-- Create an empty profile automatically when an account is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.equipment_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(name) between 1 and 60),
  equipment text[] not null default '{}', -- equipment types available, matching exercises.equipment
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id)
);
create unique index equipment_profiles_one_default
  on public.equipment_profiles (user_id) where is_default and deleted_at is null;

-- ---------------------------------------------------------------------------
-- Exercises
-- ---------------------------------------------------------------------------

-- owner_id null = shared catalog (seeded from free-exercise-db, read-only to users).
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete cascade,
  source text not null default 'custom' check (source in ('free-exercise-db', 'custom')),
  source_id text,
  name text not null check (length(name) between 1 and 120),
  primary_muscles text[] not null default '{}',
  secondary_muscles text[] not null default '{}',
  equipment text,
  mechanic text check (mechanic in ('compound', 'isolation')),
  force text check (force in ('push', 'pull', 'static')),
  level text,
  category text,
  instructions text[] not null default '{}',
  images text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (owner_id is not null or source <> 'custom')
);
create unique index exercises_source_unique on public.exercises (source, source_id) where source_id is not null;
create index exercises_owner on public.exercises (owner_id);

create table public.exercise_unavailable (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  equipment_profile_id uuid not null,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (equipment_profile_id, exercise_id),
  foreign key (equipment_profile_id, user_id) references public.equipment_profiles (id, user_id) on delete cascade
);

create table public.user_exercise_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  rep_min smallint check (rep_min between 1 and 100),
  rep_max smallint check (rep_max between 1 and 100),
  increment_kg numeric(6, 3) check (increment_kg > 0),
  rest_seconds smallint check (rest_seconds between 0 and 900),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, exercise_id),
  check (rep_min is null or rep_max is null or rep_min <= rep_max)
);

-- ---------------------------------------------------------------------------
-- Goals and plans
-- ---------------------------------------------------------------------------

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_type text not null check (goal_type in ('recomp', 'cut', 'bulk', 'maintain', 'strength')),
  start_date date not null,
  end_date date,
  start_weight_kg numeric(8, 4) check (start_weight_kg between 20 and 400),
  target_weight_kg numeric(8, 4) check (target_weight_kg between 20 and 400),
  -- Safety guardrail: never plan to lose more than 1% or gain more than 0.5% of bodyweight per week.
  target_rate_pct_week numeric(4, 2) check (target_rate_pct_week between -1 and 0.5),
  status text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id),
  check (end_date is null or end_date >= start_date)
);
create unique index goals_one_active on public.goals (user_id) where status = 'active' and deleted_at is null;

-- History of calorie/macro targets; charts compare each day against the target in effect that day.
create table public.nutrition_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id uuid,
  effective_from date not null,
  -- Absolute floor; the app applies the stricter sex-specific floor (1500 men / 1200 women).
  kcal integer not null check (kcal between 1200 and 6000),
  protein_g integer not null check (protein_g between 0 and 500),
  carbs_g integer not null check (carbs_g between 0 and 1000),
  fat_g integer not null check (fat_g between 0 and 400),
  reason text not null default 'manual' check (reason in ('initial', 'biweekly_adjust', 'manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, effective_from),
  foreign key (goal_id, user_id) references public.goals (id, user_id) on delete set null (goal_id)
);

create table public.plan_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id uuid,
  name text not null check (length(name) between 1 and 80),
  split_type text not null default 'custom' check (split_type in ('full_body', 'upper_lower', 'ppl', 'custom')),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id),
  foreign key (goal_id, user_id) references public.goals (id, user_id) on delete set null (goal_id)
);
create unique index plan_templates_one_active
  on public.plan_templates (user_id) where is_active and deleted_at is null;

create table public.plan_template_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  template_id uuid not null,
  day_of_week smallint not null check (day_of_week between 0 and 6), -- 0 = Sunday
  name text not null check (length(name) between 1 and 80),
  priority smallint not null default 0, -- higher = keep first when the week gets squeezed
  is_rest boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id),
  unique (template_id, day_of_week),
  foreign key (template_id, user_id) references public.plan_templates (id, user_id) on delete cascade
);

create table public.plan_template_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  template_day_id uuid not null,
  exercise_id uuid not null references public.exercises (id),
  position smallint not null default 0,
  sets smallint not null default 3 check (sets between 1 and 10),
  rep_min smallint not null default 8 check (rep_min between 1 and 100),
  rep_max smallint not null default 12 check (rep_max between 1 and 100),
  is_main_lift boolean not null default false, -- kept when a session is shortened
  rest_seconds smallint check (rest_seconds between 0 and 900),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (rep_min <= rep_max),
  foreign key (template_day_id, user_id) references public.plan_template_days (id, user_id) on delete cascade
);

-- A fresh copy of the active template for one week. "Plan my week" only edits this copy.
create table public.week_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  template_id uuid,
  week_start date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id),
  unique (user_id, week_start),
  foreign key (template_id, user_id) references public.plan_templates (id, user_id) on delete set null (template_id)
);

create table public.week_plan_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  week_plan_id uuid not null,
  plan_date date not null,
  status text not null default 'normal' check (status in ('normal', 'short', 'busy', 'away')),
  minutes_available smallint check (minutes_available between 0 and 600),
  equipment_profile_id uuid,
  source_template_day_id uuid,
  session_name text, -- null = rest day
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id),
  unique (week_plan_id, plan_date),
  foreign key (week_plan_id, user_id) references public.week_plans (id, user_id) on delete cascade,
  foreign key (equipment_profile_id, user_id)
    references public.equipment_profiles (id, user_id) on delete set null (equipment_profile_id),
  foreign key (source_template_day_id, user_id)
    references public.plan_template_days (id, user_id) on delete set null (source_template_day_id)
);

create table public.week_plan_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  week_plan_day_id uuid not null,
  exercise_id uuid not null references public.exercises (id),
  position smallint not null default 0,
  sets smallint not null default 3 check (sets between 1 and 10),
  rep_min smallint not null default 8 check (rep_min between 1 and 100),
  rep_max smallint not null default 12 check (rep_max between 1 and 100),
  is_main_lift boolean not null default false,
  rest_seconds smallint check (rest_seconds between 0 and 900),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (rep_min <= rep_max),
  foreign key (week_plan_day_id, user_id) references public.week_plan_days (id, user_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- Training log
-- ---------------------------------------------------------------------------

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  week_plan_day_id uuid, -- the planned session this fulfils, if any
  name text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  equipment_profile_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id),
  check (ended_at is null or ended_at >= started_at),
  foreign key (week_plan_day_id, user_id)
    references public.week_plan_days (id, user_id) on delete set null (week_plan_day_id),
  foreign key (equipment_profile_id, user_id)
    references public.equipment_profiles (id, user_id) on delete set null (equipment_profile_id)
);
create index workouts_user_started on public.workouts (user_id, started_at desc);

create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workout_id uuid not null,
  exercise_id uuid not null references public.exercises (id),
  position smallint not null default 0,
  swapped_from_exercise_id uuid references public.exercises (id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id),
  foreign key (workout_id, user_id) references public.workouts (id, user_id) on delete cascade
);
create index workout_exercises_exercise on public.workout_exercises (user_id, exercise_id);

create table public.sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workout_exercise_id uuid not null,
  position smallint not null default 0,
  -- limited = "couldn't finish" (e.g. shoulder); ignored by progression rules.
  set_type text not null default 'working' check (set_type in ('warmup', 'working', 'limited')),
  weight_kg numeric(8, 4) not null default 0 check (weight_kg between 0 and 1000),
  reps smallint not null default 0 check (reps between 0 and 1000),
  rir smallint check (rir between 0 and 10), -- optional "reps in reserve"
  completed_at timestamptz, -- null = planned but not done yet
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (workout_exercise_id, user_id) references public.workout_exercises (id, user_id) on delete cascade
);

create table public.cardio_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  performed_on date not null,
  activity text not null check (activity in ('walk', 'run', 'bike', 'row', 'swim', 'other')),
  duration_min numeric(6, 1) not null check (duration_min > 0 and duration_min <= 1440),
  distance_km numeric(8, 3) check (distance_km >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Body
-- ---------------------------------------------------------------------------

-- One entry per day; the app upserts on (user_id, measured_on).
create table public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  measured_on date not null,
  weight_kg numeric(8, 4) check (weight_kg between 20 and 400),
  body_fat_pct numeric(4, 1) check (body_fat_pct between 2 and 70),
  muscle_mass_kg numeric(7, 3) check (muscle_mass_kg between 5 and 200),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, measured_on),
  check (weight_kg is not null or body_fat_pct is not null or muscle_mass_kg is not null)
);

-- ---------------------------------------------------------------------------
-- Food
-- ---------------------------------------------------------------------------

-- owner_id null = shared cache of USDA / Open Food Facts lookups, written only server-side.
-- Nutrients are per serving (serving_amount serving_unit, optionally serving_grams).
create table public.foods (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete cascade,
  source text not null default 'custom' check (source in ('usda', 'off', 'custom')),
  source_id text,
  barcode text,
  name text not null check (length(name) between 1 and 200),
  brand text,
  serving_amount numeric(8, 2) not null default 1 check (serving_amount > 0),
  serving_unit text not null default 'serving',
  serving_grams numeric(8, 2) check (serving_grams > 0),
  kcal numeric(7, 1) not null check (kcal >= 0),
  protein_g numeric(6, 1) not null default 0 check (protein_g >= 0),
  carbs_g numeric(6, 1) not null default 0 check (carbs_g >= 0),
  fat_g numeric(6, 1) not null default 0 check (fat_g >= 0),
  fiber_g numeric(6, 1) check (fiber_g >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (owner_id is not null or source <> 'custom')
);
create unique index foods_shared_source on public.foods (source, source_id) where owner_id is null;
create index foods_barcode on public.foods (barcode) where barcode is not null;
create index foods_owner on public.foods (owner_id);

create table public.saved_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(name) between 1 and 120),
  servings_yield numeric(6, 2) not null default 1 check (servings_yield > 0), -- >1 for recipes
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id)
);

create table public.saved_meal_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  saved_meal_id uuid not null,
  food_id uuid not null references public.foods (id),
  servings numeric(8, 3) not null default 1 check (servings > 0),
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (saved_meal_id, user_id) references public.saved_meals (id, user_id) on delete cascade
);

-- Entries keep a snapshot of name + per-serving macros, so later edits to a food don't rewrite history.
-- Quick-add = an entry with no food_id.
create table public.food_log_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  logged_on date not null,
  meal_slot text not null default 'snack' check (meal_slot in ('breakfast', 'lunch', 'dinner', 'snack')),
  food_id uuid references public.foods (id) on delete set null,
  saved_meal_id uuid,
  servings numeric(8, 3) not null default 1 check (servings > 0),
  name text not null check (length(name) between 1 and 200),
  kcal_per_serving numeric(7, 1) not null check (kcal_per_serving >= 0),
  protein_g_per_serving numeric(6, 1) not null default 0 check (protein_g_per_serving >= 0),
  carbs_g_per_serving numeric(6, 1) not null default 0 check (carbs_g_per_serving >= 0),
  fat_g_per_serving numeric(6, 1) not null default 0 check (fat_g_per_serving >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (saved_meal_id, user_id) references public.saved_meals (id, user_id) on delete set null (saved_meal_id)
);
create index food_log_entries_user_day on public.food_log_entries (user_id, logged_on);

-- ---------------------------------------------------------------------------
-- Shared boilerplate for every table: updated_at trigger, sync index, privileges, RLS.
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
  user_tables text[] := array[
    'equipment_profiles', 'exercise_unavailable', 'user_exercise_settings',
    'goals', 'nutrition_targets', 'plan_templates', 'plan_template_days', 'plan_template_exercises',
    'week_plans', 'week_plan_days', 'week_plan_exercises',
    'workouts', 'workout_exercises', 'sets', 'cardio_entries',
    'body_measurements', 'saved_meals', 'saved_meal_items', 'food_log_entries'
  ];
  all_tables text[] := user_tables || array['profiles', 'exercises', 'foods'];
begin
  foreach t in array all_tables loop
    execute format('create trigger set_updated_at before update on public.%I
                    for each row execute function public.set_updated_at()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;

  -- Owner-only access. (select auth.uid()) is evaluated once per query, not once per row.
  foreach t in array user_tables loop
    execute format('create index %I on public.%I (user_id, updated_at)', t || '_sync', t);
    execute format('create policy "owner can do everything" on public.%I for all to authenticated
                    using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end;
$$;

-- profiles: keyed by id = auth user id. No delete (it goes away with the account).
revoke delete on public.profiles from authenticated;
create policy "owner can read profile" on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy "owner can update profile" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- exercises and foods: everyone signed in can read the shared catalog (owner_id null) and their own rows;
-- they can only write their own rows. Shared rows are written with the service role (seed / Edge Function).
create policy "read shared and own exercises" on public.exercises for select to authenticated
  using (owner_id is null or owner_id = (select auth.uid()));
create policy "insert own exercises" on public.exercises for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "update own exercises" on public.exercises for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "delete own exercises" on public.exercises for delete to authenticated
  using (owner_id = (select auth.uid()));

create policy "read shared and own foods" on public.foods for select to authenticated
  using (owner_id is null or owner_id = (select auth.uid()));
create policy "insert own foods" on public.foods for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "update own foods" on public.foods for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "delete own foods" on public.foods for delete to authenticated
  using (owner_id = (select auth.uid()));

-- Foreign keys bypass RLS, so a user could reference someone else's private exercise/food by id.
-- These restrictive policies (ANDed with the owner policy) require the referenced row to be visible.
do $$
declare
  r record;
  op text;
begin
  for r in
    select * from (values
      ('exercise_unavailable', 'exists (select 1 from public.exercises e where e.id = exercise_id)'),
      ('user_exercise_settings', 'exists (select 1 from public.exercises e where e.id = exercise_id)'),
      ('plan_template_exercises', 'exists (select 1 from public.exercises e where e.id = exercise_id)'),
      ('week_plan_exercises', 'exists (select 1 from public.exercises e where e.id = exercise_id)'),
      ('workout_exercises', 'exists (select 1 from public.exercises e where e.id = exercise_id)
         and (swapped_from_exercise_id is null
              or exists (select 1 from public.exercises e where e.id = swapped_from_exercise_id))'),
      ('saved_meal_items', 'exists (select 1 from public.foods f where f.id = food_id)'),
      ('food_log_entries', 'food_id is null or exists (select 1 from public.foods f where f.id = food_id)')
    ) as v (tbl, expr)
  loop
    foreach op in array array['insert', 'update'] loop
      execute format('create policy %I on public.%I as restrictive for %s to authenticated with check (%s)',
                     'referenced rows must be visible (' || op || ')', r.tbl, op, r.expr);
    end loop;
  end loop;
end;
$$;
