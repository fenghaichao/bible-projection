// js/toast.js — 轻量提示条

import { el, $ } from './util.js';

const MAX = 4;
let host = null;

function ensureHost() {
  if (!host) host = $('#toast-host');
  return host;
}

/**
 * @param {string} message
 * @param {'info'|'ok'|'error'} type
 * @param {number} ms
 */
export function toast(message, type = 'info', ms = 2600) {
  const root = ensureHost();
  if (!root || !message) return;

  const node = el('div', {
    class: `toast${type === 'error' ? ' is-error' : ''}`,
    text: String(message),
  });
  root.appendChild(node);

  while (root.childElementCount > MAX) root.removeChild(root.firstElementChild);

  setTimeout(() => {
    node.classList.add('is-out');
    setTimeout(() => node.remove(), 320);
  }, ms);
}
