// js/bgm.js — 背景音乐（本地音频文件，离线播放）

import { clamp, toFileUrl } from './util.js';
import { state } from './state.js';
import { T } from './i18n.js';
import { toast } from './toast.js';

let audio = null;
let lastPath = '';

export function initBgm() {
  if (audio) return audio;
  const host = document.getElementById('bgm-audio');
  audio = host && typeof host.play === 'function' ? host : new Audio();
  audio.preload = 'auto';
  audio.addEventListener('error', () => {
    if (state.settings.bgmPath) toast(T.settings.bgmFailed, 'error');
  });
  return audio;
}

/** 按设置同步背景音乐（路径 / 音量 / 循环）。 */
export function applyBgm(settings = state.settings) {
  const el = initBgm();
  if (!el) return;

  el.loop = settings.bgmLoop !== false;
  el.volume = clamp(Number(settings.bgmVolume ?? 50) / 100, 0, 1);

  const path = String(settings.bgmPath || '').trim();
  if (!path) {
    lastPath = '';
    el.pause();
    el.removeAttribute('src');
    return;
  }

  const url = toFileUrl(path);
  if (url !== lastPath) {
    lastPath = url;
    el.src = url;
  }
  const attempt = el.play();
  if (attempt && typeof attempt.catch === 'function') {
    attempt.catch(() => {
      /* 自动播放被拦截时忽略：用户可在设置里重新选择 */
    });
  }
}

/** 播放 / 暂停。 */
export function toggleBgm() {
  const el = initBgm();
  if (!el) return false;
  if (!state.settings.bgmPath) {
    toast(T.settings.bgmNone, 'info');
    return false;
  }
  if (el.paused) {
    applyBgm(state.settings);
    return true;
  }
  el.pause();
  return false;
}

/** 立即停止（不改变设置）。 */
export function stopBgm() {
  if (audio) audio.pause();
}

export function bgmPlaying() {
  return !!audio && !audio.paused;
}
