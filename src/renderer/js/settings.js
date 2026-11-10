// js/settings.js — 设置面板（改动即时生效并持久化）与全局样式应用

import { $, $$, bus, clamp, debounce, el, toFileUrl } from './util.js';
import { cssUrl } from './util.js';
import { ipc } from './bridge.js';
import { mergeSettings, state } from './state.js';
import { T } from './i18n.js';
import { toast } from './toast.js';
import { applyBgm } from './bgm.js';

const THEME_COLORS = {
  dark: { text: '#f5f5f5', bg: '#101014' },
  light: { text: '#241f18', bg: '#ece5d6' },
};

let refs = {};

export function initSettings() {
  refs.font = $('#set-font');
  refs.presets = $('#set-font-presets');
  refs.titleFont = $('#set-title-font');
  refs.titleColor = $('#set-title-color');
  refs.titleColorHex = $('#set-title-color-hex');
  refs.titleColorReset = $('#set-title-color-reset');
  refs.verseColor = $('#set-verse-color');
  refs.verseColorHex = $('#set-verse-color-hex');
  refs.verseColorReset = $('#set-verse-color-reset');
  refs.currentColor = $('#set-current-color');
  refs.currentColorHex = $('#set-current-color-hex');
  refs.currentColorReset = $('#set-current-color-reset');
  refs.padding = $('#set-padding');
  refs.paddingOut = $('#set-padding-out');
  refs.size = $('#set-size');
  refs.sizeOut = $('#set-size-out');
  refs.line = $('#set-line');
  refs.lineOut = $('#set-line-out');
  refs.color = $('#set-color');
  refs.colorHex = $('#set-color-hex');
  refs.bg = $('#set-bg');
  refs.bgHex = $('#set-bg-hex');
  refs.bgImage = $('#set-bgimg');
  refs.bgImageBrowse = $('#set-bgimg-browse');
  refs.bgImageClear = $('#set-bgimg-clear');
  refs.shadow = $('#set-shadow');
  refs.shadowColor = $('#set-shadow-color');
  refs.shadowHex = $('#set-shadow-hex');
  refs.shadowBlur = $('#set-shadow-blur');
  refs.shadowBlurOut = $('#set-shadow-blur-out');
  refs.shadowOffset = $('#set-shadow-offset');
  refs.shadowOffsetOut = $('#set-shadow-offset-out');
  refs.bgmPath = $('#set-bgm-path');
  refs.bgmPick = $('#set-bgm-pick');
  refs.bgmClear = $('#set-bgm-clear');
  refs.bgmVolume = $('#set-bgm-volume');
  refs.bgmVolumeOut = $('#set-bgm-volume-out');
  refs.bgmLoop = $('#set-bgm-loop');
  refs.slideshow = $('#set-slideshow');
  refs.floatPanel = $('#set-float-panel');
  refs.mouseAdvance = $('#set-mouse-advance');
  refs.italic = $('#set-italic');
  refs.underline = $('#set-underline');
  refs.notes = $('#set-notes');
  refs.vpp = $('#set-vpp');
  refs.theme = $$('input[name="theme"]');
  refs.copyFormat = $$('input[name="copyFormat"]');

  for (const preset of T.settings.fontPresets) {
    const btn = el('button', { class: 'chip-btn', type: 'button', text: preset });
    btn.addEventListener('click', () => {
      refs.font.value = preset;
      pushSettings({ fontFamily: preset });
    });
    refs.presets.appendChild(btn);
  }

  refs.font.addEventListener('change', () => pushSettings({ fontFamily: refs.font.value.trim() }));

  // 标题字体（留空＝跟随正文）
  if (refs.titleFont) {
    refs.titleFont.addEventListener('change', () => {
      pushSettings({ titleFontFamily: refs.titleFont.value.trim() });
    });
  }
  // 标题颜色 / 节号颜色（留空＝跟随主题）
  bindColor(refs.titleColor, refs.titleColorHex, refs.titleColorReset, 'titleColor', () => state.settings.textColor);
  bindColor(refs.verseColor, refs.verseColorHex, refs.verseColorReset, 'verseNumberColor', () => accentColor());
  // 当前节高亮颜色（留空＝跟随主题金色）
  bindColor(refs.currentColor, refs.currentColorHex, refs.currentColorReset, 'currentVerseColor', () => accentColor());
  if (refs.padding) {
    refs.padding.addEventListener('input', () => {
      refs.paddingOut.textContent = refs.padding.value;
      pushDebounced({ padding: Number(refs.padding.value) });
    });
  }
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
  refs.color.addEventListener('change', () => blurInput(refs.color));

  refs.bg.addEventListener('input', () => {
    refs.bgHex.textContent = refs.bg.value;
    pushDebounced({ bgColor: refs.bg.value });
  });
  refs.bg.addEventListener('change', () => blurInput(refs.bg));

  refs.bgImage.addEventListener('change', () => pushSettings({ bgImage: refs.bgImage.value.trim() }));
  if (refs.bgImageBrowse) {
    refs.bgImageBrowse.addEventListener('click', async () => {
      const picked = await ipc.pickImage();
      if (!picked) return;
      refs.bgImage.value = picked;
      await pushSettings({ bgImage: picked });
      toast(T.settings.bgImagePicked, 'ok');
    });
  }
  if (refs.bgImageClear) {
    refs.bgImageClear.addEventListener('click', () => {
      refs.bgImage.value = '';
      pushSettings({ bgImage: '' });
    });
  }

  // 文字阴影
  if (refs.shadow) {
    refs.shadow.addEventListener('change', () => pushSettings({ textShadow: refs.shadow.checked }));
  }
  if (refs.shadowColor) {
    refs.shadowColor.addEventListener('input', () => {
      refs.shadowHex.textContent = refs.shadowColor.value;
      pushDebounced({ shadowColor: refs.shadowColor.value });
    });
    refs.shadowColor.addEventListener('change', () => blurInput(refs.shadowColor));
  }
  if (refs.shadowBlur) {
    refs.shadowBlur.addEventListener('input', () => {
      refs.shadowBlurOut.textContent = refs.shadowBlur.value;
      pushDebounced({ shadowBlur: Number(refs.shadowBlur.value) });
    });
  }
  if (refs.shadowOffset) {
    refs.shadowOffset.addEventListener('input', () => {
      refs.shadowOffsetOut.textContent = refs.shadowOffset.value;
      pushDebounced({ shadowOffset: Number(refs.shadowOffset.value) });
    });
  }

  // 背景音乐
  if (refs.bgmPath) {
    refs.bgmPath.addEventListener('change', () => pushSettings({ bgmPath: refs.bgmPath.value.trim() }));
  }
  if (refs.bgmPick) {
    refs.bgmPick.addEventListener('click', async () => {
      const picked = await ipc.pickAudio();
      if (!picked) return;
      refs.bgmPath.value = picked;
      await pushSettings({ bgmPath: picked });
      toast(T.settings.bgmPicked, 'ok');
    });
  }
  if (refs.bgmClear) {
    refs.bgmClear.addEventListener('click', () => {
      refs.bgmPath.value = '';
      pushSettings({ bgmPath: '' });
    });
  }
  if (refs.bgmVolume) {
    refs.bgmVolume.addEventListener('input', () => {
      refs.bgmVolumeOut.textContent = refs.bgmVolume.value;
      pushDebounced({ bgmVolume: Number(refs.bgmVolume.value) });
    });
  }
  if (refs.bgmLoop) {
    refs.bgmLoop.addEventListener('change', () => pushSettings({ bgmLoop: refs.bgmLoop.checked }));
  }

  if (refs.slideshow) {
    refs.slideshow.addEventListener('change', () => {
      const value = clamp(Math.round(Number(refs.slideshow.value) || 0), 0, 3600);
      refs.slideshow.value = String(value);
      pushSettings({ slideshowInterval: value });
    });
  }
  if (refs.floatPanel) {
    refs.floatPanel.addEventListener('change', async () => {
      const on = refs.floatPanel.checked;
      await pushSettings({ floatPanel: on });
      await ipc.toggleFloatPanel(on);
      toast(on ? T.toast.floatOn : T.toast.floatOff, 'ok');
    });
  }
  if (refs.mouseAdvance) {
    refs.mouseAdvance.addEventListener('change', () => pushSettings({ mouseAdvance: refs.mouseAdvance.checked }));
  }

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
      if (!radio.checked) return;
      const colors = THEME_COLORS[radio.value] || THEME_COLORS.dark;
      pushSettings({ theme: radio.value, textColor: colors.text, bgColor: colors.bg });
    });
  }

  for (const radio of refs.copyFormat) {
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      pushSettings({ copyFormat: radio.value });
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

/** 把设置应用到 DOM（主题、经文样式、背景图、阴影、音乐）。 */
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
  root.style.setProperty('--stage-shadow', s.textShadow
    ? `${s.shadowOffset}px ${s.shadowOffset}px ${s.shadowBlur}px ${s.shadowColor}`
    : 'none');
  // 标题字体 / 标题颜色 / 节号颜色 / 四边留白
  root.style.setProperty('--title-font', s.titleFontFamily
    ? `"${s.titleFontFamily}", var(--font-display)`
    : 'var(--font-display)');
  root.style.setProperty('--title-color', s.titleColor || 'var(--stage-color)');
  root.style.setProperty('--verse-no-color', s.verseNumberColor || 'var(--gold)');
  // 当前节高亮颜色（留空＝跟随主题金色：直接移除变量，让 CSS 回退到 var(--gold)）
  if (s.currentVerseColor) root.style.setProperty('--current-verse-color', s.currentVerseColor);
  else root.style.removeProperty('--current-verse-color');
  root.style.setProperty('--stage-pad', `${Math.max(0, Math.round(Number(s.padding) || 0))}px`);

  const verses = $('#verses');
  if (verses) {
    verses.style.fontStyle = s.italic ? 'italic' : 'normal';
    verses.style.textDecoration = s.underline ? 'underline' : 'none';
    verses.style.textShadow = s.textShadow
      ? `${s.shadowOffset}px ${s.shadowOffset}px ${s.shadowBlur}px ${s.shadowColor}`
      : 'none';
  }

  const stage = $('#stage');
  if (stage) {
    const url = s.bgImage ? toFileUrl(s.bgImage) : '';
    stage.style.backgroundImage = url ? cssUrl(url) : 'none';
    stage.style.backgroundSize = 'cover';
    stage.style.backgroundPosition = 'center';
    stage.style.backgroundRepeat = 'no-repeat';
    if (url) verifyImage(url);
  }

  applyBgm(s);
  syncInputs();
}

