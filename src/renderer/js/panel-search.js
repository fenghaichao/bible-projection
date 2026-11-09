// js/panel-search.js — 查找面板（多关键字 / 全部或任一匹配 / 高亮 / 分页）

import { $, bus, el } from './util.js';
import { ipc } from './bridge.js';
import { bookDisplayName, bookById, state } from './state.js';
import { T } from './i18n.js';
import { closePanel } from './panels.js';
import { goToVerse, renderStage } from './stage.js';
import { highlightFragment } from './highlight.js';

const PAGE_SIZE = 40;
const BACKEND_LIMIT = 500;

let refs = {};
let running = false;
let allRows = [];
let shownCount = 0;
let currentKeywords = [];

export function initSearch() {
  refs.input = $('#search-input');
  refs.run = $('#search-run');
  refs.status = $('#search-status');
  refs.results = $('#search-results');
  if (!refs.input) return;

  refs.run.addEventListener('click', () => run());
  refs.input.addEventListener('input', () => {
    // 编辑关键字时同步舞台高亮
    state.searchKeywords = parseKeywords(refs.input.value);
    renderStage();
  });
  refs.input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      run();
    }
  });
  for (const radio of document.querySelectorAll('input[name="search-mode"]')) {
    radio.addEventListener('change', () => run());
  }

  refs.status.textContent = T.search.idle;
  bus.on('panel-open', (name) => {
    if (name !== 'search') return;
    // 关闭抽屉后关键字保留在查找框里
    if (!refs.input.value.trim() && state.searchKeywords.length) {
      refs.input.value = state.searchKeywords.join(' ');
    }
    refs.input.focus();
    refs.input.select();
  });
}

function parseKeywords(raw) {
  return String(raw || '')
    .split(/[\s,，;；、]+/)
    .map((k) => k.trim())
    .filter(Boolean);
}

/** 供浮动面板等外部入口调用：以给定关键字执行一次查找。 */
export function runSearchWith(keywords) {
  const text = Array.isArray(keywords) ? keywords.join(' ') : String(keywords || '');
  if (!text.trim()) return false;
  if (refs.input) refs.input.value = text;
  run();
  return true;
}

async function run() {
  if (running) return;
  const keywords = parseKeywords(refs.input.value);
  if (!keywords.length) {
    state.searchKeywords = [];
    refs.status.textContent = T.search.needKeywords;
    refs.results.textContent = '';
    renderStage();
    return;
  }
  state.searchKeywords = keywords.slice();
  currentKeywords = keywords;

  const checked = document.querySelector('input[name="search-mode"]:checked');
  const mode = checked ? checked.value : 'all';

  running = true;
  refs.status.textContent = T.search.running;
  const rows = await ipc.search({ keywords, mode });
  running = false;

  allRows = Array.isArray(rows) ? rows : [];
  shownCount = Math.min(PAGE_SIZE, allRows.length);
  renderResults();
  renderStage();                                   // 正文高亮命中的关键字
}

function renderResults() {
  refs.results.textContent = '';
  if (!allRows.length) {
    refs.status.textContent = T.search.empty;
    return;
  }

  const total = allRows.length;
  const capped = total >= BACKEND_LIMIT;
  const slice = allRows.slice(0, shownCount);
  for (const row of slice) refs.results.appendChild(resultItem(row));

  refs.status.textContent = T.search.shown(total, slice.length) + (capped ? ` · ${T.search.capped(BACKEND_LIMIT)}` : '');

  if (shownCount < total) {
    const more = el('button', { class: 'btn btn-ghost btn-block more-btn', type: 'button', text: T.search.more });
    more.addEventListener('click', () => {
      shownCount = Math.min(total, shownCount + PAGE_SIZE);
      renderResults();
    });
    refs.results.appendChild(more);
    const hint = el('div', { class: 'result-hint', text: T.search.moreHint(shownCount, total) });
    refs.results.appendChild(hint);
  }
}

function resultItem(row) {
  const book = bookById(row.bookId);
  const name = row.bookName || (book ? bookDisplayName(book) : '');
  const refText = `${name} ${row.chapter}:${row.verse}`;
  const item = el('button', { class: 'result-item', type: 'button', title: T.search.jump }, [
    el('span', { class: 'result-ref' }, [
      el('span', { text: refText }),
      el('span', { class: 'result-text-meta', text: T.search.jump }),
    ]),
  ]);
  const snippet = el('span', { class: 'result-text' });
  const text = typeof row.text === 'string' ? row.text : '';
  if (currentKeywords.length) {
    snippet.appendChild(highlightFragment(text, currentKeywords));
  } else {
    snippet.textContent = text;
  }
  item.appendChild(snippet);

  item.addEventListener('click', async () => {
    await goToVerse(row.bookId, row.chapter, row.verse);
    closePanel();
  });
  return item;
}
