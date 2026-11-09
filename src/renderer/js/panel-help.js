// js/panel-help.js — 帮助面板：分组快捷键表（对齐原版 44 条总表）

import { $, el } from './util.js';
import { ipc } from './bridge.js';
import { T } from './i18n.js';

export function initHelp() {
  const host = $('#help-groups');
  if (host) {
    host.textContent = '';
    for (const group of T.help.groups) {
      const silent = String(group.title || '').includes('不适用');
      const section = el('section', { class: `help-group${silent ? ' is-silent' : ''}` }, [
        el('p', { class: 'group-label', text: group.title }),
      ]);
      const table = el('table', { class: 'kbd-table' });
      const tbody = el('tbody');
      for (const row of group.rows) {
        const keys = String(row[0] || '');
        const desc = String(row[1] || '');
        tbody.appendChild(
          el('tr', {}, [
            el('td', { class: 'kbd-cell' }, [el('kbd', { text: keys })]),
            el('td', { class: 'kbd-desc', text: desc }),
          ])
        );
      }
      table.appendChild(tbody);
      section.appendChild(table);
      host.appendChild(section);
    }

    const note = el('p', { class: 'help-note', text: T.help.deviationNote });
    host.appendChild(note);
  }

  const version = $('#help-version');
  if (version) {
    ipc.appVersion().then((v) => {
      version.textContent = T.help.version(v || '—');
    });
  }

  const home = $('#help-home');
  if (home) {
    home.addEventListener('click', () => {
      ipc.openExternal(T.help.homeUrl);
    });
  }
}
