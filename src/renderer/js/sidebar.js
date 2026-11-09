// js/sidebar.js — 分类 → 书卷 → 章 → 节的侧栏导航

import { $, bus, el } from './util.js';
import { ipc } from './bridge.js';
import { bookDisplayName, bookShortName, setBooks, state } from './state.js';
import { T } from './i18n.js';
import { goToVerse } from './stage.js';

let refs = {};
let view = { level: 'categories', category: null, bookId: null, chapter: null };

export function initSidebar() {
  refs.body = $('#sidebar-body');
  refs.title = $('#sidebar-title');
  refs.sub = $('#sidebar-sub');
  refs.back = $('#sidebar-back');

  refs.back.addEventListener('click', goBack);
  bus.on('navigate', (payload) => {
    if (payload && payload.silent) return;
    const { bookId, chapter } = payload || {};
    if (view.bookId !== bookId) {
      view = { level: 'chapters', category: null, bookId, chapter: null };
    } else {
      view.chapter = chapter;
    }
    renderSidebar();
  });
  bus.on('settings', renderSidebar);
}

export async function loadBooks() {
  const books = await ipc.getBooks();
  setBooks(books);
  renderSidebar();
  return state.books;
}

export function renderSidebar() {
  if (!refs.body) return;
  refs.body.textContent = '';

  if (!state.books.length) {
    refs.title.textContent = T.sidebar.all;
    refs.sub.textContent = T.err.noData;
    refs.back.hidden = true;
    refs.body.appendChild(el('p', { class: 'empty-note', text: T.sidebar.empty }));
    return;
  }

  switch (view.level) {
    case 'category':
      renderCategoryBooks();
      break;
    case 'chapters':
      renderChapters();
      break;
    case 'verses':
      renderVerses();
      break;
    default:
      renderCategories();
  }
}

function groupByCategory() {
  const groups = new Map();
  for (const book of state.books) {
    const key = book.category === undefined || book.category === null ? 'other' : book.category;
    if (!groups.has(key)) {
      groups.set(key, { key, name: book.categoryName || T.sidebar.categoryFallback, books: [] });
    }
    groups.get(key).books.push(book);
  }
  return Array.from(groups.values());
}

function renderCategories() {
  refs.title.textContent = T.sidebar.all;
  refs.sub.textContent = T.sidebar.books(state.books.length);
  refs.back.hidden = true;

  const frag = document.createDocumentFragment();
  let index = 0;

  for (const group of groupByCategory()) {
    const section = el('section', { class: 'cat-block' });
    const title = el('h3', { class: 'cat-title' }, [
      el('span', { class: 'cat-name', text: group.name }),
      el('span', { class: 'cat-count', text: T.sidebar.books(group.books.length) }),
    ]);
    title.style.cursor = 'pointer';
    title.addEventListener('click', () => {
      view = { level: 'category', category: group.key, bookId: null, chapter: null };
      renderSidebar();
    });
    section.appendChild(title);

    const grid = el('div', { class: 'book-grid' });
    for (const book of group.books) {
      grid.appendChild(bookCard(book, index));
      index += 1;
    }
    section.appendChild(grid);
    frag.appendChild(section);
  }

  refs.body.appendChild(frag);
}

function bookCard(book, index) {
  const card = el('button', { class: 'book-card', type: 'button', title: bookDisplayName(book) }, [
    el('span', { class: 'book-abbr', text: book.abbr || (book.short || '').slice(0, 1) }),
    el('span', { class: 'book-name', text: bookShortName(book) || bookDisplayName(book) }),
    el('span', {
      class: 'book-meta',
      text: `${bookDisplayName(book)} · ${T.sidebar.chapters(book.chapters)}`,
    }),
  ]);
  card.style.animationDelay = `${Math.min(index, 24) * 14}ms`;
  card.addEventListener('click', () => {
    view = { level: 'chapters', category: book.category ?? null, bookId: book.id, chapter: null };
    renderSidebar();
    goToVerse(book.id, 1, 1).then(() => renderSidebar());
  });
  return card;
}

function renderCategoryBooks() {
  const group = groupByCategory().find((g) => g.key === view.category);
  const books = group ? group.books : state.books;
  refs.title.textContent = group ? group.name : T.sidebar.all;
  refs.sub.textContent = T.sidebar.books(books.length);
  refs.back.hidden = false;

  const grid = el('div', { class: 'book-grid' });
  books.forEach((book, index) => grid.appendChild(bookCard(book, index)));
  refs.body.appendChild(grid);
}

function renderChapters() {
  const book = state.bookMap.get(view.bookId);
  if (!book) {
    view = { level: 'categories', category: null, bookId: null, chapter: null };
    renderSidebar();
    return;
  }
  refs.title.textContent = bookDisplayName(book);
  refs.sub.textContent = T.sidebar.chapters(book.chapters);
  refs.back.hidden = false;

  const grid = el('div', { class: 'chapter-grid' });
  const total = Math.max(0, Number(book.chapters) || 0);
  for (let c = 1; c <= total; c += 1) {
    const btn = el('button', {
      class: `chapter-btn${state.current.chapter === c && state.current.bookId === book.id ? ' is-active' : ''}`,
      type: 'button',
      text: String(c),
    });
    btn.addEventListener('click', async () => {
      view = { level: 'verses', category: book.category ?? null, bookId: book.id, chapter: c };
      await goToVerse(book.id, c, 1);
      renderSidebar();
    });
    grid.appendChild(btn);
  }
  refs.body.appendChild(grid);
}

async function renderVerses() {
  const book = state.bookMap.get(view.bookId);
  if (!book) {
    view = { level: 'categories', category: null, bookId: null, chapter: null };
    renderSidebar();
    return;
  }
  const chapter = view.chapter || 1;
  refs.title.textContent = `${bookDisplayName(book)} ${T.stage.chapterLabel(chapter)}`;
  refs.sub.textContent = T.sidebar.pickBook;
  refs.back.hidden = false;

  const list = await getChapterVerses(book.id, chapter);
  if (!list.length) {
    refs.body.appendChild(el('p', { class: 'empty-note', text: T.err.emptyBook }));
    return;
  }

  const chips = el('div', { class: 'verse-chips' });
  for (const item of list) {
    const num = Number(item.verse !== undefined ? item.verse : item.v);
    if (!Number.isFinite(num)) continue;
    const chip = el('button', {
      class: `verse-chip${state.current.verse === num && state.current.chapter === chapter ? ' is-active' : ''}`,
      type: 'button',
      text: String(num),
    });
    chip.addEventListener('click', async () => {
      await goToVerse(book.id, chapter, num);
      renderSidebar();
    });
    chips.appendChild(chip);
  }
  refs.body.appendChild(chips);
}

async function getChapterVerses(bookId, chapter) {
  const key = `${bookId}:${chapter}`;
  if (!state.chapterCache.has(key)) {
    const res = await ipc.getChapter(bookId, chapter);
    state.chapterCache.set(key, Array.isArray(res) ? res : []);
  }
  return state.chapterCache.get(key);
}

function goBack() {
  switch (view.level) {
    case 'verses':
      view = { ...view, level: 'chapters', chapter: null };
      break;
    case 'chapters':
      view = { level: view.category === null ? 'categories' : 'category', category: view.category, bookId: null, chapter: null };
      break;
    case 'category':
      view = { level: 'categories', category: null, bookId: null, chapter: null };
      break;
    default:
      return;
  }
  renderSidebar();
}
