// js/version.js — 译本（版本）统一入口
//
// state.js 由 lead 维护：currentVersion() / isTraditionalVersion() / clearChapterCache()
// 已就绪，书名、短名、分类名都按 settings.version 判断简繁。
// 这里把「译本」相关的取值集中到一处，渲染层其它模块不再各自判断。

import * as Bible from './state.js';

export const state = Bible.state;

/** 兜底译本：极端情况下（后端未回传 version）不至于空白。 */
let fallbackVersion = 'simplified';

export function setFallbackVersion(id) {
  if (id) fallbackVersion = String(id);
  return fallbackVersion;
}

/** 当前译本 id（与后端 settings.version 一致）。 */
export function currentVersion() {
  if (typeof Bible.currentVersion === 'function') {
    try {
      const v = Bible.currentVersion();
      if (v) return String(v);
    } catch {
      /* 忽略 */
    }
  }
  if (state && state.settings && state.settings.version) return String(state.settings.version);
  return fallbackVersion;
}

/** 该译本是否使用繁体书名。 */
export function isTraditionalVersion() {
  if (typeof Bible.isTraditionalVersion === 'function') {
    try {
      return !!Bible.isTraditionalVersion();
    } catch {
      /* 忽略 */
    }
  }
  return currentVersion() === 'traditional';
}

/** 清空章节缓存（切换译本后必须调用，否则显示上一个译本的经文）。 */
export function clearChapterCache() {
  if (typeof Bible.clearChapterCache === 'function') {
    Bible.clearChapterCache();
    return;
  }
  state.chapterCache.clear();
}

function pick(...names) {
  for (const name of names) {
    if (typeof Bible[name] === 'function') return Bible[name];
  }
  return null;
}

/** 书名（随译本变化）。 */
export function displayName(book) {
  const fn = pick('bookDisplayName', 'bookName');
  if (fn) return fn(book) || '';
  if (!book) return '';
  return book.name || book.short || '';
}

/** 短卷名（复制引用串【创1:10-11】用，随译本变化）。 */
export function shortName(book) {
  const fn = pick('bookShortName', 'bookShort');
  if (fn) return fn(book) || '';
  if (!book) return '';
  return book.short || book.name || '';
}

/** 分类名（随译本变化）。 */
export function categoryName(book) {
  const fn = pick('categoryDisplayName', 'categoryName');
  if (fn) return fn(book) || '';
  if (!book) return '';
  return book.categoryName || book.categoryNameTraditional || '';
}

/** “创世记 1:1” 形式的标签。 */
export function label(bookId, chapter, verse) {
  const fn = pick('bookLabel');
  if (fn) return fn(bookId, chapter, verse);
  const book = typeof Bible.bookById === 'function' ? Bible.bookById(bookId) : null;
  const name = displayName(book) || '经文';
  if (verse === undefined || verse === null) return `${name} ${chapter}`;
  return `${name} ${chapter}:${verse}`;
}
