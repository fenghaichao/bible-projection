// js/second.js — 副屏投影窗口的渲染层（原版 F9「扩展桌面」的现代等价）
//
// 数据流：主窗口在每次翻节/换章/改设置时调用 bible:secondScreen:update，
// 主进程把 { bookId, chapter, verse, version, settings } 转发给本窗口；
// 本窗口据此取该译本的经文并按主窗口的显示设置渲染。

import { ipc } from './bridge.js';

const $ = (sel) => document.querySelector(sel);

let books = [];
let lastPayload = null;

function bookName(id) {
  const book = books.find((b) => Number(b.id) === Number(id));
  return book ? (book.name || '') : '';
}

function applySettings(settings) {
  if (!settings) return;
  const body = document.body;
  if (settings.bgColor) body.style.backgroundColor = settings.bgColor;
  if (settings.bgImage) {
    const url = String(settings.bgImage).replace(/"/g, '\\"');
    body.style.backgroundImage = `url("${url}")`;
    body.style.backgroundSize = 'cover';
    body.style.backgroundPosition = 'center';
  } else {
    body.style.backgroundImage = '';
  }

  const text = $('.second-text');
  if (text) {
    text.style.fontFamily = settings.fontFamily || '微软雅黑';
    text.style.fontSize = `${Number(settings.fontSize) || 48}px`;
    text.style.lineHeight = String(settings.lineHeight || 1.8);
    text.style.color = settings.textColor || '#f5f5f5';
    text.style.fontStyle = settings.italic ? 'italic' : 'normal';
    text.style.textDecoration = settings.underline ? 'underline' : 'none';
    if (settings.textShadow) {
      const off = Number(settings.shadowOffset) || 2;
      const blur = Number(settings.shadowBlur) || 10;
      text.style.textShadow = `${off}px ${off}px ${blur}px ${settings.shadowColor || '#000000'}`;
    } else {
      text.style.textShadow = 'none';
    }
  }

  const ref = $('.second-ref');
  if (ref && settings.titleColor) ref.style.color = settings.titleColor;
}

async function render(payload) {
  if (!payload) return;
  lastPayload = payload;
  applySettings(payload.settings || {});

  const { bookId, chapter, verse, version } = payload;
  const list = await ipc.getChapter(bookId, chapter, version);
  const rows = Array.isArray(list) ? list : [];
  const hit = rows.find((row) => Number(row.verse) === Number(verse));

  const name = bookName(bookId);
  const ref = $('.second-ref');
  if (ref) ref.textContent = name ? `${name} 第${chapter}章　${chapter}:${verse}` : `${chapter}:${verse}`;

  const text = $('.second-text');
  if (text) text.textContent = hit ? hit.text : '';
}

ipc.onSecondScreenPayload((payload) => {
  render(payload);
});

// 主窗口改了设置（例如字号、背景）时同步外观
ipc.onSettingsChanged((settings) => {
  if (settings) applySettings(settings);
});

(async () => {
  const list = await ipc.getBooks();
  books = Array.isArray(list) ? list : [];
  // 书卷名到得晚时补渲染一次
  if (lastPayload) render(lastPayload);
})();
