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
│   versions.js 译本注册表（清单、解析、下载、导入，见 §8）   │
│   store.js   极简 JSON 持久化（设置 / 历史 / 收藏 / 标注）  │
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
│   float.html  浮动控制面板（独立无边框置顶小窗）            │
└──────────────────────────────────────────────────────────┘
```

> 应用一共会创建**两个窗口**：主窗口 `index.html` 与投影时浮在屏幕上方的小控制条
> `float.html`（`frameless` / `alwaysOnTop` / `transparent` / `skipTaskbar`）。
> 两者共用同一个 preload 与同一个 `window.bible` 桥，靠 IPC 互相驱动（见 §2）。

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
├── float.html      浮动控制面板的页面骨架
├── float.css       浮动控制面板的样式
└── js/             ES module（<script type="module"> 引入）
    ├── app.js         应用装配：把各模块装配起来
    ├── bridge.js      唯一的主进程访问入口（window.bible 的包装）
    ├── state.js       渲染层状态与设置归一化（mergeSettings）
    ├── shortcuts.js   全局快捷键处理（DOM keydown + IPC 通道）
    ├── sidebar.js     侧栏书目 / 章列表
    ├── stage.js       经文显示、翻节、复制（复制经文 / 分节 / 分节分行 / 当前节 / 章节标题）
    ├── panels.js      抽屉面板的开关调度
    ├── panel-search.js / panel-library.js / panel-help.js   各面板（查找面板含结果勾选与复制）
    ├── settings.js    显示设置的读写
    ├── projection.js  投影模式
    ├── draw.js        画笔 / 擦除 / 撤销 / 重做 / 文字标注
    ├── letterbar.js   字母 + 数字速选定位（CSJ4:14 一类输入）
    ├── contextmenu.js 显示区右键菜单（对齐原版 5.20 SP2：全屏显示_F5 / 复制 ▸ / 播放进度 ▸ / 不显示经文 / 打开画笔_Ctrl+P / 画笔颜色 ▸ / 画笔粗细 ▸ / 白色画笔_Ctrl+B / 橡皮擦_E / 清除画笔_Ctrl+E / 扩展桌面_F9 / 主题设置 ▸）
    ├── slideshow.js   投影模式自动翻页（幻灯放映）
    ├── bgm.js         背景音乐播放
    ├── highlight.js   查找结果高亮
    ├── float.js / floatlink.js   浮动控制面板及其与主窗口的联动
    ├── version.js     译本取值统一入口（当前译本 id、书名 / 短卷名 / 分类名）
    ├── panel-versions.js  顶栏译本下拉 + 「获取译本」面板（下载安装 / 本地导入 / 刷新）
    ├── i18n.js        文案表（含帮助面板的快捷键表）
    ├── util.js        通用小工具
    └── toast.js       轻提示
```

`index.html` 的骨架分四块：

| 区域 | 关键节点 | 作用 |
| --- | --- | --- |
| 顶栏 `topbar` | `data-open-panel`、`btn-projection`、`#version-select` / `#btn-versions` | 打开各面板、进入投影模式、译本下拉与「获取译本」 |
| 侧栏 `sidebar` | `sidebar-body` | 66 卷书目（8 分类）与章列表 |
| 舞台 `stage` | `#verses`、`#stage-scroll`、`canvas#draw-canvas`、`#draw-tools`、`#stage-foot` | 经文显示区 + 标注画布 + 绘画工具条 |
| 抽屉 `drawer` | `#panel-search` / `#panel-settings` / `#panel-history` / `#panel-saved` / `#panel-help` / `#panel-versions` | 查找、设置、历史、收藏、帮助、获取译本六个面板 |

渲染层**不直接触碰 `ipcRenderer`**，所有特权调用都经过 `src/renderer/js/bridge.js`：

- 它是 `window.bible` 的唯一调用点，页面其余代码只依赖 bridge 导出的函数；
- 当 bridge 不可用（例如在浏览器里直接打开 `index.html`）时，bridge 会退化为
  **stub 替身**并用 toast 提示，而不是抛出未捕获异常；
- bridge 负责把 IPC 的原始返回整理成渲染层可用的结构，并统一处理译本切换等派生状态。

---

## 2. IPC 契约

所有通道名统一使用 `bible:` 前缀，均为 **request / response** 语义（`ipcRenderer.invoke`）。
除 `settings-changed` 与 `fullscreen-changed` 外，浮动控制面板还使用 `bible:float-state` 与
`bible:float-command` 两条推送通道（主进程 ↔ 面板），详见 §6。

### 经文数据