function verifyImage(url) {
  const img = new Image();
  img.onerror = () => toast(T.settings.bgImageFailed, 'error');
  img.src = url;
}

/** 取色器 / 输入框失焦，避免焦点滞留导致全局快捷键失效。 */
function blurInput(node) {
  if (node && typeof node.blur === 'function') node.blur();
}

/** 当前主题的强调色（节号默认色）。 */
function accentColor() {
  const value = getComputedStyle(document.documentElement).getPropertyValue('--gold');
  return String(value || '').trim() || '#d8a648';
}

/**
 * 绑定「可跟随默认」的颜色控件。
 * 颜色值存为空字符串时表示跟随主题（正文色 / 强调色）。
 */
function bindColor(input, hexOut, resetBtn, key, fallback) {
  if (!input) return;
  input.addEventListener('input', () => {
    if (hexOut) hexOut.textContent = input.value;
    pushDebounced({ [key]: input.value });
  });
  input.addEventListener('change', () => blurInput(input));
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (hexOut) hexOut.textContent = '';
      pushSettings({ [key]: '' });
    });
  }
  const fill = () => {
    const current = String(state.settings[key] || '');
    if (document.activeElement !== input) input.value = current || fallback();
    if (hexOut) hexOut.textContent = current || '';
  };
  fill();
  bus.on('settings', fill);
}

