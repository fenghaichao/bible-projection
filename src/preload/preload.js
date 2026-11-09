'use strict';

const { contextBridge, ipcRenderer } = require('electron');

/**
 * 渲染进程唯一的安全桥。渲染层只能通过这里访问数据与系统能力。
 */
const bible = {
  getBooks: () => ipcRenderer.invoke('bible:getBooks'),
  getChapter: (bookId, chapter) => ipcRenderer.invoke('bible:getChapter', bookId, chapter),
  getRange: (bookId, from, to) => ipcRenderer.invoke('bible:getRange', bookId, from, to),
  search: (payload) => ipcRenderer.invoke('bible:search', payload),

  getSettings: () => ipcRenderer.invoke('bible:getSettings'),
  setSettings: (patch) => ipcRenderer.invoke('bible:setSettings', patch),

  getHistory: () => ipcRenderer.invoke('bible:getHistory'),
  addHistory: (entry) => ipcRenderer.invoke('bible:addHistory', entry),
  clearHistory: () => ipcRenderer.invoke('bible:clearHistory'),

  getSaved: () => ipcRenderer.invoke('bible:getSaved'),
  saveVerse: (entry) => ipcRenderer.invoke('bible:saveVerse', entry),
  removeSaved: (id) => ipcRenderer.invoke('bible:removeSaved', id),

  copyText: (text) => ipcRenderer.invoke('bible:copyText', text),
  setFullscreen: (flag) => ipcRenderer.invoke('bible:setFullscreen', flag),
  openExternal: (url) => ipcRenderer.invoke('bible:openExternal', url),
  appVersion: () => ipcRenderer.invoke('bible:appVersion'),

  /** 订阅设置变化，返回取消订阅函数 */
  onSettingsChanged: (callback) => {
    const listener = (_event, settings) => callback(settings);
    ipcRenderer.on('settings-changed', listener);
    return () => ipcRenderer.removeListener('settings-changed', listener);
  },

  /** 订阅全屏状态变化（系统级全屏切换也会触发），返回取消订阅函数 */
  onFullscreenChanged: (callback) => {
    const listener = (_event, flag) => callback(Boolean(flag));
    ipcRenderer.on('fullscreen-changed', listener);
    return () => ipcRenderer.removeListener('fullscreen-changed', listener);
  },

  /**
   * 订阅主进程转发的快捷键（F5 等被原生菜单/浏览器默认行为占用的键）。
   * 返回取消订阅函数。
   */
  onShortcut: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('bible:shortcut', listener);
    return () => ipcRenderer.removeListener('bible:shortcut', listener);
  },
};

contextBridge.exposeInMainWorld('bible', bible);
