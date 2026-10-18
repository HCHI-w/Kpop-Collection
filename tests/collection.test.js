import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { emptyCollection, setVersion, setPending, transferPending, mergeCollections, albumStats, collectionStats, parseBackup, exportBackup, validateRelations, loadCollection, saveCollection, STORAGE_KEY } from '../js/collection.js';
import { validateCatalog, filterAlbums, relativeAsset } from '../js/catalog.js';
const read = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const catalog = validateCatalog((await read('../data/groups.json')).groups, (await read('../data/twice/albums.json')).albums, (await read('../data/twice/versions.json')).versions);
const [ready, to, be] = catalog.versions.filter(v => v.albumId === 'twice-ready-to-be');
test('catalog: 10 real releases, unique IDs, correct references, relative existing covers', async () => {
  assert.equal(catalog.albums.length, 10);
  assert.equal(ready.name, 'READY ver.');
  assert.equal(to.name, 'TO ver.');
  assert.equal(be.name, 'BE ver.');
  for (const album of catalog.albums) {
    await readFile(new URL('../' + relativeAsset(album.cover), import.meta.url));
    assert.equal(album.coverIsPlaceholder, true);
    assert.equal(album.versionsComplete, false);
  }
  assert.throws(() => relativeAsset('/cover.svg'));
  assert.throws(() => validateCatalog(catalog.groups, [...catalog.albums, catalog.albums[0]], catalog.versions));
});
test('own and want independently; only actual variants count, quantity is physical copies', () => {
  let c = setVersion(emptyCollection(), ready, { quantity: 3, wanted: true });
  assert.deepEqual(albumStats(c, ready.albumId, catalog.versions), { ownedVersions: 1, wantedVersions: 1, confirmedCopies: 3, pendingCopies: 0, copies: 3 });
  assert.deepEqual(collectionStats(c, catalog, 'twice'), { ownedAlbums: 1, ownedVersions: 1, copies: 3, pendingCopies: 0, wantedAlbums: 1, wantedVersions: 1 });
  c = setVersion(c, ready, { quantity: 0 });
  assert.equal(c.versions[ready.id].wanted, true);
  c = setVersion(c, ready, { wanted: false });
  assert.equal(c.versions[ready.id], undefined);
});
test('pending copies count once, transfer preserves copies and wanted without mutating input', () => {
  const start = setPending(setVersion(emptyCollection(), ready, { quantity: 1, wanted: true }), ready.albumId, 3);
  const next = transferPending(start, ready, 2);
  assert.equal(start.pending[ready.albumId].quantity, 3);
  assert.equal(next.pending[ready.albumId].quantity, 1);
  assert.equal(next.versions[ready.id].quantity, 3);
  assert.equal(next.versions[ready.id].wanted, true);
  assert.equal(albumStats(next, ready.albumId, catalog.versions).copies, 4);
  assert.throws(() => transferPending(next, to, 2));
  assert.throws(() => transferPending(next, to, 0));
  assert.throws(() => setPending(next, ready.albumId, 1.2));
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
test('merging an older pending backup after version confirmation cannot resurrect copies', () => {
  const before = setPending(emptyCollection(), ready.albumId, 3);
  const after = transferPending(before, ready, 2);
  const merged = mergeCollections(after, before);
  assert.deepEqual(merged, after);
  assert.equal(albumStats(merged, ready.albumId, catalog.versions).copies, 3);
  assert.deepEqual(mergeCollections(before, after), after);
  const confirmed = setVersion(emptyCollection(), to, { quantity: 3 });
  assert.equal(mergeCollections(before, confirmed).pending[ready.albumId], undefined);
});
test('round-trip backups preserve records missing from current catalog and stable catalog additions', () => {
  let c = setVersion(emptyCollection(), { id: 'future-version', albumId: 'future-album' }, { quantity: 2, wanted: true });
  c = setPending(c, 'future-album', 1);
  assert.deepEqual(parseBackup(exportBackup(c)), c);
  assert.deepEqual(validateRelations(c, catalog), c);
  assert.equal(collectionStats(c, catalog).copies, 0);
  const expanded = { ...catalog, albums: [...catalog.albums, { id: 'future-album', groupId: 'twice' }], versions: [...catalog.versions, { id: 'future-version', albumId: 'future-album' }] };
  assert.equal(collectionStats(c, expanded, 'twice').copies, 3);
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
test('filters combine year/region/type/search and include pending in owned only', () => {
  const c = setPending(setVersion(emptyCollection(), ready, { wanted: true }), 'twice-bdz', 2);
  assert.equal(filterAlbums(catalog, c, { year: '2022' }).length, 2);
  assert.equal(filterAlbums(catalog, c, { year: '2022', region: 'JP', type: 'studio' })[0].id, 'twice-celebrate');
  assert.equal(filterAlbums(catalog, c, { search: '  ＲＥＡＤＹ  ' })[0].id, ready.albumId);
  assert.deepEqual(filterAlbums(catalog, c, { list: 'owned' }).map(a => a.id), ['twice-bdz']);
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
