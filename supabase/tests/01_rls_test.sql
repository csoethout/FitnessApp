-- Row level security tests. Run with: npm run test:db
\set ON_ERROR_STOP on
set client_min_messages = warning;

-- Assertion helpers (security invoker: they run with the caller's role and RLS).
create schema tests;
grant usage on schema tests to anon, authenticated;

create function tests.eq(actual bigint, expected bigint, msg text) returns void language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'FAIL: % (expected %, got %)', msg, expected, actual;
  end if;
  raise notice 'ok - %', msg;
end $$;

create function tests.fails(stmt text, msg text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    raise notice 'ok - % (%)', msg, sqlerrm;
    return;
  end;
  raise exception 'FAIL: % (statement succeeded: %)', msg, stmt;
end $$;

create function tests.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, false);
$$;
grant execute on all functions in schema tests to anon, authenticated;

set client_min_messages = notice;

-- Fixtures (as superuser): two users, one shared exercise, one shared food.
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@example.com'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@example.com');
insert into public.exercises (id, source, source_id, name, equipment, mechanic)
  values ('eeeeeeee-0000-0000-0000-000000000001', 'free-exercise-db', 'Barbell_Squat', 'Barbell Squat', 'barbell', 'compound');
insert into public.foods (id, source, source_id, name, kcal, protein_g)
  values ('ffffffff-0000-0000-0000-000000000001', 'usda', '171077', 'Chicken breast', 165, 31);

select tests.eq((select count(*) from public.profiles), 2, 'profile auto-created for each new user');

-- ---------------- User A creates data ----------------
set role authenticated;
select tests.as_user('aaaaaaaa-0000-0000-0000-000000000001');

insert into public.equipment_profiles (id, name, equipment, is_default)
  values ('a0000000-0000-0000-0000-0000000000e1', 'Main gym', '{barbell,dumbbell,cable,machine}', true);
insert into public.workouts (id, name, equipment_profile_id)
  values ('a0000000-0000-0000-0000-0000000000a1', 'Legs', 'a0000000-0000-0000-0000-0000000000e1');
insert into public.workout_exercises (id, workout_id, exercise_id)
  values ('a0000000-0000-0000-0000-0000000000b1', 'a0000000-0000-0000-0000-0000000000a1', 'eeeeeeee-0000-0000-0000-000000000001');
insert into public.sets (id, workout_exercise_id, set_type, weight_kg, reps, completed_at)
  values ('a0000000-0000-0000-0000-0000000000c1', 'a0000000-0000-0000-0000-0000000000b1', 'working', 102.0583, 8, now());
insert into public.exercises (id, owner_id, name) values
  ('a0000000-0000-0000-0000-0000000000d1', 'aaaaaaaa-0000-0000-0000-000000000001', 'A private exercise');
insert into public.foods (id, owner_id, name, kcal) values
  ('a0000000-0000-0000-0000-0000000000f1', 'aaaaaaaa-0000-0000-0000-000000000001', 'A private food', 100);
insert into public.body_measurements (measured_on, weight_kg, body_fat_pct) values ('2026-10-14', 95.25, 18.5);
insert into public.food_log_entries (logged_on, name, kcal_per_serving, food_id)
  values ('2026-10-14', 'Chicken breast', 165, 'ffffffff-0000-0000-0000-000000000001');

select tests.eq((select count(*) from public.profiles), 1, 'A sees only their own profile');
select tests.eq((select count(*) from public.sets), 1, 'A sees their set');
select tests.eq((select count(*) from public.exercises), 2, 'A sees shared + own exercises');

-- updated_at trigger
update public.sets set reps = 9 where id = 'a0000000-0000-0000-0000-0000000000c1';
select tests.eq((select count(*) from public.sets where updated_at >= created_at and reps = 9), 1, 'A can update own set');

-- ---------------- User B cannot see or touch A's data ----------------
select tests.as_user('bbbbbbbb-0000-0000-0000-000000000002');

