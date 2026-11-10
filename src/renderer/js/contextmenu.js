// js/contextmenu.js — 显示区右键菜单（对齐原版 5.20 SP2 实际菜单结构）
//
// 原版 5.20 SP2 实测顺序（截屏取证）：
//   全屏显示_F5 / 复制 ▸ / 播放进度 ▸ / 显示当前经文 / ─── /
//   打开画笔_Ctrl+P / 画笔颜色 ▸ / 画笔粗细 ▸ / 白色画笔_Ctrl+B / 橡皮擦_E /
//   清除画笔_Ctrl+E / ─── / 扩展桌面_F9
//   复制子菜单：复制经文_Ctrl+C / 复制经文(分节) / 复制经文(分节分行) / 复制章节_Alt+C

import { $, el } from './util.js';
import { state } from './state.js';
import { T } from './i18n.js';
import { toast } from './toast.js';
import { copyTextVariant, copyTitleOnly, toggleHideVerses } from './stage.js';
import { enterProjection } from './projection.js';
import * as slideshow from './slideshow.js';
import {
  DRAW_COLORS,
  DRAW_WIDTHS,
  clearDraw,
  setDrawColor,
  setDrawWidth,
  toggleDraw,
  toggleEraser,
} from './draw.js';
import { pushSettings } from './settings.js';

let menu = null;
const submenus = [];

export function initContextMenu() {
  menu = $('#ctx-menu');
  if (!menu) return;

  document.addEventListener('contextmenu', onContextMenu);
  document.addEventListener('click', (event) => {
    if (!menu || menu.hidden) return;
    if (menu.contains(event.target)) return;
    hideMenu();
  });
  // 鼠标完全离开菜单时才收起子菜单（面板是菜单的子节点，移入面板不会触发这里）
  menu.addEventListener('mouseleave', () => {
    submenus.forEach((panel) => panel.classList.remove('is-open'));
  });
  window.addEventListener('blur', hideMenu);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menu && !menu.hidden) {
      hideMenu();
      event.stopPropagation();
    }
  }, true);
}

function onContextMenu(event) {
  const stage = $('#stage');
  if (!stage || !menu) return;
  if (!stage.contains(event.target)) return;
  event.preventDefault();
  buildMenu();
  menu.hidden = false;
  positionMenu(event.clientX, event.clientY);
}

function positionMenu(x, y) {
  if (!menu) return;
  menu.style.left = '0px';
  menu.style.top = '0px';
  const rect = menu.getBoundingClientRect();
  const left = Math.min(x, window.innerWidth - rect.width - 8);
  const top = Math.min(y, window.innerHeight - rect.height - 8);
  menu.style.left = `${Math.max(8, left)}px`;
  menu.style.top = `${Math.max(8, top)}px`;
}

/** 画笔类操作只在投影模式下可用：先进入投影再执行。 */
async function withProjection(action) {
  if (!state.projection) await enterProjection();
  await action();
}

