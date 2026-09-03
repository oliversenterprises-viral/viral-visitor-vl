import { test, expect } from '@playwright/test';
import { waitForAppReady } from './helpers';

const TALK_ROWS = [
  { key: 'owner_broadcast_enabled', id: 'owner_broadcast_enabled', value: '1' },
  { key: 'owner_broadcast_title', id: 'owner_broadcast_title', value: 'Message from ViralRefer' },
  { key: 'owner_broadcast_body', id: 'owner_broadcast_body', value: 'Send it. A friend must tap Get my link.' },
  { key: 'owner_broadcast_id', id: 'owner_broadcast_id', value: 'e2e-racer-talk' },
];

test.describe('racer-talk after Get my link', () => {
  test('cold land hides the message box; Get my link reveals it', async ({ page }) => {
    await page.route('**/rest/v1/site_content**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(TALK_ROWS),
      });
    });
    await page.route('**/functions/v1/racer-talk**', async (route) => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 200, body: 'ok' });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          enabled: true,
          email_required: false,
          message: {
            enabled: true,
            title: 'Message from ViralRefer',
            body: 'Send it. A friend must tap Get my link.',
            id: 'e2e-racer-talk',
            mediaUrl: null,
            sponsor: null,
            emailRequired: false,
          },
        }),
      });
    });

    await page.goto('/');
    await waitForAppReady(page);

    const panel = page.locator('#racer-talk');
    await expect(panel).toBeAttached();
    await expect(panel.locator('.racer-talk__title')).toHaveText('Message from ViralRefer');
    await expect(panel).toBeHidden();
    await expect(page.locator('#racer-talk input[type="email"]')).toHaveCount(0);

    await page.locator('#hero-get-link-btn').click();
    await expect(page.locator('#ref-link')).toHaveValue(/\/r\/VIRAL-/i, { timeout: 10000 });
    await expect(page.locator('#post-link-heading')).toContainText("You're racing.");
    await expect(panel).toBeVisible();
    await expect(panel.locator('#racer-talk-body')).toContainText('A friend must tap Get my link');
    await expect(page.locator('#referral-section #racer-talk')).toBeVisible();
  });
});