| 方法 | 参数 | 返回 | 说明 |
| --- | --- | --- | --- |
| `bible:getBooks` | — | `Book[]` | 全部 66 卷的书目信息（来自 `src/shared/books.js`；该文件缺失时返回空数组） |
| `bible:getChapter` | `bookId: number`, `chapter: number`, `version?: string` | `Verse[]` | 整章经文，按节号升序；章不存在返回 `[]`。`version` 可选：省略＝当前译本，传入译本 id＝取该译本（多版本对照用） |
| `bible:getRange` | `bookId: number`, `from: {chapter,verse}`, `to: {chapter,verse}`, `version?: string` | `Verse[]` | 闭区间连续经文，可跨章；起止颠倒时自动交换。`version` 可选，语义同 `bible:getChapter` |
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
| `versesPerPage` | `number` | `1` | 每页节数（`1` = 整章连续显示；`≥2` 时普通模式按页开窗，投影模式按屏显示） |
| `traditional` | `boolean` | `false` | 是否繁体（`true` = 繁体） |
| `theme` | `'dark' \| 'light'` | `dark` | 深 / 浅主题 |
| `textShadow` | `boolean` | `false` | 是否启用文字阴影 |
| `shadowColor` | `string` | `#000000` | 阴影颜色 |
| `shadowBlur` | `number` | `10` | 阴影模糊半径 |
| `shadowOffset` | `number` | `2` | 阴影偏移量 |
| `bgmPath` | `string` | `''` | 背景音乐文件路径（空字符串表示不播放） |
| `bgmVolume` | `number` | `50` | 背景音乐音量（0–100） |
| `slideshowInterval` | `number` | `0` | 幻灯放映间隔（秒），`0` 表示关闭 |
| `floatPanel` | `boolean` | `false` | 浮动控制面板是否常驻 |
| `titleFontFamily` | `string` | `''` | 标题字体（空字符串 = 跟随 `fontFamily`） |
| `titleColor` | `string` | `''` | 标题颜色（空字符串 = 跟随 `textColor`） |
| `verseNumberColor` | `string` | `''` | 节号颜色（空字符串 = 跟随主题强调色） |
| `currentVerseColor` | `string` | `''` | 当前节（翻节高亮）经文颜色（空字符串 = 跟随主题强调色 `var(--gold)`） |
| `padding` | `number` | `0` | 经文区四边缩进（px，0–120，背景图仍满屏） |

> 这四个字段已由主进程预留，并由渲染层设置面板接入、实际生效（见
> [docs/feature-audit.md](feature-audit.md)）。渲染层把它们映射为 CSS 变量
> `--title-font` / `--title-color` / `--verse-no-color` / `--stage-pad`。
> `currentVerseColor` 映射为 `--current-verse-color`（留空时直接移除该变量，
> 由 CSS 的 `var(--current-verse-color, var(--gold))` 回退到主题金色）。

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

- 历史记录**按 `bookId:chapter:verse` 去重并置顶**，上限 200 条；收藏上限 500 条且不重复添加。
- 渲染层只在**真正翻到某一节时**才写历史，因此启动时不会误写一条空记录；
  连续翻阅多节时，中间经过的每一节都会被记录。
- 条目只保存经文的**位置**（`label` = 书卷名 + 章:节）；面板展示时再按当前译本
  取回该节的经文正文，因此切换译本后历史与收藏依然可读。

### 系统能力

| 方法 | 参数 | 返回 | 说明 |
| --- | --- | --- | --- |
| `bible:copyText` | `text: string` | `boolean` | 写入系统剪贴板；失败返回 `false` 并在主进程日志记录原因 |
| `bible:setFullscreen` | `flag: boolean` | `boolean` | 切换窗口全屏 |
| `bible:openExternal` | `url: string` | `boolean` | 用系统浏览器打开；非 `http(s)://` 一律拒绝 |
| `bible:appVersion` | — | `string` | `app.getVersion()` |
| `bible:pickImage` | — | `string \| null` | 弹出系统「打开文件」对话框选择背景图；取消返回 `null`。只放行 `jpg / jpeg / png / bmp / gif / webp` |
| `bible:pickAudio` | — | `string \| null` | 同上，选择背景音乐；只放行 `mp3 / wav / m4a / flac / ogg / aac` |
| `bible:toggleFloatPanel` | `visible: boolean` | `boolean` | 显示 / 隐藏浮动控制面板；`false` 时关闭浮窗并把设置里的 `floatPanel` 复位 |

### 标注持久化

| 方法 | 参数 | 返回 | 说明 |
| --- | --- | --- | --- |
| `bible:getAnnotations` | `key: string` | `Stroke[]` | 读取指定「书卷:章」的笔迹；没有记录返回 `[]` |
| `bible:saveAnnotations` | `key: string`, `strokes: Stroke[]` | `Stroke[]` | 覆盖写入该章的笔迹；传入空数组等价于**删除**该章记录 |

- `key` 的格式是 `"<bookId>:<chapter>"`，由渲染层生成；
- 笔迹数组整体读写，**不做逐笔合并**，因此撤销 / 重做只需在渲染层维护，
  落盘时始终写入当前完整数组；
- 存储位置见 §4 的 `annotations.json`；
- 渲染层在进入某章时读一次、每次落笔后写一次（`src/renderer/js/draw.js`）。

### 译本管理

| 方法 | 参数 | 返回 | 说明 |
| --- | --- | --- | --- |
| `bible:listVersions` | — | `VersionInfo[]` | 返回译本清单：清单条目 + 本地已安装状态（详见 §8） |
| `bible:installVersion` | `id: string` | `{ ok, id?, name?, verses?, error? }` | 从信望愛 FHL API 下载并安装指定译本；下载期间通过 `bible:version-progress` 推送进度 |
| `bible:importVersionFile` | — | `{ ok, canceled?, id?, name?, verses?, error? }` | 弹出系统「打开文件」对话框导入本地译本 JSON；取消返回 `{ ok: false, canceled: true }` |

