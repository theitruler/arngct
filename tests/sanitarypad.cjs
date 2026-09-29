const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const base = process.env.SANITARYPAD_TEST_URL || 'http://127.0.0.1:4173';
const webhook = 'https://n8n.arngct.org/webhook/saniatrypad';

(async () => {
  const browser = await chromium.launch({channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true});
  const errors = [];
  try {
    fs.mkdirSync(path.join(__dirname, 'output'), {recursive:true});
    const context = await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
    const page = await context.newPage();
    await page.route('https://n8n.arngct.org/**', route => {
      errors.push('Unexpected unmocked webhook request');
      return route.abort();
    });
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {if(response.status() >= 400 && response.url().startsWith(base)) errors.push(`${response.status()} ${response.url()}`);});
    await page.goto(`${base}/sanitarypad`);
    await page.evaluate(() => {document.querySelectorAll('img').forEach(img => img.loading = 'eager');});
    await page.waitForFunction(() => [...document.images].every(img => img.complete && img.naturalWidth > 0));
    await page.evaluate(() => document.fonts.ready);
    assert.equal(new URL(page.url()).pathname, '/sanitarypad');
    assert.equal(await page.locator('nav, header, footer, [data-site-header], [data-site-footer]').count(), 0);
    assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), 'noindex, nofollow');
    assert.deepEqual(await page.locator('main > section').evaluateAll(sections => sections.map(section => section.getAttribute('aria-labelledby'))),
      ['campaign-title','why-title','work-title','help-title','giving-title','impact-title',null], 'Buy one, give one follows How can you help');
    assert.equal(await page.evaluate(() => window.ARN_CONFIG.waitlistWebhookUrl), webhook);
    assert.equal(await page.evaluate(() => window.ARN_CONFIG.contactFormEndpoint), 'https://n8n.arngct.org/webhook/senddata', 'General contact form keeps its endpoint');
    for (const width of [320,390,430,768,1440]) {
      await page.setViewportSize({width,height:width>719?1000:844});
      await page.waitForTimeout(150);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `No horizontal overflow at ${width}px`);
      await page.screenshot({path:path.join(__dirname,'output',`sanitarypad-${width}.png`),fullPage:true});
    }
    await page.setViewportSize({width:390,height:844});
    await page.waitForTimeout(150);
    for (const id of ['why-cards','work-cards','help-cards','impact-cards']) {
      const track=page.locator(`#${id}`), section=track.locator('..');
      await section.locator('[data-next]').click();
      await page.waitForFunction(id=>document.getElementById(id).scrollLeft>30,id);
      await section.locator('.dot').last().click();
      await page.waitForTimeout(150);
      assert.ok(await section.locator('[data-next]').isDisabled(), `${id} last boundary`);
      await track.focus(); await page.keyboard.press('Home'); await page.waitForTimeout(150);
      assert.ok(await section.locator('[data-prev]').isDisabled(), `${id} first boundary`);
      await page.keyboard.press('ArrowRight'); await page.waitForTimeout(150);
      assert.ok(await track.evaluate(el=>el.scrollLeft>30), `${id} keyboard navigation`);
    }
    // Exercise a real horizontal touch gesture, rather than dispatching a synthetic scroll.
    const track=page.locator('#work-cards');
    await track.focus(); await page.keyboard.press('Home');
    await track.scrollIntoViewIfNeeded(); await page.waitForTimeout(150);
    const box=await track.boundingBox(), y=Math.max(30,box.y+80);
    const cdp=await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:300,y,id:1}]});
    for(let i=1;i<=8;i++) await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:300-i*26,y,id:1}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await page.waitForTimeout(700);
    assert.ok(await track.evaluate(el=>el.scrollLeft>50),'Touch swipe advances carousel');
    await page.locator('#join-waitlist').click();
    assert.ok(await page.locator('#waitlist-dialog').evaluate(el=>el.open));
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#waitlist-dialog').evaluate(el=>el.open),false);
    assert.equal(await page.evaluate(()=>document.activeElement.id),'join-waitlist');
    await page.locator('#join-waitlist').click();
    let requests=[];
    await page.route(webhook, async route=>{requests.push(route.request().postDataJSON()); await route.fulfill({status:500,body:'unavailable'});});
    await page.locator('#waitlist-name').fill('Campaign test');
    await page.locator('#waitlist-email').fill('invalid-email');
    await page.locator('#waitlist-contact').fill('9876543210');
    await page.locator('[name="consent"]').check();
    await page.locator('#waitlist-form button[type="submit"]').click();
    assert.equal(await page.locator('#waitlist-email').evaluate(el => el.validity.typeMismatch), true);
    assert.equal(requests.length, 0, 'Invalid email prevents submission');
    await page.locator('#waitlist-email').fill('campaign-test@example.com');
    await page.locator('[name="consent"]').uncheck();
    await page.locator('#waitlist-form button[type="submit"]').click();
    assert.equal(requests.length, 0, 'Consent is required');
    await page.locator('[name="consent"]').check();
    await page.screenshot({path:path.join(__dirname,'output','sanitarypad-email-form.png')});
    await page.locator('#waitlist-form button[type="submit"]').click();
    await page.waitForFunction(()=>document.querySelector('#waitlist-status').textContent.includes('couldn’t'));
    assert.equal(await page.locator('#waitlist-name').inputValue(),'Campaign test','Failed submission preserves input');
    assert.equal(await page.locator('#waitlist-email').inputValue(),'campaign-test@example.com','Failed submission preserves email');
    await page.unroute(webhook);
    await page.route(webhook, async route=>{
      assert.equal(route.request().method(), 'POST');
      assert.equal(route.request().headers()['content-type'], 'application/json');
      requests.push(route.request().postDataJSON());
      await route.fulfill({status:200,body:'{}',contentType:'application/json'});
    });
    await page.locator('#waitlist-form button[type="submit"]').click();
    await page.waitForFunction(()=>document.querySelector('#waitlist-status').textContent.includes('Thank you'));
    assert.equal(requests.length,2);
    assert.ok(requests[1].message.includes('waiting list'));
    assert.deepEqual({name:requests[1].name,email:requests[1].email,contact:requests[1].contact,consent:requests[1].consent,source:requests[1].source},
      {name:'Campaign test',email:'campaign-test@example.com',contact:'9876543210',consent:true,source:'sanitarypad'});
    assert.equal(await page.locator('#waitlist-name').inputValue(),'');
    assert.equal(await page.locator('#waitlist-email').inputValue(),'');
    await page.screenshot({path:path.join(__dirname,'output','sanitarypad-waitlist.png')});
    await page.reload();
    assert.equal(new URL(page.url()).pathname,'/sanitarypad');
    assert.deepEqual(errors,[]);
    await context.close();
    console.log('PASS: clean route + reload; no navbar/footer; all images/fonts; 320–1440px overflow; four carousels; arrows/dots/keyboard/touch; dialog focus + Escape; mocked form failure + success. No real requests submitted.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
