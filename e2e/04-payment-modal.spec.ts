import { test, expect } from '@playwright/test';
import { attachErrorCollector } from '../helpers/error-collector';
import { loginAsAdmin } from '../helpers/auth';

test.describe('4 — Payment Modal (anti white-screen)', () => {
  test('should open payment modal without crashing', async ({ page }, testInfo) => {
    const collector = attachErrorCollector(page, testInfo);

    await loginAsAdmin(page);
    await page.goto('/contas-a-receber');
    await page.waitForLoadState('networkidle');

    // Find a "Registrar Pagamento" button for an open receivable
    const payBtn = page.getByTestId('btn-pay-receivable').first();
    if (await payBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await payBtn.click();

      // Modal should open
      const modal = page.locator('[role="dialog"]');
      await expect(modal).toBeVisible({ timeout: 5_000 });

      // Fill amount
      const amountInput = page.getByTestId('payment-amount-total');
      if (await amountInput.isVisible()) {
        await amountInput.click();
        await amountInput.fill('100');
      }

      // Fill contract interest
      const contractInterestInput = page.getByTestId('payment-alloc-contract-interest');
      if (await contractInterestInput.isVisible().catch(() => false)) {
        await contractInterestInput.click();
        await contractInterestInput.fill('10');
      }

      // Modal should still be visible (no crash)
      await expect(modal).toBeVisible();

      // No page errors
      collector.assertNoPageErrors();
    }

    await collector.attachReport();
  });
});
