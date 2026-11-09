// js/letterbar.js — 字母/数字速选（照搬原版「字母输入法」）
//
// 语法：<卷缩写><章>[:<节>][—<末节>][Z]
//   CSJ      → 创世记 第 1 章
//   CSJ3     → 创世记 第 3 章
//   CSJ 3    → 同上（空格自动补分隔符）
//   CSJ4Z    → 创世记 第 4 章 整章
//   CSJ4:14Z → 创世记 第 4 章 14 节 至 末节
//   3        → 当前卷 第 3 章

import { $, bus, el, isTypingTarget } from './util.js';
import { state, bookById, bookDisplayName, bookShortName } from './state.js';
import { T } from './i18n.js';
import { toast } from './toast.js';
import { goToVerse } from './stage.js';

const MAX_HINTS = 6;

let buffer = '';
let bar = null;
let bufferEl = null;
let hintEl = null;

export function initLetterbar() {
  bar = $('#letterbar');
  bufferEl = $('#letterbar-buffer');
  hintEl = $('#letterbar-hint');
  if (!bar) return;
  window.addEventListener('keydown', onKeyDown, true);
  bus.on('projection', () => {
    if (state.projection) clearBuffer();
  });
}

/** 供其它模块（如快捷键）查询当前输入缓冲。 */
export function letterBuffer() {
  return buffer;
}

function onKeyDown(event) {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (isTypingTarget(event.target)) return;
  if (state.projection) return;             // 投影模式不启用速选
  if (document.body.classList.contains('drawing')) return;

  const key = event.key;

  if (key === 'Escape') {
    if (!buffer) return;
    clearBuffer();
    event.preventDefault();
    event.stopPropagation();
    return;
  }

  if (key === 'Backspace') {
    if (!buffer) return;
    buffer = buffer.slice(0, -1);
    updateBar();
    event.preventDefault();
    event.stopPropagation();
    return;
  }

  if (key === 'Enter') {
    if (!buffer) return;
    commit();
    event.preventDefault();
    event.stopPropagation();
    return;
  }

  if (key === ' ') {
    if (!buffer) return;                    // 空缓冲时空格仍表示「下一节」
    buffer = autoComplete(buffer);
    updateBar();
    event.preventDefault();
    event.stopPropagation();
    return;
  }

  if (/^[0-9]$/.test(key)) {
    buffer += key;
    updateBar();
    event.preventDefault();
    event.stopPropagation();
    return;
  }

  // 冒号与短横线（CSJ4:14 / CSJ4:14Z 需要直接键入分隔符）
  if (key === ':' || key === '：') {
    buffer += ':';
    updateBar();
    event.preventDefault();
    event.stopPropagation();
    return;
  }

  if (key === '-' || key === '—' || key === '_') {
    buffer += '-';
    updateBar();
    event.preventDefault();
    event.stopPropagation();
    return;
  }

  if (/^[a-zA-Z]$/.test(key)) {
    buffer += key.toUpperCase();
    updateBar();
    event.preventDefault();
    event.stopPropagation();
  }
}

/** 空格自动补分隔符：卷后补 “:”，章后补 “:”，节后补 “—”。 */
function autoComplete(text) {
  const s = text.replace(/\s+/g, '').toUpperCase();
  if (/^[A-Z]+$/.test(s)) return `${text}:`;
  if (/^[A-Z]+\d+$/.test(s)) return `${text}:`;
  if (/^[A-Z]+\d*:\d+$/.test(s)) return `${text}—`;
  return text;
}

/** 解析输入缓冲（容忍冒号/短横线位置差异）。 */
export function parseBuffer(text) {
  const s = String(text || '').replace(/\s+/g, '').toUpperCase();
  const letters = (s.match(/^[A-Z]+/) || [''])[0];
  const rest = s.slice(letters.length);
  const nums = (rest.match(/\d+/g) || []).map((n) => Number(n));
  const zTail = /Z$/.test(rest);
  return {
    letters,
    chapter: nums[0] || 0,
    verse: nums[1] || 0,
    endVerse: nums[2] || 0,
    wholeChapter: zTail && !nums[1],
    toEnd: zTail && !!nums[1],
  };
}

function candidatesFor(letters) {
  if (!letters) {
    const current = bookById(state.current.bookId);
    return current ? [current] : [];
  }
  return state.books.filter((book) => String(book.abbr || '').toUpperCase().startsWith(letters));
}

function updateBar() {
  if (!bar) return;
  if (!buffer) {
    bar.hidden = true;
    return;
  }
  bar.hidden = false;
  const parsed = parseBuffer(buffer);
  const list = candidatesFor(parsed.letters);

  bufferEl.textContent = buffer;

  if (!list.length) {
    hintEl.textContent = parsed.letters ? T.letterbar.empty : T.letterbar.hint;
    return;
  }

  const names = list.slice(0, MAX_HINTS).map((book) => {
    const short = bookShortName(book) || bookDisplayName(book);
    return `${short} ${book.abbr || ''}`.trim();
  });
  const more = list.length > MAX_HINTS ? ` … +${list.length - MAX_HINTS}` : '';
  const book = list[0];
  const chapter = parsed.chapter || 1;
  const target = parsed.chapter
    ? T.letterbar.chapterOf(bookDisplayName(book), chapter)
    : bookDisplayName(book);

  hintEl.textContent = `${target} · ${names.join(' / ')}${more} · ${T.letterbar.hint}`;
}

async function commit() {
  const parsed = parseBuffer(buffer);
  const list = candidatesFor(parsed.letters);

  if (parsed.letters && !list.length) {
    toast(T.letterbar.empty, 'error');
    return;
  }
  if (!parsed.letters && !parsed.chapter) {
    clearBuffer();
    return;
  }

  const book = list[0];
  if (!book) {
    clearBuffer();
    return;
  }
  if (list.length > 1) toast(T.letterbar.multiple(bookDisplayName(book)), 'info');

  const chapter = parsed.chapter || 1;
  const verse = parsed.verse || 1;

  let range = null;
  if (parsed.wholeChapter) {
    range = { bookId: book.id, chapter, from: 1, to: 0 };    // to=0 → 至末节
  } else if (parsed.toEnd) {
    range = { bookId: book.id, chapter, from: verse, to: 0 };
  } else if (parsed.verse) {
    range = { bookId: book.id, chapter, from: verse, to: verse };
  }

  clearBuffer();
  await goToVerse(book.id, chapter, verse, { range });
  focusStage();
}

function clearBuffer() {
  buffer = '';
  if (bar) bar.hidden = true;
  if (bufferEl) bufferEl.textContent = '';
  if (hintEl) hintEl.textContent = '';
}

function focusStage() {
  const stage = $('#stage');
  if (stage && typeof stage.focus === 'function') stage.focus();
}
