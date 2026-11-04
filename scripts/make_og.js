// Renders scripts/og.html to assets/og.jpg (1200x630) for link previews.
// Usage: serve the repo root (python3 -m http.server 8000) then: node scripts/make_og.js http://localhost:8000
const path = require('path');
const { chromium } = require('playwright');
(async () => {
  const base = process.argv[2] || 'http://localhost:8000';
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  await p.goto(base + '/scripts/og.html', { waitUntil: 'networkidle' });
  await p.evaluate(() => window.ogReady);
  await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(__dirname, '..', 'assets', 'og.jpg'), type: 'jpeg', quality: 86 });
  await b.close();
})();
