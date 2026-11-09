// js/projection.js — 投影模式：全屏、极简版面、指针隐藏、点击翻节、幻灯倒计时

import { $, bus } from './util.js';
import { ipc } from './bridge.js';
import { state } from './state.js';
import { renderStage, moveVerse } from './stage.js';
import { T } from './i18n.js';
import { toast } from './toast.js';
import { pause as pauseSlideshow, resume as resumeSlideshow } from './slideshow.js';
import { closePanel } from './panels.js';

const HIDE_CURSOR_DELAY = 3000;
let hideTimer = null;
let systemFullscreen = false;

export function initProjection() {
  const btn = $('#btn-projection');
  if (btn) btn.addEventListener('click', toggleProjection);

  // 系统级全屏变化（Win+↓、F11）同步投影外观
  ipc.onFullscreenChanged((full) => {
    systemFullscreen = !!full;
    setProjection(!!full);
  });

  document.addEventListener('mousemove', onMouseMove, { passive: true });
  document.addEventListener('mousedown', onMouseMove, { passive: true });
  window.addEventListener('resize', () => renderStage(), { passive: true });

  // 投影状态下点击画面翻节（可在设置中关闭）
  const stage = $('#stage');
  if (stage) {
    stage.addEventListener('click', (event) => {
      if (!state.projection) return;
      if (!state.settings.mouseAdvance) return;
      if (event.detail > 1) return;          // 双击/三击交给其它手势处理
      if (event.target && event.target.closest && event.target.closest('.draw-tools, .slideshow-bar, .ctx-menu')) return;
      moveVerse(1);
    });
  }

  // 幻灯倒计时条
  bus.on('slideshow', (info) => updateSlideshowBar(info));
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
  const wasFullscreen = systemFullscreen;
  setProjection(false);
  const ok = await ipc.setFullscreen(false);
  // 仅当窗口本来处于全屏却退不出来时才提示；本来没全屏不算失败
  if (ok === false && wasFullscreen) toast(T.projection.failed, 'error');
}

/** 只改变渲染层外观（不触碰系统全屏状态）。 */
export function setProjection(on) {
  const next = !!on;
  state.projection = next;
  document.body.classList.toggle('projection', next);
  if (next) {
    // 进入投影时收起抽屉（投影界面不显示抽屉，Esc 才不会先关掉看不见的面板）
    closePanel();
  }
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

function updateSlideshowBar(info) {
  const bar = $('#slideshow-bar');
  if (!bar) return;
  const running = !!(info && info.running);
  bar.hidden = !running;
  if (!running) return;
  const label = $('#slideshow-count');
  if (label) {
    label.textContent = info.paused
      ? T.projection.slideshowPause
      : T.projection.countdown(Math.max(0, Number(info.remaining) || 0));
  }
  const btn = $('#slideshow-toggle');
  if (btn) btn.textContent = info.paused ? T.projection.slideshowResume : T.projection.slideshowPause;
}

export function toggleSlideshowPause() {
  const bar = $('#slideshow-bar');
  const paused = bar && bar.dataset.paused === '1';
  if (paused) resumeSlideshow();
  else pauseSlideshow();
  if (bar) bar.dataset.paused = paused ? '0' : '1';
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
