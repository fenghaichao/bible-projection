// js/float.js — 浮动控制面板（独立窗口）：显示当前经文 + 上一节/下一节/退出投影
//
// 通道：主 → 面板 bible:float-state（ipc.onFloatState）
//       面板 → 主 bible:float-command（ipc.sendFloatCommand）

import { $ } from './util.js';
import { ipc } from './bridge.js';

let hideTimer = null;

export function initFloat() {
  const body = document.body;

  // 悬停显隐
  body.addEventListener('mouseenter', show);
  body.addEventListener('mouseleave', scheduleHide);
  show();

  // 标签页
  const tabs = document.querySelectorAll('.float-tab');
  for (const tab of tabs) {
    tab.addEventListener('click', () => {
      for (const other of tabs) other.classList.toggle('is-active', other === tab);
      const name = tab.dataset.tab;
      for (const page of document.querySelectorAll('.float-page')) {
        page.classList.toggle('is-active', page.dataset.page === name);
      }
    });
  }

  bind('#float-prev', () => send({ action: 'prev' }));
  bind('#float-next', () => send({ action: 'next' }));
  bind('#float-exit', () => send({ action: 'exit' }));
  bind('#float-close', () => send({ action: 'close' }));
  bind('#float-font-up', () => send({ action: 'fontDelta', delta: 2 }));
  bind('#float-font-down', () => send({ action: 'fontDelta', delta: -2 }));
  bind('#float-theme', () => send({ action: 'theme' }));

  const searchInput = $('#float-search');
  const searchGo = $('#float-search-go');
  if (searchGo) {
    searchGo.addEventListener('click', () => {
      const keywords = searchInput ? searchInput.value.trim() : '';
      if (!keywords) return;
      send({ action: 'search', keywords });
    });
  }
  if (searchInput) {
    searchInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        const keywords = searchInput.value.trim();
        if (keywords) send({ action: 'search', keywords });
      }
    });
  }

  ipc.onFloatState((payload) => renderState(payload || {}));

  loadBookLists();
}

/**
 * 新约 / 旧约目录：按 testament 分组列出全部 66 卷。
 * 点击某一卷 → 通知主窗口跳到该卷第 1 章。
 */
async function loadBookLists() {
  const ntList = $('#float-nt-list');
  const otList = $('#float-ot-list');
  if (!ntList && !otList) return;

  let books = [];
  try {
    books = await ipc.getBooks();
  } catch (error) {
    books = [];
  }
  if (!Array.isArray(books)) books = [];

  const fill = (node, testament, label) => {
    if (!node) return;
    node.textContent = '';
    const items = books.filter((book) => String(book.testament || '') === testament);
    if (!items.length) {
      const empty = document.createElement('li');
      empty.className = 'float-empty';
      empty.textContent = `暂无${label}书卷`;
      node.appendChild(empty);
      return;
    }
    for (const book of items) {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'float-book';
      button.title = `${book.name}（${book.chapters} 章）`;

      const short = document.createElement('span');
      short.className = 'float-book-short';
      short.textContent = book.short || book.abbr || '';

      const name = document.createElement('span');
      name.className = 'float-book-name';
      name.textContent = book.name || book.abbr || '';

      button.appendChild(short);
      button.appendChild(name);
      button.addEventListener('click', () => {
        send({ type: 'goto', action: 'goto', bookId: book.id, chapter: 1, verse: 1 });
      });
      item.appendChild(button);
      node.appendChild(item);
    }
  };

  fill(ntList, '新约', '新约');
  fill(otList, '旧约', '旧约');
}

function bind(selector, handler) {
  const node = $(selector);
  if (node) node.addEventListener('click', handler);
}

function send(payload) {
  ipc.sendFloatCommand(payload);
}

function renderState(payload) {
  const ref = $('#float-ref');
  const text = $('#float-text');
  const name = payload.bookName || '';
  const chapter = payload.chapter || 0;
  const verse = payload.verse || 0;
  if (ref) ref.textContent = name ? `${name} ${chapter}:${verse}` : '—';
  if (text) text.textContent = typeof payload.text === 'string' ? payload.text : '';

  const exit = $('#float-exit');
  if (exit) exit.textContent = payload.projection ? '退出投影' : '进入投影';

  const font = $('#float-font');
  if (font && typeof payload.fontSize === 'number') font.textContent = String(payload.fontSize);
}

function show() {
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
  document.body.classList.add('is-visible');
}

function scheduleHide() {
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    document.body.classList.remove('is-visible');
  }, 900);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFloat, { once: true });
} else {
  initFloat();
}
