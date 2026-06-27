import { expect, test } from '@playwright/test'

const AUTH_STATE = 'e2e/.auth/user.json'

test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
  })

  test.describe('client-side validation', () => {
    test('shows required errors on empty submit', async ({ page }) => {
      await page.click('button[type="submit"]')
      const errors = page.locator('p.text-destructive')
      await expect(errors).toHaveCount(2)
      await expect(errors.first()).toContainText(/required/i)
    })

    test('shows invalid email error on bad format', async ({ page }) => {
      await page.fill('input[name="email"]', 'notanemail')
      await page.fill('input[name="password"]', 'password')
      await page.click('button[type="submit"]')
      await expect(page.locator('p.text-destructive').first()).toBeVisible()
    })

    test('shows password too short error under 8 chars', async ({ page }) => {
      await page.fill('input[name="email"]', 'test@abv.bg')
      await page.fill('input[name="password"]', 'short')
      await page.click('button[type="submit"]')
      await expect(page.locator('p.text-destructive').first()).toBeVisible()
      await expect(page).toHaveURL('/login')
    })

    test('clears field error when user starts typing', async ({ page }) => {
      await page.click('button[type="submit"]')
      await expect(page.locator('p.text-destructive')).toHaveCount(2)
      await page.fill('input[name="email"]', 'user@example.com')
      await expect(page.locator('p.text-destructive')).toHaveCount(1)
    })
  })

  test.describe('server errors', () => {
    test('shows error toast on wrong password', async ({ page }) => {
      await page.fill('input[name="email"]', 'test@abv.bg')
      await page.fill('input[name="password"]', 'wrongpassword')
      await page.click('button[type="submit"]')
      await expect(page.locator('[data-sonner-toast]')).toBeVisible({ timeout: 5000 })
      await expect(page).toHaveURL('/login')
    })

    test('shows error toast on non-existent email', async ({ page }) => {
      await page.fill('input[name="email"]', 'nobody@example.com')
      await page.fill('input[name="password"]', 'password123')
      await page.click('button[type="submit"]')
      await expect(page.locator('[data-sonner-toast]')).toBeVisible({ timeout: 5000 })
      await expect(page).toHaveURL('/login')
    })
  })

  test.describe('happy path', () => {
    test('logs in and redirects to home', async ({ page }) => {
      await page.fill('input[name="email"]', 'test@abv.bg')
      await page.fill('input[name="password"]', 'password')
      await page.click('button[type="submit"]')
      await expect(page).toHaveURL('/', { timeout: 8000 })
    })
  })

  test.describe('loading state', () => {
    test('submit button is disabled while request is in flight', async ({ page }) => {
      await page.route('**/auth/login', async (route) => {
        await new Promise((res) => setTimeout(res, 500))
        await route.continue()
      })
      await page.fill('input[name="email"]', 'test@abv.bg')
      await page.fill('input[name="password"]', 'password')
      await page.click('button[type="submit"]')
      await expect(page.locator('button[type="submit"]')).toBeDisabled()
    })
  })

  test.describe('google oauth', () => {
    test('google sign-in button is visible', async ({ page }) => {
      await expect(page.getByRole('button', { name: /google/i })).toBeVisible()
    })
  })

  test.describe('logout', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/login')
      await page.fill('input[name="email"]', 'test@abv.bg')
      await page.fill('input[name="password"]', 'password')
      await page.click('button[type="submit"]')
      await page.waitForURL((url) => !url.href.includes('/login'), { timeout: 8000 })
    })

    test('logout button redirects to home', async ({ page }) => {
      await page
        .getByRole('button', { name: /logout|изход/i })
        .first()
        .click()
      await expect(page).toHaveURL('/')
    })

    test('accessing protected route after logout redirects to login', async ({ page }) => {
      await page
        .getByRole('button', { name: /logout|изход/i })
        .first()
        .click()
      await expect(page).toHaveURL('/')
      await page.goto('/dashboard')
      await expect(page).toHaveURL('/login')
    })

    test('nav shows login and register buttons after logout', async ({ page }) => {
      await page
        .getByRole('button', { name: /logout|изход/i })
        .first()
        .click()
      await expect(page.getByRole('link', { name: /^login$|^вход$/i })).toBeVisible()
      await expect(page.getByRole('link', { name: /^register$|^регистрация$/i })).toBeVisible()
    })

    test('localStorage user key is cleared after logout', async ({ page }) => {
      await page
        .getByRole('button', { name: /logout|изход/i })
        .first()
        .click()
      await page.getByRole('link', { name: /^login$|^вход$/i }).waitFor({ timeout: 5000 })
      const stored = await page.evaluate(() => localStorage.getItem('user'))
      expect(stored).toBeNull()
    })
  })

  test.describe('i18n', () => {
    test('language toggle switches title to Bulgarian', async ({ page }) => {
      await expect(page.locator('h1')).toHaveText('Welcome back')
      await page.locator('[data-testid="lang-toggle"]').click()
      await expect(page.locator('h1')).toHaveText('Добре дошли отново')
    })
  })
})

test.describe('Authenticated redirect', () => {
  test.use({ storageState: AUTH_STATE })

  test('visiting /login while authenticated redirects to home', async ({ page }) => {
    await page.route('**/auth/refresh', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ accessToken: 'e2e-test-token' }),
      }),
    )
    await page.route('**/user/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 1,
            name: 'Test User',
            email: 'test@abv.bg',
            role: 'user',
            hasPassword: true,
            createdAt: new Date().toISOString(),
          },
        }),
      }),
    )
    await page.goto('/login')
    await expect(page).toHaveURL('/', { timeout: 8000 })
  })
})
