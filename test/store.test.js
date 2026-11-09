'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { JsonStore } = require('../src/main/store.js');

function tempFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bible-store-'));
  return path.join(dir, 'settings.json');
}

test('不存在文件时返回默认值', () => {
  const store = new JsonStore(tempFile(), { fontSize: 48, theme: 'dark' });
  assert.strictEqual(store.get().fontSize, 48);
  assert.strictEqual(store.get().theme, 'dark');
});

test('set 合并字段并落盘', () => {
  const file = tempFile();
  const store = new JsonStore(file, { fontSize: 48, theme: 'dark' });
  const merged = store.set({ fontSize: 64 });
  assert.strictEqual(merged.fontSize, 64);
  assert.strictEqual(merged.theme, 'dark');

  const reloaded = new JsonStore(file, { fontSize: 48, theme: 'dark' });
  assert.strictEqual(reloaded.get().fontSize, 64);
});

test('损坏的 JSON 文件降级为默认值而不是崩溃', () => {
  const file = tempFile();
  fs.writeFileSync(file, '{ not json', 'utf8');
  const store = new JsonStore(file, { fontSize: 48 });
  assert.strictEqual(store.get().fontSize, 48);
});

test('写入不会留下临时文件', () => {
  const file = tempFile();
  const store = new JsonStore(file, { a: 1 });
  store.set({ a: 2 });
  assert.strictEqual(fs.existsSync(`${file}.tmp`), false);
});
