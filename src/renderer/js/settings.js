// js/settings.js — 设置面板（改动即时生效并持久化）与全局样式应用

import { $, $$, bus, clamp, debounce, el, toFileUrl } from './util.js';
import { ipc } from './bridge.js';
import { mergeSettings, state } from './state.js';
import { T } from './i18n.js';
import { toast } from './toast.js';

let refs = {};

export function initSettings() {
  refs.font = $('#set-font');
  refs.presets = $('#set-font-presets');
  refs.size = $('#set-size');
  refs.sizeOut = $('#set-size-out');
  refs.line = $('#set-line');
  refs.lineOut = $('#set-line-out');
  refs.color = $('#set-color');
  refs.colorHex = $('#set-color-hex');
  refs.bg = $('#set-bg');
  refs.bgHex = $('#set-bg-hex');
  refs.bgImage = $('#set-bgimg');
  refs.bgImageClear = $('#set-bgimg-clear');
  refs.italic = $('#set-italic');
  refs.underline = $('#set-underline');
  refs.notes = $('#set-notes');
  refs.vpp = $('#set-vpp');
  refs.theme = $$('input[name="theme"]');
  refs.langTag = $('.lang-tag');

  for (const preset of T.settings.fontPresets) {
    const btn = el('button', { class: 'chip-btn', type: 'button', text: preset });
    btn.addEventListener('click', () => {
      refs.font.value = preset;
      pushSettings({ fontFamily: preset });
    });
    refs.presets.appendChild(btn);
  }

  refs.font.addEventListener('change', () => pushSettings({ fontFamily: refs.font.value.trim() }));

  refs.size.addEventListener('input', () => {
    refs.sizeOut.textContent = refs.size.value;
    pushDebounced({ fontSize: Number(refs.size.value) });
  });

  refs.line.addEventListener('input', () => {
    refs.lineOut.textContent = Number(refs.line.value).toFixed(2);
    pushDebounced({ lineHeight: Number(refs.line.value) });
  });

  refs.color.addEventListener('input', () => {
    refs.colorHex.textContent = refs.color.value;
    pushDebounced({ textColor: refs.color.value });
  });

  refs.bg.addEventListener('input', () => {
    refs.bgHex.textContent = refs.bg.value;
    pushDebounced({ bgColor: refs.bg.value });
  });

  refs.bgImage.addEventListener('change', () => pushSettings({ bgImage: refs.bgImage.value.trim() }));
  refs.bgImageClear.addEventListener('click', () => {
    refs.bgImage.value = '';
    pushSettings({ bgImage: '' });
  });

  refs.italic.addEventListener('change', () => pushSettings({ italic: refs.italic.checked }));
  refs.underline.addEventListener('change', () => pushSettings({ underline: refs.underline.checked }));
  refs.notes.addEventListener('change', () => pushSettings({ showNotes: refs.notes.checked }));

  refs.vpp.addEventListener('change', () => {
    const value = clamp(Math.round(Number(refs.vpp.value) || 1), 1, 20);
    refs.vpp.value = String(value);
    pushSettings({ versesPerPage: value });
  });

  for (const radio of refs.theme) {
    radio.addEventListener('change', () => {
      if (radio.checked) pushSettings({ theme: radio.value });
    });
  }

  syncInputs();
}

const pushDebounced = debounce((patch) => pushSettings(patch), 220);

/** 提交设置变更（后端返回合并后的完整设置）。 */
export async function pushSettings(patch) {
  const merged = await ipc.setSettings(patch);
  if (!merged || typeof merged !== 'object') return;
  state.settings = mergeSettings(merged);
  applySettings(state.settings);
  bus.emit('settings', state.settings);
}

/** 把设置应用到 DOM（主题、经文样式、背景图）。 */
export function applySettings(next = state.settings) {
  const s = next && typeof next === 'object' ? next : state.settings;

  document.body.classList.toggle('theme-light', s.theme === 'light');
  document.body.classList.toggle('theme-dark', s.theme !== 'light');

  const root = document.documentElement;
  root.style.setProperty('--stage-font', `"${s.fontFamily}", "Source Han Serif SC", "Songti SC", serif`);
  root.style.setProperty('--stage-size', `${s.fontSize}px`);
  root.style.setProperty('--stage-line', String(s.lineHeight));
  root.style.setProperty('--stage-color', s.textColor);
  root.style.setProperty('--stage-bg', s.bgColor);

  const verses = $('#verses');
  if (verses) {
    verses.style.fontStyle = s.italic ? 'italic' : 'normal';
    verses.style.textDecoration = s.underline ? 'underline' : 'none';
  }

  const stage = $('#stage');
  if (stage) {
    const url = s.bgImage ? toFileUrl(s.bgImage) : '';
    stage.style.backgroundImage = url ? `url("${url}")` : 'none';
    stage.style.backgroundSize = 'cover';
    stage.style.backgroundPosition = 'center';
    stage.style.backgroundRepeat = 'no-repeat';
    if (url) verifyImage(url);
  }

  if (refs.langTag) refs.langTag.textContent = s.traditional ? '繁' : '简';

  syncInputs();
}

function verifyImage(url) {
  const img = new Image();
  img.onerror = () => toast(T.settings.bgImageFailed, 'error');
  img.src = url;
}

/** 控件回填（外部改动设置时同步）。 */
export function syncInputs() {
  const s = state.settings;
  if (!refs.font) return;

  if (document.activeElement !== refs.font) refs.font.value = s.fontFamily;
  if (document.activeElement !== refs.size) refs.size.value = String(s.fontSize);
  refs.sizeOut.textContent = String(s.fontSize);
  if (document.activeElement !== refs.line) refs.line.value = String(s.lineHeight);
  refs.lineOut.textContent = Number(s.lineHeight).toFixed(2);
  if (document.activeElement !== refs.color) refs.color.value = s.textColor;
  refs.colorHex.textContent = s.textColor;
  if (document.activeElement !== refs.bg) refs.bg.value = s.bgColor;
  refs.bgHex.textContent = s.bgColor;
  if (document.activeElement !== refs.bgImage) refs.bgImage.value = s.bgImage;
  refs.italic.checked = !!s.italic;
  refs.underline.checked = !!s.underline;
  refs.notes.checked = !!s.showNotes;
  if (document.activeElement !== refs.vpp) refs.vpp.value = String(s.versesPerPage);
  for (const radio of refs.theme) radio.checked = radio.value === s.theme;
}
