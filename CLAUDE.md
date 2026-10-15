# FitnessApp — project memory

Personal workout, body-weight and nutrition tracker. Installable PWA, iPhone first.
This file is the source of truth between sessions: read it first, update it as you go.

## How we work
- Build in phases (below). Finish and test a phase before starting the next.
- Small steps, clear git commits. After each step report: what changed, how to run it, what to test.
- Ideas outside the current phase go to **Backlog**, not into code.
- Flag anything that adds cost, creates security risk, or is hard to change later.
- Owner is a coder (Python/R/SQL), new to TypeScript and weak at UX: explain choices in plain language.
- Branch: `claude/fitness-tracking-pwa-xd1s3z`. Live: https://fitnessapp.cnsoethout.workers.dev (auto-deploys on push).

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
| Hosting | Cloudflare Workers static assets, free tier (`wrangler.jsonc`) | Free, unlimited static requests; Cloudflare's current Git flow |
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
- Vite over Next.js; Supabase over Firebase; Cloudflare over Vercel. Deployed as a Workers static-assets project
  (SPA fallback via `not_found_handling`), not classic Pages; no `_redirects` file needed.
- Email + password auth, **invite-only** (sign-ups disabled in Supabase; users added from dashboard).
- Hard to change later (deliberate): client UUIDs + soft deletes, kg storage, food log macro snapshots,
  template vs weekly instance, `user_id` on every row.
- Navigation: 5 bottom tabs — Today, Train (logger, history, plan), Food, Progress (strength + body), More (settings).
- Dark theme by default (gym lighting, OLED battery). Inputs are 16px so iOS doesn't zoom on focus.
- Rest defaults: 3 min main lifts (`is_main_lift`), 2 min other compounds, 1 min isolation; 1/2/3 min buttons in timer.
- Starter days (`src/lib/starterSplit.ts`) are data applied once by a button; afterwards they're ordinary user rows.
  They are NOT app logic. Phase 5 planner generates days
  for everyone else; no hardcoded pre-fill in the product.
- Local-first saving pulled forward from Phase 6 into Phase 2 (gym Wi-Fi; retrofitting the logger later is costly).
  Phase 6 still adds offline app shell (service worker), install, CSV export.
- Only one workout can be in progress; starting another offers to resume it. Finishing removes sets never done
  and exercises with no completed sets.
- Phase 2 pre-fills sets from the last session (same exercise, any day); automatic progression targets arrive with the Phase 5 planner.
- Sync: one IndexedDB per user (`liftlog-<uid>`), deleted on sign-out (after warning about unsynced changes).
  Server owns `updated_at`; pull uses keyset (updated_at, id); rows with pending local edits are never overwritten;
  server-rejected rows are marked failed (shown in More) instead of blocking the queue. Syncs on write (debounced),
  foreground, reconnect, and every 60 s; no background sync on iOS.
- Logger UX: only the current set is expanded (big steppers + ✓); done sets collapse to one line; optional
  effort/"couldn't finish" row after ✓; timer bar at bottom. iOS can't alert when the PWA is backgrounded.
- Never use window.confirm/alert/prompt: iOS Safari (esp. home-screen apps) can silently block them (Finish "did
  nothing"). Use `useConfirm()` from `src/components/ConfirmProvider.tsx` (in-app bottom sheet).
- Swap ranking (`src/lib/swap.ts`): shares a primary muscle + doable at the gym; staples first (`src/lib/staples.ts`,
  data), then same muscles/mechanic/force/equipment/name words; expert/olympic/risky (guillotine, behind-the-neck…)
  sink. Swap mid-exercise keeps logged sets and continues in a new card. "Not at this gym" defaults to also replacing
  the exercise in the weekly plan.
- Rest timer (`src/lib/restTimer.ts`): stored as an end time in localStorage (per-device, not synced). Warm-up
  sets rest 60 s; otherwise the plan's rest (3/2/1 min). No timer after the workout's last set.
- Beep (`src/lib/beep.ts`): iOS needs audio *played* during a tap → any pointerdown in the logger plays a silent
  1-sample buffer. The beep is played when the timer hits zero (not pre-scheduled; iOS dropped that) and only if
  it ended <10 s ago. Web Audio mixes with music and obeys the silent switch. More → "Test rest sound".
- Stats (`src/lib/stats.ts`): e1RM = Epley, 1–10 reps, completed `working` sets only (warm-up and `limited`
  excluded). Volume = weight × reps of completed non-warm-up sets (limited included). PRs (e1RM, heaviest set) only
  vs workouts that started earlier; none the first time an exercise is logged. All computed, never stored.
- Allowed values are text + CHECK constraints, not Postgres enums (easier to extend).
- Supabase "publishable"/anon key is safe in the frontend because RLS protects data. The service-role key is
  never in frontend code or the repo.

## Conventions
- TypeScript strict. Components in `src/components`, screens in `src/screens`, pure logic in `src/lib`
  (planner/progression/units are pure functions with Vitest tests).
- Mobile first: design at 390px wide, tap targets ≥48px, primary action at the bottom within thumb reach.
- Env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` in `.env.local` (git-ignored). See `.env.example`.
- Commands: `npm run dev`, `npm run build`, `npm test`, `npm run lint`, `npm run test:db` (RLS tests on local Postgres),
  `POSTGREST_BIN=… npm run test:sync` (sync engine against real PostgREST + RLS).
- E2E (cloud sessions): `scripts/e2e-stack.sh` (needs POSTGREST_BIN; download postgrest-v12 linux-static-x64 from
  GitHub releases) → build with `VITE_SUPABASE_URL=http://localhost:54321` → drive with Playwright (global install,
  Chromium at /opt/pw-browsers) using a session JWT signed with the script's secret.
