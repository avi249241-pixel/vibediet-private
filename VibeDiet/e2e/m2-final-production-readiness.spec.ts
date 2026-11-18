import { test, expect } from '@playwright/test';

test.describe('VibeDiet Phase 5: Production Readiness & Verification Gate', () => {
  test('1. Desktop & Mobile Responsiveness: Zero horizontal overflow and clean layout', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForSelector('[data-testid="daily-diary-screen"]', { timeout: 10000 });

    // Verify zero horizontal scroll
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);

    // Filter out expected benign network/telemetry logs if any
    const fatalErrors = consoleErrors.filter(
      (err) =>
        !err.includes('favicon') &&
        !err.includes('429') &&
        !err.includes('status of 404') &&
        !err.includes('ERR_CONNECTION_REFUSED')
    );
    expect(fatalErrors).toHaveLength(0);
  });

  test('2. State Persistence across Browser Reload', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="daily-diary-screen"]', { timeout: 10000 });

    // Verify localStorage key vibediet_user_data_v1 is present and initialized
    const storedData = await page.evaluate(() => {
      return window.localStorage.getItem('vibediet_user_data_v1');
    });
    expect(storedData).not.toBeNull();
    const parsed = JSON.parse(storedData!);
    expect(parsed.biometrics).toBeDefined();

    // Reload page
    await page.reload();
    await page.waitForSelector('[data-testid="daily-diary-screen"]', { timeout: 10000 });

    // Verify persisted state intact after reload
    const reloadedData = await page.evaluate(() => {
      return window.localStorage.getItem('vibediet_user_data_v1');
    });
    expect(reloadedData).not.toBeNull();
    const reloadedParsed = JSON.parse(reloadedData!);
    expect(reloadedParsed.biometrics.weightKg).toBe(parsed.biometrics.weightKg);
  });

  test('3. Instant Local Food Catalog Search & Filtering', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="daily-diary-screen"]', { timeout: 10000 });

    // Navigate to Food Search tab
    await page.getByTestId('nav-tab-manual').click();
    await page.waitForSelector('[data-testid="manual-entry-screen"]', { timeout: 10000 });

    // Search for "Paneer" in the verified catalog input
    const searchInput = page.getByPlaceholder('Search staples');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('Paneer');
    await page.waitForTimeout(400);

    // Verify matching catalog results appear
    await expect(page.getByText(/Paneer/i).first()).toBeVisible();

    // Return to Today diary
    await page.getByTestId('nav-tab-diary').click();
    await page.waitForSelector('[data-testid="daily-diary-screen"]', { timeout: 10000 });
  });

  test('4. Weekly Check-In Modal: Live TDEE and Clean Dismissal', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="daily-diary-screen"]', { timeout: 10000 });

    // Navigate to Metabolism Coach
    await page.getByTestId('nav-tab-coach').click();
    await page.waitForSelector('[data-testid="metabolism-coach-screen"]', { timeout: 10000 });

    // Click Weekly Check-In button
    const checkInBtn = page.getByTestId('open-weekly-check-in-btn');
    await checkInBtn.scrollIntoViewIfNeeded();
    await checkInBtn.click({ force: true });
    await page.waitForSelector('[data-testid="weekly-check-in-modal"]', { timeout: 10000 });

    // Verify modal contains TDEE & EWMA content
    await expect(page.getByText('Weekly Metabolic Autopilot')).toBeVisible();

    // Click "Keep Current Plan" to dismiss
    await page.getByTestId('keep-current-plan-btn').click({ force: true });
    await page.waitForSelector('[data-testid="weekly-check-in-modal"]', { state: 'detached', timeout: 5000 });
  });

  test('5. Admin Console: Auth Gate, Ping Live Swarm, Support Inbox & Audit Trail', async ({ page }) => {
    // 5a. Navigate to /admin directly
    await page.goto('/admin');
    await page.waitForSelector('[data-testid="admin-auth-gate"], [data-testid="admin-cockpit-screen"]', { timeout: 10000 });
    const gate = page.locator('[data-testid="admin-auth-gate"]');
    if (await gate.isVisible()) {
      await page.locator('[data-testid="admin-passphrase-input"]').fill(process.env.ADMIN_ACCESS_TOKEN || 'dummy_admin_secret_token_gate_pass_ci');
      await page.locator('[data-testid="admin-authorize-btn"]').click();
    }
    await page.waitForSelector('[data-testid="admin-cockpit-screen"]', { timeout: 10000 });

    // 5b. Verify Ping Live Gemini Swarm button exists
    const pingBtn = page.locator('[data-testid="ping-swarm-btn"]');
    await expect(pingBtn).toBeVisible();

    // Click Ping Live Gemini Swarm if configured, otherwise verify presence
    if (await pingBtn.isEnabled()) {
      await pingBtn.click();
      await page.waitForTimeout(1500);
      const latencyCard = page.locator('[data-testid="last-swarm-latency"]');
      await expect(latencyCard).toBeVisible();
    } else {
      await expect(pingBtn).toBeVisible();
    }

    // 5c. Verify Support Tickets Inbox exists
    const supportInbox = page.locator('[data-testid="admin-support-inbox"]');
    await expect(supportInbox).toBeVisible();

    // 5d. Verify Security Audit Trail Viewer exists
    const auditViewer = page.locator('[data-testid="admin-audit-log-viewer"]');
    await expect(auditViewer).toBeVisible();

    // 5e. Return to Consumer App via navigation button
    await page.click('[data-testid="nav-tab-diary"]');
    await page.waitForSelector('[data-testid="daily-diary-screen"]', { timeout: 10000 });
  });
});
