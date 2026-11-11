// js/app.js — 启动引导：装配各模块、载入设置与书卷

import { $, bus } from './util.js';
import { ipc, bridgeMissing } from './bridge.js';
import { mergeSettings, state } from './state.js';
import { T, applyI18n } from './i18n.js';
import { toast } from './toast.js';
import { initStage, goToVerse } from './stage.js';
import { initSidebar, loadBooks } from './sidebar.js';
import { applySettings, initSettings, pushSettings } from './settings.js';
import { initPanels } from './panels.js';
import { initSearch } from './panel-search.js';
import { initLibrary } from './panel-library.js';
import { initHelp } from './panel-help.js';
import { initProjection, toggleSlideshowPause } from './projection.js';
import { initDraw } from './draw.js';
import { initShortcuts } from './shortcuts.js';
import { initLetterbar } from './letterbar.js';
import { initBgm } from './bgm.js';
import { initSlideshow } from './slideshow.js';
import { initContextMenu } from './contextmenu.js';
import { initFloatLink } from './floatlink.js';
import { initVersions, refreshVersionList } from './panel-versions.js';
import { initCompare } from './compare.js';
import { clearChapterCache } from './version.js';

/** 全局兜底：任何未捕获异常都要给出提示，避免「白屏无提示」。 */
function reportRuntimeError(message, err) {
  console.error('[renderer]', message, err);
  try {
    toast(T.toast.runtimeError(message), 'error', 8000);
  } catch {
    /* toast 不可用时忽略 */
  }
}

window.addEventListener('error', (event) => {
  reportRuntimeError(event.message || String(event.error || '未知错误'), event.error);
});
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  reportRuntimeError(reason && reason.message ? reason.message : String(reason || '未知错误'), reason);
});

async function boot() {
  try {
    await start();
  } catch (err) {
    console.error('[renderer] boot failed', err);
    toast(T.toast.bootFailed(err && err.message ? err.message : String(err)), 'error', 10000);
  }
}

async function start() {
  applyI18n(document);

  initStage();
  initSidebar();
  initSettings();
  initPanels();
  initSearch();
  initLibrary();
  initHelp();
  initProjection();
  initDraw();
  initShortcuts();
  initLetterbar();
  initBgm();
  initSlideshow();
  initContextMenu();
  initFloatLink();
  initVersions();
  initCompare();

  bindStageControls();

  if (bridgeMissing) toast(T.toast.noBridge, 'error', 8000);

  // 设置
  const raw = await ipc.getSettings();
  state.settings = mergeSettings(raw);
  applySettings(state.settings);

  ipc.onSettingsChanged((next) => {
    if (!next) return;
    const prevVersion = state.settings ? state.settings.version : null;
    state.settings = mergeSettings(next);
    applySettings(state.settings);
    bus.emit('settings', state.settings);
    // 译本在别处被改动（另一个窗口 / 主进程）：清缓存并重载当前章
    if (prevVersion && state.settings.version && prevVersion !== state.settings.version) {
      clearChapterCache();
      const { bookId, chapter, verse } = state.current;
      if (bookId) goToVerse(bookId, chapter, verse, { record: false });
    }
  });

  // 书卷
  await loadBooks();
  // 调试钩子：供自动化探针确认书卷已加载
  try {
    window.__state_books = state.books.length;
  } catch {
    /* 忽略 */
  }

  // 初始位置：静默跳转（侧栏保持「分类 → 书卷」总览），且不写入阅读历史
  const first = state.books[0];
  if (first) {
    await goToVerse(first.id, 1, 1, { silent: true, record: false });
  }

  // 译本列表（顶栏下拉框 + 获取译本面板）
  await refreshVersionList();
}

function bindStageControls() {
  const slideshowToggle = $('#slideshow-toggle');
  if (slideshowToggle) slideshowToggle.addEventListener('click', toggleSlideshowPause);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
