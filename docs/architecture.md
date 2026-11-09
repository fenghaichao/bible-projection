# 架构说明

本文描述 bible-projection 的进程划分、IPC 契约、数据访问策略与持久化方案。

---

## 1. 总体结构

应用是标准的 Electron 三层结构，渲染层不使用任何前端框架，也没有打包 / 构建步骤——
`src/renderer/` 下的文件就是浏览器直接加载的源文件。

```
┌──────────────────────────────────────────────────────────┐
│ 主进程  src/main/                                        │
│   main.js    窗口创建、菜单、IPC 注册、剪贴板、外部链接     │
│   bible.js   经文数据访问层（读 JSON、查章、查范围、查找）  │
│   store.js   极简 JSON 持久化（设置 / 历史 / 收藏）          │
└───────────────┬──────────────────────────────────────────┘
                │  ipcMain.handle  /  ipcMain.send
┌───────────────▼──────────────────────────────────────────┐
│ 预加载  src/preload/preload.js                            │
│   contextBridge.exposeInMainWorld('bible', api)           │
│   只暴露白名单方法；不暴露 ipcRenderer 本身                │
└───────────────┬──────────────────────────────────────────┘
                │  window.bible.*
┌───────────────▼──────────────────────────────────────────┐
│ 渲染进程  src/renderer/                                   │
│   index.html + 渲染层 JS/CSS                              │
│   经文显示、卷章导航、查找、设置、历史、收藏、投影模式        │
└──────────────────────────────────────────────────────────┘
```

### 职责划分

| 层 | 职责 | 明确不负责 |
| --- | --- | --- |
| **主进程** | 窗口与生命周期、应用菜单、IPC 处理、剪贴板、系统浏览器、磁盘持久化 | 不做任何界面渲染 |
| **预加载** | 在 `contextIsolation` 下把主进程能力以固定 API 暴露给渲染层 | 不含业务逻辑，不传递业务数据 |
| **渲染进程** | 全部界面与交互；通过 `window.bible.*` 调用主进程 | 不直接访问 `fs` / `ipcRenderer` |

### 安全基线

`src/main/main.js` 中窗口按以下安全参数创建：

```js
webPreferences: {
  preload: path.join(__dirname, '..', 'preload', 'preload.js'),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: false,
  spellcheck: false,
}
```

- `contextIsolation: true` + `nodeIntegration: false`：渲染层没有 Node 能力。
- `sandbox: false` 是刻意的：预加载脚本只需 `contextBridge` / `ipcRenderer`，
  但 Electron 的 preload 沙箱会让 `require` 受限；该选项与上面的隔离组合使用是安全的。
- `spellcheck: false`：避免 Chromium 拼写检查给中文经文加红波浪线。
- 外部链接一律交给系统浏览器：主进程注册 `setWindowOpenHandler`，
  渲染层另有 `bible:openExternal` 通道，且只放行 `http(s)://`。

### 窗口显示策略

主窗口以 `show: false` 创建，避免 Electron 在首帧绘制完成前就闪出一个空白窗口：

```js
mainWindow.once('ready-to-show', () => mainWindow.show());
```

兜底：个别环境不触发 `ready-to-show`，因此在 `did-finish-load` 之后 1 秒再检查一次
`isVisible()`，窗口仍不可见就 `show()`，避免出现「进程在但没有窗口」的情况。

### 渲染层结构

`src/renderer/` 下全部是浏览器直接加载的原生文件，**没有框架、没有打包、没有构建步骤**：

```
src/renderer/
├── index.html      页面骨架
├── styles.css      全部样式
└── js/             ES module（<script type="module"> 引入）
    ├── app.js         应用装配：把各模块装配起来
    ├── bridge.js      唯一的主进程访问入口（window.bible 的包装）
    ├── state.js       渲染层状态与设置归一化（mergeSettings）
    ├── shortcuts.js   全局快捷键处理（DOM keydown）
    ├── sidebar.js     侧栏书目 / 章列表
    ├── stage.js       经文显示、翻节、复制当前章
    ├── panels.js      抽屉面板的开关调度
    ├── panel-search.js / panel-library.js / panel-help.js   各面板
    ├── settings.js    显示设置的读写
    ├── projection.js  投影模式
    ├── draw.js        画笔 / 擦除 / 撤销 / 重做
    ├── i18n.js        文案表（含帮助面板的快捷键表）
    ├── util.js        通用小工具
    └── toast.js       轻提示
```