/** Ctrl+D：切换经文字体（按预设字体轮换）。 */
export async function cycleFont() {
  const presets = T.settings.fontPresets || [];
  if (!presets.length) return;
  const current = String(state.settings.fontFamily || '');
  let index = presets.indexOf(current);
  index = index >= 0 ? (index + 1) % presets.length : 0;
  const next = presets[index];
  await pushSettings({ fontFamily: next });
  toast(`${T.settings.fontFamily || '字体'}：${next}`, 'ok', 1400);
}

/** 控件回填（外部改动设置时同步）。 */
export function syncInputs() {
  const s = state.settings;
  if (!refs.font) return;

  if (document.activeElement !== refs.font) refs.font.value = s.fontFamily;
  if (refs.titleFont && document.activeElement !== refs.titleFont) refs.titleFont.value = s.titleFontFamily || '';
  if (refs.titleColor) {
    if (document.activeElement !== refs.titleColor) refs.titleColor.value = s.titleColor || s.textColor;
    if (refs.titleColorHex) refs.titleColorHex.textContent = s.titleColor || '';
  }
  if (refs.verseColor) {
    if (document.activeElement !== refs.verseColor) refs.verseColor.value = s.verseNumberColor || accentColor();
    if (refs.verseColorHex) refs.verseColorHex.textContent = s.verseNumberColor || '';
  }
  if (refs.padding && document.activeElement !== refs.padding) refs.padding.value = String(s.padding);
  if (refs.paddingOut) refs.paddingOut.textContent = String(s.padding);
  if (document.activeElement !== refs.size) refs.size.value = String(s.fontSize);
  refs.sizeOut.textContent = String(s.fontSize);
  if (document.activeElement !== refs.line) refs.line.value = String(s.lineHeight);
  refs.lineOut.textContent = Number(s.lineHeight).toFixed(2);
  if (document.activeElement !== refs.color) refs.color.value = s.textColor;
  refs.colorHex.textContent = s.textColor;
  if (document.activeElement !== refs.bg) refs.bg.value = s.bgColor;
  refs.bgHex.textContent = s.bgColor;
  if (document.activeElement !== refs.bgImage) refs.bgImage.value = s.bgImage;
  if (refs.shadow) refs.shadow.checked = !!s.textShadow;
  if (document.activeElement !== refs.shadowColor) refs.shadowColor.value = s.shadowColor;
  if (refs.shadowHex) refs.shadowHex.textContent = s.shadowColor;
  if (document.activeElement !== refs.shadowBlur) refs.shadowBlur.value = String(s.shadowBlur);
  if (refs.shadowBlurOut) refs.shadowBlurOut.textContent = String(s.shadowBlur);
  if (document.activeElement !== refs.shadowOffset) refs.shadowOffset.value = String(s.shadowOffset);
  if (refs.shadowOffsetOut) refs.shadowOffsetOut.textContent = String(s.shadowOffset);
  if (document.activeElement !== refs.bgmPath) refs.bgmPath.value = s.bgmPath;
  if (document.activeElement !== refs.bgmVolume) refs.bgmVolume.value = String(s.bgmVolume);
  if (refs.bgmVolumeOut) refs.bgmVolumeOut.textContent = String(s.bgmVolume);
  if (refs.bgmLoop) refs.bgmLoop.checked = s.bgmLoop !== false;
  if (document.activeElement !== refs.slideshow) refs.slideshow.value = String(s.slideshowInterval);
  if (refs.floatPanel) refs.floatPanel.checked = !!s.floatPanel;
  if (refs.mouseAdvance) refs.mouseAdvance.checked = s.mouseAdvance !== false;
  refs.italic.checked = !!s.italic;
  refs.underline.checked = !!s.underline;
  refs.notes.checked = !!s.showNotes;
  if (document.activeElement !== refs.vpp) refs.vpp.value = String(s.versesPerPage);
  for (const radio of refs.theme) radio.checked = radio.value === s.theme;
  for (const radio of refs.copyFormat) radio.checked = radio.value === (s.copyFormat || 'text');
}
