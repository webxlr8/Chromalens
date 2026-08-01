// L5 production-readiness check: render the BUILT popup (system Chrome, headless)
// with the browser.* API stubbed. Verifies HTML/CSS/TS output, all 5 views,
// capture modes, theme switching, palette rendering — and asserts zero console errors.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Static server for the built extension (Vite emits absolute asset paths → file:// breaks)
const buildDir = fileURLToPath(new URL('../.output/chrome-mv3', import.meta.url));
const server = createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    if (urlPath === '/favicon.ico') {
      res.writeHead(204);
      res.end();
      return;
    }
    const filePath = fileURLToPath(new URL('.' + urlPath, 'file://' + buildDir + '/'));
    const body = await readFile(filePath);
    const ext = filePath.split('.').pop() || '';
    const types = { html: 'text/html', js: 'text/javascript', css: 'text/css', png: 'image/png', json: 'application/json' };
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const popupFile = `http://localhost:${port}/popup.html`;
mkdirSync(new URL('../artifacts', import.meta.url).pathname, { recursive: true });

// Global watchdog: fail fast instead of hanging
setTimeout(() => {
  console.error('WATCHDOG: e2e run exceeded 90s');
  process.exit(1);
}, 90000).unref();

const browserStub = `
  window.browser = {
    runtime: { id: "test",
      sendMessage: async () => ({}),
      onMessage: { addListener: () => {} },
    },
    storage: { local: { get: async () => ({}), set: async () => {}, remove: async () => {} } },
    action: { setBadgeText: async () => {} },
    tabs: {
      query: async () => [{ id: 1, url: 'https://example.com' }],
      sendMessage: async () => { throw new Error('no content script'); },
    },
    scripting: { executeScript: async () => {} },
  };
`;

const context = await chromium.launchPersistentContext('', {
  headless: true,
});
const errors = [];
const page = await context.newPage();
await page.addInitScript(browserStub);
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('[console] ' + m.text());
});
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));

await page.goto(popupFile, { waitUntil: 'load' });
await page.waitForTimeout(700);

const dumpState = async () => {
  const state = await page.evaluate(() => ({
    pickDisabled: document.getElementById('pick-btn')?.disabled,
    recentCount: document.querySelectorAll('#recent-colors .recent-swatch').length,
    hexValue: document.getElementById('hex-value')?.textContent,
    colorName: document.getElementById('color-name')?.textContent,
    views: Array.from(document.querySelectorAll('.view')).map((v) => v.id + ':' + v.className),
  }));
  console.log('STATE:', JSON.stringify(state));
};

try {

// Picker view
const title = await page.title();
const pickerVisible = await page.locator('#view-picker').isVisible();
console.log('title:', title, '| picker view visible:', pickerVisible);
await page.screenshot({ path: 'artifacts/popup-picker.png' });

// Click through tabs
for (const tab of ['palette', 'extract', 'favorites', 'audit']) {
  await page.click(`[data-tab="${tab}"]`);
  await page.waitForTimeout(350);
  const visible = await page.locator(`#view-${tab}`).isVisible();
  console.log(`tab ${tab} visible:`, visible);
  await page.screenshot({ path: `artifacts/popup-${tab}.png` });
}

// Extract sub-modes
await page.click('[data-tab="extract"]');
for (const mode of ['site', 'screen', 'image']) {
  await page.click(`[data-mode="${mode}"]`);
  await page.waitForTimeout(250);
  const contentVisible = await page.locator(`#capture-mode-${mode}`).isVisible();
  console.log(`extract mode ${mode} visible:`, contentVisible);
  await page.screenshot({ path: `artifacts/popup-extract-${mode}.png` });
}

// Settings + dark theme
await page.click('#settings-btn');
await page.waitForTimeout(200);
await page.click('[data-theme="dark"]');
await page.waitForTimeout(200);
const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
console.log('theme after dark switch:', theme);
await page.click('#settings-close');

// Palette rendering with harmony select
await page.click('[data-tab="palette"]');
await page.selectOption('#harmony-select', 'triadic');
await page.waitForTimeout(300);
const paletteCount = await page.locator('#palette-grid .palette-swatch').count();
console.log('palette swatches (triadic):', paletteCount);
await page.screenshot({ path: 'artifacts/popup-palette-triadic.png' });

// Favorites empty state
await page.click('[data-tab="favorites"]');
const favoritesEmpty = await page.locator('#favorites-empty').isVisible();
console.log('favorites empty state visible:', favoritesEmpty);

// NEW: hex input — type a color, Enter, expect display update
await page.click('[data-tab="picker"]');
await page.fill('#hex-input', 'ff8000');
await page.press('#hex-input', 'Enter');
await page.waitForTimeout(200);
const hexDisplay = await page.locator('#hex-value').textContent();
console.log('hex input applied:', hexDisplay);
if (hexDisplay !== '#FF8000') throw new Error('hex input did not apply: ' + hexDisplay);

// NEW: palettes render from seeded storage
await page.evaluate(() => {
  localStorage.setItem(
    'chromaLens_palettes',
    JSON.stringify([
      { id: 'p1', name: 'Test Palette', colors: ['#ff0000', '#00ff00', '#0000ff'], source: 'site', createdAt: 1 },
    ]),
  );
});
await page.click('[data-tab="favorites"]');
await page.waitForTimeout(200);
const paletteCards = await page.locator('#palettes-grid .palette-card').count();
console.log('palette cards rendered:', paletteCards);
await page.screenshot({ path: 'artifacts/popup-palettes.png' });
if (paletteCards !== 1) throw new Error('palettes did not render');

if (errors.length > 0) {
  console.log('=== CONSOLE/PAGE ERRORS ===');
  console.log(errors.join('\n'));
  process.exit(1);
}
console.log('NO CONSOLE ERRORS — popup verified clean');
process.exit(0); // browsers die with the process; context.close() hangs on some builds

} catch (err) {
  await dumpState();
  console.log('STEP FAILED:', err.message);
  if (errors.length > 0) {
    console.log('=== CONSOLE/PAGE ERRORS ===');
    console.log(errors.join('\n'));
  }
  process.exit(1);
}
