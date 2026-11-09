'use strict';

/**
 * 经文数据访问层
 * - 简体 / 繁体两份 JSON，各自按需加载并常驻内存
 * - 章、节范围、关键字查找
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.BIBLE_DATA_DIR || path.join(__dirname, '..', '..', 'data');
const FILES = {
  simplified: 'bible-simplified.json',
  traditional: 'bible-traditional.json',
};

let booksMeta = { BOOKS: [], CATEGORIES: [] };
try {
  // books.js 由 tools/extract-mdb.ps1 生成；未生成时降级为空列表，不影响其它功能
  booksMeta = require('../shared/books.js');
} catch (err) {
  console.warn('[bible] 未找到 src/shared/books.js，书卷列表为空:', err.message);
}

const cache = {
  simplified: null,
  traditional: null,
};

/** 读取指定版本经文，返回 Map<"book:chapter:verse", text> */
function loadVersion(version) {
  if (cache[version]) return cache[version];
  const file = path.join(DATA_DIR, FILES[version]);
  if (!fs.existsSync(file)) {
    throw new Error(`缺少数据文件: ${file}`);
  }
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const map = new Map();
  for (const row of raw) {
    map.set(`${row[0]}:${row[1]}:${row[2]}`, row[3]);
  }
  cache[version] = map;
  return map;
}

function getBooks() {
  return booksMeta.BOOKS;
}

function getBook(bookId) {
  return booksMeta.BOOKS.find((b) => b.id === bookId) || null;
}

/** 整章经文 */
function getChapter(bookId, chapter, version = 'simplified') {
  const map = loadVersion(version);
  const out = [];
  const prefix = `${bookId}:${chapter}:`;
  for (const [key, text] of map) {
    if (key.startsWith(prefix)) {
      out.push({ bookId: Number(bookId), chapter: Number(chapter), verse: Number(key.slice(prefix.length)), text });
    }
  }
  out.sort((a, b) => a.verse - b.verse);
  return out;
}

/** 从 from 到 to 的连续经文（跨章亦可），闭区间 */
function getRange(bookId, from, to, version = 'simplified') {
  const map = loadVersion(version);
  const out = [];
  const startKey = `${bookId}:${from.chapter}:${from.verse}`;
  const endKey = `${bookId}:${to.chapter}:${to.verse}`;
  const start = compareKey(startKey, endKey) <= 0 ? startKey : endKey;
  const end = compareKey(startKey, endKey) <= 0 ? endKey : startKey;
  for (const [key, text] of map) {
    if (compareKey(key, start) >= 0 && compareKey(key, end) <= 0) {
      const [b, c, v] = key.split(':');
      out.push({ bookId: Number(b), chapter: Number(c), verse: Number(v), text });
    }
  }
  out.sort((a, b) => a.chapter - b.chapter || a.verse - b.verse);
  return out;
}

function compareKey(a, b) {
  const pa = a.split(':').map(Number);
  const pb = b.split(':').map(Number);
  for (let i = 0; i < 3; i += 1) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

/**
 * 多关键字查找
 * @param {string[]} keywords 关键字数组
 * @param {'all'|'any'} mode all=全部命中, any=命中任一
 * @param {number} limit 最多返回条数
 * @param {string} version simplified | traditional
 */
function search({ keywords = [], mode = 'all', limit = 500 } = {}, version = 'simplified') {
  const terms = (Array.isArray(keywords) ? keywords : String(keywords).split(/[\s,，、]+/))
    .map((k) => String(k || '').trim())
    .filter(Boolean);
  if (!terms.length) return [];

  const map = loadVersion(version);
  const hits = [];
  for (const [key, text] of map) {
    if (!text) continue;
    const matched = terms.filter((t) => text.includes(t)).length;
    if (mode === 'any' ? matched > 0 : matched === terms.length) {
      const [b, c, v] = key.split(':');
      const book = getBook(Number(b)) || {};
      hits.push({
        bookId: Number(b),
        chapter: Number(c),
        verse: Number(v),
        text,
        bookName: (version === 'traditional' ? book.nameTraditional : book.name) || `第${b}卷`,
        bookNameTraditional: book.nameTraditional || book.name || `第${b}卷`,
        categoryName: (version === 'traditional' ? book.categoryNameTraditional : book.categoryName) || '',
      });
      if (hits.length >= limit) break;
    }
  }
  return hits;
}

module.exports = { getBooks, getBook, getChapter, getRange, search, loadVersion };
