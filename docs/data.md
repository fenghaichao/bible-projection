# 数据说明

本文说明本项目经文数据的来源、抽取流程、文件格式与统计口径。

---

## 1. 来源

| 项目 | 说明 |
| --- | --- |
| 文本版本 | **中文和合本（Chinese Union Version, 1919）** |
| 原始载体 | 原程序《语音投影圣经》5.20-SP2 无声版随附的 Access 数据库 `bibleNosound.dat` |
| 数据库类型 | Microsoft Access / **Jet 4.0**（MDB），OLEDB 提供程序 `Microsoft.Jet.OLEDB.4.0` |
| 数据库密码 | `pasitoldata`（写在连接串的 `Jet OLEDB:DataBase password=` 段） |
| 相关表 | `Bible`（简体经文）、`BibleF`（繁体经文）、`bibleid` / `bibleidF`（书目元数据） |

原程序的 `Bible` / `BibleF` 两张表结构完全相同，除了经文正文（`strjw`）之外还有一组
**语音相关列**（`soundname` / `soundstart` / `soundend`），指向随程序分发的 `.mp3` 语音文件。
**本项目不提取、不使用这些语音列**——无声版本就不提供朗读功能。

---

## 2. 抽取流程

抽取由仓库中的脚本完成，可复现：

```
tools/extract-mdb.ps1
```

### 运行要求

| 要求 | 说明 |
| --- | --- |
| 操作系统 | Windows（仅 32 位 Jet 4.0 提供程序可用） |
| PowerShell | **32 位** PowerShell 5.1 |
| OLEDB | `Microsoft.Jet.OLEDB.4.0`（64 位 Windows 默认不安装该提供程序） |
| 前置 | 已取得原程序的 `bibleNosound.dat` |

在 64 位 Windows 上必须调用 32 位 PowerShell：

```powershell
C:\Windows\SysWOW64\WindowsPowerShell\v1.0\powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools\extract-mdb.ps1 -DataFile "<原程序安装目录>\bibleNosound.dat"
```

> 脚本内置的 `-DataFile` 默认值指向原程序的默认安装目录；换机器运行时用 `-DataFile` 覆盖即可。
> `-Password` 默认即为 `pasitoldata`，仅在需要时传入。
>
> 脚本文件请保存为 **UTF-8 with BOM**（或 UTF-16LE），否则 Windows PowerShell 5.1 会用系统代码页
> 解码脚本，中文路径与中文注释会变成乱码。

### 脚本参数

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `-DataFile` | 原程序默认安装目录下的 `bibleNosound.dat` | 源数据库路径 |
| `-Password` | `pasitoldata` | Jet 数据库密码 |
| `-OutDir` | `<项目根>/data` | 经文 JSON 输出目录 |
| `-SharedDir` | `<项目根>/src/shared` | `books.js` 输出目录 |
| `-ReportFile` | `<项目根>/tools/extraction-report.txt` | 抽取报告输出路径 |

### 脚本的四个步骤

1. **连接**：用 OLEDB 打开数据库；**在连接之前**先计算源文件的 SHA-256
   （Jet 连接池会在 `Close()` 后仍短暂锁定 `.dat` 文件，晚一点打开文件会失败）。
2. **读取**：
   - `Bible` → `SELECT VolumeSN, ChapterSN, VerseSN, strjw FROM [Bible] ORDER BY VolumeSN, ChapterSN, VerseSN`
   - `BibleF` → 同上，繁体文本
   - `bibleid` / `bibleidF` → `SELECT SN, KindSN, ChapterNumber, VerseNumber, FirstSN, NewOrOld, PY, ShortName, FullName ... ORDER BY SN`
3. **校验**（结果写入抽取报告）：
   - 简体 / 繁体两套 `(卷, 章, 节)` 键集合是否一致
   - 重复键、`NULL` 文本、空文本、少于 3 字的文本
   - 每章的节号是否连续（有无缺号）
   - 每卷实际节数 / 章数是否与 `bibleid` 记录的 `VerseNumber` / `ChapterNumber` 相符
   - `FirstSN` 在 66 卷之间是否首尾相接
   - `bibleid` 与 `bibleidF` 的元数据是否逐字段一致
