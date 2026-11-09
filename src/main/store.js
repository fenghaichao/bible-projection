'use strict';

/**
 * 极简 JSON 持久化：设置 / 历史 / 收藏
 * 全部存放在 Electron 的 userData 目录下，写入采用「临时文件 + 重命名」避免写坏。
 */
const fs = require('fs');
const path = require('path');

class JsonStore {
  constructor(filePath, defaults) {
    this.filePath = filePath;
    this.defaults = defaults;
    this.data = this._load();
  }

  _load() {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      return Object.assign({}, this.defaults, parsed);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.warn(`[store] 读取 ${this.filePath} 失败，使用默认值:`, err.message);
      }
      return Object.assign({}, this.defaults);
    }
  }

  get() {
    return Object.assign({}, this.data);
  }

  set(patch) {
    this.data = Object.assign({}, this.data, patch || {});
    this._save();
    return this.get();
  }

  _save() {
    const tmp = `${this.filePath}.tmp`;
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf8');
      fs.renameSync(tmp, this.filePath);
    } catch (err) {
      console.error(`[store] 写入 ${this.filePath} 失败:`, err.message);
      try { fs.unlinkSync(tmp); } catch { /* ignore */ }
    }
  }
}

module.exports = { JsonStore };
