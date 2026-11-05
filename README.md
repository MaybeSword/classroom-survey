# Classroom Survey

A small web app for quick in-class understanding checks. The instructor prepares
a survey, activates it, and projects a QR code. Students scan it and answer on
their phones with no login. Results show up as charts and can be exported to CSV.
Every response is kept for later review.

Specs: [SPEC.md](SPEC.md), [DATABASE.md](DATABASE.md), [API.md](API.md), [UI.md](UI.md).
Choices made where the specs disagreed or were silent: [DECISIONS.md](DECISIONS.md).
How to test: [TESTING.md](TESTING.md).

## Tech stack

| Part | Choice |
|---|---|
| Frontend | React 19, TypeScript, Vite 6, Tailwind CSS 4, React Router 7 |
| Charts / QR | Recharts 2, `qrcode` |
| Backend | Supabase: Postgres, Auth, auto-generated REST API, RPC functions |
| Hosting | Cloudflare Pages (static site) |
| Tests | Vitest (unit), Playwright + axe (end-to-end, accessibility), SQL tests in Docker |

There is no custom server. The browser talks to Supabase directly with the public
**anon** key. Security comes from Row Level Security and from database functions:

- Students can only call `get_public_survey` and `submit_survey_response`.
- Everything else requires a signed-in instructor.

## Project layout

```text
src/
  auth/         AuthContext (session, signIn, signOut)
  components/   PageShell, ProtectedRoute, ConfirmDialog, StatusBadge, ...
  lib/          supabase client, data access (surveys.ts), CSV, validation, errors
  pages/        Home, Login, Dashboard, SurveyEditor, Present, Results, StudentSurvey
supabase/
  migrations/   001_schema.sql, 002_functions.sql, 003_editor.sql  (run in order)
  tests/        SQL tests + fixtures for the RLS check
scripts/        test-db.sh, rls-check.ts, local/ (Docker helpers)
e2e/            Playwright tests (Supabase is mocked)
public/_redirects   SPA routing for Cloudflare Pages
```

## Local setup

Requires Node.js 22.6 or newer. Docker is optional and only needed for the database tests.

```bash
npm install
cp .env.example .env        # then fill in the values (see below)
npm run dev                 # http://localhost:5173
```

Without `.env`, the app still runs and shows a "Supabase is not configured" banner.

## Create the Supabase project

1. Go to <https://supabase.com>, create a free project, and save the database password.
2. **Project Settings → API**: copy the **Project URL** and the **anon public** key into `.env`.
   Never use the `service_role` key in this app.
3. Run the migrations **in order** in **SQL Editor → New query**: paste each file's
   contents and click Run.
   1. `supabase/migrations/001_schema.sql`: tables, indexes, triggers, RLS policies
   2. `supabase/migrations/002_functions.sql`: activate/close/submit/results RPCs
   3. `supabase/migrations/003_editor.sql`: save/duplicate RPCs, status and edit locks

   If you use the Supabase CLI instead, `supabase link` and then `supabase db push` apply the same files.

## Create the instructor user

1. **Authentication → Sign In / Providers → Email**: keep Email enabled and
   **turn off "Allow new users to sign up"**. This step is required. The
   database trusts every signed-in user (DECISIONS.md D10), so open sign-up would
   let anyone read and delete results.
2. **Authentication → Users → Add user → Create new user**: enter the
   instructor's email and a strong password, and tick **Auto Confirm User**.
3. Log in at `/login` with that account.

## Environment variables

| Name | Required | Example | Notes |
|---|---|---|---|
| `VITE_SUPABASE_URL` | yes | `https://abcd1234.supabase.co` | Project URL |
| `VITE_SUPABASE_ANON_KEY` | yes | `eyJhbGciOi...` | anon public key. It is safe in the browser because RLS protects the data. |
| `VITE_PUBLIC_BASE_URL` | no | `https://classroom-survey.pages.dev` | Base URL used in QR codes. If empty, the site's own origin is used. |

`VITE_` variables are written into the JavaScript **at build time**. After you
change one on Cloudflare, you must redeploy.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Type-check + production build to `dist/` |
| `npm run lint` / `npm run format` | ESLint / Prettier |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | Playwright tests, Chromium + mobile WebKit (first run: `npx playwright install chromium webkit`) |
| `npm run test:db` | Applies the migrations to a throwaway Postgres container and runs the SQL tests (Docker) |
| `npm run rls-check:local` | Runs the anon-key RLS check against local Postgres + PostgREST containers (Docker) |
| `npm run rls-check` | Runs the same RLS check against the real project in `.env` (see TESTING.md) |

## Deploy to Cloudflare Pages

1. Push this repository to GitHub.
2. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**,
   then pick the repository.
3. Build settings:
   - Framework preset: **None** (or Vite)
   - Build command: `npm run build`
   - Build output directory: `dist`
4. **Environment variables** (Production, and Preview if you use preview deploys):
   - `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
   - `NODE_VERSION` = `22`
   - optional: `VITE_PUBLIC_BASE_URL` = your `https://<project>.pages.dev` URL
5. Click **Save and Deploy**. `public/_redirects` (`/* /index.html 200`) is copied
   into `dist/`, so refreshing `/dashboard` or opening `/s/abc234` directly works.
6. In Supabase → **Authentication → URL Configuration**, set **Site URL** to the
   production URL.
7. Work through the production checklist in [TESTING.md](TESTING.md#production-checklist).

Preview deployments use the same Supabase project, unless you give the Preview
environment different variables.
