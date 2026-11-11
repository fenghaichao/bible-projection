// js/bridge.js — window.bible 桥接封装（所有特权访问的唯一入口）

import { T } from './i18n.js';
import { toast } from './toast.js';

const real = typeof window !== 'undefined' ? window.bible : null;
const usable = !!(real && typeof real.getBooks === 'function');

/** 无桥接时的替身：保证 UI 仍可渲染，不抛未捕获异常。 */
const stub = {
  getBooks: async () => [],
  getChapter: async () => [],
  getRange: async () => [],
  search: async () => [],
  getHistory: async () => [],
  addHistory: async () => undefined,
  clearHistory: async () => undefined,
  getSaved: async () => [],
  saveVerse: async () => undefined,
  removeSaved: async () => undefined,
  getSettings: async () => ({}),
  setSettings: async (patch) => patch || {},
  copyText: async () => false,
  setFullscreen: async () => false,
  openExternal: async () => false,
  onSettingsChanged: () => () => {},
  onFullscreenChanged: () => () => {},
  onShortcut: () => () => {},
  pickImage: async () => null,
  pickAudio: async () => null,
  getAnnotations: async () => null,
  saveAnnotations: async () => true,
  // 副屏投影
  secondScreenDisplays: async () => [],
  secondScreenOpen: async () => ({ ok: false, error: '未检测到主进程桥接' }),
  secondScreenClose: async () => false,
  secondScreenState: async () => ({ open: false }),
  secondScreenUpdate: async () => false,
  onSecondScreenPayload: () => () => {},
  onSecondScreenRequest: () => () => {},
  onSecondScreenClosed: () => () => {},
  // 译本管理
  listVersions: async () => [],
  installVersion: async () => ({ ok: false, error: '未检测到主进程桥接' }),
  importVersionFile: async () => ({ ok: false, error: '未检测到主进程桥接' }),
  onVersionProgress: () => () => {},
  onVersionsChanged: () => () => {},
};

const backend = usable ? real : stub;

let warned = false;

async function call(name, ...args) {
  if (!usable && !warned) {
    warned = true;
    toast(T.toast.noBridge, 'error', 6000);
  }
  try {
    if (typeof backend[name] !== 'function') throw new Error(`missing ${name}`);
    return await backend[name](...args);
  } catch (err) {
    console.error(`[ipc] ${name} failed`, err);
    toast(T.toast.ipcFailed(name), 'error');
    return null;
  }
}

/** 订阅类方法：出错时静默（由调用方决定提示）。 */
function subscribe(name, handler) {
  if (!usable) return () => {};
  try {
    if (typeof backend[name] !== 'function') return () => {};
    const off = backend[name](handler);
    return typeof off === 'function' ? off : () => {};
  } catch (err) {
    console.error(`[ipc] ${name} subscribe failed`, err);
    return () => {};
  }
}

export const bridgeMissing = !usable;

/** 渲染层实际使用的 IPC 集合（与 preload 契约一一对应）。 */
export const ipc = {
  getBooks: () => call('getBooks'),
  // version 可选：不传＝当前译本；传译本 id＝取该译本的经文（多版本对比用）
  getChapter: (bookId, chapter, version) => call('getChapter', bookId, chapter, version),
  getRange: (bookId, from, to, version) => call('getRange', bookId, from, to, version),
  search: (params) => call('search', params),
  getHistory: () => call('getHistory'),
  addHistory: (entry) => call('addHistory', entry),
  clearHistory: () => call('clearHistory'),
  getSaved: () => call('getSaved'),
  saveVerse: (entry) => call('saveVerse', entry),
  removeSaved: (id) => call('removeSaved', id),
  getSettings: () => call('getSettings'),
  setSettings: (patch) => call('setSettings', patch),
  copyText: (text) => call('copyText', text),
  setFullscreen: (flag) => call('setFullscreen', flag),
  openExternal: (url) => call('openExternal', url),
  onSettingsChanged: (handler) => subscribe('onSettingsChanged', handler),
  onFullscreenChanged: (handler) => subscribe('onFullscreenChanged', handler),
  // 可选通道：主进程拦截 F5 / Ctrl+S 等浏览器级默认后转发快捷键（preload 未提供时自动降级）。
  onShortcut: (handler) => subscribe('onShortcut', handler),
  // 背景图 / 背景音乐选择
  pickImage: () => call('pickImage'),
  pickAudio: () => call('pickAudio'),
  // 画笔标注落盘（key = `${bookId}:${chapter}`）
  getAnnotations: (key) => call('getAnnotations', key),
  saveAnnotations: (key, strokes) => call('saveAnnotations', key, strokes),
  // 译本管理（下载 / 导入 / 进度 / 列表变化）
  listVersions: () => call('listVersions'),
  installVersion: (id) => call('installVersion', id),
  importVersionFile: () => call('importVersionFile'),
  onVersionProgress: (handler) => subscribe('onVersionProgress', handler),
  onVersionsChanged: (handler) => subscribe('onVersionsChanged', handler),
  // 副屏投影（原版 F9「扩展桌面」）
  secondScreenDisplays: () => call('secondScreenDisplays'),
  secondScreenOpen: (displayId) => call('secondScreenOpen', displayId),
  secondScreenClose: () => call('secondScreenClose'),
  secondScreenState: () => call('secondScreenState'),
  secondScreenUpdate: (payload) => call('secondScreenUpdate', payload),
  onSecondScreenPayload: (handler) => subscribe('onSecondScreenPayload', handler),
  onSecondScreenRequest: (handler) => subscribe('onSecondScreenRequest', handler),
  onSecondScreenClosed: (handler) => subscribe('onSecondScreenClosed', handler),
  appVersion: () => call('appVersion'),
};