### 推送通道

| 通道 | 方向 | 载荷 | 说明 |
| --- | --- | --- | --- |
| `settings-changed` | 主进程 → 渲染进程 | `Settings` | `bible:setSettings` 成功后广播；多窗口 / 多标签下保持同步 |
| `fullscreen-changed` | 主进程 → 渲染进程 | `boolean` | 窗口进入 / 退出全屏时广播；由 `enter-full-screen` / `leave-full-screen` 事件触发 |
| `bible:shortcut` | 主进程 → 渲染进程 | `{ key, code, control, meta, shift, alt }` | 主进程在 `before-input-event` 阶段拦下的按键（如 `F5`），见 §5 |
| `bible:float-state` | 主进程 → 面板窗口 | 状态对象 | 主进程把主窗口的最新状态转发给浮动控制面板 |
| `bible:float-command` | 主进程 → 主窗口 | 命令对象 | 面板上的操作（翻节、开关投影等）经主进程转发回主窗口 |
| `bible:version-progress` | 主进程 → 渲染进程 | `{ id, done, total, percent }` | 下载译本时的进度推送，`done` / `total` 为已完成的卷数 |
| `bible:versions-changed` | 主进程 → 渲染进程 | `VersionInfo[]` | 译本安装 / 导入成功后广播新的清单，渲染层据此刷新下拉框 |

预加载层把它们包装成订阅函数，**返回取消订阅函数**：

```js
const off = window.bible.onSettingsChanged((settings) => { /* ... */ });
const offFs = window.bible.onFullscreenChanged((flag) => { /* ... */ });
const offSc = window.bible.onShortcut((payload) => { /* ... */ });
const offFloatState = window.bible.onFloatState((payload) => { /* ... */ });
const offFloatCmd = window.bible.onFloatCommand((payload) => { /* ... */ });
const offProgress = window.bible.onVersionProgress((info) => { /* ... */ });
const offVersions = window.bible.onVersionsChanged((list) => { /* ... */ });

// 不再需要时
off();
offFs();
offSc();
offFloatState();
offFloatCmd();
offProgress();
offVersions();
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
<userData>/annotations.json  画笔标注   { "items": { "<bookId>:<chapter>": Stroke[] } }
<userData>/versions/         已安装译本  <id>.json + <id>.meta.json（见 §8）
```

`userData` 在 Windows 上默认是 `%APPDATA%\BibleProjection`（产品名 `BibleProjection`，
由 `package.json` 的 `build.productName` 决定），实际路径以 `app.getPath('userData')` 为准。

**经文数据不在这里** —— `data/` 是随安装包分发的只读资源，升级即更新。
唯一的例外是**用户自行安装的译本**：它们受版权保护、不进仓库，只能落在
`<userData>/versions/` 里（见 §8）。

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
- 投影时**抽屉面板不再打断**：打开的设置 / 查找等面板会被收起，不会盖在投影内容上。
- 投影时**经文不被裁切**：正文按可用高度自适应，不出现上下被切掉的情况。
- `Esc` 在投影中**一次直接退出投影模式**（普通模式下仍按「关面板 → 退出绘制 → 关面板」
  的顺序逐层退出）。
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
- 画笔状态与经文内容**互不影响**：切换章节、切换译本、切换主题都不会丢失标注，
  因为标注是叠在上面的独立图层。
- 画笔只做**基础笔迹**：画笔 / 擦除 / 撤销 / 重做 / 清空。
  不做调色板、形状识别、多图层，也不做屏幕录制。
- 投影工具条 `#draw-tools` 常驻舞台右上角，包含：开 / 关绘制、颜色色板、
  笔宽、撤销、清空按钮。工具条上的按钮与快捷键是等价操作。

### 笔迹数据模型

笔迹以**数据**而非像素保存，便于撤销重做与换算坐标：

```js
stroke = {
  type: 'line' | 'rect' | 'circle' | 'seg' | 'text',
  color: string,          // 文本标注无此字段
  width: number,
  points: [{ x, y }, ...], // 相对于标注层的逻辑坐标
  start: { x, y },        // rect / circle / seg 的起点
  end: { x, y },          // rect / circle / seg 的终点
  text: string,           // 仅 type === 'text'
  x: number, y: number,   // 仅 type === 'text'：文字标注的锚点
}
```

- `line` 是自由画线（`points` 为完整轨迹）；`rect` / `circle` / `seg` 只保留 `start` 与 `end`；
  `text` 是双击画布添加的文字标注。
- 笔画数组 `strokes[]` 是当前标注栈；
- **撤销栈**保存每一步操作前的 `strokes` 快照（结构化共享，成本低），
  重做栈同理；
- 坐标使用逻辑坐标（相对标注层尺寸），窗口缩放时按比例重绘，避免笔迹变形。

### 交互约定

