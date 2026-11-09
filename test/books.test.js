'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { CATEGORIES, CATEGORIES_TRADITIONAL, BOOKS, getCategoryName } = require('../src/shared/books.js');

test('分类共 8 类，简体与繁体一一对应', () => {
  assert.strictEqual(CATEGORIES.length, 8);
  assert.strictEqual(CATEGORIES_TRADITIONAL.length, 8);
  CATEGORIES.forEach((name, i) => {
    assert.ok(name.length > 0);
    assert.ok(CATEGORIES_TRADITIONAL[i].length > 0);
  });
});

test('getCategoryName 按版本返回分类名', () => {
  assert.strictEqual(getCategoryName(1, false), '摩西五经');
  assert.strictEqual(getCategoryName(1, true), '摩西五經');
  assert.strictEqual(getCategoryName(8, true), '啟示錄');
  assert.strictEqual(getCategoryName(0, false), '');
  assert.strictEqual(getCategoryName(99, true), '');
});

test('66 卷齐全，编号连续', () => {
  assert.strictEqual(BOOKS.length, 66);
  BOOKS.forEach((b, i) => {
    assert.strictEqual(b.id, i + 1);
  });
});

test('每卷都有简体名与繁体名', () => {
  for (const b of BOOKS) {
    assert.ok(b.name && b.name.length > 0, `卷 ${b.id} 缺简体名`);
    assert.ok(b.nameTraditional && b.nameTraditional.length > 0, `卷 ${b.id} 缺繁体名`);
    assert.ok(b.short && b.short.length > 0, `卷 ${b.id} 缺简称`);
    assert.ok(b.shortTraditional && b.shortTraditional.length > 0, `卷 ${b.id} 缺繁体简称`);
    assert.strictEqual(b.categoryNameTraditional, getCategoryName(b.category, true));
    assert.ok(b.chapters > 0);
    assert.ok(b.verses > 0);
  }
});

test('书卷缩写唯一且为大写字母（字母输入法依赖）', () => {
  const seen = new Set();
  for (const b of BOOKS) {
    assert.ok(/^[A-Z]{2,3}$/.test(b.abbr), `卷 ${b.id} 缩写异常: ${b.abbr}`);
    assert.ok(!seen.has(b.abbr), `缩写重复: ${b.abbr}`);
    seen.add(b.abbr);
  }
  assert.strictEqual(seen.size, 66);
});

test('firstVerseId 连续且与节数自洽', () => {
  let expect = 1;
  for (const b of BOOKS) {
    assert.strictEqual(b.firstVerseId, expect, `卷 ${b.id} 的 firstVerseId 不连续`);
    expect += b.verses;
  }
  assert.strictEqual(expect - 1, 31102);
});
