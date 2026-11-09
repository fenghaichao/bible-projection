// js/stage.js — 经文显示区：渲染、定位、翻节、复制与收藏

import { $, bus, clamp, debounce, el } from './util.js';
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

let refs = {};
let navigating = false;
let lastHistoryKey = '';

export function initStage() {
  refs.stage = $('#stage');
  refs.title = $('#stage-title');
  refs.sub = $('#stage-sub');
  refs.list = $('#verses');
  refs.scroll = $('#stage-scroll');
  refs.foot = $('#stage-foot');

  refs.scroll.addEventListener('wheel', onWheel, { passive: false });
  bus.on('settings', () => renderStage());
  bus.on('navigate', () => renderStage());
}

function onWheel(event) {
  if (!state.projection) return;           // 普通模式：保持原生滚动
  if (Math.abs(event.deltaY) < 4) return;
  event.preventDefault();
  moveVerse(event.deltaY > 0 ? 1 : -1);
}

/** 取某章经文（带缓存）。 */
export async function ensureChapter(bookId, chapter) {
  const key = `${bookId}:${chapter}`;
  if (!state.chapterCache.has(key)) {
    const res = await ipc.getChapter(bookId, chapter);
    state.chapterCache.set(key, Array.isArray(res) ? res : []);
  }
  return state.chapterCache.get(key);
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
  renderStage();
  if (opts.scroll !== false) scrollToCurrent();
  if (opts.record !== false) scheduleHistory();
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

export function renderStage() {
  if (!refs.list) return;
  const { bookId, chapter, verse } = state.current;
  const book = bookById(bookId);
  const list = state.chapterCache.get(`${bookId}:${chapter}`) || [];

  refs.title.textContent = book
    ? `${bookDisplayName(book)} ${T.stage.chapterLabel(chapter)}`
    : T.stage.empty;

  const perPage = clamp(state.settings.versesPerPage, 1, 20);
  let visible = list;
  if (state.projection && list.length) {
    const start = clamp(verse - 1, 0, list.length - 1);
    visible = list.slice(start, start + perPage);
  }

  if (!list.length) {
    refs.sub.textContent = '';
    refs.list.textContent = '';
    refs.list.appendChild(el('p', { class: 'empty-note', text: book ? T.err.emptyBook : T.stage.empty }));
    return;
  }

  const first = verseNumber(visible[0]);
  const last = verseNumber(visible[visible.length - 1]);
  refs.sub.textContent = T.stage.pageInfo(first, last, list.length);

  const frag = document.createDocumentFragment();
  for (const item of visible) {
    const num = verseNumber(item);
    const isCurrent = num === verse;
    const body = [el('span', { class: 'verse-text', text: verseText(item) })];
    if (state.settings.showNotes) {
      body.push(el('span', { class: 'verse-ref', text: verseRef(item, chapter) }));
    }
    frag.appendChild(
      el('p', { class: `verse${isCurrent ? ' is-current' : ''}`, dataset: { v: String(num) } }, [
        el('span', { class: 'verse-no', text: String(num) }),
        el('span', { class: 'verse-body' }, body),
      ])
    );
  }

  refs.list.textContent = '';
  refs.list.appendChild(frag);
}

function scrollToCurrent() {
  const node = refs.list && refs.list.querySelector('.verse.is-current');
  if (node && typeof node.scrollIntoView === 'function') {
    node.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
}

const scheduleHistory = debounce(async () => {
  const { bookId, chapter, verse } = state.current;
  const key = `${bookId}:${chapter}:${verse}`;
  if (key === lastHistoryKey) return;
  lastHistoryKey = key;
  await ipc.addHistory({ bookId, chapter, verse, label: bookLabel(bookId, chapter, verse) });
  bus.emit('history-changed');
}, 900);

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
