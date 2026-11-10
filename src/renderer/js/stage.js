// js/stage.js — 经文显示区：渲染、定位、翻节、复制与收藏

import { $, bus, clamp, el, throttle } from './util.js';
import { ipc } from './bridge.js';
import {
  bookById,
  bookDisplayName,
  bookLabel,
  bookShortName,
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
let lastUserScrollAt = 0;     // 用户手动滚动的时刻
let smartScrollUntil = 0;     // 导航后短时间内，重绘完可以补一次智能滚动

export function initStage() {
  refs.stage = $('#stage');
  refs.title = $('#stage-title');
  refs.sub = $('#stage-sub');
  refs.list = $('#verses');
  refs.scroll = $('#stage-scroll');
  refs.foot = $('#stage-foot');

  refs.scroll.addEventListener('wheel', onWheel, { passive: false });
  // 用户自己滚动过显示区（智能滚动就不该再把画面拉回去）
  refs.scroll.addEventListener('wheel', () => { lastUserScrollAt = Date.now(); }, { passive: true });
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
export function activeRange() {
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
  if (opts.scroll !== false) {
    if (opts.scrollMode === 'smart') {
      // 等一帧再量位置：刚重绘完时布局可能还没稳定（字体、异步补章）。
      smartScrollUntil = Date.now() + 1200;
      requestAnimationFrame(() => smartScrollToCurrent());
    } else {
      scrollToCurrent();
    }
  }
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

    // 字母速选设定了一段范围时，翻节按「整块平移」处理，
    // 保持屏幕上显示的节数不变（投影时每一屏的经文长度一致）。
    const range = activeRange();
    if (range) {
      const rangeTo = range.to > 0 ? range.to : Math.max(1, list.length);
      const len = rangeTo - range.from + 1;
      const nextFrom = range.from + delta * len;
      if (nextFrom >= 1 && nextFrom + len - 1 <= list.length) {
        await goToVerse(bookId, chapter, nextFrom, {
          range: { bookId, chapter, from: nextFrom, to: nextFrom + len - 1 },
          scrollMode: 'smart',
        });
        return;
      }
      // 越出本章范围 → 交回普通翻节逻辑（范围取消）
    }

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

    await goToVerse(bookIdNext, chapterNext, target, { scrollMode: 'smart' });
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
  // 普通模式：「每页节数」≥ 2 时按页开窗（Shift+> / Shift+< 可增减），
  // = 1 时保持整章连续显示（原版的「整章」阅读习惯）。
  if (perPage > 1 && list.length) {
    const start = clamp(verse - 1, 0, list.length - 1);
    return list.slice(start, start + perPage);
  }
  return list;
}

/**
 * 增减当前显示的经文节数（原版「方法5」）。
 *  - 已有速选范围（如 CSJ2:1-10）：扩展 / 收缩末节；收到 1 节后再减一次即回到整章显示。
 *  - 没有范围：返回 false，交给快捷键去调「每页节数」。
 */
export async function adjustRange(delta) {
  const range = activeRange();
  if (!range) return false;

  const list = await ensureChapter(range.bookId, range.chapter);
  const last = Math.max(1, list.length);
  const from = Math.max(1, Number(range.from) || 1);
  const to = range.to > 0 ? Math.max(from, Number(range.to) || from) : last;
  const next = Math.min(last, Math.max(from, to + delta));

  if (next === to) {
    if (delta < 0 && to === from) {
      // 只剩 1 节：再减一次 → 取消范围，回到整章显示
      state.range = null;
      renderStage();
      bus.emit('navigate', { ...state.current, silent: true });
      toast(T.toast.spanAll, 'ok', 1600);
      return true;
    }
    toast(T.toast.spanLimit, 'info', 1600);
    return false;
  }

  state.range = { bookId: range.bookId, chapter: range.chapter, from, to: next };
  renderStage();
  scrollToCurrent();
  bus.emit('navigate', { ...state.current, silent: true });
  toast(T.toast.span(next - from + 1), 'ok', 1600);
  return true;
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
    clearStaleSelection();
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

  // 普通模式 + 按页开窗：本页已到本章末节时，接上下一章开头，保持连续阅读
  if (!state.projection && !range && perPage > 1 && visible.length && list.length) {
    const lastShown = verseNumber(visible[visible.length - 1]);
    const overflow = perPage - visible.length;
    const nextChapter = chapter + 1;
    const hasNext = book && nextChapter <= (Number(book.chapters) || 1);
    if (overflow > 0 && lastShown >= list.length && hasNext) {
      const nextList = state.chapterCache.get(`${bookId}:${nextChapter}`);
      if (nextList && nextList.length) {
        for (const item of nextList.slice(0, overflow)) {
          frag.appendChild(verseNode(item, nextChapter, -1));
        }
      } else {
        // 下一章尚未载入：取回后重绘（renderStage 是同步的，这里异步补一次）
        ensureChapter(bookId, nextChapter)
          .then(() => {
            if (state.current.bookId === bookId && state.current.chapter === chapter) renderStage();
          })
          .catch(() => {});
      }
    }
  }

  // 重绘会清空列表容器，必须把滚动位置原样带回去，
  // 否则异步补章 / 其它重绘会把读者已经翻到的地方弹回顶部。
  const keepScroll = refs.scroll ? refs.scroll.scrollTop : 0;
  refs.list.textContent = '';
  refs.list.appendChild(frag);
  if (refs.scroll) refs.scroll.scrollTop = keepScroll;
  clearStaleSelection();

  // 导航后的一小段时间里，如果因为异步补章等原因又重绘了一次，
  // 再补一次智能滚动，把当前节带回舒适区（用户自己滚过就不动）。
  if (Date.now() < smartScrollUntil && Date.now() - lastUserScrollAt > 600) {
    requestAnimationFrame(() => smartScrollToCurrent());
  }
}

/**
 * 清除显示区里残留的旧文本选区。
 * 原版显示区是 PictureBox，没有“选区”概念，Ctrl+C 永远复制当前显示的经文；
 * 这里在每次重绘后清掉旧选区，避免“上一次选中的文字”劫持 Ctrl+C。
 */
function clearStaleSelection() {
  try {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const node = sel.anchorNode;
    if (node && refs.stage && refs.stage.contains(node)) sel.removeAllRanges();
  } catch {
    /* 忽略 */
  }
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

/**
 * 阅读舒适区（占滚动视口高度的比例）。
 * 人的视线通常落在屏幕中部偏上，所以「当前节」只要落在这个区间里就不动屏幕；
 * 偏到下边去了才把内容缓慢往上带一带，避免每翻一节就把上一节顶出画面。
 */
const READ_ZONE = { top: 0.14, bottom: 0.46 };

/** 平滑滚动（缓动），新的一次滚动会打断上一次。 */
let scrollAnim = 0;
function smoothScrollBy(scroller, delta, duration = 420) {
  if (!scroller || Math.abs(delta) < 1) return;
  if (scrollAnim) cancelAnimationFrame(scrollAnim);
  const start = scroller.scrollTop;
  const end = start + delta;
  const t0 = performance.now();
  const step = (now) => {
    const p = Math.min(1, (now - t0) / duration);
    const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;   // easeInOutCubic
    scroller.scrollTop = start + (end - start) * e;
    scrollAnim = p < 1 ? requestAnimationFrame(step) : 0;
  };
  scrollAnim = requestAnimationFrame(step);
}

/**
 * 智能滚动（翻节用）：
 *  - 当前节已经在舒适区 → 屏幕完全不动，上一节仍然留在画面里；
 *  - 当前节偏到下方 → 缓慢向上移动，把它带回舒适区；
 *  - 当前节偏到上方（往上翻） → 缓慢向下移动。
 */
function smartScrollToCurrent() {
  const node = refs.list && refs.list.querySelector('.verse.is-current');
  const scroller = refs.scroll;
  if (!node || !scroller) return;
  const vh = scroller.clientHeight;
  if (!vh) return;
  const rect = node.getBoundingClientRect();
  const box = scroller.getBoundingClientRect();
  const zoneTop = box.top + vh * READ_ZONE.top;
  const zoneBottom = box.top + vh * READ_ZONE.bottom;
  if (rect.top > zoneBottom) {
    // 偏下 → 把内容往上带（scrollTop 增大，元素在视口里的位置随之变高）
    smoothScrollBy(scroller, rect.top - zoneBottom);
  } else if (rect.top < zoneTop) {
    // 偏上 → 把内容往下带
    smoothScrollBy(scroller, -(zoneTop - rect.top));
  }
}

/** 记录阅读历史（每次跳转都记，交给后端去重）。 */
const recordHistory = throttle(async () => {
  const { bookId, chapter, verse } = state.current;
  await ipc.addHistory({ bookId, chapter, verse, label: bookLabel(bookId, chapter, verse) });
  bus.emit('history-changed');
}, 260);

/**
 * 当前显示区标题（原版 F086：「章节」＝显示区标题）。
 */
export function currentTitle() {
  const { bookId, chapter } = state.current;
  const book = bookById(bookId);
  if (!book) return '';
  return `${bookDisplayName(book)} ${T.stage.chapterLabel(chapter)}`;
}

/**
 * 规范化单节文本：去掉数据里残留的换行（Access memo 里常见），
 * 保证「连排」「分节」「分节分行」三种复制格式各自成行。
 */
function normalizeVerse(text) {
  return String(text == null ? '' : text).replace(/\s*\r?\n\s*/g, '');
}

/**
 * 原版式引用串：【创1:10-11】（短卷名 + 章 + 节范围，全角方括号）。
 * 原版复制出来的经文就是这种形式，例如
 *   【创1:10-11】神称旱地为地，称水的聚处为海。神看着是好的。神说：“地要发生青草和结种子的菜蔬，并结果子的树木，各从其类，果子都包着核。”事就这样成了。
 */
export function copyRef(rows) {
  if (!rows || !rows.length) return '';
  const first = rows[0];
  const last = rows[rows.length - 1];
  const book = bookById(first.bookId);
  const short = bookShortName(book) || bookDisplayName(book);
  const c1 = Number(first.chapter) || state.current.chapter;
  const c2 = Number(last.chapter) || c1;
  const v1 = verseNumber(first);
  const v2 = verseNumber(last);
  if (c1 !== c2) return `【${short}${c1}:${v1}-${short}${c2}:${v2}】`;
  if (v1 === v2) return `【${short}${c1}:${v1}】`;
  return `【${short}${c1}:${v1}-${v2}】`;
}

/**
 * 组装复制文本（与原版 5.20 SP2 逐字一致）：
 *   'text'    复制经文          —— 【创1:10-11】+ 正文连排（同一行，不带节号）
 *   'section' 复制经文(分节)    —— 【创1:2-5】+ 各节正文带节号连成一行（2地是…3神说…）
 *   'line'    复制经文(分节分行) —— 【创1:2-5】独占一行 + 每节一行、每行带节号
 * 复制的是**当前显示区**里的经文（受速选范围 / 每页节数影响），不是整章。
 */
function buildCopyText(mode) {
  const rows = displayVerses();
  if (!rows.length) return '';
  const sameChapter = rows.every((item) => (Number(item.chapter) || 0) === (Number(rows[0].chapter) || 0));
  const label = (item) => (sameChapter
    ? String(verseNumber(item))
    : `${Number(item.chapter) || state.current.chapter}:${verseNumber(item)}`);
  if (mode === 'section') {
    return `${copyRef(rows)}${rows.map((item) => `${label(item)}${normalizeVerse(verseText(item))}`).join('')}`;
  }
  if (mode === 'line') {
    return `${copyRef(rows)}\n${rows.map((item) => `${label(item)}${normalizeVerse(verseText(item))}`).join('\n')}`;
  }
  return `${copyRef(rows)}${rows.map((item) => normalizeVerse(verseText(item))).join('')}`;
}

/** 显示区内的文本选区（选区不在显示区时返回空）。 */
function stageSelection() {
  try {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return '';
    const text = String(sel);
    if (!text.trim()) return '';
    const node = sel.anchorNode;
    if (node && refs.stage && !refs.stage.contains(node)) return '';
    return text;
  } catch {
    return '';
  }
}

/**
 * 复制：优先复制显示区选区（用户刚刚手动选中的文字），否则按设置里的
 * 「复制经文格式」复制当前显示区的经文（原版 Ctrl+C＝复制经文）。
 */
export async function copyCurrent() {
  const selection = stageSelection();
  const useSelection = selection.trim().length > 0;
  const format = state.settings.copyFormat || 'text';
  const text = useSelection ? selection : buildCopyText(format);
  if (!text) {
    toast(T.toast.copyFailed, 'error');
    return;
  }
  const ok = await ipc.copyText(text);
  if (ok === false || ok === null) {
    toast(T.toast.copyFailed, 'error');
    return;
  }
  toast(useSelection ? T.toast.copiedSelection : T.toast.copiedFormat(format), 'ok');
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

/** Alt+C：只复制章节引用（原版「复制章节」＝【创1:10-11】这种章节引用串）。 */
export async function copyTitleOnly() {
  const head = copyRef(displayVerses());
  if (!head) {
    toast(T.toast.copyFailed, 'error');
    return;
  }
  const ok = await ipc.copyText(head);
  if (ok === false || ok === null) {
    toast(T.toast.copyFailed, 'error');
    return;
  }
  toast(T.toast.copiedTitle, 'ok');
}

/**
 * 右击菜单「复制 ▸」的三种方式（与原版 F085 逐字同形）：
 *   plain   → 复制经文          ＝【创1:10-11】+ 正文连排（同一行，不带节号）
 *   numbered→ 复制经文(分节)    ＝【创1:2-5】+ 各节正文带节号连成一行（2地是…3神说…）
 *   lines   → 复制经文(分节分行) ＝【创1:2-5】独占一行 + 每节一行、每行带节号
 */
export async function copyTextVariant(mode) {
  const kind = mode === 'numbered' ? 'section' : mode === 'lines' ? 'line' : 'text';
  const text = buildCopyText(kind);
  if (!text) {
    toast(T.toast.copyFailed, 'error');
    return;
  }
  const ok = await ipc.copyText(text);
  if (ok === false || ok === null) {
    toast(T.toast.copyFailed, 'error');
    return;
  }
  toast(T.toast.copiedVariant(kind), 'ok');
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
