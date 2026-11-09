// js/stage.js — 经文显示区：渲染、定位、翻节、复制与收藏

import { $, bus, clamp, el, throttle } from './util.js';
import { ipc } from './bridge.js';
import {
  bookById,
  bookDisplayName,
  bookLabel,
  state,
  verseNumber,
  verseRef,
  verseText,
} from './state.js';
import { T } from './i18n.js';
import { toast } from './toast.js';
import { highlightFragment } from './highlight.js';
import { openPanel } from './panels.js';

let refs = {};
let navigating = false;

export function initStage() {
  refs.stage = $('#stage');
  refs.title = $('#stage-title');
  refs.sub = $('#stage-sub');
  refs.list = $('#verses');
  refs.scroll = $('#stage-scroll');
  refs.foot = $('#stage-foot');

  refs.scroll.addEventListener('wheel', onWheel, { passive: false });
  // 原版遥控习惯：双击显示区=历史面板；三击=清屏（隐藏经文只留背景）
  if (refs.stage) {
    refs.stage.addEventListener('dblclick', () => {
      if (state.projection) return;
      openPanel('history');
    });
    refs.stage.addEventListener('click', (event) => {
      if (event.detail >= 3) toggleHideVerses();
    });
  }
  bus.on('settings', () => renderStage());
  bus.on('navigate', () => renderStage());
  bus.on('keywords', () => renderStage());
}

const onWheel = throttle((event) => {
  if (!state.projection) return;           // 普通模式：保持原生滚动
  if (Math.abs(event.deltaY) < 4) return;
  event.preventDefault();
  moveVerse(event.deltaY > 0 ? 1 : -1);
}, 120);

/** 取某章经文（带缓存）。 */
export async function ensureChapter(bookId, chapter) {
  const key = `${bookId}:${chapter}`;
  if (!state.chapterCache.has(key)) {
    const res = await ipc.getChapter(bookId, chapter);
    state.chapterCache.set(key, Array.isArray(res) ? res : []);
  }
  return state.chapterCache.get(key);
}

/** 当前显示范围（字母速选设定）：{ from, to }，to=0 表示到末节。 */
function activeRange() {
  const range = state.range;
  if (!range) return null;
  const { bookId, chapter } = state.current;
  if (range.bookId !== bookId || Number(range.chapter) !== Number(chapter)) return null;
  return range;
}

/** 跳转到指定经节。 */
export async function goToVerse(bookId, chapter, verse, opts = {}) {
  const book = bookById(bookId);
  if (!book) {
    toast(T.err.noBook, 'error');
    return false;
  }

  const maxChapter = Math.max(1, Number(book.chapters) || 1);
  const ch = clamp(Math.round(Number(chapter) || 1), 1, maxChapter);
  const list = await ensureChapter(bookId, ch);
  const maxVerse = Math.max(1, list.length);
  const v = clamp(Math.round(Number(verse) || 1), 1, maxVerse);

  state.current = { bookId, chapter: ch, verse: v };
  state.range = opts.range || null;

  renderStage();
  if (opts.scroll !== false) scrollToCurrent();
  if (opts.record !== false) recordHistory();
  bus.emit('navigate', { ...state.current, silent: !!opts.silent });
  return true;
}

/** 相对翻节（跨章/跨卷自动处理）。 */
export async function moveVerse(delta) {
  if (navigating || !delta) return;
  navigating = true;
  try {
    const { bookId, chapter, verse } = state.current;
    const book = bookById(bookId);
    if (!book) return;

    const list = await ensureChapter(bookId, chapter);
    let target = verse + delta;
    let bookIdNext = bookId;
    let chapterNext = chapter;

    if (target < 1) {
      if (chapter > 1) {
        chapterNext = chapter - 1;
      } else {
        const idx = state.books.findIndex((b) => b.id === bookId);
        const prev = state.books[idx - 1];
        if (!prev) return;
        bookIdNext = prev.id;
        chapterNext = Math.max(1, Number(prev.chapters) || 1);
      }
      const prevList = await ensureChapter(bookIdNext, chapterNext);
      target = Math.max(1, prevList.length);
    } else if (target > list.length) {
      if (chapter < (Number(book.chapters) || 1)) {
        chapterNext = chapter + 1;
      } else {
        const idx = state.books.findIndex((b) => b.id === bookId);
        const next = state.books[idx + 1];
        if (!next) return;
        bookIdNext = next.id;
        chapterNext = 1;
      }
      target = 1;
    }

    await goToVerse(bookIdNext, chapterNext, target);
  } finally {
    navigating = false;
  }
}

/** 上一卷 / 下一卷。 */
export async function moveBook(delta) {
  const idx = state.books.findIndex((b) => b.id === state.current.bookId);
  const target = state.books[idx + delta];
  if (!target) return;
  await goToVerse(target.id, 1, 1);
}

