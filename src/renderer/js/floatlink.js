// js/floatlink.js — 主窗口 ↔ 浮动控制面板（float.html）的双向通道

import { $, bus } from './util.js';
import { ipc } from './bridge.js';
import { bookById, bookDisplayName, state, verseNumber, verseText } from './state.js';
import { T } from './i18n.js';
import { toast } from './toast.js';
import { goToVerse, moveVerse } from './stage.js';
import { exitProjection } from './projection.js';
import { pushSettings } from './settings.js';
import { openPanel } from './panels.js';
import { runSearchWith } from './panel-search.js';

export function initFloatLink() {
  ipc.onFloatState(() => sendFloatState());
  ipc.onFloatCommand((payload) => handleCommand(payload));

  bus.on('navigate', () => sendFloatState());
  bus.on('projection', () => sendFloatState());
  bus.on('settings', () => sendFloatState());

  const btn = $('#btn-float');
  if (btn) {
    btn.addEventListener('click', async () => {
      const on = !state.settings.floatPanel;
      await pushSettings({ floatPanel: on });
      await ipc.toggleFloatPanel(on);
      toast(on ? T.toast.floatOn : T.toast.floatOff, 'ok');
    });
  }

  // 显示区左缘热区：悬停唤出浮动控制面板
  const hotspot = $('#float-hotspot');
  if (hotspot) {
    hotspot.addEventListener('mouseenter', async () => {
      if (!state.settings.floatPanel) return;
      await ipc.toggleFloatPanel(true);
    });
  }
}

/** 把当前经文状态推给浮动面板。 */
export function sendFloatState() {
  const { bookId, chapter, verse } = state.current;
  const book = bookById(bookId);
  ipc.sendFloatState({
    bookId,
    chapter,
    verse,
    bookName: book ? bookDisplayName(book) : '',
    text: currentVerseText(),
    projection: !!state.projection,
  });
}

function currentVerseText() {
  const { bookId, chapter } = state.current;
  const list = state.chapterCache.get(`${bookId}:${chapter}`) || [];
  const found = list.find((item) => verseNumber(item) === state.current.verse);
  return found ? verseText(found) : '';
}

async function handleCommand(payload) {
  if (!payload || typeof payload !== 'object') return;
  // 载荷既可能用 action，也可能用 type（两种都兼容）。
  const action = String(payload.action || payload.type || '');

  switch (action) {
    case 'prev':
      await moveVerse(-1);
      break;
    case 'next':
      await moveVerse(1);
      break;
    case 'exit':
    case 'exitProjection':
      exitProjection();
      break;
    case 'close':
      await ipc.toggleFloatPanel(false);
      await pushSettings({ floatPanel: false });
      break;
    case 'goto':
      if (payload.bookId !== undefined) {
        await goToVerse(payload.bookId, payload.chapter || 1, payload.verse || 1);
      }
      break;
    case 'search':
      openPanel('search');
      if (typeof payload.keywords === 'string') runSearchWith(payload.keywords);
      break;
    case 'fontDelta':
      await pushSettings({
        fontSize: Math.max(12, Math.min(160, Number(state.settings.fontSize || 48) + (Number(payload.delta) || 0))),
      });
      break;
    case 'theme':
      await pushSettings({ theme: payload.theme === 'light' ? 'light' : 'dark' });
      break;
    case 'toggleProjection':
      if (state.projection) exitProjection();
      else {
        const { toggleProjection } = await import('./projection.js');
        toggleProjection();
      }
      break;
    default:
      break;
  }
}

export function floatPanelEnabled() {
  return !!state.settings.floatPanel;
}

export function floatToggleHint() {
  return T.float.title;
}
