# Development Summary: Classroom Survey

I built Classroom Survey so an instructor can check whether students understood a topic during class, without anyone installing an app or making an account. The instructor projects a QR code, students answer on their phones in under a minute, and the results appear right away and are kept for later.

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

I didn't accept every decision as first proposed. In my later prompts I changed three of them:
- I asked for direct anon read policies on active surveys, matching `DATABASE.md`, instead of RPC-only access.
- I kept "authenticated users get full access" instead of adding an instructor allowlist table, and turned off public sign-ups to make that safe.
- I wanted the survey metadata inside the CSV file rather than only in the filename.

Each change is recorded under "Revisions" in `DECISIONS.md`. I agreed with the decisions that fixed real conflicts in the specs: using `/s/:slug` everywhere, sending student submissions through one database function, and locking a survey's questions once it has responses so old results can't be broken. I checked the decisions by running the tests and by testing the deployed app myself on my phone.

## Which parts the AI generated

The AI (Claude Code) wrote:
- **Database:** the SQL in `supabase/migrations/` (4 files), the SQL tests, and the RLS seed and cleanup scripts.
- **Frontend:** all React/TypeScript code in `src/`, covering 8 pages, shared components, and data access.
- **Tests:** unit tests (Vitest), Playwright end-to-end and accessibility tests, and `scripts/rls-check.ts`.
- **Docs:** `README.md`, `TESTING.md`, `DECISIONS.md`, this summary, and `AI_HISTORY.md`. It also rewrote `TODO.md` so its boxes match what was actually verified.

The spec files themselves were written before this session.

I didn't edit the code by hand. My work was writing the specs, directing each phase with prompts, choosing between options when the AI asked (repo visibility, how to give it Cloudflare access), and doing the steps that needed me:
- signing in to Supabase and approving the Cloudflare login
- creating the instructor account with my own password
- running the production test with my phone

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

My manual test of the live site found no problems. Logging in, creating and activating a survey, scanning the QR code, submitting from my phone, viewing results and exporting the CSV all worked.

## How I deployed

The app is set up for Cloudflare Pages:
- build command `npm run build`, output folder `dist`
- environment variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and `NODE_VERSION=22`
- `public/_redirects` handles SPA routing

The steps are in `README.md`. The checklist to run afterwards is in `TESTING.md`.

Actual deployment (2026-11-04):
- **Code:** public GitHub repo https://github.com/MaybeSword/classroom-survey
- **Database:** Supabase project `classroom-survey` (us-east-1, Free plan), set up by running the four migration files in the SQL editor. Public sign-ups were turned off, and the anon-key RLS check passed 14/14 against it.
- **Site:** Cloudflare Pages project `classroom-survey`, live at https://classroom-survey-dte.pages.dev. It was deployed by direct upload with Wrangler (`npm run deploy`), not through the GitHub connection.
- **One snag:** the first deploy failed with a Cloudflare "Authentication error", because the API token in my shell had no Pages permission. Logging in with `wrangler login` fixed it.

After deploying, I created my instructor account in Supabase (Authentication → Users) and ran the production checklist from `TESTING.md` with my phone, and everything worked. Because the site was uploaded straight from my computer instead of being linked to GitHub, pushing code doesn't update the live site. I have to run `npm run deploy` after each change.

## What I learned

Writing the specs first paid off. Five short Markdown files were enough to build the whole app phase by phase. But reading them closely showed they disagreed with each other, for example `/s/:surveyId` vs `/s/:slug`, and that some of the rules would have made a feature impossible. Fixing those conflicts on paper in `DECISIONS.md` was much cheaper than finding them in the code later.

I learned what Row Level Security does. The anon key is public by design, because it is inside the JavaScript every visitor downloads. So the database itself has to decide what each role may see or change. Students can read only the active survey, and they can't read anyone's answers. Submissions go through `submit_survey_response` instead of direct inserts because one function can check everything in a single transaction: the survey is open, every answer belongs to it, every question is answered, and the browser hasn't already submitted. A direct insert can't enforce all of that.

I also learned that different tests prove different things. The Playwright tests check the interface using a fake backend. The SQL tests and the RLS check prove the real database rules. Only my own test on the live site with a phone proved the whole system works together. The RLS check run against the real project gave me confidence that students can't see or change results.

Finally, working with an AI was fast, but I still had to check its output. The tests caught bugs early, such as a missing database permission, a test that always passed, and low-contrast borders. I made the decisions about security trade-offs and checked the final result myself.
