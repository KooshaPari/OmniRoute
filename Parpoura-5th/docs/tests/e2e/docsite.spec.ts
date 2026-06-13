import { test, expect } from '@playwright/test'
const BASE_URL = process.env.BASE_URL || 'http://localhost:5173'
test('homepage loads', async ({ page }) => {
  await page.goto(BASE_URL)
  await expect(page.locator('body')).toBeVisible()
})