`index.html` 的骨架分四块：

| 区域 | 关键节点 | 作用 |
| --- | --- | --- |
| 顶栏 `topbar` | `btn-lang`、`data-open-panel`、`btn-projection` | 简/繁切换、打开各面板、进入投影模式 |
| 侧栏 `sidebar` | `sidebar-body` | 66 卷书目（8 分类）与章列表 |
| 舞台 `stage` | `#verses`、`#stage-scroll`、`canvas#draw-canvas`、`#draw-tools`、`#stage-foot` | 经文显示区 + 标注画布 + 绘画工具条 |
| 抽屉 `drawer` | `#panel-search` / `#panel-settings` / `#panel-history` / `#panel-saved` / `#panel-help` | 查找、设置、历史、收藏、帮助五个面板 |

渲染层**不直接触碰 `ipcRenderer`**，所有特权调用都经过 `src/renderer/js/bridge.js`：

- 它是 `window.bible` 的唯一调用点，页面其余代码只依赖 bridge 导出的函数；
- 当 bridge 不可用（例如在浏览器里直接打开 `index.html`）时，bridge 会退化为
  **stub 替身**并用 toast 提示，而不是抛出未捕获异常；
- bridge 负责把 IPC 的原始返回整理成渲染层可用的结构，并统一处理简繁切换等派生状态。

---

## 2. IPC 契约

所有通道名统一使用 `bible:` 前缀，均为 **request / response** 语义（`ipcRenderer.invoke`）。
推送通道只有两条：`settings-changed` 与 `fullscreen-changed`（主进程 → 渲染进程）。

### 经文数据

| 方法 | 参数 | 返回 | 说明 |
| --- | --- | --- | --- |
| `bible:getBooks` | — | `Book[]` | 全部 66 卷的书目信息（来自 `src/shared/books.js`；该文件缺失时返回空数组） |
| `bible:getChapter` | `bookId: number`, `chapter: number` | `Verse[]` | 整章经文，按节号升序；章不存在返回 `[]` |
| `bible:getRange` | `bookId: number`, `from: {chapter,verse}`, `to: {chapter,verse}` | `Verse[]` | 闭区间连续经文，可跨章；起止颠倒时自动交换 |
| `bible:search` | `{ keywords?: string[] \| string, mode?: 'all' \| 'any', limit?: number }` | `SearchHit[]` | 多关键字查找，见 §3 |

其中：

```ts
type Verse     = { bookId: number, chapter: number, verse: number, text: string };
type SearchHit = Verse & { bookName: string };
```

> 节号字段统一为 **`verse`**（早期实现中曾叫 `v`，已统一）。
> 渲染层 `src/renderer/js/state.js` 的 `verseNumber()` 仍兼容旧的 `v` 字段，
> 以便旧数据或旧缓存不至于崩溃。

`keywords` 既接受数组，也接受以空格 / 逗号 / `，` / `、` 分隔的字符串（方便从界面直接传值）。
`mode` 缺省为 `all`（全部命中），`limit` 缺省 500。

### 设置

| 方法 | 参数 | 返回 | 说明 |
| --- | --- | --- | --- |
| `bible:getSettings` | — | `Settings` | 读取当前设置（与磁盘默认值合并后的结果） |
| `bible:setSettings` | `patch: Partial<Settings>` | `Settings` | 浅合并后写入磁盘，并广播 `settings-changed` |

