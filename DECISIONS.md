# Classroom Survey — Design Decisions

Each decision settles a gap or conflict between the five spec files (SPEC = Classroom_Survey_Web_App_Specification.md). If you disagree with one, change it here first, then in the code.

Status: proposed, 2026-11-04. No code has been written yet.

---

## D0. TODO.md checkmarks are ignored
**Decision:** Every TODO.md item is treated as not done. Each phase is "done" only when its test steps in the implementation plan pass.
**Why:** You asked for this. Also, no project code was supplied with the specs, so none of the checked items can be confirmed.

## D1. Public route is `/s/:slug`
**Conflict:** TODO.md says `/s/:surveyId`. UI.md, API.md and DATABASE.md say `/s/:slug`.
**Decision:** Use `/s/:slug` with a random slug. Never put the survey UUID in a public URL.
**Why:** Three files out of four agree. A short slug also gives a shorter QR code and a URL people can read from the projector.

## D2. Slug format and when it is made
**Decision:** The slug is 6 characters from a lowercase alphabet with no look-alike characters (`23456789abcdefghjkmnpqrstuvwxyz`). The `activate_survey` RPC creates it the first time a survey is activated. After that it never changes, so reactivating a survey keeps its old QR code.
**Conflict:** API.md lists `public_slug` as a field the client may update.
**Decision:** The client never writes `public_slug`. Only the RPC sets it.

## D3. Schema follows DATABASE.md
**Conflict:** The schema in SPEC §6 is missing `public_slug`, `updated_at` and the `created_at` columns on child tables.
**Decision:** DATABASE.md is the source of truth for the schema. Everything goes into versioned SQL migration files under `supabase/migrations/`.

## D4. True/False questions are stored as two choice rows
**Gap:** No file says how True/False questions are stored.
**Decision:** A `true_false` question has exactly two `choices` rows, "True" (position 1) and "False" (position 2). The editor creates them automatically and they cannot be edited. Results and CSV code then handle both question types the same way.

## D5. Every question is required
**Gap:** The API has a `MISSING_REQUIRED_ANSWER` error, but no table has a `required` column.
**Decision:** In the MVP, every question is required. The submit RPC rejects any submission that does not answer every question in the survey exactly once. "Unanswered" on the results page will therefore always be 0 for MVP data. The label stays in the UI for later question types.

## D6. Survey lifecycle and allowed transitions
**Gap:** No file says which status changes are allowed.
**Decision:**
| From | Allowed to |
|---|---|
| draft | active, archived, (delete) |
| active | closed |
| closed | active (reopen), archived, (delete) |
| archived | closed (unarchive), (delete) |

An active survey cannot be archived or deleted directly. It must be closed first. The activate and close RPCs enforce these rules, and so does a check in the update path.

## D7. Editing is locked once a survey has responses
**Conflict:** TODO.md allows editing a closed survey. DATABASE.md and TODO Phase 10 say historical responses must be kept. Deleting a question cascades to its answers, and deleting a choice sets `choice_id` to null, so editing would silently damage past results.
**Decision:**
- Draft surveys, and closed surveys with **0 responses**, can be fully edited.
- An active survey cannot be edited at all.
- A closed or archived survey **with responses** allows only title and description changes. The editor offers "Duplicate to edit" instead.
- This is enforced in the database: a trigger on questions and choices rejects changes when the parent survey has responses. Hiding the buttons in the UI is not enough.

## D8. The student page loads through an RPC, not direct table reads
**Conflict:** TODO and UI ask for a "Survey closed" message. But DATABASE.md's anon RLS only lets students see active surveys, so a closed survey would look identical to one that doesn't exist.
**Decision:** Add `get_public_survey(p_slug text)` (security definer). It returns:
- `{status: "not_found"}` when no survey has that slug;
- `{status: "closed"}` when the survey exists but is not active, with no question data;
- `{status: "active", survey, questions[choices[]]}` otherwise.

Anon gets **no** direct SELECT on any table. Only EXECUTE on this RPC and `submit_survey_response`.
**Why:** Students get the right message, the public surface stays minimal, and the anon key cannot be used to list surveys.

## D9. Anonymous users have no direct INSERT access
**Conflict:** DATABASE.md §9 says anon "needs INSERT access", then says the RPC is safer.
**Decision:** Anon gets no INSERT policies at all. All writes go through `submit_survey_response` (security definer, one transaction). It returns the error codes listed in API.md, raised as a Postgres exception with the code in `message`.