| 操作 | 行为 |
| --- | --- |
| `Ctrl` + `B` / `Ctrl` + `P` / `D` | 切换画布开 / 关 |
| 左键拖动 | 自由画线 |
| `Shift` + 拖动 | 画矩形 |
| `Ctrl` + 拖动 | 画圆形 |
| `Alt` + 拖动 | 画线段 |
| `E` | 橡皮擦开关 |
| `1`…`6` | 画笔粗细 |
| `W` / `G` / `L` / `B` / `Y` / `R` | 画笔颜色 |
| 双击画布 | 添加文字标注（黑体 30 号 · 黄底深红字 · 30 字以内） |
| `Z` 或 `Ctrl` + `Z` | 撤销上一笔 |
| `Ctrl` + `Shift` + `Z` | 重做 |
| `Ctrl` + `E` 或 `X` | 清空本章标注 |

> **单字母键的适用范围**：`E`、`1`…`6`、`W` / `G` / `L` / `B` / `Y` / `R`、`Z`、`X`、`D`
> 在**普通模式**下会被「字母速选」条占用（原版同样以字母输入优先），
> 因此只在投影 / 绘制模式下生效；普通模式请用 `Ctrl` + `B` 或 `Ctrl` + `P` 开关画布。

画笔关闭时，标注层不拦截鼠标事件，鼠标滚轮与拖拽仍用于浏览经文。

### 与翻页的配合

投影时最常用的是「翻节」：

| 操作 | 行为 |
| --- | --- |
| `←` `→` / `↑` `↓` | 上一节 / 下一节 |
| `Space` | 下一节 |
| `PageUp` / `PageDown` | 按**「每页节数」**翻页（`1` = 整章显示） |
| `Home` / `End` | 本章首节 / 本章末节 |
| `Ctrl` + `←` / `Ctrl` + `→` | 上一卷 / 下一卷 |
| `Ctrl` + `PageUp` / `Ctrl` + `PageDown` | 上一章 / 下一章 |
| `Shift` + `>` / `Shift` + `<` | 增减显示的经文节数（原版「方法5」）：有速选范围时增减该范围末节，没有范围时增减「每页节数」 |
| 鼠标滚轮 | 下一节（投影模式下滚轮不用于滚动经文） |

翻节后：

- 标注属于**章节**（按「书卷:章」落盘），因此翻节不会改变当前章已有的标注；
- 换章时载入新章的标注栈（若该章此前标注过，会被恢复）；
- 画布清空（`Ctrl` + `E` / `X`）只作用于**当前章**，并同步删除该章在
  `annotations.json` 里的记录。

### 当前节的高亮与智能滚动（`stage.js`）

| 机制 | 说明 |
| --- | --- |
| 当前节 | `state.current.verse`；对应节点带 `.is-current` 类，`.verse-text` 用 `var(--current-verse-color, var(--gold))` 着色（设置项 `currentVerseColor` 为空时跟随主题色） |
| 切换方式 | `↓` / `↑` 翻节；**鼠标点击某一节**同样切换（`stage.js → selectVerse(chapter, verse)`）；点到下一章的经文按正常跳转处理 |
| 舒适区 | `READ_ZONE = { top: 0.14, bottom: 0.46 }`（占滚动视口高度的比例） |
| 智能滚动 | `smartScrollToCurrent()`：当前节已在舒适区 → 屏幕完全不动；偏下 → `smoothScrollBy()` 用 easeInOutCubic 缓慢上移（420ms，可被打断）；偏上（往上翻）→ 缓慢下移 |
| 点选不换页 | 鼠标点选会写入 `state.anchor`（显示窗口起点），`displayVerses()` 用 `clamp((anchor || verse) - 1, …)` 开窗，因此点一下不会把「每页节数」窗口挪走；普通导航（`goToVerse`）会清空 `anchor` |
| 例外 | 画笔模式（`body.drawing`）、双击/三击、刚刚用鼠标拖选过文字时，点击不触发切换 |

### 指针隐藏

投影模式下若 3 秒内没有鼠标移动，系统指针会自动隐藏；再次移动即恢复。
这样在讲台投影时不会有一只鼠标箭头留在画面上。

---

## 6. 浮动控制面板（第二个 BrowserWindow）

投影时讲台上的操作者往往够不到键盘，因此有一个独立的**浮动控制面板**：
一个无边框、置顶、不占任务栏的小浮窗，贴在屏幕上方。

### 窗口形态

| 属性 | 取值 | 作用 |
| --- | --- | --- |
| `frame` | `false` | 无边框 |
| `alwaysOnTop` | `true` | 始终置顶 |
| `transparent` | `true` + `backgroundColor: '#00000000'` | 圆角浮窗、只显示控件本身 |
| `skipTaskbar` | `true` | 不在任务栏留下条目 |
| `resizable` / `fullscreenable` | `false` | 固定尺寸，不参与全屏 |
| `show` | 先 `false`，`ready-to-show` 后再 `show()` | 避免白屏闪烁 |

