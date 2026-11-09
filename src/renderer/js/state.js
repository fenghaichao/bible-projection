// js/state.js — 全局状态、设置归一化与数据取值辅助

import { clamp } from './util.js';
import { T } from './i18n.js';

export const DEFAULT_SETTINGS = {
  fontFamily: '微软雅黑',
  fontSize: 48,
  lineHeight: 1.8,
  textColor: '#f5f5f5',
  bgColor: '#101014',
  bgImage: '',
  italic: false,
  underline: false,
  showNotes: false,
  versesPerPage: 1,
  traditional: false,
  theme: 'dark',
};

/** 把后端返回的设置归一化，容忍缺字段/脏数据。 */
export function mergeSettings(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  const fontFamily = typeof s.fontFamily === 'string' && s.fontFamily.trim()
    ? s.fontFamily.trim()
    : DEFAULT_SETTINGS.fontFamily;

  const fontSize = Number(s.fontSize);
  const lineHeight = Number(s.lineHeight);
  const versesPerPage = Number(s.versesPerPage);

  return {
    fontFamily,
    fontSize: Number.isFinite(fontSize) ? Math.round(clamp(fontSize, 12, 160)) : DEFAULT_SETTINGS.fontSize,
    lineHeight: Number.isFinite(lineHeight) ? clamp(lineHeight, 1, 4) : DEFAULT_SETTINGS.lineHeight,
    textColor: typeof s.textColor === 'string' && s.textColor ? s.textColor : DEFAULT_SETTINGS.textColor,
    bgColor: typeof s.bgColor === 'string' && s.bgColor ? s.bgColor : DEFAULT_SETTINGS.bgColor,
    bgImage: typeof s.bgImage === 'string' ? s.bgImage : '',
    italic: !!s.italic,
    underline: !!s.underline,
    showNotes: !!s.showNotes,
    versesPerPage: Number.isFinite(versesPerPage)
      ? Math.round(clamp(versesPerPage, 1, 20))
      : DEFAULT_SETTINGS.versesPerPage,
    traditional: !!s.traditional,
    theme: s.theme === 'light' ? 'light' : 'dark',
  };
}

export const state = {
  books: [],
  bookMap: new Map(),
  settings: { ...DEFAULT_SETTINGS },
  current: { bookId: null, chapter: 1, verse: 1 },
  projection: false,
  /** 章节缓存：key = `${bookId}:${chapter}` → [{ bookId, chapter, verse, text }] */
  chapterCache: new Map(),
};

export function setBooks(books) {
  const list = Array.isArray(books) ? books : [];
  state.books = list.filter((b) => b && b.id !== undefined && b.id !== null);
  state.bookMap = new Map(state.books.map((b) => [b.id, b]));
}

export function bookById(id) {
  return state.bookMap.get(id) || null;
}

export function bookDisplayName(book) {
  if (!book) return '';
  if (state.settings.traditional) {
    return book.nameTraditional || book.name || book.shortTraditional || book.short || '';
  }
  return book.name || book.short || '';
}

export function bookShortName(book) {
  if (!book) return '';
  if (state.settings.traditional) {
    return book.shortTraditional || book.short || book.nameTraditional || book.name || '';
  }
  return book.short || book.name || '';
}

/** “创世记 1:1” 形式的标签。 */
export function bookLabel(bookId, chapter, verse) {
  const book = bookById(bookId);
  const name = bookDisplayName(book) || T.book.fallback;
  if (verse === undefined || verse === null) return `${name} ${chapter}`;
  return `${name} ${chapter}:${verse}`;
}

/** 节号：契约字段为 verse，兼容旧字段 v。 */
export function verseNumber(verse) {
  if (!verse || typeof verse !== 'object') return 0;
  const n = Number(verse.verse !== undefined ? verse.verse : verse.v);
  return Number.isFinite(n) ? n : 0;
}

/** 经文正文：简繁由后端按 settings.traditional 决定，这里只取 text。 */
export function verseText(verse) {
  if (!verse || typeof verse !== 'object') return '';
  if (typeof verse.text === 'string') return verse.text;
  return '';
}

/** 某节的出处标注（支持跨章 range）。 */
export function verseRef(verse, fallbackChapter) {
  const n = verseNumber(verse);
  const ch = Number(verse && verse.chapter) || fallbackChapter;
  return `${bookLabel(verse && verse.bookId !== undefined ? verse.bookId : state.current.bookId, ch, n)}`;
}
