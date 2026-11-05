import { expect, test } from '@playwright/test'
import { SUPABASE, json, login, mockLogin } from './mock'

const now = new Date().toISOString()
const surveys = [
  {
    id: 'a',
    title: 'Recursion Concept Check',
    description: null,
    status: 'draft',
    public_slug: null,
    created_at: now,
    updated_at: now,
    responses: [{ count: 0 }],
  },
  {
    id: 'b',
    title: 'Pointer Review',
    description: null,
    status: 'closed',
    public_slug: 'abc234',
    created_at: now,
    updated_at: now,
    responses: [{ count: 12 }],
  },
  {
    id: 'c',
    title: 'Loops Live',
    description: null,
    status: 'active',
    public_slug: 'zzz234',
    created_at: now,
    updated_at: now,
    responses: [{ count: 3 }],
  },
]

test.skip(({ isMobile }) => isMobile, 'instructor flows are tested on desktop')

test('wrong password shows an error', async ({ page }) => {
  await mockLogin(page, false)
  await page.goto('/login')
  await page.getByLabel('Email').fill('teacher@example.com')
  await page.getByLabel('Password').fill('bad')
  await page.getByRole('button', { name: 'Log In' }).click()
  await expect(page.getByRole('alert')).toHaveText('Incorrect email or password.')
})