/** 整章翻页：上一章 / 下一章（超出本卷则跨到相邻卷）。 */
export async function moveChapter(delta) {
  const { bookId, chapter } = state.current;
  const idx = state.books.findIndex((b) => b.id === bookId);
  const book = state.books[idx];
  if (!book) return;

  let targetBook = book;
  let target = chapter + delta;

  if (target < 1) {
    const prev = state.books[idx - 1];
    if (!prev) return;
    targetBook = prev;
    target = Math.max(1, Number(prev.chapters) || 1);
  } else if (target > (Number(book.chapters) || 1)) {
    const next = state.books[idx + 1];
    if (!next) return;
    targetBook = next;
    target = 1;
  }

  await goToVerse(targetBook.id, target, 1);
}

/** 本章首节 / 末节。 */
export async function goChapterEdge(which) {
  const { bookId, chapter } = state.current;
  const list = await ensureChapter(bookId, chapter);
  const verse = which === 'first' ? 1 : Math.max(1, list.length);
  await goToVerse(bookId, chapter, verse);
}

/** 当前显示的经文数组（范围 / 投影窗口 / 整章）。 */
export function displayVerses() {
  const { bookId, chapter, verse } = state.current;
  const list = state.chapterCache.get(`${bookId}:${chapter}`) || [];
  const range = activeRange();

  if (range) {
    const to = range.to > 0 ? range.to : Math.max(1, list.length);
    return list.filter((item) => {
      const n = verseNumber(item);
      return n >= range.from && n <= to;
    });
  }

  const perPage = clamp(state.settings.versesPerPage, 1, 20);
  if (state.projection && list.length) {
    const start = clamp(verse - 1, 0, list.length - 1);
    return list.slice(start, start + perPage);
  }
  return list;
}

export function renderStage() {
  if (!refs.list) return;
  const { bookId, chapter, verse } = state.current;
  const book = bookById(bookId);
  const list = state.chapterCache.get(`${bookId}:${chapter}`) || [];
  const range = activeRange();

  refs.title.textContent = book
    ? `${bookDisplayName(book)} ${T.stage.chapterLabel(chapter)}`
    : T.stage.empty;

  if (!list.length) {
    refs.sub.textContent = '';
    refs.list.textContent = '';
    refs.list.appendChild(el('p', { class: 'empty-note', text: book ? T.err.emptyBook : T.stage.empty }));
    return;
  }

  const visible = displayVerses();
  const perPage = clamp(state.settings.versesPerPage, 1, 20);

  const first = verseNumber(visible[0]);
  const last = verseNumber(visible[visible.length - 1]);
  refs.sub.textContent = perPage > 1
    ? T.stage.pageHint(first, last, list.length, perPage)
    : T.stage.pageInfo(first, last, list.length);

  const frag = document.createDocumentFragment();
  let pageIndex = 1;

  visible.forEach((item, index) => {
    if (perPage > 1 && index > 0 && index % perPage === 0) {
      pageIndex += 1;
      frag.appendChild(el('div', { class: 'page-break' }, [
        el('span', { class: 'page-break-label', text: T.stage.pageLabel(pageIndex) }),
      ]));
    }
    frag.appendChild(verseNode(item, chapter, verse));
  });

  // 普通模式：连续显示下一章，便于向下滚动阅读
  if (!state.projection && !range && visible.length === list.length) {
    const nextChapter = chapter + 1;
    const hasNext = book && nextChapter <= (Number(book.chapters) || 1);
    if (hasNext) {
      const nextList = state.chapterCache.get(`${bookId}:${nextChapter}`);
      if (nextList && nextList.length) {
        frag.appendChild(el('div', { class: 'chapter-divider' }, [
          el('span', { text: `${bookDisplayName(book)} ${T.stage.chapterLabel(nextChapter)}` }),
        ]));
        for (const item of nextList) {
          frag.appendChild(verseNode(item, nextChapter, -1));
        }
      }
    }
  }

  refs.list.textContent = '';
  refs.list.appendChild(frag);
}

function verseNode(item, chapter, currentVerse) {
  const num = verseNumber(item);
  const isCurrent = num === currentVerse;
  const textSpan = el('span', { class: 'verse-text' });
  const keywords = state.searchKeywords;
  if (keywords && keywords.length) {
    textSpan.appendChild(highlightFragment(verseText(item), keywords));
  } else {
    textSpan.textContent = verseText(item);
  }

  const body = [textSpan];
  if (state.settings.showNotes) {
    body.push(el('span', { class: 'verse-ref', text: verseRef(item, chapter) }));
  }

  return el('p', { class: `verse${isCurrent ? ' is-current' : ''}`, dataset: { v: String(num) } }, [
    el('span', { class: 'verse-no', text: String(num) }),
    el('span', { class: 'verse-body' }, body),
  ]);
}

