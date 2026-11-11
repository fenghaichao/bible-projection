// js/compare.js — 「多版本比对」区块（顶栏「多版本比对」按钮打开的独立面板）
//
// 交互：
//   · 勾选 2–4 个已安装译本（未安装的译本置灰不可选）；
//   · 点「对比当前经文」：每一节下面逐个译本列出正文（**不做左右分栏**）；
//   · 点「结束对比」：恢复单译本显示。

import { $, bus, el } from './util.js';
import { T } from './i18n.js';
import { toast } from './toast.js';
import { state } from './state.js';
import { versionList, versionName, refreshVersionList } from './panel-versions.js';
import { startCompare, stopCompare } from './stage.js';
import { closePanel } from './panels.js';

/** 最多同时对比的译本数 */
const MAX_COMPARE = 4;

let refs = {};

export function initCompare() {
  refs.chips = $('#compare-chips');
  refs.status = $('#compare-status');
  refs.start = $('#compare-start');
  refs.clear = $('#compare-clear');
  if (!refs.chips) return;

  if (refs.start) refs.start.addEventListener('click', onStart);
  if (refs.clear) refs.clear.addEventListener('click', onClear);

  bus.on('versions-list', renderCompare);
  bus.on('panel-open', (name) => {
    if (name === 'compare') {
      // 打开比对面板时先拉一次译本列表，保证 chip 与实际安装情况一致
      refreshVersionList().then(renderCompare).catch(() => renderCompare());
    } else if (name === 'versions') {
      renderCompare();
    }
  });

  renderCompare();
}

function renderCompare() {
  if (!refs.chips) return;
  refs.chips.textContent = '';

  const list = versionList();
  const current = state.settings ? state.settings.version : '';

  for (const v of list) {
    const installed = v.installed !== false;
    const selected = state.compareSelection.includes(v.id);
    const chip = el('button', {
      class: `compare-chip${selected ? ' is-selected' : ''}${installed ? '' : ' is-disabled'}`,
      type: 'button',
      text: installed ? (v.name || v.id) : `${v.name || v.id}${T.versions.notInstalled}`,
      title: v.id === current ? T.versions.current : (v.copyright || v.name || v.id),
    });
    chip.disabled = !installed;
    chip.dataset.version = v.id;
    if (installed) {
      chip.addEventListener('click', () => toggle(v.id));
    }
    refs.chips.appendChild(chip);
  }

  const count = state.compareSelection.length;
  if (refs.status) {
    refs.status.textContent = count < 2
      ? T.versions.compareNeed(count)
      : T.versions.compareReady(count);
    refs.status.classList.toggle('is-warn', count < 2);
  }
  if (refs.start) refs.start.disabled = count < 2;
}

function toggle(id) {
  const list = state.compareSelection;
  const index = list.indexOf(id);
  if (index >= 0) {
    list.splice(index, 1);
  } else {
    if (list.length >= MAX_COMPARE) {
      toast(T.versions.compareLimit, 'info');
      return;
    }
    list.push(id);
  }
  renderCompare();
}

async function onStart() {
  const selection = state.compareSelection.slice();
  if (selection.length < 2) {
    toast(T.versions.compareNeed(selection.length), 'info');
    return;
  }
  const names = {};
  for (const id of selection) names[id] = versionName(id);
  const ok = await startCompare(selection, names);
  if (!ok) {
    toast(T.versions.compareFailed, 'error');
    return;
  }
  toast(T.versions.compareStarted(selection.length), 'ok');
  closePanel();
}

function onClear() {
  stopCompare();
  state.compareSelection = [];
  renderCompare();
}
