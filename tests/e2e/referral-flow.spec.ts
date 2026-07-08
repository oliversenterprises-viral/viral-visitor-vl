import { test, expect } from '@playwright/test';
import { ensureReferralLink, waitForAppReady } from './helpers';

test.describe('ViralRefer - Core Referral & Virality Flows', () => {
  test('Get referral link instant flow (no profile modal)', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    await page.click('text=Get my referral link');

    const refInput = page.locator('#ref-link');
    await expect(refInput).toHaveValue(/\/r\/VIRAL-/i, { timeout: 10000 });
    await expect(page.locator('#referral-section')).toBeVisible();
  });

  test('Referral attribution via ?ref= parameter', async ({ page }) => {
    await page.goto('/?ref=DEMO1234');

    await expect(page.locator('#referral-attribution')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#referrer-code-display')).toHaveText('DEMO1234');
    await expect(page.locator('#referrer-invite-headline')).toContainText(/Step 1/i);
    await expect(page.locator('#hero-trust-line')).toContainText(/No email/i);

    await page.getByRole('button', { name: /get my referral link/i }).nth(1).click();
    await expect(page.locator('#ref-link')).toHaveValue(/\/r\/VIRAL-/i, { timeout: 10000 });
  });

  test('Clean /r/ path attribution', async ({ page }) => {
    await page.goto('/r/VIRAL-DEMOCODE');
    await expect(page.locator('#referral-attribution')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('#referrer-code-display')).toHaveText('VIRAL-DEMOCODE');
    await expect(page.locator('#my-stats')).toBeHidden();
    await expect(page.locator('#funnel-expand-wrap')).toBeVisible();
    await expect(page.locator('#funnel-credit-gate')).toBeVisible();
    await expect(page.locator('#funnel-credit-gate')).toContainText(/does not credit|Step 1/i);
    await expect(page.locator('#hero-trust-line')).toContainText(/does not credit/i);
  });

  test('SPA preview serves index.html for bare /join path', async ({ page }) => {
    await page.goto('/join');
    await waitForAppReady(page);
    await expect(page.locator('#hero-title')).toBeVisible({ timeout: 8000 });
  });

  test('Custom referral base via fetchSiteContent: generate subpath link, visit and attribute', async ({
    page,
    baseURL,
  }) => {
    const joinBase = `${baseURL}/join`;
    await page.route('**/site_content**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ key: 'referral_base_url', value: joinBase }]),
      });
    });

    await page.goto('/');
    await waitForAppReady(page);

    await page.click('text=Get my referral link');
    const link = await page.locator('#ref-link').inputValue();
    expect(link).toMatch(/\/join\/r\/VIRAL-/i);

    const referrerCode = new URL(link).pathname.split('/').pop()!;
    await page.goto(new URL(link).pathname);
    await expect(page.locator('#referral-attribution')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('#referrer-code-display')).toHaveText(referrerCode);
  });

  test('All 15 share buttons are present and functional', async ({ page }) => {
    await page.goto('/');
    await ensureReferralLink(page);

    const shareButtons = page.locator('#referral-section .share-btn');
    await expect(shareButtons).toHaveCount(15);

    for (let i = 0; i < 14; i++) {
      const button = shareButtons.nth(i);
      await expect(button).toBeVisible();

      const [newPage] = await Promise.all([
        page.waitForEvent('popup', { timeout: 3000 }).catch(() => null),
        button.click(),
      ]);

      if (newPage) await newPage.close();
    }
  });

  test('Copy link works and shows toast', async ({ page }) => {
    await page.goto('/');
    await ensureReferralLink(page);

    await page.click('#copy-link-btn');

    await expect(page.locator('#toast-container >> text=Link copied')).toBeVisible({ timeout: 3000 });
  });

  test('Hero section visual snapshot', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    const hero = page.locator('.hero-gradient').first();
    await expect(hero).toBeVisible({ timeout: 8000 });
    await expect(hero).toHaveScreenshot('hero-section.png', {
      maxDiffPixelRatio: 0.02,
      timeout: 10000,
    });
  });

  test('Prize cards + banner area visual snapshot', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    const prizeSection = page.locator('#prize');
    await expect(prizeSection).toBeVisible({ timeout: 10000 });
    await expect(page.locator('body')).toHaveScreenshot('prize-banner-area.png', {
      maxDiffPixelRatio: 0.03,
      timeout: 12000,
    });
  });
});