function scrollToCurrent() {
  const node = refs.list && refs.list.querySelector('.verse.is-current');
  if (node && typeof node.scrollIntoView === 'function') {
    node.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
}

/** 记录阅读历史（每次跳转都记，交给后端去重）。 */
const recordHistory = throttle(async () => {
  const { bookId, chapter, verse } = state.current;
  await ipc.addHistory({ bookId, chapter, verse, label: bookLabel(bookId, chapter, verse) });
  bus.emit('history-changed');
}, 260);

/** 当前章纯文本（用于复制）。 */
async function chapterText() {
  const { bookId, chapter } = state.current;
  const cached = state.chapterCache.get(`${bookId}:${chapter}`) || [];
  const last = Math.max(1, cached.length);
  const range = await ipc.getRange(bookId, { chapter, verse: 1 }, { chapter, verse: last });
  const rows = Array.isArray(range) && range.length ? range : cached;
  const head = `${bookDisplayName(bookById(bookId))} ${T.stage.chapterLabel(chapter)}`;
  const body = rows.map((item) => `${verseNumber(item)} ${verseText(item)}`).join('\n');
  return `${head}\n${body}`;
}

/** 复制：优先复制选区，否则复制当前整章。 */
export async function copyCurrent() {
  let selection = '';
  try {
    selection = String(window.getSelection() || '');
  } catch {
    selection = '';
  }
  const useSelection = selection.trim().length > 0;
  const text = useSelection ? selection : await chapterText();
  if (!text) {
    toast(T.toast.copyFailed, 'error');
    return;
  }
  const ok = await ipc.copyText(text);
  if (ok === false || ok === null) {
    toast(T.toast.copyFailed, 'error');
    return;
  }
  toast(useSelection ? T.toast.copiedSelection : T.toast.copied, 'ok');
}

/** 只复制当前节。 */
export async function copyCurrentVerse() {
  const text = currentVerseText();
  if (!text) {
    toast(T.toast.copyFailed, 'error');
    return;
  }
  const ok = await ipc.copyText(text);
  if (ok === false || ok === null) {
    toast(T.toast.copyFailed, 'error');
    return;
  }
  toast(T.toast.copiedVerse, 'ok');
}

/** 当前节正文。 */
export function currentVerseText() {
  const { bookId, chapter, verse } = state.current;
  const list = state.chapterCache.get(`${bookId}:${chapter}`) || [];
  const found = list.find((item) => verseNumber(item) === verse);
  return found ? verseText(found) : '';
}

/** Alt+C：只复制章节标题（原版「复制章节」）。 */
export async function copyTitleOnly() {
  const { bookId, chapter } = state.current;
  const book = bookById(bookId);
  const head = `${bookDisplayName(book)} ${T.stage.chapterLabel(chapter)}`;
  const ok = await ipc.copyText(head);
  if (ok === false || ok === null) {
    toast(T.toast.copyFailed, 'error');
    return;
  }
  toast(T.toast.copiedTitle, 'ok');
}

/**
 * 右击菜单的复制变体：
 *   plain   —— 纯正文连排
 *   numbered—— 带节号连排
 *   lines   —— 每节一行（带节号）
 */
export async function copyTextVariant(mode) {
  const rows = displayVerses();
  if (!rows.length) {
    toast(T.toast.copyFailed, 'error');
    return;
  }
  let text = '';
  if (mode === 'plain') {
    text = rows.map((item) => verseText(item)).join('');
  } else if (mode === 'numbered') {
    text = rows.map((item) => `${verseNumber(item)} ${verseText(item)}`).join(' ');
  } else {
    text = rows.map((item) => `${verseNumber(item)} ${verseText(item)}`).join('\n');
  }
  const ok = await ipc.copyText(text);
  if (ok === false || ok === null) {
    toast(T.toast.copyFailed, 'error');
    return;
  }
  toast(T.toast.copiedVariant(mode), 'ok');
}

/** 右击菜单「不显示经文」：只留背景。 */
export function toggleHideVerses() {
  state.hideVerses = !state.hideVerses;
  document.body.classList.toggle('hide-verses', state.hideVerses);
  return state.hideVerses;
}

/** 收藏当前节。 */
export async function saveCurrent() {
  const { bookId, chapter, verse } = state.current;
  const label = bookLabel(bookId, chapter, verse);
  const res = await ipc.saveVerse({ bookId, chapter, verse, label });
  if (res === null || res === false) {
    toast(T.saved.failed, 'error');
    return;
  }
  toast(T.saved.added, 'ok');
  bus.emit('saved-changed');
}
