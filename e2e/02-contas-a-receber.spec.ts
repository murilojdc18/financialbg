import { test, expect } from '@playwright/test';
import { attachErrorCollector } from '../helpers/error-collector';
import { loginAsAdmin } from '../helpers/auth';

test.describe('2 — Contas a Receber', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await loginAsAdmin(page);
  });

  test('should load receivables page without errors', async ({ page }, testInfo) => {
    const collector = attachErrorCollector(page, testInfo);

    await page.goto('/contas-a-receber');
    await page.waitForLoadState('networkidle');

    // Page should have the title
    await expect(page.getByText('Contas a Receber')).toBeVisible();

    // Table or empty state should appear
    const hasTable = await page.locator('table').count() > 0;
    const hasEmpty = await page.getByText(/Nenhuma parcela/i).count() > 0;
    expect(hasTable || hasEmpty).toBe(true);

    collector.assertNoPageErrors();
    await collector.attachReport();
  });

  test('should apply client filter without breaking', async ({ page }, testInfo) => {
    const collector = attachErrorCollector(page, testInfo);

    await page.goto('/contas-a-receber');
    await page.waitForLoadState('networkidle');

    // Open client combobox
    const clientFilter = page.getByTestId('filter-client-trigger');
    if (await clientFilter.isVisible()) {
      await clientFilter.click();
      // Wait for dropdown
      await page.waitForTimeout(500);
      // Try selecting first item if exists
      const firstItem = page.locator('[cmdk-item]').first();
      if (await firstItem.isVisible()) {
        await firstItem.click();
      }
    }

    // Page should not crash
    await expect(page.getByText('Contas a Receber')).toBeVisible();

    collector.assertNoPageErrors();
    await collector.attachReport();
  });

  test('should sort by due date', async ({ page }, testInfo) => {
    const collector = attachErrorCollector(page, testInfo);

    await page.goto('/contas-a-receber');
    await page.waitForLoadState('networkidle');

    // Click "Vencimento" header to sort
    const header = page.getByText('Vencimento').first();
    if (await header.isVisible()) {
      await header.click();
      await page.waitForTimeout(300);
      await header.click(); // toggle desc
      await page.waitForTimeout(300);
    }

    // Should not crash
    await expect(page.getByText('Contas a Receber')).toBeVisible();

    collector.assertNoPageErrors();
    await collector.attachReport();
  });
});