`Settings` 字段：

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `fontFamily` | `string` | `微软雅黑` | 字体 |
| `fontSize` | `number` | `48` | 字号（px） |
| `lineHeight` | `number` | `1.8` | 行距倍数 |
| `textColor` | `string` | `#f5f5f5` | 文字颜色 |
| `bgColor` | `string` | `#101014` | 背景色 |
| `bgImage` | `string` | `''` | 背景图路径（空字符串表示不使用） |
| `italic` | `boolean` | `false` | 斜体 |
| `underline` | `boolean` | `false` | 下划线 |
| `showNotes` | `boolean` | `false` | 预留：显示注释 |
| `versesPerPage` | `number` | `1` | 每页节数 |
| `traditional` | `boolean` | `false` | 是否繁体（`true` = 繁体） |
| `theme` | `'dark' \| 'light'` | `dark` | 深 / 浅主题 |

> `traditional` 同时决定经文取数版本：`false` → `simplified`，`true` → `traditional`。
> 取数版本由主进程根据当前设置解析，渲染层不需要在每个请求里重复传参。

### 历史与收藏

| 方法 | 参数 | 返回 | 说明 |
| --- | --- | --- | --- |
| `bible:getHistory` | — | `HistoryEntry[]` | 最近查看的经文，最新在前 |
| `bible:addHistory` | `entry: { bookId, chapter, verse, label? }` | `HistoryEntry[]` | 写入一条；同 `bookId:chapter:verse` 去重并置顶，上限 200 条 |
| `bible:clearHistory` | — | `[]` | 清空历史 |
| `bible:getSaved` | — | `SavedEntry[]` | 收藏列表 |
| `bible:saveVerse` | `entry: { bookId, chapter, verse, label? }` | `SavedEntry[]` | 加入收藏；已存在则不重复添加，上限 500 条 |
| `bible:removeSaved` | `id: string` | `SavedEntry[]` | 按 id 移除收藏 |

条目结构：

```ts
{
  id: string;      // `${Date.now()}-${随机串}`
  bookId: number;
  chapter: number;
  verse: number;
  label: string;   // 例如「创世记 1:1」
  at: string;      // ISO 8601 时间戳
}
```

### 系统能力

| 方法 | 参数 | 返回 | 说明 |
| --- | --- | --- | --- |
| `bible:copyText` | `text: string` | `boolean` | 写入系统剪贴板；失败返回 `false` 并在主进程日志记录原因 |
| `bible:setFullscreen` | `flag: boolean` | `boolean` | 切换窗口全屏 |
| `bible:openExternal` | `url: string` | `boolean` | 用系统浏览器打开；非 `http(s)://` 一律拒绝 |
| `bible:appVersion` | — | `string` | `app.getVersion()` |

### 推送通道

| 通道 | 方向 | 载荷 | 说明 |
| --- | --- | --- | --- |
| `settings-changed` | 主进程 → 渲染进程 | `Settings` | `bible:setSettings` 成功后广播；多窗口 / 多标签下保持同步 |
| `fullscreen-changed` | 主进程 → 渲染进程 | `boolean` | 窗口进入 / 退出全屏时广播；由 `enter-full-screen` / `leave-full-screen` 事件触发 |
| `bible:shortcut` | 主进程 → 渲染进程 | `{ key, code, control, meta, shift, alt }` | 主进程在 `before-input-event` 阶段拦下的按键（如 `F5`），见 §5 |

预加载层把它们包装成订阅函数，**返回取消订阅函数**：

```js
const off = window.bible.onSettingsChanged((settings) => { /* ... */ });
const offFs = window.bible.onFullscreenChanged((flag) => { /* ... */ });
const offSc = window.bible.onShortcut((payload) => { /* ... */ });

// 不再需要时
off();
offFs();
offSc();
```

> `fullscreen-changed` 同时覆盖「点顶栏按钮进入投影模式」与「用户按系统键 / 拖动窗口标题栏退出全屏」两种情况，
> 渲染层据此保持投影界面与实际窗口状态一致。

---

## 3. 数据加载与查找策略

### 文件位置

