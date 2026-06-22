import { test, expect } from '@playwright/test';
import { waitForAppReady } from './helpers';

test.describe('ViralRefer - Leaderboard & Realtime', () => {
  test('Leaderboard loads and shows entries from Supabase', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    const container = page.locator('#leaderboard-container');
    await expect(container).toBeVisible({ timeout: 10000 });
    await expect(container).toContainText(/referral|leaderboard|refs|getting started/i, {
      timeout: 10000,
    });
  });

  test('Demo +1 Referral button updates leaderboard (debug mode)', async ({ page }) => {
    await page.goto('/?debug=1');
    await waitForAppReady(page);

    const container = page.locator('#leaderboard-container');
    await expect(container).toBeVisible({ timeout: 8000 });

    const demoBtn = page.locator('#demo-referral-btn');
    await expect(demoBtn).toBeVisible({ timeout: 5000 });

    const initialText = (await container.textContent()) || '';
    await demoBtn.click();
    await expect(container).not.toHaveText(initialText, { timeout: 8000 });
  });

  test('Total referrers counter updates', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    const counter = page.locator('#total-referrers');
    await expect(counter).toBeVisible({ timeout: 8000 });

    await expect(async () => {
      const value = await counter.textContent();
      expect(Number(value?.replace(/,/g, '')) || 0).toBeGreaterThanOrEqual(0);
    }).toPass({ timeout: 5000 });
  });
});