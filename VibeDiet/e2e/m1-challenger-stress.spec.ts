import { test, expect } from '@playwright/test';

async function unlockAdminGate(page: any) {
  await page.waitForSelector('[data-testid="admin-auth-gate"], [data-testid="admin-cockpit-screen"]', { timeout: 10000 });
  const gate = page.locator('[data-testid="admin-auth-gate"]');
  if (await gate.isVisible()) {
    await page.locator('[data-testid="admin-passphrase-input"]').fill(process.env.ADMIN_ACCESS_TOKEN || 'dummy_admin_secret_token_gate_pass_ci');
    await page.locator('[data-testid="admin-authorize-btn"]').click();
  }
  await page.waitForSelector('[data-testid="admin-cockpit-screen"]', { timeout: 10000 });
}

test.describe('Milestone 1 Adversarial Challenge & Stress Suite', () => {

  test('CHALLENGE 1: Telemetry Zero-Leakage & Consumer Header Integrity', async ({ page }) => {
    // Intercept network requests to verify no background admin telemetry polling occurs in consumer view
    const adminApiRequests: string[] = [];
    page.on('request', (req) => {
      const url = req.url();
      if (url.includes('/v1/admin/overview') || url.includes('/v1/admin/keys')) {
        adminApiRequests.push(url);
      }
    });

    await page.goto('/');
    await expect(page.getByTestId('daily-diary-screen')).toBeVisible();

    // Verify consumer header exists
    const header = page.locator('header');
    await expect(header).toBeVisible();

    // Challenge 1.1: Ensure NO admin telemetry appears anywhere in the header
    await expect(header).not.toContainText('Keys Active');
    await expect(header).not.toContainText('MB RAM');
    await expect(header).not.toContainText('Single-User High-Security Macro & Vision AI');
    await expect(header).not.toContainText('System & Keys');
    await expect(header).not.toContainText('Admin');

    // Challenge 1.2: Check exactly 5 consumer tabs in the header navigation
    const navButtons = header.locator('nav button');
    await expect(navButtons).toHaveCount(5);

    const expectedTabs = [
      { id: 'nav-tab-diary', label: 'Today', icon: '✨' },
      { id: 'nav-tab-photo', label: 'AI Meal Scan', icon: '📸' },
      { id: 'nav-tab-manual', label: 'Food Search', icon: '🔍' },
      { id: 'nav-tab-coach', label: 'Metabolism', icon: '🧬' },
      { id: 'nav-tab-profile', label: 'Profile', icon: '👤' },
    ];

    for (let i = 0; i < expectedTabs.length; i++) {
      const btn = navButtons.nth(i);
      await expect(btn).toHaveAttribute('data-testid', expectedTabs[i].id);
      await expect(btn).toContainText(expectedTabs[i].label);
      await expect(btn).toContainText(expectedTabs[i].icon);
    }

    // Challenge 1.3: Verify admin dashboard screen is completely absent
    await expect(page.getByTestId('admin-cockpit-screen')).not.toBeAttached();

    // Wait a brief period to ensure no delayed polling triggers
    await page.waitForTimeout(1000);
    expect(adminApiRequests).toHaveLength(0);
  });

  test('CHALLENGE 2: Dedicated /admin Route Isolation & Return Round-Trip', async ({ page }) => {
    // Direct navigation to /admin
    await page.goto('/admin');
    await unlockAdminGate(page);
    await expect(page.getByTestId('admin-cockpit-screen')).toBeVisible();

    // Verify complete absence of consumer chrome in admin mode
    await expect(page.locator('header')).not.toBeAttached();
    await expect(page.getByTestId('omnibar-dock')).not.toBeAttached();
    await expect(page.locator('footer')).not.toBeAttached();

    // Verify dedicated admin top bar contents
    await expect(page.getByText('⚡ VibeDiet Backend Engine & Key Pool Console')).toBeVisible();
    await expect(page.getByText('http://127.0.0.1:3000/admin')).toBeVisible();

    const returnBtn = page.getByTestId('nav-tab-diary');
    await expect(returnBtn).toBeVisible();
    await expect(returnBtn).toContainText('← Open Consumer App (127.0.0.1:3000)');

    // Click return button to go back to consumer app
    await returnBtn.click();

    // Assert consumer view is fully restored
    await expect(page.getByTestId('daily-diary-screen')).toBeVisible();
    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('header nav button')).toHaveCount(5);
    await expect(page.getByTestId('admin-cockpit-screen')).not.toBeAttached();

    // Verify pathname reset to '/'
    const currentUrl = new URL(page.url());
    expect(currentUrl.pathname).toBe('/');
    expect(currentUrl.hash).toBe('');
  });

  test('CHALLENGE 3: Dedicated /#admin Hash Route Isolation & Return', async ({ page }) => {
    await page.goto('/#admin');
    await unlockAdminGate(page);
    await expect(page.getByTestId('admin-cockpit-screen')).toBeVisible();

    // Consumer chrome must NOT be attached
    await expect(page.locator('header')).not.toBeAttached();
    await expect(page.getByTestId('omnibar-dock')).not.toBeAttached();

    // Return to consumer app
    const returnBtn = page.getByTestId('nav-tab-diary');
    await returnBtn.click();

    // Consumer app restored
    await expect(page.getByTestId('daily-diary-screen')).toBeVisible();
    await expect(page.locator('header')).toBeVisible();
    await expect(page.getByTestId('admin-cockpit-screen')).not.toBeAttached();

    const currentUrl = new URL(page.url());
    expect(currentUrl.hash).toBe('');
  });

  test('CHALLENGE 4A: Trailing Slash Subpath (/admin/) Asset Loading & Route Isolation', async ({ page }) => {
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log('PAGE CONSOLE ERROR:', msg.text());
    });
    page.on('pageerror', (err) => console.log('PAGE UNHANDLED ERROR:', err.message));

    // Subpath /admin/ with trailing slash
    await page.goto('/admin/');
    await unlockAdminGate(page);
    await expect(page.getByTestId('admin-cockpit-screen')).toBeVisible();
    await expect(page.locator('header')).not.toBeAttached();
  });

  test('CHALLENGE 4B: Query Parameter (?admin=1) Route Isolation & Return', async ({ page }) => {
    // Query param ?admin=1
    await page.goto('/?admin=1');
    await unlockAdminGate(page);
    await expect(page.getByTestId('admin-cockpit-screen')).toBeVisible();
    await expect(page.locator('header')).not.toBeAttached();

    // Return from query param admin
    await page.getByTestId('nav-tab-diary').click();
    await expect(page.getByTestId('daily-diary-screen')).toBeVisible();
  });

  test('CHALLENGE 5: Browser History (Back / Forward) Traversal Stress', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('daily-diary-screen')).toBeVisible();

    // Navigate to admin via footer trigger
    await page.getByTestId('nav-tab-admin').click();
    await unlockAdminGate(page);
    await expect(page.getByTestId('admin-cockpit-screen')).toBeVisible();
    await expect(page.locator('header')).not.toBeAttached();

    // Browser Back
    await page.goBack();
    await expect(page.getByTestId('daily-diary-screen')).toBeVisible();
    await expect(page.locator('header')).toBeVisible();
    await expect(page.getByTestId('admin-cockpit-screen')).not.toBeAttached();

    // Browser Forward
    await page.goForward();
    await unlockAdminGate(page);
    await expect(page.getByTestId('admin-cockpit-screen')).toBeVisible();
    await expect(page.locator('header')).not.toBeAttached();

    // Return via button
    await page.getByTestId('nav-tab-diary').click();
    await expect(page.getByTestId('daily-diary-screen')).toBeVisible();
  });

  test('CHALLENGE 6: Rapid Consumer Tab Switching & Zero Admin State Leakage', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('daily-diary-screen')).toBeVisible();

    // Rapid switching between consumer tabs
    await page.getByTestId('nav-tab-photo').click();
    await expect(page.getByTestId('demo-ai-mode-banner')).toBeVisible();
    await expect(page.getByTestId('admin-cockpit-screen')).not.toBeAttached();

    await page.getByTestId('nav-tab-manual').click();
    await expect(page.getByTestId('manual-entry-screen')).toBeVisible();
    await expect(page.getByTestId('admin-cockpit-screen')).not.toBeAttached();

    await page.getByTestId('nav-tab-coach').click();
    await expect(page.getByTestId('metabolism-coach-screen')).toBeVisible();
    await expect(page.getByTestId('admin-cockpit-screen')).not.toBeAttached();

    await page.getByTestId('nav-tab-profile').click();
    await expect(page.getByTestId('profile-screen')).toBeVisible();
    await expect(page.getByTestId('admin-cockpit-screen')).not.toBeAttached();

    await page.getByTestId('nav-tab-diary').click();
    await expect(page.getByTestId('daily-diary-screen')).toBeVisible();
    await expect(page.getByTestId('admin-cockpit-screen')).not.toBeAttached();

    // Verify header still has exactly 5 consumer buttons
    await expect(page.locator('header nav button')).toHaveCount(5);
  });

  test('CHALLENGE 7: Express Static Asset & Direct Route Response Status', async ({ request }) => {
    // Test direct server responses
    const resRoot = await request.get('/');
    expect(resRoot.status()).toBe(200);
    expect(resRoot.headers()['content-type']).toContain('text/html');

    const resAdmin = await request.get('/admin');
    expect(resAdmin.status()).toBe(200);
    expect(resAdmin.headers()['content-type']).toContain('text/html');

    const resAdminSlash = await request.get('/admin/');
    expect(resAdminSlash.status()).toBe(200);
    expect(resAdminSlash.headers()['content-type']).toContain('text/html');

    const resAdminHtml = await request.get('/admin.html');
    expect(resAdminHtml.status()).toBe(200);
    expect(resAdminHtml.headers()['content-type']).toContain('text/html');

    const resHealth = await request.get('/health');
    expect(resHealth.status()).toBe(200);
    const healthJson = await resHealth.json();
    expect(healthJson.status).toBe('ok');
  });

});
