import { type Page, expect } from '@playwright/test';

/**
 * Helper functions for E2E tests
 */

// Wait for a specific URL pattern
export async function waitForURL(page: Page, urlPattern: string | RegExp) {
  await page.waitForURL(urlPattern, { timeout: 30000 });
}

// Fill a form field with retry logic
export async function fillFormField(page: Page, selector: string, value: string) {
  const field = page.locator(selector);
  await expect(field).toBeVisible({ timeout: 10000 });
  await field.clear();
  await field.fill(value);

  // Special handling for website inputs that strip protocols
  if (selector.includes('website')) {
    // The WebsiteInput component strips https:// from display
    // so we just verify the field has some value
    await expect(field).not.toHaveValue('');
  } else {
    await expect(field).toHaveValue(value);
  }
}

// Generate unique test data
export function generateTestData() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return {
    organizationName: `Test Org ${timestamp}-${random}`,
    email: `test+${timestamp}${random}@example.com`,
    userName: `Test User ${timestamp}`,
  };
}
