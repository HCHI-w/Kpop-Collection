export const SCHEMA_VERSION = 1;
export const STORAGE_KEY = 'my-kpop-collection:v1';
export const MAX_QUANTITY = 9999;
export const MAX_BACKUP_BYTES = 2 * 1024 * 1024;
const ID = /^[a-z0-9][a-z0-9-]{0,119}$/;
const own = (obj, key) => Object.hasOwn(obj, key);
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const check = (condition, message) => { if (!condition) throw new Error(message); };
export const emptyCollection = () => ({ schemaVersion: SCHEMA_VERSION, versions: {}, pending: {} });
export function validQuantity(value) { return Number.isInteger(value) && value >= 0 && value <= MAX_QUANTITY; }
function fields(value, allowed) { return isObject(value) && Object.keys(value).every(key => allowed.includes(key)); }
export function validateCollection(value) {
  check(isObject(value), '備份必須是 JSON 物件。');
  check(value.schemaVersion === SCHEMA_VERSION, '不支援的 schemaVersion；目前只支援版本 1。');
  check(fields(value, ['schemaVersion', 'versions', 'pending', 'exportedAt', 'app']), '備份含有不支援的欄位。');
  if (own(value, 'app')) check(value.app === 'my-kpop-collection', '備份來源不符合。');
  if (own(value, 'exportedAt')) check(typeof value.exportedAt === 'string' && Number.isFinite(Date.parse(value.exportedAt)), '備份日期不合法。');
  check(isObject(value.versions) && isObject(value.pending), '備份缺少 versions 或 pending 物件。');
  check(Object.keys(value.versions).length + Object.keys(value.pending).length <= 10000, '備份紀錄數量過多。');
  const result = emptyCollection();
  for (const [id, entry] of Object.entries(value.versions)) {
    check(ID.test(id) && id !== 'constructor' && id !== 'prototype', '版本 ID 不合法。');
    check(fields(entry, ['albumId', 'quantity', 'wanted']) && typeof entry.albumId === 'string' && ID.test(entry.albumId), '版本紀錄格式不合法。');
    check(validQuantity(entry.quantity) && typeof entry.wanted === 'boolean', '版本張數須為 0–9999 的整數，想要狀態須為布林值。');
    result.versions[id] = { albumId: entry.albumId, quantity: entry.quantity, wanted: entry.wanted };
  }
  for (const [id, entry] of Object.entries(value.pending)) {
    check(ID.test(id) && id !== 'constructor' && id !== 'prototype', '專輯 ID 不合法。');
    check(fields(entry, ['quantity']) && validQuantity(entry.quantity), '未確認張數須為 0–9999 的整數。');
    result.pending[id] = { quantity: entry.quantity };
  }
  return result;
}
export function parseBackup(text) {
  check(new TextEncoder().encode(text).length <= MAX_BACKUP_BYTES, '備份超過 2 MB 上限。');
  let value;
  try { value = JSON.parse(text); } catch { throw new Error('不是有效的 JSON 檔案。'); }
  return validateCollection(value);
}
// Unknown IDs survive imports/exports so adding catalog entries cannot erase collections.
export function validateRelations(collection, catalog) {
  for (const version of catalog.versions) {
    const entry = collection.versions[version.id];
    check(!entry || entry.albumId === version.albumId, `版本 ${version.id} 的專輯對應不一致。`);
  }
  return collection;
}
export function setVersion(collection, version, changes) {
  const next = structuredClone(collection);
  const previous = next.versions[version.id] || { albumId: version.albumId, quantity: 0, wanted: false };
  const entry = { ...previous, ...changes, albumId: version.albumId };
  check(validQuantity(entry.quantity) && typeof entry.wanted === 'boolean', '請輸入 0–9999 的整數張數。');
  if (entry.quantity === 0 && !entry.wanted) delete next.versions[version.id];
  else next.versions[version.id] = entry;
  return next;
}
export function setPending(collection, albumId, quantity) {
  check(validQuantity(quantity), '請輸入 0–9999 的整數張數。');
  const next = structuredClone(collection);
  if (quantity === 0) delete next.pending[albumId];
  else next.pending[albumId] = { quantity };
  return next;
}
export function transferPending(collection, version, quantity) {
  const pending = collection.pending[version.albumId]?.quantity || 0;
  check(Number.isInteger(quantity) && quantity > 0 && quantity <= pending, '轉移張數必須大於 0，且不可超過未確認張數。');
  const confirmed = collection.versions[version.id]?.quantity || 0;
  let next = setVersion(collection, version, { quantity: confirmed + quantity });
  next = setPending(next, version.albumId, pending - quantity);
  return next;
}
function albumTotal(collection, albumId) {
  return Object.values(collection.versions).filter(e => e.albumId === albumId).reduce((n, e) => n + e.quantity, 0) + (collection.pending[albumId]?.quantity || 0);
}
export function mergeCollections(current, incoming) {
  const next = structuredClone(current);
  for (const [id, entry] of Object.entries(incoming.versions)) {
    const old = current.versions[id];
    check(!old || old.albumId === entry.albumId, `版本 ${id} 的專輯對應不一致，無法合併。`);
    next.versions[id] = { albumId: entry.albumId, quantity: Math.max(old?.quantity || 0, entry.quantity), wanted: Boolean(old?.wanted || entry.wanted) };
  }
  // Reconcile pending copies against the union of confirmed copies: a backup
  // made before a transfer must not resurrect the same unidentified copies.
  const albumIds = new Set([...Object.keys(current.pending), ...Object.keys(incoming.pending)]);
  for (const albumId of albumIds) {
    const confirmed = Object.values(next.versions).filter(e => e.albumId === albumId).reduce((n, e) => n + e.quantity, 0);
    const quantity = Math.max(0, Math.max(albumTotal(current, albumId), albumTotal(incoming, albumId)) - confirmed);
    if (quantity) next.pending[albumId] = { quantity };
    else delete next.pending[albumId];
  }
  return next;
}
export function albumStats(collection, albumId, versions) {
  const entries = versions.filter(v => v.albumId === albumId).map(v => collection.versions[v.id]);
  const confirmedCopies = entries.reduce((n, e) => n + (e?.quantity || 0), 0);
  const pendingCopies = collection.pending[albumId]?.quantity || 0;
  return { ownedVersions: entries.filter(e => e?.quantity > 0).length, wantedVersions: entries.filter(e => e?.wanted).length, confirmedCopies, pendingCopies, copies: confirmedCopies + pendingCopies };
}
export function collectionStats(collection, catalog, groupId) {
  const albums = catalog.albums.filter(a => !groupId || a.groupId === groupId);
  const rows = albums.map(a => albumStats(collection, a.id, catalog.versions));
  return { ownedAlbums: rows.filter(r => r.copies > 0).length, ownedVersions: rows.reduce((n, r) => n + r.ownedVersions, 0), copies: rows.reduce((n, r) => n + r.copies, 0), pendingCopies: rows.reduce((n, r) => n + r.pendingCopies, 0), wantedAlbums: rows.filter(r => r.wantedVersions > 0).length, wantedVersions: rows.reduce((n, r) => n + r.wantedVersions, 0) };
}
export function unknownRecordCount(collection, catalog) {
  const versions = new Set(catalog.versions.map(v => v.id));
  const albums = new Set(catalog.albums.map(a => a.id));
  return Object.keys(collection.versions).filter(id => !versions.has(id)).length + Object.keys(collection.pending).filter(id => !albums.has(id)).length;
}
export function exportBackup(collection) {
  return JSON.stringify({ app: 'my-kpop-collection', schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), versions: collection.versions, pending: collection.pending }, null, 2);
}
export function loadCollection(storage) {
  const raw = storage.getItem(STORAGE_KEY);
  return raw === null ? emptyCollection() : parseBackup(raw);
}
export function saveCollection(storage, collection) {
  // Write before updating UI state; failures must never be reported as saved.
  storage.setItem(STORAGE_KEY, JSON.stringify(collection));
}
