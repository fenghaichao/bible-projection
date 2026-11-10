#!/usr/bin/env node
'use strict';

/**
 * 译本数据校验器
 * ---------------------------------------------------------------------------
 * 校验「译本目录」下每个 <id>.json（以及仓库内置的 data/bible-simplified.json /
 * data/bible-traditional.json）的结构与内容，并与和合本基准比对。
 *
 * 用法:
 *   node tools/verify-versions.js                    # 校验仓库内置数据 + 默认用户译本目录
 *   node tools/verify-versions.js <目录> [...]        # 校验指定目录下的所有译本
 *   node tools/verify-versions.js --repo-only        # 只校验仓库内置数据
 *   node tools/verify-versions.js <目录> --strict    # 节数与和合本不一致也判 FAIL
 *   node tools/verify-versions.js --expect 31102     # 指定基准节数
 *   node tools/verify-versions.js --quiet            # 只打印汇总
 *
 * 退出码: 0 = 全部通过, 1 = 存在 FAIL, 2 = 用法错误
 *
 * 检查项（每个文件）:
 *   1. JSON 可解析，顶层是数组
 *   2. 每行是长度为 4 的数组 [bookId, chapter, verse, text]，类型正确
 *   3. 行序按 (bookId, chapter, verse) 升序
 *   4. (bookId, chapter, verse) 键不重复
 *   5. 每章的节号连续（译本分节差异只告警；整章缺失才判 FAIL）
 *   6. 文本非空
 *   7. 每卷节数与和合本基准一致（不一致记 WARN，--strict 下记 FAIL）
 *   8. 与和合本的键集合差异（多出 / 缺少的节）
 *   9. 抽查创世记 1:1、约翰福音 3:16、箴言 3:5、启示录 22:21
 *  10. 文本残留标记告警：HTML 标签、译注（( [ 3.16] …) / ( 「…」或译…)）、脚注标记 【n】
 *  11. 译本清单 data/versions/manifest.json：可解析、条目字段完整、内置译本的数据文件存在
 *
 * 注意: 译本之间本来就存在节数差异（例如吕振中译本比和合本多「约翰福音 7:53」），
 *       这是译本本身的差异，不是数据损坏，因此默认只告警不判失败。
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(REPO_ROOT, 'data');
const BUNDLED = [
  { id: 'simplified', file: path.join(DATA_DIR, 'bible-simplified.json'), name: '和合本（简体）' },
  { id: 'traditional', file: path.join(DATA_DIR, 'bible-traditional.json'), name: '和合本（繁体）' },
];
const DEFAULT_USER_DIR = path.join(
  process.env.APPDATA || path.join(os.homedir(), '.config'),
  'BibleProjection',
  'versions'
);

/** 和合本每卷节数基准（1..66），来自 data/bible-simplified.json */
const REFERENCE_BOOK_VERSES = [
  1533, 1213, 859, 1288, 959, 658, 618, 85, 810, 695, 816, 719, 942, 822, 280, 406, 167,
  1070, 2461, 915, 222, 117, 1292, 1364, 154, 1273, 357, 197, 73, 146, 21, 48, 105, 47, 56,
  53, 38, 211, 55, 1071, 678, 1151, 878, 1007, 433, 437, 257, 149, 155, 104, 95, 89, 47,
  113, 83, 46, 25, 303, 108, 105, 61, 105, 13, 15, 25, 404,
];

const SPOT_CHECKS = [
  { book: 1, chapter: 1, verse: 1, label: '创世记 1:1' },
  { book: 43, chapter: 3, verse: 16, label: '约翰福音 3:16' },
  { book: 20, chapter: 3, verse: 5, label: '箴言 3:5' },
  { book: 66, chapter: 22, verse: 21, label: '启示录 22:21' },
];

/** 已知的译本差异（用于把「预期的版本差异」和「异常」区分开） */
const KNOWN_VARIANT_NOTES = {
  lcc: '吕振中译本保留「约翰福音 7:53」（和合本据希腊文校勘删去），故比和合本多 1 节',
};

/* ------------------------------------------------------------------ */
/* 工具                                                                */
/* ------------------------------------------------------------------ */

