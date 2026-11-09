// js/columns.js — 多栏对照（轻量版：主区 + 最多 4 组对照栏，Ctrl+1..4 切换）
//
// 交互约定：
//   · 「+ 对照栏」把当前主区位置复制成一组对照栏，立即出现在主区旁边；
//   · 主区继续翻页时对照栏保持不动，便于左右对照；
//   · Ctrl+1..4 或点击栏号把主区跳到该组（该组序号标红）。

import { $, bus, el } from './util.js';
import { ipc } from './bridge.js';
import { bookById, bookDisplayName, state, verseNumber, verseText } from './state.js';
import { T } from './i18n.js';
import { toast } from './toast.js';
import { renderStage, goToVerse } from './stage.js';

const MAX_COLUMNS = 4;
let refs = {};

export function initColumns() {
  refs.bar = $('#columns-bar');
  refs.host = $('#columns');
  if (!refs.host) return;

  refs.bar.textContent = '';
  refs.bar.appendChild(el('button', {
    class: 'chip-btn',
    type: 'button',
    text: T.columns.add,
    title: T.columns.addHint,
  })).addEventListener('click', addColumn);

  for (let i = 0; i < MAX_COLUMNS; i += 1) {
    const btn = el('button', {
      class: 'chip-btn column-chip',
      type: 'button',
      dataset: { index: String(i + 1) },
      text: String(i + 1),
      title: T.columns.switchTo(i + 1),
    });
    btn.addEventListener('click', () => setActiveColumn(i));
    refs.bar.appendChild(btn);
  }

  bus.on('navigate', renderColumns);
  bus.on('settings', renderColumns);

  renderColumns();
}

/** 新增一组对照栏（复制当前位置），主区位置不变。 */
export function addColumn() {
  if (state.columns.length >= MAX_COLUMNS) {
    toastLimit();
    return;
  }
  state.columns.push({
    bookId: state.current.bookId,
    chapter: state.current.chapter,
    verse: state.current.verse,
  });
  state.activeColumn = state.columns.length - 1;
  renderColumns();
}

/** 切换当前组：主区跳到该组位置。 */
export function setActiveColumn(index) {
  if (index < 0 || index >= state.columns.length) return;
  state.activeColumn = index;
  const column = state.columns[index];
  if (column && column.bookId) {
    goToVerse(column.bookId, column.chapter, column.verse, { record: false });
  }
  renderColumns();
}

/** 数字键 1..4 → 切换组；无对应组时忽略。 */
export function switchColumnByNumber(n) {
  const index = n - 1;
  if (index < 0 || index >= state.columns.length) return false;
  setActiveColumn(index);
  return true;
}

export function columnCount() {
  return state.columns.length;
}

function toastLimit() {
  toast(T.columns.limit, 'error');
}

async function renderColumns() {
  if (!refs.host) return;

  const chips = refs.bar ? refs.bar.querySelectorAll('.column-chip') : [];
  for (const chip of chips) {
    const index = Number(chip.dataset.index) - 1;
    chip.classList.toggle('is-active', index === state.activeColumn && index < state.columns.length);
    chip.disabled = index >= state.columns.length;
  }

  refs.host.textContent = '';
  if (!state.columns.length) {
    refs.host.hidden = true;
    return;
  }
  refs.host.hidden = false;

  for (let i = 0; i < state.columns.length; i += 1) {
    const column = state.columns[i];
    const book = bookById(column.bookId);
    const pane = el('div', { class: `column-pane${i === state.activeColumn ? ' is-active' : ''}` });
    pane.appendChild(el('div', { class: 'column-head' }, [
      el('span', { class: 'column-index', text: String(i + 1) }),
      el('span', {
        class: 'column-title',
        text: book ? `${bookDisplayName(book)} ${T.stage.chapterLabel(column.chapter)}` : T.book.fallback,
      }),
    ]));
    const list = await chapterOf(column.bookId, column.chapter);
    const body = el('div', { class: 'column-body' });
    for (const item of list) {
      body.appendChild(el('div', { class: 'column-verse' }, [
        el('span', { class: 'column-no', text: String(verseNumber(item)) }),
        el('span', { class: 'column-text', text: verseText(item) }),
      ]));
    }
    if (!list.length) body.appendChild(el('p', { class: 'empty-note', text: T.err.emptyBook }));
    pane.appendChild(body);
    refs.host.appendChild(pane);
  }
}

async function chapterOf(bookId, chapter) {
  const key = `${bookId}:${chapter}`;
  if (!state.chapterCache.has(key)) {
    const res = await ipc.getChapter(bookId, chapter);
    state.chapterCache.set(key, Array.isArray(res) ? res : []);
  }
  return state.chapterCache.get(key) || [];
}
