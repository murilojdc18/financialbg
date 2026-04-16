import { test, expect } from '@playwright/test';
import { attachErrorCollector } from '../helpers/error-collector';
import { loginAsAdmin } from '../helpers/auth';

test.describe('6 — Print Preview', () => {
  test('should render print preview without sidebar', async ({ page }, testInfo) => {
    const collector = attachErrorCollector(page, testInfo);

    await loginAsAdmin(page);
    await page.goto('/operacoes');
    await page.waitForLoadState('networkidle');

    // Navigate to first operation
    const firstOpLink = page.locator('table tbody tr a, table tbody tr [data-testid="operation-link"]').first();
    if (await firstOpLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstOpLink.click();
      await page.waitForLoadState('networkidle');

      // Get operation URL and go to print
      const url = page.url();
      const printUrl = url + '/print';
      await page.goto(printUrl);
      await page.waitForLoadState('networkidle');

      // Sidebar should NOT be visible on print page
      const sidebar = page.locator('[data-testid="app-sidebar"]');
      await expect(sidebar).not.toBeVisible();

      // Should contain basic fields
      await expect(page.getByText(/Cliente|Principal|Parcela/i).first()).toBeVisible();
    }

    collector.assertNoPageErrors();
    await collector.attachReport();
  });
});
