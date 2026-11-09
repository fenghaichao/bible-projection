// js/projection.js — 投影模式：全屏、极简版面、指针隐藏

import { $, bus } from './util.js';
import { ipc } from './bridge.js';
import { state } from './state.js';
import { renderStage } from './stage.js';
import { T } from './i18n.js';

const HIDE_CURSOR_DELAY = 3000;
let hideTimer = null;

export function initProjection() {
  const btn = $('#btn-projection');
  if (btn) btn.addEventListener('click', toggleProjection);

  // 系统级全屏变化（Win+↓、F11）同步投影外观
  ipc.onFullscreenChanged((full) => {
    setProjection(!!full);
  });

  document.addEventListener('mousemove', onMouseMove, { passive: true });
  document.addEventListener('mousedown', onMouseMove, { passive: true });
  window.addEventListener('resize', () => renderStage(), { passive: true });
}

/** 切换投影模式。 */
export async function toggleProjection() {
  if (state.projection) {
    exitProjection();
  } else {
    enterProjection();
  }
}

export async function enterProjection() {
  setProjection(true);
  const ok = await ipc.setFullscreen(true);
  if (ok === false) toast(T.projection.failed, 'error');
}

export async function exitProjection() {
  setProjection(false);
  const ok = await ipc.setFullscreen(false);
  if (ok === false) toast(T.projection.failed, 'error');
}

/** 只改变渲染层外观（不触碰系统全屏状态）。 */
export function setProjection(on) {
  const next = !!on;
  state.projection = next;
  document.body.classList.toggle('projection', next);
  if (!next) {
    document.body.classList.remove('cursor-hidden');
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  } else {
    scheduleHide();
  }
  const btn = $('#btn-projection');
  if (btn) {
    const label = btn.querySelector('span:last-child');
    if (label) label.textContent = next ? T.projection.exit : T.projection.enter;
  }
  const foot = $('#stage-foot');
  if (foot) {
    foot.textContent = next ? T.projection.hint : '';
    foot.classList.toggle('is-visible', next);
  }
  renderStage();
  bus.emit('projection', next);
}

function onMouseMove() {
  if (!state.projection) return;
  document.body.classList.remove('cursor-hidden');
  scheduleHide();
}

function scheduleHide() {
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    if (state.projection) document.body.classList.add('cursor-hidden');
  }, HIDE_CURSOR_DELAY);
}