test('dashboard lists surveys, filters, shows email, logs out', async ({ page }) => {
  await page.route(`${SUPABASE}/rest/v1/surveys?*`, (r) => json(r, surveys))
  await login(page)
  await expect(page.getByText('teacher@example.com')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Pointer Review' })).toBeVisible()
  await expect(page.getByText('Status: Closed')).toBeAttached()

  await page.getByLabel('Search').fill('pointer')
  await expect(page.getByRole('listitem')).toHaveCount(1)
  await page.getByLabel('Search').fill('zzz')
  await expect(page.getByText('No surveys match your search.')).toBeVisible()
  await page.getByLabel('Search').fill('')
  await page.getByLabel('Status').selectOption('active')
  await expect(page.getByRole('heading', { name: 'Loops Live' })).toBeVisible()
  await expect(page.getByRole('listitem')).toHaveCount(1)

  await page.getByRole('button', { name: 'Log out' }).click()
  await expect(page).toHaveURL(/\/login$/)
})

test('deleting a survey with responses needs the typed title', async ({ page }) => {
  await page.route(`${SUPABASE}/rest/v1/surveys?*`, (r) => json(r, surveys))
  await login(page)
  const card = page.getByRole('listitem').filter({ hasText: 'Pointer Review' })
  await card.getByRole('button', { name: 'Delete' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('12 responses')
  const confirm = dialog.getByRole('button', { name: 'Delete' })
  await expect(confirm).toBeDisabled()
  await dialog.getByLabel(/Type/).fill('Pointer Review')
  await expect(confirm).toBeEnabled()
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toBeHidden()
})

test('editor: true/false needs no choices, reorder keeps edits, validation shows near fields', async ({
  page,
}) => {
  let saved: {
    p_survey: {
      questions: {
        question_text: string
        question_type: string
        choices: { choice_text: string }[]
      }[]
    }
  } | null = null
  await page.route(`${SUPABASE}/rest/v1/rpc/save_survey`, (r) => {
    saved = r.request().postDataJSON()
    return json(r, 'new-id')
  })
  await page.route(`${SUPABASE}/rest/v1/surveys?*`, (r) => json(r, null))
  await login(page)
  await page.goto('/surveys/new')

  await page.getByRole('button', { name: 'Save Draft' }).click()
  await expect(page.getByText('Enter a survey title.')).toBeVisible()
  await expect(page.getByText('Enter the question text.')).toBeVisible()

  await page.getByLabel('Survey Title').fill('Quiz')
  await page.getByLabel('Question text').fill('First?')
  await page.getByLabel('Question 1, choice 1').fill('Yes')
  await page.getByLabel('Question 1, choice 2').fill('No')
  await page.getByRole('button', { name: '+ Add Question' }).click()
  await page.getByLabel('Question text').nth(1).fill('Second?')
  await page.getByLabel('Type').nth(1).selectOption('true_false')
  await expect(page.getByText('True and False are added automatically.')).toBeVisible()

  await page.getByRole('button', { name: 'Move question 2 up' }).click()
  await expect(page.getByLabel('Question text').first()).toHaveValue('Second?')
  await expect(page.getByLabel('Question 2, choice 1')).toHaveValue('Yes')

  await page.getByRole('button', { name: 'Save Draft' }).click()
  await expect.poll(() => saved).not.toBeNull()
  expect(saved!.p_survey.questions.map((q) => q.question_text)).toEqual(['Second?', 'First?'])
  expect(saved!.p_survey.questions[0].question_type).toBe('true_false')
  expect(saved!.p_survey.questions[1].choices).toEqual([
    { choice_text: 'Yes' },
    { choice_text: 'No' },
  ])
})

test('present page shows QR, readable URL from this origin, and count', async ({ page }) => {
  const survey = { ...surveys[2], questions: [], responses: [{ count: 3 }] }
  await page.route(`${SUPABASE}/rest/v1/surveys?*`, (r) =>
    json(r, r.request().url().includes('id=eq.c') ? survey : surveys),
  )
  await login(page)
  await page.goto('/surveys/c/present')
  await expect(page.getByRole('img', { name: /QR code/ })).toBeVisible()
  await expect(page.getByText('localhost:4174/s/zzz234')).toBeVisible()
  await expect(page.getByText('Responses: 3')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Download QR Code' })).toHaveAttribute(
    'href',
    /^data:image\/png/,
  )
})

test('results page shows counts and percentages', async ({ page }) => {
  await page.route(`${SUPABASE}/rest/v1/rpc/get_survey_results`, (r) =>
    json(r, {
      survey_id: 'b',
      title: 'Pointer Review',
      description: null,
      status: 'closed',
      public_slug: 'abc234',
      created_at: now,
      response_count: 52,
      questions: [
        {
          question_id: 'q1',
          question_text: 'What is required for recursion?',
          question_type: 'multiple_choice',
          position: 1,
          response_count: 52,
          unanswered_count: 0,
          choices: [
            {
              choice_id: 'c1',
              choice_text: 'A base case',
              position: 1,
              count: 45,
              percentage: 86.5,
            },
            { choice_id: 'c2', choice_text: 'A pointer', position: 2, count: 7, percentage: 13.5 },
          ],
        },
      ],
    }),
  )
  await login(page)
  await page.goto('/surveys/b/results')
  await expect(page.getByText('52 responses')).toBeVisible()
  await expect(page.getByRole('cell', { name: '86.5%' })).toBeVisible()
  await expect(page.getByText('45 (86.5%)')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Export CSV' })).toBeVisible()
})

test('instructor pages have no WCAG A/AA violations', async ({ page }) => {
  const AxeBuilder = (await import('@axe-core/playwright')).default
  const survey = {
    ...surveys[0],
    questions: [
      {
        id: 'q',
        question_text: 'Q?',
        question_type: 'multiple_choice',
        position: 1,
        choices: [
          { id: 'x', choice_text: 'X', position: 1 },
          { id: 'y', choice_text: 'Y', position: 2 },
        ],
      },
    ],
  }
  await page.route(`${SUPABASE}/rest/v1/surveys?*`, (r) =>
    json(r, r.request().url().includes('id=eq.') ? survey : surveys),
  )
  await page.route(`${SUPABASE}/rest/v1/rpc/get_survey_results`, (r) =>
    json(r, {
      survey_id: 'b',
      title: 'Pointer Review',
      description: null,
      status: 'closed',
      public_slug: 'abc234',
      created_at: now,
      response_count: 2,
      questions: [
        {
          question_id: 'q',
          question_text: 'Q?',
          question_type: 'true_false',
          position: 1,
          response_count: 2,
          unanswered_count: 0,
          choices: [
            { choice_id: 't', choice_text: 'True', position: 1, count: 2, percentage: 100 },
            { choice_id: 'f', choice_text: 'False', position: 2, count: 0, percentage: 0 },
          ],
        },
      ],
    }),
  )
  await login(page)
  for (const path of ['/dashboard', '/surveys/new', '/surveys/a/edit', '/surveys/b/results']) {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    expect(
      res.violations.map(
        (v) =>
          `${path} ${v.id}: ${v.help} (${v.nodes
            .map((n) => n.target.join(' '))
            .slice(0, 3)
            .join(', ')})`,
      ),
    ).toEqual([])
  }
})

test('no horizontal scrolling at phone width', async ({ page }) => {
  const survey = { ...surveys[2], questions: [], responses: [{ count: 3 }] }
  await page.route(`${SUPABASE}/rest/v1/surveys?*`, (r) =>
    json(r, r.request().url().includes('id=eq.') ? survey : surveys),
  )
  await page.setViewportSize({ width: 360, height: 740 })
  await login(page)
  for (const path of ['/dashboard', '/surveys/new', '/surveys/c/present']) {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    )
    expect(overflow, path).toBeLessThanOrEqual(0)
  }
})
