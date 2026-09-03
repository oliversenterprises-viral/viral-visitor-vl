import { test, expect } from '@playwright/test';
import { waitForAppReady } from './helpers';

test.describe('ViralRefer - Prize Claim Flow & Admin', () => {
  test('Claim button exists and opens modal', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    const prizeSection = page.locator('#prize');
    await expect(prizeSection).toBeHidden();

    const claimBtn = page.locator('#prize button[onclick="claimBanner()"]');
    await expect(claimBtn).toBeAttached({ timeout: 8000 });

    await page.evaluate(() => {
      localStorage.setItem('vr_my_ref_code', 'VIRAL-E2ECLAIM');
      (window as unknown as { claimBanner?: () => void }).claimBanner?.();
    });

    const modal = page.locator('#winner-modal');
    await expect(modal).toBeVisible({ timeout: 8000 });
    await expect(modal).not.toHaveClass(/hidden/);
  });

  test('Admin button opens password modal', async ({ page }) => {
    await page.goto('/?owner=1');
    await waitForAppReady(page);

    const adminBtn = page.locator('#admin-btn');
    await expect(adminBtn).toBeVisible({ timeout: 5000 });
    await adminBtn.click();

    const adminModal = page.locator('#admin-owner-gate-modal');
    await expect(adminModal).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#admin-owner-gate-input')).toBeVisible({ timeout: 5000 });
  });

  test('owner Continue leaves Verifying even if HQ desk never answers', async ({ page }) => {
    await page.route('**/functions/v1/admin-action', async (route) => {
      const raw = route.request().postData() || '{}';
      let action = '';
      try {
        action = String((JSON.parse(raw) as { action?: string }).action || '');
      } catch {
        action = '';
      }
      if (action === 'verify_owner_password') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, session_token: 'e2e-hmac-session' }),
        });
        return;
      }
      // Desk stays pending — login must not wait on this.
      await new Promise(() => {});
    });

    await page.goto('/?owner=1');
    await waitForAppReady(page);
    await expect(page).toHaveTitle(/Site Drop/i);
    await page.locator('#admin-btn').click();
    const btn = page.locator('#admin-owner-gate-submit');
    await expect(btn).toBeVisible();
    await page.fill('#admin-owner-gate-input', 'owner-e2e-not-a-secret');
    await btn.click();
    await expect(btn).not.toContainText(/Verifying/i, { timeout: 3000 });
    await expect(btn).toContainText(/Continue/i);
    await expect(page.locator('#admin-modal')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#admin-owner-gate-modal')).toHaveClass(/hidden/);
  });

  test('Admin login flow (owner password + session)', async ({ page }) => {
    const adminPass = process.env.ADMIN_TEST_PASSWORD;
    test.skip(!adminPass, 'ADMIN_TEST_PASSWORD not set — skip in CI until GitHub secret is configured');

    await page.goto('/?owner=1');
    await waitForAppReady(page);
    await page.locator('#admin-btn').click();
    await expect(page.locator('#admin-owner-gate-input')).toBeVisible({ timeout: 5000 });
    await page.fill('#admin-owner-gate-input', adminPass!);
    await page.click('#admin-owner-gate-submit');

    expect(page.url()).not.toMatch(/nocache=|force=/);
    await expect(page.locator('#admin-modal')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#admin-content')).toContainText(/Landings|Get-link|Share|Locked/i, {
      timeout: 10000,
    });
  });
});
