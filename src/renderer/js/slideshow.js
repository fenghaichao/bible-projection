// js/slideshow.js — 投影模式自动翻页（幻灯放映）

import { bus } from './util.js';
import { state } from './state.js';
import { moveVerse } from './stage.js';

let timer = null;
let ticker = null;
let paused = false;
let deadline = 0;

export function initSlideshow() {
  bus.on('projection', (on) => {
    if (on) start();
    else stop();
  });
  bus.on('settings', () => {
    if (state.projection) start();
  });
}

/** 依据 settings.slideshowInterval 启动/重启。间隔 0 表示关闭。 */
export function start() {
  stop();
  const interval = Number(state.settings.slideshowInterval || 0);
  if (!interval || interval <= 0) {
    emitState();
    return;
  }
  deadline = Date.now() + interval * 1000;
  // 以 0.25 秒为节拍，到期才翻页；剩余秒数随倒计时递减
  timer = setInterval(() => {
    if (paused) return;
    if (Date.now() >= deadline) {
      moveVerse(1);
      deadline = Date.now() + interval * 1000;
    }
    emitState();
  }, 250);
  emitState();
}

export function stop() {
  if (timer) clearInterval(timer);
  if (ticker) clearInterval(ticker);
  timer = null;
  ticker = null;
  paused = false;
  deadline = 0;
  emitState();
}
export function pause() {
  paused = true;
  emitState();
}

export function resume() {
  paused = false;
  deadline = Date.now() + Number(state.settings.slideshowInterval || 0) * 1000;
  emitState();
}

export function toggle() {
  if (paused) resume();
  else pause();
  return paused;
}

export function isRunning() {
  return !!timer;
}

export function isPaused() {
  return paused;
}

/** 距离下次翻页的秒数（未运行时为 0）。 */
export function remainingSeconds() {
  if (!timer || paused) return 0;
  const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
  return left;
}

function emitState() {
  bus.emit('slideshow', {
    running: isRunning(),
    paused,
    remaining: remainingSeconds(),
    interval: Number(state.settings.slideshowInterval || 0),
  });
}
