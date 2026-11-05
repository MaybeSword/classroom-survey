# Classroom Survey Web App — TODO

## Purpose

This roadmap breaks the implementation into small, testable phases ordered from foundational work to advanced features.

**How boxes are checked (updated 2026-11-04).** A box is checked only if the code exists in this repo **and** a test or check actually exercised it. Notes in *italics* say how each item was verified:

- *SQL tests*: `npm run test:db`, with migrations applied to a throwaway Postgres container.
- *RLS check*: `npm run rls-check:local`, which runs the anon-key script against Postgres + PostgREST containers.
- *E2E*: `npm run test:e2e`, Playwright in Chromium and mobile WebKit against a **mocked** Supabase.
- *Unit*: `npm test`.

The real Supabase project has been set up and RLS-checked. The deployed site has not been tested yet, so those items are left unchecked.

---

# Phase 1 — Project Setup

- [x] Create a new React + TypeScript project with Vite.
- [x] Add Tailwind CSS.
- [x] Add React Router.
- [x] Add Supabase JavaScript client.
- [x] Add Recharts.
- [x] Add QR code generation package.
- [x] Create the initial project folder structure.
- [x] Add `.env.example` with Supabase environment variable names.
- [x] Configure ESLint and formatting.
- [x] Create a basic home page.
- [x] Verify the project builds successfully. *`npm run build`*

---

# Phase 2 — Supabase Project and Database

- [x] Create a Supabase project. *`classroom-survey`, us-east-1, Free plan; migrations 001–004 applied 2026-11-04*
- [x] Create the `surveys` table.
- [x] Create the `questions` table.
- [x] Create the `choices` table.
- [x] Create the `responses` table.
- [x] Create the `answers` table.
- [x] Add foreign-key constraints.
- [x] Add database indexes.
- [x] Add timestamps.
- [x] Add survey-status validation. *Check constraint, plus a transition trigger in 003.*
- [x] Create Row Level Security policies.
- [x] Verify students cannot read survey results. *RLS check 2a–2c (local only)*
- [x] Verify anonymous students can read active surveys. *RLS check 1a–1c (local only)*
- [x] Verify anonymous students can submit responses. *RLS check 5 (local only)*
- [x] Verify authenticated instructors have full access. *SQL tests run as `authenticated` (local only)*
- [x] Re-run `npm run rls-check` against the real Supabase project. *14/14 PASS on 2026-11-04; fixtures cleaned up afterwards*

---

# Phase 3 — Instructor Authentication

- [x] Create the instructor login page.
- [x] Connect login to Supabase Auth. *E2E with mocked Auth. Not yet tried with a real account.*
- [x] Add logout.
- [x] Create an authentication context/provider.
- [x] Create a protected-route component.
- [x] Redirect unauthenticated users to login. *E2E*
- [x] Show the logged-in instructor in the dashboard. *E2E*

---

# Phase 4 — Instructor Dashboard

- [x] Create the dashboard layout.
- [x] Load surveys from Supabase.
- [x] Display survey title, status, and creation date.
- [x] Add status badges for Draft, Active, Closed, and Archived. *Text + symbol + color*
- [x] Add a New Survey button.
- [x] Add Edit action.
- [x] Add Duplicate action.
- [x] Add Delete action.
- [x] Add Archive action.
- [x] Add View Results action.
- [x] Add Activate action.
- [x] Add Close action.
- [x] Add search by survey title. *E2E*
- [x] Add filtering by status. *E2E*

---

# Phase 5 — Survey Editor

- [x] Create a survey editor page.
- [x] Add survey title field.
- [x] Add optional description field.
- [x] Add questions dynamically.
- [x] Support Multiple Choice questions.
- [x] Support True / False questions. *SQL test: True/False rows created automatically*
- [x] Add answer choices dynamically.
- [x] Reorder questions. *E2E: reorder keeps edits*
- [x] Reorder choices.
- [x] Delete questions.
- [x] Delete choices.
- [x] Validate required fields. *Unit + E2E + SQL*
- [x] Save a survey as Draft.
- [x] Load an existing survey for editing.
- [x] Prevent editing an active survey unless it is first closed. *UI + DB trigger (SQL test)*

---

# Phase 6 — Survey Activation

- [x] Add activation logic. *`activate_survey` RPC*
- [x] Ensure at most one survey is Active. *Partial unique index + RPC (SQL test)*
- [x] Automatically close the previously active survey. *SQL test*
- [x] Generate a public survey slug or identifier.
- [x] Generate the public survey URL.
- [x] Generate a QR code from the public URL. *E2E*
- [x] Create a Present Survey page.
- [x] Display survey title and QR code.
- [x] Display a readable fallback URL.
- [x] Add a Close Survey button.
- [x] Add a Download QR Code button.
- [x] Scan the QR code with a real phone. *Manual*

---

# Phase 7 — Student Survey Page

- [x] Create the public route `/s/:slug`. *(was `/s/:surveyId`; see DECISIONS.md D1)*
- [x] Load the requested active survey.
- [x] Show an error if the survey does not exist. *E2E*
- [x] Show a message if the survey is closed. *E2E*
- [x] Render survey title and description.
- [x] Render Multiple Choice questions.
- [x] Render True / False questions.
- [x] Validate required answers. *E2E + SQL*
- [x] Add Submit button.
- [x] Store response and answers in Supabase. *Through the RPC (SQL test)*
- [x] Show a submission confirmation page.
- [x] Make the entire experience mobile friendly. *E2E on iPhone 13 WebKit profile, 44px targets*

