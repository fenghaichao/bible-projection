'use strict';

const { app, BrowserWindow, ipcMain, clipboard, shell, Menu, dialog } = require('electron');
const path = require('path');
const { JsonStore } = require('./store');
const bible = require('./bible');
const versions = require('./versions');

const DEFAULT_SETTINGS = {
  fontFamily: '微软雅黑',
  fontSize: 48,
  lineHeight: 1.8,
  textColor: '#f5f5f5',
  bgColor: '#101014',
  bgImage: '',
  italic: false,
  underline: false,
  showNotes: false,
  versesPerPage: 1,
  // 当前译本：simplified=和合本(简) / traditional=和合本(繁)，其余为用户安装的译本 id
  version: 'simplified',
  traditional: false,
  theme: 'dark',
  // 文字阴影（原版功能 5）
  textShadow: false,
  shadowColor: '#000000',
  shadowBlur: 10,
  shadowOffset: 2,
  // 背景音乐（无声版无语音，但可放背景音乐）
  bgmPath: '',
  bgmVolume: 50,
  // 幻灯放映：每 N 秒自动翻一节，0 = 关闭
  slideshowInterval: 0,
  // 浮动控制面板
  floatPanel: false,
  // 标题/节号/缩进（与渲染层 state.js 字段名保持一致）
  titleFontFamily: '',
  titleColor: '',
  verseNumberColor: '',
  // 当前节高亮颜色：空字符串＝跟随主题强调色
  currentVerseColor: '',
  padding: 0,
  // 复制经文格式：text=连排 / section=分节 / line=分节分行（带节号）
  copyFormat: 'text',
};

let mainWindow = null;
let floatWindow = null;
let settingsStore = null;
let historyStore = null;
let savedStore = null;
let annotationsStore = null;

function createStores() {
  const dir = app.getPath('userData');
  settingsStore = new JsonStore(path.join(dir, 'settings.json'), DEFAULT_SETTINGS);
  historyStore = new JsonStore(path.join(dir, 'history.json'), { items: [] });
  savedStore = new JsonStore(path.join(dir, 'saved.json'), { items: [] });
  // 画笔标注：按 "书卷:章" 存放笔迹，重启后可恢复
  annotationsStore = new JsonStore(path.join(dir, 'annotations.json'), { items: {} });
}

function currentVersion() {
  const settings = settingsStore.get();
  // 兼容旧设置：没有 version 但有 traditional 时按繁体处理
  if (!settings.version) return settings.traditional ? 'traditional' : 'simplified';
  // 译本文件缺失（例如被用户删除）时回落到内置和合本，避免整页空白
  if (!versions.isInstalled(settings.version)) return 'simplified';
  return settings.version;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1000,
    minHeight: 620,
    backgroundColor: settingsStore.get().bgColor || '#101014',
    title: '圣经投影',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
      // 投影/放映时窗口常被遮挡或放到副屏：关闭后台节流，
      // 否则 Chromium 会把渲染进程的 rAF/定时器降到 1Hz，翻节的智能滚动会停摆。
      backgroundThrottling: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
  // 兜底：个别环境不触发 ready-to-show，页面加载完成后仍然把窗口显示出来
  mainWindow.webContents.once('did-finish-load', () => {
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) mainWindow.show();
    }, 1000);
  });
  mainWindow.on('closed', () => { mainWindow = null; });

  // 系统级全屏切换（Win+↓ / F11）也通知渲染层，避免投影模式外观不同步
  const sendFullscreen = (flag) => {
    if (!mainWindow.isDestroyed()) mainWindow.webContents.send('fullscreen-changed', flag);
  };
  mainWindow.on('enter-full-screen', () => sendFullscreen(true));
  mainWindow.on('leave-full-screen', () => sendFullscreen(false));

  // F5 在 Electron 里默认是「重新加载窗口」的原生菜单快捷键，
  // 渲染层的 preventDefault 拦不住它，会导致投影模式被重载掉。
  // 这里在按键到达页面之前拦下 F5，转发给渲染层处理（切换投影模式）。
  // 同理拦下 Ctrl+R / Ctrl+Shift+R：投影或标注进行中重载窗口会丢失状态。
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const key = input.key || '';

    if (key === 'F5') {
      event.preventDefault();
      mainWindow.webContents.send('bible:shortcut', {
        key: 'F5',
        code: input.code || 'F5',
        control: false,
        meta: false,
        shift: false,
        alt: false,
      });
      return;
    }

    // Ctrl+R / Ctrl+Shift+R：禁止重载（菜单里「重新加载」仍可手动点击）
    if ((key === 'r' || key === 'R') && (input.control || input.meta)) {
      event.preventDefault();
    }
  });

  // 外部链接交给系统浏览器
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // 开发模式：electron . --dev 时自动打开开发者工具
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

