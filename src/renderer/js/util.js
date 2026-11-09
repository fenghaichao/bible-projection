// js/util.js — DOM 辅助、格式化与极简事件总线

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/**
 * 创建元素。文本一律走 textContent（不使用 innerHTML 注入不可信内容）。
 */
export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = String(value);
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value === true) node.setAttribute(key, '');
    else node.setAttribute(key, String(value));
  }
  const list = Array.isArray(children) ? children : [children];
  for (const child of list) {
    if (child === undefined || child === null || child === false) continue;
    node.appendChild(
      typeof child === 'string' || typeof child === 'number'
        ? document.createTextNode(String(child))
        : child
    );
  }
  return node;
}

export function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return n < min ? min : n > max ? max : n;
}

export function debounce(fn, wait = 200) {
  let timer = null;
  return function debounced(...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn.apply(this, args);
    }, wait);
  };
}

export function throttle(fn, wait = 120) {
  let last = 0;
  let timer = null;
  return function throttled(...args) {
    const now = Date.now();
    const remain = wait - (now - last);
    if (remain <= 0) {
      if (timer) { clearTimeout(timer); timer = null; }
      last = now;
      fn.apply(this, args);
    } else if (!timer) {
      timer = setTimeout(() => {
        timer = null;
        last = Date.now();
        fn.apply(this, args);
      }, remain);
    }
  };
}

/** 焦点是否在输入控件中（快捷键需忽略）。 */
export function isTypingTarget(node) {
  if (!node) return false;
  const tag = (node.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  return node.isContentEditable === true;
}

export function formatTime(ts) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 本机绝对路径 → file:// URL（用于背景图）。 */
export function toFileUrl(input) {
  if (!input) return '';
  let s = String(input).trim().replace(/^"(.*)"$/, '$1');
  if (/^file:\/\//i.test(s)) return s;
  s = s.replace(/\\/g, '/');
  if (/^[a-zA-Z]:\//.test(s)) return `file:///${s}`;
  if (s.startsWith('//')) return `file:${s}`;
  if (s.startsWith('/')) return `file://${s}`;
  return `file:///${s}`;
}

/** 极简事件总线（模块之间解耦）。 */
const listeners = new Map();

export const bus = {
  on(event, handler) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(handler);
    return () => bus.off(event, handler);
  },
  off(event, handler) {
    const set = listeners.get(event);
    if (set) set.delete(handler);
  },
  emit(event, payload) {
    const set = listeners.get(event);
    if (!set) return;
    for (const handler of Array.from(set)) {
      try {
        handler(payload);
      } catch (err) {
        console.error(`[bus] ${event} handler failed`, err);
      }
    }
  },
};