- 浮窗加载的是**独立的页面入口** `src/renderer/float.html`
  （配 `src/renderer/float.css` 与 `src/renderer/js/float.js`），
  与主窗口的 `index.html` 是两个页面、两条渲染进程，但**共用同一个 preload**，
  因此两边拿到的是同一个 `window.bible` 白名单 API。
- 浮窗关闭（`closed` 事件）时，主进程会把设置里的 `floatPanel` 复位为 `false`，
  避免下次启动时状态不一致。
- 浮窗有 **5 个标签页**：经文选择、查找、格式、新约、旧约。
  「新约 / 旧约」两页是**真实目录**（新约 27 卷、旧约 39 卷），
  点某一卷会让主窗口跳到该卷第 1 章；「格式」页提供字号 ± 与主题切换。

### 显隐与总开关

- 顶栏有一个**总开关**按钮；设置面板里也有同名开关（`settings.floatPanel`）。
- 浮窗关闭时鼠标移到**主窗口显示区左缘**会再次唤出（悬停显隐），
  鼠标移开后自动隐藏，实现「需要时出现、不打扰投影」。
- 显隐最终都收敛到同一个 IPC：`bible:toggleFloatPanel(visible)`。

### 双向通道

面板与主窗口之间通过**主进程中转**，主进程自己不解释语义，只做转发：

```
主窗口渲染进程                      主进程                        面板渲染进程
      │                                                        │
      │  bible:floatState(payload)  ──invoke──▶  sendToFloat(   │
      │                                        'bible:float-state') ──▶ │
      │                                                        │
      │  ◀── send('bible:float-command', payload) ──  invoke ──  │
      │        bible:floatCommand(payload)  ──invoke──▶        │
```

| IPC | 方向 | 载荷 | 说明 |
| --- | --- | --- | --- |
| `bible:floatState` | 主窗口 → 主进程 → 面板 | 状态对象（当前经文位置、设置摘要、投影状态等） | 主窗口在导航、投影、设置变化时推送最新状态给面板 |
| `bible:floatCommand` | 面板 → 主进程 → 主窗口 | 命令对象（翻上一节 / 下一节、开关投影、收藏等） | 面板上的按钮经主进程转发回主窗口执行 |

- 面板一侧用 `window.bible.onFloatState(...)` 订阅状态、用
  `window.bible.onFloatCommand(...)` 接收命令；
- 主窗口一侧用 `window.bible.sendFloatState(...)` 推送状态、
  `window.bible.onFloatCommand(...)` 处理面板发来的命令；
- 两个窗口都订阅 `settings-changed`，因此在任一侧改设置，两侧都会刷新。

> 面板与主窗口是**两个独立页面**，不是同一个页面的两个实例；
> 因此状态同步完全依赖上述两个通道，不共享 DOM。

---

## 7. 复制语义（对齐原版）

原版术语：**章节**＝显示区标题，**经文**＝标题＋经文（help/12.jpg、help/16.jpg、doc §L155–157）。

| 用户操作 | 实现 | 输出形态 |
| --- | --- | --- |
| `Ctrl` + `C` | `stage.js → copyCurrent()` | **复制经文**＝`【创1:10-11】` 章节引用 ＋ 当前显示的经文（原版同形，引用与正文同一行）；格式由设置项 `copyFormat` 决定（`text` 连排一行不带节号 / `section` 各节带节号连成一行 / `line` 引用独占一行＋每节一行带节号）。显示区重绘后会清除旧选区，因此 `Ctrl` + `C` 永远复制当前显示内容 |
| `Alt` + `C` | `stage.js → copyTitleOnly()` | **复制章节**＝仅章节引用 `【创1:10-11】` |
| 右键 → 复制 ▸ → 复制章节_Alt+C | `stage.js → copyTitleOnly()` | **复制章节**＝仅标题（原版该项在「复制」子菜单内） |
| 右键 → 复制 ▸ → 复制经文_Ctrl+C | `stage.js → copyTextVariant('plain')` | 同 `Ctrl` + `C` 的连排形态 |
| 右键 → 复制 ▸ → 复制经文(分节) | `copyTextVariant('numbered')` | `【创1:2-5】` ＋ 各节正文带节号连成一行（`2地是空虚混沌…3神说…`） |
| 右键 → 复制 ▸ → 复制经文(分节分行) | `copyTextVariant('lines')` | `【创1:2-5】` 独占一行 ＋ 每节一行、每行带节号 |
| 右键 → 打开画笔_Ctrl+P / 画笔颜色 ▸ / 画笔粗细 ▸ / 白色画笔_Ctrl+B / 橡皮擦_E / 清除画笔_Ctrl+E | `draw.js → toggleDraw() / setDrawColor() / setDrawWidth() / toggleEraser() / clearDraw()` | 与原版 5.20 SP2 实测菜单一致（画笔只在投影模式下生效，菜单动作会先进入投影） |
| 右键 → 播放进度 ▸ / 不显示经文 / 扩展桌面_F9 / 主题设置 ▸ | `slideshow.js / stage.js / settings.js` | 自动翻页的暂停 / 继续 / 停止、隐藏经文、桌面扩展提示、深色 / 浅色主题 |
| 查找面板 `Ctrl` + `C` / 「复制经文」 | `panel-search.js → copySearchResults('both')` | 勾选的结果（未勾选＝当前已展示的结果），每行「章节 经文」 |
| 查找面板「复制章节」 | `copySearchResults('title')` | 每行只有「章节」（`书卷 章:节`） |

