import { test } from '@playwright/test';

test('screenshot login page', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'screenshots/test/test-login.png', fullPage: true });
});
