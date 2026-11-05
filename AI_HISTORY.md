# AI History

All prompts to Claude Code, in order, with what each produced. Dates are from the session (2026-11-04).

## Prompts

1. **Read the five spec files. Explain the architecture, list gaps and conflicts, treat TODO checkmarks as unverified, propose a phased plan with tests, and write DECISIONS.md. No code.**
   Produced: an architecture explanation, a table of 16 gaps and conflicts, a 10-phase plan with a test for each phase, and `DECISIONS.md` (D0–D23).

2. **"Start Phase 1."**
   Produced: a Vite + React + TypeScript project in a temporary session folder, with:
   - Tailwind 4, React Router 7, supabase-js, Recharts and qrcode
   - placeholder pages for every route in UI.md §1
   - `.env.example` and `public/_redirects`
   - ESLint + Prettier, Vitest and Playwright

   Lint, unit tests, build and 2 E2E tests passed.

3. **"Pick a folder."**
   The user picked `Desktop/Developer`. The AI created `Desktop/Developer/classroom-survey` and moved the session there.

4. **Phase 1 again, in the new folder.**
   Produced: flattened the copied files (they had landed in a nested folder), ran `git init`, reinstalled dependencies, and re-verified the build.

5. **`001_schema.sql`.**
   Produced:
   - the 5 tables, indexes and `updated_at` trigger
   - the one-active-survey index and the unique token index
   - RLS on every table, anon read policies for active content, and authenticated full access
   - no anon insert; anon write and read privileges on responses/answers revoked
   - comments on every section

6. **`002_functions.sql`.**
   Produced: `activate_survey`, `close_survey`, `submit_survey_response` (with all 5 error codes), `get_survey_results`, `get_public_survey`, and grants for anon and authenticated.

7. **Phase 3 (auth).**
   Produced: `AuthContext`, `ProtectedRoute`, `/login`, logout, and the email shown in the header.

8. **Phase 4 (dashboard).**
   Produced:
   - the list with title, status badge (text + symbol + color), date and response count
   - search, status filter and date filter
   - loading, empty and error states
   - Activate, Close, Archive, Unarchive, Duplicate, Delete, Edit, Present and Results actions, with confirmation dialogs
   - Delete with responses requires typing the title and offers Archive instead

9. **Phases 5 + 12 (editor, duplicate).**
   Produced: the editor page and `003_editor.sql`, which holds:
   - `save_survey` and `duplicate_survey`
   - triggers for allowed status changes and for locking questions on active surveys or surveys with responses

10. **Phase 6 (present).**
    Produced: a projector page with a large QR code, readable URL, response count polled every 5 s, PNG download, Close, Results and Full screen.

11. **Phases 7 + 8 (student page).**
    Produced: `/s/:slug` with every state (loading, not found, closed, submitting, success, already submitted), 44px+ targets, a required-answer check, the localStorage token and friendly error mapping.

12. **Phases 9–11 (results, history, CSV).**
    Produced:
    - the results page: Recharts bars labelled "count (pct%)", a numeric table, unanswered labels, Refresh / Present / Back, and 10 s auto-refresh while active
    - CSV export with metadata rows, question-text headers, one row per response, RFC 4180 escaping, formula-injection guard and a UTF-8 BOM

13. **Phase 13 (accessibility / mobile).**
    Produced: axe scans of 7 pages, a keyboard-only test, touch-target and horizontal-overflow tests, and screenshots at 375px. Fixes are listed under Bugs.

14. **TESTING.md + `scripts/rls-check.ts`.**
    Produced: a 14-check anon-only script with seed and cleanup SQL, and a Docker harness (Postgres + PostgREST + a small proxy) to run it locally. Result: 14/14 PASS, with no policy changes needed.

15. **README, `_redirects`, secrets scan, TODO update.**
    Produced:
    - `README.md`
    - confirmed that `_redirects` exists and is copied into the build
    - a secrets scan of the code: no keys found. The git history is empty, with no commits yet.
    - `TODO.md` rewritten so every box matches what was verified

16. **Production review ("deployed at <YOUR URL>").**
    The URL placeholder was not filled in, so no live site was checked. The code review found no hard-coded hosts: the only URL in `src/` is a `.invalid` placeholder used when env vars are missing. Risks found:
    - env vars are written in at build time, so changing them needs a redeploy
    - a wrong `VITE_PUBLIC_BASE_URL` would break QR codes
    - Node version on Cloudflare

    The production checklist is in `TESTING.md`.

17. **DEVELOPMENT_SUMMARY.md and this file.**

18. **Bug-report template ("This failed: <what you did>…").**
    The placeholders were not filled in, so there was no real failure to diagnose and no code was changed. The template was added to `TESTING.md` for future reports.

19. **"What else do I need before the deliverable?"**
    Produced: a list of the remaining steps (backend, deploy, checklist, writing).

20. **"Do everything I need for the deliverable for me."**
    The user approved a public GitHub repo and Supabase setup in the browser, signed in to Supabase themselves, and approved `wrangler login`. Produced:
    - the GitHub repo
    - the Supabase organization and project
    - migration `004_grants.sql`, so the app no longer depends on Supabase's "expose new tables" setting
    - all migrations run in the SQL editor
    - public sign-ups turned off and verified
    - the RLS check run against the real project: 14/14 PASS, with fixtures cleaned up afterwards
    - the Cloudflare Pages deploy and a live smoke test
    - `npm run deploy`

21. **Fetch and run Cloudflare's agent-setup instructions.**
    Ran the Claude Code steps: added the `cloudflare/skills` marketplace and installed the `cloudflare@cloudflare` plugin. The optional `cf` CLI was not installed, because the page says to ask first.

## Bugs fixed

| # | Where | Symptom | Cause | Fix |
|---|---|---|---|---|
| 1 | Project folder | After the move, the project was in `classroom-survey/classroom-survey` | Moving the session copied the parent folder | Moved the files up one level and removed the duplicate `DECISIONS.md` |
| 2 | `002_functions.sql` (before the first run) | `activate_survey` would have failed with "permission denied for function generate_public_slug" | All EXECUTE was revoked from the helper, but `activate_survey` runs as the caller | Granted EXECUTE on the helper to `authenticated` |
| 3 | `002_functions.sql` | `permission denied for schema extensions` on activate | The caller had no access to pgcrypto's schema | Made the slug helper `security definer` |
| 4 | `db_test.sql` | `column reference "position" is ambiguous` | Unqualified column in a join, in the test itself | Qualified as `c.position` |
| 5 | `db_test.sql` | The "archive closed" test always passed | Placeholder assertion `select true` | Replaced with a real status check |
| 6 | Survey editor | Hard-to-read nested ternary for locked validation, plus a no-op line | Written in a hurry | Simplified: when questions are locked, only the title error counts |
| 7 | `e2e/a11y.spec.ts` | The keyboard test failed: only the first answer was chosen | Tab was pressed before React had rendered the form | Wait for the heading before pressing keys |
| 8 | Student page | Answer-card borders were 2.6:1 contrast (WCAG needs 3:1) | `border-slate-400` | Changed to `border-slate-500` |
| 10 | Deploy | `wrangler pages project create` gave Authentication error 10000 | The `CLOUDFLARE_API_TOKEN` in the shell had no Pages permission | Logged in with `wrangler login` (OAuth) and deployed without that token |
| 9 | Buttons | Disabled ↑/↓ buttons looked almost the same as enabled ones | Only `opacity-60` | Disabled buttons now get a grey border and text (grey background on filled buttons), plus a not-allowed cursor |

Environment note: Docker Desktop was not running the first time the SQL tests ran. The AI started it, then the tests ran.
