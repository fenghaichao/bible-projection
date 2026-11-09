'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const RENDERER = path.join(ROOT, 'src', 'renderer');

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

test('渲染层 ES module 全部通过语法检查', () => {
  const files = walk(RENDERER);
  assert.ok(files.length > 0, '未找到渲染层 js 文件');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bible-esm-'));
  const failures = [];
  try {
    for (const file of files) {
      // .js 在本项目里是 CommonJS，渲染层用的是浏览器 ES module，
      // 因此复制成 .mjs 再交给 node --check 校验语法
      const copy = path.join(tmp, `${path.basename(file, '.js')}.mjs`);
      fs.copyFileSync(file, copy);
      const res = spawnSync(process.execPath, ['--check', copy], { encoding: 'utf8' });
      if (res.status !== 0) {
        failures.push(`${path.relative(ROOT, file)}\n${res.stderr}`);
      }
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  assert.deepStrictEqual(failures, [], `以下文件语法检查未通过:\n${failures.join('\n')}`);
});

test('主进程与预加载脚本可被 Node 解析', () => {
  const files = [
    path.join(ROOT, 'src', 'main', 'main.js'),
    path.join(ROOT, 'src', 'main', 'bible.js'),
    path.join(ROOT, 'src', 'main', 'store.js'),
    path.join(ROOT, 'src', 'preload', 'preload.js'),
    path.join(ROOT, 'src', 'shared', 'books.js'),
  ];
  for (const file of files) {
    const res = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    assert.strictEqual(res.status, 0, `${path.relative(ROOT, file)} 语法错误:\n${res.stderr}`);
  }
});
