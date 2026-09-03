import { test, expect, type Route } from '@playwright/test';
import { waitForAppReady } from './helpers';

async function hangApi(route: Route): Promise<void> {
  if (route.request().method() === 'OPTIONS') {
    await route.fulfill({ status: 200, body: 'ok' });
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, 15_000));
  await route.fulfill({ status: 504, body: 'hung' }).catch(() => {});
}

test.describe('first-screen fail-fast', () => {
  test('hung CMS and RPCs do not block Site Drop or Get my link', async ({ page }) => {
    await page.route('**/rest/v1/**', hangApi);
    await page.route('**/rpc/**', hangApi);
    await page.route('**/functions/v1/**', hangApi);

    const started = Date.now();
    await page.goto('/');
    await waitForAppReady(page);
    expect(Date.now() - started).toBeLessThan(5_000);

    await expect(page.locator('#hero-title-line1')).toHaveText('Win the homepage.');
    await expect(page.locator('#hero-get-link-btn')).toBeVisible();
    await expect(page.locator('body')).toContainText('Site Drop');
    await expect(page.locator('#racer-talk')).toBeHidden();

    await page.locator('#hero-get-link-btn').click();
    await expect(page.locator('#ref-link')).toHaveValue(/\/r\/VIRAL-/i, { timeout: 10000 });
    await expect(page.locator('#post-link-heading')).toContainText("You're racing.");
    await expect(page.locator('#post-link-site-drop')).toContainText('Site Drop');
    await expect(page.locator('#post-link-site-drop')).toContainText('Just entered');
  });
});
