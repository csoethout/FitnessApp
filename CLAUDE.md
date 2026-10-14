# FitnessApp — project memory

Personal workout, body-weight and nutrition tracker. Installable PWA, iPhone first.
This file is the source of truth between sessions: read it first, update it as you go.

## How we work
- Build in phases (below). Finish and test a phase before starting the next.
- Small steps, clear git commits. After each step report: what changed, how to run it, what to test.
- Ideas outside the current phase go to **Backlog**, not into code.
- Flag anything that adds cost, creates security risk, or is hard to change later.
- Owner is a coder (Python/R/SQL), new to TypeScript and weak at UX: explain choices in plain language.
- Branch: `claude/fitness-tracking-pwa-xd1s3z`.

## Hard constraints
1. Free tiers only. Say so before suggesting anything that costs money.
2. Core app works with **no AI at runtime**. Rules-based planner only.
3. AI (Claude API) is an optional last layer; API key server-side only (Supabase Edge Function secret), never in frontend.
4. Free data sources only: USDA FoodData Central, Open Food Facts, free-exercise-db (public domain).
5. Health data is private: Supabase Auth + row level security on every table.
6. Safety guardrails: calorie floor (1500 kcal men / 1200 women), max deficit 25% of TDEE, max loss 1% bodyweight/week, "not medical advice" note.
7. Mid-workout UX: big tap targets (≥48px), one-tap set logging, offline-first with sync.
8. CSV export of all data.

## Stack
| Layer | Choice | Why |
|---|---|---|
| Frontend | Vite + React + TypeScript | No SSR needed; static build; simple PWA |
| UI | Tailwind CSS v4 (+ shadcn/ui-style components as needed) | Fast, consistent mobile styling |
| Routing | react-router | Standard |
| Backend | Supabase free tier (Postgres, Auth, RLS, Edge Functions) | Relational data + native RLS |
| Hosting | Cloudflare Pages free tier | Free, no commercial-use restriction |
| Offline | Dexie (IndexedDB) + vite-plugin-pwa (Phase 6; data layer designed for it from the start) | iOS-safe offline |
| Charts | Recharts (Phase 3) | |
| Exercises | free-exercise-db (Unlicense) seeded into `exercises` | Equipment + muscle tags for swaps |
| Tests | Vitest | Planner/progression logic must be unit-tested |

## Owner profile (inputs for the planner)
- Male, born 2003-04-21, 6'5" (195.6 cm), ~210 lb (95.3 kg), returning lifter.
- Goal: recomposition (lose fat, gain muscle), get stronger, build the habit.
- Walks ≥1 mile every morning. Lifts 6 days/week, 45–60 min, flexible time (trending mornings).
- Past shoulder surgery: can overhead press; some sets may be "limited". Train as normal.
- Gym: barbell, dumbbells, cables, machines (not everything) → swaps needed.
- US, lb units, week starts Sunday. iPhone. Eats repetitive, high-protein meals; picky; wants lower fat/carbs.
- Current split (default template):
  - Sun: Back & Shoulders (shoulder focus) · Mon: Legs (squat focus) · Tue: Chest · Wed: Back
  - Thu: Arms & Abs · Fri: Rest · Sat: Full body (chest & legs focus)
- Starting estimate: BMR ≈ 2065, TDEE ≈ 3200 (×1.55), recomp target ≈ 2700 kcal,
  protein 190–220 g, fat ≈ 65 g floor, carbs = remainder. Re-check every 2 weeks.

## Product spec (MVP = Phases 1–6)
**Screens** (bottom tab bar):
1. **Today**: planned workout + Start, calories/protein remaining, one-tap weigh-in.
2. **Workout logger** (most important): exercise cards; set rows prefilled with target; tap ✓ logs as-is;
   big ± steppers (5 lb); set types warm-up / working / limited ("couldn't finish"); optional RIR chips
   (0,1,2,3,4+); optional rest timer bar; Swap + "Not at this gym"; auto-save each tap locally; wake lock where supported.
   Suggested warm-ups (bar×10, 50%×5, 70%×3, 85%×1) only for the first compound of a session; one tap to add.
3. **Progress**: e1RM per exercise (Epley, working sets ≤10 reps), PRs, weekly hard sets per muscle + tonnage.
4. **Food**: day log by meal; add → Recent & Saved first, then Search (USDA/OFF), Scan barcode, Manual label entry.
   Copy yesterday; saved meals/recipes (servings yield). Calories + protein are primary; carbs/fat secondary.
5. **Body**: daily weigh-in with weight + optional body fat % + optional muscle mass (all visible, no "More"),
   7-day average trend lines.
6. **Plan**: weekly split (editable template), progression rules, plan wizard, weekly "Plan my week" check-in.
7. **Settings**: profile, units, equipment profiles, timer/RIR toggles, CSV export, sign out.

**Progression (double progression)**: compounds 6–10 reps, isolation 10–15. All working sets at top of range →
+5 lb (+10 lb barbell lower body). Else same weight, +1 rep. Miss bottom of range 2 sessions in a row → −10%.
`limited` sets ignored. Weeks 1–2: ramp-in (2–3 working sets, ~3 RIR).

