import { test, expect } from '@playwright/test';
import { attachErrorCollector } from './helpers/error-collector';
import { loginAsAdmin } from './helpers/auth';
import {
  openFirstPaymentModal,
  fillAmountTotal,
  expectNoBlockingErrors,
  isSubmitEnabled,
} from './helpers/payment-helpers';

test.describe('7C — Invalid allocation blocks submit', () => {
  test('alloc 400 of 500: submit disabled, validation error shown, then fix', async ({ page }, testInfo) => {
    const collector = attachErrorCollector(page, testInfo);
    await loginAsAdmin(page);

    const opened = await openFirstPaymentModal(page);
    if (!opened) {
      test.skip();
      return;
    }

    // Fill 500
    await fillAmountTotal(page, '500,00');

    // Allocate only 400 to principal
    const principalInput = page.getByTestId('payment-alloc-principal');
    await principalInput.click();
    await principalInput.fill('');
    await principalInput.type('400,00', { delay: 50 });
    await principalInput.press('Tab');

    await page.waitForTimeout(500);

    // Allocation diff should be visible
    const diffEl = page.getByTestId('payment-alloc-diff');
    await expect(diffEl).toBeVisible({ timeout: 3000 });

    // Submit should be disabled (alloc != amount)
    const enabled = await isSubmitEnabled(page);
    expect(enabled).toBe(false);

    // Validation errors box should show
    const valErrors = page.getByTestId('payment-validation-errors');
    await expect(valErrors).toBeVisible({ timeout: 3000 });

    // Modal should still be visible (no crash)
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();

    // Now fix: change principal to 500
    await principalInput.click();
    await principalInput.fill('');
    await principalInput.type('500,00', { delay: 50 });
    await principalInput.press('Tab');

    await page.waitForTimeout(500);

    // Diff should disappear
    await expect(diffEl).not.toBeVisible({ timeout: 3000 });

    // No page errors throughout
    collector.assertNoPageErrors();
    await expectNoBlockingErrors(page);
    await collector.attachReport();
  });
});
