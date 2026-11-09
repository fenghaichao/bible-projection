// js/contextmenu.js — 显示区右键菜单（对齐原版 5.20：停止播放 / 全屏显示 / 复制▸ / 不显示经文 / 打开画笔 / 主题设置）

import { $, el } from './util.js';
import { state } from './state.js';
import { T } from './i18n.js';
import { toast } from './toast.js';
import { copyTextVariant, copyTitleOnly, toggleHideVerses } from './stage.js';
import { enterProjection } from './projection.js';
import { stop as stopSlideshow } from './slideshow.js';
import { toggleDraw } from './draw.js';
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

/** 原版 5.20 显示区右击菜单条目与顺序：
 *  停止播放_End / 全屏显示_F5 / 复制▸(复制经文_Ctrl+C、复制经文(分节)、复制经文(分节分行)、复制章节_Alt+C)
 *  / [播放进度▸（无声版无朗读，未实现）] / 不显示经文 / ─── / 打开画笔_Ctrl+F / 主题设置▸
 */
function buildMenu() {
  if (!menu) return;
  menu.textContent = '';
  submenus.length = 0;

  menu.appendChild(menuItem(T.ctx.stopPlay, () => {
    hideMenu();
    stopSlideshow();
  }));

  menu.appendChild(menuItem(T.ctx.fullscreen, () => {
    hideMenu();
    enterProjection();
  }));

  // 复制 ▸（原版 F085）
  appendSubmenu(T.ctx.copy, [
    [T.ctx.copyPlain, () => { hideMenu(); copyTextVariant('plain'); }],
    [T.ctx.copyNumbered, () => { hideMenu(); copyTextVariant('numbered'); }],
    [T.ctx.copyLines, () => { hideMenu(); copyTextVariant('lines'); }],
    [T.ctx.copyTitle, () => { hideMenu(); copyTitleOnly(); }],
  ]);

  const hideItem = menuItem(state.hideVerses ? T.ctx.showVerses : T.ctx.hideVerses, () => {
    hideMenu();
    toggleHideVerses();
  });
  menu.appendChild(hideItem);

  menu.appendChild(el('div', { class: 'ctx-sep' }));

  menu.appendChild(menuItem(T.ctx.openPen, async () => {
    hideMenu();
    // 画笔只在投影模式下可用（原版可在普通窗口标注，本版统一到投影模式）
    if (!state.projection) await enterProjection();
    toggleDraw();
  }));

  // 主题设置 ▸（原版此项在 5.20 中为灰态，本版做成可用的深/浅色切换）
  appendSubmenu(T.ctx.theme, [
    [T.ctx.themeDark, () => { hideMenu(); pushSettings({ theme: 'dark' }); }],
    [T.ctx.themeLight, () => { hideMenu(); pushSettings({ theme: 'light' }); }],
  ]);
}

/** 追加一个带子菜单的条目（悬停展开）。 */
function appendSubmenu(label, entries) {
  const item = el('div', { class: 'ctx-item ctx-sub' }, [
    el('span', { class: 'ctx-label', text: label }),
    el('span', { class: 'ctx-arrow', text: '▸' }),
  ]);
  const panel = el('div', { class: 'ctx-submenu' },
    entries.map(([text, onClick]) => menuItem(text, onClick)));
  item.addEventListener('mouseenter', () => panel.classList.add('is-open'));
  item.addEventListener('mouseleave', () => panel.classList.remove('is-open'));
  menu.appendChild(item);
  menu.appendChild(panel);
  submenus.push(panel);
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
