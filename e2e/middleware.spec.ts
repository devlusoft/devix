import { expect, test } from '@playwright/test'

test('SSR redirects unauthenticated users from /admin to /login', async ({ page }) => {
  await page.goto('/admin')
  await expect(page).toHaveURL('/login')
})

test('SSR serves /admin when authenticated via cookie', async ({ context, page }) => {
  await context.addCookies([{ name: 'devix_session', value: '1', path: '/', domain: 'localhost' }])
  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: 'Admin' })).toBeVisible()
})

test('client navigation to /admin redirects when unauthenticated', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Admin' }).click()
  await expect(page).toHaveURL('/login')
})
