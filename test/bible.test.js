'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// 测试用固定数据目录
const FIXTURE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'bible-fixture-'));
fs.writeFileSync(
  path.join(FIXTURE_DIR, 'bible-simplified.json'),
  JSON.stringify([
    [1, 1, 1, '起初神创造天地。'],
    [1, 1, 2, '地是空虚混沌，渊面黑暗；神的灵运行在水面上。'],
    [1, 2, 1, '神说，要有光，就有了光。'],
    [43, 3, 16, '神爱世人，甚至将他的独生子赐给他们。'],
  ]),
  'utf8',
);
fs.writeFileSync(
  path.join(FIXTURE_DIR, 'bible-traditional.json'),
  JSON.stringify([
    [1, 1, 1, '起初神創造天地。'],
    [43, 3, 16, '神愛世人，甚至將他的獨生子賜給他們。'],
  ]),
  'utf8',
);

process.env.BIBLE_DATA_DIR = FIXTURE_DIR;
const bible = require('../src/main/bible.js');

test('getChapter 返回指定卷章的经文并按节号排序', () => {
  const chapter = bible.getChapter(1, 1, 'simplified');
  assert.strictEqual(chapter.length, 2);
  assert.strictEqual(chapter[0].verse, 1);
  assert.strictEqual(chapter[0].text, '起初神创造天地。');
  assert.strictEqual(chapter[1].verse, 2);
});

test('getChapter 跨版本返回繁体文本', () => {
  const chapter = bible.getChapter(1, 1, 'traditional');
  assert.strictEqual(chapter[0].text, '起初神創造天地。');
});

test('getChapter 不存在的章节返回空数组', () => {
  assert.deepStrictEqual(bible.getChapter(1, 99, 'simplified'), []);
});

test('getRange 返回闭区间内的经文（含跨章）', () => {
  const range = bible.getRange(1, { chapter: 1, verse: 2 }, { chapter: 2, verse: 1 }, 'simplified');
  assert.strictEqual(range.length, 2);
  assert.strictEqual(range[0].chapter, 1);
  assert.strictEqual(range[0].verse, 2);
  assert.strictEqual(range[1].chapter, 2);
  assert.strictEqual(range[1].verse, 1);
});

test('getRange 起止颠倒时自动交换', () => {
  const range = bible.getRange(1, { chapter: 2, verse: 1 }, { chapter: 1, verse: 1 }, 'simplified');
  // 交换后区间为 1:1:1 … 1:2:1，共 3 节
  assert.strictEqual(range.length, 3);
  assert.strictEqual(range[0].chapter, 1);
  assert.strictEqual(range[0].verse, 1);
  assert.strictEqual(range[2].chapter, 2);
  assert.strictEqual(range[2].verse, 1);
});

test('search 全部匹配模式要求命中所有关键字', () => {
  const hits = bible.search({ keywords: ['神', '光'], mode: 'all' }, 'simplified');
  assert.strictEqual(hits.length, 1);
  assert.strictEqual(hits[0].chapter, 2);
  assert.strictEqual(hits[0].verse, 1);
});

test('search 任一匹配模式命中即可返回', () => {
  const hits = bible.search({ keywords: ['光', '空虚'], mode: 'any' }, 'simplified');
  assert.strictEqual(hits.length, 2);
  assert.strictEqual(hits[0].verse, 2);
  assert.strictEqual(hits[1].verse, 1);
});

test('search 支持空格分隔的关键字字符串', () => {
  const hits = bible.search({ keywords: '神 爱', mode: 'all' }, 'simplified');
  assert.strictEqual(hits.length, 1);
  assert.strictEqual(hits[0].bookId, 43);
});

test('search 空关键字返回空数组', () => {
  assert.deepStrictEqual(bible.search({ keywords: [], mode: 'all' }, 'simplified'), []);
  assert.deepStrictEqual(bible.search({}, 'simplified'), []);
});

test('search 繁体版本返回繁体书名与繁体分类名', () => {
  const hits = bible.search({ keywords: ['神愛'], mode: 'all' }, 'traditional');
  assert.strictEqual(hits.length, 1);
  assert.strictEqual(hits[0].bookId, 43);
  assert.strictEqual(hits[0].bookName, '約翰福音');
  assert.strictEqual(hits[0].bookNameTraditional, '約翰福音');
  assert.ok(hits[0].categoryName.length > 0);
});

test('search 简体版本返回简体书名', () => {
  const hits = bible.search({ keywords: ['神爱'], mode: 'all' }, 'simplified');
  assert.strictEqual(hits.length, 1);
  assert.strictEqual(hits[0].bookName, '约翰福音');
});

test.after(() => {
  fs.rmSync(FIXTURE_DIR, { recursive: true, force: true });
});
