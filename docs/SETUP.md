# Setup guide (Phase 1)

Everything here is on free tiers. No credit card needed. Dashboard menus move around occasionally; if a
label differs slightly, look for the closest match.

## 1. Supabase (database + sign-in)

1. Sign up at <https://supabase.com> with GitHub. **New project** → name `fitness-app`, a US region,
   generate a strong database password and save it in your password manager.
2. **Create the tables:** open **SQL Editor** → **New query**. Paste the whole contents of
   `supabase/migrations/20261014000000_initial_schema.sql` → **Run**. You should see "Success. No rows returned".
   - Check: **Table Editor** lists `workouts`, `sets`, `foods`, … and each shows "RLS enabled".
3. **Turn off public sign-ups** (invite-only): **Authentication → Sign In / Providers** → turn off
   **Allow new users to sign up**. Leave the **Email** provider enabled.
4. **Create your account:** **Authentication → Users → Add user → Create new user**. Enter your email and a
   password, and tick **Auto Confirm User**.
5. **Get the keys:** **Project Settings → API Keys** (or **Data API**). Copy:
   - the **Project URL** (`https://xxxx.supabase.co`)
   - the **anon / publishable** key (starts `eyJ…` or `sb_publishable_…`)

   ⚠️ Never copy the **service_role / secret** key into the app, the repo, or Cloudflare. It bypasses all
   privacy rules.

## 2. Run locally (optional, needs Node 22)

```bash
npm install
cp .env.example .env.local   # then paste the URL and anon key into .env.local
npm run dev                  # open the printed http://localhost:5173 URL and sign in
```

To try it on your phone on the same Wi-Fi: `npm run dev -- --host` and open the "Network" URL.

## 3. Cloudflare (live URL)

We use Cloudflare Workers with static assets (free; static requests are unlimited). `wrangler.jsonc` in the repo
tells Cloudflare to serve the built `dist/` folder and send unknown paths to the app.

1. Sign up at <https://dash.cloudflare.com>.
2. **Workers & Pages → Create → Import a repository**. Connect GitHub (only select `csoethout/FitnessApp`).
3. Name the project `fitness-app` (must match `"name"` in `wrangler.jsonc`).
4. Settings → **Build**:
   - **Production branch:** `claude/fitness-tracking-pwa-xd1s3z`
   - **Build command:** `npm run build`
   - **Deploy command:** `npx wrangler deploy`
   - **Variables and secrets** (build variables, because Vite bakes them in at build time):
     `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
5. Deploy. You get a URL like `https://fitness-app.<your-subdomain>.workers.dev`.
6. Back in Supabase: **Authentication → URL Configuration → Site URL** = that URL.

Every push to the production branch redeploys automatically.

## 4. Test checklist

- [ ] Open the `workers.dev` URL on your iPhone → sign-in screen (no red "not configured" box).
- [ ] Wrong password → error message. Right password → **Today** screen.
- [ ] All five tabs open. Refresh on a tab (e.g. `/food`) → still works (no 404).
- [ ] **More → Sign out** → back to sign-in.
- [ ] Optional: Safari share button → **Add to Home Screen** (full offline install comes in Phase 6).

## Developer checks

```bash
npm run lint && npm test && npm run build
npm run test:db   # needs local Postgres 15+ binaries; tests the migration + RLS on a throwaway database
```
