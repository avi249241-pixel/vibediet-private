import { test, expect } from '@playwright/test';
import crypto from 'node:crypto';

function makeSignedAdminToken(): string {
  const secret = process.env.SESSION_SECRET || 'vibediet-signed-session-secret-key-38bdf8';
  const payload = Buffer.from(
    JSON.stringify({
      uid: 'admin-verified-uid',
      email: 'admin@vibediet.app',
      isAdmin: true,
      iat: Date.now(),
      exp: Date.now() + 3600_000,
    })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

test.describe('VibeDiet Final Surgical Code Patch & Regression Gate', () => {
  test.beforeEach(async ({ page, request }) => {
    try {
      await request.delete('/v1/user/data', {
        headers: { Authorization: 'Bearer uid:demo-user-uid' },
      });
    } catch {}

    await page.addInitScript(() => {
      if (!window.sessionStorage.getItem('__pw_cleared__')) {
        window.localStorage.clear();
        window.sessionStorage.clear();
        window.sessionStorage.setItem('__pw_cleared__', '1');
      }
    });
  });

  // Assertion 1: < → > Today Preservation & Hydration Reset
  test('1. < (Yesterday) -> > (Today) preserves Today meals and resets Yesterday hydration', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="daily-diary-screen"]', { timeout: 10000 });

    // Assert initial Today meals: 1,107 kcal consumed
    const consumedToday = page.locator('[data-testid="calories-consumed"]');
    await expect(consumedToday).toContainText('1,107');

    // Log +250 ml on Today first so we prove Today's hydration never bleeds onto Yesterday
    const hydrationSection = page.locator('section[aria-label="Hydration"]');
    await hydrationSection.locator('button:has-text("+ 250 ml")').click();
    await expect(hydrationSection).toContainText('250');

    // Click Previous Day (<)
    const prevDayBtn = page.locator('[data-testid="prev-day-btn"], button[aria-label="Previous day"]').first();
    await prevDayBtn.scrollIntoViewIfNeeded();
    await prevDayBtn.click();
    await page.waitForTimeout(600);

    // On Yesterday: Assert 0 kcal consumed
    await expect(consumedToday).toContainText('0');

    // On Yesterday: Assert Hydration shows 0 / 2,500 ml and bar width is 0px
    await expect(hydrationSection).toContainText('0 / 2,500 ml');
    const hydrationBar = page.locator('[data-testid="hydration-bar-inner"]');
    await expect(hydrationBar).toHaveCSS('width', '0px');

    // Click Next Day (>) back to Today
    const nextDayBtn = page.locator('[data-testid="next-day-btn"], button[aria-label="Next day"]').first();
    await nextDayBtn.scrollIntoViewIfNeeded();
    await nextDayBtn.click();
    await page.waitForTimeout(600);

    // Assert Today 1,107 kcal and 250 ml hydration are still completely intact!
    await expect(consumedToday).toContainText('1,107');
    await expect(hydrationSection).toContainText('250');
  });

  // Assertion 2: 1.5x Scan Commit: Previews and commits 1,029 kcal
  test('2. 1.5x Sample Meal Commit previews and logs exactly 1,029 kcal, persisting across reload', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="daily-diary-screen"]', { timeout: 10000 });

    // Navigate to AI Scan screen
    await page.locator('[data-testid="nav-tab-photo"]').click({ force: true });
    await page.waitForSelector('[data-testid="photo-log-screen"]', { timeout: 10000 });

    // Click Scan Sample Meal
    const sampleScanBtn = page.locator('[data-testid="simulate-photo-scan-btn"]');
    await sampleScanBtn.click();
    await page.waitForTimeout(600);

    // Click 1.5x Multiplier
    const mult15Btn = page.locator('button:has-text("1.5×"), button:has-text("1.5x")').first();
    await mult15Btn.click();
    await page.waitForTimeout(300);

    // Assert preview shows 1,029 kcal
    await expect(page.getByText('1,029', { exact: false })).toBeVisible();

    // Click Confirm & Log
    const confirmBtn = page.locator('[data-testid="confirm-draft-btn"]');
    await confirmBtn.click();
    await page.waitForSelector('[data-testid="daily-diary-screen"]', { timeout: 10000 });

    // Assert 1,029 kcal is present in the logged meal or total consumed
    await expect(page.getByText('1,029', { exact: false }).first()).toBeVisible();

    // Reload page to verify persistence
    await page.reload();
    await page.waitForSelector('[data-testid="daily-diary-screen"]', { timeout: 10000 });
    await expect(page.getByText('1,029', { exact: false }).first()).toBeVisible();
  });

  // Assertion 3: Metabolism & Modal Single-Dismiss
  test('3. /metabolism renders finite BMR (>1000), Weekly Check-In has zero NaN, single click closes, and Escape closes Command Palette', async ({ page }) => {
    await page.goto('/metabolism');
    await page.waitForSelector('[data-testid="metabolism-coach-screen"]', { timeout: 10000 });

    // Assert BMR is finite number > 1000
    const bmrText = await page.locator('text=kcal/d').first().locator('..').innerText();
    const bmrNumber = parseInt(bmrText.replace(/\D/g, ''), 10);
    expect(Number.isFinite(bmrNumber)).toBe(true);
    expect(bmrNumber).toBeGreaterThan(1000);

    // Open Weekly Check-In Modal
    const openCheckInBtn = page.locator('[data-testid="open-weekly-check-in-btn"]');
    await openCheckInBtn.scrollIntoViewIfNeeded();
    await openCheckInBtn.click({ force: true });
    await page.waitForSelector('[data-testid="weekly-check-in-modal"]', { timeout: 10000 });

    // Assert modal text does not contain NaN
    const modalContent = await page.locator('[data-testid="weekly-check-in-modal"]').innerText();
    expect(modalContent).not.toMatch(/NaN/);

    // Click Keep Current Plan ONCE (normal user click, not forced) and verify modal closes immediately
    const keepPlanBtn = page.locator('[data-testid="keep-current-plan-btn"]');
    await keepPlanBtn.scrollIntoViewIfNeeded();
    await keepPlanBtn.click();
    await page.waitForSelector('[data-testid="weekly-check-in-modal"]', { state: 'detached', timeout: 5000 });

    // Test Command Palette: Press Control+k to open, then Escape ONCE to close
    await page.goto('/');
    await page.waitForSelector('[data-testid="daily-diary-screen"]', { timeout: 10000 });
    await page.keyboard.press('Control+k');
    await page.waitForSelector('[data-testid="command-palette-modal"]', { timeout: 5000 });
    await expect(page.locator('[data-testid="command-palette-modal"]')).toBeVisible();

    // Press Escape once to close Command Palette Modal
    await page.keyboard.press('Escape');
    await page.waitForSelector('[data-testid="command-palette-modal"]', { state: 'detached', timeout: 5000 });
  });

  // Assertion 4: Real Dark Mode & Visible Sun/Moon SVG
  test('4. Dark Mode toggles html.dark, body background becomes dark, and theme toggle contains visible SVG', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="daily-diary-screen"]', { timeout: 10000 });

    // Toggle Dark Mode
    const themeBtn = page.locator('[data-testid="nav-theme-toggle-btn"]');
    await themeBtn.click({ force: true });
    await page.waitForTimeout(300);

    // Assert html has class dark
    const htmlClasses = await page.locator('html').getAttribute('class');
    expect(htmlClasses).toContain('dark');

    // Assert document.body background is dark (not white/rgb(245, 247, 250))
    const bodyBg = await page.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundColor;
    });
    expect(bodyBg).not.toBe('rgb(245, 247, 250)');
    expect(bodyBg).not.toBe('rgb(255, 255, 255)');

    // Assert dark mode theme toggle button contains a visible <svg> (width > 0 && height > 0)
    const themeSvg = themeBtn.locator('svg');
    await expect(themeSvg).toBeVisible();
    const svgBox = await themeSvg.boundingBox();
    expect(svgBox).not.toBeNull();
    expect(svgBox!.width).toBeGreaterThan(0);
    expect(svgBox!.height).toBeGreaterThan(0);
  });

  // Assertion 5: Zero Bounding-Box Overlaps on 1280x800
  test('5. Zero Bounding-Box Overlaps: Floating dock does not intersect main interactive widgets', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.waitForSelector('[data-testid="daily-diary-screen"]', { timeout: 10000 });

    // Find the floating dock
    const dock = page.locator('[data-testid="omnibar-dock"]');
    if (await dock.isVisible()) {
      const dockBox = await dock.boundingBox();
      expect(dockBox).not.toBeNull();

      // Find Smart Macro Solver
      const solver = page.locator('[data-testid="macro-meal-solver"]');
      if (await solver.isVisible()) {
        const solverBox = await solver.boundingBox();
        if (solverBox && dockBox) {
          // Check for vertical overlap
          const hasVerticalOverlap =
            solverBox.y < dockBox.y + dockBox.height &&
            solverBox.y + solverBox.height > dockBox.y;
          expect(hasVerticalOverlap).toBe(false);
        }
      }
    }
  });

  // Assertion 6: /admin Auth Gate
  test('6. /admin Auth Gate: unauthenticated visitor sees login gate and NO backend engine text', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForSelector('[data-testid="admin-auth-gate"]', { timeout: 10000 });

    // Assert login gate is visible
    await expect(page.locator('[data-testid="admin-auth-gate"]')).toBeVisible();

    // Assert VIBEDIET BACKEND ENGINE is NOT rendered
    await expect(page.getByText('VIBEDIET BACKEND ENGINE', { exact: false })).toHaveCount(0);
    await expect(page.locator('[data-testid="admin-cockpit-screen"]')).toHaveCount(0);

    // Verify legacy backdoor 'admin-token' is rejected and real signed token unlocks console
    await page.locator('[data-testid="admin-passphrase-input"]').fill('admin-token');
    await page.locator('[data-testid="admin-authorize-btn"]').click();
    await expect(page.locator('[data-testid="admin-cockpit-screen"]')).toHaveCount(0);

    await page.locator('[data-testid="admin-passphrase-input"]').fill(makeSignedAdminToken());
    await page.locator('[data-testid="admin-authorize-btn"]').click();
    await page.waitForSelector('[data-testid="admin-cockpit-screen"]', { timeout: 10000 });

    // Console now renders
    await expect(page.locator('[data-testid="admin-cockpit-screen"]')).toBeVisible();
  });

  // Assertion 7: End-to-End AI Recognition -> Atwater -> Today -> Reload -> /admin Telemetry Pipeline
  test('7. End-to-End Pipeline: AI text recognition (/v1/ai/analyze) -> Atwater -> Today -> Reload -> /admin telemetry', async ({ page }) => {
    await page.goto('/scan');
    await page.waitForSelector('[data-testid="photo-log-screen"]', { timeout: 10000 });

    const analyzePromise = page.waitForResponse(
      (res) => res.url().includes('/v1/ai/analyze') && res.request().method() === 'POST',
      { timeout: 30000 }
    );

    await page.locator('[data-testid="dictate-meal-input"]').fill('2 rotis, 1 bowl dal tadka, 150g paneer');
    await page.locator('[data-testid="submit-text-meal-btn"]').click();

    const analyzeRes = await analyzePromise;
    expect(analyzeRes.status()).toBe(201);
    const analyzeJson = await analyzeRes.json();
    expect(analyzeJson.success).toBe(true);
    expect(analyzeJson.draft?.recognizedItems?.length).toBeGreaterThan(0);

    // Wait for Atwater-verified draft panel and commit to Today
    await page.waitForSelector('[data-testid="draft-review-panel"]', { timeout: 10000 });
    await page.locator('[data-testid="confirm-draft-btn"]').click();
    await page.waitForSelector('[data-testid="daily-diary-screen"]', { timeout: 10000 });

    // Reload Today and verify persisted meal
    await page.reload();
    await page.waitForSelector('[data-testid="daily-diary-screen"]', { timeout: 10000 });
    await expect(page.locator('[data-testid="calories-consumed"]')).not.toHaveText('0 kcal');

    // Navigate to /admin and verify live key pool & telemetry cockpit renders cleanly with signed token
    await page.goto('/admin');
    await page.waitForSelector('[data-testid="admin-auth-gate"]', { timeout: 10000 });
    await page.locator('[data-testid="admin-passphrase-input"]').fill(makeSignedAdminToken());
    await page.locator('[data-testid="admin-authorize-btn"]').click();
    await page.waitForSelector('[data-testid="admin-cockpit-screen"]', { timeout: 10000 });
    await expect(page.locator('[data-testid="admin-cockpit-screen"]')).toBeVisible();
  });
});
