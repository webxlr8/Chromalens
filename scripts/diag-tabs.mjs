import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const buildDir = fileURLToPath(new URL('../.output/chrome-mv3', import.meta.url));
const server = createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
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

const browserStub = `
  window.browser = {
    runtime: { id: 'test', sendMessage: async () => ({}), onMessage: { addListener: () => {} } },
    storage: { local: { get: async () => ({}), set: async () => {}, remove: async () => {} } },
    action: { setBadgeText: async () => {} },
    tabs: { query: async () => [{ id: 1 }], sendMessage: async () => { throw new Error('no cs'); } },
    scripting: { executeScript: async () => {} },
  };
`;

const context = await chromium.launchPersistentContext('', { channel: 'chrome', headless: true });
const page = await context.newPage();
await page.addInitScript(browserStub);
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
await page.goto(`http://localhost:${port}/popup.html`);
await page.waitForTimeout(700);

// Check whether the tab listener is attached: dispatch click programmatically
const result = await page.evaluate(() => {
  const before = document.getElementById('view-palette').className;
  const btn = document.querySelector('[data-tab="palette"]');
  btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  const after = document.getElementById('view-palette').className;
  return { before, after, btnClasses: btn.className };
});
console.log('DISPATCH TEST:', JSON.stringify(result));

// If dispatch works but real click didn't, try real click again + inspect
await page.click('[data-tab="extract"]', { timeout: 5000 }).catch((e) => console.log('CLICK ERR:', e.message.slice(0, 100)));
const afterClick = await page.evaluate(() => document.getElementById('view-extract').className);
console.log('view-extract after real click:', afterClick);

await context.close();
process.exit(0);