4. **写出**：
   - `data/bible-simplified.json`
   - `data/bible-traditional.json`
   - `src/shared/books.js`
   - `tools/extraction-report.txt`（行数、异常列表、输出文件的大小与 SHA-256）

---

## 3. 经文 JSON 的格式

内置的两个文件结构完全一致，只是文字分别为简体与繁体；用户安装的其他译本（§8）
用的是同一种行格式，只是分节与用字不同。

**顶层是一个二维数组**，每行是一个长度为 4 的数组：

```json
[
  [1, 1, 1, "起初神创造天地。"],
  [1, 1, 2, "地是空虚混沌，渊面黑暗；神的灵运行在水面上。"],
  [1, 1, 3, "神说：“要有光。”就有了光。"]
]
```

| 下标 | 含义 | 类型 | 说明 |
| --- | --- | --- | --- |
| `0` | 卷号 `bookId` | `number` | 1–66，与 `src/shared/books.js` 的 `id` 对应 |
| `1` | 章号 `chapter` | `number` | 从 1 开始 |
| `2` | 节号 `verse` | `number` | 从 1 开始 |
| `3` | 经文正文 | `string` | 单行文本，不含换行 |

### 约定

- **行序**：按 `(卷, 章, 节)` 升序，脚本在写文件前已用 SQL `ORDER BY` 排序。
- **无表头、无元信息**：文件是纯数组，解析时不需要跳过任何行。
- **UTF-8 无 BOM**，LF 换行。
- **没有行尾空行**，文件末尾就是 `]`。
- 正文里的引号按 JSON 规则转义（`\"`）；脚本自行做 JSON 字符串转义，
  不依赖 `ConvertTo-Json` 的区域性设置。

### 读取示例

```js
const fs = require('fs');
const rows = JSON.parse(fs.readFileSync('data/bible-simplified.json', 'utf8'));
// rows[0] === [1, 1, 1, '起初神创造天地。']
```

