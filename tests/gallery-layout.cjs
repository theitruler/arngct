const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
const { mockApi } = require('./gallery.cjs');
const base = process.env.GALLERY_TEST_URL || 'http://127.0.0.1:4173';
const sizes = [[600,900],[900,600],[700,700],[600,1050]];
const items = Array.from({ length: 12 }, (_, i) => ({ id: `layout-${i}`, title: `Hidden filename ${i}`, tags: [i % 2 ? 'education' : 'community'], storage_path: `fixtures/layout-${i}.jpg`, media_type: 'image', mime_type: 'image/jpeg', size_bytes: 1024, is_published: true }));
async function fixtures(context) {
  await mockApi(context, { items });
  await context.route('**/storage/v1/object/public/gallery-media/fixtures/layout-*', (route) => {
    const index = Number(route.request().url().match(/layout-(\d+)/)[1]), [width,height] = sizes[index % sizes.length];
    return route.fulfill({ contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${['#b8c8a3','#d8bc91','#94b1b0','#d8c6bd'][index%4]}"/><circle cx="${width*.65}" cy="${height*.25}" r="${width*.13}" fill="#fff5d8"/><path d="M0 ${height} V${height*.65} Q${width*.3} ${height*.25} ${width} ${height*.7} V${height}" fill="#355d5580"/></svg>` });
  });
}
async function run() {
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true });
  const errors = [];
  try {
    const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); await fixtures(desktop);
    const page = await desktop.newPage(); page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${base}/gallery.html`); await page.waitForSelector('.gallery-card');
    await page.locator('#collection').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => [...document.querySelectorAll('.gallery-thumb img')].slice(0,4).every((img) => img.naturalWidth));
    assert.equal(await page.locator('#gallery-grid').evaluate((el) => getComputedStyle(el).columnCount), '4');
    const ratios = await page.locator('.gallery-thumb img').evaluateAll((images) => images.filter((img) => img.naturalWidth).map((img) => ({ natural: img.naturalWidth / img.naturalHeight, displayed: img.clientWidth / img.clientHeight })));
    ratios.forEach((ratio) => assert.ok(Math.abs(ratio.natural - ratio.displayed) < .02, 'Thumbnails preserve original aspect ratio'));
    assert.ok(new Set(ratios.map((ratio) => ratio.natural)).size >= 3, 'Masonry shows varied image heights');
    await page.locator('#collection').screenshot({ path: path.join(__dirname, 'output', 'gallery-masonry-desktop.png') });
    await desktop.close();
    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 }); await fixtures(mobile);
    const phone = await mobile.newPage(); phone.on('pageerror', (error) => errors.push(error.message));
    await phone.goto(`${base}/gallery.html`); await phone.waitForSelector('.gallery-card');
    assert.equal(await phone.locator('#gallery-grid').evaluate((el) => getComputedStyle(el).columnCount), '2');
    assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await phone.locator('#collection').screenshot({ path: path.join(__dirname, 'output', 'gallery-masonry-mobile.png') });
    await phone.locator('[data-tag="education"]').tap(); await phone.locator('.gallery-card').first().tap();
    const cdp = await mobile.newCDPSession(phone);
    const tapViewerButton = async (selector) => {
      await phone.locator(selector).scrollIntoViewIfNeeded();
      const box = await phone.locator(selector).boundingBox();
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await phone.waitForTimeout(350);
    };
    const swipe = async (dx, dy = 0, cancel = false) => {
      const box = await phone.locator('#viewer-media').boundingBox(), x = box.x + box.width / 2 - dx / 2, y = box.y + box.height / 2 - dy / 2;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
      for (let step = 1; step <= 5; step++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * step / 5, y: y + dy * step / 5, id: 1 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: cancel ? 'touchCancel' : 'touchEnd', touchPoints: [] });
      // Let the browser settle its native gesture before starting a separate tap/swipe.
      await phone.waitForTimeout(350);
    };
    const position = () => phone.locator('#viewer-position').textContent();
    await swipe(-150); assert.equal(await position(), '2 / 6', 'Swipe left moves forward in selected tag');
    await swipe(150); assert.equal(await position(), '1 / 6', 'Swipe right goes back');
    await tapViewerButton('#viewer-next'); assert.equal(await position(), '2 / 6', 'Next button advances exactly once after swiping');
    await tapViewerButton('#viewer-prev'); assert.equal(await position(), '1 / 6', 'Previous button advances exactly once');
    await tapViewerButton('#viewer-close');
    await phone.waitForFunction(() => !document.querySelector('#gallery-viewer').open);
    await phone.locator('.gallery-card').first().tap();
    await swipe(150); assert.equal(await position(), '1 / 6', 'First item boundary is respected');
    await swipe(10); assert.equal(await position(), '1 / 6', 'Short touches do not navigate');
    await swipe(10, -150); assert.equal(await position(), '1 / 6', 'Vertical gestures do not navigate');
    await swipe(-150, 0, true); assert.equal(await position(), '1 / 6', 'Cancelled gestures do not navigate');
    const box = await phone.locator('#viewer-media').boundingBox(), y = box.y + box.height / 2;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 90, y, id: 1 }, { x: 250, y, id: 2 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 30, y, id: 1 }, { x: 190, y, id: 2 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.equal(await position(), '1 / 6', 'Two-finger gestures do not navigate');
    for (let i=0; i<5; i++) await swipe(-150);
    assert.equal(await position(), '6 / 6'); await swipe(-150); assert.equal(await position(), '6 / 6', 'Last item boundary is respected');
    await tapViewerButton('#viewer-close');
    await phone.waitForFunction(() => !document.querySelector('#gallery-viewer').open, null, {timeout:5000}); await phone.locator('.gallery-card').first().tap(); await swipe(-150); assert.equal(await position(), '2 / 6', 'Swipe works after reopening');
    await phone.screenshot({ path: path.join(__dirname, 'output', 'gallery-swipe-mobile.png') });
    assert.deepEqual(errors, []); await mobile.close();
    console.log('PASS natural-ratio masonry at desktop/mobile sizes, filtered next/previous swipes, boundaries, short/vertical/cancelled/multitouch gestures and reopen.');
  } finally { await browser.close(); }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
