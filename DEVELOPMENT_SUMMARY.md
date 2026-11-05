# Development Summary: Classroom Survey

[TODO: one or two sentences in your own words about why you built this and who it is for.]

## How I used the spec files

The project started from five Markdown files:
- `SPEC.md`: originally `Classroom_Survey_Web_App_Specification.md`
- `TODO.md`
- `DATABASE.md`
- `API.md`
- `UI.md`

Before any code was written, the AI read all five files. It explained the architecture and listed where the files disagreed or left things undefined. Examples:
- `TODO.md` used `/s/:surveyId`, while the other files used `/s/:slug`.
- The anon RLS policies would hide closed surveys, so a "survey closed" message could never be shown.
- No file defined how True/False questions are stored.

Each gap got a numbered decision in `DECISIONS.md` (D0–D29). For example, D1 is "use `/s/:slug`" and D4 is "True/False = two fixed choice rows". All checkmarks already in `TODO.md` were treated as unverified (D0). I then asked for the work phase by phase, following `TODO.md`. Where a later request of mine changed an earlier decision, it is recorded under "Revisions" in `DECISIONS.md`. Examples: anon read policies, no instructor allowlist, CSV metadata at the top.

[TODO: say how you checked or edited the AI's decisions, and which ones you agreed or disagreed with.]

## Which parts the AI generated

The AI (Claude Code) wrote:
- **Database:** the SQL in `supabase/migrations/` (3 files), the SQL tests, and the RLS seed and cleanup scripts.
- **Frontend:** all React/TypeScript code in `src/`, covering 8 pages, shared components, and data access.
- **Tests:** unit tests (Vitest), Playwright end-to-end and accessibility tests, and `scripts/rls-check.ts`.
- **Docs:** `README.md`, `TESTING.md`, `DECISIONS.md`, this summary, and `AI_HISTORY.md`. It also rewrote `TODO.md` so its boxes match what was actually verified.

The spec files themselves were written before this session.

[TODO: list anything you wrote or changed by hand.]

## How the database is configured

Supabase Postgres with five tables, as in `DATABASE.md`:
- `surveys` → `questions` → `choices` hold the survey content.
- `surveys` → `responses` → `answers` hold the submissions.

Deleting a survey cascades to everything under it. Indexes:
- A partial unique index allows only one `active` survey at a time.
- A unique index on `(survey_id, anonymous_token)` blocks repeat submissions.

Row Level Security is on for every table:
- **anon** (students) can only `SELECT` the active survey, its questions and its choices. Table privileges to read responses or answers, or to write anything, are revoked.
- **authenticated** (instructor) has full access.

Logic that must be atomic or trusted lives in Postgres functions:
- `activate_survey`, `close_survey`
- `get_public_survey`, `submit_survey_response`
- `get_survey_results`
- `save_survey`, `duplicate_survey`

Triggers enforce the allowed status changes and lock a survey's questions once it is active or has responses, which protects historical results. Public sign-up must be turned off in Supabase Auth, because every signed-in user is trusted.

## How the frontend talks to the database

The React app uses `@supabase/supabase-js` with the public anon key. There is no server of our own.
- `src/lib/supabase.ts` creates the client.
- `src/lib/surveys.ts` wraps every query and RPC.
- `src/auth/AuthContext.tsx` handles login with `signInWithPassword` and listens to `onAuthStateChange`. `ProtectedRoute` sends signed-out visitors to `/login`.
- Students call only two RPCs: `get_public_survey(slug)` and `submit_survey_response(survey_id, token, answers)`. The token is a random UUID stored in `localStorage`.
- Database errors arrive as codes such as `DUPLICATE_RESPONSE`. `src/lib/errors.ts` turns them into friendly messages, so raw database text is never shown.
- CSV export runs entirely in the browser.

## One problem and how we fixed it

When the SQL tests first ran in a Postgres container, activating a survey failed with `permission denied for schema extensions`.
- **Cause:** `activate_survey` runs with the caller's permissions, so that RLS applies. It calls a helper that makes random slugs with `gen_random_bytes` from the `pgcrypto` extension, and the instructor role had no access to the `extensions` schema.
- **Fix:** the slug helper became `security definer`, so it runs with the owner's rights while the caller still needs only `EXECUTE` on it.
- **Check:** the SQL test suite and the 14-check RLS script were re-run, and all passed.

The tests caught this before anything was deployed.

[TODO: if you hit a problem during deployment or manual testing, describe it here instead or as well.]

## How I deployed

The app is set up for Cloudflare Pages:
- build command `npm run build`, output folder `dist`
- environment variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and `NODE_VERSION=22`
- `public/_redirects` handles SPA routing

The steps are in `README.md`. The checklist to run afterwards is in `TESTING.md`.

[TODO: describe your actual deployment: the GitHub repo, the Cloudflare project name and URL, the date, and anything that went differently from the README. At the time of writing, the app had not been deployed and the repo had no commits.]

## What I learned

[TODO: in your own words. Ideas to reflect on:
- writing specs before code;
- why student submissions go through a database function instead of direct inserts;
- what Row Level Security does;
- testing the frontend with a mocked backend vs. testing the database for real;
- how much of the AI's output you needed to check.]
