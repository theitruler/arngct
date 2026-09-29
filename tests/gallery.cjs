// Browser integration checks. API writes are intercepted; no test media reaches Supabase.
// Serve the site on port 4173, then run with Playwright available via NODE_PATH.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const base = process.env.GALLERY_TEST_URL || 'http://127.0.0.1:4173';
const output = path.join(__dirname, 'output');
fs.mkdirSync(output, { recursive: true });
const project = 'cceozfitsruqzvybzuey';
const user = { id: 'c4826f57-c319-4b18-8503-61aefd51d95b', email: 'admin@example.test', app_metadata: { role: 'admin' }, aud: 'authenticated', role: 'authenticated' };
const photo = fs.readFileSync(path.join(__dirname, '..', 'p.jpeg'));
const sample = (i) => ({ id: `fixture-${i}`, title: `Community moment ${i}`, tags: i % 2 ? ['education', 'community'] : ['wellbeing'], storage_path: `fixtures/${i}.jpg`, media_type: 'image', mime_type: 'image/jpeg', size_bytes: 1024, is_published: true, created_at: '2026-09-24T00:00:00Z' });
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,DELETE,HEAD,OPTIONS', 'access-control-expose-headers': 'Location,Upload-Offset,Upload-Length,Tus-Resumable,Content-Range' };
async function mockApi(context, state, admin = false) {
  if (admin) await context.addInitScript(({ project, user }) => {
    const encode = (value) => btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const exp = Math.floor(Date.now() / 1000) + 3600;
    localStorage.setItem(`sb-${project}-auth-token`, JSON.stringify({ access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, role: 'authenticated', app_metadata: user.app_metadata, exp })}.test`, refresh_token: 'test-only', expires_at: exp, expires_in: 3600, token_type: 'bearer', user }));
  }, { project, user });
  await context.route(/https:\/\/cceozfitsruqzvybzuey(?:\.storage)?\.supabase\.co\/.*/, async (route) => {
    const req = route.request(), url = new URL(req.url()), method = req.method();
    const json = (body, status = 200) => route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (url.pathname === '/auth/v1/user') return json(user);
    if (url.pathname.startsWith('/storage/v1/object/public/')) return route.fulfill({ status: 200, headers: cors, contentType: url.pathname.endsWith('.webm') ? 'video/webm' : 'image/jpeg', body: url.pathname.endsWith('.webm') && state.video ? state.video : photo });
    if (url.pathname.startsWith('/storage/v1/upload/resumable')) {
      if (state.failUpload) return json({ error: 'Fixture denied upload' }, 403);
      if (method === 'POST') {
        state.uploads = (state.uploads || 0) + 1;
        state.offset = (req.postDataBuffer() || Buffer.alloc(0)).length;
        return route.fulfill({ status: 201, headers: { ...cors, location: `https://${project}.storage.supabase.co/storage/v1/upload/resumable/test-${state.uploads}`, 'tus-resumable': '1.0.0', 'upload-offset': String(state.offset) } });
      }
      if (method === 'HEAD') return route.fulfill({ status: 200, headers: { ...cors, 'upload-offset': String(state.offset || 0), 'tus-resumable': '1.0.0' } });
      if (method === 'PATCH') { state.offset += (req.postDataBuffer() || Buffer.alloc(0)).length; return route.fulfill({ status: 204, headers: { ...cors, 'upload-offset': String(state.offset), 'tus-resumable': '1.0.0' } }); }
      return route.fulfill({ status: 204, headers: cors });
    }
    if (url.pathname === '/storage/v1/object/gallery-media' && method === 'DELETE') { state.storageDeletes = (state.storageDeletes || 0) + 1; return json([]); }
    if (url.pathname === '/rest/v1/gallery_media') {
      state.requests = (state.requests || 0) + 1;
      if (state.failRead && method === 'GET') return json({ message: 'Fixture read failure' }, 503);
      const id = url.searchParams.get('id')?.replace('eq.', '');
      if (method === 'POST') { const body = req.postDataJSON(); const old = state.items.findIndex((item) => item.id === body.id); if (old < 0) state.items.unshift({ created_at: new Date().toISOString(), ...body }); else state.items[old] = { ...state.items[old], ...body }; return json(null, 201); }
      if (method === 'PATCH') { const body = req.postDataJSON(); if (state.failPublish && body.is_published) return json({ message: 'Fixture publish failure' }, 503); const item = state.items.find((item) => item.id === id); Object.assign(item, body); return json(req.headers().accept?.includes('vnd.pgrst.object') ? { id: item.id } : null); }
      if (method === 'DELETE') { state.items = state.items.filter((item) => item.id !== id); return json(null); }
      const visible = url.searchParams.get('is_published') === 'eq.true' ? state.items.filter((item) => item.is_published) : state.items;
      const offset = Number(url.searchParams.get('offset') || 0), limit = Number(url.searchParams.get('limit') || 500);
      return json(visible.slice(offset, offset + limit));
    }
    throw new Error(`Unexpected fixture request: ${method} ${url.pathname}`);
  });
}
async function run() {
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true });
  const errors = [];
  const watch = (page) => page.on('pageerror', (error) => errors.push(error.message));
  try {
    // Live anonymous read and login protection; writes only occur in mocked contexts below.
    const live = await browser.newContext(); const livePage = await live.newPage(); watch(livePage);
    await livePage.goto(`${base}/gallery.html`);
    await livePage.waitForFunction(() => document.querySelector('#gallery-status').hidden || !document.querySelector('#gallery-status').textContent.includes('Gathering'));
    assert.equal(await livePage.locator('#gallery-retry').isVisible(), false, 'Live Supabase read succeeds');
    await livePage.goto(`${base}/adminlogin/gallery.html`);
    await livePage.waitForURL('**/adminlogin/index.html');
    await live.close(); console.log('PASS live public read and unauthenticated redirect');

    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const state = { items: Array.from({ length: 26 }, (_, i) => sample(i)) };
    state.items[0] = { ...state.items[0], title: '<img src=x onerror=alert(1)>', media_type: 'video', mime_type: 'video/webm', storage_path: 'fixtures/video.webm' };
    await mockApi(context, state); const page = await context.newPage(); watch(page);
    state.video = fs.readFileSync(path.join(__dirname, 'fixtures', 'flower.webm'));
    await page.goto(`${base}/gallery.html`); await page.waitForSelector('.gallery-card');
    assert.equal(await page.locator('.gallery-card').count(), 24);
    await page.locator('#gallery-more').click(); assert.equal(await page.locator('.gallery-card').count(), 26);
    await page.locator('[data-tag="education"]').click(); assert.equal(await page.locator('.gallery-card').count(), 13);
    await page.locator('.gallery-card').first().click(); assert.equal(await page.locator('#gallery-viewer').evaluate((el) => el.open), true);
    assert.equal(await page.locator('.gallery-card h3').count(), 0, 'File names are not displayed');
    assert.equal(await page.locator('#viewer-title').evaluate((el) => el.classList.contains('sr-only')), true);
    await page.screenshot({ path: path.join(output, 'gallery-glass-viewer.png') });
    await page.keyboard.press('ArrowRight'); assert.equal(await page.locator('#viewer-position').textContent(), '2 / 13');
    await page.keyboard.press('Escape'); await page.waitForFunction(() => document.querySelector('#viewer-media').innerHTML === '');
    await page.locator('[data-tag=""]').click(); await page.locator('.gallery-card').first().click();
    assert.equal(await page.locator('#viewer-media video[controls]').count(), 0);
    try { await page.waitForFunction(() => { const video = document.querySelector('#viewer-media video'); return video && !video.paused && video.currentTime > 0; }, null, { timeout: 8000 }); }
    catch (error) { console.log('Video diagnostics', await page.locator('#viewer-media video').evaluate((video) => ({ src: video.src, paused: video.paused, ready: video.readyState, time: video.currentTime, duration: video.duration, error: video.error?.message })), 'Fixture bytes', state.video.length); throw error; }
    assert.equal(await page.locator('#viewer-title').textContent(), 'Event video');
    await page.locator('#viewer-close').click();
    await page.screenshot({ path: path.join(output, 'gallery-populated-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: path.join(output, 'gallery-mobile.png'), fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'No mobile overflow');
    state.items = Array.from({ length: 1002 }, (_, i) => sample(i));
    await page.reload(); await page.waitForFunction(() => document.querySelector('#gallery-count').textContent.includes('1002'));
    state.failRead = true; await page.reload(); await page.locator('#gallery-retry').waitFor({ state: 'visible' });
    state.failRead = false; state.items = []; await page.locator('#gallery-retry').click(); await page.waitForSelector('.gallery-status.empty');
    await context.close(); console.log('PASS filters, pagination beyond 1000 rows, viewer, escaping, mobile, error/retry and empty state');

    const admin = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const adminState = { items: [], uploads: 0, failPublish: true };
    await mockApi(admin, adminState, true); const adminPage = await admin.newPage(); watch(adminPage);
    await adminPage.goto(`${base}/adminlogin/gallery.html`); await adminPage.locator('#gallery-admin-content').waitFor({ state: 'visible' });
    const picker = adminPage.locator('.tag-picker[data-for="batch-tags"]');
    for (const tag of ['Community', 'education', 'COMMUNITY']) { await picker.locator('select').selectOption('__new__'); await picker.getByLabel('New tag name').fill(tag); await picker.getByRole('button', { name: 'Add tag', exact: true }).click(); }
    await adminPage.locator('#gallery-files').setInputFiles([{ name: 'first-photo.jpg', mimeType: 'image/jpeg', buffer: photo }, { name: 'event-video.mp4', mimeType: 'video/mp4', buffer: Buffer.from('test-video-payload') }, { name: 'unsafe.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') }]);
    assert.equal(await adminPage.locator('.queue-item').count(), 2);
    assert.match(await adminPage.locator('#queue-notice').textContent(), /unsafe.svg/);
    await adminPage.locator('#publish-files').click();
    await adminPage.waitForFunction(() => document.querySelector('#publish-files').textContent.includes('Retry'));
    assert.equal(adminState.items.every((item) => !item.is_published), true, 'Failed publish stays hidden');
    assert.equal(adminState.uploads, 2);
    adminState.failPublish = false; await adminPage.locator('#publish-files').click();
    await adminPage.waitForFunction(() => document.querySelector('#queue-notice').textContent.includes('All files are published'));
    assert.equal(adminState.items.filter((item) => item.is_published).length, 2);
    assert.equal(adminState.uploads, 2, 'Retry metadata without duplicating uploaded files');
    assert.deepEqual(adminState.items[0].tags, ['community', 'education']);
    assert.equal(await adminPage.locator('.queue-item').count(), 0, 'Successful uploads clear the queue');
    await adminPage.locator('[data-action="edit"]').first().click();
    const editPicker = adminPage.locator('#edit-media-form .tag-picker');
    for (const tag of ['community', 'education']) await editPicker.getByRole('button', { name: `Remove tag ${tag}`, exact: true }).click();
    await editPicker.locator('select').selectOption('community');
    assert.equal(await editPicker.getByRole('button', { name: 'Remove tag community', exact: true }).count(), 1, 'Existing tags can be selected');
    await editPicker.getByRole('button', { name: 'Remove tag community', exact: true }).click();
    for (const tag of ['wellbeing', '2026']) { await editPicker.locator('select').selectOption('__new__'); await editPicker.getByLabel('New tag name').fill(tag); await editPicker.getByRole('button', { name: 'Add tag', exact: true }).click(); }
    await adminPage.locator('#edit-save').click(); await adminPage.waitForFunction(() => !document.querySelector('#edit-media-dialog').open);
    await adminPage.locator('#library-tag').selectOption('wellbeing'); assert.equal(await adminPage.locator('.library-item').count(), 1);
    adminPage.on('dialog', (dialog) => dialog.accept()); await adminPage.locator('[data-action="delete"]').click();
    await adminPage.waitForFunction(() => document.querySelector('#library-count').textContent.includes('1 published'));
    assert.equal(adminState.storageDeletes, 1); assert.equal(adminState.items.length, 1);
    await adminPage.screenshot({ path: path.join(output, 'admin-desktop.png'), fullPage: true });
    await adminPage.setViewportSize({ width: 390, height: 844 }); await adminPage.screenshot({ path: path.join(output, 'admin-mobile.png'), fullPage: true });
    assert.equal(await adminPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'No admin mobile overflow');
    // Deterministic validation is also exercised against the browser's actual File objects.
    assert.equal(await adminPage.evaluate(() => { try { GalleryData.validateFile(new File([new Uint8Array(52428801)], 'large.mp4', { type: 'video/mp4' })); return false; } catch { return true; } }), true);
    await admin.route('https://kfjoyadtqaxurqifxtqf.supabase.co/functions/v1/stride-admin-data', (route) => route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ rows: [], events: 0, participants: 0, pending: 0 }) }));
    await adminPage.goto(`${base}/adminlogin/dashboard.html`);
    await adminPage.waitForFunction(() => document.querySelector('#admin-email').textContent === 'admin@example.test');
    await adminPage.locator('#stride-toggle').click();
    assert.equal(await adminPage.locator('#stride-children').isVisible(), false);
    assert.equal(await adminPage.locator('.gallery-nav-link').isVisible(), true, 'Gallery stays outside collapsed Stride');
    assert.equal(await adminPage.locator('#stride-children .gallery-nav-link').count(), 0);
    await admin.close(); console.log('PASS batch photo/video uploads, draft failures, retry, tag normalization/edit, storage deletion, file limits and separate navigation');
    assert.deepEqual(errors, [], 'No browser JavaScript errors');
  } finally { await browser.close(); }
}
module.exports = { mockApi, user, photo, cors };
if (require.main === module) run().catch((error) => { console.error(error); process.exitCode = 1; });