| 文件 | 内容 |
| --- | --- |
| `data/bible-simplified.json` | 简体经文 |
| `data/bible-traditional.json` | 繁体经文 |

每个文件是一个二维数组，每行形如 `[bookId, chapter, verse, text]`，
即 **卷序号 : 章 : 节 : 经文**。详见 [docs/data.md](data.md)。

### 加载与索引

`src/main/bible.js` 的策略是 **按版本懒加载 + 内存索引**：

```js
const cache = { simplified: null, traditional: null };

function loadVersion(version) {
  if (cache[version]) return cache[version];
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const map = new Map();
  for (const row of raw) {
    map.set(`${row[0]}:${row[1]}:${row[2]}`, row[3]);
  }
  cache[version] = map;
  return map;
}
```

要点：

- **键是 `"卷:章:节"` 字符串**，取值是经文文本；一次解析即完成索引，后续查询都是哈希查找。
- **两个版本各自一份缓存**，只有真正切换版本时才加载另一份；同一进程内不会重复读盘。
- 整本和合本约 31,102 节，单份 JSON 体积在数 MB 量级，常驻内存是划算的：
  换来的是 O(1) 的定位，且省掉了一套索引重建逻辑。
- `DATA_DIR` 支持用环境变量 `BIBLE_DATA_DIR` 覆盖，便于测试用临时数据目录。

### 查询

| 查询 | 实现 | 复杂度 |
| --- | --- | --- |
| 整章 | 遍历 `Map`，按前缀 `"卷:章:"` 过滤，再按节号排序 | O(N) 遍历 + O(k log k) 排序（N = 3.1 万） |
| 区间 | 遍历 `Map`，用三元组比较函数判断是否落在闭区间内 | O(N) |
| 查找 | 遍历 `Map`，对每节做子串包含判断 | O(N × T × L) |

因为是全表线性扫描，**没有额外的倒排索引**。在 3.1 万节的规模下，
一次全表扫描在毫秒级完成，交互式使用的体验没有问题；
若将来要支持跨全库的复杂检索（例如按词频排序），再引入倒排索引才有必要。

### 多关键字匹配语义

```js
const matched = terms.filter((t) => text.includes(t)).length;
if (mode === 'any' ? matched > 0 : matched === terms.length) { /* 命中 */ }
```

- `mode: 'all'` —— 一节必须**同时包含全部**关键字；
- `mode: 'any'` —— 命中**任一**关键字即可；
- 关键字为空白字符时过滤掉；全部为空则直接返回 `[]`；
- 命中数达到 `limit`（默认 500）即停止扫描。

---

## 4. 持久化

### 存放位置

所有用户数据都在 Electron 的 `app.getPath('userData')` 目录下：

```
<userData>/settings.json     显示设置
<userData>/history.json      历史记录   { "items": [...] }
<userData>/saved.json        收藏       { "items": [...] }
```

`userData` 在 Windows 上默认是 `%APPDATA%\BibleProjection`（产品名 `BibleProjection`，
由 `package.json` 的 `build.productName` 决定），实际路径以 `app.getPath('userData')` 为准。

**经文数据不在这里** —— `data/` 是随安装包分发的只读资源，升级即更新。

### 写入策略

`src/main/store.js` 是一个极简 JSON 存储：

- 读取时用默认值与磁盘内容做**浅合并**，文件缺失或 JSON 损坏时回退到默认值并在主进程日志告警；
- 写入采用 **「写临时文件 + 原子重命名」**：

```js
fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf8');
fs.renameSync(tmp, this.filePath);
```

这样即使在写入过程中断电或进程被杀，原文件也不会被截断成半截 JSON；
写入失败时会清理临时文件并记录错误，不阻断界面。

- `get()` 返回浅拷贝，避免调用方意外改到内部状态。

---

## 5. 投影模式与标注层

投影模式是本项目最接近「演出场景」的部分，实现要点如下。

### 模式切换

- 入口是 `bible:setFullscreen`（主进程调用 `BrowserWindow.setFullScreen`），
  快捷键 `F5` 或 `F11` 进入 / 退出，顶栏的投影按钮是等价操作。
