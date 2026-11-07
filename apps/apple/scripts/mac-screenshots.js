// Mac App Store screenshots (2880x1800). The macOS app runs this same engine in its window.
// Usage: node apps/apple/scripts/mac-screenshots.js apps/apple/AppStore/screenshots/mac
const { chromium } = require('playwright');
const out = process.argv[2];
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ permissions: ['midi'], viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }); const p = await ctx.newPage();
  await p.goto('https://earthmidi.com/', { waitUntil: 'networkidle', timeout: 60000 }).catch(()=>{});
  await p.waitForTimeout(3000);
  await p.locator('#wlc').getByText('Ambient').first().click().catch(e=>console.log('amb', e.message));
  await p.waitForTimeout(25000);
  await p.screenshot({ path: out + '/mac-1.png' });
  await p.mouse.wheel(0, 700); await p.waitForTimeout(3000);
  await p.screenshot({ path: out + '/mac-2.png' });
  await p.mouse.wheel(0, -2000); await p.waitForTimeout(1000);
  await p.getByRole('button', { name: 'Console' }).first().click().catch(e=>console.log('con', e.message));
  await p.waitForTimeout(6000);
  await p.screenshot({ path: out + '/mac-3.png' });
  await b.close();
})();