要点：

- 复制的是**当前显示区**里的经文，受速选范围（`CSJ2:1-10`）与「每页节数」影响，不是整章。
- 速选范围在翻节时**整块平移**：`stage.js → moveVerse()` 检测到 `state.range` 时按范围长度整体移到下一段（`2–4` → `5–7`），屏幕上的节数保持不变；越出本章边界才退回普通翻节并取消范围。
- 复制格式是设置项 `copyFormat`（`main.js` 与 `state.js` 的 `DEFAULT_SETTINGS` 各存一份，渲染层 `mergeSettings()` 白名单校验），可在「设置 → 复制经文格式」里切换。
- 查找结果支持多选：结果行左侧复选框勾选后，复制按钮只复制勾选的那些（对应原版按所选列决定复制内容）。
- `Ctrl` + `C` 的语义随上下文切换：查找抽屉打开时复制查找结果，否则复制显示区经文。

## 8. 多译本架构

仓库内置**公有领域的和合本**（简体 / 繁体）；吕振中译本、和合本修订版 2010、中文标准译本、
现代中文译本 2019、环球新译本**受版权保护**，**不随仓库与安装包分发**，
由使用者在应用内下载或从本地 JSON 导入（存入 `%APPDATA%\BibleProjection\versions\`）。
译本清单与版权详见 [译本清单与版权](versions.md)。

### 8.1 总体数据流

```
data/versions/manifest.json                ← 仓库内：译本清单（只有元信息，无正文）
        │
        ▼  versions.loadManifest()
src/main/versions.js  ──listVersions()──►  IPC  ──►  渲染层「译本下拉」
        │                                                    │
        │ resolveVersionFile(id)                              │ 设置 settings.version
        ├─ bundled=true  → data/<file>                        ▼
        └─ 否则          → %APPDATA%/BibleProjection/versions/<id>.json
                                     ▲                              │
                                     │ installVersion(id)          │ bible:getChapter / getRange / search
                                     │   ← 信望愛 FHL API          │   （按 settings.version 取数）
                                     │ importVersionFile(path)     ▼
