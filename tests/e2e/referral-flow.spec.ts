import { test, expect } from '@playwright/test';

test.describe('ViralRefer - Core Referral & Virality Flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Get referral link + profile creation flow', async ({ page }) => {
    await page.click('text=Get my referral link');
    
    // Profile modal should appear (more resilient wait)
    const modal = page.locator('#profile-modal');
    await expect(modal).toBeVisible({ timeout: 8000 });
    
    await page.fill('#profile-name', 'Test Referrer');
    await page.fill('#profile-email', 'test@viralrefer.app');
    await page.fill('#profile-website', 'https://example.com');
    
    await page.click('#profile-save-btn');
    
    // Wait for modal to close and link to appear
    await expect(modal).toBeHidden({ timeout: 8000 });
    await expect(page.locator('#ref-link')).toHaveValue(/ref=/, { timeout: 8000 });
  });

  test('Referral attribution via ?ref= parameter', async ({ page }) => {
    await page.goto('/?ref=DEMO1234');
    
    await expect(page.locator('#referral-attribution')).toBeVisible();
    await expect(page.locator('#referrer-code-display')).toHaveText('DEMO1234');
    
    await page.click('text=Join & Get My Link');
    
    // Should trigger profile or record referral
    await expect(page.locator('#profile-modal, #referral-section')).toBeVisible();
  });

  test('All 7 share buttons are present and functional', async ({ page }) => {
    await page.click('text=Get my referral link');
    await page.fill('#profile-name', 'Share Tester');
    await page.click('#profile-save-btn');
    
    const platforms = ['X', 'WhatsApp', 'LinkedIn', 'Facebook', 'Telegram', 'SMS', 'Email'];
    
    for (const platform of platforms) {
      const button = page.locator(`button:has-text("${platform}")`);
      await expect(button).toBeVisible();
      
      // Clicking should not throw and should attempt to open a window or trigger share
      const [newPage] = await Promise.all([
        page.waitForEvent('popup', { timeout: 3000 }).catch(() => null),
        button.click(),
      ]);
      
      if (newPage) await newPage.close();
    }
  });

  test('Copy link works and shows toast', async ({ page }) => {
    await page.click('text=Get my referral link');
    await page.fill('#profile-name', 'Copy Test');
    await page.click('#profile-save-btn');
    
    await page.click('button:has-text("COPY")');
    
    // Toast should appear
    await expect(page.locator('text=Link copied')).toBeVisible({ timeout: 3000 });
  });

  // Critical visual regression snapshots for hero + prize area (Phase 1 quality lock-in)
  // To update snapshots: npx playwright test --update-snapshots
  test('Hero section visual snapshot', async ({ page }) => {
    await page.goto('/');
    const hero = page.locator('.hero-gradient').first();
    await expect(hero).toBeVisible({ timeout: 8000 });
    await expect(hero).toHaveScreenshot('hero-section.png', { 
      maxDiffPixelRatio: 0.02,
      timeout: 10000 
    });
  });

  test('Prize cards + banner area visual snapshot', async ({ page }) => {
    await page.goto('/');
    const prizeSection = page.locator('#prize-section, .premium-card').first();
    await expect(prizeSection).toBeVisible({ timeout: 10000 });
    await expect(page.locator('body')).toHaveScreenshot('prize-banner-area.png', { 
      maxDiffPixelRatio: 0.03,
      timeout: 12000 
    });
  });
});
