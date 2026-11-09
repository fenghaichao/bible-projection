'use strict';
/*
 * Independent verification of the extracted Bible data.
 *   node tools/verify-data.js
 * Checks: parse, row counts, key-set equality, ordering, text sanity,
 * per-book counts vs src/shared/books.js, and prints 4 spot checks.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const simpPath = path.join(root, 'data', 'bible-simplified.json');
const tradPath = path.join(root, 'data', 'bible-traditional.json');
const booksPath = path.join(root, 'src', 'shared', 'books.js');

const problems = [];
function check(ok, msg) { if (!ok) problems.push(msg); }

function load(p) {
  const buf = fs.readFileSync(p);
  check(!(buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF), p + ' has a UTF-8 BOM (should not)');
  const text = buf.toString('utf8');
  check(!text.endsWith('\n') && !text.endsWith('\r'), p + ' has a trailing newline');
  return { buf, data: JSON.parse(text) };
}

const S = load(simpPath);
const T = load(tradPath);
console.log('rows: simplified=%d traditional=%d', S.data.length, T.data.length);
check(S.data.length === T.data.length, 'row counts differ');

// shape
for (const [name, d] of [['simplified', S.data], ['traditional', T.data]]) {
  for (let i = 0; i < d.length; i++) {
    const r = d[i];
    if (!Array.isArray(r) || r.length !== 4) { problems.push(name + ' row ' + i + ' bad shape'); break; }
    if (!Number.isInteger(r[0]) || !Number.isInteger(r[1]) || !Number.isInteger(r[2]) || typeof r[3] !== 'string') {
      problems.push(name + ' row ' + i + ' bad types: ' + JSON.stringify(r)); break;
    }
  }
}

// ordering + key set
const key = (r) => r[0] + ':' + r[1] + ':' + r[2];
const keyS = new Set(S.data.map(key));
const keyT = new Set(T.data.map(key));
check(keyS.size === S.data.length, 'duplicate keys in simplified');
check(keyT.size === T.data.length, 'duplicate keys in traditional');
let onlyS = 0, onlyT = 0;
for (const k of keyS) if (!keyT.has(k)) onlyS++;
for (const k of keyT) if (!keyS.has(k)) onlyT++;
console.log('keys: |simplified|=%d |traditional|=%d onlyS=%d onlyT=%d', keyS.size, keyT.size, onlyS, onlyT);
check(onlyS === 0 && onlyT === 0, 'key sets differ between the two files');

let ordered = true;
for (let i = 1; i < S.data.length; i++) {
  const a = S.data[i - 1], b = S.data[i];
  if (b[0] < a[0] || (b[0] === a[0] && b[1] < a[1]) || (b[0] === a[0] && b[1] === a[1] && b[2] < a[2])) { ordered = false; break; }
}
check(ordered, 'simplified rows are not sorted by (book, chapter, verse)');

// text sanity
let empty = 0, short = 0, minLen = Infinity, maxLen = 0;
for (const r of S.data) { const L = r[3].trim().length; if (L === 0) empty++; else if (L < 3) short++; if (L < minLen) minLen = L; if (L > maxLen) maxLen = L; }
console.log('simplified text: empty=%d short(<3)=%d minLen=%s maxLen=%d', empty, short, minLen, maxLen);
check(empty === 0 && short === 0, 'empty/short texts in simplified');
for (const r of T.data) { if (r[3].trim().length === 0) { problems.push('empty traditional text'); break; } }

// per-book counts
const perBook = new Map();
for (const r of S.data) {
  if (!perBook.has(r[0])) perBook.set(r[0], { verses: 0, chapters: new Set() });
  const e = perBook.get(r[0]); e.verses++; e.chapters.add(r[1]);
}

const { CATEGORIES, BOOKS } = require(booksPath);
check(BOOKS.length === 66, 'BOOKS.length != 66');
check(CATEGORIES.length === 8, 'CATEGORIES.length != 8');
let metaProblems = 0;
for (const b of BOOKS) {
  const e = perBook.get(b.id);
  if (!e) { console.log('  ! no verses for book id %d', b.id); metaProblems++; continue; }
  if (e.verses !== b.verses) { console.log('  ! book %d %s: verses %d != data %d', b.id, b.name, b.verses, e.verses); metaProblems++; }
  if (e.chapters.size !== b.chapters) { console.log('  ! book %d %s: chapters %d != data %d', b.id, b.name, b.chapters, e.chapters.size); metaProblems++; }
  if (CATEGORIES[b.category - 1] !== b.categoryName) { console.log('  ! book %d categoryName mismatch', b.id); metaProblems++; }
}
console.log('books.js metadata mismatches: %d', metaProblems);

// firstVerseId chain
let chain = 0;
for (let i = 0; i < BOOKS.length; i++) {
  const b = BOOKS[i];
  const e = perBook.get(b.id);
  if (!e) continue;
  if (i === 0) { if (b.firstVerseId !== 1) chain++; }
  else if (BOOKS[i - 1].firstVerseId + BOOKS[i - 1].verses !== b.firstVerseId) chain++;
}
console.log('firstVerseId chain breaks: %d', chain);

// spot checks
const spots = [[1, 1, 1, '创世记 1:1'], [43, 3, 16, '约翰福音 3:16'], [20, 3, 5, '箴言 3:5'], [66, 22, 21, '启示录 22:21']];
console.log('--- spot checks ---');
for (const [b, c, v, label] of spots) {
  const s = S.data.find((r) => r[0] === b && r[1] === c && r[2] === v);
  const t = T.data.find((r) => r[0] === b && r[1] === c && r[2] === v);
  console.log('%s  简: %s', label, s ? s[3] : '<MISSING>');
  console.log('%s  繁: %s', label, t ? t[3] : '<MISSING>');
  if (!s || !t) problems.push('missing spot check ' + label);
}

// 启示录 chapter shape
const rev = S.data.filter((r) => r[0] === 66);
console.log('启示录: %d verses, %d chapters, last verse %d:%d:%d', rev.length, new Set(rev.map((r) => r[1])).size, rev[rev.length - 1][0], rev[rev.length - 1][1], rev[rev.length - 1][2]);

// sha256
for (const p of [simpPath, tradPath, booksPath]) {
  console.log('sha256 %s  %s', crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'), path.relative(root, p));
}

console.log('---');
console.log(problems.length ? 'PROBLEMS:\n  ' + problems.join('\n  ') : 'OK: no problems found');
process.exit(problems.length ? 1 : 0);
