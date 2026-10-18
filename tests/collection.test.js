import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { emptyCollection, setVersion, setVersionStatus, pendingSignature, mergeCollections, albumStats, collectionStats, parseBackup, exportBackup, validateRelations, loadCollection, saveCollection, STORAGE_KEY } from '../js/collection.js';
import { validateCatalog, filterAlbums, relativeAsset, loadCatalog, DEFAULT_COVER } from '../js/catalog.js';
const read = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const catalog = validateCatalog((await read('../data/groups.json')).groups, (await read('../data/twice/albums.json')).albums, (await read('../data/twice/versions.json')).versions);
const [ready, to, be] = catalog.versions.filter(v => v.albumId === 'twice-ready-to-be');
test('cutoff, original identities, new release types and chronological filters', async () => {
  const baseline = await read('./fixtures/twice-legacy-ids.json');
  for (const id of baseline.albumIds) assert.ok(catalog.albums.some(a => a.id === id));
  for (const original of baseline.versions) {
    assert.equal(catalog.versions.find(v => v.id === original.id)?.albumId, original.albumId);
  }
  const identities = new Set();
  for (const a of catalog.albums) {
    assert.ok(a.releaseDate <= '2026-10-19', a.name);
    const identity = `${a.region}:${a.name.normalize('NFKC').toLowerCase()}`;
    assert.ok(!identities.has(identity), `duplicate release: ${a.name}`);
    identities.add(identity);
    assert.equal(a.versionsComplete, false, 'unresolved exhaustive version checks must stay explicit');
    assert.ok(a.sources.some(url => /^https:\/\/(twice\.jype\.com|www\.twicejapan\.com|wmg\.jp)\//.test(url)));
  }
  const sorted = filterAlbums(catalog, emptyCollection(), {});
  assert.deepEqual(sorted.map(a => a.releaseDate), sorted.map(a => a.releaseDate).sort().reverse());
  assert.equal(catalog.albums.filter(a => a.region === 'JP').length, 24);
  assert.equal(filterAlbums(catalog, emptyCollection(), { region: 'JP', type: 'compilation' }).length, 6);
  assert.equal(filterAlbums(catalog, emptyCollection(), { year: '2026' })[0].id, 'twice-best-2015-2025');
  for (const type of ['repackage', 'special']) {
    const matching = filterAlbums(catalog, emptyCollection(), { region: 'KR', type });
    assert.ok(matching.length);
    assert.ok(matching.every(a => a.type === type && a.region === 'KR'));
  }
  for (const year of new Set(catalog.albums.map(a => a.releaseDate.slice(0, 4)))) {
    assert.ok(filterAlbums(catalog, emptyCollection(), { year }).every(a => a.releaseDate.startsWith(year)));
  }
});
test('optional version covers normalize independently, inherit album metadata and validate types/paths', async () => {
  const album = catalog.albums.find(a => a.id === ready.albumId);
  const legacy = { id: ready.id, albumId: ready.albumId, name: ready.name, format: 'CD' };
  const normalize = overrides => validateCatalog(catalog.groups, catalog.albums, [{ ...legacy, ...overrides }]).versions[0];
  for (const overrides of [{}, { cover: '' }, { cover: '  ', coverAlt: 'unused', coverIsPlaceholder: false }]) {
    const normalized = normalize(overrides);
    assert.equal(normalized.cover, album.cover);
    assert.equal(normalized.coverAlt, album.coverAlt);
    assert.equal(normalized.coverIsPlaceholder, album.coverIsPlaceholder);
  }
  const own = normalize({ cover: ' ./assets/covers/ready-to-be-ready.svg ', coverAlt: ' READY 封面 ', coverIsPlaceholder: true });
  assert.equal(own.cover, ready.cover);
  assert.equal(own.coverAlt, 'READY 封面');
  assert.equal(own.coverIsPlaceholder, true);
  const minimal = normalize({ cover: ready.cover });
  assert.match(minimal.coverAlt, /READY TO BE READY ver\./);
  assert.equal(minimal.coverIsPlaceholder, false);
  assert.equal(legacy.cover, undefined, 'source record is unchanged');
  assert.equal(album.cover, './assets/covers/ready-to-be.svg', 'album overview stays independent');
  for (const overrides of [{ cover: null }, { cover: 1 }, { coverAlt: 1 }, { coverIsPlaceholder: 'true' }, ...['/cover.jpg', '../cover.jpg', './a/../cover.jpg', 'https://example.com/cover.jpg', './cover.svg?x=1'].map(cover => ({ cover }))]) {
    assert.throws(() => normalize(overrides));
  }
  assert.equal(new Set([ready.cover, to.cover, be.cover]).size, 3);
  for (const cover of [ready.cover, to.cover, be.cover, DEFAULT_COVER]) await readFile(new URL('../' + cover, import.meta.url));
});
test('loadCatalog reads optional version cover fields through JSON fetch', async () => {
  const originalFetch = globalThis.fetch;
  const originalDocument = globalThis.document;
  const groupData = await read('../data/groups.json');
  const albumData = await read('../data/twice/albums.json');
  const versionData = await read('../data/twice/versions.json');
  const resources = new Map([['/Kpop-Collection/data/groups.json', groupData], ['/Kpop-Collection/data/twice/albums.json', albumData], ['/Kpop-Collection/data/twice/versions.json', versionData]]);
  try {
    globalThis.document = { baseURI: 'https://example.com/Kpop-Collection/' };
    globalThis.fetch = async url => ({ ok: true, json: async () => structuredClone(resources.get(url.pathname)) });
    const loaded = await loadCatalog();
    assert.equal(loaded.versions.find(v => v.id === ready.id).cover, ready.cover);
    const inherited = loaded.versions.find(v => v.id === 'twice-page-two-pink');
    assert.equal(inherited.cover, loaded.albums.find(a => a.id === inherited.albumId).cover);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalDocument === undefined) delete globalThis.document; else globalThis.document = originalDocument;
  }
});
test('cover metadata never enters collection storage or JSON backups', () => {
  const saved = setVersionStatus(setVersionStatus(emptyCollection(), ready, 'owned', true), ready, 'wanted', true);
  const backup = exportBackup(saved);
  assert.doesNotMatch(backup, /cover|assets\//);
  assert.equal(saved.schemaVersion, 1);
  assert.deepEqual(saved.versions[ready.id], { albumId: ready.albumId, quantity: 1, wanted: true });
  assert.deepEqual(parseBackup(backup), saved);
});
test('physical edition evidence, pending labels, cover paths and metadata-free backups', async () => {
  const numbers = new Set();
  for (const v of catalog.versions) {
    assert.ok(['verified', 'pending'].includes(v.verificationStatus), v.id);
    const host = new URL(v.source).hostname;
    assert.ok(['thejypshop.com', 'twiceshop.com', 'twicejapan.com', 'wmg.jp'].some(domain => host === domain || host.endsWith('.' + domain)), v.id);
    await readFile(new URL('../' + relativeAsset(v.cover), import.meta.url));
    assert.ok(v.coverAlt?.length > 0);
    if (v.verificationStatus === 'pending') {
      assert.ok(v.verificationNote);
      assert.equal(catalog.albums.find(a => a.id === v.albumId).versionsComplete, false);
    }
    if (v.catalogNumber) {
      assert.ok(!numbers.has(v.catalogNumber), `duplicate SKU: ${v.catalogNumber}`);
      numbers.add(v.catalogNumber);
    }
    if (v.releaseDate) assert.ok(v.releaseDate <= '2026-10-19');
  }
  const baseline = await read('./fixtures/twice-legacy-ids.json');
  const c = emptyCollection();
  for (const v of baseline.versions) c.versions[v.id] = { albumId: v.albumId, quantity: 7, wanted: true };
  c.pending['twice-twicetagram'] = { quantity: 4 };
  c.versions['archival-version'] = { albumId: 'archival-album', quantity: 3, wanted: false };
  const raw = JSON.stringify(c, null, 2);
  const storage = { getItem: () => raw, setItem: () => assert.fail('catalog additions must never rewrite storage') };
  assert.deepEqual(validateRelations(loadCollection(storage), catalog), c);
  const addition = catalog.versions.find(v => !baseline.versions.some(old => old.id === v.id));
  assert.ok(addition);
  const changed = setVersionStatus(c, addition, 'wanted', true);
  assert.deepEqual(parseBackup(exportBackup(changed)), changed);
  for (const v of baseline.versions) assert.deepEqual(changed.versions[v.id], c.versions[v.id]);
  assert.deepEqual(changed.pending, c.pending);
  assert.doesNotMatch(exportBackup(changed), /cover|source|editionType|member|verificationStatus|catalogNumber/);
  for (const overrides of [{ editionType: 'random-card' }, { verificationStatus: 'maybe' }, { verificationStatus: 'pending', verificationNote: '' }, { source: 'javascript:alert(1)' }, { member: 'NAYEON', editionType: 'standard' }]) {
    assert.throws(() => validateCatalog(catalog.groups, catalog.albums, [{ ...ready, ...overrides }]));
  }
  assert.throws(() => validateCatalog(catalog.groups, catalog.albums.map(a => a.id === 'twice-feel-special' ? { ...a, versionsComplete: true } : a), catalog.versions));
});
test('catalog: releases, unique IDs, correct references, relative existing covers', async () => {
  assert.equal(catalog.albums.length, 47);
  assert.equal(catalog.albums.filter(a => a.region === 'KR').length, 23);
  assert.equal(catalog.versions.length, 91);
  assert.equal(ready.id, 'twice-ready-to-be-ready');
  assert.equal(to.id, 'twice-ready-to-be-to');
  assert.equal(be.id, 'twice-ready-to-be-be');
  for (const album of catalog.albums) {
    await readFile(new URL('../' + relativeAsset(album.cover), import.meta.url));
    assert.equal(typeof album.coverIsPlaceholder, 'boolean');
    assert.ok(album.coverAlt.length > 0);
  }
  assert.throws(() => relativeAsset('/cover.svg'));
  assert.throws(() => validateCatalog(catalog.groups, [...catalog.albums, catalog.albums[0]], catalog.versions));
});
test('own and want independently; statistics count album and version kinds only', () => {
  let c = setVersion(emptyCollection(), ready, { quantity: 3, wanted: true });
  assert.deepEqual(albumStats(c, ready.albumId, catalog.versions), { ownedVersions: 1, wantedVersions: 1 });
  assert.deepEqual(collectionStats(c, catalog, 'twice'), { ownedAlbums: 1, ownedVersions: 1, wantedAlbums: 1, wantedVersions: 1 });
  c = setVersion(c, ready, { quantity: 0 });
  assert.equal(c.versions[ready.id].wanted, true);
  c = setVersion(c, ready, { wanted: false });
  assert.equal(c.versions[ready.id], undefined);
});
test('ownership changes use 0/1; wishes preserve legacy quantities and other versions', () => {
  const start = setVersion(setVersion(emptyCollection(), ready, { quantity: 4 }), to, { quantity: 2, wanted: true });
  let next = setVersionStatus(start, ready, 'wanted', true);
  assert.equal(next.versions[ready.id].quantity, 4);
  assert.equal(start.versions[ready.id].wanted, false);
  next = setVersionStatus(next, ready, 'owned', false);
  assert.deepEqual(next.versions[ready.id], { albumId: ready.albumId, quantity: 0, wanted: true });
  next = setVersionStatus(next, ready, 'owned', true);
  assert.equal(next.versions[ready.id].quantity, 1);
  next = setVersionStatus(next, ready, 'wanted', false);
  assert.equal(next.versions[ready.id].quantity, 1);
  assert.deepEqual(next.versions[to.id], start.versions[to.id]);
  assert.throws(() => setVersionStatus(next, ready, 'quantity', true));
  assert.throws(() => setVersion(next, ready, { quantity: 10000 }));
});
test('merge is idempotent; union of wishes and maximum per-version quantities', () => {
  const a = setVersion(emptyCollection(), ready, { quantity: 2 });
  const b = setVersion(setVersion(emptyCollection(), ready, { quantity: 1, wanted: true }), to, { quantity: 3 });
  const merged = mergeCollections(a, b);
  assert.equal(merged.versions[ready.id].quantity, 2);
  assert.equal(merged.versions[ready.id].wanted, true);
  assert.equal(merged.versions[to.id].quantity, 3);
  assert.deepEqual(mergeCollections(merged, b), merged);
});
test('legacy pending survives merges without inference or silent removal; never counts as ownership', () => {
  const before = { ...emptyCollection(), pending: { [ready.albumId]: { quantity: 3 }, 'twice-twicetagram': { quantity: 2 } } };
  const after = { ...setVersion(emptyCollection(), ready, { quantity: 2 }), pending: { [ready.albumId]: { quantity: 1 } } };
  const merged = mergeCollections(after, before);
  assert.equal(merged.pending[ready.albumId].quantity, 3);
  assert.equal(merged.pending['twice-twicetagram'].quantity, 2);
  assert.deepEqual(mergeCollections(before, after), merged);
  assert.deepEqual(mergeCollections(merged, before), merged);
  assert.equal(collectionStats(before, catalog).ownedAlbums, 0);
  assert.equal(collectionStats(merged, catalog).ownedVersions, 1);
  assert.equal(pendingSignature(before), pendingSignature({ ...before, pending: Object.fromEntries(Object.entries(before.pending).reverse()) }));
  assert.equal(pendingSignature(emptyCollection()), '[]');
});
test('round-trip backups preserve records missing from current catalog and stable catalog additions', () => {
  let c = setVersion(emptyCollection(), { id: 'future-version', albumId: 'future-album' }, { quantity: 2, wanted: true });
  c.pending['future-album'] = { quantity: 1 };
  assert.deepEqual(parseBackup(exportBackup(c)), c);
  assert.deepEqual(validateRelations(c, catalog), c);
  assert.equal(collectionStats(c, catalog).ownedVersions, 0);
  const expanded = { ...catalog, albums: [...catalog.albums, { id: 'future-album', groupId: 'twice' }], versions: [...catalog.versions, { id: 'future-version', albumId: 'future-album' }] };
  assert.equal(collectionStats(c, expanded, 'twice').ownedVersions, 1);
});
test('reject malformed JSON, schema, unsafe IDs, wrong types, unsupported fields and relations', () => {
  const invalid = [ 'bad json', 'null', '[]', '{"schemaVersion":2,"versions":{},"pending":{}}', '{"schemaVersion":1,"versions":{"__proto__":{"albumId":"test","quantity":1,"wanted":true}},"pending":{}}' ];
  for (const value of invalid) assert.throws(() => parseBackup(value));
  for (const entry of [{ quantity: -1, wanted: false }, { quantity: 1.5, wanted: false }, { quantity: 1, wanted: 'yes' }, { quantity: 1, wanted: false, extra: 1 }]) {
    assert.throws(() => parseBackup(JSON.stringify({ schemaVersion: 1, versions: { v: { albumId: 'a', ...entry } }, pending: {} })));
  }
  assert.throws(() => parseBackup(JSON.stringify({ schemaVersion: 1, versions: { v: { quantity: 1, wanted: true } }, pending: {} })));
  assert.throws(() => parseBackup(' '.repeat(2 * 1024 * 1024 + 1)));
  const bad = setVersion(emptyCollection(), { id: ready.id, albumId: 'wrong-album' }, { quantity: 1 });
  assert.throws(() => validateRelations(bad, catalog));
  assert.throws(() => mergeCollections(setVersion(emptyCollection(), ready, { quantity: 1 }), bad));
});
test('filters combine year/region/type/search; pending-only albums never enter owned or wanted', () => {
  const c = setVersion(emptyCollection(), ready, { wanted: true });
  c.pending['twice-bdz'] = { quantity: 2 };
  assert.deepEqual(filterAlbums(catalog, c, { year: '2022' }).map(a => a.id), ['twice-between-1-and-2', 'twice-celebrate', 'twice-hashtag-twice4']);
  assert.equal(filterAlbums(catalog, c, { year: '2022', region: 'JP', type: 'studio' })[0].id, 'twice-celebrate');
  assert.equal(filterAlbums(catalog, c, { search: '  ＲＥＡＤＹ  ' })[0].id, ready.albumId);
  assert.deepEqual(filterAlbums(catalog, c, { list: 'owned' }).map(a => a.id), []);
  assert.deepEqual(filterAlbums(catalog, c, { list: 'wanted' }).map(a => a.id), [ready.albumId]);
});
test('local storage round-trip, corrupted values are preserved, failed writes propagate', () => {
  const map = new Map();
  const storage = { getItem: k => map.get(k) ?? null, setItem: (k, v) => map.set(k, v) };
  assert.deepEqual(loadCollection(storage), emptyCollection());
  const c = setVersion(emptyCollection(), ready, { quantity: 2 });
  saveCollection(storage, c);
  assert.deepEqual(loadCollection(storage), c);
  map.set(STORAGE_KEY, '{bad');
  assert.throws(() => loadCollection(storage));
  assert.equal(map.get(STORAGE_KEY), '{bad');
  assert.throws(() => saveCollection({ setItem() { throw new Error('quota exceeded'); } }, c), /quota/);
});

test('legacy v1 storage is read without writes; export and replace preserve all archival records', () => {
  const legacy = { schemaVersion: 1, versions: { [ready.id]: { albumId: ready.albumId, quantity: 7, wanted: true }, 'unknown-version': { albumId: 'unknown-album', quantity: 3, wanted: false } }, pending: { 'twice-twicetagram': { quantity: 4 }, 'unknown-album': { quantity: 2 } } };
  const raw = JSON.stringify(legacy, null, 2);
  const storage = { getItem(key) { assert.equal(key, STORAGE_KEY); return raw; }, setItem() { assert.fail('loading must never write'); } };
  assert.deepEqual(loadCollection(storage), legacy);
  assert.deepEqual(parseBackup(exportBackup(loadCollection(storage))), legacy);
  assert.deepEqual(parseBackup(JSON.stringify(legacy)), legacy);
  assert.deepEqual(mergeCollections(emptyCollection(), legacy), legacy);
  assert.deepEqual(albumStats(legacy, 'twice-twicetagram', catalog.versions), { ownedVersions: 0, wantedVersions: 0 });
  assert.equal(catalog.versions.some(v => v.albumId === 'twice-twicetagram'), false);
});
