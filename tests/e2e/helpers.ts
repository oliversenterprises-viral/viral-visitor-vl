import { type Page, expect } from '@playwright/test';

/** Wait until initApp() finishes (leaderboard + stats wired). */
export async function waitForAppReady(page: Page, timeoutMs = 20000): Promise<void> {
  await page.waitForFunction(
    () => document.documentElement.getAttribute('data-vr-ready') === '1',
    { timeout: timeoutMs },
  );
}

/** Ensure referral link is generated (instant flow, no profile modal). */
export async function ensureReferralLink(page: Page): Promise<void> {
  await waitForAppReady(page);
  const refInput = page.locator('#ref-link');
  const current = await refInput.inputValue().catch(() => '');
  if (current && /\/r\/VIRAL-/i.test(current)) return;

  await page.click('text=Get my referral link');
  await expect(refInput).toHaveValue(/\/r\/VIRAL-/i, { timeout: 10000 });
}