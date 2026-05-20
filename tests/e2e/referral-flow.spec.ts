import { test, expect } from '@playwright/test';

test.describe('ViralRefer - Core Referral & Virality Flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Get referral link + profile creation flow', async ({ page }) => {
    await page.click('text=Get my referral link');
    
    // Profile modal should appear
    await expect(page.locator('#profile-modal')).toBeVisible();
    
    await page.fill('#profile-name', 'Test Referrer');
    await page.fill('#profile-email', 'test@viralrefer.app');
    await page.fill('#profile-website', 'https://example.com');
    
    await page.click('#profile-save-btn');
    
    await expect(page.locator('#profile-modal')).toBeHidden();
    await expect(page.locator('#ref-link')).toHaveValue(/ref=/);
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
});
