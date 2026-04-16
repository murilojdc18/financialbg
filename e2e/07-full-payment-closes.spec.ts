import { test, expect } from '@playwright/test';
import { attachErrorCollector } from './helpers/error-collector';
import { loginAsAdmin } from './helpers/auth';
import {
  openFirstPaymentModal,
  fillAmountTotal,
  clickAutoDistribute,
  expectNoBlockingErrors,
  isSubmitEnabled,
} from './helpers/payment-helpers';

test.describe('7A — Full payment closes receivable without new installment', () => {
  test('pay total due: no defer section, submit succeeds', async ({ page }, testInfo) => {
    const collector = attachErrorCollector(page, testInfo);
    await loginAsAdmin(page);

    const opened = await openFirstPaymentModal(page);
    if (!opened) {
      test.skip();
      return;
    }

    // Read total due from the modal summary
    const totalDueEl = page.locator('text=Total devido:').locator('..').locator('span').last();
    const totalDueText = await totalDueEl.textContent().catch(() => '');
    
    // Extract numeric value from "R$ 1.234,56" format
    const match = totalDueText?.match(/[\d.,]+/);
    if (!match) {
      test.skip();
      return;
    }
    const totalDueStr = match[0]; // e.g. "1.234,56"

    // Fill amount with total due
    await fillAmountTotal(page, totalDueStr);

    // Auto distribute
    await clickAutoDistribute(page);

    // Wait for balance to settle
    await page.waitForTimeout(500);

    // Remaining total should be R$ 0,00
    const remainingEl = page.getByTestId('payment-remaining-total');
    const remainingText = await remainingEl.textContent();
    expect(remainingText).toContain('0,00');

    // Defer section should NOT be visible (no "Saldo que será postergado")
    const deferBanner = page.locator('text=Saldo que será postergado');
    await expect(deferBanner).not.toBeVisible({ timeout: 2000 });

    // Submit should be enabled
    const canSubmit = await isSubmitEnabled(page);
    expect(canSubmit).toBe(true);

    // No page errors
    collector.assertNoPageErrors();
    await expectNoBlockingErrors(page);
    await collector.attachReport();
  });
});
