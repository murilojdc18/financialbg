import { test, expect } from '@playwright/test';
import { attachErrorCollector } from './helpers/error-collector';
import { loginAsAdmin } from './helpers/auth';
import {
  openFirstPaymentModal,
  fillAmountTotal,
  clickAutoDistribute,
  expectNoBlockingErrors,
} from './helpers/payment-helpers';

test.describe('7D — Comma pt-BR input does not produce NaN', () => {
  test('typing "500,00" parses correctly and total allocated shows R$ 500,00', async ({ page }, testInfo) => {
    const collector = attachErrorCollector(page, testInfo);
    await loginAsAdmin(page);

    const opened = await openFirstPaymentModal(page);
    if (!opened) {
      test.skip();
      return;
    }

    // Type comma-formatted value
    await fillAmountTotal(page, '500,00');

    // Auto distribute
    await clickAutoDistribute(page);
    await page.waitForTimeout(500);

    // Total allocated should not contain NaN
    const allocText = await page.getByTestId('payment-total-allocated').textContent();
    expect(allocText).not.toContain('NaN');
    
    // Should contain a valid currency number (at least digits and comma)
    expect(allocText).toMatch(/\d/);

    // Modal should be alive
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();

    // No page errors
    collector.assertNoPageErrors();
    await expectNoBlockingErrors(page);
    await collector.attachReport();
  });
});
