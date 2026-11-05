import { expect, test } from '@playwright/test'

test('home page links to login', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Classroom Survey' })).toBeVisible()
  await page.getByRole('link', { name: 'Instructor Login' }).click()
  await expect(page).toHaveURL(/\/login$/)
})

test('instructor pages redirect to /login when signed out', async ({ page }) => {
  for (const path of [
    '/dashboard',
    '/surveys/new',
    '/surveys/abc/edit',
    '/surveys/abc/present',
    '/surveys/abc/results',
  ]) {
    await page.goto(path)
    await expect(page).toHaveURL(/\/login$/)
  }
})

test('unknown paths show not found', async ({ page }) => {
  await page.goto('/nope/nope')
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
})
