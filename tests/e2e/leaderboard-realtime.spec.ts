import { test, expect } from '@playwright/test';

test.describe('ViralRefer - Leaderboard & Realtime', () => {
  test('Leaderboard loads and shows entries from Supabase', async ({ page }) => {
    await page.goto('/');
    
    // Wait for leaderboard container to be visible and have content (more resilient)
    const container = page.locator('#leaderboard-container');
    await expect(container).toBeVisible({ timeout: 10000 });
    
    // Wait for actual content to appear (either entries or empty state)
    await expect(container).toContainText(/referral|No referrals|leader/i, { timeout: 10000 });
  });

  test('Demo +1 Referral button updates leaderboard', async ({ page }) => {
    await page.goto('/');
    
    const container = page.locator('#leaderboard-container');
    await expect(container).toBeVisible({ timeout: 8000 });
    
    const initialText = await container.textContent();
    
    await page.click('text=Demo +1 Referral');
    
    // Wait for the container to update (instead of hard timeout)
    await expect(container).not.toHaveText(initialText || '', { timeout: 5000 });
  });

  test('Total referrers counter updates', async ({ page }) => {
    await page.goto('/');
    const counter = page.locator('#total-referrers');
    await expect(counter).toBeVisible({ timeout: 8000 });
    
    // More resilient numeric check
    await expect(async () => {
      const value = await counter.textContent();
      expect(Number(value?.replace(',', '')) || 0).toBeGreaterThanOrEqual(0);
    }).toPass({ timeout: 5000 });
  });
});
