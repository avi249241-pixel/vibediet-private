import { test, expect } from '@playwright/test';

test.describe('Milestone 1 Empirical Challenger Verification Suite', () => {

  test('EMPIRICAL-CHALLENGE 1: Header DOM Forensics & Zero Admin/Telemetry Bleed', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('daily-diary-screen')).toBeVisible();

    const header = page.locator('header');
    await expect(header).toBeVisible();

    // 1. Text Content & InnerHTML Inspection
    const textContent = (await header.textContent()) || '';
    const innerHTML = (await header.innerHTML()) || '';

    // Must not contain any admin or backend telemetry strings
    const prohibitedSubstrings = [
      'admin',
      'system',
      'keys active',
      'ram',
      'telemetry',
      'single-user',
      'high-security',
      'cockpit',
      'console',
      'legal',
      'biometrics',
    ];

    for (const term of prohibitedSubstrings) {
      expect(textContent.toLowerCase()).not.toContain(term.toLowerCase());
      expect(innerHTML.toLowerCase()).not.toContain(`>${term}<`);
    }

    // 2. Button and Nav Node Count
    const buttons = header.locator('button');
    const buttonCount = await buttons.count();
    expect(buttonCount).toBe(5);

    const navs = header.locator('nav');
    expect(await navs.count()).toBe(1);

    // 3. Exactly the 5 consumer tabs
    const expectedTestIds = [
      'nav-tab-diary',
      'nav-tab-photo',
      'nav-tab-manual',
      'nav-tab-coach',
      'nav-tab-profile',
    ];

    for (let i = 0; i < 5; i++) {
      const btn = buttons.nth(i);
      const testId = await btn.getAttribute('data-testid');
      expect(testId).toBe(expectedTestIds[i]);
      await expect(btn).toBeVisible();
      // Ensure opacity > 0
      const opacity = await btn.evaluate((el) => window.getComputedStyle(el).opacity);
      expect(parseFloat(opacity)).toBeGreaterThan(0);
    }

    // 4. Spacer Inspection: Must not contain hidden buttons or text
    const spacer = header.locator('div.w-8');
    if ((await spacer.count()) > 0) {
      const spacerChildren = await spacer.evaluate((el) => el.children.length);
      const spacerText = await spacer.evaluate((el) => (el.textContent || '').trim());
      expect(spacerChildren).toBe(0);
      expect(spacerText).toBe('');
    }

    // 5. Check no hidden / zero-opacity buttons exist anywhere in header
    const zeroOpacityElements = await header.evaluate((el) => {
      const all = Array.from(el.querySelectorAll('*'));
      return all.filter((child) => {
        const style = window.getComputedStyle(child);
        return style.opacity === '0' || child.classList.contains('opacity-0');
      }).length;
    });
    expect(zeroOpacityElements).toBe(0);
  });

  test('EMPIRICAL-CHALLENGE 2: Strict Mode Verification for nav-tab-onboarding, nav-tab-admin, open-legal-header-btn', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('daily-diary-screen')).toBeVisible();

    // 1. Strict Mode Count on Homepage
    const onboardingLoc = page.locator('[data-testid="nav-tab-onboarding"]');
    const adminLoc = page.locator('[data-testid="nav-tab-admin"]');
    const legalLoc = page.locator('[data-testid="open-legal-header-btn"]');

    expect(await onboardingLoc.count()).toBe(1);
    expect(await adminLoc.count()).toBe(1);
    expect(await legalLoc.count()).toBe(1);

    // 2. Playwright getByTestId single-element resolution (will throw Strict Mode Violation if count > 1)
    await page.getByTestId('nav-tab-onboarding').click();
    await expect(page.getByTestId('onboarding-wizard')).toBeVisible();
    await page.getByTestId('save-onboarding-btn').click();
    await expect(page.getByTestId('daily-diary-screen')).toBeVisible();

    await page.getByTestId('open-legal-header-btn').click();
    await expect(page.getByTestId('legal-modal')).toBeVisible();
    await page.getByTestId('close-legal-modal-btn').click();
    await expect(page.getByTestId('legal-modal')).not.toBeVisible();

    await page.getByTestId('nav-tab-admin').click();
    await page.waitForSelector('[data-testid="admin-auth-gate"], [data-testid="admin-cockpit-screen"]', { timeout: 10000 });
    const gate = page.locator('[data-testid="admin-auth-gate"]');
    if (await gate.isVisible()) {
      await page.locator('[data-testid="admin-passphrase-input"]').fill(process.env.ADMIN_ACCESS_TOKEN || 'dummy_admin_secret_token_gate_pass_ci');
      await page.locator('[data-testid="admin-authorize-btn"]').click();
    }
    await expect(page.getByTestId('admin-cockpit-screen')).toBeVisible();
    await page.getByTestId('nav-tab-diary').click();
    await expect(page.getByTestId('daily-diary-screen')).toBeVisible();
  });

  test('EMPIRICAL-CHALLENGE 3: Global TestId Collision Audit Across All Consumer Screens', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('daily-diary-screen')).toBeVisible();

    const tabsToTest = [
      'nav-tab-diary',
      'nav-tab-photo',
      'nav-tab-manual',
      'nav-tab-coach',
      'nav-tab-profile',
    ];

    for (const tabId of tabsToTest) {
      await page.getByTestId(tabId).click();

      // Check locator uniqueness on each active tab
      const onboardingCount = await page.locator('[data-testid="nav-tab-onboarding"]').count();
      const adminCount = await page.locator('[data-testid="nav-tab-admin"]').count();
      const legalCount = await page.locator('[data-testid="open-legal-header-btn"]').count();
      const cockpitCount = await page.locator('[data-testid="switch-admin-cockpit"]').count();

      expect(onboardingCount).toBe(1);
      expect(adminCount).toBe(1);
      expect(legalCount).toBe(1);
      expect(cockpitCount).toBe(1);

      // Verify header strictly keeps 5 tabs
      const headerBtns = await page.locator('header button').count();
      expect(headerBtns).toBe(5);
    }
  });

});
