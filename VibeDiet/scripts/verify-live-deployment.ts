import { chromium } from '@playwright/test';
import * as path from 'path';

async function verify() {
  console.log('--- Step 1 & 2: HTTP Headers & sw.js verification ---');

  const rootRes = await fetch('https://vibediet-app.netlify.app/');
  console.log('Root status:', rootRes.status);
  const cacheControl = rootRes.headers.get('cache-control') || '';
  console.log('Cache-Control:', cacheControl);
  if (!cacheControl.includes('must-revalidate')) {
    throw new Error(`Expected must-revalidate in Cache-Control, got: ${cacheControl}`);
  }

  const swRes = await fetch('https://vibediet-app.netlify.app/sw.js');
  console.log('sw.js status:', swRes.status);
  const swText = await swRes.text();
  const hasCacheName = swText.includes('vibediet-static-v3.1.0');
  const hasSkipWaiting = swText.includes('skipWaiting()');
  console.log('sw.js has CACHE_NAME vibediet-static-v3.1.0:', hasCacheName);
  console.log('sw.js has skipWaiting():', hasSkipWaiting);
  if (!hasCacheName || !hasSkipWaiting) {
    throw new Error('sw.js missing required cache name or skipWaiting');
  }

  const adminRes = await fetch('https://vibediet-app.netlify.app/admin');
  console.log('Admin route HTTP status:', adminRes.status);
  if (adminRes.status !== 200) {
    throw new Error(`Expected 200 for /admin, got ${adminRes.status}`);
  }

  console.log('\n--- Step 3: Playwright Headless Browser Verification ---');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  // 1. Visit root
  console.log('Navigating to https://vibediet-app.netlify.app ...');
  await page.goto('https://vibediet-app.netlify.app/', { waitUntil: 'networkidle' });

  // Verify title
  const title = await page.title();
  console.log('Page title:', title);

  // Verify navbar displays "v2.1.0 • DB Live"
  const bodyText = await page.textContent('body');
  const hasVersionTag = bodyText?.includes('v2.1.0 • DB Live');
  console.log('Navbar displays "v2.1.0 • DB Live":', hasVersionTag);
  if (!hasVersionTag) {
    throw new Error('Navbar does not display "v2.1.0 • DB Live"');
  }

  // Capture screenshot of live consumer app
  const consumerScreenshotPath = 'C:\\Users\\coder\\Desktop\\VibeDiet (1)\\screenshot-live-verified.png';
  await page.screenshot({ path: consumerScreenshotPath, fullPage: false });
  console.log('Consumer app screenshot saved to:', consumerScreenshotPath);

  // 2. Test clean route pushState (/today, /scan, /search, /metabolism, /profile, /admin)
  console.log('\n--- Testing PushState Routing ---');

  // /scan
  await page.click('[data-testid="nav-tab-photo"]');
  await page.waitForTimeout(500);
  console.log('URL after clicking AI Scan:', page.url());
  if (!page.url().endsWith('/scan')) throw new Error('Expected /scan URL');

  // /search
  await page.click('[data-testid="nav-tab-manual"]');
  await page.waitForTimeout(500);
  console.log('URL after clicking Food Search:', page.url());
  if (!page.url().endsWith('/search')) throw new Error('Expected /search URL');

  // /metabolism
  await page.click('[data-testid="nav-tab-coach"]');
  await page.waitForTimeout(500);
  console.log('URL after clicking Metabolism:', page.url());
  if (!page.url().endsWith('/metabolism')) throw new Error('Expected /metabolism URL');

  // /profile
  await page.click('[data-testid="nav-tab-profile"]');
  await page.waitForTimeout(500);
  console.log('URL after clicking Profile:', page.url());
  if (!page.url().endsWith('/profile')) throw new Error('Expected /profile URL');

  // /today
  await page.click('[data-testid="nav-tab-diary"]');
  await page.waitForTimeout(500);
  console.log('URL after clicking Today:', page.url());
  if (!page.url().endsWith('/today') && !page.url().endsWith('/')) throw new Error('Expected /today URL');

  // Direct navigation to /admin
  console.log('\nNavigating to https://vibediet-app.netlify.app/admin ...');
  await page.goto('https://vibediet-app.netlify.app/admin', { waitUntil: 'networkidle' });
  console.log('URL on admin navigation:', page.url());
  if (!page.url().includes('/admin')) throw new Error('Expected /admin URL');

  // Check admin cockpit or gate
  const gateEl = await page.$('[data-testid="admin-auth-gate"]');
  const cockpitEl = await page.$('[data-testid="admin-cockpit-screen"]');
  console.log('Admin Auth Gate visible:', !!gateEl, '| Admin Cockpit visible:', !!cockpitEl);

  if (gateEl) {
    console.log('Entering admin credentials into gate...');
    const input = await page.$('input[type="password"], input[type="text"]');
    if (input) {
      await input.fill('vibediet-admin-2026');
      const submitBtn = await page.$('button[type="submit"]');
      if (submitBtn) await submitBtn.click();
      await page.waitForTimeout(1000);
    }
  }

  const adminScreenshotPath = 'C:\\Users\\coder\\Desktop\\VibeDiet (1)\\screenshot-live-admin-verified.png';
  await page.screenshot({ path: adminScreenshotPath, fullPage: false });
  console.log('Admin console screenshot saved to:', adminScreenshotPath);

  await browser.close();
  console.log('\nAll Playwright live verifications PASSED successfully!');
}

verify().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
