import { expect, test } from '@playwright/test'

test.describe('Google OAuth callback error handling', () => {
  test('shows a sign-in-failed toast and redirects to /login when the backend redirects with ?error=1', async ({
    page,
  }) => {
    await page.goto('/auth/callback?error=1')

    await expect(page.locator('[data-sonner-toast]')).toBeVisible()
    await expect(page).toHaveURL('/login')
  })
})