## D10. Instructor accounts: sign-ups disabled, allowlist enforced
**Gap (security):** DATABASE.md lets *any authenticated user* do everything. Supabase allows public email sign-up by default, so anyone who signs up could read and delete every result.
**Decision:**
1. Turn off sign-ups in Supabase Auth settings. Create the instructor account by hand in the dashboard.
2. Add an `instructors(user_id uuid primary key references auth.users)` table. Authenticated RLS policies check `exists (select 1 from instructors where user_id = auth.uid())` instead of `true`.

(2) is a second safeguard in case (1) is ever changed by mistake. Multiple instructors stay out of scope; this table is simply where that feature would start later.

## D11. Duplicate-submission protection is "soft"
**Decision:**
- The browser token is `crypto.randomUUID()`, stored in localStorage under `cs_token`.
- `anonymous_token` becomes **NOT NULL**. This changes DATABASE.md, where it is nullable, which would let a submission with no token skip the unique index.
- Keep the unique index on `(survey_id, anonymous_token)`. The RPC maps a unique-violation error to `DUPLICATE_RESPONSE`.
- localStorage also records the slugs this browser has submitted to, so it can show "already submitted" before the form appears.
**Limitation (accepted):** A student who uses private mode or clears storage can submit again. Stronger protection would require student login, which the spec lists as future work.

## D12. Activation is atomic
**Decision:** `activate_survey` locks the survey rows, closes any currently active survey, sets the slug if it is missing, and sets the target to active, all in one transaction. The partial unique index `only_one_active_survey` stays as a backstop.

## D13. Results are computed in the database
**Decision:** Add `get_survey_results(p_survey_id uuid)`, an instructor-only RPC that returns the JSON shape in API.md §11. Percentage = choice count ÷ number of responses that answered that question, rounded to 1 decimal place. A question with 0 answers shows 0% with "No responses yet", never a division by zero.

## D14. "Live" results use polling, not Realtime
**Conflict:** SPEC §3 says instructors can view "live" responses. TODO.md puts Supabase Realtime under post-MVP.
**Decision:** The Present page polls the response count every 5 s. The Results page has a manual Refresh button and auto-refreshes every 10 s while the survey is active. Realtime stays post-MVP.

## D15. CSV format
**Conflict:** API.md says the first row holds question text, but its example header is `question_1,question_2…`. TODO wants "survey metadata" in the export too.
**Decision:**
- Header row: `response_id,submitted_at,<question 1 text>,<question 2 text>,…`, with question text in the header.
- Each cell holds the chosen **choice text**, not an ID.
- Timestamps are ISO 8601 UTC.
- Metadata (title, status, exported_at, response count) goes in the **filename** (`<slug-or-title>_<YYYY-MM-DD>.csv`), not in extra rows. Extra rows would break spreadsheet import and sorting.
- Escaping follows RFC 4180: wrap in quotes, double any `"`. Cells starting with `= + - @` get a leading `'` to block formula injection.
- A UTF-8 BOM is added so Excel shows accented characters correctly.

## D16. Delete versus Archive
**Decision:** Delete is allowed (SPEC requires it). When a survey has responses, the confirm dialog shows the response count and the user must type the survey title to confirm. The dialog also offers Archive as the main button. The spec's "do not automatically delete" means only that nothing is deleted automatically.

## D17. Duplicating a survey runs in an RPC
**Decision:** `duplicate_survey(p_survey_id)` copies the survey, its questions and its choices in one transaction. The copy has title "Copy of <title>", status draft, and no slug. The UI then redirects to the editor.
**Why:** Copying from the client in several requests could leave a half-copied survey if one request failed.

## D18. Saving in the editor
**Decision:** The editor keeps the whole survey in local state. "Save Draft" sends everything to `save_survey(p_survey jsonb)`, which upserts the survey and replaces its questions and choices in one transaction. Positions are rewritten as 1..n. Reordering uses up/down buttons, which work from the keyboard. Drag-and-drop is optional later.
**Why:** It is simpler and atomic, and it matches UI.md's rule that "changes are not lost when reordering". Replacing all children is safe only because D7 forbids it once responses exist.

## D19. Validation rules
- Title: required, 1–200 characters.
- At least 1 question per survey.
- Question text: required.
- Multiple choice: 2–10 choices, each non-empty, no duplicates (ignoring case).
- A survey cannot be activated unless it passes all of these.

Rules are checked in the UI, next to the affected field, and again in `save_survey` / `activate_survey`.

## D20. Base URL for QR codes
**Decision:** The public URL is built from `VITE_PUBLIC_BASE_URL` (for example `https://<site>.pages.dev`) and falls back to `window.location.origin`. This keeps a QR code made on localhost or a preview deploy from pointing at the wrong host, which TODO Phase 15 asks to verify.

