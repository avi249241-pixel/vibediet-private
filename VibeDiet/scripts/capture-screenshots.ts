import { chromium } from '@playwright/test';

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  // 1. Today Screen (Apple Daylight Light Mode)
  await page.goto('http://127.0.0.1:3000/');
  await page.waitForSelector('[data-testid="daily-diary-screen"]');
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: 'C:/Users/coder/.gemini/antigravity/brain/ba2a4e52-354c-411d-8ef7-4914a327cac4/screenshot-apple-daylight-today-verified.png',
    fullPage: false,
  });
  console.log('1. Today screenshot captured');

  // 2. AI Scan Screen
  await page.getByTestId('nav-tab-photo').click();
  await page.waitForTimeout(800);
  await page.screenshot({
    path: 'C:/Users/coder/.gemini/antigravity/brain/ba2a4e52-354c-411d-8ef7-4914a327cac4/screenshot-apple-daylight-scan-verified.png',
    fullPage: false,
  });
  console.log('2. AI Scan screenshot captured');

  // 3. Food Search Screen
  await page.getByTestId('nav-tab-manual').click();
  await page.waitForTimeout(800);
  await page.screenshot({
    path: 'C:/Users/coder/.gemini/antigravity/brain/ba2a4e52-354c-411d-8ef7-4914a327cac4/screenshot-food-search-verified.png',
    fullPage: false,
  });
  console.log('3. Food Search screenshot captured');

  // 4. Metabolism Coach Screen
  await page.getByTestId('nav-tab-coach').click();
  await page.waitForTimeout(800);
  await page.screenshot({
    path: 'C:/Users/coder/.gemini/antigravity/brain/ba2a4e52-354c-411d-8ef7-4914a327cac4/screenshot-metabolism-verified.png',
    fullPage: false,
  });
  console.log('4. Metabolism screenshot captured');

  // 4b. Weekly Check-In Modal
  await page.getByText('Weekly Check-In').click();
  await page.waitForTimeout(600);
  await page.screenshot({
    path: 'C:/Users/coder/.gemini/antigravity/brain/ba2a4e52-354c-411d-8ef7-4914a327cac4/screenshot-checkin-modal.png',
    fullPage: false,
  });
  console.log('4b. Check-in modal screenshot captured');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  // 5. Onboarding Screen
  await page.getByTestId('nav-tab-onboarding').click();
  await page.waitForTimeout(800);
  await page.screenshot({
    path: 'C:/Users/coder/.gemini/antigravity/brain/ba2a4e52-354c-411d-8ef7-4914a327cac4/screenshot-onboarding-verified.png',
    fullPage: false,
  });
  console.log('5. Onboarding screenshot captured');

  // 6. Profile Screen
  await page.getByTestId('nav-tab-profile').click();
  await page.waitForTimeout(800);
  await page.screenshot({
    path: 'C:/Users/coder/.gemini/antigravity/brain/ba2a4e52-354c-411d-8ef7-4914a327cac4/screenshot-profile-verified.png',
    fullPage: false,
  });
  console.log('6. Profile screenshot captured');

  // 7. Dark Mode Toggle
  await page.getByTestId('nav-tab-diary').click();
  await page.waitForTimeout(600);
  await page.getByTestId('nav-theme-toggle-btn').click();
  await page.waitForTimeout(800);
  await page.screenshot({
    path: 'C:/Users/coder/.gemini/antigravity/brain/ba2a4e52-354c-411d-8ef7-4914a327cac4/screenshot-dark-mode-today-verified.png',
    fullPage: false,
  });
  console.log('7. Dark Mode screenshot captured');

  await browser.close();
  console.log('All screenshots captured successfully!');
}

main().catch(console.error);