function buildMenu() {
  if (!menu) return;
  menu.textContent = '';
  submenus.length = 0;

  menu.appendChild(menuItem(T.ctx.fullscreen, () => {
    hideMenu();
    enterProjection();
  }));

  // 复制 ▸（原版 F085：复制经文 / 分节 / 分节分行 / 复制章节）
  appendSubmenu(T.ctx.copy, [
    [T.ctx.copyPlain, () => { hideMenu(); copyTextVariant('plain'); }],
    [T.ctx.copyNumbered, () => { hideMenu(); copyTextVariant('numbered'); }],
    [T.ctx.copyLines, () => { hideMenu(); copyTextVariant('lines'); }],
    [T.ctx.copyTitle, () => { hideMenu(); copyTitleOnly(); }],
  ]);

  // 播放进度 ▸（原版此处的朗读进度；无声版无语音，对应本版的自动翻页控制）
  appendSubmenu(T.ctx.playProgress, [
    [T.ctx.playPause, () => { hideMenu(); slideshow.pause(); }],
    [T.ctx.playResume, () => { hideMenu(); slideshow.resume(); }],
    [T.ctx.playStop, () => { hideMenu(); slideshow.stop(); }],
  ]);

  menu.appendChild(menuItem(state.hideVerses ? T.ctx.showVerses : T.ctx.hideVerses, () => {
    hideMenu();
    toggleHideVerses();
  }));

  menu.appendChild(el('div', { class: 'ctx-sep' }));

  menu.appendChild(menuItem(T.ctx.openPen, async () => {
    hideMenu();
    await withProjection(() => toggleDraw());
  }));

  appendSubmenu(T.ctx.penColor, DRAW_COLORS.map((c) => [
    T.ctx.colors[c.key] || c.key,
    () => { hideMenu(); withProjection(() => setDrawColor(c.key)); },
  ]));

  appendSubmenu(T.ctx.penWidth, DRAW_WIDTHS.map((w, index) => [
    `${T.ctx.widths[w] || w}（${w}）`,
    () => { hideMenu(); withProjection(() => setDrawWidth(index)); },
  ]));

  menu.appendChild(menuItem(T.ctx.whitePen, async () => {
    hideMenu();
    await withProjection(() => setDrawColor('W'));
  }));

  menu.appendChild(menuItem(T.ctx.eraser, async () => {
    hideMenu();
    await withProjection(() => toggleEraser());
  }));

  menu.appendChild(menuItem(T.ctx.clearPen, async () => {
    hideMenu();
    await withProjection(() => clearDraw());
  }));

  menu.appendChild(el('div', { class: 'ctx-sep' }));

  menu.appendChild(menuItem(T.ctx.extendDesktop, () => {
    hideMenu();
    toast(T.ctx.extendDesktopTip, 'info', 2600);
  }));

  // 本版额外项（原版没有，但方便切换主题）
  appendSubmenu(T.ctx.theme, [
    [T.ctx.themeDark, () => { hideMenu(); pushSettings({ theme: 'dark' }); }],
    [T.ctx.themeLight, () => { hideMenu(); pushSettings({ theme: 'light' }); }],
  ]);
}

/** 追加一个带子菜单的条目（悬停展开，鼠标可直接移入子菜单）。 */
function appendSubmenu(label, entries) {
  const item = el('div', { class: 'ctx-item ctx-sub' }, [
    el('span', { class: 'ctx-label', text: label }),
    el('span', { class: 'ctx-arrow', text: '▸' }),
  ]);
  const panel = el('div', { class: 'ctx-submenu' },
    entries.map(([text, onClick]) => menuItem(text, onClick)));
  // 子菜单面板是菜单的 DOM 子节点：鼠标从父项移入面板不会触发菜单的 mouseleave，
  // 因此不能在父项的 mouseleave 里关闭面板（旧版就是这里导致「鼠标移不进子菜单」）。
  const open = () => {
    submenus.forEach((p) => p.classList.remove('is-open'));
    panel.classList.add('is-open');
    positionPanel(item, panel);
  };
  item.addEventListener('mouseenter', open);
  item.addEventListener('click', (event) => {
    event.stopPropagation();
    open();
  });
  panel.addEventListener('mouseenter', () => panel.classList.add('is-open'));
  menu.appendChild(item);
  menu.appendChild(panel);
  submenus.push(panel);
}

/** 子菜单贴着父项对齐；右侧放不下时翻到菜单左边。 */
function positionPanel(item, panel) {
  if (!menu) return;
  panel.style.left = '100%';
  panel.style.right = 'auto';
  panel.style.top = `${item.offsetTop}px`;
  const menuRect = menu.getBoundingClientRect();
  const panelWidth = panel.getBoundingClientRect().width || 168;
  if (menuRect.right + panelWidth > window.innerWidth - 8) {
    panel.style.left = 'auto';
    panel.style.right = '100%';
  }
}

function menuItem(label, onClick) {
  const item = el('button', { class: 'ctx-item', type: 'button', text: label });
  item.addEventListener('click', (event) => {
    event.stopPropagation();
    onClick();
  });
  return item;
}

export function hideMenu() {
  if (menu) menu.hidden = true;
  submenus.forEach((panel) => panel.classList.remove('is-open'));
}

export function contextMenuOpen() {
  return !!menu && !menu.hidden;
}

export function toastCtx(message) {
  toast(message, 'ok');
}
