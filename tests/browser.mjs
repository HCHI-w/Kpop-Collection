// Dependency-free Chromium end-to-end smoke test via the DevTools Protocol.
// Requires Chromium and an HTTP server serving the parent directory on :8000.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, readdir, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
const releaseData = JSON.parse(await readFile(new URL('../data/twice/albums.json', import.meta.url), 'utf8')).albums;
const versionData = JSON.parse(await readFile(new URL('../data/twice/versions.json', import.meta.url), 'utf8')).versions;
const albumCount = releaseData.length;
const noVersionCount = releaseData.filter(a => !versionData.some(v => v.albumId === a.id)).length;
const temp = await mkdtemp(join(tmpdir(), 'kpop-browser-'));
const outputs = resolve('test-results');
await mkdir(outputs, { recursive: true });
const chrome = spawn(process.env.CHROMIUM_BIN || '/usr/bin/chromium', ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${temp}`, 'about:blank'], { stdio: 'ignore' });
let socket;
let dialogAccept = true;
const errors = [];
const badRequests = [];
const expectedMissingAssets = new Set();
const catalogFixtures = new Map();
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
  await poll(() => evaluate(`document.querySelectorAll('.album-card').length===${albumCount}`), 'catalog loaded');
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
    if (message.method === 'Fetch.requestPaused') {
      const fixture = catalogFixtures.get(new URL(message.params.request.url).pathname);
      const requestId = message.params.requestId;
      const response = fixture
        ? send('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from(JSON.stringify(fixture)).toString('base64') })
        : send('Fetch.continueRequest', { requestId });
      response.catch(error => errors.push(error.message));
    }
    if (message.method === 'Page.javascriptDialogOpening') send('Page.handleJavaScriptDialog', { accept: dialogAccept }).catch(() => {});
  });
  await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable');
  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: temp });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
  await load();
  const overviewSelector = '[data-album="twice-ready-to-be"] .cover-wrap img';
  const versionImages = '.version-album:has(#list-twice-ready-to-be-ready-owned) .version-cover';
  const readyVersions = versionData.filter(v => v.albumId === 'twice-ready-to-be');
  const versionSources = readyVersions.map(v => v.cover || './assets/covers/ready-to-be.svg');
  assert.equal(new Set(versionSources.slice(0, 3)).size, 3);
  const sources = selector => evaluate(`[...document.querySelectorAll(${JSON.stringify(selector)})].map(i=>i.getAttribute('src'))`);
  const loadImages = async selector => {
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center'})`);
    await poll(() => evaluate(`[...document.querySelectorAll(${JSON.stringify(selector)})].every(i=>i.complete && i.naturalWidth>0)`), `images loaded: ${selector}`);
  };
  assert.deepEqual(await sources(overviewSelector), ['./assets/covers/ready-to-be.svg']);
  await click('[data-view="versions"]');
  assert.deepEqual(await sources(versionImages), versionSources);
  await loadImages(versionImages);
  const inheritedSelector = '#list-twice-page-two-pink-owned';
  assert.equal(await evaluate(`document.querySelector('${inheritedSelector}').closest('.version-row').querySelector('img').getAttribute('src')`), './assets/covers/page-two.svg');
  await click('[data-album="twice-ready-to-be"]');
  assert.deepEqual(await sources('#album-dialog .version-cover'), versionSources);
  assert.deepEqual(await sources('#album-dialog .detail-cover'), ['./assets/covers/ready-to-be.svg']);
  await loadImages('#album-dialog .version-cover');
  // A wide source must still occupy the same square as a square source.
  await evaluate(`document.querySelector('#album-dialog .version-cover').src='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="180"><rect width="400" height="180" fill="pink"/></svg>')`);
  await loadImages('#album-dialog .version-cover');
  assert.equal(await evaluate(`(()=>{const i=document.querySelector('#album-dialog .version-cover');const r=i.getBoundingClientRect();return i.naturalWidth===400 && i.naturalHeight===180 && Math.abs(r.width-r.height)<1 && getComputedStyle(i).objectFit==='cover'})()`), true);
  await click('[data-close="album-dialog"]');

  // Load catalog JSON with missing images, exercising real 404s after rendering.
  const versionsFixture = JSON.parse(await readFile(new URL('../data/twice/versions.json', import.meta.url), 'utf8'));
  const albumsFixture = JSON.parse(await readFile(new URL('../data/twice/albums.json', import.meta.url), 'utf8'));
  versionsFixture.versions.find(v=>v.id==='twice-ready-to-be-ready').cover = './assets/covers/test-missing-version.svg';
  albumsFixture.albums.find(a=>a.id==='twice-page-two').cover = './assets/covers/test-missing-album.svg';
  const baseURL = process.env.TEST_URL || 'http://127.0.0.1:8000/Kpop-Collection/';
  for (const name of ['version', 'album']) expectedMissingAssets.add(new URL(`./assets/covers/test-missing-${name}.svg`, baseURL).href);
  catalogFixtures.set(new URL('./data/twice/versions.json', baseURL).pathname, versionsFixture);
  catalogFixtures.set(new URL('./data/twice/albums.json', baseURL).pathname, albumsFixture);
  await send('Fetch.enable', { patterns: [{ urlPattern: '*data/twice/*.json' }] });
  await load();
  assert.deepEqual(await sources(overviewSelector), ['./assets/covers/ready-to-be.svg']);
  await click('[data-album="twice-ready-to-be"]');
  await loadImages('#album-dialog .version-cover');
  assert.deepEqual(await sources('#album-dialog .version-cover'), ['./assets/covers/placeholder.svg', ...versionSources.slice(1)]);
  assert.equal(await evaluate(`document.querySelector('#album-dialog .version-cover').alt`), '專輯封面佔位圖片');
  await click('[data-close="album-dialog"]');
  await click('[data-view="versions"]');
  await loadImages(versionImages);
  assert.deepEqual(await sources(versionImages), ['./assets/covers/placeholder.svg', ...versionSources.slice(1)]);
  await click('[data-album="twice-page-two"]');
  await loadImages('#album-dialog .version-cover');
  assert.deepEqual(await sources('#album-dialog .version-cover'), ['./assets/covers/placeholder.svg', './assets/covers/placeholder.svg']);
  await loadImages('#album-dialog .detail-cover');
  assert.deepEqual(await sources('#album-dialog .detail-cover'), ['./assets/covers/placeholder.svg']);
  await click('[data-close="album-dialog"]');
  await click('[data-view="albums"]');
  const missingAlbumSelector = '[data-album="twice-page-two"] .cover-wrap img';
  await loadImages(missingAlbumSelector);
  assert.deepEqual(await sources(missingAlbumSelector), ['./assets/covers/placeholder.svg']);
  for (const url of expectedMissingAssets) assert.ok(badRequests.includes(url), `real missing image request: ${url}`);
  await send('Fetch.disable');
  catalogFixtures.clear();
  await load();
  console.log('PASS: independent version covers in list/dialog, album overview unchanged, inherited album covers, real version/album 404s use shared placeholder');
  assert.equal(await evaluate('document.documentElement.lang'), 'zh-Hant');
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.album-grid')).gridTemplateColumns.split(' ').length`), 5);
  await poll(() => evaluate(`[...document.querySelectorAll('.cover-wrap img')].every(i=>i.complete && i.naturalWidth>0)`), 'covers loaded');
  assert.equal(await evaluate(`document.querySelector('.brand').getAttribute('aria-label')`), '專輯圖鑑 首頁');
  assert.equal(await evaluate(`document.querySelector('.brand > span:last-child').childNodes[0].textContent`), '專輯圖鑑');
  assert.equal(await evaluate(`document.title`), 'My K-pop Collection｜我的專輯收藏');
  assert.equal(await evaluate(`document.querySelector('.site-footer').textContent.includes('My K-pop Collection')`), true);
  assert.equal(await evaluate(`document.querySelector('meta[name="theme-color"]').content`), '#212121');
  assert.deepEqual(await evaluate(`[...document.querySelector('main').children].slice(0,3).map(e=>e.id || e.className)`), ['intro', 'collection-summary', 'catalog']);
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('.stat-label')].map(e=>e.textContent)`), ['已擁有專輯', '想要收藏']);
  for (const selector of ['body', '.site-header', '.artist', '.stats', '.filters', '#year', '.segmented button[aria-pressed=true]', '.cover-index', '.site-footer']) await assertDark(selector);
  assert.equal(await count('input[type=number], .pending-panel, .transfer-form, .collection-tip'), 0);
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
  }, pending: { 'twice-ready-to-be': { quantity: 1 }, 'future-album': { quantity: 2 }, 'twice-twicetagram': { quantity: 3 } } });
  await evaluate(`localStorage.setItem('my-kpop-collection:v1',${JSON.stringify(legacy)})`);
  await load();
  assert.equal(await evaluate(`localStorage.getItem('my-kpop-collection:v1')`), legacy);
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('.stat-value')].map(e=>e.childNodes[0].textContent)`), ['1', '1']);
  assert.equal(await count('#legacy-dialog[open]'), 1);
  await assertDark('#legacy-dialog');
  for (const width of [320, 375]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: true });
    assert.equal(await evaluate(`document.querySelector('#legacy-dialog').scrollWidth<=document.querySelector('#legacy-dialog').clientWidth`), true, `legacy dialog no overflow at ${width}`);
    assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true);
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(join(outputs, `legacy-${width}.png`), Buffer.from(shot.data, 'base64'));
  }
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });

  assert.equal(await evaluate(`document.querySelector('#legacy-clear').disabled`), true);
  assert.equal(await evaluate(`document.querySelector('#legacy-records').textContent.includes('twicetagram')`), true);
  await click('#legacy-keep');
  await click('[data-group="twice"]');
  assert.equal(await evaluate(`localStorage.getItem('my-kpop-collection:v1')`), legacy);
  await load();
  assert.equal(await count('#legacy-dialog[open]'), 0, 'same pending receipt suppresses repeated reminder');
  await click('[data-album="twice-ready-to-be"]');
  assert.equal(await evaluate(`document.querySelector('#detail-twice-ready-to-be-ready-owned').checked`), true);
  await click('#detail-twice-ready-to-be-ready-wanted');
  assert.equal((await state()).versions['twice-ready-to-be-ready'].quantity, 2, 'wish change preserves legacy quantity');
  await click('[data-close="album-dialog"]');
  await click('#backup-open'); await click('#legacy-review');
  await click('#legacy-export');
  const legacyFile = 'my-kpop-collection-before-legacy-cleanup.json';
  await poll(async () => (await readdir(temp)).includes(legacyFile), 'legacy backup download');
  const legacyBackup = JSON.parse(await readFile(join(temp, legacyFile), 'utf8'));
  assert.deepEqual(legacyBackup.pending, JSON.parse(legacy).pending);
  assert.equal(legacyBackup.versions['future-version'].quantity, 3);
  await click('#legacy-backed-up');
  dialogAccept = false; await click('#legacy-clear');
  assert.deepEqual((await state()).pending, legacyBackup.pending, 'cancel cleanup preserves pending');
  await evaluate(`{const c=JSON.parse(localStorage.getItem('my-kpop-collection:v1'));c.pending['future-album'].quantity=4;localStorage.setItem('my-kpop-collection:v1',JSON.stringify(c));}`);
  dialogAccept = true; await click('#legacy-clear');
  assert.equal((await state()).pending['future-album'].quantity, 4);
  assert.equal(await evaluate(`document.querySelector('#legacy-clear').disabled`), true);
  assert.match(await evaluate(`document.querySelector('#legacy-error').textContent`), /重新下載/);
  await click('#legacy-export'); await click('#legacy-backed-up');
  await evaluate(`window.originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException('Quota exceeded','QuotaExceededError')}`);
  await click('#legacy-clear');
  assert.equal((await state()).pending['future-album'].quantity, 4);
  assert.equal(await count('#legacy-dialog[open]'), 1);
  await evaluate(`Storage.prototype.setItem=window.originalSetItem`);
  await click('#legacy-clear');
  assert.deepEqual((await state()).pending, {});
  assert.equal((await state()).versions['future-version'].quantity, 3);
  assert.equal(await count('#legacy-dialog[open]'), 0);
  await upload(legacyBackup, 'legacy-restore.json'); await click('input[value="replace"]'); await click('#import-apply');
  assert.deepEqual((await state()).pending, legacyBackup.pending);
  assert.equal(await count('#legacy-dialog[open]'), 1);
  await click('#legacy-keep');
  const conflicting = { ...legacyBackup, versions: { ...legacyBackup.versions, 'twice-ready-to-be-ready': { albumId: 'twice-ready-to-be', quantity: 9, wanted: true } } };
  await upload(conflicting, 'legacy-merge.json'); await click('input[value="merge"]'); await click('#import-apply');
  assert.equal((await state()).versions['twice-ready-to-be-ready'].quantity, 9);
  assert.deepEqual((await state()).pending, legacyBackup.pending);
  await click('[data-close="backup-dialog"]');
  // Only this disposable test profile is reset for normal interaction scenarios.
  await evaluate(`localStorage.removeItem('my-kpop-collection:v1')`);
  await load();
  console.log('PASS: legacy v1 data untouched on load, wish preserves quantity, once-only review, downloaded backup, explicit cleanup/cancel, stale backup guard, failed-write preservation, old JSON restore/merge');
  await change('#year', '2022'); assert.equal(await count('.album-card'), 2);
  await change('#region', 'JP'); await change('#type', 'studio'); assert.equal(await count('.album-card'), 1);
  assert.equal(await evaluate(`document.querySelector('.album-title').textContent`), 'Celebrate');
  await click('#reset-filters');
  await change('#search', 'ready', 'input'); assert.equal(await count('.album-card'), 1);
  await change('#search', 'no-such-album', 'input'); assert.equal(await count('.album-card'), 0);
  await click('#empty-reset'); assert.equal(await count('.album-card'), albumCount);
  console.log('PASS: catalog, relative subpath assets, combined filters, normalized search, empty/reset');

  const ready = 'twice-ready-to-be-ready';
  const aid = 'twice-ready-to-be';
  await click(`[data-album="${aid}"]`);
  for (const selector of ['#album-dialog', '.version-row']) await assertDark(selector);
  assert.equal(await count('#album-dialog[open]'), 1);
  assert.equal(await count('#album-dialog [data-version][data-field="owned"]'), readyVersions.length);
  await click(`#detail-${ready}-owned`);
  await click(`#detail-${ready}-wanted`);
  let saved = await state();
  assert.equal(saved.versions[ready].quantity, 1); assert.equal(saved.versions[ready].wanted, true);
  assert.equal(Object.keys(saved.versions).length, 1);
  await click(`#detail-${ready}-owned`);
  assert.equal((await state()).versions[ready].quantity, 0);
  assert.equal((await state()).versions[ready].wanted, true);
  await click(`#detail-${ready}-owned`);
  await click(`#detail-${ready}-wanted`);
  assert.equal((await state()).versions[ready].quantity, 1);
  assert.equal((await state()).versions[ready].wanted, false);
  await click(`#detail-${ready}-wanted`);
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('.stat-value')].map(e=>e.childNodes[0].textContent)`), ['1', '1']);
  assert.doesNotMatch(await evaluate(`document.querySelector('#album-detail').textContent`), /張數|未確認|共 \d+ 張/);
  assert.equal(await count('input[type=number], .pending-panel, .transfer-form, .collection-tip'), 0);
  await send('Page.reload');
  await poll(() => evaluate(`document.querySelectorAll('.album-card').length===${albumCount}`), 'reload');
  assert.equal((await state()).versions[ready].quantity, 1);
  await click('[data-list="owned"]'); assert.equal(await count('.album-card'), 1);
  await click('[data-list="wanted"]'); assert.equal(await count('.album-card'), 1);
  await click('[data-view="versions"]'); assert.equal(await count('.version-row'), 1);
  await click('[data-list="all"]'); assert.equal(await count('.version-album'), albumCount);
  await assertDark('.version-album');
  await click('[data-view="albums"]');
  await click('[data-album="twice-twicetagram"]');
  assert.equal(await count('#album-dialog .version-row'), 0);
  assert.match(await evaluate(`document.querySelector('#album-detail .no-versions').textContent`), /尚未收錄實體版本/);
  assert.doesNotMatch(await evaluate(`document.querySelector('#album-detail').textContent`), /未確認|張數/);
  await click('[data-close="album-dialog"]');
  await click('[data-view="versions"]');
  assert.equal(await count('#catalog-content .no-versions'), noVersionCount);
  assert.match(await evaluate(`document.querySelector('.no-versions').textContent`), /尚未收錄實體版本/);
  await click('#list-twice-ready-to-be-to-wanted');
  await click('#list-twice-ready-to-be-to-owned');
  assert.equal((await state()).versions['twice-ready-to-be-to'].wanted, true);
  assert.equal((await state()).versions[ready].quantity, 1);
  await click('#list-twice-ready-to-be-to-wanted');
  await click('#list-twice-ready-to-be-to-owned');
  assert.equal((await state()).versions['twice-ready-to-be-to'], undefined);
  await click('[data-view="albums"]');
  console.log('PASS: independent ownership/wishes check/uncheck, version independence, kind-only statistics, reload persistence, both views, no-version album message, obsolete controls absent');

  await click('#backup-open');
  for (const selector of ['#backup-dialog', '.import-preview', '#import-apply']) await assertDark(selector);
  assert.equal(await evaluate(`document.querySelector('#import-apply').disabled`), true);
  assert.ok(Number(await evaluate(`getComputedStyle(document.querySelector('#import-apply')).opacity`)) < 1);
  await click('#export');
  const downloaded = await poll(async () => (await readdir(temp)).find(n => /^my-kpop-collection-\d{4}-\d{2}-\d{2}\.json$/.test(n)), 'download');
  const backup = JSON.parse(await readFile(join(temp, downloaded), 'utf8'));
  assert.equal(backup.schemaVersion, 1); assert.equal(backup.versions[ready].quantity, 1);
  assert.doesNotMatch(JSON.stringify(backup), /cover|assets\//, 'catalog image metadata never enters downloaded backup');
  await upload('{broken'); assert.equal(await evaluate(`document.querySelector('#import-apply').disabled`), true);
  await assertDark('.import-preview.error');
  await upload({ ...backup, schemaVersion: 99 }, 'future.json'); assert.equal(await evaluate(`document.querySelector('#import-apply').disabled`), true);
  await upload(backup, 'valid.json');
  await click('#import-apply'); await upload(backup, 'repeat.json'); await click('#import-apply');
  assert.equal((await state()).versions[ready].quantity, 1);
  assert.deepEqual((await state()).pending, {});
  await upload({ schemaVersion: 1, versions: {}, pending: {} }, 'empty.json');
  await click('input[value="replace"]');
  dialogAccept = false; await click('#import-apply'); assert.equal((await state()).versions[ready].quantity, 1);
  dialogAccept = true; await click('#import-apply'); assert.deepEqual((await state()).versions, {});
  await upload(backup, 'restore.json'); await click('#import-apply');
  assert.equal((await state()).versions[ready].quantity, 1);
  await click('[data-close="backup-dialog"]');
  console.log('PASS: actual JSON download, malformed/schema rejection, merge idempotence, overwrite cancel/confirm, restore');
  await poll(() => evaluate(`document.querySelector('#notice').hidden`), 'notice dismissed before screenshots');

  for (const [width, columns] of [[1600, 6], [1280, 5], [1024, 4], [768, 4], [375, 2], [320, 2]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 760 });
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('.album-grid')).gridTemplateColumns.split(' ').length`), columns);
    assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true, `no overflow at ${width}`);
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('#stats')).gridTemplateColumns.split(' ').length`), 2);
    assert.equal(await count('.stat'), 2);
    const summary = await evaluate(`(()=>{const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,center:r.top+r.height/2}};return {artist:rect('.artist-section'),stats:rect('#stats'),cards:[...document.querySelectorAll('.stat')].map(e=>e.getBoundingClientRect().width),gap:getComputedStyle(document.querySelector('.collection-summary')).gap}})()`);
    assert.equal(summary.gap, '20px');
    assert.ok(summary.cards.every(w => w <= 150), `stat maximum width at ${width}`);
    assert.ok(summary.stats.width <= 312, 'stats follows actual cards');
    if (width >= 768) {
      assert.equal(summary.stats.left - summary.artist.right, 20, `horizontal gap at ${width}`);
      assert.ok(Math.abs(summary.artist.center-summary.stats.center)<1, `vertical alignment at ${width}`);
    } else {
      assert.equal(summary.stats.top-summary.artist.bottom, 20, `stacked gap at ${width}`);
      assert.equal(summary.stats.left, summary.artist.left);
    }
    // Extra group choices should wrap inside the left section at every width.
    await evaluate(`{const artist=document.querySelector('.artist');for(let i=0;i<4;i++){const extra=artist.cloneNode(true);extra.classList.add('test-artist');extra.querySelector('.artist-name').firstChild.textContent='ADDITIONAL GROUP '+i;document.querySelector('#artists').append(extra);}}`);
    assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true, `additional artists no overflow at ${width}`);
    await evaluate(`document.querySelectorAll('.test-artist').forEach(e=>e.remove())`);
    await click('[data-view="versions"]');
    const coverLayout = await evaluate(`(()=>{const grid=document.querySelector('.version-grid');return {columns:getComputedStyle(grid).gridTemplateColumns.split(' ').length,covers:[...grid.querySelectorAll('.version-cover')].map(i=>{const r=i.getBoundingClientRect();return {width:r.width,height:r.height,fit:getComputedStyle(i).objectFit,lazy:i.loading}})}})()`);
    assert.ok(coverLayout.columns >= 2, `version grid at ${width}`);
    for (const cover of coverLayout.covers) {
      assert.ok(Math.abs(cover.width-cover.height)<1, `square version cover at ${width}`);
      assert.equal(cover.fit, 'cover');
      assert.equal(cover.lazy, 'lazy');
    }
    if (width === 1280 || width === 375) {
      await loadImages(versionImages);
      await evaluate('window.scrollTo(0,0)');
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      await writeFile(join(outputs, `versions-${width}.png`), Buffer.from(shot.data, 'base64'));
    }
    assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true, `version view no overflow at ${width}`);
    assert.equal(await count('input[type=number], .pending-panel, .transfer-form, .collection-tip'), 0);
    await click('[data-view="albums"]');

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
  console.log('PASS: 1600/1280/1024/768/375/320 layouts, 20px artist/stats gap, cards <=150px, sticky header, anchor/navigation clearance, two statistics, dark dialogs, Escape dismissal');

  // Storage denial must roll back the UI; damaged saved data must not be overwritten.
  await evaluate(`window.originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException('Quota exceeded','QuotaExceededError')}`);
  await click(`[data-album="${aid}"]`);
  await click(`#detail-${ready}-owned`);
  await assertDark('#storage-alert');
  assert.equal((await state()).versions[ready].quantity, 1);
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
  assert.equal((await state()).versions[ready].quantity, 1);
  assert.equal(await evaluate(`document.querySelector('#storage-alert').hidden`), true);
  console.log('PASS: quota failure rollback, corrupt-data preservation and confirmed backup recovery');
  assert.deepEqual(errors, [], 'no JavaScript errors');
  assert.deepEqual(badRequests.filter(url => !expectedMissingAssets.has(url)), [], 'no unexpected failed asset requests');
  console.log('PASS: no uncaught JavaScript/console errors or unexpected failed HTTP requests (intentional missing-cover 404s verified)');
  await writeFile(join(outputs, 'browser-result.json'), JSON.stringify({ passed: true, errors, badRequests, url: process.env.TEST_URL || 'http://127.0.0.1:8000/Kpop-Collection/' }, null, 2));
} finally {
  socket?.close(); chrome.kill('SIGTERM');
  await delay(500);
  await rm(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
