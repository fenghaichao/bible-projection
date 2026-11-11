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
  // 当前译本 id：simplified=和合本(简) / traditional=和合本(繁)，其余为用户安装的译本
  version: 'simplified',
  // 旧字段：仅用于兼容旧设置，UI 不再暴露（繁简请切换译本）
  traditional: false,
  theme: 'dark',
  // 主进程 DEFAULT_SETTINGS 新增字段（main.js）
  textShadow: false,
  shadowColor: '#000000',
  shadowBlur: 10,
  shadowOffset: 2,
  bgmPath: '',
  bgmVolume: 50,
  slideshowInterval: 0,
  floatPanel: false,
  // 标题与节号样式、四边留白（main.js DEFAULT_SETTINGS 同步新增）
  titleFontFamily: '',
  titleColor: '',
  verseNumberColor: '',
  // 当前节高亮颜色：空字符串＝跟随主题强调色（var(--gold)）
  currentVerseColor: '',
  padding: 0,
  // 渲染层扩展项：后端 JsonStore.set 用 Object.assign 合并，额外键同样会被持久化
  bgmLoop: true,
  mouseAdvance: true,
  // 复制经文格式：text=连排 / section=分节（段间空行）/ line=分节分行（带节号）
  copyFormat: 'text',
};

function num(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function str(value, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function hex(value, fallback) {
  const s = str(value, fallback).trim();
  return /^#[0-9a-fA-F]{3,8}$/.test(s) ? s : fallback;
}

/** 把后端返回的设置归一化，容忍缺字段/脏数据。 */
export function mergeSettings(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  const fontFamily = typeof s.fontFamily === 'string' && s.fontFamily.trim()
    ? s.fontFamily.trim()
    : DEFAULT_SETTINGS.fontFamily;

  return {
    fontFamily,
    fontSize: Math.round(num(s.fontSize, DEFAULT_SETTINGS.fontSize, 12, 160)),
    lineHeight: num(s.lineHeight, DEFAULT_SETTINGS.lineHeight, 1, 4),
    textColor: hex(s.textColor, DEFAULT_SETTINGS.textColor),
    bgColor: hex(s.bgColor, DEFAULT_SETTINGS.bgColor),
    bgImage: str(s.bgImage, ''),
    italic: !!s.italic,
    underline: !!s.underline,
    showNotes: !!s.showNotes,
    versesPerPage: Math.round(num(s.versesPerPage, DEFAULT_SETTINGS.versesPerPage, 1, 20)),
    // 译本 id：新设置用 version；旧设置只有 traditional 布尔量时据此折算
    version: typeof s.version === 'string' && s.version.trim()
      ? s.version.trim()
      : (s.traditional ? 'traditional' : DEFAULT_SETTINGS.version),
    traditional: !!s.traditional,
    theme: s.theme === 'light' ? 'light' : 'dark',
    textShadow: !!s.textShadow,
    shadowColor: hex(s.shadowColor, DEFAULT_SETTINGS.shadowColor),
    shadowBlur: Math.round(num(s.shadowBlur, DEFAULT_SETTINGS.shadowBlur, 0, 60)),
    shadowOffset: Math.round(num(s.shadowOffset, DEFAULT_SETTINGS.shadowOffset, 0, 40)),
    bgmPath: str(s.bgmPath, ''),
    bgmVolume: Math.round(num(s.bgmVolume, DEFAULT_SETTINGS.bgmVolume, 0, 100)),
    slideshowInterval: Math.round(num(s.slideshowInterval, DEFAULT_SETTINGS.slideshowInterval, 0, 3600)),
    floatPanel: !!s.floatPanel,
    titleFontFamily: str(s.titleFontFamily, DEFAULT_SETTINGS.titleFontFamily),
    titleColor: hex(s.titleColor, DEFAULT_SETTINGS.titleColor),
    verseNumberColor: hex(s.verseNumberColor, DEFAULT_SETTINGS.verseNumberColor),
    currentVerseColor: hex(s.currentVerseColor, DEFAULT_SETTINGS.currentVerseColor),
    padding: Math.round(num(s.padding, DEFAULT_SETTINGS.padding, 0, 120)),
    bgmLoop: s.bgmLoop === undefined ? DEFAULT_SETTINGS.bgmLoop : !!s.bgmLoop,
    mouseAdvance: s.mouseAdvance === undefined ? DEFAULT_SETTINGS.mouseAdvance : !!s.mouseAdvance,
    copyFormat: ['text', 'section', 'line'].includes(s.copyFormat) ? s.copyFormat : DEFAULT_SETTINGS.copyFormat,
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
  /** 当前查找关键字（正文高亮用） */
  searchKeywords: [],
  /** 右击菜单「不显示经文」：只留背景 */
  hideVerses: false,
  /** 字母速选设定的显示范围：{ bookId, chapter, from, to }，to=0 表示到末节 */
  range: null,
  /** 显示窗口锚点：鼠标点选某节时用来固定当前这一页，避免点一下就换页 */
  anchor: null,
  /**
   * 多版本对比（非左右分栏）：每一节下面逐个译本列出正文。
   * 结构 { versions: string[], names: { id: 译本名 }, texts: { id: { 章: { 节: 正文 } } } }
   */
  compare: null,
  /** 「多版本比对」面板里勾选待对比的译本 id 列表 */
  compareSelection: [],
  /** 主显示区里被「删除本节」移除的节：key = `${bookId}:${chapter}:${verse}` */
  removedVerses: new Set(),
  /** 从浮动面板「追加到主面板」的节：[{ bookId, chapter, verse }] */
  appendedVerses: [],
};

export function setBooks(books) {
  const list = Array.isArray(books) ? books : [];
  state.books = list.filter((b) => b && b.id !== undefined && b.id !== null);
  state.bookMap = new Map(state.books.map((b) => [b.id, b]));
}

export function bookById(id) {
  return state.bookMap.get(id) || null;
}

/** 当前译本 id（与后端 settings.version 一致）。 */
export function currentVersion() {
  return state.settings.version || DEFAULT_SETTINGS.version;
}

/** 该译本是否使用繁体书名（目前只有和合本繁体）。 */
export function isTraditionalVersion() {
  return currentVersion() === 'traditional';
}

/** 切换译本后清空章节缓存，避免显示上一个译本的经文。 */
export function clearChapterCache() {
  state.chapterCache.clear();
}

export function bookDisplayName(book) {
  if (!book) return '';
  if (isTraditionalVersion()) {
    return book.nameTraditional || book.name || book.shortTraditional || book.short || '';
  }
  return book.name || book.short || '';
}

export function bookShortName(book) {
  if (!book) return '';
  if (isTraditionalVersion()) {
    return book.shortTraditional || book.short || book.nameTraditional || book.name || '';
  }
  return book.short || book.name || '';
}

/** 分类名（繁体译本取 categoryNameTraditional）。 */
export function categoryDisplayName(book) {
  if (!book) return '';
  if (isTraditionalVersion()) {
    return book.categoryNameTraditional || book.categoryName || '';
  }
  return book.categoryName || book.categoryNameTraditional || '';
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