---

# Phase 8 — Duplicate Submission Protection

- [x] Generate an anonymous browser token.
- [x] Store the token in local storage. *E2E*
- [x] Save the token with each response.
- [x] Prevent the same token from submitting twice to the same survey. *SQL test + RLS check 6*
- [x] Show a friendly message if a duplicate submission is attempted. *E2E*
- [x] Add a database uniqueness constraint if appropriate.

---

# Phase 9 — Results Dashboard

- [x] Create a results page for each survey.
- [x] Show total response count.
- [x] Aggregate answers by question. *`get_survey_results` (SQL test)*
- [x] Show counts for each choice.
- [x] Show percentages for each choice.
- [x] Add bar charts using Recharts. *Labels show count and %*
- [x] Clearly label unanswered questions.
- [x] Add Refresh Results button.
- [x] Add link back to the main dashboard.

---

# Phase 10 — Historical Results

- [x] Allow viewing results for Closed surveys.
- [x] Allow viewing results for Archived surveys.
- [x] Add filtering by date. *Dashboard "Created from / to"*
- [x] Add filtering by survey title.
- [x] Preserve all historical response data. *Questions locked once responses exist (SQL test)*

---

# Phase 11 — CSV Export

- [x] Add Export CSV button.
- [x] Export survey metadata. *Rows at the top of the file*
- [x] Export one row per response. *Unit*
- [x] Include submission timestamp.
- [x] Include each question and answer.
- [x] Create safe CSV escaping. *Unit: commas, quotes, newlines, formulas*
- [ ] Test export with spreadsheet applications. *Manual: Excel and Google Sheets*

---

# Phase 12 — Survey Duplication

- [x] Duplicate survey title and description.
- [x] Duplicate questions.
- [x] Duplicate answer choices.
- [x] Create the copy in Draft state.
- [x] Add "Copy of ..." naming.
- [x] Redirect to the editor after duplication.
*All of Phase 12 verified by the SQL test.*

---

# Phase 13 — UI Polish

- [x] Add consistent page layouts.
- [x] Improve mobile responsiveness. *E2E: no horizontal scroll at 360px*
- [x] Add loading states.
- [x] Add empty states.
- [x] Add error messages.
- [x] Add confirmation dialogs for destructive actions.
- [x] Improve QR-code presentation for classroom projection.
- [x] Test accessibility and keyboard navigation. *axe WCAG 2.1 AA scan on 7 pages + keyboard-only submit test*
- [x] Improve color contrast.
- [ ] Manual screen-reader pass (VoiceOver).

---

# Phase 14 — Testing

Automated items below use a mocked Supabase. Repeat each one against the real project before checking off "production".

- [x] Test instructor login. *E2E (mocked)*
- [x] Test survey creation. *E2E + SQL*
- [x] Test survey editing. *E2E + SQL*
- [x] Test activation. *SQL*
- [x] Test closing surveys. *SQL*
- [x] Test QR-code links. *Manual, with a phone*
- [x] Test student submissions. *E2E + SQL + RLS check*
- [x] Test duplicate-submission prevention. *E2E + SQL + RLS check*
- [x] Test results calculations. *SQL*
- [x] Test CSV export. *Unit (CSV builder only; download not tested in a browser)*
- [x] Test mobile layout. *E2E*
- [x] Test with at least two browsers. *Chromium + WebKit*
- [x] Test unauthorized access attempts. *E2E redirects + RLS check*
- [x] Test database Row Level Security. *RLS check (local only)*

---

# Phase 15 — Deployment

- [x] Push the project to GitHub. *https://github.com/MaybeSword/classroom-survey (public)*
- [x] Create the Cloudflare Pages site. *`classroom-survey` → https://classroom-survey-dte.pages.dev*
- [ ] Connect Cloudflare Pages to the GitHub repository. *Optional: the site is deployed by direct upload (`npm run deploy`)*
- [x] Configure production environment variables. *Built into the upload from the local `.env`*
- [x] Deploy the application. *2026-11-04*
- [x] Configure SPA routing. *`public/_redirects`; checked live: `/s/zzzzzz` and `/dashboard` load directly*
- [x] Turn off public sign-ups in Supabase Auth. *Verified: the sign-up API returns `signup_disabled`*
- [x] Create the instructor user (Authentication → Users → Add user).
- [x] Verify production login. *Manual, by the instructor*
- [x] Verify QR codes point to the production URL. *Manual*
- [x] Test student submissions in production. *Manual, on a phone*
- [x] Test instructor results in production. *Manual*

---

# Phase 16 — Post-MVP Enhancements

- [ ] Add live updating results with Supabase Realtime. *(Polling is used now; see D14.)*
- [ ] Add question bank.
- [ ] Add survey import/export as JSON.
- [ ] Add Markdown import.
- [ ] Add short-answer questions.
- [ ] Add checkbox questions.
- [ ] Add rating-scale questions.
- [ ] Add numeric questions.
- [ ] Add AI-assisted question generation.
- [ ] Add LMS integration.
- [ ] Add multiple instructors.
- [ ] Add course and semester organization.
- [ ] Add analytics across multiple surveys.
