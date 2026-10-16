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
   Suggested warm-ups only for the first compound of a session, kept short (owner: 1–2 sets): 50%×8, plus 75%×3 when
   working weight ≥135 lb; one tap to add.
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
- Set pre-fill = double progression (`src/lib/progression.ts`, step 5.1) on the last 2 sessions of the exercise (any
  day): all working sets at top of range → +5 lb (+10 lb barbell lower body: barbell + leg/glute/lower-back primary
  muscle; kg: 2.5/5), reps back to bottom; under the bottom twice in a row → −10% (rounded to 5 lb); else same
  weights, +1 rep per set (capped at the top); bodyweight (0 lb) → +1 rep, no cap; warm-ups and limited sets ignored.
  Rep range = the plan row for the exercise (the started day's row first), else 6–10 compound / 10–15 isolation.
  The logger shows the range and a one-line reason; nothing is stored. Ramp-in weeks not implemented (owner is
  already training; revisit if needed). Units are lb until the settings step (WEIGHT_UNIT in `src/data/workouts.ts`).
- Plan my week (`src/lib/planner/week.ts`, step 5.3): only the day settings are stored (`week_plans` + 7
  `week_plan_days` rows: status, minutes_available, equipment_profile_id; null = no gym). The plan is recomputed from
  the active template + settings + workouts logged (a workout started that local date = done); `week_plan_exercises`
  is unused. Rules: busy days and past sessions with no workout move to free rest days (most main lifts first,
  nearest day, later on a tie); no free day → main lifts (or first 2 exercises) merge into the shortest training
  day ahead, max one merge per day; away at another gym = swaps via rankAlternatives, nothing left → "Run or
  walk"; away with no gym (or a bodyweight-only gym) = a bodyweight workout (owner request; `bodyweightSession`):
  5 everyday moves from `BODYWEIGHT_STAPLES` (src/lib/staples.ts, data) for the session's muscle groups (main lifts'
  first, round-robin), topped up with legs/core/one conditioning move, 3 × 10–20, 60 s rest, + a 15–20 min run or
  brisk walk note (log under Cardio); short = drop non-main lifts from the end, then sets (min 2).
  Time estimate = sets × (40 s + rest) + 1 min per exercise. Opening Plan my week for a week creates its rows (=
  opting in); from then the Today card follows the plan (with its notes) and starts workouts with the planned
  exercises and `week_plan_day_id`. Weeks without rows use the template as before. Day rows are never deleted
  (unique per date); "Reset" sets all back to normal.
- Gyms (step 5.4): `equipment_profiles`, one `is_default` (usual gym; drives picker/Swap); others are for Away days
  (Plan my week). More → Gyms (`/more/gyms`, presets Hotel/Home/Bodyweight/Full), editor `/more/gym/:id`, delete
  (soft) for non-default; a deleted gym on an Away day falls back to "No gym".
- Cardio (step 5.4): `cardio_entries` (Dexie v6), Today → Cardio card: one-tap "Walk" repeats your last walk
  (default 20 min / 1 mi), "Other" sheet (activity, minutes, miles optional). Distance stored in km, shown in miles.
- Settings (step 5.4): profile.settings.restTimer / askEffort (default on). "Couldn't finish" is always offered.
  kg units deliberately NOT built (owner uses lb; ~15 files show lb): see Backlog.
- PWA (step 6.1): vite-plugin-pwa 2 (generateSW). Precaches the built app (~2.3 MB incl. the barcode wasm) and
  falls back to index.html for any route, so the app opens offline; API calls are never cached by the SW (data
  lives in IndexedDB). `registerType: 'prompt'`: a new version waits for "Reload" in `UpdatePrompt` (top of the
  tab screens; checks hourly) so an update never reloads mid-workout. Placeholder icon `public/icon.svg` rendered
  to PNGs (180 apple-touch, 192, 512, maskable 512) with Playwright; real branding in the UX pass. iOS takes the
  home-screen icon/name when you "Add to Home Screen": re-add to pick up a new icon.
- CSV export (step 6.2, `src/data/export.ts`): More → Export all data → "Prepare export" builds a zip (fflate 0.8.3,
  MIT) from the phone's IndexedDB after a sync attempt: readable CSVs (workouts, sets, body, food totals, cardio,
  targets; lb, miles, local dates) + `raw/<table>.csv` for every synced table (shared exercise library and deleted
  rows left out) + README. Second tap "Save or share" uses the share sheet (iOS needs a fresh tap for it) or a
  download. CSV cells are RFC 4180 and formula-defused (`src/lib/csv.ts`).
