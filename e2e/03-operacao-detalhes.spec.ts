import { test, expect } from '@playwright/test';
import { attachErrorCollector } from '../helpers/error-collector';
import { loginAsAdmin } from '../helpers/auth';

test.describe('3 — Operação Detalhes', () => {
  test('should load operation details page', async ({ page }, testInfo) => {
    const collector = attachErrorCollector(page, testInfo);

    await loginAsAdmin(page);
    await page.goto('/operacoes');
    await page.waitForLoadState('networkidle');

    // Click first operation link if available
    const firstOpLink = page.locator('table tbody tr a, table tbody tr [data-testid="operation-link"]').first();
    if (await firstOpLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstOpLink.click();
      await page.waitForLoadState('networkidle');

      // Should show operation details
      await expect(page).toHaveURL(/\/operacoes\/.+/);
      
      // Should have key sections
      await expect(page.getByText(/Principal|Valor/i).first()).toBeVisible();
    } else {
      // No operations — just verify page loaded
      await expect(page.getByText(/Operações|Nenhuma operação/i).first()).toBeVisible();
    }

    collector.assertNoPageErrors();
    await collector.attachReport();
  });
});
