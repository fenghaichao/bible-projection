// js/panel-library.js — 历史面板与收藏面板

import { $, bus, el, formatTime } from './util.js';
import { ipc } from './bridge.js';
import { bookDisplayName, bookById } from './state.js';
import { T } from './i18n.js';
import { toast } from './toast.js';
import { closePanel } from './panels.js';
import { goToVerse } from './stage.js';

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

  for (const entry of items) {
    const at = formatTime(entry.at);
    const btn = el('button', { class: 'result-item', type: 'button' }, [
      el('span', { class: 'result-ref' }, [
        el('span', { text: labelOf(entry) }),
        at ? el('span', { class: 'result-text-meta', text: at }) : null,
      ]),
    ]);
    btn.addEventListener('click', async () => {
      await goToVerse(entry.bookId, entry.chapter, entry.verse);
      closePanel();
    });
    list.appendChild(btn);
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

  for (const entry of items) {
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

    const open = el('button', { class: 'result-item result-open', type: 'button' }, [
      el('span', { class: 'result-ref' }, [el('span', { text: labelOf(entry) })]),
    ]);
    open.addEventListener('click', async () => {
      await goToVerse(entry.bookId, entry.chapter, entry.verse);
      closePanel();
    });

    const wrap = el('div', { class: 'result-row' }, [open, remove]);
    list.appendChild(wrap);
  }
}