## D21. Hosting and SPA routing
**Decision:** Cloudflare Pages, with `public/_redirects` containing `/* /index.html 200`. Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_PUBLIC_BASE_URL`. The service-role key never reaches the frontend.

## D22. Testing tooling
**Decision:**
- Vitest for pure logic (CSV builder, validation, error mapping).
- SQL tests for RLS and RPCs, run against a local Supabase (`supabase start`) with pgTAP or plain SQL scripts that switch roles via `set role anon/authenticated`.
- Playwright for end-to-end flows (instructor flow, student on a mobile viewport, two browser engines).

## D23. File naming
SPEC §8 refers to `SPEC.md`. The spec file will be renamed to `SPEC.md` in the repository, and `DECISIONS.md` sits beside it.

---

# Revisions during implementation (2026-11-04)

Some of your later instructions changed decisions above. Where that happened, your instruction wins. Each change is recorded here, along with decisions made while writing the code.

## D8 (revised): anon can read the active survey directly
You asked for anon SELECT policies on active surveys, questions and choices (DATABASE.md §8), so they exist. The student page still loads through `get_public_survey(p_slug)`, so it can tell "closed" apart from "not found". Anon still cannot read draft or closed surveys, and cannot read responses or answers at all. The last part is enforced by RLS **and** by a `revoke select`.

## D10 (revised): no instructor allowlist in the database
You asked for "authenticated: full access to all tables", so the `instructors` table was **not** added. The only safeguard is turning off public sign-ups in Supabase Auth. README and TESTING mark this step as required. Add the allowlist before more than one person can create accounts.

## D11 (revised): anonymous_token stays nullable
`responses.anonymous_token` is nullable, as written in DATABASE.md. The submit RPC rejects an empty or missing token (`INVALID_REQUEST`). Since anon cannot insert directly, every real submission has a token, which gives the same protection as NOT NULL.

## D15 (revised): CSV metadata at the top of the file
You asked for metadata in the export, so the file starts with rows for Survey, Description, Status, Public slug, Created at, Exported at and Responses. Then comes one blank line, then the response table. Header cells are question text, and answer cells hold choice text. The filename is still `<title>_<date>.csv`. When importing into a spreadsheet, skip the first 8 rows to get a clean table.

## D20 (kept): QR base URL
You asked for `window.location.origin`. That is the default. `VITE_PUBLIC_BASE_URL` overrides it only when set, which is useful when a preview deploy should print production QR codes. Leave it empty in production unless you need that.

## D24: Extra error codes
Besides the five student codes in API.md, the RPCs raise these:
- `INVALID_REQUEST`: malformed token or answers payload
- `SURVEY_NOT_FOUND`
- `SURVEY_ACTIVE`: tried to edit or delete an active survey
- `SURVEY_HAS_RESPONSES`: tried to change questions after responses exist
- `SURVEY_HAS_NO_QUESTIONS`
- `VALIDATION_ERROR`
- `INVALID_STATUS_TRANSITION`
- `SLUG_GENERATION_FAILED`

All of them are mapped to friendly text in `src/lib/errors.ts`. Unknown errors show a generic message and are never shown raw.

## D25: Lifecycle and edit locks are enforced by triggers
`003_editor.sql` adds triggers that enforce D6 (allowed status changes, no deleting an active survey, slug never changes) and D7 (questions and choices are locked while active or once responses exist). These hold even if someone edits the tables directly from the dashboard.

## D26: Close vs. submit race
`submit_survey_response` takes a `FOR SHARE` lock on the survey row and `close_survey` takes `FOR UPDATE`. A submission either finishes before the close commits, or sees the survey as closed. That is what "submissions must fail immediately after closing" requires.

## D27: Results percentage denominator
Percentage = choice count ÷ answers to that question (D13). Every question is required, so in practice this equals the response count.

## D28: E2E tests mock Supabase at the network level
Playwright builds the app with a fake Supabase URL and intercepts `/auth/v1` and `/rest/v1` requests. This tests the UI without a live project. Database behaviour is covered separately by the SQL tests and the RLS check, which run in Docker.

## D29: Accessibility choices
- Native `<dialog>` for confirmations: the browser handles focus trapping and Esc.
- Status badges combine text, a symbol and color.
- Every chart has a numeric table next to it.
- Chart animation is turned off.
- All buttons and answer rows are at least 44px tall.
- The global `:focus-visible` outline is 3px.