**Calories**: Mifflin-St Jeor × activity factor; goal adjustment; every 2 weeks compare weight trend to target
rate and adjust ±100–150 kcal, within the safety guardrails.

**Plan my week** (Phase 5): each week is copied fresh from the template. Per day: normal / short (minutes) /
busy / away (equipment profile). Rules: move missed sessions to rest days by priority; merge; shorten by dropping
non-main lifts; swap to available equipment; no gym → run/bodyweight session.

## Data model (approved)
Conventions for every user-owned table: client-generated UUID `id`; `user_id` on every row (RLS:
`user_id = auth.uid()`); composite FKs `(parent_id, user_id)` so children can't point at another user's rows;
`created_at`, `updated_at`, `deleted_at` (soft delete for sync; last-write-wins). Weights stored in **kg**,
displayed in lb. Derived stats (e1RM, PRs, volume, trends, next targets) are computed, never stored.

- People: `profiles`, `equipment_profiles`, `exercise_unavailable`
- Exercises: `exercises` (owner_id null = shared catalog, read-only to users), `user_exercise_settings`
- Training: `workouts`, `workout_exercises`, `sets` (set_type warmup/working/limited, rir nullable), `cardio_entries`
- Body: `body_measurements` (one per day; weight_kg, body_fat_pct?, muscle_mass_kg?)
- Food: `foods` (owner_id null = shared cache, written only server-side), `saved_meals`, `saved_meal_items`,
  `food_log_entries` (snapshot of name + macros)
- Plans: `goals`, `nutrition_targets` (history), `plan_templates`, `plan_template_days`, `plan_template_exercises`,
  `week_plans`, `week_plan_days` (status normal/short/busy/away), `week_plan_exercises`

Schema lives in `supabase/migrations/`. Never edit an applied migration; add a new one.

## Decisions log
- Vite over Next.js; Supabase over Firebase; Cloudflare Pages over Vercel.
- Email + password auth, **invite-only** (sign-ups disabled in Supabase; users added from dashboard).
- Hard to change later (deliberate): client UUIDs + soft deletes, kg storage, food log macro snapshots,
  template vs weekly instance, `user_id` on every row.
- Navigation: 5 bottom tabs — Today, Train (logger, history, plan), Food, Progress (strength + body), More (settings).
- Dark theme by default (gym lighting, OLED battery). Inputs are 16px so iOS doesn't zoom on focus.
- Allowed values are text + CHECK constraints, not Postgres enums (easier to extend).
- Supabase "publishable"/anon key is safe in the frontend because RLS protects data. The service-role key is
  never in frontend code or the repo.

## Conventions
- TypeScript strict. Components in `src/components`, screens in `src/screens`, pure logic in `src/lib`
  (planner/progression/units are pure functions with Vitest tests).
- Mobile first: design at 390px wide, tap targets ≥48px, primary action at the bottom within thumb reach.
- Env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` in `.env.local` (git-ignored). See `.env.example`.
- Commands: `npm run dev`, `npm run build`, `npm test`, `npm run lint`, `npm run test:db` (RLS tests on local Postgres).

## Phases & task list
- [ ] **Phase 1: setup, auth, database, deploy**
  - [x] Spec, data model, CLAUDE.md
  - [x] Vite + React + TS + Tailwind scaffold, app shell with bottom tabs
  - [x] Database migration: full schema + RLS; RLS tests against local Postgres (`npm run test:db`)
  - [x] Supabase client + email/password sign-in + protected routes
  - [x] Cloudflare Pages config (SPA redirects) + deploy guide (`docs/SETUP.md`)
  - [ ] Owner: create Supabase project, run migration, create user, connect Cloudflare → live URL
  - [ ] Owner: run the Phase 1 test checklist in `docs/SETUP.md` on the iPhone
- [ ] **Phase 2: workout logging** (seed exercises, logger screen, swaps, rest timer, local-first save)
- [ ] **Phase 3: progress views and charts**
- [ ] **Phase 4: body weight (+ body fat %, muscle mass) and food/macro tracking**
- [ ] **Phase 5: rules-based planner, Plan my week, equipment profiles, cardio logging**
- [ ] **Phase 6: PWA install, offline sync, CSV export**
- [ ] **Phase 7 (optional): Claude API layer (weekly plan writing, stall adjustments)**

## Backlog (not in MVP)
- Suggested workout times from availability blocks (e.g. busy 8am–6pm) + one-off commitments
- Google Calendar sync (adds OAuth + privacy surface)
- AI: free-text week check-in ("out of town Fri–Sun, hotel gym")
- Apple Health / Bluetooth scale sync (not possible from a PWA on iOS; needs native app, $99/yr)
- Walk/step tracking beyond manual cardio entries; reminders/notifications; supersets; plate calculator
- Friends/sharing (needs custom SMTP, e.g. Resend free tier); importing old data
