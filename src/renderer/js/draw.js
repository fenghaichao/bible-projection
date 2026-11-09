// js/draw.js — 投影模式内的绘画标注（画笔 + 文字标注），按章落盘

import { $, bus, el } from './util.js';
import { ipc } from './bridge.js';
import { state } from './state.js';
import { T } from './i18n.js';
import { toast } from './toast.js';

const COLORS = [
  { key: 'W', value: '#f5f5f5' },
  { key: 'Y', value: '#f2d06b' },
  { key: 'R', value: '#ff8a5c' },
  { key: 'L', value: '#7ad7ff' },
  { key: 'G', value: '#8dff9f' },
  { key: 'B', value: '#b58cff' },
];
const WIDTHS = [2, 4, 6, 10, 16, 24];
const TEXT_MAX = 30;

let canvas = null;
let ctx = null;
let strokes = [];
let redoStack = [];
let current = null;
let color = COLORS[0].value;
let width = 6;
let active = false;
let eraser = false;
let chapterKey = '';
let textEditor = null;

export function initDraw() {
  canvas = $('#draw-canvas');
  if (!canvas) return;
  ctx = canvas.getContext('2d');

  buildSwatches();

  const toggle = $('#draw-toggle');
  if (toggle) toggle.addEventListener('click', toggleDraw);

  const undo = $('#draw-undo');
  if (undo) undo.addEventListener('click', undoDraw);

  const clear = $('#draw-clear');
  if (clear) clear.addEventListener('click', clearDraw);

  const textBtn = $('#draw-text');
  if (textBtn) textBtn.addEventListener('click', () => beginTextAnnotation());

  const range = $('#draw-width');
  if (range) {
    range.addEventListener('input', () => {
      width = Math.max(1, Number(range.value) || 6);
    });
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('dblclick', onDoubleClick);

  window.addEventListener('resize', resizeCanvas, { passive: true });
  bus.on('projection', () => {
    resizeCanvas();
    loadChapter();
  });
  bus.on('navigate', () => {
    if (!state.projection) return;
    loadChapter();
  });
  resizeCanvas();
}

function buildSwatches() {
  const host = $('#draw-swatches');
  if (!host) return;
  host.textContent = '';
  COLORS.forEach((c, index) => {
    const btn = el('button', {
      class: `swatch${index === 0 ? ' is-active' : ''}`,
      type: 'button',
      title: `${c.key} · ${c.value}`,
    });
    btn.style.background = c.value;
    btn.addEventListener('click', () => {
      color = c.value;
      for (const other of host.querySelectorAll('.swatch')) other.classList.remove('is-active');
      btn.classList.add('is-active');
    });
    host.appendChild(btn);
  });
}

function resizeCanvas() {
  if (!canvas) return;
  const stage = $('#stage');
  if (!stage) return;
  const rect = stage.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  redraw();
}

export function toggleDraw() {
  if (!state.projection) return;
  active = !active;
  document.body.classList.toggle('drawing', active);
  const btn = $('#draw-toggle');
  if (btn) {
    btn.classList.toggle('is-active', active);
    btn.textContent = active ? T.draw.stop : T.draw.toggle;
  }
  if (!active) {
    current = null;
    closeTextEditor();
  }
}

export function isDrawing() {
  return active;
}

/** 橡皮擦模式（原版 E 键）。 */
export function toggleEraser() {
  eraser = !eraser;
  document.body.classList.toggle('draw-erasing', eraser);
  toast(eraser ? T.draw.eraserOn : T.draw.eraserOff, 'info', 1400);
  return eraser;
}

export function isErasing() {
  return eraser;
}

export function undoDraw() {
  if (!strokes.length) return;
  redoStack.push(strokes.pop());
  redraw();
  saveChapter();
}

export function redoDraw() {
  if (!redoStack.length) return;
  strokes.push(redoStack.pop());
  redraw();
  saveChapter();
}

export function clearDraw() {
  strokes = [];
  redoStack = [];
  redraw();
  saveChapter();
  toast(T.draw.cleared, 'ok', 1200);
}

/** 画笔粗细快捷键 1~6。 */
export function setDrawWidth(index) {
  const w = WIDTHS[index];
  if (!w) return false;
  width = w;
  const range = $('#draw-width');
  if (range) range.value = String(w);
  return true;
}

/** 颜色快捷键 W/G/L/B/Y/R。 */
export function setDrawColor(key) {
  const found = COLORS.find((c) => c.key === String(key || '').toUpperCase());
  if (!found) return false;
  color = found.value;
  const host = $('#draw-swatches');
  if (host) {
    const buttons = host.querySelectorAll('.swatch');
    buttons.forEach((btn, index) => btn.classList.toggle('is-active', COLORS[index] && COLORS[index].key === found.key));
  }
  return true;
}

function pointOf(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function onPointerDown(event) {
  if (!active || !state.projection) return;
  if (event.button !== undefined && event.button !== 0) return;
  event.preventDefault();
  canvas.setPointerCapture(event.pointerId);
  const start = pointOf(event);
  // 原版手势：Ctrl+拖动=圆形，Shift+拖动=矩形，Alt+拖动=线段；E 键切换橡皮。
  if (eraser) {
    current = { type: 'line', color: null, width: width * 3, points: [start] };
  } else if (event.shiftKey) {
    current = { type: 'rect', color, width, points: [start], start, end: start };
  } else if (event.altKey) {
    current = { type: 'seg', color, width, points: [start], start, end: start };
  } else if (event.ctrlKey || event.metaKey) {
    current = { type: 'circle', color, width, points: [start], start, end: start };
  } else {
    current = { type: 'line', color, width, points: [start] };
  }
  strokes.push(current);
  redraw();
}

function onPointerMove(event) {
  if (!current) return;
  event.preventDefault();
  const p = pointOf(event);
  if (current.type === 'line') {
    current.points.push(p);
  } else {
    current.end = p;
    current.points = [current.start, p];
  }
  redraw();
}

function onPointerUp() {
  if (!current) return;
  current = null;
  saveChapter();
}

/** 双击画布 → 输入文字标注。 */
function onDoubleClick(event) {
  if (!state.projection) return;
  event.preventDefault();
  beginTextAnnotation(pointOf(event));
}

function beginTextAnnotation(point) {
  if (!canvas) return;
  const stage = $('#stage');
  if (!stage) return;
  closeTextEditor();

  const rect = canvas.getBoundingClientRect();
  const at = point || { x: 40, y: 40 };
  pendingTextPoint = at;
  const input = el('input', {
    class: 'draw-text-input',
    type: 'text',
    maxlength: String(TEXT_MAX),
    placeholder: T.draw.textPlaceholder,
  });
  input.style.left = `${Math.min(Math.max(8, rect.width - 240), at.x + 8)}px`;
  input.style.top = `${Math.min(Math.max(8, rect.height - 52), at.y + 8)}px`;
  stage.appendChild(input);
  textEditor = { input, point: at };
  input.focus();

  const commit = () => {
    // blur 与 Enter 都会触发 commit；textEditor 已清空说明本次已经提交过。
    if (!textEditor || textEditor.input !== input) return;
    const value = input.value.trim().slice(0, TEXT_MAX);
    const spot = pendingTextPoint;
    closeTextEditor();
    if (!value) return;
    strokes.push({ type: 'text', text: value, x: spot.x, y: spot.y });
    redraw();
    saveChapter();
  };
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closeTextEditor();
    }
    event.stopPropagation();
  });
  input.addEventListener('blur', () => commit());
}