function parseArgs(argv) {
  const opts = {
    dirs: [],
    repoOnly: false,
    strict: false,
    quiet: false,
    expect: 31102,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--help' || a === '-h') opts.help = true;
    else if (a === '--repo-only') opts.repoOnly = true;
    else if (a === '--strict') opts.strict = true;
    else if (a === '--quiet') opts.quiet = true;
    else if (a === '--expect') {
      const v = Number(argv[i + 1]);
      if (!Number.isFinite(v) || v <= 0) throw new Error('--expect 需要一个正整数');
      opts.expect = v;
      i += 1;
    } else if (a.startsWith('--')) throw new Error(`未知选项: ${a}`);
    else opts.dirs.push(path.resolve(a));
  }
  return opts;
}

function keyOf(book, chapter, verse) {
  return `${book}:${chapter}:${verse}`;
}

function loadJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/* ------------------------------------------------------------------ */
/* 校验                                                                */
/* ------------------------------------------------------------------ */

function checkVersionFile(file, opts, label) {
  const id = (label && label.id) || path.basename(file).replace(/\.json$/i, '');
  const result = {
    id,
    file,
    name: (label && label.name) || id,
    status: 'PASS',
    errors: [],
    warnings: [],
    verses: 0,
    books: 0,
    chapters: 0,
    extraKeys: [],
    missingKeys: [],
    bookMismatches: [],
    spot: [],
    textIssues: { html: 0, inlineComment: 0, comment: 0, footnote: 0, newline: 0, whitespace: 0 },
    readError: null,
  };

  let rows;
  try {
    rows = loadJson(file);
  } catch (err) {
    result.readError = err.message;
    result.status = 'FAIL';
    result.errors.push(`JSON 解析失败: ${err.message}`);
    return result;
  }

  // 元信息（可选）
  const metaFile = path.join(path.dirname(file), `${id}.meta.json`);
  if (fs.existsSync(metaFile)) {
    try {
      const meta = loadJson(metaFile);
      if (meta && meta.name) result.name = meta.name;
    } catch (err) {
      result.warnings.push(`元信息读取失败（忽略）: ${err.message}`);
    }
  }

  if (!Array.isArray(rows)) {
    result.status = 'FAIL';
    result.errors.push('顶层不是数组');
    return result;
  }
  result.verses = rows.length;
  if (rows.length === 0) {
    result.status = 'FAIL';
    result.errors.push('没有任何经文');
    return result;
  }

  const seen = new Set();
  const perBook = new Map();
  const perChapter = new Map();
  let lastKey = null;
  let badStructure = 0;
  let emptyText = 0;
  let outOfOrder = 0;
  let duplicate = 0;
  let badBookId = 0;

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (!Array.isArray(row) || row.length !== 4) {
      badStructure += 1;
      continue;
    }
    const book = row[0];
    const chapter = row[1];
    const verse = row[2];
    const text = row[3];
    if (!Number.isInteger(book) || book < 1 || book > 66) badBookId += 1;
    if (!Number.isInteger(chapter) || chapter < 1 || !Number.isInteger(verse) || verse < 1) {
      badStructure += 1;
      continue;
    }
    if (typeof text !== 'string' || text.length === 0) emptyText += 1;

    const key = keyOf(book, chapter, verse);
    if (seen.has(key)) duplicate += 1;
    else seen.add(key);

    if (lastKey !== null) {
      const cmp = book - lastKey[0] || chapter - lastKey[1] || verse - lastKey[2];
      if (cmp < 0) outOfOrder += 1;
    }
    lastKey = [book, chapter, verse];

    perBook.set(book, (perBook.get(book) || 0) + 1);
    const ckey = `${book}:${chapter}`;
    if (!perChapter.has(ckey)) perChapter.set(ckey, []);
    perChapter.get(ckey).push(verse);

    // 文本质量
    if (/<[a-zA-Z/!][^>]*>/.test(text)) result.textIssues.html += 1;
    if (/\([^()]*\[[^\]]*\][^()]*\)|（[^（）]*\[[^\]]*\][^（）]*）/.test(text)) {
      result.textIssues.inlineComment += 1;
    }
    // FHL 的注释有两种形态：带编号的 `([ 3.16] …)` 与不带编号的 `( 「…」或译「…」)`
    if (/[（(]\s*[「『\[]/.test(text)) result.textIssues.comment += 1;
    if (/【[^】]*】/.test(text)) result.textIssues.footnote += 1;
    if (/[\r\n]/.test(text)) result.textIssues.newline += 1;
    if (/[\t　]| {2,}/.test(text)) result.textIssues.whitespace += 1;
  }

  result.books = perBook.size;
  result.chapters = perChapter.size;

  if (badStructure) {
    result.errors.push(`${badStructure} 行不是合法的 [bookId, chapter, verse, text]`);
  }
  if (badBookId) {
    result.errors.push(`${badBookId} 行的 bookId 不是 1..66 的整数`);
  }
  if (emptyText) {
    result.errors.push(`${emptyText} 行文本为空`);
  }
  if (duplicate) {
    result.errors.push(`${duplicate} 个重复的 (卷, 章, 节) 键`);
  }
  if (outOfOrder) {
    result.errors.push(`${outOfOrder} 行未按 (卷, 章, 节) 升序排列`);
  }

  // 章内节号连续性：不同译本的分节（versification）本就可能不同，因此不连续只记 WARN；
  // 整章缺失才说明数据损坏（FAIL）。
  const gaps = [];
  for (const [ckey, verses] of perChapter) {
    verses.sort((a, b) => a - b);
    for (let v = 1; v <= verses.length; v += 1) {
      if (verses[v - 1] !== v) {
        gaps.push(`${ckey}（缺第 ${v} 节）`);
        break;
      }
    }
  }
  if (gaps.length) {
    result.warnings.push(
      `${gaps.length} 章的节号与和合本不同（译本分节差异，非数据损坏）: ${gaps.slice(0, 5).join('、')}` +
        `${gaps.length > 5 ? ' …' : ''}`
    );
  }

  // 整章缺失 = 数据损坏
  if (opts.referenceChapters) {
    const missingChapters = [];
    for (const ckey of opts.referenceChapters) {
      if (!perChapter.has(ckey)) missingChapters.push(ckey);
    }
    if (missingChapters.length) {
      result.errors.push(
        `缺少 ${missingChapters.length} 章: ${missingChapters.slice(0, 8).join('、')}` +
          `${missingChapters.length > 8 ? ' …' : ''}`
      );
    }
  }

  // 与和合本基准比较
  for (let b = 1; b <= 66; b += 1) {
    const got = perBook.get(b) || 0;
    const want = REFERENCE_BOOK_VERSES[b - 1];
    if (got !== want) {
      result.bookMismatches.push({ book: b, got, want, delta: got - want });
    }
  }
  if (result.bookMismatches.length) {
    const total = result.verses - opts.expect;
    const detail = result.bookMismatches
      .map((m) => `第 ${m.book} 卷 ${m.got}（基准 ${m.want}，Δ${m.delta > 0 ? '+' : ''}${m.delta}）`)
      .join('、');
    const msg = `节数与和合本不一致：共 ${result.verses} 节（基准 ${opts.expect}，Δ${
      total > 0 ? '+' : ''
    }${total}）；${detail}`;
    if (opts.strict) result.errors.push(msg);
    else result.warnings.push(msg);
  }

  // 与和合本键集合比较（能读到仓库数据时）
  const referenceKeys = opts.referenceKeys;
  if (referenceKeys) {
    const ownKeys = new Set(seen);
    for (const k of ownKeys) if (!referenceKeys.has(k)) result.extraKeys.push(k);
    for (const k of referenceKeys) if (!ownKeys.has(k)) result.missingKeys.push(k);
    result.extraKeys.sort();
    result.missingKeys.sort();
    if (result.extraKeys.length || result.missingKeys.length) {
      const msg =
        `与和合本键集合有差异：多 ${result.extraKeys.length} 节` +
        (result.extraKeys.length ? `（${result.extraKeys.slice(0, 6).join(', ')}${
          result.extraKeys.length > 6 ? ' …' : ''}）` : '') +
        `，缺 ${result.missingKeys.length} 节` +
        (result.missingKeys.length ? `（${result.missingKeys.slice(0, 6).join(', ')}${
          result.missingKeys.length > 6 ? ' …' : ''}）` : '');
      result.warnings.push(msg);
    }
  }

  // 文本残留标记（告警）
  const ti = result.textIssues;
  if (ti.html) result.warnings.push(`${ti.html} 节文本仍含 HTML 标签`);
  if (ti.comment) {
    result.warnings.push(
      `${ti.comment} 节文本仍含译注（如「( [ 3.16] …)」或「( 「…」或译…)」）`
    );
  }
  if (ti.footnote) result.warnings.push(`${ti.footnote} 节文本仍含脚注标记 【…】`);
  if (ti.newline) result.warnings.push(`${ti.newline} 节文本含换行符`);
  if (ti.whitespace) result.warnings.push(`${ti.whitespace} 节文本含多余空白`);

  // 抽查
  const byKey = new Map();
  for (const row of rows) {
    if (Array.isArray(row) && row.length === 4) byKey.set(keyOf(row[0], row[1], row[2]), row[3]);
  }
  for (const check of SPOT_CHECKS) {
    const k = keyOf(check.book, check.chapter, check.verse);
    const text = byKey.get(k);
    result.spot.push({ label: check.label, key: k, text: text === undefined ? null : text });
    if (text === undefined) {
      result.errors.push(`抽查缺失: ${check.label}`);
    }
  }

  if (result.errors.length) result.status = 'FAIL';
  else if (result.warnings.length) result.status = 'PASS';

  return result;
}

