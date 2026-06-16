import { expect, test } from '@playwright/test'

test('SSR renders correct title for dashboard', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle('Dashboard - Devix Showcase')
})

test('SSR renders correct title for admin with cookie', async ({ context, page }) => {
  await context.addCookies([{ name: 'devix_session', value: '1', path: '/', domain: 'localhost' }])
  await page.goto('/admin')
  await expect(page).toHaveTitle('Admin - Devix Showcase')
})

test('client navigation updates title', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle('Dashboard - Devix Showcase')

  await page.getByRole('link', { name: 'Admin' }).click()
  await expect(page).toHaveTitle('Login - Devix Showcase')
})

test('client navigation falls back to layout title on pages without Title', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle('Dashboard - Devix Showcase')

  await page.getByRole('link', { name: 'Projects' }).click()
  await expect(page).toHaveTitle('Devix Task Manager')
})
