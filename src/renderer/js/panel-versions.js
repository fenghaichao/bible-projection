// js/panel-versions.js — 译本管理：顶栏下拉框 + 「获取译本」面板（下载安装 / 本地导入）
//
// 契约（preload）：
//   listVersions()            → [{ id, name, bundled, installed, copyright, source, fhlVersion }]
//   installVersion(id)        → { ok, verses?, error? }
//   importVersionFile()       → { ok, id?, name?, verses?, error? }
//   onVersionProgress(cb)     → { id, done, total, percent }
//   onVersionsChanged(cb)     → 译本列表变化（安装 / 导入完成后触发）

import { $, bus, el } from './util.js';
import { ipc } from './bridge.js';
import { T } from './i18n.js';
import { toast } from './toast.js';
import { mergeSettings, state } from './state.js';
import { applySettings } from './settings.js';
import { goToVerse } from './stage.js';
import { openPanel, currentPanel } from './panels.js';
import { runSearchWith } from './panel-search.js';
import { currentVersion, clearChapterCache, setFallbackVersion } from './version.js';

/** 后端不可用时的兜底列表（内置和合本简 / 繁）。 */
const FALLBACK_VERSIONS = [
  { id: 'simplified', name: '和合本（简体）', bundled: true, installed: true, copyright: '公共领域', source: '内置' },
  { id: 'traditional', name: '和合本（繁体）', bundled: true, installed: true, copyright: '公共领域', source: '内置' },
];

let refs = {};
let versions = [];
/** id → { percent, done, total } */
const progressMap = new Map();
/** id → true（用户点了「停止跟踪」，不再跟随进度） */
const stopped = new Set();
/** 安装 / 导入完成后要自动切到的译本 id */
let pendingSwitch = null;
let switching = false;

export function initVersions() {
  refs.select = $('#version-select');
  refs.button = $('#btn-versions');
  refs.list = $('#version-list');
  refs.status = $('#versions-status');
  refs.importBtn = $('#versions-import');
  refs.refreshBtn = $('#versions-refresh');

  if (refs.select) {
    refs.select.addEventListener('change', () => onSelectChange(refs.select.value));
  }
  if (refs.button) {
    refs.button.addEventListener('click', () => {
      if (currentPanel() !== 'versions') openPanel('versions');
      refreshVersionList();
    });
  }
  if (refs.importBtn) refs.importBtn.addEventListener('click', importFromFile);
  if (refs.refreshBtn) refs.refreshBtn.addEventListener('click', () => refreshVersionList());

  // 下载进度
  ipc.onVersionProgress((info) => {
    if (!info || !info.id) return;
    if (stopped.has(info.id)) return;
    progressMap.set(info.id, {
      percent: Number(info.percent) || 0,
      done: Number(info.done) || 0,
      total: Number(info.total) || 0,
    });
    renderPanel();
  });

  // 译本列表变化（安装 / 导入完成）
  ipc.onVersionsChanged(() => {
    refreshVersionList().then(() => {
      if (pendingSwitch) {
        const id = pendingSwitch;
        pendingSwitch = null;
        switchVersion(id);
      }
    });
  });

  bus.on('panel-open', (name) => {
    if (name !== 'versions') return;
    refreshVersionList();
  });

  refreshVersionList();
}

/** 拉取译本列表并刷新下拉框与面板。 */
export async function refreshVersionList() {
  const list = await ipc.listVersions();
  versions = Array.isArray(list) && list.length ? list.filter((v) => v && v.id) : FALLBACK_VERSIONS.slice();
  fillSelect();
  renderPanel();
  return versions;
}

/** 当前生效的译本 id。 */
export function activeVersion() {
  return currentVersion();
}

/**
 * 切换译本：
 *   setSettings → 合并设置 → 清章节缓存 → 重新拉取当前章 → 重绘
 */
export async function switchVersion(id) {
  if (!id || switching) return false;
  const target = versions.find((v) => v.id === id);
  if (target && target.installed === false) {
    toast(T.versions.notInstalledToast(target.name || id), 'info');
    if (currentPanel() !== 'versions') openPanel('versions');
    fillSelect();
    return false;
  }
  if (currentVersion() === id && state.settings && state.settings.version === id) {
    fillSelect();
    return true;
  }

  switching = true;
  try {
    const merged = await ipc.setSettings({ version: id });
    if (!merged) {
      toast(T.versions.switchFailed, 'error');
      return false;
    }
    setFallbackVersion(id);

    const next = mergeSettings(merged);
    if (!next.version) next.version = id;
    state.settings = next;

    // 切换译本必须清缓存，否则会显示上一个译本的经文
    clearChapterCache();
    applySettings(state.settings);
    bus.emit('settings', state.settings);

    const { bookId, chapter, verse } = state.current;
    if (bookId) await goToVerse(bookId, chapter, verse, { record: false });

    // 查找面板若有关键字，按新译本重查一次
    if (state.searchKeywords && state.searchKeywords.length) {
      runSearchWith(state.searchKeywords);
    }

    fillSelect();
    toast(T.versions.switched(target ? target.name : id), 'ok');
    return true;
  } finally {
    switching = false;
  }
}

function onSelectChange(id) {
  const target = versions.find((v) => v.id === id);
  if (!target) {
    fillSelect();
    return;
  }
  if (target.installed === false) {
    // 未安装：不切换，提示去「获取译本」
    toast(T.versions.notInstalledToast(target.name || id), 'info');
    fillSelect();
    if (currentPanel() !== 'versions') openPanel('versions');
    return;
  }
  switchVersion(id);
}

