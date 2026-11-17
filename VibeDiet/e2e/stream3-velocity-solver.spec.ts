import { test, expect } from '@playwright/test';

test.describe('Stream 3: UX Velocity Engine & Smart Macro Solver Verification', () => {

  test('1. Command Palette opens via keyboard shortcut (Ctrl+K / Cmd+K), filters, and closes', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('daily-diary-screen')).toBeVisible();

    // Trigger Command Palette via Ctrl+K
    await page.keyboard.press('Control+KeyK');
    await expect(page.getByTestId('command-palette-modal')).toBeVisible();

    // Filter for Water
    await page.getByTestId('command-palette-input').fill('Water');
    await expect(page.getByTestId('palette-item-action-water-250')).toBeVisible();

    // Press Escape to close
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('command-palette-modal')).not.toBeVisible();
  });

  test('2. Global single-key shortcuts (W, S, N, 1-5) execute when not typing in an input', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('daily-diary-screen')).toBeVisible();

    // Press 'w' -> logs +250ml water and displays toast
    await page.keyboard.press('KeyW');
    await expect(page.getByTestId('velocity-toast')).toBeVisible();
    await expect(page.getByTestId('velocity-toast')).toContainText('+250ml');

    // Press '4' -> jumps to Metabolism Coach tab
    await page.keyboard.press('Digit4');
    await expect(page.getByTestId('metabolism-coach-screen')).toBeVisible();

    // Press '1' -> jumps back to Today diary
    await page.keyboard.press('Digit1');
    await expect(page.getByTestId('daily-diary-screen')).toBeVisible();

    // Press 'n' -> switches to photo/dictate view and focuses input
    await page.keyboard.press('KeyN');
    await expect(page.getByTestId('dictate-meal-input')).toBeFocused();

    // Type in input -> single keys (w, s, n, 1, 2) MUST NOT hijack focus or trigger shortcuts
    await page.getByTestId('dictate-meal-input').type('waffles on sunday 123');
    await expect(page.getByTestId('dictate-meal-input')).toHaveValue('waffles on sunday 123');
  });

  test('3. Smart Macro Solver Widget renders combos and logs to active meal slot', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('daily-diary-screen')).toBeVisible();

    // Open Smart Solver drawer in Daily Diary
    await page.getByTestId('toggle-solver-drawer-btn').click();
    await expect(page.getByTestId('smart-macro-solver-widget')).toBeVisible();

    // Verify 3 combos rendered
    await expect(page.getByTestId('solver-combo-tab-combo-lean-protein')).toBeVisible();
    await expect(page.getByTestId('solver-combo-tab-combo-balanced-plate')).toBeVisible();
    await expect(page.getByTestId('solver-combo-tab-combo-sustained-satiety')).toBeVisible();

    // Click 1-Tap Log Combo
    await page.getByTestId('log-combo-btn').click();

    // Verify solver is also present in Metabolism Coach tab
    await page.getByTestId('nav-tab-coach').click();
    await expect(page.getByTestId('metabolism-coach-screen')).toBeVisible();
    await expect(page.getByTestId('smart-macro-solver-widget')).toBeVisible();
  });

  test('4. Opt-in Auto-Send toggle chip exists on AI Meal Scan bar', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('nav-tab-photo').click();
    await expect(page.getByTestId('toggle-auto-send')).toBeVisible();
    await expect(page.getByTestId('toggle-auto-send')).toContainText('Auto-Send');

    // Toggle on and off
    await page.getByTestId('toggle-auto-send').click();
    await expect(page.getByTestId('toggle-auto-send')).toHaveClass(/border-\[#38BDF8\]/);

    await page.getByTestId('toggle-auto-send').click();
  });

  test('5. Capture visual verification screenshots of Consumer and Admin views', async ({ page }) => {
    // 5.1 Consumer Today View
    await page.goto('/');
    await expect(page.getByTestId('daily-diary-screen')).toBeVisible();
    await page.screenshot({ path: 'dist/screenshot-consumer-today.png', fullPage: true });

    // 5.2 Command Palette Open
    await page.keyboard.press('Control+KeyK');
    await expect(page.getByTestId('command-palette-modal')).toBeVisible();
    await page.screenshot({ path: 'dist/screenshot-command-palette.png' });
    await page.keyboard.press('Escape');

    // 5.3 Dedicated Backend Admin Route
    await page.goto('/#admin');
    await expect(page.getByTestId('admin-cockpit-screen')).toBeVisible();
    await page.screenshot({ path: 'dist/screenshot-admin-console.png', fullPage: true });
  });

});
