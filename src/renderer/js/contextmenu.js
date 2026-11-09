// js/contextmenu.js — 显示区右键菜单（复制 ▸ 三种 / 全屏 / 停止播放 / 不显示经文）

import { $, el } from './util.js';
import { state } from './state.js';
import { T } from './i18n.js';
import { toast } from './toast.js';
import { copyTextVariant, toggleHideVerses } from './stage.js';
import { enterProjection } from './projection.js';
import { stop as stopSlideshow } from './slideshow.js';

let menu = null;
let submenu = null;

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

function buildMenu() {
  if (!menu) return;
  menu.textContent = '';

  // 复制 ▸
  const copyItem = el('div', { class: 'ctx-item ctx-sub' }, [
    el('span', { class: 'ctx-label', text: T.ctx.copy }),
    el('span', { class: 'ctx-arrow', text: '▸' }),
  ]);
  submenu = el('div', { class: 'ctx-submenu' }, [
    menuItem(T.ctx.copyPlain, () => copyTextVariant('plain')),
    menuItem(T.ctx.copyNumbered, () => copyTextVariant('numbered')),
    menuItem(T.ctx.copyLines, () => copyTextVariant('lines')),
  ]);
  copyItem.addEventListener('mouseenter', () => {
    if (submenu) submenu.classList.add('is-open');
  });
  copyItem.addEventListener('mouseleave', () => {
    if (submenu) submenu.classList.remove('is-open');
  });
  menu.appendChild(copyItem);
  menu.appendChild(submenu);

  menu.appendChild(menuItem(T.ctx.fullscreen, () => {
    hideMenu();
    enterProjection();
  }));

  menu.appendChild(menuItem(T.ctx.stopPlay, () => {
    hideMenu();
    stopSlideshow();
  }));

  const hideItem = menuItem(state.hideVerses ? T.ctx.showVerses : T.ctx.hideVerses, () => {
    hideMenu();
    toggleHideVerses();
  });
  menu.appendChild(hideItem);
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
  if (submenu) submenu.classList.remove('is-open');
}

export function contextMenuOpen() {
  return !!menu && !menu.hidden;
}

export function toastCtx(message) {
  toast(message, 'ok');
}
