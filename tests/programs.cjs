// Real public reads; all admin writes are intercepted browser fixtures.
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
const { mockApi, photo, cors } = require('./gallery.cjs');
const base = process.env.GALLERY_TEST_URL || 'http://127.0.0.1:4173';
async function run() {
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true });
  const errors = [];
  try {
    const live = await browser.newContext(), page = await live.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${base}/programs.html`); await page.waitForSelector('.program-row');
    assert.match(await page.locator('#programs-list').innerText(), /Planting trees/);
    await page.locator('[data-status="ongoing"]').click(); assert.equal(await page.locator('.program-row').count(), 0);
    await page.locator('[data-status="upcoming"]').click(); assert.equal(await page.locator('.program-row').count(), 1);
    await page.goto(`${base}/adminlogin/programs.html`); await page.waitForURL('**/adminlogin/index.html');
    await live.close(); console.log('PASS live program migration, database read, filters and login protection');
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await mockApi(context, { items: [] }, true);
    let programs = [], failSave = false, storageDeletes = 0;
    await context.route('**/rest/v1/programs*', async (route) => {
      const req = route.request(), url = new URL(req.url()), id = url.searchParams.get('id')?.replace('eq.', '');
      const reply = (body, status = 200) => route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(body) });
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      if (failSave && ['POST', 'PATCH'].includes(req.method())) return reply({ message: 'Fixture save failed' }, 503);
      if (req.method() === 'POST') { const row = { ...req.postDataJSON(), id: `program-${programs.length + 1}` }; programs.push(row); return reply({ id: row.id }, 201); }
      if (req.method() === 'PATCH') { Object.assign(programs.find((row) => row.id === id), req.postDataJSON()); return reply(req.headers().accept?.includes('vnd.pgrst.object') ? { id } : null); }
      if (req.method() === 'DELETE') { programs = programs.filter((row) => row.id !== id); return reply(null); }
      return reply(url.searchParams.get('is_published') === 'eq.true' ? programs.filter((row) => row.is_published) : programs);
    });
    await context.route('**/storage/v1/object/program-images**', (route) => {
      if (route.request().method() === 'DELETE') storageDeletes++;
      return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(route.request().method() === 'DELETE' ? [] : { Key: 'program-images/fixture.jpg' }) });
    });
    const admin = await context.newPage(); admin.on('pageerror', (error) => errors.push(error.message));
    await admin.goto(`${base}/adminlogin/programs.html`); await admin.locator('#program-workspace').waitFor({ state: 'visible' });
    for (const status of ['ongoing','upcoming','completed']) {
      await admin.locator('#add-program').click();
      await admin.locator('[name="title"]').fill(`${status} program`); await admin.locator('[name="summary"]').fill('A program managed in the database.');
      await admin.locator('[name="status"]').selectOption(status); await admin.locator('[name="location"]').fill('Bengaluru');
      await admin.locator('[name="schedule"]').fill('Every Saturday');
      if (status === 'ongoing') {
        await admin.locator('#program-image').setInputFiles({ name: 'program.jpg', mimeType: 'image/jpeg', buffer: photo });
        failSave = true; await admin.locator('#save-program').click(); await admin.waitForFunction(() => document.querySelector('#program-form-status').textContent.includes('Fixture'));
        assert.equal(programs.length, 0); assert.equal(storageDeletes, 1, 'Failed save cleans up newly uploaded file'); failSave = false;
      }
      if (status === 'completed') await admin.locator('[name="visibility"]').selectOption('draft');
      await admin.locator('#save-program').click(); await admin.waitForFunction(() => !document.querySelector('#program-dialog').open);
      await admin.waitForFunction((count) => document.querySelectorAll('.admin-program').length === count, programs.length);
    }
    assert.equal(programs.length, 3);
    const publicPage = await context.newPage(); publicPage.on('pageerror', (error) => errors.push(error.message));
    await publicPage.goto(`${base}/programs.html`); await publicPage.waitForSelector('.program-row'); assert.equal(await publicPage.locator('.program-row').count(), 2, 'Drafts excluded');
    await publicPage.locator('[data-status="ongoing"]').click(); assert.equal(await publicPage.locator('.program-row').count(), 1);
    await publicPage.setViewportSize({ width: 390, height: 844 }); await publicPage.screenshot({ path: path.join(__dirname, 'output', 'programs-public-mobile.png'), fullPage: true });
    assert.equal(await publicPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await admin.locator('#program-status-filter').selectOption('ongoing'); await admin.locator('[data-action="edit"]').click();
    await admin.locator('[name="title"]').fill('Updated program'); await admin.locator('[name="status"]').selectOption('upcoming');
    await admin.locator('#save-program').click(); await admin.waitForFunction(() => !document.querySelector('#program-dialog').open);
    assert.equal(programs[0].title, 'Updated program'); assert.equal(programs[0].status, 'upcoming');
    await admin.locator('#program-status-filter').selectOption('upcoming');
    admin.on('dialog', (dialog) => dialog.accept()); await admin.locator('[data-action="delete"]').first().click();
    await admin.waitForFunction(() => document.querySelector('#program-admin-status').textContent === 'Program deleted.');
    assert.equal(programs.length, 2); assert.equal(storageDeletes, 2, 'Deletion removes uploaded image');
    await admin.locator('#program-status-filter').selectOption('');
    await admin.screenshot({ path: path.join(__dirname, 'output', 'programs-admin-desktop.png'), fullPage: true });
    await admin.setViewportSize({ width: 390, height: 844 }); await admin.screenshot({ path: path.join(__dirname, 'output', 'programs-admin-mobile.png'), fullPage: true });
    assert.equal(await admin.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal(await admin.locator('.gallery-nav-link + .programs-nav-link').count(), 1);
    assert.deepEqual(errors, []); await context.close();
    console.log('PASS ongoing/upcoming/completed CRUD, image upload/cleanup, drafts, separate navigation and mobile layout');
  } finally { await browser.close(); }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
