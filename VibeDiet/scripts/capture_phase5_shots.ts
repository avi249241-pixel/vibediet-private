import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });

  // 1. Desktop Admin Cockpit
  const page1 = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page1.goto('http://127.0.0.1:3000/admin');
  await page1.waitForSelector('[data-testid="admin-cockpit-screen"]', { timeout: 10000 });
  await page1.screenshot({
    path: 'C:/Users/coder/.gemini/antigravity/brain/ba2a4e52-354c-411d-8ef7-4914a327cac4/screenshot-phase5-admin-cockpit.png',
    fullPage: true,
  });

  // 2. Mobile View Today Screen
  const page2 = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page2.goto('http://127.0.0.1:3000/');
  await page2.waitForSelector('[data-testid="daily-diary-screen"]', { timeout: 10000 });
  await page2.screenshot({
    path: 'C:/Users/coder/.gemini/antigravity/brain/ba2a4e52-354c-411d-8ef7-4914a327cac4/screenshot-phase5-mobile-today.png',
  });

  // 3. Weekly Check-In Modal
  await page1.goto('http://127.0.0.1:3000/');
  await page1.click('[data-testid="nav-tab-coach"]');
  await page1.waitForSelector('[data-testid="open-weekly-check-in-btn"]', { timeout: 10000 });
  await page1.click('[data-testid="open-weekly-check-in-btn"]');
  await page1.waitForSelector('[data-testid="weekly-check-in-modal"]', { timeout: 10000 });
  await page1.screenshot({
    path: 'C:/Users/coder/.gemini/antigravity/brain/ba2a4e52-354c-411d-8ef7-4914a327cac4/screenshot-phase5-weekly-checkin.png',
  });

  // 4. Admin Access Control Gate (unauthenticated / guest mode)
  const page4 = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page4.addInitScript(() => {
    window.localStorage.setItem('vibediet_guest_mode', 'true');
    window.localStorage.removeItem('vibediet_admin_token');
  });
  await page4.goto('http://127.0.0.1:3000/admin');
  await page4.waitForSelector('[data-testid="admin-auth-gate"]', { timeout: 10000 });
  await page4.screenshot({
    path: 'C:/Users/coder/.gemini/antigravity/brain/ba2a4e52-354c-411d-8ef7-4914a327cac4/screenshot-phase5-admin-gate.png',
  });

  await browser.close();
  console.log('Phase 5 screenshots captured successfully!');
})();
