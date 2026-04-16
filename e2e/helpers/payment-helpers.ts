import { Page, expect } from '@playwright/test';

/**
 * Error keywords that indicate a payment flow failure.
 */
const ERROR_KEYWORDS = [
  'saldo remanescente',
  'não foi possível salvar',
  'erro ao salvar',
  'alocação inválida',
  'error',
  'falha',
];

/**
 * After any save/submit action, assert that no blocking errors appeared in the UI.
 */
export async function expectNoBlockingErrors(page: Page) {
  const validationBox = page.getByTestId('payment-validation-errors');
  if (await validationBox.isVisible({ timeout: 1000 }).catch(() => false)) {
    const text = await validationBox.textContent();
    for (const keyword of ERROR_KEYWORDS) {
      if (text?.toLowerCase().includes(keyword)) {
        throw new Error(`Blocking validation error found: "${text}"`);
      }
    }
  }

  const toastError = page.locator('[data-sonner-toast][data-type="error"]');
  if (await toastError.first().isVisible({ timeout: 1000 }).catch(() => false)) {
    const text = await toastError.first().textContent();
    throw new Error(`Error toast visible after action: "${text}"`);
  }
}

/**
 * Navigate to contas-a-receber and open payment modal for the first available receivable.
 * Returns true if modal was opened, false if no open receivables exist.
 */
export async function openFirstPaymentModal(page: Page): Promise<boolean> {
  await page.goto('/contas-a-receber');
  await page.waitForLoadState('networkidle');

  const payBtn = page.getByTestId('btn-pay-receivable').first();
  const visible = await payBtn.isVisible({ timeout: 8000 }).catch(() => false);
  if (!visible) return false;

  await payBtn.click();
  const modal = page.locator('[role="dialog"]');
  await expect(modal).toBeVisible({ timeout: 5000 });
  return true;
}

/**
 * Fill the "Valor Recebido" CurrencyInput using keyboard.
 */
export async function fillAmountTotal(page: Page, value: string) {
  const input = page.getByTestId('payment-amount-total');
  await input.click();
  await input.fill('');
  await input.type(value, { delay: 50 });
  await input.press('Tab');
}

/**
 * Click Auto Distribute button.
 */
export async function clickAutoDistribute(page: Page) {
  const btn = page.getByRole('button', { name: /auto distribuir/i });
  if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await btn.click();
    await page.waitForTimeout(300);
  }
}

/**
 * Get the text content of total allocated.
 */
export async function getTotalAllocatedText(page: Page): Promise<string> {
  const el = page.getByTestId('payment-total-allocated');
  return (await el.textContent()) ?? '';
}

/**
 * Check if submit button is enabled.
 */
export async function isSubmitEnabled(page: Page): Promise<boolean> {
  const btn = page.getByTestId('payment-submit');
  const disabled = await btn.getAttribute('disabled');
  return disabled === null;
}

/**
 * Count visible rows in the receivables table.
 */
export async function countReceivableRows(page: Page): Promise<number> {
  const rows = page.getByTestId('receivable-row');
  return rows.count();
}

/**
 * Submit the payment form and wait for modal to close.
 */
export async function submitPayment(page: Page) {
  const btn = page.getByTestId('payment-submit');
  await btn.click();
  // Wait for modal to close (success)
  await page.locator('[role="dialog"]').waitFor({ state: 'hidden', timeout: 15000 });
}

/**
 * Extract numeric value from a pt-BR currency string like "R$ 1.234,56" -> "1.234,56"
 */
export function extractCurrencyValue(text: string | null | undefined): string | null {
  const match = text?.match(/[\d.,]+/);
  return match ? match[0] : null;
}
