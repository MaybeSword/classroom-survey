import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { SUPABASE, activeSurvey, json } from './mock'

for (const path of ['/', '/login', '/s/x7kf2q']) {
  test(`no WCAG A/AA violations on ${path}`, async ({ page }) => {
    await page.route(`${SUPABASE}/rest/v1/rpc/get_public_survey`, (r) => json(r, activeSurvey))
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    expect(res.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([])
  })
}

test('student form works with the keyboard only', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test runs on desktop')
  let submitted = false
  await page.route(`${SUPABASE}/rest/v1/rpc/get_public_survey`, (r) => json(r, activeSurvey))
  await page.route(`${SUPABASE}/rest/v1/rpc/submit_survey_response`, (r) => {
    submitted = true
    return json(r, { success: true, response_id: 'r' })
  })
  await page.goto('/s/x7kf2q')
  await expect(page.getByRole('heading', { name: 'Recursion Concept Check' })).toBeVisible()
  await page.keyboard.press('Tab') // first radio group
  await page.keyboard.press('Space')
  await page.keyboard.press('Tab') // second radio group
  await page.keyboard.press('Space')
  await page.keyboard.press('Tab') // submit
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Thank you!' })).toBeVisible()
  expect(submitted).toBe(true)
})
