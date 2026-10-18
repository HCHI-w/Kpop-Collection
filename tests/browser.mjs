// Dependency-free Chromium end-to-end smoke test via the DevTools Protocol.
// Requires Chromium and an HTTP server serving the parent directory on :8000.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, readdir, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
const temp = await mkdtemp(join(tmpdir(), 'kpop-browser-'));
const outputs = resolve('test-results');
await mkdir(outputs, { recursive: true });
const chrome = spawn(process.env.CHROMIUM_BIN || '/usr/bin/chromium', ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${temp}`, 'about:blank'], { stdio: 'ignore' });
let socket;
let dialogAccept = true;
const errors = [];
const badRequests = [];
let sequence = 0;
const pending = new Map();
async function poll(fn, message, timeout = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeout) { const result = await fn(); if (result) return result; await delay(60); }
  throw new Error(`Timeout: ${message}`);
}
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text + ': ' + result.exceptionDetails.exception?.description);
  return result.result.value;
}
const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
async function change(selector, value, event = 'change') {
  return evaluate(`{const el=document.querySelector(${JSON.stringify(selector)});el.value=${JSON.stringify(value)};el.dispatchEvent(new Event(${JSON.stringify(event)},{bubbles:true}));}`);
}
const count = selector => evaluate(`document.querySelectorAll(${JSON.stringify(selector)}).length`);
const state = () => evaluate(`JSON.parse(localStorage.getItem('my-kpop-collection:v1'))`);
async function assertDark(selector) {
  const colors = await evaluate(`(()=>{const s=getComputedStyle(document.querySelector(${JSON.stringify(selector)}));return {background:s.backgroundColor,ink:s.color,scheme:s.colorScheme}})()`);
  const rgb = value => value.match(/[\d.]+/g).slice(0, 3).map(Number);
  assert.ok(rgb(colors.background).every(c => c < 90), `${selector}: dark surface (${colors.background})`);
  assert.ok(rgb(colors.ink).every(c => c > 140), `${selector}: readable text (${colors.ink})`);
  assert.equal(colors.scheme, 'dark', `${selector}: native dark controls`);
}
async function load() {
  await send('Page.navigate', { url: process.env.TEST_URL || 'http://127.0.0.1:8000/Kpop-Collection/' });
  await poll(() => evaluate(`document.querySelectorAll('.album-card').length===10`), 'catalog loaded');
}
async function upload(value, filename = 'backup.json') {
  const path = join(temp, filename);
  await writeFile(path, typeof value === 'string' ? value : JSON.stringify(value));
  const { root } = await send('DOM.getDocument');
  const { nodeId } = await send('DOM.querySelector', { nodeId: root.nodeId, selector: '#import-file' });
  await send('DOM.setFileInputFiles', { nodeId, files: [path] });
  await poll(() => evaluate(`!document.querySelector('#import-apply').disabled || document.querySelector('#import-preview').classList.contains('error')`), 'backup validation');
}
try {
  const port = await poll(async () => { try { return (await readFile(join(temp, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; } catch { return null; } }, 'Chromium startup');
  const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const waiter = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) waiter?.reject(new Error(JSON.stringify(message.error)));
      else waiter?.resolve(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') errors.push(message.params);
    if (message.method === 'Network.responseReceived' && message.params.response.status >= 400) badRequests.push(message.params.response.url);
    if (message.method === 'Network.loadingFailed') badRequests.push(message.params.errorText);
    if (message.method === 'Page.javascriptDialogOpening') send('Page.handleJavaScriptDialog', { accept: dialogAccept }).catch(() => {});
  });
  await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable');
  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: temp });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
  await load();
  assert.equal(await evaluate('document.documentElement.lang'), 'zh-Hant');
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.album-grid')).gridTemplateColumns.split(' ').length`), 5);
  await poll(() => evaluate(`[...document.querySelectorAll('.cover-wrap img')].every(i=>i.complete && i.naturalWidth>0)`), 'covers loaded');
  assert.equal(await evaluate(`document.querySelector('.brand').getAttribute('aria-label')`), '專輯圖鑑 首頁');
  assert.equal(await evaluate(`document.querySelector('.brand > span:last-child').childNodes[0].textContent`), '專輯圖鑑');
  assert.equal(await evaluate(`document.title`), 'My K-pop Collection｜我的專輯收藏');
  assert.equal(await evaluate(`document.querySelector('.site-footer').textContent.includes('My K-pop Collection')`), true);
  assert.equal(await evaluate(`document.querySelector('meta[name="theme-color"]').content`), '#212121');
  assert.deepEqual(await evaluate(`[...document.querySelector('main').children].slice(0,4).map(e=>e.id || e.className)`), ['intro', 'artist-section', 'stats', 'catalog']);
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('.stat-label')].map(e=>e.textContent)`), ['已擁有專輯', '想要收藏']);
  for (const selector of ['body', '.site-header', '.artist', '.stats', '.filters', '#year', '.segmented button[aria-pressed=true]', '.cover-index', '.site-footer']) await assertDark(selector);
  await send('Page.bringToFront');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  await evaluate(`document.querySelector('#search').focus()`);
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('#search')).outlineStyle`), 'solid');
  console.log('PASS: dark surfaces/native controls, keyboard focus, brand, section order, two statistics');

  // A version-1 collection saved before this UI update must render without rewriting it.
  const legacy = JSON.stringify({ schemaVersion: 1, versions: {
    'twice-ready-to-be-ready': { albumId: 'twice-ready-to-be', quantity: 2, wanted: true },
    'future-version': { albumId: 'future-album', quantity: 3, wanted: true }
  }, pending: { 'twice-ready-to-be': { quantity: 1 }, 'future-album': { quantity: 2 } } });
  await evaluate(`localStorage.setItem('my-kpop-collection:v1',${JSON.stringify(legacy)})`);
  await load();
  assert.equal(await evaluate(`localStorage.getItem('my-kpop-collection:v1')`), legacy);
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('.stat-value')].map(e=>e.childNodes[0].textContent)`), ['1', '1']);
  await click('[data-group="twice"]');
  assert.equal(await evaluate(`localStorage.getItem('my-kpop-collection:v1')`), legacy);
  // Only this disposable test profile is reset for the existing interaction scenarios.
  await evaluate(`localStorage.removeItem('my-kpop-collection:v1')`);
  await load();
  console.log('PASS: existing v1 data, quantities, pending and unknown records preserved byte-for-byte on load/group selection');
  await change('#year', '2022'); assert.equal(await count('.album-card'), 2);
  await change('#region', 'JP'); await change('#type', 'studio'); assert.equal(await count('.album-card'), 1);
  assert.equal(await evaluate(`document.querySelector('.album-title').textContent`), 'Celebrate');
  await click('#reset-filters');
  await change('#search', 'ready', 'input'); assert.equal(await count('.album-card'), 1);
  await change('#search', 'no-such-album', 'input'); assert.equal(await count('.album-card'), 0);
  await click('#empty-reset'); assert.equal(await count('.album-card'), 10);
  console.log('PASS: catalog, relative subpath assets, combined filters, normalized search, empty/reset');

  const ready = 'twice-ready-to-be-ready';
  const aid = 'twice-ready-to-be';
  await click(`[data-album="${aid}"]`);
  for (const selector of ['#album-dialog', '.quantity input', '.pending-panel']) await assertDark(selector);
  assert.equal(await count('#album-dialog[open]'), 1);
  assert.equal(await count('#album-dialog [data-version][data-field="owned"]'), 3);
  await click(`#detail-${ready}-owned`);
  await click(`#detail-${ready}-wanted`);
  await change(`#detail-${ready}-quantity`, '3');
  let saved = await state();
  assert.equal(saved.versions[ready].quantity, 3); assert.equal(saved.versions[ready].wanted, true);
  assert.equal(Object.keys(saved.versions).length, 1);
  await change(`#detail-${aid}-pending`, '2');
  await assertDark('.transfer-form select'); await assertDark('.transfer-form input');
  await click('#album-dialog .transfer-form button');
  saved = await state();
  assert.equal(saved.versions[ready].quantity, 4); assert.equal(saved.pending[aid].quantity, 1);
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('.stat-value')].map(e=>e.childNodes[0].textContent)`), ['1', '1']);
  assert.match(await evaluate(`document.querySelector('#album-detail .detail-header').textContent`), /共 5 張/);
  await send('Page.reload');
  await poll(() => evaluate(`document.querySelectorAll('.album-card').length===10`), 'reload');
  assert.equal((await state()).versions[ready].quantity, 4);
  await click('[data-list="owned"]'); assert.equal(await count('.album-card'), 1);
  await click('[data-list="wanted"]'); assert.equal(await count('.album-card'), 1);
  await click('[data-view="versions"]'); assert.equal(await count('.version-row'), 1);
  await click('[data-list="all"]'); assert.equal(await count('.version-album'), 10);
  await assertDark('.version-album');
  await click('[data-view="albums"]');
  console.log('PASS: version ownership + wishes, quantity, pending transfer, correct totals, reload persistence, collection lists, both views');

  await click('#backup-open');
  for (const selector of ['#backup-dialog', '.import-preview', '#import-apply']) await assertDark(selector);
  assert.equal(await evaluate(`document.querySelector('#import-apply').disabled`), true);
  assert.ok(Number(await evaluate(`getComputedStyle(document.querySelector('#import-apply')).opacity`)) < 1);
  await click('#export');
  const downloaded = await poll(async () => (await readdir(temp)).find(n => /^my-kpop-collection-\d{4}-\d{2}-\d{2}\.json$/.test(n)), 'download');
  const backup = JSON.parse(await readFile(join(temp, downloaded), 'utf8'));
  assert.equal(backup.schemaVersion, 1); assert.equal(backup.versions[ready].quantity, 4);
  await upload('{broken'); assert.equal(await evaluate(`document.querySelector('#import-apply').disabled`), true);
  await assertDark('.import-preview.error');
  await upload({ ...backup, schemaVersion: 99 }, 'future.json'); assert.equal(await evaluate(`document.querySelector('#import-apply').disabled`), true);
  await upload(backup, 'valid.json');
  await click('#import-apply'); await upload(backup, 'repeat.json'); await click('#import-apply');
  assert.equal((await state()).versions[ready].quantity, 4);
  assert.equal((await state()).pending[aid].quantity, 1);
  await upload({ schemaVersion: 1, versions: {}, pending: {} }, 'empty.json');
  await click('input[value="replace"]');
  dialogAccept = false; await click('#import-apply'); assert.equal((await state()).versions[ready].quantity, 4);
  dialogAccept = true; await click('#import-apply'); assert.deepEqual((await state()).versions, {});
  await upload(backup, 'restore.json'); await click('#import-apply');
  assert.equal((await state()).versions[ready].quantity, 4);
  await click('[data-close="backup-dialog"]');
  console.log('PASS: actual JSON download, malformed/schema rejection, merge idempotence, overwrite cancel/confirm, restore');
  await poll(() => evaluate(`document.querySelector('#notice').hidden`), 'notice dismissed before screenshots');

  for (const [width, columns] of [[1600, 6], [1280, 5], [1024, 4], [375, 2], [320, 2]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 760 });
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('.album-grid')).gridTemplateColumns.split(' ').length`), columns);
    assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true, `no overflow at ${width}`);
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('#stats')).gridTemplateColumns.split(' ').length`), 2);
    assert.equal(await count('.stat'), 2);
    await evaluate('window.scrollTo(0, 500)');
    await poll(() => evaluate('window.scrollY > 0'), 'page scrolled');
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('.site-header')).position`), 'sticky');
    assert.equal(await evaluate(`document.querySelector('.site-header').getBoundingClientRect().top`), 0, `sticky at ${width}`);
    if (width === 1280 || width === 375) {
      const scrolled = await send('Page.captureScreenshot', { format: 'png' });
      await writeFile(join(outputs, `sticky-${width}.png`), Buffer.from(scrolled.data, 'base64'));
    }
    await click('.skip-link');
    await poll(() => evaluate(`document.querySelector('#catalog').getBoundingClientRect().top >= document.querySelector('.site-header').getBoundingClientRect().bottom`), `anchor visible at ${width}`);
    await click('[data-list="owned"]');
    assert.equal(await count('.album-card'), 1);
    await poll(() => evaluate(`document.querySelector('#catalog').getBoundingClientRect().top >= document.querySelector('.site-header').getBoundingClientRect().bottom`), `navigation target visible at ${width}`);
    await click('[data-list="all"]');
    await evaluate('window.scrollTo(0, 0); document.activeElement.blur()');
    await poll(() => evaluate('window.scrollY === 0'), 'top for screenshot');
    assert.ok(await evaluate(`document.querySelector('.intro').getBoundingClientRect().top >= document.querySelector('.site-header').getBoundingClientRect().bottom`), `main below header at ${width}`);
    if (width === 1280 || width === 375) {
      const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
      await writeFile(join(outputs, `${width === 375 ? 'mobile' : 'desktop'}.png`), Buffer.from(screenshot.data, 'base64'));
      await click(`[data-album="${aid}"]`);
      await assertDark('#album-dialog');
      const detail = await send('Page.captureScreenshot', { format: 'png' });
      await writeFile(join(outputs, `detail-${width}.png`), Buffer.from(detail.data, 'base64'));
      await click('[data-close="album-dialog"]');
      await click('#backup-open');
      await assertDark('#backup-dialog');
      assert.equal(await evaluate(`document.querySelector('#backup-dialog').scrollWidth<=document.querySelector('#backup-dialog').clientWidth`), true);
      const backupShot = await send('Page.captureScreenshot', { format: 'png' });
      await writeFile(join(outputs, `backup-${width}.png`), Buffer.from(backupShot.data, 'base64'));
      await click('[data-close="backup-dialog"]');
    }
  }
  await click(`[data-album="${aid}"]`);
  assert.equal(await evaluate(`document.querySelector('#album-dialog').scrollWidth<=document.querySelector('#album-dialog').clientWidth`), true);
  await send('Page.bringToFront');
  const closeRect = await evaluate(`(()=>{const r=document.querySelector('#detail-close').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await send('Input.dispatchMouseEvent', { type:'mouseMoved', ...closeRect });
  await send('Input.dispatchMouseEvent', { type:'mousePressed', ...closeRect, button:'left', clickCount:1 });
  await send('Input.dispatchMouseEvent', { type:'mouseReleased', ...closeRect, button:'left', clickCount:1 });
  await click(`[data-album="${aid}"]`);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode:27, nativeVirtualKeyCode:27 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode:27, nativeVirtualKeyCode:27 });
  await poll(async () => (await count('#album-dialog[open]')) === 0, 'Escape closes dialog');
  await click('[data-view="versions"]');
  assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true);
  await click('[data-view="albums"]');
  console.log('PASS: 1600/1280/1024/375/320 layouts, sticky header, anchor/navigation clearance, two statistics, dark dialogs, Escape dismissal');

  // Storage denial must roll back the UI; damaged saved data must not be overwritten.
  await evaluate(`window.originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException('Quota exceeded','QuotaExceededError')}`);
  await click(`[data-album="${aid}"]`);
  await click(`#detail-${ready}-owned`);
  await assertDark('#storage-alert');
  assert.equal((await state()).versions[ready].quantity, 4);
  assert.equal(await evaluate(`document.querySelector('#detail-${ready}-owned').checked`), true);
  await evaluate(`Storage.prototype.setItem=window.originalSetItem`);
  await click('[data-close="album-dialog"]');
  await evaluate(`localStorage.setItem('my-kpop-collection:v1','{broken')`);
  await send('Page.reload');
  await poll(() => evaluate(`document.querySelector('#storage-alert')?.hidden===false`), 'corruption warning');
  await click(`[data-album="${aid}"]`); await click(`#detail-${ready}-owned`);
  assert.equal(await evaluate(`localStorage.getItem('my-kpop-collection:v1')`), '{broken');
  await click('[data-close="album-dialog"]'); await click('#backup-open');
  await upload(backup, 'repair.json'); await click('input[value="replace"]'); await click('#import-apply');
  assert.equal((await state()).versions[ready].quantity, 4);
  assert.equal(await evaluate(`document.querySelector('#storage-alert').hidden`), true);
  console.log('PASS: quota failure rollback, corrupt-data preservation and confirmed backup recovery');
  assert.deepEqual(errors, [], 'no JavaScript errors');
  assert.deepEqual(badRequests, [], 'no failed asset requests');
  console.log('PASS: no uncaught JavaScript/console errors or failed HTTP requests');
  await writeFile(join(outputs, 'browser-result.json'), JSON.stringify({ passed: true, errors, badRequests, url: process.env.TEST_URL || 'http://127.0.0.1:8000/Kpop-Collection/' }, null, 2));
} finally {
  socket?.close(); chrome.kill('SIGTERM');
  await delay(500);
  await rm(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
