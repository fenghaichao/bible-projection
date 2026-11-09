// js/panels.js — 右侧抽屉（查找 / 设置 / 历史 / 收藏 / 帮助）

import { $, $$ } from './util.js';
import { bus } from './util.js';

let current = null;

export function initPanels() {
  for (const btn of $$('[data-open-panel]')) {
    btn.addEventListener('click', () => togglePanel(btn.dataset.openPanel));
  }
  for (const btn of $$('[data-close-panel]')) {
    btn.addEventListener('click', closePanel);
  }
  const scrim = $('#drawer-scrim');
  if (scrim) scrim.addEventListener('click', closePanel);
}

export function openPanel(name) {
  if (!name) return;
  if (current === name) {
    closePanel();
    return;
  }
  current = name;
  for (const panel of $$('.panel')) {
    panel.hidden = panel.id !== `panel-${name}`;
  }
  const drawer = $('#drawer');
  drawer.classList.add('is-open');
  drawer.setAttribute('aria-hidden', 'false');
  document.body.classList.add('drawer-open');
  bus.emit('panel-open', name);
}

export function closePanel() {
  if (!current) return;
  current = null;
  for (const panel of $$('.panel')) {
    panel.hidden = true;
  }
  const drawer = $('#drawer');
  drawer.classList.remove('is-open');
  drawer.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('drawer-open');
  bus.emit('panel-close');
}

export function togglePanel(name) {
  if (current === name) closePanel();
  else openPanel(name);
}

export function isPanelOpen() {
  return current !== null;
}

export function currentPanel() {
  return current;
}