- 两条快捷键走的是不同路径，但**对用户是同一个动作**：
  - `F5` 由**主进程**在 `before-input-event` 阶段拦下（见下文「快捷键的接管路径」），
    经 `bible:shortcut` 转发给渲染层，由渲染层切换投影界面并调用 `bible:setFullscreen`；
  - `F11` **不走渲染层**，而是走系统原生全屏。主进程在 `enter-full-screen` /
    `leave-full-screen` 事件里广播 `fullscreen-changed`，渲染层据此把外观同步成
    投影模式（或恢复普通界面）。因此用系统键退出全屏时，投影界面也会同步恢复，
    不会出现「窗口已退出全屏但界面还停在投影样式」的错位。
- 投影模式是**同一个窗口的另一种呈现状态**，不是第二个窗口：
  好处是设置、历史、收藏的状态天然共享，切换时无需同步。
- 全屏时隐藏所有编辑类控件（查找框、设置面板、卷目侧栏），只保留经文层与
  投影工具条，避免投影时把操作痕迹投出去。
- `Esc` 是**分层退出的**：先关闭当前打开的面板 → 再退出绘制模式 → 再退出投影模式。
  因此误按 `Esc` 不会一次把投影关掉。
- 为什么 `F5` 不会被系统菜单抢走：应用菜单里「重新加载」角色**显式改绑**到
  `CmdOrCtrl+R`，把 `F5` 空出来留给「切换投影模式」；`togglefullscreen` 角色仍是 `F11`。
  同理，菜单里没有 `save` 角色，`Ctrl+S` 不会弹出保存框。

### 快捷键的接管路径

快捷键统一由渲染层的 `src/renderer/js/shortcuts.js` 处理，共两条路径，
**共用同一套 `runShortcut()` 判定逻辑**，并用 220 ms 的去重窗口避免同一次按键被处理两遍。

**路径一：DOM `keydown`（主路径）**

- 窗口的 `keydown` 事件；焦点在输入框 / 文本域时由 `isTypingTarget(event.target)` 直接放行，
  其余按键交给 `runShortcut()` 判定；被消费的按键会 `preventDefault()`。

**路径二：主进程转发（IPC 通道 `bible:shortcut`）**

用于那些**渲染层拦不住**的按键：Electron 的原生菜单加速键与浏览器默认行为发生在
页面之外，`event.preventDefault()` 对它们无效。

- 预加载层暴露 `onShortcut(callback)`，订阅 IPC 通道 `bible:shortcut`，返回取消订阅函数：

  ```js
  const off = window.bible.onShortcut((payload) => { /* payload 见下 */ });
  ```

- 主进程在 `createWindow()` 里用 `webContents.on('before-input-event')` 拦截 **F5**：

  ```js
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || input.key !== 'F5') return;
    event.preventDefault();                      // 阻止 Electron 默认的「重新加载」
    mainWindow.webContents.send('bible:shortcut', {
      key: 'F5',
      code: input.code || 'F5',
      control: false,
      meta: false,
      shift: false,
      alt: false,
    });
  });
  ```

- 转发载荷形状为 `{ key, code, control, meta, shift, alt }`；
  渲染层的 IPC 分支先校验 `payload.key` 是字符串，再用
  `isTypingTarget(document.activeElement)` 确认焦点不在输入控件里
  （与 DOM 分支的放行规则保持一致），最后交给 `runShortcut()`。

> F11 不走这条通道：它由系统原生全屏处理，主进程在 `enter-full-screen` /
> `leave-full-screen` 时广播 `fullscreen-changed`，渲染层据此同步投影外观。

### 分层结构

界面采用两层叠加：

```
┌───────────────────────────────┐
│  经文层  <div class="verses">  │  ← 可滚动，随设置改变字体 / 颜色 / 背景
│                               │
├───────────────────────────────┤
│  标注层  <canvas>              │  ← 绝对定位覆盖在经文层之上
└───────────────────────────────┘
```

