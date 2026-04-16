import { Page, TestInfo } from '@playwright/test';

export interface CollectedError {
  type: 'pageerror' | 'console.error' | 'network';
  message: string;
  url?: string;
  status?: number;
}

/**
 * Attach error listeners to the page.
 * Returns a function to retrieve collected errors.
 */
export function attachErrorCollector(page: Page, testInfo: TestInfo) {
  const errors: CollectedError[] = [];

  page.on('pageerror', (err) => {
    errors.push({ type: 'pageerror', message: err.message });
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Ignore React dev warnings (not real errors)
      if (text.startsWith('Warning:')) return;
      errors.push({ type: 'console.error', message: text });
    }
  });

  page.on('response', (response) => {
    if (response.status() >= 400) {
      errors.push({
        type: 'network',
        message: `${response.status()} ${response.statusText()}`,
        url: response.url(),
        status: response.status(),
      });
    }
  });

  return {
    getErrors: () => errors,
    assertNoPageErrors: () => {
      const pageErrors = errors.filter((e) => e.type === 'pageerror');
      if (pageErrors.length > 0) {
        const summary = pageErrors.map((e) => e.message).join('\n');
        throw new Error(`Page errors detected:\n${summary}`);
      }
    },
    attachReport: async () => {
      if (errors.length > 0) {
        await testInfo.attach('collected-errors', {
          body: JSON.stringify(errors, null, 2),
          contentType: 'application/json',
        });
      }
    },
  };
}