- No black screens (owner bug 2026-10-16: home-screen app opened to a black screen, cause unknown — no WebKit here):
  index.html has a plain-JS boot watchdog (#boot-help): if #root is empty after 8 s, or ErrorBoundary / RouteError
  catch a crash, it shows the error text + user agent with Reload and "Reset app" (unregisters the service worker,
  clears caches; IndexedDB data kept). `vite:preloadError` → reload once (stale lazy chunk after an update).
- Sync: one IndexedDB per user (`liftlog-<uid>`), deleted on sign-out (after warning about unsynced changes).
  Server owns `updated_at`; pull uses keyset (updated_at, id); rows with pending local edits are never overwritten;
  server-rejected rows are marked failed (shown in More with the table and a plain-language reason; "Try again"
  re-sends them, "Discard" drops them AND the phone's copy, then re-downloads those tables) instead of blocking the
  queue. Automatic writers (TargetKeeper's daily target, ensureWeekPlan) wait for this device's first full download
  (meta `firstSyncDone`, `useFirstSyncDone`): a fresh install (e.g. re-adding the home-screen app, which gets its own
  storage) otherwise created a duplicate "today's target" → unique-key rejection (owner bug, 2026-10-16). Syncs on write (debounced),
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
  it ended <10 s ago. Web Audio mixes with music and obeys the silent switch. Confirmed working on the owner's iPhone.
- Stats (`src/lib/stats.ts`): e1RM = Epley, 1–10 reps, completed `working` sets only (warm-up and `limited`
  excluded). Volume = weight × reps of completed non-warm-up sets (limited included). PRs (e1RM, heaviest set) only
  vs workouts that started earlier; none the first time an exercise is logged. All computed, never stored.
- Progress metrics: est. 1-rep max when an exercise has sets ≤10 reps, else heaviest weight (12–15 rep work), else
  most reps (bodyweight). Sets per muscle count once per PRIMARY muscle group, warm-ups excluded. Weekly target
  marker = 10 sets. Chart color `--color-chart` #16a34a (validated with the dataviz skill for the dark surface).
  Recharts is lazy-loaded only on the lift detail page; other charts are plain HTML/SVG.
- Body trend (`src/lib/body.ts`): 7-day trailing average of readings (gaps OK); weekly rate = least-squares slope
  over the last 14 days (needs ≥4 readings spanning ≥7 days). Dates are LOCAL YYYY-MM-DD (`localDateKey`).
  One weigh-in per day: save re-uses that day's row (even soft-deleted) because of the server's unique rule.
- Food search: the app calls USDA FoodData Central and Open Food Facts directly. The USDA key is a free,
  read-only public-data key and is visible in the frontend bundle (accepted risk: only rate-limit abuse; rotate if
  needed). Logged foods are saved as the user's own `foods` rows (no shared server cache).
- Nutrition plan (`src/lib/planner/nutrition.ts`): BMR Mifflin-St Jeor; activity ×1.2/1.375/1.55/1.725/1.9; goal
  recomp −15%, cut −20%, maintain 0, strength +5%, bulk +10% (rounded to 50 kcal); protein g/lb: recomp 0.95,
  cut 1.0, maintain 0.8, strength/bulk 0.85 (rounded to 5, cap 300); fat ≥0.3 g/lb (bulk: 25% kcal); carbs = rest.
  Weight = 7-day average of weigh-ins. User nudges are OFFSETS (profile.settings.nutritionAdjust) so they survive
  recalculation. Guardrails on the total: ≥ max(sex floor 1500/1200, 75% of maintenance); fat ≥0.25 g/lb.
  Today's `nutrition_targets` row is kept equal to the plan by `TargetKeeper`; past days keep their row.
  2-week check-in (`src/lib/planner/checkIn.ts`, step 5.2): due 14 days after the goal start / last check-in;
  weight trend = least-squares rate over 14 days (≥4 weigh-ins spanning ≥7 days) as % of body weight vs the goal's
  `ratePctWeek` (recomp −0.25, cut −0.6, maintain 0, strength +0.1, bulk +0.25); within ±0.2 → on track; else ±100
  (±150 beyond 0.4); losing >1%/week → +150. Suggested on Food (today) and the plan page; applied only when the
  user taps Apply ("Keep as is" also resets the clock). Stored in profile.settings.checkIns; only entries since the
  current goal's start count; their sum is added to the nudges and guardrails apply to the total; no cut is
  suggested when already at the calorie floor. "Reset" on the plan page zeroes them.
- Profiles sync: keyed by user id (OWNER_COLUMN 'id'); server allows UPDATE only (row created at sign-up), so
  `supabaseRemote` updates instead of upserting and strips `deleted_at`. Goals: one active row, changed in place.
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
- [x] **Phase 2: workout logging** (done 2026-10-15)
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
        warm-up offer on first compound (1–2 sets: 50%×8, +75%×3 from 135 lb)
  - [x] 2.7 Finish → summary (time, sets, volume, PRs vs earlier sessions, est. 1RM per exercise, edit/delete),
        History list (Train → Recent workouts / See all, `/history`, `/history/:id`)
  - [x] Owner: rest beep confirmed on iPhone
- [x] **Phase 3: progress views and charts** (done 2026-10-15)
  - [x] 3.1 Calculations (`src/lib/progress.ts`): weeks (Sun start), sets per muscle group, weekly volume,
        per-session points, metric choice, 4-week change, PR events — unit tested
  - [x] 3.2 Progress tab (Strength | Body placeholder): this week (sets/muscle + volume vs last week), 8-week volume,
        your lifts (★ main lifts by default; muscle-group chips or tap a This-week bar to filter; sparkline, 4-wk change), recent PRs (one line per exercise, max 5)
  - [x] 3.3 Lift detail `/progress/exercise/:id` (lazy-loaded Recharts): trend line, metric chips, best-ever, sessions
  - [x] Owner: test Phase 3 on iPhone
  - [x] Warm-ups reduced to 1–2 sets (owner request); More → Testing tools (sample workouts / delete all workouts)
- [x] **Phase 4: body weight (+ body fat %, muscle mass) and food/macro tracking** (done 2026-10-16)
  - [x] Owner: approved design (direct USDA/OFF calls from the app, USDA key in frontend; no Edge Function)
  - [x] 4.1 Weigh-ins: Today card + sheet (weight / body fat % / muscle mass, each prefilled from its own latest
        value), Progress → Body (dots + 7-day avg on a real time axis, weekly rate, 30/90/all, edit list, other day);
        `body_measurements` synced (Dexie v2); testing tools add/delete sample weigh-ins
  - [x] Owner: USDA key in Cloudflare build var `VITE_USDA_API_KEY` (confirmed working)
  - [x] Search as you type (owner request): your own foods match instantly (local, offline); USDA after a 500 ms
        pause (≥3 letters; only with a real key, DEMO_KEY waits for the Search button); per-query cache.
        No error messages (owner request): silent retries (1 s, 3 s), 20 s timeout, whole-food and brand halves
        independent; only "You're offline" is shown
  - [x] 4.2 Food log: Food tab day view (‹ › days, ?d=), calorie/protein meters + carbs/fat, 4 meals, add sheet
        (Recent default · Nutrition label → own food · Quick add), edit/move/delete entry, copy yesterday (day or
        meal), Today food card; Dexie v3 food tables
  - [x] 4.2b Calculated nutrition plan (owner request; calorie part of Phase 5 pulled forward): Food → ◎ →
        `/food/plan`: details form pre-filled from owner profile, targets from Mifflin-St Jeor × activity × goal,
        "How we got here", small −/+ nudges stored as offsets in profile.settings; TargetKeeper writes today's
        `nutrition_targets` row whenever the plan changes; profiles + goals sync (Dexie v4)
  - [x] 4.2c Macro check + optional nutrients (owner request): calories auto-fill from P/C/F (4/4/9) until typed;
        save blocked when macros need >115% of the calories (+10); amber hint when far under (fiber/alcohol);
        optional fiber, sugar, sat fat, trans fat, cholesterol, sodium on label entry; day totals under the meters
  - [x] Owner: run `20261016000000_extra_nutrients.sql` in Supabase SQL Editor (inferred 2026-10-16: food entries,
        which always send the new columns, sync fine)
  - [x] 4.3 Food search tab (search on submit, not per keystroke: rate limits): USDA whole foods (Foundation, SR
        Legacy, Survey) first, then USDA branded. Open Food Facts text search dropped (owner OK'd: slow, "Load failed"
        in Safari, USDA covers US brands); OFF is kept for barcode lookups only (4.4: USDA gtinUpc first, then OFF). Parsing in
        `src/lib/foodSearch.ts` (unit tested), fetches in `src/data/foodApi.ts` (falls back to USDA DEMO_KEY).
        Picking saves your own copy (`saveFoundFood`, re-used next time). Amount in servings or grams
        (`AmountPicker`, also when editing an entry); day list shows "225 g" for gram-measured foods
  - [x] 4.4 Barcode scanning: Add food → Scan (header). Camera via getUserMedia + `barcode-detector` ponyfill
        (zxing-wasm, MIT; iOS Safari has no native BarcodeDetector). The 1.1 MB wasm (464 KB gzip) is self-hosted and
        lazy-loaded only when the scanner opens. UPC-E expanded to UPC-A; codes compared ignoring leading zeros
        (`src/lib/barcode.ts`). Lookup (`lookupBarcode`): your foods → USDA branded (exact gtinUpc match) → Open Food
        Facts product API; quiet retries. Not found → Label tab with the barcode saved on the food, so the next scan
        finds it locally. Type-the-number fallback with check-digit validation. E2E with a fake camera (.y4m)
  - [x] Owner bug (Jones chicken sausage numbers ×0.6): barcode USDA lookup now takes the NEWEST matching record and
        its label panel (`/food/{id}` labelNutrients, per serving as printed; `fromUsdaLabel`), falling back to
        per-100 g; OFF prefers `_serving` values. "Numbers don't match the package? Fix them" on every food portion
        sheet → label form prefilled; saved copies are corrected in place (`correctFood`) incl. log entries that
        still carry the old numbers; unsaved results become your own food with the barcode
  - [x] 4.5 Saved meals / recipes (`src/data/meals.ts`, maths in `src/lib/meals.ts`): a meal = foods + amounts;
        "Servings it makes" > 1 = recipe (1 serving = batch ÷ N). Logged as ONE entry (name = meal, saved_meal_id,
        per-serving snapshot incl. optional nutrients); excluded from Recent foods (listed under Saved meals instead).
        Create: "Save as meal" under a meal on the Food day (quick adds left out) or Food → 🍴 → New meal. Editor
        `/food/meals/:id`: name, servings it makes, items (amount sheet, remove), Add food = AddFoodSheet `pickOnly`
        mode (same Recent/Search/Scan/Label; same food twice merges), delete (logged days keep their entries)
- [x] **Phase 5: rules-based planner, Plan my week, equipment profiles, cardio logging** (built 2026-10-15)
  - [x] 5.1 Progression targets: double progression pre-fills each exercise; logger shows rep range + reason
        (↑ green weight increase, ↓ amber deload)
  - [x] 5.2 Biweekly calorie check-in: card on Food/plan page when due → Apply / Keep as is; Reset on plan page
  - [x] 5.3 Plan my week: Train → Plan my week (`/train/week`, this/next week), per-day Normal/Short (minutes)/
        Busy/Away (No gym or another gym profile), notes explaining every change, est. minutes; Today card follows
        the plan; `week_plans`/`week_plan_days` synced (Dexie v5)
  - [x] 5.4 Gyms (equipment profiles for Away days), cardio logging (Today card), settings (rest timer / effort toggles)
  - [x] Owner: test Phase 5 on iPhone ("all working"); test data cleared 2026-10-16
- [x] **Phase 6: PWA install, offline sync, CSV export** (built 2026-10-15)
  - [x] 6.1 Installable app + offline app shell (manifest, icons, service worker, update banner); E2E: opens
        offline incl. deep links, offline writes upload after reconnect, update banner → Reload
  - [x] 6.2 CSV export of all data (zip of readable + raw CSVs, share sheet / download)
  - [x] Owner: installed to the Home Screen (2026-10-16), working
  - [ ] Owner: test offline (Airplane Mode) + export on iPhone
- [ ] **UX pass** (after Phase 6, owner agreed): navigation/layout, look (colors, type, spacing), name + icon,
      first-run and empty states, wording. Work through "UX notes" below.
- [ ] **Phase 7 (optional): Claude API layer (weekly plan writing, stall adjustments)**

## UX notes (owner feedback for the UX pass; add as it comes in)
- (none yet)

## Backlog (not in MVP)
- kg units setting (profile.unit_system exists; replace the lb constants: WEIGHT_UNIT, UNIT in screens, body/plan screens)
- **Before sharing with anyone: remove Testing tools** and OWNER_DEFAULTS in `NutritionPlanScreen.tsx`; (`src/components/TestingTools.tsx`, `src/data/sample.ts`)
- Suggested workout times from availability blocks (e.g. busy 8am–6pm) + one-off commitments
- Google Calendar sync (adds OAuth + privacy surface)
- AI: free-text week check-in ("out of town Fri–Sun, hotel gym")
- Apple Health / Bluetooth scale sync (not possible from a PWA on iOS; needs native app, $99/yr)
- Walk/step tracking beyond manual cardio entries; reminders/notifications; supersets; plate calculator
- Custom domain (≈$10/yr via Cloudflare Registrar — costs money, owner must approve)
- Final app name / branding ("Lift Log" is a placeholder)
- Friends/sharing (needs custom SMTP, e.g. Resend free tier); importing old data
