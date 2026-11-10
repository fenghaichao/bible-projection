// test/versions.test.js — 译本注册表与本地安装目录
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
process.env.BIBLE_DATA_DIR = DATA_DIR;

const versions = require(path.join(ROOT, 'src', 'main', 'versions.js'));

test('内置和合本（简/繁）在清单里且可用', () => {
  const list = versions.listVersions();
  const ids = list.map((v) => v.id);
  assert.ok(ids.includes('simplified'), '应包含 simplified');
  assert.ok(ids.includes('traditional'), '应包含 traditional');
  const simplified = list.find((v) => v.id === 'simplified');
  assert.equal(simplified.bundled, true);
  assert.equal(simplified.installed, true);
  assert.ok(simplified.name.includes('和合本'));
});

test('resolveVersionFile 能定位内置文件，未知译本返回 null', () => {
  const file = versions.resolveVersionFile('simplified');
  assert.ok(file && fs.existsSync(file));
  assert.equal(path.basename(file), 'bible-simplified.json');
  assert.equal(versions.resolveVersionFile('not-a-version'), null);
});

test('cleanText 去掉标题标签、换行标签与行内注释', () => {
  const raw = '<h2>上帝的创造</h2>起初，上帝创造天地。([1.1]本节或译「起初，上帝创造天地的时候，」)<br/>';
  const out = versions.cleanText(raw);
  assert.ok(!out.includes('<'), '不应残留标签');
  assert.ok(!out.includes('[1.1]'), '不应残留行内注释');
  assert.ok(out.startsWith('起初，上帝创造天地。'));
});

test('导入本地译本文件后出现在清单中并可读取', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bible-vers-'));
  process.env.BIBLE_VERSIONS_DIR = tmp;
  try {
    const file = path.join(tmp, 'mytest.json');
    fs.writeFileSync(file, JSON.stringify([[1, 1, 1, '起初'], [1, 1, 2, '地是']]), 'utf8');
    const res = versions.importVersionFile(file);
    assert.equal(res.ok, true);
    assert.equal(res.verses, 2);
    assert.equal(res.id, 'mytest');

    const list = versions.listVersions();
    const added = list.find((v) => v.id === 'mytest');
    assert.ok(added, '清单里应出现导入的译本');
    assert.equal(added.installed, true);
    assert.equal(added.bundled, false);
    assert.ok(versions.resolveVersionFile('mytest'));
  } finally {
    delete process.env.BIBLE_VERSIONS_DIR;
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('未安装的译本读取时抛出明确错误', () => {
  const bible = require(path.join(ROOT, 'src', 'main', 'bible.js'));
  assert.throws(() => bible.loadVersion('not-a-version'), /未安装/);
});

test('四个版权译本不进仓库（bundled=false），改由应用内下载 / 本地导入', () => {
  const list = versions.listVersions();
  const ids = list.map((v) => v.id);
  assert.ok(!ids.includes('tcv95'), '现代中文译本 1995 应已从清单移除');
  for (const id of ['rcuv', 'csb', 'tcv2019', 'ncv']) {
    const v = list.find((x) => x.id === id);
    assert.ok(v, `${id} 应在清单里`);
    assert.equal(v.bundled, false, `${id} 不应内置（版权译本不进仓库）`);
    assert.equal(v.offlineDownload, false, `${id} 不应允许自动下载（需授权确认）`);
    assert.ok(v.fhlVersion, `${id} 应保留 FHL 版本号以便下载`);
    assert.ok(v.copyright, `${id} 应带版权声明`);
  }
  // 仓库里不应残留这些受版权保护的译本数据文件
  const DATA = path.join(ROOT, 'data', 'versions');
  for (const id of ['rcuv', 'csb', 'tcv2019', 'ncv']) {
    assert.equal(fs.existsSync(path.join(DATA, `${id}.json`)), false, `仓库不应包含 ${id}.json`);
  }
});

test('吕振中译本属公有领域，随程序内置（bundled=true）', () => {
  const list = versions.listVersions();
  const lcc = list.find((v) => v.id === 'lcc');
  assert.ok(lcc, 'lcc 应在清单里');
  assert.equal(lcc.bundled, true, '吕振中应内置');
  assert.equal(lcc.installed, true);
  assert.equal(lcc.file, 'lcc.json');
  assert.equal(lcc.offlineDownload, true, 'FHL 对吕振中开放离线下载授权');
  const file = versions.resolveVersionFile('lcc');
  assert.ok(file && fs.existsSync(file), '应能定位内置的 lcc.json');
  assert.equal(path.basename(file), 'lcc.json');
  // 正文抽样：创 1:1 应为吕振中译文
  const bible = require(path.join(ROOT, 'src', 'main', 'bible.js'));
  const rows = bible.getChapter(1, 1, 'lcc');
  assert.ok(rows.length > 0, '应能读出吕振中创世记第 1 章');
  assert.ok(rows[0].text.includes('上帝创造天地'), `吕振中首节异常: ${rows[0].text}`);
});

test('切换译本后读到的是该译本的经文（简 / 繁）', () => {
  const bible = require(path.join(ROOT, 'src', 'main', 'bible.js'));
  const simp = bible.getChapter(1, 1, 'simplified');
  const trad = bible.getChapter(1, 1, 'traditional');
  assert.ok(simp.length > 0 && trad.length > 0);
  assert.equal(simp.length, trad.length, '简繁节数应一致');
  assert.notEqual(simp[0].text, trad[0].text, '简繁文本应不同');
  assert.ok(simp[0].text.includes('神创造天地'), `简体首节异常: ${simp[0].text}`);
  assert.ok(trad[0].text.includes('神創造天地'), `繁体首节异常: ${trad[0].text}`);
});

test('查找按当前译本返回对应文本', () => {
  const bible = require(path.join(ROOT, 'src', 'main', 'bible.js'));
  const simp = bible.search({ keywords: ['起初'], mode: 'any' }, 'simplified');
  const trad = bible.search({ keywords: ['起初'], mode: 'any' }, 'traditional');
  assert.ok(simp.length > 0, '简体应命中');
  assert.ok(trad.length > 0, '繁体应命中');
  assert.ok(simp[0].text.includes('起初神创造天地'), `简体命中文本异常: ${simp[0].text}`);
  assert.ok(trad[0].text.includes('起初神創造天地'), `繁体命中文本异常: ${trad[0].text}`);
});

test('cleanText 去掉现代中文译本的译注与汉字之间的空格', () => {
  const raw = '愿主耶稣赐恩典给你们大家( 「你们大家」有些古卷作「上帝的子民」；)！起初， 神创造天地。';
  const out = versions.cleanText(raw);
  assert.ok(!out.includes('「'), '译注应被去掉');
  assert.ok(!out.includes(' '), '汉字之间的空格应被去掉');
  assert.equal(out, '愿主耶稣赐恩典给你们大家！起初，神创造天地。');
});