```

### 8.2 译本清单 manifest.json

清单文件位于 `data/versions/manifest.json`，格式为 `{"versions": [ ... ]}`：

| 字段 | 含义 |
| --- | --- |
| `id` | 译本标识，同时也是 `settings.version` 的取值 |
| `name` | 界面显示名（如「和合本（简体）」） |
| `bundled` | `true` 表示正文随仓库与安装包分发；`false` 表示不随仓库分发，需自行下载或导入。**当前有 3 条为 `true`：和合本简 / 繁、吕振中译本**（三者均属公有领域） |
| `file` | 正文文件名，相对 `data/` 目录；**仅 `bundled: true` 的条目有**（和合本简 / 繁是 `data/bible-*.json`，吕振中是 `data/versions/lcc.json`） |
| `fhlVersion` | 信望愛 API 的版本参数，用于在线下载 |
| `copyright` / `source` | 版权归属与正文来源，界面会显示 |
| `lang` | 语言标记，如 `zh-Hans` / `zh-Hant` |
| `offlineDownload` | FHL `abv.php` 的 `candownload`：该译本是否开放离线下载授权。`false` 的译本在面板上带「需授权确认」标签，下载前会弹确认框 |

读取失败（文件缺失或格式不对）时，`versions.loadManifest()` 回退到 `versions.js` 内置的
`DEFAULT_MANIFEST`（**只有和合本简 / 繁两条**），应用不会因此启动失败；
此时译本列表会退化为这两个译本，其余 5 个译本（吕振中 + 4 个受版权译本）需把清单文件补回 `data/versions/manifest.json`。

### 8.3 译本文件的解析顺序

`versions.resolveVersionFile(id)` 按下面的顺序定位正文文件：

1. 清单条目 `bundled === true` 且 `file` 存在 → 依次尝试 `data/<file>` 与 `data/versions/<file>`
   （仓库内；目前是 `data/bible-simplified.json` / `data/bible-traditional.json` / `data/versions/lcc.json`）；
2. 否则 → `%APPDATA%\BibleProjection\versions/<id>.json`（用户下载 / 导入目录）；
3. 两者都不存在 → 返回 `null`，`versions.isInstalled(id)` 为 `false`。

用户数据目录来自 Electron 的 `app.getPath('userData')`，即
`%APPDATA%\BibleProjection`；其下再建一个 `versions` 子目录存放译本正文与 `<id>.meta.json`。

### 8.4 主进程模块 src/main/versions.js

| 导出 | 作用 |
| --- | --- |
| `loadManifest()` | 读取并缓存 `data/versions/manifest.json`，失败回退内置清单 |
| `listVersions()` | 合并清单与本地已安装状态；本地存在但清单里没有的译本（如手工导入）也会补进来 |
| `resolveVersionFile(id)` / `isInstalled(id)` | 按 8.3 的顺序定位正文、判断是否可读 |
| `installVersion(id, { onProgress })` | 从 FHL API 下载 66 卷 → 清洗文本 → 写入 `%APPDATA%\BibleProjection\versions\<id>.json` + `<id>.meta.json`；**清单里 `bundled: true` 的条目直接返回「该译本已内置」，不会下载**（和合本简 / 繁、吕振中） |
| `importVersionFile(path)` | 导入本地译本 JSON（`[书卷号, 章, 节, 正文]` 数组）；译本 id 取文件名 |
| `cleanText(raw)` | 去掉标题标签、`<br>`、行内注释（`([...])` / `（[...]）`）并压缩空白，规则与 `tools/fetch-versions.py` 一致 |

`listVersions()` 返回的每条记录形如：

```js
{ id, name, bundled, installed, copyright, source, lang, fhlVersion }
```

### 8.5 IPC 与事件

| 通道 | 方向 | 载荷 | 说明 |
| --- | --- | --- | --- |
| `bible:listVersions` | 渲染进程 → 主进程 | — | 返回 `VersionInfo[]` |
| `bible:installVersion` | 渲染进程 → 主进程 | `id: string` | 下载并安装；返回 `{ ok, id, name, verses }` 或 `{ ok: false, error }` |
| `bible:importVersionFile` | 渲染进程 → 主进程 | — | 主进程弹系统文件对话框；返回 `{ ok, id, name, verses }`、`{ ok: false, canceled: true }` 或 `{ ok: false, error }` |
| `bible:version-progress` | 主进程 → 渲染进程 | `{ id, done, total, percent }` | 下载进度；`done` / `total` 是已完成的卷数 / 总卷数 |
| `bible:versions-changed` | 主进程 → 渲染进程 | `VersionInfo[]` | 安装 / 导入成功后广播新清单 |

预加载层暴露：`listVersions()`、`installVersion(id)`、`importVersionFile()`、
`onVersionProgress(cb)`、`onVersionsChanged(cb)`，两个订阅函数都返回取消订阅函数。

### 8.6 顶栏译本下拉框与「获取译本」面板

顶栏有两个与译本相关的控件，**取代了原版的独立「简 / 繁」按钮**：

| 控件 | 位置 | 行为 |
| --- | --- | --- |
| `#version-select` 译本下拉框 | 顶栏 | 列出 `listVersions()` 返回的全部译本（当前 7 个：和合本简 / 繁、吕振中随程序内置，其余 4 个需先下载或导入）。只有文件缺失的译本才显示「XXX（未安装）」，**选中未安装的译本不会切换**，只 toast 提示「尚未安装，请先在「获取译本」中下载」并打开该面板；选中已安装的译本则写入 `settings.version` 并重新取数 |
| `#btn-versions` 「获取译本」按钮 | 顶栏 | 打开右侧抽屉里的 `#panel-versions` 面板并刷新列表 |

`#panel-versions` 面板（`src/renderer/js/panel-versions.js`）的约定：

- 顶部一行状态：`共 N 个译本，已安装 M 个`；
- 每个译本一行：名称 + 「已安装 / 未安装 / 内置」标签 + 来源与版权；
- 已安装的译本按钮是「使用此译本」，当前译本显示「当前译本」并禁用；
  未安装的译本按钮是「下载安装」，下载中显示进度条与百分比，并提供「停止跟踪」
  （只停止 UI 跟随，后台下载可能仍在继续）；
- 面板底部是「从本地文件导入…」与「刷新列表」；
- 安装或导入完成后主进程广播 `bible:versions-changed`，渲染层刷新列表并**自动切换到刚装好的译本**。

