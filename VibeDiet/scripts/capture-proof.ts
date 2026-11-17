import { chromium } from '@playwright/test';
import path from 'node:path';
import { spawn, ChildProcess } from 'node:child_process';

async function ensureServerRunning(): Promise<ChildProcess | null> {
  try {
    const res = await fetch('http://127.0.0.1:3000/health');
    if (res.ok) return null;
  } catch {}

  console.log('Starting local dev server for screenshot proof capture...');
  const isWindows = process.platform === 'win32';
  const npmCmd = isWindows ? 'npm.cmd' : 'npm';
  const proc = spawn(npmCmd, ['run', 'dev'], {
    shell: true,
    stdio: 'ignore',
    env: { ...process.env, VIBEDIET_DATA_DIR: '.tmp-playwright-data' },
  });

  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch('http://127.0.0.1:3000/health');
      if (res.ok) {
        console.log('Dev server ready!');
        return proc;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  return proc;
}

async function main() {
  const serverProc = await ensureServerRunning();

  const browser = await chromium.launch({
    headless: true,
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();

    console.log('1. Capturing proof-consumer-today.png and dist/screenshot-apple-daylight-today.png...');
    await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="daily-diary-screen"]', { timeout: 15000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.resolve('proof-consumer-today.png'), fullPage: false });
    await page.screenshot({ path: path.resolve('dist/screenshot-apple-daylight-today.png'), fullPage: false });

    console.log('2. Capturing proof-ai-scan.png and dist/screenshot-apple-daylight-scan.png...');
    await page.getByTestId('nav-tab-photo').click();
    await page.waitForTimeout(600);
    await page.getByTestId('simulate-photo-scan-btn').click();
    await page.waitForSelector('[data-testid="draft-review-panel"]', { timeout: 10000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.resolve('proof-ai-scan.png'), fullPage: false });
    await page.screenshot({ path: path.resolve('dist/screenshot-apple-daylight-scan.png'), fullPage: false });

    console.log('3. Capturing proof-food-search.png...');
    await page.getByTestId('nav-tab-manual').click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.resolve('proof-food-search.png'), fullPage: false });

    console.log('4. Capturing proof-metabolism.png with Weekly Check-In Modal...');
    await page.getByTestId('nav-tab-coach').click();
    await page.waitForTimeout(600);
    await page.getByTestId('open-weekly-check-in-btn').click();
    await page.waitForSelector('[data-testid="weekly-check-in-modal"]', { timeout: 5000 });
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.resolve('proof-metabolism.png'), fullPage: false });
    await page.getByTestId('close-weekly-check-in-btn').click();
    await page.waitForTimeout(600);

    console.log('5. Capturing proof-profile.png...');
    await page.getByTestId('nav-tab-profile').click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.resolve('proof-profile.png'), fullPage: false });

    console.log('6. Capturing proof-barcode-modal.png...');
    await page.getByTestId('nav-tab-diary').click();
    await page.waitForTimeout(600);
    await page.getByTestId('open-barcode-scanner-btn').click();
    await page.waitForSelector('[data-testid="barcode-scanner-modal"]', { timeout: 5000 });
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.resolve('proof-barcode-modal.png'), fullPage: false });
    await page.getByTestId('barcode-close-btn').click();
    await page.waitForTimeout(600);

    console.log('7. Capturing proof-command-palette.png...');
    await page.keyboard.press('Control+KeyK');
    await page.waitForSelector('[data-testid="command-palette-modal"]', { timeout: 5000 });
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.resolve('proof-command-palette.png'), fullPage: false });

    console.log('All 7 proof screenshots successfully generated at 1440x900 resolution!');
  } finally {
    await browser.close();
    if (serverProc) {
      serverProc.kill();
    }
  }
}

main().catch((err) => {
  console.error('Proof capture failed:', err);
  process.exit(1);
});