- Data access: screens read with `useLiveQuery(() => db.<table>…)` and write ONLY via `useData().store`
  (`insert` / `update` / `remove`). Never call `supabase.from()` for user data from screens — sync owns that.
  UI must filter `deleted_at == null`. New synced tables: add to `types.ts` (Tables, SYNC_ORDER, OWNER_COLUMN)
  and a new Dexie `db.version(n)`.

## Phases & task list
- [x] **Phase 1: setup, auth, database, deploy** (done 2026-10-14)
  - [x] Spec, data model, CLAUDE.md
  - [x] Vite + React + TS + Tailwind scaffold, app shell with bottom tabs
  - [x] Database migration: full schema + RLS; RLS tests against local Postgres (`npm run test:db`)
  - [x] Supabase client + email/password sign-in + protected routes
  - [x] Cloudflare config (`wrangler.jsonc`, SPA fallback) + deploy guide (`docs/SETUP.md`)
  - [x] Owner: Supabase project created, migration run, user created
  - [x] Owner: Cloudflare Worker `fitnessapp` connected, build variables set → live at https://fitnessapp.cnsoethout.workers.dev
  - [x] Owner: set Supabase Site URL to the live URL
  - [x] Owner: run the Phase 1 test checklist in `docs/SETUP.md` on the iPhone
- [ ] **Phase 2: workout logging**
  - [x] 2.1 Exercise library migration (753 exercises, stretches excluded, stable md5 ids, re-runnable)
  - [x] Owner: run `20261015000000_seed_exercises.sql` in Supabase SQL Editor (753 rows confirmed)
  - [x] 2.2 Local-first data layer (`src/data`: Dexie per-user DB, outbox, SyncEngine push/pull, SyncManager, sync status card)
  - [x] 2.3 Week setup: "Use starter split" / empty week (atomic), day editor (name, rest day, sets, reps, main lift,
        reorder, remove), exercise picker (search, muscle chips, only-my-gym), default "Main gym" profile
  - [x] 2.4 Logger: Start/Resume (Today card, Train, day editor, empty workout), full-screen `/workout/:id`,
        one expanded set, ✓ logs pre-filled values, tap number to type, changes carry to later pending sets,
        optional RIR / couldn't-finish row, warm-up toggle, add set/exercise, finish (drops undone sets), delete
  - [x] 2.5 Swap (logger + day editor), "Not at this gym" (logger ⋯ menu + day editor button), remove; More → gym page
  - [x] 2.6 Rest timer bar (auto-start, ±15, 1/2/3 min, skip, beep + mute, survives reload), wake lock,
        warm-up offer on first compound (bar×10, 50%×5, 70%×3, 85%×1; ≥10 lb jumps)
  - [x] 2.7 Finish → summary (time, sets, volume, PRs vs earlier sessions, est. 1RM per exercise, edit/delete),
        History list (Train → Recent workouts / See all, `/history`, `/history/:id`)
  - [ ] Owner: test 2.7 on iPhone → Phase 2 done
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
- Custom domain (≈$10/yr via Cloudflare Registrar — costs money, owner must approve)
- Final app name / branding ("Lift Log" is a placeholder)
- Friends/sharing (needs custom SMTP, e.g. Resend free tier); importing old data
