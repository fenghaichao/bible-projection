'use strict';

const { app, BrowserWindow, ipcMain, clipboard, shell, Menu } = require('electron');
const path = require('path');
const { JsonStore } = require('./store');
const bible = require('./bible');

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
  traditional: false,
  theme: 'dark',
};

let mainWindow = null;
let settingsStore = null;
let historyStore = null;
let savedStore = null;

function createStores() {
  const dir = app.getPath('userData');
  settingsStore = new JsonStore(path.join(dir, 'settings.json'), DEFAULT_SETTINGS);
  historyStore = new JsonStore(path.join(dir, 'history.json'), { items: [] });
  savedStore = new JsonStore(path.join(dir, 'saved.json'), { items: [] });
}

function currentVersion() {
  return settingsStore.get().traditional ? 'traditional' : 'simplified';
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
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key !== 'F5') return;
    event.preventDefault();
    mainWindow.webContents.send('bible:shortcut', {
      key: 'F5',
      code: input.code || 'F5',
      control: false,
      meta: false,
      shift: false,
      alt: false,
    });
  });

  // 外部链接交给系统浏览器
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
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
        // 显式改绑到 Ctrl+R：F5 要留给应用切换投影模式（见 createWindow 的 before-input-event）
        { role: 'reload', label: '重新加载', accelerator: 'CmdOrCtrl+R' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '实际大小' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
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

  ipcMain.handle('bible:getChapter', (_e, bookId, chapter) =>
    safe(() => bible.getChapter(Number(bookId), Number(chapter), currentVersion()), []));

  ipcMain.handle('bible:getRange', (_e, bookId, from, to) =>
    safe(() => bible.getRange(Number(bookId), from, to, currentVersion()), []));

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