/**
 * 浮动控制面板：投影时浮在屏幕上方的小控制条（原版功能 7「浮动面板控制」）。
 * 与主窗口通过 IPC 双向通信：
 *   主窗口 → 面板：'bible:float-state'
 *   面板 → 主窗口：'bible:float-command'
 */
function createFloatWindow() {
  if (floatWindow && !floatWindow.isDestroyed()) {
    floatWindow.show();
    floatWindow.focus();
    return floatWindow;
  }

  floatWindow = new BrowserWindow({
    width: 260,
    height: 96,
    frame: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    transparent: true,
    backgroundColor: '#00000000',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  });

  floatWindow.loadFile(path.join(__dirname, '..', 'renderer', 'float.html'));
  floatWindow.once('ready-to-show', () => floatWindow.show());
  floatWindow.on('closed', () => {
    floatWindow = null;
    if (settingsStore) settingsStore.set({ floatPanel: false });
  });

  // 面板上的按钮 → 转发给主窗口
  return floatWindow;
}

function sendToFloat(channel, payload) {
  if (floatWindow && !floatWindow.isDestroyed()) {
    floatWindow.webContents.send(channel, payload);
  }
}

function buildMenu() {
  const template = [
    {
      label: '文件',
      submenu: [{ role: 'quit', label: '退出' }],
    },
    {
      label: '视图',
      submenu: [
        // 重新加载不占用快捷键：Ctrl+R 会重载窗口、丢失投影/标注状态
        // （主进程 before-input-event 也会拦截 Ctrl+R 兜底）
        { role: 'reload', label: '重新加载', accelerator: '' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        // 缩放三项不占用快捷键：Ctrl+0 / Ctrl+= / Ctrl+- 留给渲染层的字号调节
        { role: 'resetZoom', label: '实际大小', accelerator: '' },
        { role: 'zoomIn', label: '放大', accelerator: '' },
        { role: 'zoomOut', label: '缩小', accelerator: '' },
        { role: 'togglefullscreen', label: '全屏' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function registerIpc() {
  /** 数据访问出错时不让渲染进程崩溃，返回空结果 */
  function safe(fn, fallback) {
    try {
      return fn();
    } catch (err) {
      console.error('[ipc] 数据读取失败:', err.message);
      return fallback;
    }
  }

  ipcMain.handle('bible:getBooks', () => bible.getBooks());

  // 第三个参数 version 可选：不传＝当前译本；多版本对照时各栏用各自的译本取数
  ipcMain.handle('bible:getChapter', (_e, bookId, chapter, version) =>
    safe(() => bible.getChapter(Number(bookId), Number(chapter), version || currentVersion()), []));

  ipcMain.handle('bible:getRange', (_e, bookId, from, to, version) =>
    safe(() => bible.getRange(Number(bookId), from, to, version || currentVersion()), []));

  ipcMain.handle('bible:search', (_e, payload) => safe(() => bible.search(payload || {}, currentVersion()), []));

  ipcMain.handle('bible:getSettings', () => settingsStore.get());

  ipcMain.handle('bible:setSettings', (_e, patch) => {
    const merged = settingsStore.set(patch || {});
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('settings-changed', merged);
    }
    return merged;
  });

  ipcMain.handle('bible:getHistory', () => historyStore.get().items || []);

  ipcMain.handle('bible:addHistory', (_e, entry) => {
    const store = historyStore.get();
    const items = store.items || [];
    const key = `${entry.bookId}:${entry.chapter}:${entry.verse}`;
    const filtered = items.filter((it) => `${it.bookId}:${it.chapter}:${it.verse}` !== key);
    filtered.unshift({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      bookId: Number(entry.bookId),
      chapter: Number(entry.chapter),
      verse: Number(entry.verse),
      label: entry.label || '',
      at: new Date().toISOString(),
    });
    historyStore.set({ items: filtered.slice(0, 200) });
    return historyStore.get().items;
  });

  ipcMain.handle('bible:clearHistory', () => {
    historyStore.set({ items: [] });
    return [];
  });

  ipcMain.handle('bible:getSaved', () => savedStore.get().items || []);

  ipcMain.handle('bible:saveVerse', (_e, entry) => {
    const store = savedStore.get();
    const items = store.items || [];
    const key = `${entry.bookId}:${entry.chapter}:${entry.verse}`;
    if (!items.some((it) => `${it.bookId}:${it.chapter}:${it.verse}` === key)) {
      items.unshift({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        bookId: Number(entry.bookId),
        chapter: Number(entry.chapter),
        verse: Number(entry.verse),
        label: entry.label || '',
        at: new Date().toISOString(),
      });
      savedStore.set({ items: items.slice(0, 500) });
    }
    return savedStore.get().items;
  });

  ipcMain.handle('bible:removeSaved', (_e, id) => {
    const items = (savedStore.get().items || []).filter((it) => it.id !== id);
    savedStore.set({ items });
    return items;
  });

  ipcMain.handle('bible:copyText', (_e, text) => {
    try {
      clipboard.writeText(String(text || ''));
      return true;
    } catch (err) {
      console.error('[ipc] 复制失败:', err.message);
      return false;
    }
  });

  ipcMain.handle('bible:setFullscreen', (_e, flag) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setFullScreen(Boolean(flag));
    }
    return Boolean(flag);
  });

  ipcMain.handle('bible:openExternal', (_e, url) => {
    if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
      shell.openExternal(url);
      return true;
    }
    return false;
  });

  ipcMain.handle('bible:appVersion', () => app.getVersion());

  // ---- 译本管理 ----
  ipcMain.handle('bible:listVersions', () => versions.listVersions());

  ipcMain.handle('bible:installVersion', async (_e, id) => {
    try {
      const res = await versions.installVersion(String(id || ''), {
        onProgress: (info) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('bible:version-progress', info);
          }
        },
      });
      if (res.ok && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('bible:versions-changed', versions.listVersions());
      }
      return res;
    } catch (err) {
      console.error('[ipc] 安装译本失败:', err.message);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('bible:importVersionFile', async () => {
    const res = await dialog.showOpenDialog(mainWindow, {
      title: '导入译本数据文件',
      properties: ['openFile'],
      filters: [{ name: '译本数据 (JSON)', extensions: ['json'] }],
    });
    if (res.canceled || !res.filePaths.length) return { ok: false, canceled: true };
    try {
      const out = versions.importVersionFile(res.filePaths[0]);
      if (out.ok && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('bible:versions-changed', versions.listVersions());
      }
      return out;
    } catch (err) {
      console.error('[ipc] 导入译本失败:', err.message);
      return { ok: false, error: err.message };
    }
  });

  // ---- 文件选择（背景图 / 背景音乐） ----
  ipcMain.handle('bible:pickImage', async () => {
    const res = await dialog.showOpenDialog(mainWindow, {
      title: '选择背景图',
      properties: ['openFile'],
      filters: [{ name: '图片', extensions: ['jpg', 'jpeg', 'png', 'bmp', 'gif', 'webp'] }],
    });
    return res.canceled || !res.filePaths.length ? null : res.filePaths[0];
  });

  ipcMain.handle('bible:pickAudio', async () => {
    const res = await dialog.showOpenDialog(mainWindow, {
      title: '选择背景音乐',
      properties: ['openFile'],
      filters: [{ name: '音频', extensions: ['mp3', 'wav', 'm4a', 'flac', 'ogg', 'aac'] }],
    });
    return res.canceled || !res.filePaths.length ? null : res.filePaths[0];
  });

  // ---- 画笔标注持久化（按 书卷:章 保存笔迹） ----
  ipcMain.handle('bible:getAnnotations', (_e, key) => {
    const items = annotationsStore.get().items || {};
    const strokes = items[String(key || '')];
    return Array.isArray(strokes) ? strokes : [];
  });

  ipcMain.handle('bible:saveAnnotations', (_e, key, strokes) => {
    const store = annotationsStore.get();
    const items = store.items || {};
    const k = String(key || '');
    if (!k) return null;
    if (!strokes || !Array.isArray(strokes) || !strokes.length) delete items[k];
    else items[k] = strokes;
    annotationsStore.set({ items });
    return Array.isArray(items[k]) ? items[k] : [];
  });

  // ---- 浮动控制面板 ----
  ipcMain.handle('bible:toggleFloatPanel', (_e, visible) => {
    if (visible === false) {
      if (floatWindow && !floatWindow.isDestroyed()) floatWindow.close();
      return false;
    }
    createFloatWindow();
    settingsStore.set({ floatPanel: true });
    return true;
  });

  // 主窗口 → 面板
  ipcMain.handle('bible:floatState', (_e, payload) => {
    sendToFloat('bible:float-state', payload || {});
    return true;
  });

  // 面板 → 主窗口
  ipcMain.handle('bible:floatCommand', (_e, payload) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('bible:float-command', payload || {});
    }
    return true;
  });
}

app.whenReady().then(() => {
  createStores();
  registerIpc();
  buildMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
