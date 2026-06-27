import { expect, test } from '@playwright/test'

const AUTH_STATE = 'e2e/.auth/user.json'

test.describe('Register page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register')
  })

  test.describe('client-side validation', () => {
    test('shows required errors on empty submit', async ({ page }) => {
      await page.click('button[type="submit"]')
      const errors = page.locator('p.text-destructive')
      await expect(errors).toHaveCount(4)
      await expect(errors.first()).toContainText(/required/i)
    })

    test('shows invalid email error on bad format', async ({ page }) => {
      await page.fill('input[name="name"]', 'Test User')
      await page.fill('input[name="email"]', 'notanemail')
      await page.fill('input[name="password"]', 'password123')
      await page.fill('input[name="confirmPassword"]', 'password123')
      await page.click('button[type="submit"]')
      await expect(page.locator('p.text-destructive').first()).toBeVisible()
    })

    test('shows password too short error under 8 chars', async ({ page }) => {
      await page.fill('input[name="name"]', 'Test User')
      await page.fill('input[name="email"]', 'test@example.com')
      await page.fill('input[name="password"]', 'short')
      await page.fill('input[name="confirmPassword"]', 'short')
      await page.click('button[type="submit"]')
      await expect(page.locator('p.text-destructive').first()).toBeVisible()
      await expect(page).toHaveURL('/register')
    })

    test('shows password mismatch error', async ({ page }) => {
      await page.fill('input[name="name"]', 'Test User')
      await page.fill('input[name="email"]', 'test@example.com')
      await page.fill('input[name="password"]', 'password123')
      await page.fill('input[name="confirmPassword"]', 'different456')
      await page.click('button[type="submit"]')
      await expect(page.locator('p.text-destructive').first()).toBeVisible()
      await expect(page).toHaveURL('/register')
    })

    test('clears field error when user starts typing', async ({ page }) => {
      await page.click('button[type="submit"]')
      await expect(page.locator('p.text-destructive')).toHaveCount(4)
      await page.fill('input[name="name"]', 'Test User')
      await expect(page.locator('p.text-destructive')).toHaveCount(3)
    })
  })

  test.describe('server errors', () => {
    test('shows error toast on duplicate email', async ({ page }) => {
      await page.fill('input[name="name"]', 'Test User')
      await page.fill('input[name="email"]', 'test@abv.bg')
      await page.fill('input[name="password"]', 'password123')
      await page.fill('input[name="confirmPassword"]', 'password123')
      await page.click('button[type="submit"]')
      await expect(page.locator('[data-sonner-toast]')).toBeVisible({ timeout: 5000 })
      await expect(page).toHaveURL('/register')
    })
  })

  test.describe('happy path', () => {
    test('registers and redirects to home', async ({ page }) => {
      const email = `register-e2e-${Date.now()}@example.com`
      await page.fill('input[name="name"]', 'E2E Test User')
      await page.fill('input[name="email"]', email)
      await page.fill('input[name="password"]', 'password123')
      await page.fill('input[name="confirmPassword"]', 'password123')
      await page.click('button[type="submit"]')
      await expect(page).toHaveURL('/', { timeout: 8000 })
    })
  })

  test.describe('loading state', () => {
    test('submit button is disabled while request is in flight', async ({ page }) => {
      await page.route('**/auth/register', async (route) => {
        await new Promise((res) => setTimeout(res, 500))
        await route.continue()
      })
      const email = `register-e2e-loading-${Date.now()}@example.com`
      await page.fill('input[name="name"]', 'E2E Test User')
      await page.fill('input[name="email"]', email)
      await page.fill('input[name="password"]', 'password123')
      await page.fill('input[name="confirmPassword"]', 'password123')
      await page.click('button[type="submit"]')
      await expect(page.locator('button[type="submit"]')).toBeDisabled()
    })
  })

  test.describe('logout', () => {
    test.beforeEach(async ({ page }) => {
      const email = `register-logout-${Date.now()}@example.com`
      await page.fill('input[name="name"]', 'Logout Test User')
      await page.fill('input[name="email"]', email)
      await page.fill('input[name="password"]', 'password123')
      await page.fill('input[name="confirmPassword"]', 'password123')
      await page.click('button[type="submit"]')
      await page.waitForURL((url) => !url.href.includes('/register'), { timeout: 8000 })
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

  test.describe('google oauth', () => {
    test('google sign-in button is visible', async ({ page }) => {
      await expect(page.getByRole('button', { name: /google/i })).toBeVisible()
    })
  })

  test.describe('i18n', () => {
    test('language toggle switches title to Bulgarian', async ({ page }) => {
      await expect(page.locator('h1')).toHaveText('Create an account')
      await page.locator('header button').first().click()
      await expect(page.locator('h1')).toHaveText('Създайте акаунт')
    })
  })
})

test.describe('Authenticated redirect', () => {
  test.use({ storageState: AUTH_STATE })

  test('visiting /register while authenticated redirects to home', async ({ page }) => {
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
    await page.goto('/register')
    await expect(page).toHaveURL('/', { timeout: 8000 })
  })
})
