// js/secondScreen.js — 副屏投影（原版 F9「扩展桌面」）
//
// 把当前经文投到第二个显示器：主进程在目标屏上开一个无边框全屏窗口，
// 本模块在翻节/换章/改设置时把「当前经文 + 显示设置」推给那个窗口。

import { bus } from './util.js';
import { ipc } from './bridge.js';
import { state } from './state.js';
import { currentVersion } from './version.js';
import { T } from './i18n.js';
import { toast } from './toast.js';

let opened = false;

export function initSecondScreen() {
  bus.on('navigate', () => { push(); });
  bus.on('settings', () => { push(); });
  ipc.onSettingsChanged(() => { push(); });
  // 副屏窗口就绪后会来索要当前经文（副屏窗口也可能不是由本模块打开的）
  ipc.onSecondScreenRequest(() => {
    opened = true;
    push();
  });
  // 副屏窗口被用户直接关掉时同步状态
  ipc.onSecondScreenClosed(() => { opened = false; });
}

/** 副屏投影是否开启 */
export function secondScreenActive() {
  return opened;
}

/** 把当前经文与显示设置推送到副屏窗口 */
async function push() {
  if (!opened) return;
  const current = state.current || {};
  if (!current.bookId) return;
  const s = state.settings || {};
  await ipc.secondScreenUpdate({
    bookId: current.bookId,
    chapter: current.chapter,
    verse: current.verse,
    version: currentVersion(),
    settings: {
      fontFamily: s.fontFamily,
      fontSize: s.fontSize,
      lineHeight: s.lineHeight,
      textColor: s.textColor,
      bgColor: s.bgColor,
      bgImage: s.bgImage,
      italic: s.italic,
      underline: s.underline,
      titleColor: s.titleColor,
      textShadow: s.textShadow,
      shadowColor: s.shadowColor,
      shadowBlur: s.shadowBlur,
      shadowOffset: s.shadowOffset,
    },
  });
}

/** 开关副屏投影 */
export async function toggleSecondScreen() {
  if (opened) {
    await ipc.secondScreenClose();
    opened = false;
    toast(T.secondScreen.closed, 'ok', 1600);
    return;
  }

  const displays = await ipc.secondScreenDisplays();
  const list = Array.isArray(displays) ? displays : [];
  if (list.length < 2) {
    toast(T.secondScreen.noDisplay, 'error', 2800);
    return;
  }

  // 默认投到第一个非主显示器
  const target = list.find((d) => !d.primary) || list[0];
  const res = await ipc.secondScreenOpen(target.id);
  if (!res || res.ok === false) {
    toast(T.secondScreen.failed, 'error', 2400);
    return;
  }
  opened = true;
  toast(T.secondScreen.opened, 'ok', 1800);
  await push();
}
