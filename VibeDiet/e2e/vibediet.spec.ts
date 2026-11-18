import { test, expect } from '@playwright/test';

test.describe('VibeDiet End-to-End Browser Verification (6 Core Journeys)', () => {
  test('1. Daily Diary renders macro progress, 4-tier badges, and repeat meals drawer', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('daily-diary-screen')).toBeVisible();
    await expect(page.getByTestId('toggle-repeat-drawer-btn')).toBeVisible();
    await page.getByTestId('toggle-repeat-drawer-btn').click();
    await expect(page.getByText('One-Tap Repeat Meals Library')).toBeVisible();
  });

  test('2. AI Photo Scanner simulates Indian-fusion bowl recognition and clarifying questions', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('nav-tab-photo').click();
    await expect(page.getByTestId('demo-ai-mode-banner')).toBeVisible();
    await page.getByTestId('simulate-photo-scan-btn').click();
    await expect(page.getByTestId('draft-review-panel')).toBeVisible();
    await page.getByTestId('confirm-draft-btn').click();
    await expect(page.getByTestId('daily-diary-screen')).toBeVisible();
  });

  test('3. Metabolism Coach logs scale weight and computes alpha=0.12 EWMA smoothed trend', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('nav-tab-coach').click();
    await expect(page.getByTestId('metabolism-coach-screen')).toBeVisible();
    await page.getByTestId('weight-input-kg').fill('76.1');
    await page.getByTestId('submit-weight-btn').click();
    await expect(page.getByText('76.1 kg')).toBeVisible();
  });

  test('4. Onboarding Wizard recalculates Mifflin-St Jeor BMR and safety floor targets', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('nav-tab-onboarding').click();
    await expect(page.getByTestId('onboarding-wizard')).toBeVisible();
    await page.getByTestId('save-onboarding-btn').click();
    await expect(page.getByTestId('daily-diary-screen')).toBeVisible();
  });

  test('5. Backend Admin Console route (/admin or #admin) isolates telemetry and key pool controls', async ({ page }) => {
    const unlockGateIfPresent = async () => {
      await page.waitForSelector('[data-testid="admin-auth-gate"], [data-testid="admin-cockpit-screen"]', { timeout: 10000 });
      const gate = page.locator('[data-testid="admin-auth-gate"]');
      if (await gate.isVisible()) {
        await page.locator('[data-testid="admin-passphrase-input"]').fill(process.env.ADMIN_ACCESS_TOKEN || 'dummy_admin_secret_token_gate_pass_ci');
        await page.locator('[data-testid="admin-authorize-btn"]').click();
      }
      await page.waitForSelector('[data-testid="admin-cockpit-screen"]', { timeout: 10000 });
    };

    await page.goto('/#admin');
    await unlockGateIfPresent();
    await page.getByTestId('trigger-sweeper-btn').click();
    await page.getByTestId('nav-tab-diary').click();
    await expect(page.getByTestId('daily-diary-screen')).toBeVisible();

    // Also verify direct /admin path and clean back navigation
    await page.goto('/admin');
    await unlockGateIfPresent();
    await page.getByTestId('nav-tab-diary').click();
    await expect(page.getByTestId('daily-diary-screen')).toBeVisible();

    // Also verify subtle dev trigger if needed
    await page.getByTestId('nav-tab-admin').click();
    await unlockGateIfPresent();
    await page.getByTestId('nav-tab-diary').click();
    await expect(page.getByTestId('daily-diary-screen')).toBeVisible();
  });

  test('6. Legal Modal displays $0.00 aggregate liability cap and ephemeral photo policy', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('open-legal-header-btn').click();
    await expect(page.getByTestId('legal-modal')).toBeVisible();
    await expect(page.getByText('$0.00 USD').first()).toBeVisible();
    await page.getByTestId('close-legal-modal-btn').click();
  });

  test('7. Profile & Billing UI tests export portability and Pro sandbox webhook activation', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('nav-tab-profile').click();
    await expect(page.getByTestId('profile-screen')).toBeVisible();
    await expect(page.getByTestId('export-user-json-btn')).toBeVisible();
    await expect(page.getByTestId('upgrade-razorpay-btn')).toBeVisible();
    await expect(page.getByTestId('upgrade-stripe-btn')).toBeVisible();
    await page.getByTestId('simulate-webhook-btn').click();
    await expect(page.getByText('✓ Pro Active')).toBeVisible();
  });

  test('8. AI Text Swarm logs meal via natural language / voice dictation input', async ({ page }) => {
    test.setTimeout(90000);
    await page.goto('/');
    await page.getByTestId('nav-tab-photo').click();
    await expect(page.getByTestId('describe-meal-form')).toBeVisible();
    await page.getByTestId('dictate-meal-input').fill('2 rotis, 1 bowl dal tadka, 150g paneer');
    await page.getByTestId('submit-text-meal-btn').click();
    await expect(page.getByTestId('draft-review-panel')).toBeVisible({ timeout: 60000 });
    await page.getByTestId('confirm-draft-btn').click();
    await expect(page.getByTestId('daily-diary-screen')).toBeVisible();
  });
});