select tests.eq((select count(*) from public.profiles), 1, 'B sees only their own profile');
select tests.eq((select count(*) from public.workouts), 0, 'B cannot see A workouts');
select tests.eq((select count(*) from public.sets), 0, 'B cannot see A sets');
select tests.eq((select count(*) from public.body_measurements), 0, 'B cannot see A weigh-ins');
select tests.eq((select count(*) from public.food_log_entries), 0, 'B cannot see A food log');
select tests.eq((select count(*) from public.exercises), 1, 'B sees only the shared exercise');
select tests.eq((select count(*) from public.foods), 1, 'B sees only the shared food');

with u as (update public.sets set reps = 1 returning 1) select tests.eq((select count(*) from u), 0, 'B cannot update A sets');
with d as (delete from public.workouts returning 1) select tests.eq((select count(*) from d), 0, 'B cannot delete A workouts');
with u as (update public.profiles set display_name = 'x' where id = 'aaaaaaaa-0000-0000-0000-000000000001' returning 1)
  select tests.eq((select count(*) from u), 0, 'B cannot update A profile');
with u as (update public.exercises set name = 'x' returning 1) select tests.eq((select count(*) from u), 0, 'B cannot edit shared exercises');

select tests.fails($$insert into public.workouts (user_id, name) values ('aaaaaaaa-0000-0000-0000-000000000001', 'x')$$,
  'B cannot insert a row owned by A');
select tests.fails($$insert into public.workout_exercises (workout_id, exercise_id)
  values ('a0000000-0000-0000-0000-0000000000a1', 'eeeeeeee-0000-0000-0000-000000000001')$$,
  'B cannot attach an exercise to A workout (composite FK)');
insert into public.workouts (id, name) values ('b0000000-0000-0000-0000-0000000000a1', 'B workout');
select tests.fails($$insert into public.workout_exercises (workout_id, exercise_id)
  values ('b0000000-0000-0000-0000-0000000000a1', 'a0000000-0000-0000-0000-0000000000d1')$$,
  'B cannot use A private exercise');
insert into public.workout_exercises (id, workout_id, exercise_id)
  values ('b0000000-0000-0000-0000-0000000000b1', 'b0000000-0000-0000-0000-0000000000a1', 'eeeeeeee-0000-0000-0000-000000000001');
select tests.fails($$update public.workout_exercises set exercise_id = 'a0000000-0000-0000-0000-0000000000d1'
  where id = 'b0000000-0000-0000-0000-0000000000b1'$$,
  'B cannot switch an exercise to A private exercise');
select tests.fails($$insert into public.food_log_entries (logged_on, name, kcal_per_serving, food_id)
  values ('2026-10-14', 'x', 1, 'a0000000-0000-0000-0000-0000000000f1')$$,
  'B cannot log A private food');
select tests.fails($$insert into public.exercises (name, source, source_id) values ('Fake', 'free-exercise-db', 'fake')$$,
  'B cannot add to the shared exercise catalog');
select tests.fails($$insert into public.foods (name, source, source_id, kcal) values ('Fake', 'usda', '1', 1)$$,
  'B cannot add to the shared food cache');
select tests.fails($$delete from public.profiles$$, 'profiles cannot be deleted by users');
select tests.fails($$update public.profiles set id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  'B cannot take over A profile id');

-- Guardrails
select tests.fails($$insert into public.nutrition_targets (effective_from, kcal, protein_g, carbs_g, fat_g)
  values ('2026-10-14', 1000, 150, 50, 30)$$, 'calorie target below 1200 rejected');
select tests.fails($$insert into public.goals (goal_type, start_date, target_rate_pct_week)
  values ('cut', '2026-10-14', -2)$$, 'weight loss faster than 1%/week rejected');
select tests.fails($$insert into public.sets (workout_exercise_id, reps) values (gen_random_uuid(), -1)$$,
  'negative reps rejected');

-- ---------------- Anonymous (signed out) gets nothing ----------------
reset role;
set role anon;
select set_config('request.jwt.claims', '', false);
select tests.fails($$select * from public.workouts$$, 'anon cannot read workouts');
select tests.fails($$select * from public.exercises$$, 'anon cannot read exercises');
reset role;

\echo 'ALL RLS TESTS PASSED'
