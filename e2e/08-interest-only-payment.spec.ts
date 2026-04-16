import { test, expect } from '@playwright/test';
import { attachErrorCollector } from './helpers/error-collector';
import { loginAsAdmin } from './helpers/auth';
import {
  openFirstPaymentModal,
  fillAmountTotal,
  expectNoBlockingErrors,
  isSubmitEnabled,
} from './helpers/payment-helpers';

test.describe('7B — Interest-only payment does not crash', () => {
  test('allocate 100% to contract interest: modal stays functional', async ({ page }, testInfo) => {
    const collector = attachErrorCollector(page, testInfo);
    await loginAsAdmin(page);

    const opened = await openFirstPaymentModal(page);
    if (!opened) {
      test.skip();
      return;
    }

    // Read contract interest from summary
    const contractInterestRow = page.locator('text=Juros da operação (contratual):').locator('..').locator('span').last();
    const ciText = await contractInterestRow.textContent().catch(() => '');
    const ciMatch = ciText?.match(/[\d.,]+/);
    
    if (!ciMatch || ciMatch[0] === '0,00') {
      // No contract interest — skip
      test.skip();
      return;
    }

    const ciValue = ciMatch[0];

    // Fill amount = contract interest value
    await fillAmountTotal(page, ciValue);

    // Allocate all to contract interest
    const ciInput = page.getByTestId('payment-alloc-contract-interest');
    await ciInput.click();
    await ciInput.fill('');
    await ciInput.type(ciValue, { delay: 50 });
    await ciInput.press('Tab');

    await page.waitForTimeout(500);

    // Modal should still be visible (no crash)
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();

    // Total allocated should show the value (no NaN)
    const allocText = await page.getByTestId('payment-total-allocated').textContent();
    expect(allocText).not.toContain('NaN');

    // No page errors
    collector.assertNoPageErrors();
    await expectNoBlockingErrors(page);
    await collector.attachReport();
  });
});
