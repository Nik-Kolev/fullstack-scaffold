import { expect, test as setup } from '@playwright/test'

setup('authenticate as test user', async ({ page }) => {
  await page.goto('/login')
  await page.fill('input[name="email"]', 'test@abv.bg')
  await page.fill('input[name="password"]', 'password')
  await page.click('button[type="submit"]')
  await page.waitForURL((url) => !url.href.includes('/login'), { timeout: 8000 })
  await page.context().storageState({ path: 'e2e/.auth/user.json' })
})