- 标注层是**独立的 `<canvas>`**（`#draw-canvas`），不与经文 DOM 混在一起：
  这样滚动经文时笔迹可以按需固定在视口或随内容移动，两种行为都容易实现；
  清空标注也只需清空画布状态。
- 画笔状态与经文内容**互不影响**：切换章节、切换简繁、切换主题都不会丢失标注，
  因为标注是叠在上面的独立图层。
- 画笔只做**基础笔迹**：画笔 / 擦除 / 撤销 / 重做 / 清空。
  不做调色板、形状识别、多图层，也不做屏幕录制。
- 投影工具条 `#draw-tools` 常驻舞台右上角，包含：开 / 关绘制、颜色色板、
  笔宽、撤销、清空按钮。工具条上的按钮与快捷键是等价操作。

### 笔迹数据模型

笔迹以**数据**而非像素保存，便于撤销重做与换算坐标：

```js
stroke = {
  tool: 'brush' | 'eraser',
  color: string,
  width: number,
  points: [{ x, y }, ...],   // 相对于标注层的逻辑坐标
}
```

- 笔画数组 `strokes[]` 是当前标注栈；
- **撤销栈**保存每一步操作前的 `strokes` 快照（结构化共享，成本低），
  重做栈同理；
- 坐标使用逻辑坐标（相对标注层尺寸），窗口缩放时按比例重绘，避免笔迹变形。

### 交互约定

| 操作 | 行为 |
| --- | --- |
| `D` 或 `P` | 切换画笔开 / 关 |
| 左键拖动 | 绘制笔迹 |
| `Ctrl` + 左键拖动 | 擦除 |
| `Z` 或 `Ctrl` + `Z` | 撤销上一笔 |
| `Ctrl` + `Shift` + `Z` | 重做 |
| `X` 或 `Ctrl` + `Shift` + `Delete` | 清空当前所有标注 |

画笔关闭时，标注层不拦截鼠标事件，鼠标滚轮与拖拽仍用于浏览经文。

### 与翻页的配合

投影时最常用的是「翻节」：

| 操作 | 行为 |
| --- | --- |
| `←` `→` / `↑` `↓` | 上一节 / 下一节 |
| `Space` | 下一节 |
| `PageUp` / `PageDown` | 按**「每页节数」**翻页（默认 1 节） |
| `Home` / `End` | 本章首节 / 本章末节 |
| `Ctrl` + `←` / `Ctrl` + `→` | 上一卷 / 下一卷 |
| `Ctrl` + `PageUp` / `Ctrl` + `PageDown` | 上一章 / 下一章 |
| 鼠标滚轮 | 下一节（投影模式下滚轮不用于滚动经文） |

翻节后：

- 若当前页仍有标注，标注保持不变（标注属于页面，不属于节）；
- 若切换导致「每页节数」重新分页，则清空当前页标注，避免旧笔迹盖在新内容上。

### 指针隐藏

投影模式下若 3 秒内没有鼠标移动，系统指针会自动隐藏；再次移动即恢复。
这样在讲台投影时不会有一只鼠标箭头留在画面上。

---

## 6. 目录速查

| 路径 | 作用 |
| --- | --- |
| `src/main/main.js` | 窗口、菜单、IPC 注册、默认值 `DEFAULT_SETTINGS` |
| `src/main/bible.js` | 经文加载、索引、查章 / 查范围 / 查找 |
| `src/main/store.js` | `JsonStore`：默认合并 + 原子写入 |
| `src/preload/preload.js` | `window.bible` API 白名单 |
| `src/shared/books.js` | 66 卷书目与 8 个分类的元数据 |
| `src/renderer/` | 界面（原生 JS / CSS，无构建步骤） |
| `data/` | 简繁经文 JSON（只读资源，随安装包分发） |
| `tools/extract-mdb.ps1` | 从原程序 MDB 重新抽取经文 |
| `test/` | `node --test` 单元测试 |
