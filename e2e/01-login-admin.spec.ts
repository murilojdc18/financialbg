import { test, expect } from '@playwright/test';
import { attachErrorCollector } from '../helpers/error-collector';
import { loginAsAdmin } from '../helpers/auth';

test.describe('1 — Login ADMIN', () => {
  test('should login and redirect to admin area', async ({ page }, testInfo) => {
    const collector = attachErrorCollector(page, testInfo);

    await loginAsAdmin(page);

    // Should land on an admin route (operacoes, dashboard, etc.)
    await expect(page).toHaveURL(/\/(operacoes|dashboard|contas-a-receber|clientes)/, { timeout: 15_000 });

    // Sidebar should be visible
    await expect(page.locator('[data-testid="app-sidebar"]')).toBeVisible();

    collector.assertNoPageErrors();
    await collector.attachReport();
  });
});
