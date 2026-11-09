// js/shortcuts.js — 全局快捷键（DOM 键盘事件 + 可选的 IPC 快捷键通道）

import { isTypingTarget } from './util.js';
import { state } from './state.js';
import { T } from './i18n.js';
import { toast } from './toast.js';
import { openPanel, closePanel, isPanelOpen } from './panels.js';
import { copyCurrent, moveBook, moveChapter, moveVerse, goChapterEdge, saveCurrent } from './stage.js';
import { toggleProjection, exitProjection } from './projection.js';
import { clearDraw, isDrawing, redoDraw, toggleDraw, undoDraw } from './draw.js';
import { pushSettings } from './settings.js';
import { ipc } from './bridge.js';

const FONT_STEP = 2;
const DEFAULT_FONT_SIZE = 48;
const DEDUPE_MS = 220;

let lastHandled = { key: '', ctrl: false, shift: false, at: 0 };

export function initShortcuts() {
  window.addEventListener('keydown', onKeyDown);

  // 主进程可选通道：拦截浏览器级默认（F5 重载、Ctrl+S 保存框）后转发给渲染层。
  ipc.onShortcut((payload) => {
    if (!payload || typeof payload.key !== 'string') return;
    // 与 DOM 通道保持一致：焦点在输入控件里时不触发全局快捷键
    if (isTypingTarget(document.activeElement)) return;
    const key = payload.key;
    const ctrl = !!(payload.control || payload.meta);
    const shift = !!payload.shift;
    if (isDuplicate(key, ctrl, shift)) return;
    runShortcut(key, { ctrl, shift, alt: !!payload.alt });
  });
}

function isDuplicate(key, ctrl, shift) {
  const now = Date.now();
  const same =
    lastHandled.key === key &&
    lastHandled.ctrl === ctrl &&
    lastHandled.shift === shift &&
    now - lastHandled.at < DEDUPE_MS;
  return same;
}

function onKeyDown(event) {
  if (isTypingTarget(event.target)) return;
  const key = event.key;
  const ctrl = event.ctrlKey || event.metaKey;
  const shift = event.shiftKey;
  const handled = runShortcut(key, { ctrl, shift, alt: event.altKey });
  if (handled) event.preventDefault();
}

/** 统一快捷键处理；返回 true 表示已消费该按键。 */
function runShortcut(key, mods) {
  const ctrl = !!mods.ctrl;
  const shift = !!mods.shift;
  lastHandled = { key, ctrl, shift, at: Date.now() };

  // ── 组合键（无 Shift）────────────────────────────────────────
  if (ctrl && !shift) {
    switch (key.toLowerCase()) {
      case 'f':
        openPanel('search');
        return true;
      case 'h':
        openPanel('history');
        return true;
      case 's':
      case 'b':
        saveCurrent();
        return true;
      case ',':
        openPanel('settings');
        return true;
      case 'c':
        copyCurrent();
        return true;
      case '=':
      case '+':
        changeFontSize(FONT_STEP);
        return true;
      case '-':
      case '_':
        changeFontSize(-FONT_STEP);
        return true;
      case '0':
      case '/':
        setFontSize(DEFAULT_FONT_SIZE);
        return true;
      case 'z':
        if (isDrawing()) undoDraw();
        return true;
      case 'arrowleft':
        moveBook(-1);
        return true;
      case 'arrowright':
        moveBook(1);
        return true;
      case 'pageup':
        moveChapter(-1);
        return true;
      case 'pagedown':
        moveChapter(1);
        return true;
      default:
        break;
    }
  }

  if (ctrl && shift) {
    const lower = key.toLowerCase();
    if (lower === 'z') {
      if (isDrawing()) redoDraw();
      return true;
    }
    if (key === 'Delete') {
      if (isDrawing()) clearDraw();
      return true;
    }
  }

  // ── 单键 ────────────────────────────────────────────────────
  switch (key) {
    case 'F5':
      toggleProjection();
      return true;
    case 'F11':
      // 系统 F11 走原生全屏，主进程广播 fullscreen-changed 同步投影外观，
      // 此处不重复切换，避免与原生全屏互相打架。
      return false;
    case 'Escape':
      if (isPanelOpen()) {
        closePanel();
      } else if (isDrawing()) {
        toggleDraw();
      } else if (state.projection) {
        exitProjection();
      }
      return true;
    case 'ArrowLeft':
    case 'ArrowUp':
      moveVerse(-1);
      return true;
    case 'ArrowRight':
    case 'ArrowDown':
      moveVerse(1);
      return true;
    case ' ':
      moveVerse(1);
      return true;
    case 'PageUp':
      moveVerse(-Math.max(1, state.settings.versesPerPage));
      return true;
    case 'PageDown':
      moveVerse(Math.max(1, state.settings.versesPerPage));
      return true;
    case 'Home':
      goChapterEdge('first');
      return true;
    case 'End':
      goChapterEdge('last');
      return true;
    case 'Delete':
      if (shift && isDrawing()) {
        clearDraw();
        return true;
      }
      return false;
    default:
      break;
  }

  if (ctrl) return false;

  const lower = key.toLowerCase();
  if ((lower === 'd' || lower === 'p') && state.projection) {
    toggleDraw();
    return true;
  }
  if (lower === 'z' && isDrawing()) {
    undoDraw();
    return true;
  }
  if (lower === 'x' && isDrawing()) {
    clearDraw();
    return true;
  }
  return false;
}

async function changeFontSize(delta) {
  const next = Math.max(12, Math.min(160, Number(state.settings.fontSize || DEFAULT_FONT_SIZE) + delta));
  await setFontSize(next);
}

async function setFontSize(size) {
  const value = Math.max(12, Math.min(160, Math.round(size)));
  await pushSettings({ fontSize: value });
  toast(T.toast.fontSize(value), 'ok', 1400);
}
