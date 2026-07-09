import { test, expect } from '@playwright/test';
import { waitForAppReady } from './helpers';

test.describe('ViralRefer - Prize Claim Flow & Admin', () => {
  test('Claim button exists and opens modal', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    
    // The big claim button in the prize section
    const claimBtn = page.locator('button:has-text("I\'m the #1 Winner")');
    await expect(claimBtn).toBeVisible({ timeout: 8000 });
    
    // Click and wait for any modal or message (more resilient, no force if possible)
    await claimBtn.click().catch(() => claimBtn.click({ force: true }));
    
    // Hard assert: claim path must open modal or show ineligible feedback (no soft-pass)
    await expect(
      page.locator('#winner-modal, text=Claim Your Prize, text=You are not yet eligible, text=not currently the #1')
    ).toBeVisible({ timeout: 8000 });
  });

  test('Admin button opens password modal', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    await page.locator('#admin-btn').click();
    
    const adminModal = page.locator('#admin-password-modal');
    await expect(adminModal).toBeVisible({ timeout: 5000 });
    
    await expect(page.locator('#admin-password-input')).toBeVisible({ timeout: 5000 });
  });

  test('Admin login flow (real Supabase Auth)', async ({ page }) => {
    const adminPass = process.env.ADMIN_TEST_PASSWORD;
    test.skip(!adminPass, 'ADMIN_TEST_PASSWORD not set — skip in CI until GitHub secret is configured');

    await page.goto('/');
    await waitForAppReady(page);
    await page.locator('#admin-btn').click();
    await page.fill('#admin-password-input', adminPass!);
    await page.click('#admin-password-submit-btn');
    await page.waitForTimeout(2000);

    // Must match live admin-flow audit: no nocache kick-out, dashboard stays open
    expect(page.url()).not.toMatch(/nocache=|force=/);
    await expect(page.locator('#admin-modal')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#admin-content')).toContainText(/Referrals|Share|Prize/i, {
      timeout: 10000,
    });
  });
});
