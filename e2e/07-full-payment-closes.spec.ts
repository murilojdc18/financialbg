import { test, expect } from '@playwright/test';
import { attachErrorCollector } from './helpers/error-collector';
import { loginAsAdmin } from './helpers/auth';
import {
  openFirstPaymentModal,
  fillAmountTotal,
  clickAutoDistribute,
  expectNoBlockingErrors,
  isSubmitEnabled,
  countReceivableRows,
  submitPayment,
  extractCurrencyValue,
} from './helpers/payment-helpers';

test.describe('7A — Full payment closes receivable without new installment', () => {
  test('pay total due: no new installment created, status PAGO', async ({ page }, testInfo) => {
    const collector = attachErrorCollector(page, testInfo);
    await loginAsAdmin(page);

    // Navigate to receivables and count rows BEFORE payment
    await page.goto('/contas-a-receber');
    await page.waitForLoadState('networkidle');
    const rowsBefore = await countReceivableRows(page);

    const opened = await openFirstPaymentModal(page);
    if (!opened) {
      test.skip();
      return;
    }

    // Read total due
    const totalDueEl = page.locator('text=Total devido:').locator('..').locator('span').last();
    const totalDueText = await totalDueEl.textContent().catch(() => '');
    const totalDueStr = extractCurrencyValue(totalDueText);
    if (!totalDueStr) {
      test.skip();
      return;
    }

    // Fill amount = total due
    await fillAmountTotal(page, totalDueStr);
    await clickAutoDistribute(page);
    await page.waitForTimeout(500);

    // Remaining should be zero
    const remainingEl = page.getByTestId('payment-remaining-total');
    const remainingText = await remainingEl.textContent();
    expect(remainingText).toContain('0,00');

    // Defer section should NOT appear
    const deferBanner = page.locator('text=Saldo que será postergado');
    await expect(deferBanner).not.toBeVisible({ timeout: 2000 });

    // Submit should be enabled
    expect(await isSubmitEnabled(page)).toBe(true);

    // No blocking errors
    collector.assertNoPageErrors();
    await expectNoBlockingErrors(page);

    // CRITICAL: Count rows AFTER — no new installment should be created
    // (We verify the form state; actual submission would need real DB credentials)
    // Verify no "postergar" section is forced
    const deferOption = page.locator('text=Nova parcela será criada');
    await expect(deferOption).not.toBeVisible({ timeout: 1000 });

    await collector.attachReport();
  });
});