let pendingTextPoint = { x: 40, y: 40 };

function closeTextEditor() {
  // 先清引用再摘节点：removeChild 会同步触发 blur → commit → closeTextEditor 递归。
  const editor = textEditor;
  textEditor = null;
  if (!editor) return;
  const node = editor.input;
  if (node && node.parentNode) node.parentNode.removeChild(node);
}

/** 当前章节的标注键。 */
function currentKey() {
  const { bookId, chapter } = state.current;
  if (!bookId) return '';
  return `${bookId}:${chapter}`;
}

async function loadChapter() {
  const key = currentKey();
  if (!key || key === chapterKey) {
    redraw();
    return;
  }
  chapterKey = key;
  strokes = [];
  redoStack = [];
  const saved = await ipc.getAnnotations(key);
  if (Array.isArray(saved) && saved.length) {
    strokes = saved;
    toast(T.draw.restored, 'info', 1600);
  }
  redraw();
}

const saveChapter = debounceSave();

function debounceSave() {
  let timer = null;
  return () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      const key = currentKey();
      if (!key) return;
      ipc.saveAnnotations(key, strokes.slice());
    }, 600);
  };
}

function redraw() {
  if (!ctx || !canvas) return;
  const rect = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const stroke of strokes) {
    if (stroke.type === 'text') {
      drawText(stroke);
      continue;
    }
    if (!stroke.points || !stroke.points.length) continue;
    ctx.beginPath();
    ctx.lineWidth = stroke.width;
    ctx.strokeStyle = stroke.color || 'rgba(0,0,0,0)';
    ctx.globalCompositeOperation = stroke.color ? 'source-over' : 'destination-out';
    if (stroke.type === 'rect') {
      const a = stroke.start || stroke.points[0];
      const b = stroke.end || stroke.points[stroke.points.length - 1];
      ctx.rect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      ctx.stroke();
      continue;
    }
    if (stroke.type === 'circle') {
      const a = stroke.start || stroke.points[0];
      const b = stroke.end || stroke.points[stroke.points.length - 1];
      const r = Math.hypot(b.x - a.x, b.y - a.y);
      ctx.moveTo(a.x + r, a.y);
      ctx.arc(a.x, a.y, Math.max(0.5, r), 0, Math.PI * 2);
      ctx.stroke();
      continue;
    }
    if (stroke.type === 'seg') {
      const a = stroke.start || stroke.points[0];
      const b = stroke.end || stroke.points[stroke.points.length - 1];
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      continue;
    }
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    if (stroke.points.length === 1) {
      ctx.lineTo(stroke.points[0].x + 0.01, stroke.points[0].y + 0.01);
    } else {
      for (let i = 1; i < stroke.points.length; i += 1) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
    }
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
}

/** 文字标注：黑体 30 号、黄底深红字（对齐原版样式）。 */
function drawText(stroke) {
  const x = Number(stroke.x) || 0;
  const y = Number(stroke.y) || 0;
  const text = String(stroke.text || '');
  ctx.save();
  ctx.font = '30px "SimHei", "Heiti SC", sans-serif';
  ctx.textBaseline = 'top';
  const metrics = ctx.measureText(text);
  const w = Math.max(24, metrics.width + 16);
  const h = 40;
  ctx.fillStyle = 'rgba(242, 208, 107, .92)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#7a1f1f';
  ctx.fillText(text, x + 8, y + 5);
  ctx.restore();
}
