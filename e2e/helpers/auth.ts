import { Page, expect } from '@playwright/test';

export async function loginAsAdmin(page: Page) {
  const email = process.env.TEST_ADMIN_EMAIL;
  const password = process.env.TEST_ADMIN_PASSWORD;
  if (!email || !password) throw new Error('TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD not set');

  await page.goto('/login');
  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill(password);
  await page.getByTestId('login-submit').click();

  // Wait for redirect away from login
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
}

export async function loginAsClient(page: Page) {
  const email = process.env.TEST_CLIENT_EMAIL;
  const password = process.env.TEST_CLIENT_PASSWORD;
  if (!email || !password) throw new Error('TEST_CLIENT_EMAIL / TEST_CLIENT_PASSWORD not set');

  await page.goto('/portal/login');
  await page.getByTestId('portal-login-email').fill(email);
  await page.getByTestId('portal-login-password').fill(password);
  await page.getByTestId('portal-login-submit').click();

  await expect(page).not.toHaveURL(/\/portal\/login/, { timeout: 15_000 });
}
