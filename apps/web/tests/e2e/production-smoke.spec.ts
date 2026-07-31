import { expect, test } from '@playwright/test';

test('preserves dashboard redirects and explicit degraded BFF states in production', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();

  await page.goto('/dashboard/keys/smoke-key');
  await expect(page.getByText('API key is unavailable (no-key-store).')).toBeVisible();

  await page.goto('/dashboard/audit/export');
  await page.getByRole('button', { name: 'Export' }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'Audit export unavailable: no-audit-export-store'
  );
});
