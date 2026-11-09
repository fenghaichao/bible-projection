// js/app.js — 启动引导：装配各模块、载入设置与书卷

import { $, bus } from './util.js';
import { ipc, bridgeMissing } from './bridge.js';
import { mergeSettings, state } from './state.js';
import { T } from './i18n.js';
import { toast } from './toast.js';
import { initStage, goToVerse } from './stage.js';
import { initSidebar, loadBooks } from './sidebar.js';
import { applySettings, initSettings, pushSettings } from './settings.js';
import { initPanels } from './panels.js';
import { initSearch } from './panel-search.js';
import { initLibrary } from './panel-library.js';
import { initHelp } from './panel-help.js';
import { initProjection } from './projection.js';
import { initDraw } from './draw.js';
import { initShortcuts } from './shortcuts.js';

async function boot() {
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

  bindTopbar();

  if (bridgeMissing) toast(T.toast.noBridge, 'error', 8000);

  // 设置
  const raw = await ipc.getSettings();
  state.settings = mergeSettings(raw);
  applySettings(state.settings);

  ipc.onSettingsChanged((next) => {
    if (!next) return;
    state.settings = mergeSettings(next);
    applySettings(state.settings);
    bus.emit('settings', state.settings);
  });

  // 书卷
  await loadBooks();

  // 初始位置（静默：侧栏保持在「分类 → 书卷」总览）
  const first = state.books[0];
  if (first) {
    await goToVerse(first.id, 1, 1, { silent: true });
  }
}

function bindTopbar() {
  const lang = $('#btn-lang');
  if (lang) {
    lang.addEventListener('click', async () => {
      const next = !state.settings.traditional;
      const merged = await ipc.setSettings({ traditional: next });
      if (!merged) return;
      state.settings = mergeSettings(merged);
      // 简繁切换后需重新拉取经文
      state.chapterCache.clear();
      applySettings(state.settings);
      bus.emit('settings', state.settings);
      const { bookId, chapter, verse } = state.current;
      if (bookId) await goToVerse(bookId, chapter, verse, { record: false });
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
