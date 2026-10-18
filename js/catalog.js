export const TYPE_LABELS = { mini: '迷你專輯', studio: '正規專輯', single: '單曲', repackage: '改版專輯', special: '特別專輯', compilation: '精選專輯' };
export const REGION_LABELS = { KR: '韓國發行', JP: '日本發行' };
export const EDITION_LABELS = { standard: '普通版', limited: '限定版', member: '成員版', special: '特殊包裝版' };
export const DEFAULT_COVER = './assets/covers/placeholder.svg';
export const DEFAULT_COVER_ALT = '專輯封面佔位圖片';
const ID = /^[a-z0-9][a-z0-9-]{0,119}$/;
const isObject = value => value && typeof value === 'object' && !Array.isArray(value);
const assert = (condition, message) => { if (!condition) throw new Error(message); };
export function relativeAsset(path) {
  assert(typeof path === 'string' && path.startsWith('./') && !path.includes('..') && !/[\\?#:]/.test(path), '目錄資源必須使用安全的相對路徑。');
  return path;
}
export function validateCatalog(groups, albums, versions) {
  const allIds = new Set();
  for (const item of [...groups, ...albums, ...versions]) {
    assert(isObject(item) && ID.test(item.id) && !allIds.has(item.id), '目錄 ID 不合法或重複。');
    allIds.add(item.id);
    assert(typeof item.name === 'string' && item.name.length > 0, '目錄缺少名稱。');
  }
  const groupIds = new Set(groups.map(g => g.id));
  const albumIds = new Set(albums.map(a => a.id));
  for (const album of albums) {
    assert(groupIds.has(album.groupId), '專輯沒有對應團體。');
    assert(TYPE_LABELS[album.type] && REGION_LABELS[album.region], '專輯類型或地區不合法。');
    assert(/^\d{4}-\d{2}-\d{2}$/.test(album.releaseDate) && new Date(album.releaseDate).toISOString().slice(0, 10) === album.releaseDate, '專輯日期不合法。');
    relativeAsset(album.cover);
    if (album.versionsComplete !== undefined) assert(typeof album.versionsComplete === 'boolean', '版本完整標記必須是布林值。');
    if (album.versionsComplete) {
      const editions = versions.filter(v => v.albumId === album.id);
      assert(editions.length > 0 && editions.every(v => v.verificationStatus === 'verified'), '尚未核實全部版本，不可標記完整。');
    }
  }
  const albumsById = new Map(albums.map(album => [album.id, album]));
  const normalizedVersions = versions.map(version => {
    assert(albumIds.has(version.albumId), '版本沒有對應專輯。');
    assert(typeof version.format === 'string' && version.format.trim().length > 0, '版本缺少實體媒介。');
    if (version.editionType !== undefined) assert(Object.hasOwn(EDITION_LABELS, version.editionType), '版本商品類型不合法。');
    if (version.verificationStatus !== undefined) assert(['verified', 'pending'].includes(version.verificationStatus), '版本核實狀態不合法。');
    if (version.verificationStatus === 'verified') assert(version.source && version.editionType, '已核實版本必須記錄官方來源與商品類型。');
    if (version.verificationStatus === 'pending') assert(typeof version.verificationNote === 'string' && version.verificationNote.trim().length > 0, '待核實版本必須說明原因。');
    if (version.member !== undefined) assert(version.editionType === 'member' && typeof version.member === 'string' && version.member.trim().length > 0, '成員版本資料不合法。');
    if (version.source !== undefined) assert(typeof version.source === 'string' && /^https:\/\/[^\s]+$/.test(version.source), '版本來源必須是 HTTPS 網址。');
    if (version.catalogNumber !== undefined) assert(typeof version.catalogNumber === 'string' && version.catalogNumber.trim().length > 0, '版本品番不合法。');
    if (version.cover !== undefined) assert(typeof version.cover === 'string', '版本封面路徑必須是文字。');
    if (version.coverAlt !== undefined) assert(typeof version.coverAlt === 'string', '版本封面替代文字必須是文字。');
    if (version.coverIsPlaceholder !== undefined) assert(typeof version.coverIsPlaceholder === 'boolean', '版本封面佔位標記必須是布林值。');
    const album = albumsById.get(version.albumId);
    const cover = version.cover?.trim();
    // Resolve display metadata without mutating the source catalog or collection.
    return {
      ...version,
      cover: cover ? relativeAsset(cover) : album.cover,
      coverAlt: cover ? (version.coverAlt?.trim() || `${album.name} ${version.name} 封面`) : album.coverAlt,
      coverIsPlaceholder: cover ? (version.coverIsPlaceholder ?? false) : Boolean(album.coverIsPlaceholder)
    };
  });
  return { groups, albums, versions: normalizedVersions };
}
async function readJSON(path) {
  const response = await fetch(new URL(relativeAsset(path), document.baseURI));
  if (!response.ok) throw new Error(`目錄載入失敗（${response.status}）`);
  const data = await response.json();
  if (data.schemaVersion !== 1) throw new Error('不支援的目錄版本。');
  return data;
}
export async function loadCatalog() {
  const { groups } = await readJSON('./data/groups.json');
  if (!Array.isArray(groups) || !groups.length) throw new Error('團體目錄無效。');
  const results = await Promise.all(groups.map(async group => {
    const [a, v] = await Promise.all([readJSON(group.albumsPath), readJSON(group.versionsPath)]);
    if (!Array.isArray(a.albums) || !Array.isArray(v.versions)) throw new Error('專輯或版本目錄無效。');
    return { albums: a.albums, versions: v.versions };
  }));
  return validateCatalog(groups, results.flatMap(r => r.albums), results.flatMap(r => r.versions));
}
export function filterAlbums(catalog, collection, filters) {
  const search = (filters.search || '').normalize('NFKC').toLocaleLowerCase().trim();
  return catalog.albums.filter(album => {
    if (filters.groupId && album.groupId !== filters.groupId) return false;
    if (search && !album.name.normalize('NFKC').toLocaleLowerCase().includes(search)) return false;
    if (filters.year && !album.releaseDate.startsWith(filters.year)) return false;
    if (filters.region && album.region !== filters.region) return false;
    if (filters.type && album.type !== filters.type) return false;
    const entries = catalog.versions.filter(v => v.albumId === album.id).map(v => collection.versions[v.id]);
    if (filters.list === 'owned') return entries.some(e => e?.quantity > 0);
    if (filters.list === 'wanted') return entries.some(e => e?.wanted);
    return true;
  }).sort((a, b) => b.releaseDate.localeCompare(a.releaseDate) || a.id.localeCompare(b.id));
}
