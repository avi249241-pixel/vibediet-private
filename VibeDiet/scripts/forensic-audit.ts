import { chromium } from '@playwright/test';

interface AuditResult {
  tab: string;
  viewport: string;
  hasHorizontalOverflow: boolean;
  scrollWidth: number;
  clientWidth: number;
  telemetryLeaks: string[];
  notes: string[];
}

const FORBIDDEN_TELEMETRY = [
  'Keys Active',
  'MB RAM',
  'System & Keys',
  'Round-Robin Swarm',
  'Founder & Revenue Portal',
];

async function runAudit() {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const results: AuditResult[] = [];

  const viewports = [
    { name: 'Desktop', width: 1440, height: 900 },
    { name: 'Mobile', width: 390, height: 844 },
  ];

  const tabs = [
    { id: 'nav-tab-diary', name: 'Today' },
    { id: 'nav-tab-photo', name: 'AI Scan' },
    { id: 'nav-tab-manual', name: 'Food Search' },
    { id: 'nav-tab-coach', name: 'Metabolism' },
    { id: 'nav-tab-profile', name: 'Profile' },
  ];

  for (const vp of viewports) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();

    await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    for (const tab of tabs) {
      await page.getByTestId(tab.id).click();
      await page.waitForTimeout(600);

      const overflow = await page.evaluate(() => {
        return {
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          hasOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        };
      });

      const bodyText = (await page.textContent('body')) || '';
      const leaks = FORBIDDEN_TELEMETRY.filter((pattern) => bodyText.includes(pattern));

      const notes: string[] = [];
      if (tab.name === 'Today') {
        const hasRing = await page.locator('svg circle').count();
        notes.push(`Ring SVG circles: ${hasRing}`);
      }
      if (tab.name === 'AI Scan') {
        const hasDraftBtn = await page.getByTestId('simulate-photo-scan-btn').count();
        notes.push(`Sample scan btn: ${hasDraftBtn}`);
      }

      results.push({
        tab: tab.name,
        viewport: `${vp.name} (${vp.width}x${vp.height})`,
        hasHorizontalOverflow: overflow.hasOverflow,
        scrollWidth: overflow.scrollWidth,
        clientWidth: overflow.clientWidth,
        telemetryLeaks: leaks,
        notes,
      });
    }

    await context.close();
  }

  await browser.close();
  console.log(JSON.stringify(results, null, 2));
}

runAudit().catch(console.error);
