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

  // 浮动控制面板
  toggleFloatPanel: (visible) => ipcRenderer.invoke('bible:toggleFloatPanel', visible),
  sendFloatState: (payload) => ipcRenderer.invoke('bible:floatState', payload),

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
   * 订阅浮动控制面板的指令（面板按钮 → 主窗口）。
   * 返回取消订阅函数。
   */
  onFloatCommand: (callback) => {
    const listener = (_event, payload) => callback(payload || {});
    ipcRenderer.on('bible:float-command', listener);
    return () => ipcRenderer.removeListener('bible:float-command', listener);
  },

  /**
   * 面板 → 主窗口：发送控制指令（上一节 / 下一节 / 退出投影 / 关闭面板…）。
   * 浮动面板自身调用此方法即可驱动主窗口。
   */
  sendFloatCommand: (payload) => ipcRenderer.invoke('bible:floatCommand', payload || {}),

  /**
   * 订阅主进程推送给浮动面板的状态（当前书卷章节、投影开关等）。
   * 返回取消订阅函数。
   */
  onFloatState: (callback) => {
    const listener = (_event, payload) => callback(payload || {});
    ipcRenderer.on('bible:float-state', listener);
    return () => ipcRenderer.removeListener('bible:float-state', listener);
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
};

contextBridge.exposeInMainWorld('bible', bible);
