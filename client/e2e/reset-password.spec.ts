import { expect, test } from '@playwright/test'

test.describe('Reset password page — no token', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/reset-password')
  })

  test('shows invalid token message when no token in URL', async ({ page }) => {
    await expect(page.locator('p')).toContainText(/invalid|невалиден/i)
    await expect(page.getByRole('link', { name: /new link|нов линк/i })).toBeVisible()
  })

  test('get a new link button navigates to /forgot-password', async ({ page }) => {
    await page.getByRole('link', { name: /new link|нов линк/i }).click()
    await expect(page).toHaveURL('/forgot-password')
  })
})

test.describe('Reset password page — with token', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/reset-password?token=sometoken')
  })

  test.describe('client-side validation', () => {
    test('shows required errors on empty submit', async ({ page }) => {
      await page.click('button[type="submit"]')
      const errors = page.locator('p.text-destructive')
      await expect(errors).toHaveCount(2)
      await expect(errors.first()).toContainText(/required/i)
    })

    test('shows password strength error when missing a number', async ({ page }) => {
      await page.fill('input[name="newPassword"]', 'onlyletters')
      await page.fill('input[name="confirmPassword"]', 'onlyletters')
      await page.click('button[type="submit"]')
      await expect(page.locator('p.text-destructive').first()).toBeVisible()
      await expect(page).toHaveURL(/\/reset-password/)
    })

    test('shows password strength error when below minimum length', async ({ page }) => {
      await page.fill('input[name="newPassword"]', 'abc1234')
      await page.fill('input[name="confirmPassword"]', 'abc1234')
      await page.click('button[type="submit"]')
      await expect(page.locator('p.text-destructive').first()).toBeVisible()
      await expect(page).toHaveURL(/\/reset-password/)
    })

    test('shows password mismatch error', async ({ page }) => {
      await page.fill('input[name="newPassword"]', 'password123')
      await page.fill('input[name="confirmPassword"]', 'different456')
      await page.click('button[type="submit"]')
      await expect(page.locator('p.text-destructive').first()).toBeVisible()
      await expect(page).toHaveURL(/\/reset-password/)
    })

    test('clears field error when user starts typing', async ({ page }) => {
      await page.click('button[type="submit"]')
      await expect(page.locator('p.text-destructive')).toHaveCount(2)
      await page.fill('input[name="newPassword"]', 'password123')
      await expect(page.locator('p.text-destructive')).toHaveCount(1)
    })
  })

  test.describe('server errors', () => {
    test('shows error toast on invalid or expired token', async ({ page }) => {
      await page.route('**/auth/reset-password', (route) =>
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Invalid or expired reset token.' }),
        }),
      )
      await page.fill('input[name="newPassword"]', 'password123')
      await page.fill('input[name="confirmPassword"]', 'password123')
      await page.click('button[type="submit"]')
      await expect(page.locator('[data-sonner-toast]')).toBeVisible({ timeout: 5000 })
      await expect(page).toHaveURL(/\/reset-password/)
    })
  })

  test.describe('happy path', () => {
    test('redirects to home on successful reset', async ({ page }) => {
      await page.route('**/auth/reset-password', (route) => {
        expect(route.request().postDataJSON().token).toBe('sometoken')
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            accessToken: 'e2e-test-token',
            user: {
              id: 1,
              name: 'Test User',
              email: 'test@abv.bg',
              role: 'user',
              hasPassword: true,
              createdAt: new Date().toISOString(),
            },
          }),
        })
      })
      await page.fill('input[name="newPassword"]', 'password123')
      await page.fill('input[name="confirmPassword"]', 'password123')
      await page.click('button[type="submit"]')
      await expect(page).toHaveURL('/', { timeout: 8000 })
    })
  })

  test.describe('loading state', () => {
    test('submit button is disabled while request is in flight', async ({ page }) => {
      await page.route('**/auth/reset-password', async (route) => {
        await new Promise((res) => setTimeout(res, 500))
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Invalid or expired reset token.' }),
        })
      })
      await page.fill('input[name="newPassword"]', 'password123')
      await page.fill('input[name="confirmPassword"]', 'password123')
      await page.click('button[type="submit"]')
      await expect(page.locator('button[type="submit"]')).toBeDisabled()
    })
  })

  test.describe('i18n', () => {
    test('language toggle switches title to Bulgarian', async ({ page }) => {
      await expect(page.locator('h1')).toHaveText('Set a new password')
      await page.locator('[data-testid="lang-toggle"]').click()
      await expect(page.locator('h1')).toHaveText('Задай нова парола')
    })
  })
})