/* ------------------------------------------------------------------ */
/* 输出                                                                */
/* ------------------------------------------------------------------ */

function pad(text, width) {
  const s = String(text);
  let len = 0;
  for (const ch of s) len += ch.charCodeAt(0) > 0x2e80 ? 2 : 1;
  const padLen = width - len;
  return padLen > 0 ? s + ' '.repeat(padLen) : s;
}

function printResult(r, opts) {
  const delta = r.verses - opts.expect;
  const deltaText = delta === 0 ? 'Δ0' : `Δ${delta > 0 ? '+' : ''}${delta}`;
  console.log(
    `  [${r.status}] ${pad(r.id, 12)} ${pad(r.name, 22)} ` +
      `节数 ${String(r.verses).padStart(6)} (基准 ${opts.expect}, ${pad(deltaText, 6)}) ` +
      `卷 ${r.books}  章 ${r.chapters}`
  );
  for (const e of r.errors) console.log(`         ✗ ${e}`);
  if (!opts.quiet) {
    for (const w of r.warnings) console.log(`         ! ${w}`);
  }
  if (!opts.quiet) {
    const note = KNOWN_VARIANT_NOTES[r.id];
    if (note && r.bookMismatches.length) console.log(`         · 已知版本差异：${note}`);
  }
}

