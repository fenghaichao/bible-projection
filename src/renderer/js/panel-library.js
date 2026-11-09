// js/panel-library.js — 历史面板与收藏面板（条目带经文正文）

import { $, bus, el, formatTime } from './util.js';
import { ipc } from './bridge.js';
import { bookDisplayName, bookById } from './state.js';
import { T } from './i18n.js';
import { toast } from './toast.js';
import { closePanel } from './panels.js';
import { goToVerse } from './stage.js';

const MAX_ITEMS = 100;
const textCache = new Map();

export function initLibrary() {
  bus.on('panel-open', (name) => {
    if (name === 'history') loadHistory();
    if (name === 'saved') loadSaved();
  });
  bus.on('history-changed', () => {
    if ($('#panel-history') && !$('#panel-history').hidden) loadHistory();
  });
  bus.on('saved-changed', () => {
    if ($('#panel-saved') && !$('#panel-saved').hidden) loadSaved();
  });

  const clearBtn = $('#history-clear');
  if (clearBtn) {
    clearBtn.addEventListener('click', async () => {
      await ipc.clearHistory();
      textCache.clear();
      toast(T.history.cleared, 'ok');
      loadHistory();
      bus.emit('history-changed');
    });
  }
}

function labelOf(entry) {
  if (entry && typeof entry.label === 'string' && entry.label) return entry.label;
  const book = bookById(entry && entry.bookId);
  const name = book ? bookDisplayName(book) : '';
  return `${name} ${entry && entry.chapter}:${entry && entry.verse}`;
}

function cacheKey(entry) {
  return `${entry.bookId}:${entry.chapter}:${entry.verse}`;
}

/** 取一节正文（带缓存），用于列表里直接显示经文内容。 */
async function verseTextOf(entry) {
  const key = cacheKey(entry);
  if (textCache.has(key)) return textCache.get(key);
  try {
    const rows = await ipc.getRange(
      entry.bookId,
      { chapter: entry.chapter, verse: entry.verse },
      { chapter: entry.chapter, verse: entry.verse }
    );
    const text = rows && rows.length ? String(rows[0].text || '') : '';
    textCache.set(key, text);
    return text;
  } catch (error) {
    return '';
  }
}

function makeItem(entry, extra) {
  const btn = el('button', { class: 'result-item', type: 'button' }, [
    el('span', { class: 'result-ref' }, [el('span', { text: labelOf(entry) })]),
  ]);
  const snippet = el('span', { class: 'result-text lib-text' });
  btn.appendChild(snippet);
  if (extra) btn.querySelector('.result-ref').appendChild(extra);
  btn.addEventListener('click', async () => {
    await goToVerse(entry.bookId, entry.chapter, entry.verse);
    closePanel();
  });
  verseTextOf(entry).then((text) => {
    snippet.textContent = text;
  });
  return btn;
}

async function loadHistory() {
  const list = $('#history-list');
  if (!list) return;
  const rows = await ipc.getHistory();
  list.textContent = '';
  const items = Array.isArray(rows) ? rows : [];

  if (!items.length) {
    list.appendChild(el('p', { class: 'empty-note', text: T.history.empty }));
    return;
  }

  for (const entry of items.slice(0, MAX_ITEMS)) {
    const at = formatTime(entry.at);
    list.appendChild(makeItem(entry, at ? el('span', { class: 'result-text-meta', text: at }) : null));
  }
}

async function loadSaved() {
  const list = $('#saved-list');
  if (!list) return;
  const rows = await ipc.getSaved();
  list.textContent = '';
  const items = Array.isArray(rows) ? rows : [];

  if (!items.length) {
    list.appendChild(el('p', { class: 'empty-note', text: T.saved.empty }));
    return;
  }

  for (const entry of items.slice(0, MAX_ITEMS)) {
    const remove = el('button', {
      class: 'icon-btn result-del',
      type: 'button',
      title: T.saved.remove,
      text: '✕',
    });
    remove.addEventListener('click', async (event) => {
      event.stopPropagation();
      await ipc.removeSaved(entry.id);
      toast(T.saved.removed, 'ok');
      loadSaved();
      bus.emit('saved-changed');
    });

    const wrap = el('div', { class: 'result-row' }, [makeItem(entry, null), remove]);
    list.appendChild(wrap);
  }
}
