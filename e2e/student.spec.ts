import { expect, test } from '@playwright/test'
import { SUPABASE, activeSurvey, json, rpcError } from './mock'

test.describe('student survey', () => {
  test('requires every answer, then submits with a stored token', async ({ page }) => {
    await page.route(`${SUPABASE}/rest/v1/rpc/get_public_survey`, (r) => json(r, activeSurvey))
    let body: Record<string, unknown> | null = null
    await page.route(`${SUPABASE}/rest/v1/rpc/submit_survey_response`, (r) => {
      body = r.request().postDataJSON()
      return json(r, { success: true, response_id: 'r1' })
    })
    await page.goto('/s/x7kf2q')
    await expect(page.getByRole('heading', { name: 'Recursion Concept Check' })).toBeVisible()
    await expect(page.getByRole('navigation')).toHaveCount(0)

    await page.getByLabel('A base case').check()
    await page.getByRole('button', { name: 'Submit' }).click()
    await expect(page.getByText('Please choose an answer.')).toBeVisible()
    expect(body).toBeNull()

    await page.getByLabel('True').check()
    await page.getByRole('button', { name: 'Submit' }).click()
    await expect(page.getByRole('heading', { name: 'Thank you!' })).toBeVisible()

    const token = await page.evaluate(() => localStorage.getItem('cs_token'))
    expect(token).toBeTruthy()
    expect(body).toEqual({
      p_survey_id: 's1',
      p_anonymous_token: token,
      p_answers: [
        { question_id: 'q1', choice_id: 'c1' },
        { question_id: 'q2', choice_id: 't' },
      ],
    })

    // Reloading after submitting shows "already submitted" without the form.
    await page.reload()
    await expect(page.getByRole('heading', { name: /already submitted/ })).toBeVisible()
  })

  test('answer targets are at least 44px tall', async ({ page }) => {
    await page.route(`${SUPABASE}/rest/v1/rpc/get_public_survey`, (r) => json(r, activeSurvey))
    await page.goto('/s/x7kf2q')
    for (const name of ['A base case', 'A pointer', 'True', 'False']) {
      const box = await page.locator('label', { hasText: name }).first().boundingBox()
      expect(box!.height).toBeGreaterThanOrEqual(44)
    }
    const submit = await page.getByRole('button', { name: 'Submit' }).boundingBox()
    expect(submit!.height).toBeGreaterThanOrEqual(44)
  })

  test('server duplicate rejection shows the friendly message', async ({ page }) => {
    await page.route(`${SUPABASE}/rest/v1/rpc/get_public_survey`, (r) => json(r, activeSurvey))
    await page.route(`${SUPABASE}/rest/v1/rpc/submit_survey_response`, (r) =>
      rpcError(r, 'DUPLICATE_RESPONSE'),
    )
    await page.goto('/s/x7kf2q')
    await page.getByLabel('A pointer').check()
    await page.getByLabel('False').check()
    await page.getByRole('button', { name: 'Submit' }).click()
    await expect(
      page.getByRole('heading', { name: 'You have already submitted a response to this survey.' }),
    ).toBeVisible()
  })

  test('closing mid-survey shows the closed message', async ({ page }) => {
    await page.route(`${SUPABASE}/rest/v1/rpc/get_public_survey`, (r) => json(r, activeSurvey))
    await page.route(`${SUPABASE}/rest/v1/rpc/submit_survey_response`, (r) =>
      rpcError(r, 'SURVEY_NOT_ACTIVE'),
    )
    await page.goto('/s/x7kf2q')
    await page.getByLabel('A pointer').check()
    await page.getByLabel('False').check()
    await page.getByRole('button', { name: 'Submit' }).click()
    await expect(
      page.getByRole('heading', { name: 'This survey is no longer accepting responses.' }),
    ).toBeVisible()
  })

  test('raw database errors are never shown', async ({ page }) => {
    await page.route(`${SUPABASE}/rest/v1/rpc/get_public_survey`, (r) => json(r, activeSurvey))
    await page.route(`${SUPABASE}/rest/v1/rpc/submit_survey_response`, (r) =>
      json(
        r,
        { code: '23505', message: 'duplicate key value violates unique constraint "x"' },
        409,
      ),
    )
    await page.goto('/s/x7kf2q')
    await page.getByLabel('A pointer').check()
    await page.getByLabel('False').check()
    await page.getByRole('button', { name: 'Submit' }).click()
    await expect(page.getByRole('alert')).toHaveText('Something went wrong. Please try again.')
    await expect(page.getByText(/constraint/)).toHaveCount(0)
  })

  test('not found and closed states', async ({ page }) => {
    await page.route(`${SUPABASE}/rest/v1/rpc/get_public_survey`, async (r) => {
      const slug = r.request().postDataJSON().p_slug
      return json(r, { status: slug === 'gone22' ? 'closed' : 'not_found' })
    })
    await page.goto('/s/nope22')
    await expect(page.getByRole('heading', { name: 'Survey not found.' })).toBeVisible()
    await page.goto('/s/gone22')
    await expect(
      page.getByRole('heading', { name: 'This survey is no longer accepting responses.' }),
    ).toBeVisible()
  })

  test('network failure shows a friendly message', async ({ page }) => {
    await page.route(`${SUPABASE}/rest/v1/rpc/get_public_survey`, (r) =>
      r.abort('internetdisconnected'),
    )
    await page.goto('/s/x7kf2q')
    await expect(
      page.getByText('Could not reach the server. Check your connection and try again.'),
    ).toBeVisible()
  })
})