function printSpots(results) {
  console.log('');
  console.log('  抽查经文:');
  for (const r of results) {
    if (!r.spot.length) continue;
    console.log(`    ${r.id}:`);
    for (const s of r.spot) {
      const text = s.text === null ? '(缺失)' : s.text;
      console.log(`      ${pad(s.label, 14)} ${text}`);
    }
  }
}

/* ------------------------------------------------------------------ */
/* 译本清单校验                                                        */
/* ------------------------------------------------------------------ */

function checkManifest(manifestFile) {
  const out = { file: manifestFile, status: 'PASS', errors: [], warnings: [], versions: 0 };
  if (!fs.existsSync(manifestFile)) {
    out.status = 'FAIL';
    out.errors.push(`清单不存在: ${manifestFile}`);
    return out;
  }
  let raw;
  try {
    raw = loadJson(manifestFile);
  } catch (err) {
    out.status = 'FAIL';
    out.errors.push(`清单解析失败: ${err.message}`);
    return out;
  }
  if (!raw || !Array.isArray(raw.versions)) {
    out.status = 'FAIL';
    out.errors.push('清单缺少 versions 数组');
    return out;
  }
  const seen = new Set();
  for (const v of raw.versions) {
    out.versions += 1;
    if (!v || typeof v.id !== 'string' || !v.id) {
      out.errors.push('存在缺少 id 的条目');
      continue;
    }
    if (seen.has(v.id)) out.errors.push(`id 重复: ${v.id}`);
    seen.add(v.id);
    if (typeof v.name !== 'string' || !v.name) out.errors.push(`${v.id}: 缺少 name`);
    if (typeof v.bundled !== 'boolean') out.errors.push(`${v.id}: 缺少 bundled 布尔值`);
    if (v.bundled) {
      if (typeof v.file !== 'string' || !v.file) out.errors.push(`${v.id}: 内置译本缺少 file`);
      else {
        const f = path.join(DATA_DIR, v.file);
        if (!fs.existsSync(f)) out.errors.push(`${v.id}: 内置数据文件不存在 ${f}`);
      }
    } else if (!v.fhlVersion) {
      out.warnings.push(`${v.id}: 非内置译本没有 fhlVersion，应用内将无法在线下载`);
    }
  }
  if (out.errors.length) out.status = 'FAIL';
  return out;
}

