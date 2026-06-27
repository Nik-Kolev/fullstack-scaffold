import { expect, test } from '@playwright/test'

const AUTH_STATE = 'e2e/.auth/user.json'

test.describe('Forgot password page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/forgot-password')
  })

  test.describe('client-side validation', () => {
    test('shows required error on empty submit', async ({ page }) => {
      await page.click('button[type="submit"]')
      const errors = page.locator('p.text-destructive')
      await expect(errors).toHaveCount(1)
      await expect(errors.first()).toContainText(/required/i)
    })

    test('shows invalid email error on bad format', async ({ page }) => {
      await page.fill('input[name="email"]', 'notanemail')
      await page.click('button[type="submit"]')
      await expect(page.locator('p.text-destructive').first()).toContainText(/email|имейл/i)
      await expect(page).toHaveURL('/forgot-password')
    })

    test('clears field error when user starts typing', async ({ page }) => {
      await page.click('button[type="submit"]')
      await expect(page.locator('p.text-destructive')).toHaveCount(1)
      await page.fill('input[name="email"]', 'user@example.com')
      await expect(page.locator('p.text-destructive')).toHaveCount(0)
    })
  })

  test.describe('happy path', () => {
    test('shows success state after valid email submit', async ({ page }) => {
      await page.fill('input[name="email"]', 'test@abv.bg')
      await page.click('button[type="submit"]')
      await expect(page.locator('h1')).toContainText(/inbox|поща/i, { timeout: 5000 })
      await expect(page.locator('p')).toContainText(/reset link|линк/i)
    })

    test('success state shows back to login button', async ({ page }) => {
      await page.fill('input[name="email"]', 'test@abv.bg')
      await page.click('button[type="submit"]')
      await expect(page.locator('h1')).toContainText(/inbox|поща/i, { timeout: 5000 })
      await expect(page.getByRole('link', { name: /back to login|вход/i })).toBeVisible()
    })

    test('back to login button navigates to /login', async ({ page }) => {
      await page.fill('input[name="email"]', 'test@abv.bg')
      await page.click('button[type="submit"]')
      await expect(page.locator('h1')).toContainText(/inbox|поща/i, { timeout: 5000 })
      await page.getByRole('link', { name: /back to login|вход/i }).click()
      await expect(page).toHaveURL('/login')
    })

    test('non-existent email also shows success state (no enumeration)', async ({ page }) => {
      await page.fill('input[name="email"]', 'nobody@example.com')
      await page.click('button[type="submit"]')
      await expect(page.locator('h1')).toContainText(/inbox|поща/i, { timeout: 5000 })
    })
  })

  test.describe('loading state', () => {
    test('submit button is disabled while request is in flight', async ({ page }) => {
      await page.route('**/auth/forgot-password', async (route) => {
        await new Promise((res) => setTimeout(res, 500))
        await route.fulfill({ status: 200, body: '{}' })
      })
      await page.fill('input[name="email"]', 'test@abv.bg')
      await page.click('button[type="submit"]')
      await expect(page.locator('button[type="submit"]')).toBeDisabled()
    })
  })

  test.describe('navigation', () => {
    test('back to login link navigates to /login', async ({ page }) => {
      await page.getByRole('link', { name: /back to login|вход/i }).click()
      await expect(page).toHaveURL('/login')
    })
  })

  test.describe('i18n', () => {
    test('language toggle switches title to Bulgarian', async ({ page }) => {
      await expect(page.locator('h1')).toHaveText('Forgot your password?')
      await page.locator('[data-testid="lang-toggle"]').click()
      await expect(page.locator('h1')).toHaveText('Забравена парола?')
    })
  })
})

test.describe('Authenticated redirect', () => {
  test.use({ storageState: AUTH_STATE })

  test('visiting /forgot-password while authenticated redirects to home', async ({ page }) => {
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
    await page.goto('/forgot-password')
    await expect(page).toHaveURL('/', { timeout: 8000 })
  })
})
