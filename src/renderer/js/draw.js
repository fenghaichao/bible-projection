// js/draw.js — 投影模式内的简易绘画标注（画布叠加层 + 撤销/重做）

import { $, bus, el } from './util.js';
import { state } from './state.js';
import { T } from './i18n.js';

const COLORS = ['#f2d06b', '#f5f5f5', '#ff8a5c', '#7ad7ff', '#b58cff', '#8dff9f'];

let canvas = null;
let ctx = null;
let strokes = [];
let redoStack = [];
let current = null;
let color = COLORS[0];
let width = 6;
let active = false;

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

  window.addEventListener('resize', resizeCanvas, { passive: true });
  bus.on('projection', resizeCanvas);
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
      title: c,
    });
    btn.style.background = c;
    btn.addEventListener('click', () => {
      color = c;
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
  if (!active) current = null;
}

export function isDrawing() {
  return active;
}

export function undoDraw() {
  if (!strokes.length) return;
  redoStack.push(strokes.pop());
  redraw();
}

export function redoDraw() {
  if (!redoStack.length) return;
  strokes.push(redoStack.pop());
  redraw();
}

export function clearDraw() {
  strokes = [];
  redoStack = [];
  redraw();
}

function pointOf(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function onPointerDown(event) {
  if (!active || !state.projection) return;
  event.preventDefault();
  canvas.setPointerCapture(event.pointerId);
  current = {
    color: event.ctrlKey || event.metaKey ? null : color,
    width: event.ctrlKey || event.metaKey ? width * 3 : width,
    points: [pointOf(event)],
  };
  strokes.push(current);
  redraw();
}

function onPointerMove(event) {
  if (!current) return;
  event.preventDefault();
  current.points.push(pointOf(event));
  redraw();
}

function onPointerUp() {
  current = null;
}

function redraw() {
  if (!ctx || !canvas) return;
  const rect = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const stroke of strokes) {
    if (!stroke.points.length) continue;
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    if (stroke.points.length === 1) {
      ctx.lineTo(stroke.points[0].x + 0.01, stroke.points[0].y + 0.01);
    } else {
      for (let i = 1; i < stroke.points.length; i += 1) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
    }
    ctx.lineWidth = stroke.width;
    ctx.strokeStyle = stroke.color || 'rgba(0,0,0,0)';
    ctx.globalCompositeOperation = stroke.color ? 'source-over' : 'destination-out';
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
}