应用运行时不会重复解析这些文件——`src/main/bible.js` 会按译本把每个译本文件加载成一份
`Map<"卷:章:节", 经文>` 并各自缓存，详见 [architecture.md](architecture.md#3-数据加载与查找策略)。

### 渲染层如何按译本取数

内置的两个 JSON **结构完全一致、节数完全相同（各 31,102 节）、键集合完全一致**，
差别只在第 3 项的正文用字；其余译本（`lcc` / `rcuv` / `csb` / `tcv95` / `tcv2019` / `ncv`）
用的是同一种行格式，因此渲染层可以用同一套逻辑处理所有译本：

| 环节 | 译本如何切换 |
| --- | --- |
| 取数 | 主进程用 `currentVersion()`（`src/main/main.js:63-70`）决定当前译本：优先取 `settings.version`；旧设置没有该字段时才按 `settings.traditional` 布尔回落为 `traditional` / `simplified`；该译本未安装时回落 `simplified`。随后主进程**显式**把译本 id 作为第三个参数传给 `bible.getChapter` / `bible.getRange` / `bible.search`（`main.js:241` / `244` / `246`）——**版本由主进程统一决定，渲染层不需要在每个请求里重复传版本参数** |
| 加载 | `src/main/bible.js` 的 `cache` 以**译本 id** 为键，每个译本各建一份 `Map<"卷:章:节", 经文>` 并各自缓存；数据文件由 `versions.resolveVersionFile(version)` 定位（内置译本在 `data/`，其余在用户目录）。切换译本时不会重复读盘 |
| 索引 | 各译本的键都是 `"卷:章:节"`，索引结构完全一致，因此历史、收藏、标注都以同样的键引用经文。注意**各译本分节不同**（见 §8.6）：同一个 `(卷, 章, 节)` 在不同译本里可能是不同的一段文字 |
| 显示 | 渲染层只拿到当前译本的 `Verse[]`；书名与分类名走 `src/shared/books.js` 里的 `nameTraditional` / `shortTraditional` / `categoryNameTraditional`，但**只有译本 id 为 `traditional` 时**才用繁体书名（判定见 `src/renderer/js/state.js` 的 `isTraditionalVersion()`），其余译本一律用简体书名 |
| 查找 | `bible:search` 在当前译本的索引上扫描，命中结果里的 `bookName` 同样按当前译本返回（`traditional` 用繁体书名，其余用简体） |

> 也就是说：**切换译本只影响「取哪一份 JSON + 用哪一套书名」**，
> 经文的定位、索引、缓存与历史 / 收藏键都不随译本变化；
> 但跨译本比对同一个节号时要留意各译本的分节差异（§8.6）。

---

## 4. 书目元数据：`src/shared/books.js`

该文件由抽取脚本生成，是一个 CommonJS 模块：

```js
module.exports = { CATEGORIES, BOOKS };
```

### `CATEGORIES`

8 个分类，顺序即原数据库中 `KindSN` 的取值顺序（`KindSN` 从 1 开始）：

| `KindSN` | 分类名 | 卷数 | 卷号范围 |
| --- | --- | --- | --- |
| 1 | 摩西五经 | 5 | 1–5 |
| 2 | 旧约历史 | 12 | 6–17 |
| 3 | 诗歌智慧 | 5 | 18–22 |
| 4 | 大先知 | 5 | 23–27 |
| 5 | 小先知 | 12 | 28–39 |
| 6 | 福音书 | 5 | 40–44 |
| 7 | 书信 | 13 | 45–57 |
| 8 | 启示录 | 9 | 58–66 |

> 分类归属沿用原数据库的 `KindSN`，不是本项目重新定义的分组。

### `BOOKS`

66 条记录，按卷号升序：

```js
{
  id: 1,
  name: "创世记",            // 简体全名
  nameTraditional: "創世記", // 繁体全名
  short: "创",              // 简体简称
  shortTraditional: "創",   // 繁体简称
  abbr: "CSJ",             // 拼音缩写（数据库字段 PY）
  category: 1,             // KindSN
  categoryName: "摩西五经",
  chapters: 50,
  verses: 1533,
  firstVerseId: 1,         // 该卷第一节在全书的全局序号
  testament: "旧约"          // 由 NewOrOld 推导
}
```

> `src/main/bible.js` 对 `src/shared/books.js` 做了 `try/catch` 加载：
> 文件缺失时书卷列表降级为空数组并在主进程日志告警，其余功能（读经、查找）不受影响。

---

## 5. 统计口径

### 行数与校验

| 指标 | 简体 | 繁体 |
| --- | --- | --- |
| 经文行数 | **31,102** | **31,102** |
| 卷数 | 66 | 66 |
| 章数 | 1,189 | 1,189 |
| 旧约 / 新约卷数 | 39 / 27 | 39 / 27 |

31,102 正是和合本全书的节数；两套文本的 `(卷, 章, 节)` 键集合**完全一致**。

### 校验结果

抽取脚本的校验项全部通过：

| 检查项 | 结果 |
| --- | --- |
| 重复 `(卷, 章, 节)` 键 | 0 |
| `NULL` 文本 | 0 |
| 空文本 | 0 |
| 少于 3 字的文本 | 0 |
| 节号缺号的章 | 0 |
| 简体 / 繁体键集合差异 | 0 |
| 每卷节数、章数与 `bibleid` 不符 | 0 |
| `FirstSN` 连续性偏差 | 0 |
| `bibleid` / `bibleidF` 元数据不一致 | 0 |

### 各卷节数

| 卷 | 卷名 | 章 | 节 | 卷 | 卷名 | 章 | 节 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 创世记 | 50 | 1,533 | 34 | 那鸿书 | 3 | 19 |
| 2 | 出埃及记 | 40 | 1,213 | 35 | 哈巴谷书 | 3 | 20 |
| 3 | 利未记 | 27 | 859 | 36 | 西番雅书 | 3 | 20 |
| 4 | 民数记 | 36 | 1,288 | 37 | 哈该书 | 2 | 23 |
| 5 | 申命记 | 34 | 959 | 38 | 撒迦利亚书 | 14 | 23 |
| 6 | 约书亚记 | 24 | 658 | 39 | 玛拉基书 | 4 | 18 |
| 7 | 士师记 | 21 | 618 | 40 | 马太福音 | 28 | 1,071 |
| 8 | 路得记 | 4 | 85 | 41 | 马可福音 | 16 | 678 |
| 9 | 撒母耳记上 | 31 | 810 | 42 | 路加福音 | 24 | 1,151 |
| 10 | 撒母耳记下 | 24 | 695 | 43 | 约翰福音 | 21 | 878 |
| 11 | 列王纪上 | 22 | 816 | 44 | 使徒行传 | 28 | 1,007 |
| 12 | 列王纪下 | 25 | 719 | 45 | 罗马书 | 16 | 433 |
| 13 | 历代志上 | 29 | 942 | 46 | 哥林多前书 | 16 | 437 |
| 14 | 历代志下 | 36 | 822 | 47 | 哥林多后书 | 13 | 257 |
| 15 | 以斯拉记 | 10 | 280 | 48 | 加拉太书 | 6 | 149 |
| 16 | 尼希米记 | 13 | 406 | 49 | 以弗所书 | 6 | 155 |
| 17 | 以斯帖记 | 10 | 167 | 50 | 腓立比书 | 4 | 104 |
| 18 | 约伯记 | 42 | 1,070 | 51 | 歌罗西书 | 4 | 95 |
| 19 | 诗篇 | 150 | 2,461 | 52 | 帖撒罗尼迦前书 | 5 | 89 |
| 20 | 箴言 | 31 | 915 | 53 | 帖撒罗尼迦后书 | 3 | 47 |
| 21 | 传道书 | 12 | 222 | 54 | 提摩太前书 | 6 | 113 |
| 22 | 雅歌 | 8 | 117 | 55 | 提摩太后书 | 4 | 83 |
| 23 | 以赛亚书 | 66 | 1,292 | 56 | 提多书 | 3 | 46 |
| 24 | 耶利米书 | 52 | 1,364 | 57 | 腓利门书 | 1 | 25 |
| 25 | 耶利米哀歌 | 5 | 154 | 58 | 希伯来书 | 13 | 303 |
| 26 | 以西结书 | 48 | 1,273 | 59 | 雅各书 | 5 | 108 |
| 27 | 但以理书 | 12 | 357 | 60 | 彼得前书 | 5 | 105 |
| 28 | 何西阿书 | 14 | 197 | 61 | 彼得后书 | 3 | 61 |
| 29 | 约珥书 | 3 | 73 | 62 | 约翰壹书 | 5 | 105 |
| 30 | 阿摩司书 | 9 | 146 | 63 | 约翰贰书 | 1 | 13 |
| 31 | 俄巴底亚书 | 1 | 21 | 64 | 约翰叁书 | 1 | 15 |
| 32 | 约拿书 | 4 | 48 | 65 | 犹大书 | 1 | 25 |
| 33 | 弥迦书 | 7 | 105 | 66 | 启示录 | 22 | 404 |

### 文件指纹

以下为当前仓库中已提交的数据文件指纹（UTF-8 无 BOM）：

| 文件 | 字节 | SHA-256 |
| --- | --- | --- |
| `data/bible-simplified.json` | 3,611,875 | `909fc75b4439a72d0d8fd1b4aa9219b4468f7999aec41485a67f204a02de0a14` |
| `data/bible-traditional.json` | 3,609,279 | `add8da202b31033bbc6f94e139c82e0cb7e87f0fe4cdca1477feabf1f968a640` |
| `src/shared/books.js` | 16,502 | `de55bf6af3e27de37308b99e6fd08446620fc034f42d3fa05fd6d9eb77eb703e` |

重新抽取后若指纹不一致，说明源数据库或脚本发生了变化，请在 PR 中说明。

> **2026-11-10 修订**：原库 `strjw` 字段在「罗马书 7:1」一行带有尾部 `CRLF`，
> 第一次抽取时被原样写进了经文正文（表现为投影模式里多出一个空行）。
> `tools/extract-mdb.ps1` 现已在源头对每节文本做 `.TrimEnd()`，两个 JSON 也已就地修正
> （各改 1 行，行数与键集合不变，字节数各减 4）。
> 旧指纹：简体 `f14272b9…`、繁体 `0053afb0…`。
>
> `src/shared/books.js` 的指纹与抽取脚本的输出不同——该文件在抽取之后被应用层扩展过
> （`CATEGORIES_TRADITIONAL`、`getCategoryName`、`categoryNameTraditional`）。
> **重跑 `extract-mdb.ps1` 会用旧格式覆盖 `books.js`，重跑前请先备份并重新合并这些扩展。**

---

## 6. 版权

| 对象 | 版权状态 |
| --- | --- |
| 和合本（1919）经文正文 | **公有领域**——1919 年出版，著作权保护期早已届满 |
| 卷名、简称、分类 | 公有领域的书目信息，随经文一并自由使用 |
| 本项目的源码与数据文件编排 | MIT License，见 [LICENSE](../LICENSE) |
| 《语音投影圣经》原程序本身 | 版权归原作者所有；本项目与其无隶属或背书关系 |

`tools/extract-mdb.ps1` 只做**数据格式转换**（Access → JSON / JS），
不含原程序的任何代码、界面资源或反编译产物。
本仓库不包含原程序的可执行文件、`bibleNosound.dat`、语音 `.mp3` 或其它原程序资源。

---

## 7. 重新抽取

```powershell
# 1. 取得原程序的 bibleNosound.dat
# 2. 用 32 位 PowerShell 执行抽取
C:\Windows\SysWOW64\WindowsPowerShell\v1.0\powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools\extract-mdb.ps1 -DataFile "<原程序安装目录>\bibleNosound.dat"

# 3. 检查抽取报告
#    tools/extraction-report.txt —— 行数、异常列表、输出文件 SHA-256
```

步骤：

1. 确认 `tools/extraction-report.txt` 中 `anomalies total` 为 0；
2. 对比 `data/*.json` 的 SHA-256 是否与 §5 一致（不一致说明源数据或脚本有变，需说明原因）；
3. 运行 `npm test` 确认数据层测试通过；
4. 若修改了 `src/shared/books.js`，一并提交该文件。

> 抽取脚本需要原程序的数据库文件，该文件**不随本仓库分发**。
> 在没有该文件的环境里，`data/` 中已提交的 JSON 足以让应用正常运行。

---

## 8. 多译本数据

### 8.1 为什么仓库里只有和合本

| 译本 | 版权 | 能否随仓库分发 |
| --- | --- | --- |
| 和合本（1919，简体 / 繁体） | **公有领域**（1919 年出版，保护期早已届满） | ✅ 内置在 `data/` |
| 其余 6 个中文译本 | **受版权保护**（香港圣经公会 / GBI / 环球天道圣经机构 / 联合国圣经翻译中文委员会 / 环球圣经公会） | ❌ 不进 Git 仓库 |

仓库只保留公有领域的和合本；其余译本由**用户在本机获取**、保存在自己的用户数据目录里，
使用与分发均依各译本的授权条款。用户自行获取的内容不随仓库分发，也不由本项目提供。

### 8.2 两个目录

| 目录 | 内容 | 进 Git |
| --- | --- | --- |
| `<repo>/data/` | 内置和合本：`bible-simplified.json`、`bible-traditional.json`；译本清单 `data/versions/manifest.json` | ✅ |
| `%APPDATA%\BibleProjection\versions\` | 用户安装的译本：`<id>.json`（经文）+ `<id>.meta.json`（名称、节数、版权、来源等元信息） | ❌ |

查找顺序：**内置优先，其次用户目录**（见 `src/main/versions.js` 的 `resolveVersionFile()`）。
清单里没有、但用户目录里存在的译本（例如手工导入的），会在译本列表里以「本地导入」呈现。

### 8.3 译本清单 `data/versions/manifest.json`

清单是仓库内唯一描述「有哪些译本」的文件，结构如下：

| 字段 | 说明 |
| --- | --- |
| `id` | 译本标识，同时是用户目录里的文件名（`<id>.json`） |
| `name` | 显示名 |
| `bundled` | 是否内置在仓库里（`true` 的 `file` 相对 `data/` 目录） |
| `file` | 内置译本的数据文件名（仅 `bundled: true` 时有） |
| `fhlVersion` | FHL API 的 `version` 参数（仅非内置译本；应用内「获取译本」据此下载） |
| `copyright` | 版权归属，用于在界面上提示用户 |
| `source` | 数据来源 |
| `lang` | 语言标记（`zh-Hans` / `zh-Hant`） |

内置的 8 个条目：

| `id` | 名称 | 内置 | 版权归属 | 来源 |
| --- | --- | --- | --- | --- |
| `simplified` | 和合本（简体） | ✅ | 公有领域（1919 年中文和合本） | 原版《语音投影圣经》Access 数据库 `bibleNosound.dat` |
| `traditional` | 和合本（繁体） | ✅ | 公有领域（1919 年中文和合本） | 同上 |
| `lcc` | 吕振中译本 | ❌ | © 吕振中 / 环球天道圣经机构 | [FHL API](https://bible.fhl.net/api/qb.php) |
| `rcuv` | 和合本修订版 2010 | ❌ | © 香港圣经公会 | [FHL API](https://bible.fhl.net/api/qb.php) |
| `csb` | 中文标准译本 | ❌ | © 全球圣经促进会 GBI | [FHL API](https://bible.fhl.net/api/qb.php) |
| `tcv95` | 现代中文译本 1995 | ❌ | © 联合国圣经翻译中文委员会 | [FHL API](https://bible.fhl.net/api/qb.php) |
| `tcv2019` | 现代中文译本 2019 | ❌ | © 联合国圣经翻译中文委员会 | [FHL API](https://bible.fhl.net/api/qb.php) |
| `ncv` | 环球新译本 | ❌ | © 环球圣经公会 | [FHL API](https://bible.fhl.net/api/qb.php) |

### 8.4 获取与安装

**方式一：命令行抓取脚本**（适合一次性准备，或给多台机器预置）

```bash
# 抓取全部 6 个译本到 %APPDATA%\BibleProjection\versions
python tools/fetch-versions.py

# 只抓指定的译本，或指定输出目录
python tools/fetch-versions.py --versions lcc,rcuv
python tools/fetch-versions.py --out D:\vers --versions ncv
```

脚本用 FHL API 逐卷逐章抓取，输出格式与仓库内置的 JSON 完全一致
（`[[bookId, chapter, verse, text], ...]`），并同时写出 `<id>.meta.json`。
清洗后为空的节不会写入（避免投影时出现空行）。

如果本地译本目录里是**旧版清洗规则**抓取的结果（文本里还带译注、脚注编号或空行），
不必重新下载，就地重洗一遍即可：

```bash
node tools/clean-versions.js            # 默认重洗 %APPDATA%\BibleProjection\versions
node tools/clean-versions.js D:\vers    # 重洗指定目录
```

**方式二：应用内「获取译本」**

设置面板里选中译本 → 主进程按清单里的 `fhlVersion` 调用同一个 FHL API 下载，
写入用户数据目录；下载过程中显示进度。
也可从本地 JSON 文件导入（格式同上），导入的译本会出现在译本列表里。

### 8.5 校验

```bash
node tools/verify-versions.js                    # 仓库内置数据 + 默认用户译本目录
node tools/verify-versions.js <目录>              # 校验指定目录下的所有译本
node tools/verify-versions.js --repo-only         # 只校验仓库内置数据
node tools/verify-versions.js <目录> --strict     # 节数与和合本不一致也判 FAIL
```

对每个 `<id>.json` 检查：行数、每卷节数、每行键结构 `[bookId, chapter, verse, text]`、
文本非空、无重复键、章内节号连续、整章是否缺失、与和合本的键集合差异，
并抽查创世记 1:1 / 约翰福音 3:16 / 箴言 3:5 / 启示录 22:21。
退出码 0 = 全部通过，1 = 存在 FAIL。

### 8.6 译本之间的分节差异（重要）

**和合本不是唯一的分节体系。** 各译本对同一章的切分并不相同。
下表为 2026-11-10 的实测值（基准 = 和合本 31,102 节）：

| 译本 | 最终节数 | Δ vs 和合本 | 版本学差异（多 / 少） | 清洗后为空的节被丢弃 |
| --- | --- | --- | --- | --- |
| 和合本（简 / 繁） | 31,102 | 0 | — | 0 |
| `lcc` 吕振中 | 31,081 | −21 | **+1 / 0** | 22 |
| `rcuv` 和合本修订版 2010 | 31,094 | −8 | +3 / −7 | 4 |
| `tcv95` 现代中文译本 1995 | 31,085 | −17 | +2 / −6 | 13 |
| `tcv2019` 现代中文译本 2019 | 31,087 | −15 | +2 / −7 | 10 |
| `csb` 中文标准译本 | 31,087 | −15 | +3 / −18 | 0 |
| `ncv` 环球新译本 | 31,061 | −41 | +2 / −26 | 17 |

三组数字的含义：

- **版本学差异（多 / 少）** = 该译本相对和合本多出 / 少掉的**实义**经节，属于译本自身的分节体系差异：
  - 多数译本多出 `43:7:53`「约翰福音 7:53」（和合本据希腊文校勘删去）；
    `rcuv` / `csb` 还多出 `13:22:19`、`66:12:18`。
  - `rcuv` 不收 `40:23:14`、`42:17:36`、`42:23:17`、`44:8:37`、`44:15:34`。
  - `tcv95` / `tcv2019` 另不收 `40:17:21`、`41:9:44`、`41:9:46`、`41:11:26`、`47:13:14`。
  - `csb` 依希伯来文重新分节（如出埃及记 3 章只有 1–8、11–39，没有 9、10）。
- **清洗后为空的节被丢弃** = FHL 返回的该节正文只有脚注编号或注释，清洗后没有正文，
  为避免投影时出现空行而整节丢弃（`src/main/versions.js` 与 `tools/clean-versions.js` 都会这样做）。
- **Δ = 版本学差异 − 丢弃的空节**（例如 `lcc`：+1 − 22 = −21）。

**8 个译本的卷数（66）与章数（1,189）完全一致**，差异只发生在章内的节号上。

由此得到两条实现约束：

1. **不能跨译本用节号定位经文。** 和合本的第 n 节在别的译本里可能是 n−1 甚至 n+1。
   本项目每个译本各自建一张 `(卷:章:节) → 经文` 的表，切换译本时整表切换，
   历史 / 收藏 / 标注一律记 `(卷, 章, 节)` 三元组，不跨译本比对节号。
2. **校验器对「节数与和合本不一致」只告警不判失败**（`--strict` 可改为判失败），
   因为那是译本本身的差异，不是数据损坏；真正判 FAIL 的是结构性错误
   （JSON 解析失败、键结构错误、重复键、空文本、整章缺失、抽查经文缺失）。

### 8.7 清洗规则与残留

三条获取路径现在使用**同一套**清洗规则（`src/main/versions.js` 的 `cleanText()`，
`tools/fetch-versions.py` 的 `clean_text()`、`tools/clean-versions.js` 的 `cleanText()` 已与之对齐）：

1. 去掉 `<h1>–<h6>` 标题标签；
2. `<br/>` 换成空格，其余 HTML 标签去掉；
3. HTML 实体反转义；
4. 去掉行内注释：`([…])`、`（[…]）`、`( 「…」)`、`（ 「…」）`；
5. 去掉脚注编号 `【n】`；
6. 全角空格 → 半角，空白压缩；
7. 去掉汉字之间的多余半角空格（英文单词之间的空格保留）；
8. 清洗后为空白的节整节丢弃。

实测（2026-11-10，应用内下载 / `clean-versions.js` 清洗后的结果）残留：

| 残留 | 出现情况 |
| --- | --- |
| 译注 `( [ 3.16] …)` / `( 「…」或译…)` | `rcuv` 8 节、`tcv95` 1 节，其余译本 0 |
| 脚注标记 `【n】` | 0（已清理） |
| 单个换行符 | 0（已清理） |
| HTML 标签 | 0（已清理） |
| 空文本行 / 重复键 | 0 |

> 早期用旧版 `clean_text()` 抓取的结果里残留较多（`rcuv` 1,731 节译注、`lcc` 4,663 个脚注编号、
> `lcc` 20 行空文本等）。本地译本目录若是旧结果，用 `node tools/clean-versions.js [目录]`
> 就地重洗一遍即可，不必重新下载。

### 8.8 版权提示

- 应用在译本列表里对每个非内置译本显示其版权归属（取自清单的 `copyright` 字段）。
- 用户自行下载 / 导入的译本，其版权归该译本权利人；本项目仅提供获取与显示的通道，
  不随仓库分发任何受版权保护的经文数据。
- 仓库内置的和合本（1919）属公有领域，可自由使用。