/* ------------------------------------------------------------------ */
/* main                                                                */
/* ------------------------------------------------------------------ */

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`参数错误: ${err.message}`);
    console.error('用法: node tools/verify-versions.js [目录...] [--repo-only] [--strict] [--expect N] [--quiet]');
    return 2;
  }
  if (opts.help) {
    console.log('用法: node tools/verify-versions.js [目录...] [--repo-only] [--strict] [--expect N] [--quiet]');
    console.log('');
    console.log('不传目录时：校验仓库内置的 data/bible-simplified.json 与 data/bible-traditional.json，');
    console.log('           并校验默认用户译本目录 %APPDATA%\\BibleProjection\\versions（存在才校验）。');
    console.log('传目录时：校验该目录下所有 <id>.json（*.meta.json 跳过），并同时校验仓库内置数据。');
    return 0;
  }

  // 基准键集合与章集合（用于逐节、逐章比对）
  let referenceKeys = null;
  let referenceChapters = null;
  const simplifiedFile = BUNDLED[0].file;
  if (fs.existsSync(simplifiedFile)) {
    try {
      const rows = loadJson(simplifiedFile);
      referenceKeys = new Set(rows.map((r) => keyOf(r[0], r[1], r[2])));
      referenceChapters = new Set(rows.map((r) => `${r[0]}:${r[1]}`));
    } catch (err) {
      console.error(`读取基准数据失败（${simplifiedFile}）: ${err.message}`);
      return 2;
    }
  }
  opts.referenceKeys = referenceKeys;
  opts.referenceChapters = referenceChapters;

  // 待校验目标
  const targets = [];
  if (!opts.repoOnly) {
    for (const b of BUNDLED) {
      if (fs.existsSync(b.file)) targets.push({ file: b.file, id: b.id, name: b.name });
      else console.error(`缺少仓库内置数据: ${b.file}`);
    }
  }
  const dirs = opts.dirs.length ? opts.dirs : [];
  if (!dirs.length && !opts.repoOnly && fs.existsSync(DEFAULT_USER_DIR)) {
    dirs.push(DEFAULT_USER_DIR);
  }
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      console.error(`目录不存在: ${dir}`);
      continue;
    }
    const names = fs
      .readdirSync(dir)
      .filter((n) => n.endsWith('.json') && !n.endsWith('.meta.json') && n !== 'manifest.json')
      .sort();
    for (const n of names) targets.push({ file: path.join(dir, n) });
  }

  if (!targets.length) {
    console.error('没有可校验的数据文件。');
    return 2;
  }

  console.log(`校验译本数据（基准：和合本 ${opts.expect} 节）`);
  for (const dir of dirs) console.log(`译本目录: ${dir}`);
  console.log('');

  const results = targets.map((t) => checkVersionFile(t.file, opts, t));
  for (const r of results) printResult(r, opts);

  printSpots(results);

  // 清单校验
  const manifest = checkManifest(path.join(DATA_DIR, 'versions', 'manifest.json'));
  console.log('');
  console.log(
    `  [${manifest.status}] 译本清单 ${path.relative(REPO_ROOT, manifest.file)} ` +
      `（${manifest.versions} 个译本条目）`
  );
  for (const e of manifest.errors) console.log(`         ✗ ${e}`);
  if (!opts.quiet) for (const w of manifest.warnings) console.log(`         ! ${w}`);

  const failed = results.filter((r) => r.status === 'FAIL');
  const warned = results.filter((r) => r.status !== 'FAIL' && r.warnings.length);
  console.log('');
  console.log(
    `汇总: ${results.length} 个数据文件，FAIL ${failed.length}，含告警 ${warned.length}，` +
      `节数与基准一致 ${results.filter((r) => r.verses === opts.expect).length}`
  );

  return failed.length || manifest.status === 'FAIL' ? 1 : 0;
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = { checkVersionFile, REFERENCE_BOOK_VERSES, SPOT_CHECKS };
