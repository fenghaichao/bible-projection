'use strict';

const { contextBridge, ipcRenderer } = require('electron');

/**
 * 渲染进程唯一的安全桥。渲染层只能通过这里访问数据与系统能力。
 */
const bible = {
  getBooks: () => ipcRenderer.invoke('bible:getBooks'),
  // version 可选：不传＝当前译本；多版本对照时传各栏自己的译本 id
  getChapter: (bookId, chapter, version) => ipcRenderer.invoke('bible:getChapter', bookId, chapter, version),
  getRange: (bookId, from, to, version) => ipcRenderer.invoke('bible:getRange', bookId, from, to, version),
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

  // 文件选择
  pickImage: () => ipcRenderer.invoke('bible:pickImage'),
  pickAudio: () => ipcRenderer.invoke('bible:pickAudio'),

  // 画笔标注持久化（按 书卷:章）
  getAnnotations: (key) => ipcRenderer.invoke('bible:getAnnotations', key),
  saveAnnotations: (key, strokes) => ipcRenderer.invoke('bible:saveAnnotations', key, strokes),

  // 译本管理
  listVersions: () => ipcRenderer.invoke('bible:listVersions'),
  installVersion: (id) => ipcRenderer.invoke('bible:installVersion', id),
  importVersionFile: () => ipcRenderer.invoke('bible:importVersionFile'),

  // 副屏投影（原版 F9「扩展桌面」）
  secondScreenDisplays: () => ipcRenderer.invoke('bible:secondScreen:displays'),
  secondScreenOpen: (displayId) => ipcRenderer.invoke('bible:secondScreen:open', displayId),
  secondScreenClose: () => ipcRenderer.invoke('bible:secondScreen:close'),
  secondScreenState: () => ipcRenderer.invoke('bible:secondScreen:state'),
  secondScreenUpdate: (payload) => ipcRenderer.invoke('bible:secondScreen:update', payload || {}),

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


  /**
   * 订阅译本下载进度，返回取消订阅函数。
   */
  onVersionProgress: (callback) => {
    const listener = (_event, info) => callback(info || {});
    ipcRenderer.on('bible:version-progress', listener);
    return () => ipcRenderer.removeListener('bible:version-progress', listener);
  },

  /**
   * 订阅译本列表变化（安装/导入完成后触发），返回取消订阅函数。
   */
  onVersionsChanged: (callback) => {
    const listener = (_event, list) => callback(Array.isArray(list) ? list : []);
    ipcRenderer.on('bible:versions-changed', listener);
    return () => ipcRenderer.removeListener('bible:versions-changed', listener);
  },

  /**
   * 订阅副屏投影窗口推送的经文数据，返回取消订阅函数。
   */
  onSecondScreenPayload: (callback) => {
    const listener = (_event, payload) => callback(payload || {});
    ipcRenderer.on('bible:second:payload', listener);
    return () => ipcRenderer.removeListener('bible:second:payload', listener);
  },

  /**
   * 副屏窗口就绪后主进程会来索要一次当前经文，返回取消订阅函数。
   */
  onSecondScreenRequest: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('bible:second:request', listener);
    return () => ipcRenderer.removeListener('bible:second:request', listener);
  },

  /**
   * 副屏窗口被关闭时通知渲染层，返回取消订阅函数。
   */
  onSecondScreenClosed: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('bible:second:closed', listener);
    return () => ipcRenderer.removeListener('bible:second:closed', listener);
  },
};

contextBridge.exposeInMainWorld('bible', bible);
