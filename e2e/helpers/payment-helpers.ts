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
 * Checks for toast banners, validation error boxes, and known error text.
 */
export async function expectNoBlockingErrors(page: Page) {
  // Check for validation error box
  const validationBox = page.getByTestId('payment-validation-errors');
  if (await validationBox.isVisible({ timeout: 1000 }).catch(() => false)) {
    const text = await validationBox.textContent();
    // Only fail if text matches known error patterns (not just empty validation)
    for (const keyword of ERROR_KEYWORDS) {
      if (text?.toLowerCase().includes(keyword)) {
        throw new Error(`Blocking validation error found: "${text}"`);
      }
    }
  }

  // Check for sonner toast errors
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
 * Handles pt-BR comma format by typing the raw string.
 */
export async function fillAmountTotal(page: Page, value: string) {
  const input = page.getByTestId('payment-amount-total');
  await input.click();
  await input.fill('');
  await input.type(value, { delay: 50 });
  // Blur to trigger parse
  await input.press('Tab');
}

/**
 * Click Auto Distribute button.
 */
export async function clickAutoDistribute(page: Page) {
  const btn = page.getByRole('button', { name: /auto distribuir/i });
  if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await btn.click();
    // Wait for values to settle
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
