// js/panel-search.js — 查找面板（多关键字 / 全部或任一匹配）

import { $, bus, el } from './util.js';
import { ipc } from './bridge.js';
import { bookDisplayName, bookById, state } from './state.js';
import { T } from './i18n.js';
import { closePanel } from './panels.js';
import { goToVerse } from './stage.js';

let refs = {};
let running = false;

export function initSearch() {
  refs.input = $('#search-input');
  refs.run = $('#search-run');
  refs.status = $('#search-status');
  refs.results = $('#search-results');

  refs.run.addEventListener('click', () => run());
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
    if (name === 'search') {
      refs.input.focus();
      refs.input.select();
    }
  });
}

function parseKeywords(raw) {
  return String(raw || '')
    .split(/[\s,，;；、]+/)
    .map((k) => k.trim())
    .filter(Boolean);
}

async function run() {
  if (running) return;
  const keywords = parseKeywords(refs.input.value);
  if (!keywords.length) {
    refs.status.textContent = T.search.needKeywords;
    refs.results.textContent = '';
    return;
  }

  const checked = document.querySelector('input[name="search-mode"]:checked');
  const mode = checked ? checked.value : 'all';

  running = true;
  refs.status.textContent = T.search.running;
  const rows = await ipc.search({ keywords, mode });
  running = false;

  const list = Array.isArray(rows) ? rows : [];
  refs.results.textContent = '';
  refs.status.textContent = list.length ? T.search.count(list.length) : T.search.empty;

  for (const row of list) {
    refs.results.appendChild(resultItem(row));
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
    el('span', { class: 'result-text', text: typeof row.text === 'string' ? row.text : '' }),
  ]);
  item.addEventListener('click', async () => {
    await goToVerse(row.bookId, row.chapter, row.verse);
    closePanel();
  });
  return item;
}
