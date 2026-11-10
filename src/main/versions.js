'use strict';

/**
 * 译本注册表
 *
 * - 仓库内置（data/versions/manifest.json）：和合本（简体 / 繁体），公有领域，可随仓库分发
 * - 用户安装（%APPDATA%/BibleProjection/versions/<id>.json）：受版权保护的其他译本，
 *   由应用内「获取译本」从信望愛 FHL API 下载，或从本地 JSON 文件导入；不进 Git 仓库
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.BIBLE_DATA_DIR || path.join(__dirname, '..', '..', 'data');
const MANIFEST_FILE = path.join(DATA_DIR, 'versions', 'manifest.json');
const FHL_API = 'https://bible.fhl.net/api/qb.php';
const BOOK_COUNT = 66;
const MAX_CHAPTER = 200;

const DEFAULT_MANIFEST = {
  versions: [
    {
      id: 'simplified',
      name: '和合本（简体）',
      bundled: true,
      file: 'bible-simplified.json',
      copyright: '公有领域（1919 年中文和合本）',
      source: '原版《语音投影圣经》Access 数据库 bibleNosound.dat',
      lang: 'zh-Hans',
    },
    {
      id: 'traditional',
      name: '和合本（繁体）',
      bundled: true,
      file: 'bible-traditional.json',
      copyright: '公有领域（1919 年中文和合本）',
      source: '原版《语音投影圣经》Access 数据库 bibleNosound.dat',
      lang: 'zh-Hant',
    },
  ],
};

/* ------------------------------------------------------------------ */
/* 基础工具                                                            */
/* ------------------------------------------------------------------ */

function electron() {
  try {
    // eslint-disable-next-line global-require
    return require('electron');
  } catch (err) {
    return null;
  }
}

function userDataDir() {
  const el = electron();
  if (el && el.app && typeof el.app.getPath === 'function') {
    try {
      return el.app.getPath('userData');
    } catch (err) {
      /* 忽略：测试环境下不可用 */
    }
  }
  return path.join(DATA_DIR, '..', '.userdata');
}

function installedDir() {
  // BIBLE_VERSIONS_DIR 供测试与便携使用
  return process.env.BIBLE_VERSIONS_DIR || path.join(userDataDir(), 'versions');
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data), 'utf8');
  fs.renameSync(tmp, file);
}

/* ------------------------------------------------------------------ */
/* 译本清单                                                            */
/* ------------------------------------------------------------------ */

let manifestCache = null;

function loadManifest() {
  if (manifestCache) return manifestCache;
  try {
    const raw = readJson(MANIFEST_FILE);
    if (raw && Array.isArray(raw.versions) && raw.versions.length) {
      manifestCache = raw;
      return manifestCache;
    }
  } catch (err) {
    console.warn('[versions] 未找到译本清单，回退到内置清单:', err.message);
  }
  manifestCache = DEFAULT_MANIFEST;
  return manifestCache;
}

function manifestEntry(id) {
  return loadManifest().versions.find((v) => v.id === id) || null;
}

function installedFile(id) {
  return path.join(installedDir(), `${id}.json`);
}

/** 译本数据文件路径：内置优先，其次用户安装目录 */
function resolveVersionFile(id) {
  const entry = manifestEntry(id);
  if (entry && entry.bundled && entry.file) {
    const file = path.join(DATA_DIR, entry.file);
    if (fs.existsSync(file)) return file;
  }
  const local = installedFile(id);
  if (fs.existsSync(local)) return local;
  return null;
}

/** 是否已安装（可读取） */
function isInstalled(id) {
  return resolveVersionFile(id) !== null;
}

/** 译本清单：合并内置清单与本地已安装状态 */
function listVersions() {
  const out = loadManifest().versions.map((v) => ({
    id: v.id,
    name: v.name,
    bundled: !!v.bundled,
    installed: isInstalled(v.id),
    copyright: v.copyright || '',
    source: v.source || '',
    lang: v.lang || '',
    fhlVersion: v.fhlVersion || '',
  }));
  // 本地存在但清单里没有的译本（例如手工导入的）
  const known = new Set(out.map((v) => v.id));
  try {
    for (const name of fs.readdirSync(installedDir())) {
      if (!name.endsWith('.json') || name.endsWith('.meta.json')) continue;
      const id = name.slice(0, -5);
      if (known.has(id)) continue;
      let meta = {};
      try {
        meta = readJson(path.join(installedDir(), `${id}.meta.json`));
      } catch (err) {
        meta = {};
      }
      out.push({
        id,
        name: meta.name || id,
        bundled: false,
        installed: true,
        copyright: meta.copyright || '',
        source: meta.source || '本地导入',
        lang: '',
        fhlVersion: '',
      });
    }
  } catch (err) {
    /* 目录不存在即没有本地译本 */
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 文本清洗（与 tools/fetch-versions.py 规则一致）                      */
/* ------------------------------------------------------------------ */

function cleanText(raw) {
  if (!raw) return '';
  let t = String(raw);
  t = t.replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi, '');
  t = t.replace(/<\s*br\s*\/?\s*>/gi, ' ');
  t = t.replace(/<[^>]+>/g, '');
  t = t
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
  // 行内注释：( [1.1] ...) / （[1.1]...）
  t = t.replace(/\(\s*\[[^\]]*\][^()]*\)/g, '');
  t = t.replace(/（\s*\[[^\]]*\][^）]*）/g, '');
  // 现代中文译本的译注：( 「X」或译「Y」…)
  t = t.replace(/\([^()]*「[^()]*\)/g, '');
  t = t.replace(/（[^（）]*「[^（）]*）/g, '');
  // 脚注编号：【14】
  t = t.replace(/【[0-9A-Za-z]+】/g, '');
  t = t.replace(/　/g, ' ');
  // 同一节内的换行（含诗歌排版换行）统一压成空格，保证每节一行
  t = t.replace(/\s+/g, ' ');
  // 汉字之间的空格去掉（中文排版不需要），英文单词之间的空格保留
  t = t.replace(/(?<=[\u3000-\u303F\u4E00-\u9FFF\uFF00-\uFFEF])[ ]+(?=[\u3000-\u303F\u4E00-\u9FFF\uFF00-\uFFEF])/g, '');
  return t.trim();
}

