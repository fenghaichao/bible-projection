#!/usr/bin/env node
/**
 * 对已下载的译本数据做一次清洗（去掉脚注编号【14】、行内注释、节内换行）。
 *
 * 用法: node tools/clean-versions.js [译本目录]
 * 默认目录: %APPDATA%/BibleProjection/versions
 */
'use strict';

const fs = require('fs');
const path = require('path');

const dir = process.argv[2] || path.join(process.env.APPDATA || process.env.HOME || '.', 'BibleProjection', 'versions');

/** 与 src/main/versions.js 的 cleanText 保持一致 */
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
  t = t.replace(/\(\s*\[[^\]]*\][^()]*\)/g, '');
  t = t.replace(/（\s*\[[^\]]*\][^）]*）/g, '');
  t = t.replace(/\([^()]*「[^()]*\)/g, '');
  t = t.replace(/（[^（）]*「[^（）]*）/g, '');
  t = t.replace(/【[0-9A-Za-z]+】/g, '');
  t = t.replace(/　/g, ' ');
  t = t.replace(/\s+/g, ' ');
  t = t.replace(/(?<=[\u3000-\u303F\u4E00-\u9FFF\uFF00-\uFFEF])[ ]+(?=[\u3000-\u303F\u4E00-\u9FFF\uFF00-\uFFEF])/g, '');
  return t.trim();
}

if (!fs.existsSync(dir)) {
  console.error('目录不存在:', dir);
  process.exit(2);
}

const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json') && !f.endsWith('.meta.json'));
if (!files.length) {
  console.log('目录里没有译本数据:', dir);
  process.exit(0);
}

for (const name of files) {
  const file = path.join(dir, name);
  const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
  let changed = 0;
  let dropped = 0;
  const kept = [];
  for (const row of rows) {
    const before = row[3];
    const after = cleanText(before);
    if (after !== before) {
      row[3] = after;
      changed += 1;
    }
    // 该译本此节没有正文（只有脚注编号）时整节丢弃，避免显示空行
    if (!after) {
      dropped += 1;
      continue;
    }
    kept.push(row);
  }
  fs.writeFileSync(file, JSON.stringify(kept), 'utf8');
  console.log(`${name}: ${rows.length} 行，修正 ${changed} 行，丢弃空节 ${dropped} 行，剩 ${kept.length} 行`);
}
