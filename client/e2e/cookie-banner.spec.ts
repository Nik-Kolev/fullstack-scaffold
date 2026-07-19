import { expect, test } from '@playwright/test'

const CONSENT_KEY = 'cookieConsent'

test.describe('Cookie consent banner', () => {
  test('shows on a fresh visit with no prior consent', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('cookie-banner')).toBeVisible()
  })

  test('accepting stores consent and hides the banner', async ({ page }) => {
    await page.goto('/')
    await page
      .getByTestId('cookie-banner')
      .getByRole('button', { name: /accept|приемам/i })
      .click()
    await expect(page.getByTestId('cookie-banner')).not.toBeVisible()
    const stored = await page.evaluate((key) => localStorage.getItem(key), CONSENT_KEY)
    expect(stored).toBe('accepted')
  })

  test('declining stores consent and hides the banner', async ({ page }) => {
    await page.goto('/')
    await page
      .getByTestId('cookie-banner')
      .getByRole('button', { name: /decline|отказвам/i })
      .click()
    await expect(page.getByTestId('cookie-banner')).not.toBeVisible()
    const stored = await page.evaluate((key) => localStorage.getItem(key), CONSENT_KEY)
    expect(stored).toBe('declined')
  })

  test('does not reappear once consent is already stored', async ({ page }) => {
    await page.addInitScript(
      ([key, value]) => localStorage.setItem(key, value),
      [CONSENT_KEY, 'accepted'],
    )
    await page.goto('/')
    await expect(page.getByTestId('cookie-banner')).not.toBeVisible()
  })
})