/* ------------------------------------------------------------------ */
/* 从 FHL 下载译本                                                      */
/* ------------------------------------------------------------------ */

async function fetchChapter(fhlVersion, bid, chap) {
  const url = `${FHL_API}?bid=${bid}&chap=${chap}&version=${fhlVersion}&gb=1`;
  let lastErr = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'BibleProjection/0.1 (local import)' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = await res.json();
      if (payload.status !== 'success') return [];
      return payload.record || [];
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
    }
  }
  throw lastErr || new Error('请求失败');
}

async function fetchBook(fhlVersion, bid) {
  const rows = [];
  for (let chap = 1; chap <= MAX_CHAPTER; chap += 1) {
    const records = await fetchChapter(fhlVersion, bid, chap);
    if (!records.length) break;
    for (const rec of records) {
      const text = cleanText(rec.bible_text || '');
      if (text) rows.push([bid, chap, Number(rec.sec), text]);
    }
  }
  return rows;
}

async function mapPool(items, size, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = new Array(Math.min(size, items.length)).fill(0).map(async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

/**
 * 下载并安装一个译本到用户数据目录
 * @param {string} id 译本 id
 * @param {{onProgress?: Function}} options
 */
async function installVersion(id, options = {}) {
  const entry = manifestEntry(id);
  if (!entry) return { ok: false, error: `未知译本: ${id}` };
  if (!entry.fhlVersion) return { ok: false, error: '该译本不支持在线下载，请从本地文件导入' };
  if (entry.bundled) return { ok: true, verses: null, error: '该译本已内置' };

  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : () => {};
  const rows = [];
  const books = [];
  for (let bid = 1; bid <= BOOK_COUNT; bid += 1) books.push(bid);

  const perBook = await mapPool(books, 4, async (bid) => {
    const bookRows = await fetchBook(entry.fhlVersion, bid);
    onProgress({ id, done: books.indexOf(bid) + 1, total: BOOK_COUNT, percent: 0 });
    return bookRows;
  });
  for (const r of perBook) rows.push(...r);

  rows.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
  if (!rows.length) return { ok: false, error: '未取得任何经文' };

  const file = installedFile(id);
  writeJson(file, rows);
  writeJson(path.join(installedDir(), `${id}.meta.json`), {
    id,
    name: entry.name,
    fhlVersion: entry.fhlVersion,
    verses: rows.length,
    copyright: entry.copyright || '',
    source: entry.source || '',
    installedAt: new Date().toISOString(),
  });
  onProgress({ id, done: BOOK_COUNT, total: BOOK_COUNT, percent: 100 });
  return { ok: true, id, name: entry.name, verses: rows.length };
}

/**
 * 从本地 JSON 文件导入译本（格式：[bookId, chapter, verse, text]）
 */
function importVersionFile(filePath) {
  const raw = readJson(filePath);
  if (!Array.isArray(raw) || !raw.length) {
    return { ok: false, error: '文件格式不正确，应为 [bookId, chapter, verse, text] 数组' };
  }
  const rows = [];
  for (const row of raw) {
    if (!Array.isArray(row) || row.length < 4) continue;
    const bookId = Number(row[0]);
    const chapter = Number(row[1]);
    const verse = Number(row[2]);
    const text = String(row[3] || '');
    if (!Number.isFinite(bookId) || !Number.isFinite(chapter) || !Number.isFinite(verse) || !text) continue;
    rows.push([bookId, chapter, verse, text]);
  }
  if (!rows.length) return { ok: false, error: '文件里没有有效的经文记录' };

  const base = path.basename(filePath).replace(/\.json$/i, '');
  const id = base.replace(/[^\w.-]/g, '_');
  rows.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
  writeJson(installedFile(id), rows);
  writeJson(path.join(installedDir(), `${id}.meta.json`), {
    id,
    name: base,
    verses: rows.length,
    copyright: '由用户本地导入，版权归该译本权利人',
    source: filePath,
    installedAt: new Date().toISOString(),
  });
  return { ok: true, id, name: base, verses: rows.length };
}

module.exports = {
  DATA_DIR,
  MANIFEST_FILE,
  loadManifest,
  manifestEntry,
  listVersions,
  resolveVersionFile,
  isInstalled,
  installedDir,
  installedFile,
  cleanText,
  installVersion,
  importVersionFile,
};