/** 下载安装未安装的译本。 */
async function install(id) {
  const target = versions.find((v) => v.id === id);
  if (!target) return;
  // 受版权保护且信望愛未开放离线下载授权的译本：先让用户确认自己已取得使用授权
  if (target.offlineDownload === false) {
    const ok = window.confirm(T.versions.confirmRestricted(target.name || id, target.copyright || ''));
    if (!ok) return;
  }
  stopped.delete(id);
  progressMap.set(id, { percent: 0, done: 0, total: 0 });
  pendingSwitch = id;
  renderPanel();

  const res = await ipc.installVersion(id);
  progressMap.delete(id);
  renderPanel();

  if (!res) {
    pendingSwitch = null;
    toast(T.versions.installFailed, 'error');
    return;
  }
  if (res.ok === false) {
    pendingSwitch = null;
    toast(T.versions.installError(res.error || ''), 'error');
    return;
  }
  toast(T.versions.installedToast(target.name || id, res.verses || 0), 'ok');
  await refreshVersionList();
  if (pendingSwitch === id) {
    pendingSwitch = null;
    switchVersion(id);
  }
}

/** 从本地文件导入译本。 */
async function importFromFile() {
  const res = await ipc.importVersionFile();
  if (!res) {
    toast(T.versions.importFailed, 'error');
    return;
  }
  if (res.ok === false) {
    toast(T.versions.importError(res.error || ''), 'error');
    return;
  }
  toast(T.versions.importedToast(res.name || res.id || '', res.verses || 0), 'ok');
  pendingSwitch = res.id || null;
  await refreshVersionList();
  if (pendingSwitch) {
    const id = pendingSwitch;
    pendingSwitch = null;
    switchVersion(id);
  }
}

/** 顶栏下拉框：已安装显示名字，未安装显示「（未安装）」。 */
function fillSelect() {
  const select = refs.select;
  if (!select) return;
  const current = currentVersion();
  select.textContent = '';

  const list = versions.slice();
  // 当前译本必须在下拉框里可见（后端未回传时兜底补一条）
  if (!list.some((v) => v.id === current)) {
    const fallback = FALLBACK_VERSIONS.find((v) => v.id === current);
    list.unshift(fallback || { id: current, name: current, installed: true });
  }

  for (const v of list) {
    const option = el('option', {
      value: v.id,
      text: v.installed === false ? `${v.name || v.id}${T.versions.notInstalledSuffix}` : (v.name || v.id),
    });
    if (v.id === current) option.selected = true;
    select.appendChild(option);
  }
  select.value = current;
}

/** 面板：译本列表（状态、版权、下载安装 / 使用）。 */
function renderPanel() {
  if (!refs.list) return;
  refs.list.textContent = '';

  if (refs.status) {
    refs.status.textContent = versions.length
      ? T.versions.listHint(versions.length, versions.filter((v) => v.installed !== false).length)
      : T.versions.empty;
  }

  if (!versions.length) {
    refs.list.appendChild(el('p', { class: 'empty-note', text: T.versions.empty }));
    return;
  }

  const current = currentVersion();
  for (const v of versions) {
    refs.list.appendChild(versionItem(v, current));
  }
}

function versionItem(v, current) {
  const installed = v.installed !== false;
  const isCurrent = v.id === current;
  const prog = progressMap.get(v.id);

  const tags = el('span', { class: 'version-tags' }, [
    el('span', {
      class: `version-tag${installed ? ' is-installed' : ''}`,
      text: installed ? T.versions.installed : T.versions.notInstalled,
    }),
  ]);
  if (v.bundled) tags.appendChild(el('span', { class: 'version-tag is-bundled', text: T.versions.bundled }));
  if (v.offlineDownload === false) {
    tags.appendChild(el('span', { class: 'version-tag is-restricted', text: T.versions.restrictedTag }));
  }

  const meta = [];
  if (v.source) meta.push(`${T.versions.source}：${v.source}`);
  if (v.copyright) meta.push(v.copyright);
  if (v.fhlVersion) meta.push(`FHL ${v.fhlVersion}`);

  const actions = el('div', { class: 'version-actions' });
  if (installed) {
    const use = el('button', {
      class: 'btn btn-ghost',
      type: 'button',
      text: isCurrent ? T.versions.current : T.versions.use,
    });
    use.disabled = isCurrent;
    use.addEventListener('click', () => switchVersion(v.id));
    actions.appendChild(use);
  } else {
    const dl = el('button', {
      class: 'btn btn-accent',
      type: 'button',
      text: prog ? T.versions.downloading : T.versions.download,
    });
    dl.disabled = !!prog;
    dl.addEventListener('click', () => install(v.id));
    actions.appendChild(dl);
  }

  const item = el('div', { class: `version-item${isCurrent ? ' is-current' : ''}` }, [
    el('div', { class: 'version-head' }, [
      el('span', { class: 'version-name', text: v.name || v.id }),
      tags,
    ]),
    meta.length ? el('p', { class: 'version-meta', text: meta.join(' · ') }) : null,
    actions,
  ]);

  if (prog) {
    const percent = Math.max(0, Math.min(100, Math.round(prog.percent || 0)));
    item.appendChild(el('div', { class: 'version-progress' }, [
      el('i', { style: `width:${percent}%` }),
    ]));
    item.appendChild(el('p', { class: 'version-progress-text', text: T.versions.progress(percent) }));
    item.appendChild(el('p', { class: 'version-progress-text', text: T.versions.downloadHint }));
    const stop = el('button', { class: 'btn btn-ghost', type: 'button', text: T.versions.stopTracking });
    stop.addEventListener('click', () => {
      stopped.add(v.id);
      progressMap.delete(v.id);
      renderPanel();
      toast(T.versions.stoppedHint, 'info');
    });
    item.appendChild(stop);
  }

  return item;
}
