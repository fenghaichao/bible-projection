// js/panel-help.js — 帮助与快捷键面板

import { $, el } from './util.js';
import { ipc } from './bridge.js';
import { T } from './i18n.js';

export function initHelp() {
  const body = $('#help-keys');
  if (body) {
    for (const [keys, desc] of T.help.rows) {
      body.appendChild(
        el('tr', {}, [
          el('td', { class: 'kbd-cell' }, [el('kbd', { text: keys })]),
          el('td', { class: 'kbd-desc', text: desc }),
        ])
      );
    }
  }

  const version = $('#help-version');
  if (version) {
    ipc.appVersion().then((v) => {
      version.textContent = T.help.version(v || '—');
    });
  }

  const home = $('#help-home');
  if (home) {
    home.addEventListener('click', () => ipc.openExternal(T.help.homeUrl));
  }
}
