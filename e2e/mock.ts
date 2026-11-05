import type { Page, Route } from '@playwright/test'

export const SUPABASE = 'http://mock-supabase.test'

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')

export function fakeSession(email = 'teacher@example.com') {
  const exp = Math.floor(Date.now() / 1000) + 3600
  const sub = '00000000-0000-4000-8000-000000000001'
  const access_token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, exp, role: 'authenticated', aud: 'authenticated', email })}.sig`
  return {
    access_token,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: exp,
    refresh_token: 'refresh',
    user: {
      id: sub,
      aud: 'authenticated',
      role: 'authenticated',
      email,
      app_metadata: {},
      user_metadata: {},
      created_at: new Date().toISOString(),
    },
  }
}

export const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

/** PostgREST-style error the way Supabase returns a RAISE EXCEPTION. */
export const rpcError = (route: Route, message: string) =>
  json(route, { code: 'P0001', message, details: null, hint: null }, 400)

/** Mock the password login endpoint. */
export async function mockLogin(page: Page, ok = true) {
  await page.route(`${SUPABASE}/auth/v1/token?grant_type=password`, (r) =>
    ok
      ? json(r, fakeSession())
      : json(
          r,
          {
            error: 'invalid_grant',
            error_description: 'Invalid login credentials',
            code: 'invalid_credentials',
            msg: 'Invalid login credentials',
          },
          400,
        ),
  )
  await page.route(`${SUPABASE}/auth/v1/logout*`, (r) => r.fulfill({ status: 204 }))
}

export async function login(page: Page) {
  await mockLogin(page)
  await page.goto('/login')
  await page.getByLabel('Email').fill('teacher@example.com')
  await page.getByLabel('Password').fill('pw')
  await page.getByRole('button', { name: 'Log In' }).click()
  await page.waitForURL('**/dashboard')
}

export const activeSurvey = {
  status: 'active',
  survey: { id: 's1', title: 'Recursion Concept Check', description: 'Quick understanding check' },
  questions: [
    {
      id: 'q1',
      question_text: 'What is required for recursion?',
      question_type: 'multiple_choice',
      position: 1,
      choices: [
        { id: 'c1', choice_text: 'A base case', position: 1 },
        { id: 'c2', choice_text: 'A pointer', position: 2 },
      ],
    },
    {
      id: 'q2',
      question_text: 'Every recursive function needs a stopping condition.',
      question_type: 'true_false',
      position: 2,
      choices: [
        { id: 't', choice_text: 'True', position: 1 },
        { id: 'f', choice_text: 'False', position: 2 },
      ],
    },
  ],
}
