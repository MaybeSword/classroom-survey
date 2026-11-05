# Testing

| Layer | Command | Needs | What it proves |
|---|---|---|---|
| Unit | `npm test` | — | CSV escaping and layout, validation rules, error-code mapping, public URL |
| SQL | `npm run test:db` | Docker | Migrations apply cleanly. 30 checks cover RPC behaviour, edit locks, status rules, cascade delete, anon permissions |
| RLS (local) | `npm run rls-check:local` | Docker | `scripts/rls-check.ts` passes against Postgres + PostgREST, using an anon JWT only |
| RLS (real) | `npm run rls-check` | `.env` + seed | The same 14 checks against your Supabase project |
| E2E | `npm run test:e2e` | `npx playwright install chromium webkit` | UI flows in Chromium and an iPhone-sized WebKit, with Supabase mocked at the network level |
| Accessibility | included in E2E | — | axe WCAG 2.1 A/AA scan of 7 pages, keyboard-only submit, ≥44px touch targets, no horizontal scroll at 360px |

The E2E tests never touch a real database. They check the frontend's behaviour
for each response the backend can return. The SQL and RLS tests check the backend
itself. The production checklist below covers the gap between the two.

## RLS check (`scripts/rls-check.ts`)

The script uses **only** the anon key. It refuses to run with a service-role key.
It prints PASS or FAIL for each check:

| # | Check |
|---|---|
| 1a–1c | anon can read the active survey and its questions, but not a draft or closed survey |
| 2a–2c | anon cannot read `responses` or `answers`, or call `get_survey_results` |
| 3a–3b | anon cannot insert directly into `responses` or `answers` |
| 4a–4c | anon cannot update or delete surveys, or call `activate_survey` |
| 5 | anon can submit through `submit_survey_response` |
| 6 | a second submission with the same token gets `DUPLICATE_RESPONSE` |
| 7 | a submission to a closed survey gets `SURVEY_NOT_ACTIVE` |

### Against the real project

> The seed **activates a test survey and closes whatever survey is active**.
> Don't run it during class.

1. In Supabase **SQL Editor**, run `supabase/tests/rls_seed.sql`.
2. `npm run rls-check`. This reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from `.env`.
3. In the SQL Editor, run `supabase/tests/rls_cleanup.sql`.

Last results (2026-11-04): **14/14 PASS** locally and **14/14 PASS** against the real Supabase project. No policy changes were needed.

## Manual checks still open

- Open an exported CSV in Excel and in Google Sheets. Check that accents, commas
  and line breaks look right and that formulas don't run.
- Scan the projected QR code with at least one iPhone and one Android phone.
- Do a quick VoiceOver pass of the student page.

## Production checklist

Do these in order on the deployed site, with one laptop (instructor) and at least
one phone (student) on **mobile data**, not the laptop's Wi-Fi. That proves the
site works from outside your network.

**0. Before you start**
- [ ] Cloudflare Pages → Settings → Environment variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set for **Production**. Redeploy after any change.
- [ ] If `VITE_PUBLIC_BASE_URL` is set, it is the production `https://` URL, not localhost or a preview URL.
- [ ] Supabase Auth: public sign-ups are **off**, and the instructor user exists.
- [ ] The production site shows **no** yellow "Supabase is not configured" banner on `/login`.

**1. Routing**
- [ ] Open `https://<site>/dashboard` directly in a new tab. It redirects to `/login` with no Cloudflare 404.
- [ ] Open `https://<site>/s/zzzzzz`. It shows "Survey not found."

**2. Login**
- [ ] A wrong password shows "Incorrect email or password."
- [ ] The correct password opens the dashboard and shows your email in the header.
- [ ] Refresh the page: you stay logged in. Log out: you go back to `/login`.

**3. Create survey**
- [ ] New Survey with one multiple-choice question (3 choices) and one True/False question.
- [ ] Save with an empty title: the error appears next to the field.
- [ ] Reorder the questions, save, and reload: the order and text are kept.

**4. Activate**
- [ ] Activate it. The Present page shows a large QR code, the URL, and "Responses: 0".
- [ ] The URL under the QR code starts with your **production** domain.
- [ ] Download QR Code saves a PNG.

**5. Student submit on a phone**
- [ ] Scan the QR code. The survey opens with no login or menu.
- [ ] Tap Submit with one question unanswered: that question is highlighted.
- [ ] Answer everything and submit: "Thank you!"
- [ ] Within about 5 s the Present page shows "Responses: 1".
- [ ] Rescan or reload on the same phone: "You have already submitted a response to this survey."
- [ ] Close the survey on the laptop. On a second phone, reload: "This survey is no longer accepting responses."

**6. Results**
- [ ] Results show the right total, counts and percentages, with the numbers on each bar.
- [ ] Refresh works. Back to Dashboard works.
- [ ] Archive the survey: results are still viewable from the dashboard.

**7. CSV export**
- [ ] Export CSV downloads `<title>_<date>.csv`.
- [ ] It opens in Excel or Google Sheets with the metadata rows first, then one row per response, and the question text as column headers.

**8. Security spot check**
- [ ] In a private window (logged out), open `/surveys/<id>/results`: it redirects to login.
- [ ] Optional: run `npm run rls-check` against production using the seed (outside class time).

## If something fails

Please fill in this template:

```text
This failed: <what you did>
Expected: <what should happen>
Actual: <error text or behavior>
```

Also include the browser console output (F12 → Console) and, if possible, the
failing request from the Network tab, including its status code and response body.
