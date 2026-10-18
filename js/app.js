import { loadCatalog, filterAlbums, TYPE_LABELS, REGION_LABELS } from './catalog.js';
import { STORAGE_KEY, MAX_BACKUP_BYTES, MAX_QUANTITY, emptyCollection, loadCollection, saveCollection, setVersion, setPending, transferPending, albumStats, collectionStats, parseBackup, validateRelations, mergeCollections, exportBackup, unknownRecordCount } from './collection.js';

const $ = selector => document.querySelector(selector);
const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
let catalog;
let collection = emptyCollection();
let storageBlocked = false;
let recoveredRaw = null;
let activeAlbumId = null;
let imported = null;
let importToken = 0;
let noticeTimer;
const filters = { groupId: 'twice', list: 'all', search: '', year: '', region: '', type: '' };
let view = 'albums';
const albumDialog = $('#album-dialog');
const backupDialog = $('#backup-dialog');

function notify(message) {
  $('#notice').textContent = message;
  $('#notice').hidden = false;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { $('#notice').hidden = true; }, 4500);
}
function storageWarning(message, raw = recoveredRaw) {
  const alert = $('#storage-alert');
  alert.replaceChildren(document.createTextNode(message + ' '));
  if (raw !== null) {
    recoveredRaw = raw;
    const button = document.createElement('button');
    button.className = 'text-button';
    button.textContent = '下載原始資料';
    button.addEventListener('click', () => download(recoveredRaw, 'my-kpop-collection-recovery.json'));
    alert.append(button);
  }
  alert.hidden = false;
}
function readStorage() {
  try {
    collection = validateRelations(loadCollection(window.localStorage), catalog);
    storageBlocked = false;
    recoveredRaw = null;
    $('#storage-alert').hidden = true;
  } catch {
    storageBlocked = true;
    let raw = null;
    try { raw = window.localStorage.getItem(STORAGE_KEY); } catch { /* Storage access may be denied. */ }
    storageWarning('無法讀取收藏，已保留原始資料並暫停修改。請下載原始資料，或在備份視窗以有效檔案覆蓋；也請檢查瀏覽器儲存權限。', raw);
  }
}
function commit(next, { replace = false } = {}) {
  if (storageBlocked && !replace) throw new Error('收藏讀取異常，已暫停修改。請先備份原始資料，或匯入有效備份並選擇覆蓋。');
  saveCollection(window.localStorage, next);
  collection = next;
  recoveredRaw = null;
  storageBlocked = false;
  $('#storage-alert').hidden = true;
  render();
  if (albumDialog.open) renderDetail();
}
function freshCollection() {
  if (storageBlocked) throw new Error('請先在備份視窗修復收藏資料。');
  return validateRelations(loadCollection(window.localStorage), catalog);
}
function tryMutation(operation) {
  try { commit(operation(freshCollection())); notify('收藏已儲存在此瀏覽器'); }
  catch (error) {
    render();
    if (albumDialog.open) renderDetail();
    storageWarning(`未儲存變更：${error.message} 請檢查瀏覽器儲存權限與空間，並先匯出備份。`);
  }
}
function versionsFor(albumId) { return catalog.versions.filter(v => v.albumId === albumId); }
function meta(album) {
  return `<span>${escapeHTML(album.releaseDate.replaceAll('-', '.'))}</span><span aria-hidden="true">·</span><span>${TYPE_LABELS[album.type]}</span><span class="region-tag">${album.region}</span>`;
}
function renderStats() {
  const stats = collectionStats(collection, catalog, filters.groupId);
  const items = [
    ['已擁有專輯', stats.ownedAlbums, '種', '包含版本未確認的專輯'],
    ['想要收藏', stats.wantedVersions, '版本', `來自 ${stats.wantedAlbums} 種專輯`]
  ];
  $('#stats').innerHTML = items.map(([label, value, unit, caption]) => `<div class="stat"><p class="stat-label"><span class="stat-dot" aria-hidden="true"></span>${label}</p><p class="stat-value">${value}<small>${unit}</small></p><p class="stat-caption">${caption}</p></div>`).join('');
}
function card(album) {
  const stats = albumStats(collection, album.id, catalog.versions);
  const versions = versionsFor(album.id);
  const index = String(catalog.albums.indexOf(album) + 1).padStart(2, '0');
  return `<article class="album-card"><button type="button" class="album-open" data-album="${album.id}" aria-label="查看 ${escapeHTML(album.name)} 的版本與收藏"><div class="cover-wrap"><img src="${escapeHTML(album.cover)}" alt="${escapeHTML(album.coverAlt)}" width="400" height="400" loading="lazy"><span class="cover-index">${album.region} / ${album.releaseDate.slice(0, 4)}</span><span class="cover-status">${stats.copies > 0 ? '<span>✓ 已擁有</span>' : ''}${stats.wantedVersions > 0 ? '<span class="wanted">♡ 想要</span>' : ''}</span></div><h3 class="album-title">${escapeHTML(album.name)}</h3><p class="album-meta">${meta(album)}</p></button><div class="album-collection"><span>${stats.ownedVersions ? `<strong>已收 ${stats.ownedVersions}</strong>` : '已收 0'} / ${versions.length} 收錄版本</span><span class="${stats.pendingCopies ? 'pending-text' : ''}">${stats.copies ? `${stats.copies} 張${stats.pendingCopies ? ` · 待確認 ${stats.pendingCopies}` : ''}` : `NO. ${index}`}</span></div></article>`;
}
function versionRow(version, context) {
  const entry = collection.versions[version.id] || { quantity: 0, wanted: false };
  const prefix = `${context}-${version.id}`;
  return `<div class="version-row"><div class="version-name">${escapeHTML(version.name)}<small>${escapeHTML(version.format)}</small></div><div class="version-controls"><label class="check" for="${prefix}-owned"><input id="${prefix}-owned" type="checkbox" data-version="${version.id}" data-field="owned" ${entry.quantity > 0 ? 'checked' : ''}>已擁有</label><label class="check" for="${prefix}-wanted"><input id="${prefix}-wanted" type="checkbox" data-version="${version.id}" data-field="wanted" ${entry.wanted ? 'checked' : ''}>想要</label><label class="quantity" for="${prefix}-quantity">張數<input id="${prefix}-quantity" type="number" inputmode="numeric" min="0" max="${MAX_QUANTITY}" step="1" value="${entry.quantity}" data-version="${version.id}" data-field="quantity" aria-label="${escapeHTML(version.name)} 擁有張數"></label></div></div>`;
}
function pendingPanel(album, context) {
  const quantity = collection.pending[album.id]?.quantity || 0;
  const versions = versionsFor(album.id);
  return `<div class="pending-panel"><div class="pending-top"><h3>版本未確認</h3><label class="quantity" for="${context}-${album.id}-pending">暫存張數<input id="${context}-${album.id}-pending" type="number" inputmode="numeric" min="0" max="${MAX_QUANTITY}" step="1" value="${quantity}" data-pending="${album.id}" aria-label="${escapeHTML(album.name)} 版本未確認張數"></label></div><p>只記錄尚未分配到任何版本的實體張數，請勿把已確認的張數重複填入。</p>${quantity > 0 && versions.length ? `<form class="transfer-form" data-transfer="${album.id}"><label>確認版本<select name="version" aria-label="${escapeHTML(album.name)} 轉入版本">${versions.map(v => `<option value="${v.id}">${escapeHTML(v.name)}</option>`).join('')}</select></label><label>張數<input type="number" name="quantity" min="1" max="${quantity}" step="1" value="1" required aria-label="${escapeHTML(album.name)} 轉移張數"></label><button type="submit" class="button">轉移到此版本 ↗</button></form>` : ''}</div>`;
}
function versionAlbum(album) {
  let versions = versionsFor(album.id);
  if (filters.list === 'owned') versions = versions.filter(v => collection.versions[v.id]?.quantity > 0);
  if (filters.list === 'wanted') versions = versions.filter(v => collection.versions[v.id]?.wanted);
  return `<article class="version-album"><div class="version-album-heading"><img src="${escapeHTML(album.cover)}" width="64" height="64" alt="${escapeHTML(album.coverAlt)}" loading="lazy"><button type="button" class="album-open" data-album="${album.id}"><h3>${escapeHTML(album.name)}</h3><p class="album-meta">${meta(album)}</p></button><button type="button" class="text-button" data-album="${album.id}">專輯詳情 ↗</button></div>${versions.map(v => versionRow(v, 'list')).join('')}${!versions.length ? '<p class="no-versions">目前沒有符合的已確認版本，可先記錄未確認張數。</p>' : ''}${filters.list !== 'wanted' ? pendingPanel(album, 'list') : ''}</article>`;
}
function render() {
  if (!catalog) return;
  renderStats();
  const group = catalog.groups.find(g => g.id === filters.groupId);
  $('#catalog-title').innerHTML = `${escapeHTML(group.name)} <span>${filters.list === 'owned' ? '已擁有' : filters.list === 'wanted' ? '想要清單' : '專輯圖鑑'}</span>`;
  document.querySelectorAll('[data-list]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.list === filters.list)));
  document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
  const albums = filterAlbums(catalog, collection, filters);
  const total = catalog.albums.filter(a => a.groupId === filters.groupId).length;
  $('#result-count').textContent = `顯示 ${albums.length} / ${total} 張專輯${filters.list === 'owned' ? ' · 已擁有' : filters.list === 'wanted' ? ' · 想要' : ' · 由新到舊'}`;
  $('#catalog-content').innerHTML = albums.length ? (view === 'albums' ? `<div class="album-grid">${albums.map(card).join('')}</div>` : albums.map(versionAlbum).join('')) : '<div class="empty"><strong>這裡還沒有專輯</strong><p>試試其他篩選，或到專輯圖鑑新增你的收藏。</p><button type="button" class="button" id="empty-reset">瀏覽全部專輯</button></div>';
  $('#catalog-content').setAttribute('aria-busy', 'false');
}
function renderDetail() {
  const album = catalog.albums.find(a => a.id === activeAlbumId);
  if (!album) return;
  const focusedId = document.activeElement?.id;
  const versions = versionsFor(album.id);
  const stats = albumStats(collection, album.id, catalog.versions);
  const source = album.sources?.find(url => /^https:\/\//.test(url));
  $('#album-detail').innerHTML = `<div class="dialog-top"><p class="eyebrow">ALBUM / ${REGION_LABELS[album.region]}</p><button type="button" id="detail-close" class="icon-button" data-close="album-dialog" aria-label="關閉專輯詳情">×</button></div><div class="detail-header"><img class="detail-cover" src="${escapeHTML(album.cover)}" alt="${escapeHTML(album.coverAlt)}" width="126" height="126"><div><h2 id="album-dialog-title">${escapeHTML(album.name)}</h2><p class="album-meta">${meta(album)}</p><p class="album-meta">已收 ${stats.ownedVersions} 種版本 · 共 ${stats.copies} 張 · 想要 ${stats.wantedVersions} 種版本</p>${source ? `<a class="detail-source" href="${escapeHTML(source)}" target="_blank" rel="noopener noreferrer">發行資料來源 ↗</a>` : ''}</div></div><section class="version-section" aria-label="實體版本收藏"><div class="version-intro"><h3>實體版本 <span class="muted">/ ${versions.length} 種收錄</span></h3><p>「已擁有」與「想要」可以同時勾選</p></div><p class="dialog-copy">${escapeHTML(album.catalogNote)}</p>${versions.map(v => versionRow(v, 'detail')).join('')}${pendingPanel(album, 'detail')}</section>`;
  if (focusedId) document.getElementById(focusedId)?.focus({ preventScroll: true });
}
function openAlbum(id) {
  activeAlbumId = id;
  renderDetail();
  albumDialog.showModal();
  $('#detail-close').focus({ preventScroll: true });
}
function resetFilters() {
  Object.assign(filters, { search: '', year: '', region: '', type: '' });
  for (const key of ['search', 'year', 'region', 'type']) $(`#${key}`).value = '';
  render();
}
function refreshYears() {
  const years = [...new Set(catalog.albums.filter(a => a.groupId === filters.groupId).map(a => a.releaseDate.slice(0, 4)))].sort().reverse();
  $('#year').innerHTML = '<option value="">所有年份</option>' + years.map(y => `<option value="${y}">${y}</option>`).join('');
}
function download(text, filename) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url; link.download = filename;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function importError(message) {
  $('#import-preview').textContent = message;
  $('#import-preview').classList.add('error');
}
function restoreFocus(id) { if (id) document.getElementById(id)?.focus({ preventScroll: true }); }

document.addEventListener('click', event => {
  const target = event.target.closest('button');
  if (!target) return;
  if (target.dataset.close) { document.getElementById(target.dataset.close).close(); return; }
  if (!catalog) return;
  if (target.dataset.album) openAlbum(target.dataset.album);
  if (target.dataset.view) { view = target.dataset.view; render(); }
  if (target.dataset.list) { filters.list = target.dataset.list; render(); $('#catalog').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' }); }
  if (target.dataset.group) {
    filters.groupId = target.dataset.group;
    document.querySelectorAll('[data-group]').forEach(b => b.setAttribute('aria-pressed', String(b === target)));
    refreshYears(); resetFilters();
  }
  if (target.id === 'empty-reset') { filters.list = 'all'; resetFilters(); }
});
for (const key of ['search', 'year', 'region', 'type']) {
  $(`#${key}`).addEventListener(key === 'search' ? 'input' : 'change', event => { filters[key] = event.target.value; render(); });
}
$('#reset-filters').addEventListener('click', resetFilters);
document.addEventListener('change', event => {
  const input = event.target;
  if (!catalog || (!input.dataset.version && !input.dataset.pending)) return;
  const focusId = input.id;
  if (input.type === 'number' && (!input.validity.valid || input.value.trim() === '')) {
    notify('張數須為 0–9999 的整數。'); render(); if (albumDialog.open) renderDetail(); restoreFocus(focusId); return;
  }
  if (input.dataset.pending) tryMutation(current => setPending(current, input.dataset.pending, Number(input.value)));
  else {
    const version = catalog.versions.find(v => v.id === input.dataset.version);
    const changes = input.dataset.field === 'wanted' ? { wanted: input.checked } : { quantity: input.dataset.field === 'owned' ? (input.checked ? Math.max(collection.versions[version.id]?.quantity || 0, 1) : 0) : Number(input.value) };
    tryMutation(current => setVersion(current, version, changes));
  }
  restoreFocus(focusId);
});
document.addEventListener('submit', event => {
  const form = event.target.closest('[data-transfer]');
  if (!form) return;
  event.preventDefault();
  const values = new FormData(form);
  const version = catalog.versions.find(v => v.id === values.get('version') && v.albumId === form.dataset.transfer);
  if (version) tryMutation(current => transferPending(current, version, Number(values.get('quantity'))));
});
albumDialog.addEventListener('close', () => {
  document.querySelector(`[data-album="${activeAlbumId}"]`)?.focus({ preventScroll: true });
});
for (const dialog of [albumDialog, backupDialog]) {
  dialog.addEventListener('click', event => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  });
}
$('#backup-open').addEventListener('click', () => backupDialog.showModal());
$('#export').addEventListener('click', () => {
  if (storageBlocked) { notify('目前收藏讀取異常，請使用頁面下方的「下載原始資料」保留原檔。'); return; }
  try {
    collection = freshCollection();
    download(exportBackup(collection), `my-kpop-collection-${new Date().toISOString().slice(0, 10)}.json`);
    notify('已下載收藏備份');
  } catch (error) { notify(`無法匯出：${error.message}`); }
});
$('#import-file').addEventListener('change', async event => {
  imported = null;
  const token = ++importToken;
  $('#import-apply').disabled = true;
  $('#import-preview').classList.remove('error');
  const file = event.target.files[0];
  if (!file) { $('#import-preview').textContent = '先選擇檔案，驗證通過後才能匯入。'; return; }
  if (file.size > MAX_BACKUP_BYTES) { importError('備份超過 2 MB 上限。'); return; }
  $('#import-preview').textContent = '正在驗證備份…';
  try {
    const candidate = validateRelations(parseBackup(await file.text()), catalog);
    if (token !== importToken) return;
    imported = candidate;
    const entries = Object.values(candidate.versions);
    const copies = entries.reduce((n, e) => n + e.quantity, 0) + Object.values(candidate.pending).reduce((n, e) => n + e.quantity, 0);
    const unknown = unknownRecordCount(candidate, catalog);
    $('#import-preview').textContent = `驗證通過 · ${entries.filter(e => e.quantity > 0).length} 種已確認版本 · ${copies} 張 · ${entries.filter(e => e.wanted).length} 種想要版本。${unknown ? `另有 ${unknown} 筆目前目錄外紀錄，將完整保留，待目錄擴充後顯示。` : ''} 合併採保守去重；不同裝置若各有不同的未確認實體，請於匯入後核對暫存張數。`;
    $('#import-apply').disabled = false;
  } catch (error) { if (token === importToken) importError(`驗證失敗：${error.message}`); }
});
$('#import-apply').addEventListener('click', () => {
  if (!imported) return;
  const replace = $('input[name="import-mode"]:checked').value === 'replace';
  if (replace && !window.confirm('確定以備份覆蓋全部收藏？目前的版本、想要與未確認張數都會被取代。建議先下載現有備份。')) return;
  try {
    const next = replace ? structuredClone(imported) : mergeCollections(freshCollection(), imported);
    commit(next, { replace });
    imported = null; importToken++;
    $('#import-file').value = '';
    $('#import-apply').disabled = true;
    $('#import-preview').classList.remove('error');
    $('#import-preview').textContent = `已${replace ? '覆蓋' : '合併'}並儲存收藏。`;
    notify('收藏匯入完成');
  } catch (error) { importError(`未匯入：${error.message}`); }
});
window.addEventListener('storage', event => {
  if (event.key !== STORAGE_KEY && event.key !== null) return;
  if (!catalog) return;
  readStorage(); render(); if (albumDialog.open) renderDetail();
  notify('已同步此瀏覽器其他分頁的收藏變更');
});
async function start() {
  try {
    catalog = await loadCatalog();
    filters.groupId = catalog.groups[0].id;
    readStorage();
    $('#artists').innerHTML = catalog.groups.map(group => `<button type="button" class="artist" data-group="${group.id}" aria-pressed="${group.id === filters.groupId}"><span class="artist-mark" aria-hidden="true">${escapeHTML(group.name.slice(0, 2))}</span><span class="artist-name">${escapeHTML(group.name)}<span class="artist-count">${catalog.albums.filter(a => a.groupId === group.id).length} 張專輯 · ${escapeHTML(group.description || '')}</span></span><span class="artist-check" aria-hidden="true">✓</span></button>`).join('');
    refreshYears(); render();
  } catch (error) {
    $('#catalog-content').innerHTML = `<div class="empty"><strong>暫時無法載入圖鑑</strong><p>${escapeHTML(error.message)}。請以 HTTP 伺服器開啟網站，或稍後重新整理。</p></div>`;
    $('#catalog-content').setAttribute('aria-busy', 'false');
    $('#result-count').textContent = '目錄載入失敗';
  }
}
start();
