// js/shortcuts.js — 全局快捷键（DOM 键盘事件 + 可选的 IPC 快捷键通道）

import { isTypingTarget } from './util.js';
import { state } from './state.js';
import { T } from './i18n.js';
import { toast } from './toast.js';
import { openPanel, closePanel, isPanelOpen, currentPanel } from './panels.js';
import {
  copyCurrent,
  copyCurrentVerse,
  copyTitleOnly,
  moveBook,
  moveChapter,
  moveVerse,
  goChapterEdge,
  saveCurrent,
  adjustRange,
  activeRange,
} from './stage.js';
import { copySearchResults } from './panel-search.js';
import { toggleProjection, exitProjection } from './projection.js';
import { clearDraw, isDrawing, redoDraw, toggleDraw, toggleEraser, undoDraw } from './draw.js';
import { pushSettings, cycleFont } from './settings.js';
import { switchColumnByNumber } from './columns.js';
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
  // Esc 在输入框内也要能关掉抽屉（投影模式除外：那里 Esc 用于退出投影）
  if (event.key === 'Escape' && !state.projection && isPanelOpen()) {
    closePanel();
    event.preventDefault();
    return;
  }
  if (event.isComposing) return;              // 中文输入法组字中，不抢键
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
  const alt = !!mods.alt;
  lastHandled = { key, ctrl, shift, at: Date.now() };

  // ── 组合键（无 Shift）────────────────────────────────────────
  if (ctrl && !shift) {
    switch (key.toLowerCase()) {
      case 'f':
        if (state.projection) return true;      // 投影模式不打开抽屉
        openPanel('search');
        return true;
      case 'h':
        if (state.projection) return true;
        openPanel('history');
        return true;
      case 's':
        saveCurrent();
        return true;
      case 'b':
        // 原版 Ctrl+B = 画笔开关（feature-check 6.3 取舍）；收藏改用 Ctrl+S。
        if (!state.projection) toggleProjection();
        toggleDraw();
        return true;
      case 'p':
        if (!state.projection) toggleProjection();
        toggleDraw();
        return true;
      case 'e':
        if (!isDrawing()) return false;
        clearDraw();
        return true;
      case 't': {
        const next = !state.settings.showNotes;
        pushSettings({ showNotes: next });
        toast(next ? T.toast.notesOn : T.toast.notesOff, 'ok', 1400);
        return true;
      }
      case 'd':
        cycleFont();
        return true;
      case ',':
        if (state.projection) return true;
        openPanel('settings');
        return true;
      case 'c':
        // 原版 F060：查找对话框内 Ctrl+C 复制查找结果；其它位置复制当前显示的经文
        if (currentPanel() === 'search') copySearchResults('both');
        else copyCurrent();
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
        if (isDrawing()) {
          undoDraw();
          return true;
        }
        return false;                            // 非绘画状态不吞键
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
      case '1':
      case '2':
      case '3':
      case '4':
        if (switchColumnByNumber(Number(key))) return true;
        return false;
      default:
        break;
    }
  }

  if (ctrl && shift) {
    const lower = key.toLowerCase();
    if (lower === 'c') {
      copyCurrentVerse();
      return true;
    }
    if (lower === 'z') {
      if (isDrawing()) {
        redoDraw();
        return true;
      }
      return false;
    }
    if (key === 'Delete' || key === 'Backspace') {
      if (isDrawing()) {
        clearDraw();
        return true;
      }
      return false;
    }
  }

  // ── Alt 组合：原版 Alt+C = 复制章节（仅标题）─────────────────
  if (alt && !ctrl && !shift) {
    if (key.toLowerCase() === 'c') {
      copyTitleOnly();
      return true;
    }
  }

  // ── Shift 组合：增减显示的经文节数（原版「方法5」）────────
  // 中文输入法下 Shift+. / Shift+, 可能送成全角「。」「，」，一并接受。
  if (shift && !ctrl) {
    if (key === '>' || key === '.' || key === '。') {
      changeDisplaySpan(1);
      return true;
    }
    if (key === '<' || key === ',' || key === '，') {
      changeDisplaySpan(-1);
      return true;
    }
  }
  if (!ctrl && !alt && (key === '。' || key === '，')) {
    changeDisplaySpan(key === '。' ? 1 : -1);
    return true;
  }

  // ── 单键 ────────────────────────────────────────────────────
  switch (key) {
    case 'F3':
      if (!state.projection) openPanel('search');
      return true;
    case 'F4':
      if (!state.projection) openPanel('history');
      return true;
    case 'F5':
      toggleProjection();
      return true;
    case 'F6':
      // 原版：F6 = 退出 / 隐藏窗口（feature-check 6.3 取舍：F5 进、F6 出）
      if (!state.projection) return false;
      exitProjection();
      return true;
    case 'F11':
      // 系统 F11 走原生全屏，主进程广播 fullscreen-changed 同步投影外观，
      // 此处不重复切换，避免与原生全屏互相打架。
      return false;
    case 'Escape':
      // 投影模式：Esc 一次即退出投影（不先关看不见的抽屉）
      if (state.projection) {
        if (isDrawing()) toggleDraw();
        else exitProjection();
        return true;
      }
      if (isPanelOpen()) {
        closePanel();
      } else if (isDrawing()) {
        toggleDraw();
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
    case 'AudioNext':
    case 'MediaTrackNext':
    case 'MediaNextTrack':
      moveVerse(1);
      return true;
    case 'AudioPrev':
    case 'MediaTrackPrevious':
    case 'MediaPreviousTrack':
      moveVerse(-1);
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
  if (lower === 'e' && isDrawing()) {
    toggleEraser();
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

/** Shift + > / < ：微调每页显示节数。 */
async function changeVersesPerPage(delta) {
  const current = Number(state.settings.versesPerPage || 1);
  const next = Math.max(1, Math.min(20, current + delta));
  if (next === current) {
    toast(delta > 0 ? T.toast.versesPerPageMax : T.toast.versesPerPageMin, 'info', 1600);
    return;
  }
  await pushSettings({ versesPerPage: next });
  toast(T.toast.versesPerPage(next), 'ok', 1400);
}

/**
 * Shift + > / Shift + < ：增减显示的经文节数（原版「方法5」）。
 *  - 当前有速选范围（如 CSJ2:1-10）→ 扩展 / 收缩该范围的末节；
 *  - 没有范围 → 调整「每页节数」（普通模式按页开窗，投影模式按屏显示）。
 */
async function changeDisplaySpan(delta) {
  if (activeRange()) {
    await adjustRange(delta);
    return;
  }
  await changeVersesPerPage(delta);
}