> 和合本简 / 繁、吕振中随程序内置（带「内置」标签且始终已安装）；其余 4 个译本默认是「未安装」，
> 面板里的主操作是「下载安装」——主进程按清单里的 `fhlVersion` 从信望愛 FHL 逐卷抓取，
> 写入 `%APPDATA%\BibleProjection\versions\`，下载中显示进度条，可「停止跟踪」；
> 其中 FHL 未开放离线下载授权（`candownload=0`，即和合本2010 / 中文标准 / 现代中文2019 / 环球新译本）
> 的译本会先弹「需授权确认」框，用户确认后才开始下载；
> 面板底部还可「从本地文件导入…」或「刷新列表」。
>
> 注意：主进程对 `bundled: true` 的条目**不会真的下载**，直接返回「该译本已内置」。

切换译本时（`switchVersion(id)`）渲染层依次做：写 `settings.version` → 清章节缓存
（否则会显示上一个译本的经文）→ 重新拉取当前章 → 若查找面板有关键字则按新译本重查。

### 8.7 当前译本 settings.version

- `settings.version` 是一个**译本 id 字符串**，取值集合为
  `simplified` / `traditional` / `lcc` / `rcuv` / `csb` / `tcv2019` / `ncv`，
  以及用户手工导入的任意 id。
- **繁简不再是正交的布尔开关**，切换简繁就是切换译本 id。
  旧设置里的 `traditional` 布尔量只作为**兼容回落**：当 `settings.version` 缺失时，
  `traditional ? 'traditional' : 'simplified'`；该开关在界面上不再暴露。
- 若当前 `settings.version` 对应的译本**未安装**（文件不存在），
  主进程 `currentVersion()` 回落为 `simplified`，避免界面空白。
- 渲染层的**书名规则**：只有 `version === 'traditional'` 用繁体书名，
  其余译本一律用简体书名（其他译本本身不分简繁）。

### 8.8 搜索 / 复制 / 速选如何按当前译本取数

主进程在三个取数入口统一带上当前译本 id：

| IPC | 取数 |
| --- | --- |
| `bible:getChapter(bookId, chapter)` | `bible.getChapter(bookId, chapter, currentVersion())` |
| `bible:getRange(bookId, from, to)` | `bible.getRange(bookId, from, to, currentVersion())` |
| `bible:search(payload)` | `bible.search(payload, currentVersion())` |

因此：

- **显示区**（逐章 / 跨章范围显示）取的是当前译本的正文；
- **查找**在当前译本的全文里搜，结果里的书卷名 / 分类名按当前译本给；
- **复制**复制的也是当前译本的正文（复制语义见 §7）；
- **速选定位**（`CSJ4:14` 一类）只决定「哪一卷哪一章哪一节」，正文仍由当前译本给出；
- 切换译本后需要重新取数：渲染层收到 `settings-changed` 后按新的 `settings.version` 重新拉取当前章。

> 已安装译本与内置和合本**同构**（同样的 `[书卷号, 章, 节, 正文]` 数组与同样的索引键
> `"卷:章:节"`），所以数据加载与查找策略（§3）对所有译本一致，只是数据文件来源不同。

### 8.9 多版本对比（逐节对照）如何取数

「获取译本」面板底部的「多版本对比」区块（`src/renderer/js/compare.js`）**不做左右分栏**：
正文仍是单栏，每一节下面逐个译本列出同一节正文。

| 位置 | 内容 |
| --- | --- |
| `state.compare` | `{ versions: string[], names: { id: 译本名 }, texts: { id: { 章: { 节: 正文 } } } }` |
| `state.compareSelection` | 面板里勾选待对比的译本 id 列表（最多 4 个） |
| 取数 | `ipc.getChapter(bookId, chapter, version)`→ 主进程 `bible.getChapter(bookId, chapter, version)` |
| 取数范围 | `compareChapters()`：当前章 + 下一章（普通模式会接上下一章连续显示） |
| 缓存 | `state.compare.texts[译本id][章][节]`，各译本互不串味 |
| 渲染 | `stage.js` 的 `verseNode()`：对比开启时每节生成 `.verse-compare-row`（`.verse-compare-label` = 「译本名 章:节」，`.verse-compare-text` = 正文）；关闭时回到普通的 `.verse-text`（含关键字高亮） |

对比的建立流程（`stage.startCompare()`）：

1. 取所选译本 id 列表（`compare.js` 的 `onStart()`，不足 2 个则不启动）；
2. `compareChapters()` 算出要取哪几章；
3. `fetchCompareTexts()` 逐译本逐章调 `ipc.getChapter()`，整理成 `texts` 映射；
4. 写入 `state.compare` 并 `renderStage()`；面板随即 `closePanel()`。

翻节 / 换章时 `goToVerse()` 会调用 `refreshCompare()` 重新取数，对照因此始终跟随当前位置；
「结束对比」（`stopCompare()`）清空 `state.compare` 并恢复单译本显示。

主进程侧只做了一处改动：`bible:getChapter` / `bible:getRange` 接受**可选**的 `version` 参数
（省略＝`currentVersion()`），因此不传时行为与从前完全一致。

## 9. 目录速查

| 路径 | 作用 |
| --- | --- |
| `src/main/main.js` | 窗口（主窗口 + 浮动面板）、菜单、IPC 注册、默认值 `DEFAULT_SETTINGS` |
| `src/main/bible.js` | 经文加载、索引、查章 / 查范围 / 查找 |
| `src/main/versions.js` | 译本清单、译本文件解析、译本下载与导入（见 §8） |
| `src/main/store.js` | `JsonStore`：默认合并 + 原子写入 |
| `src/preload/preload.js` | `window.bible` API 白名单 |
| `src/shared/books.js` | 66 卷书目与 8 个分类的元数据 |
| `src/renderer/index.html` | 主窗口页面骨架 |
| `src/renderer/float.html` | 浮动控制面板页面骨架 |
| `src/renderer/js/` | 渲染层 ES module（快捷键、投影、绘制、浮动面板、查找……） |
| `data/` | 内置和合本经文 JSON（简体 / 繁体，只读资源，随安装包分发） |
| `data/versions/manifest.json` | 译本清单（只有元信息，不含受版权保护的正文） |
| `tools/extract-mdb.ps1` | 从原程序 MDB 重新抽取经文 |
| `tools/fetch-versions.py` | 用户侧取数工具：从 FHL API 抓取译本到用户数据目录（不进 CI） |
| `tools/verify-versions.js` / `tools/clean-versions.js` | 译本文件校验与文本清洗（均不联网） |
| `test/` | `node --test` 单元测试 |
