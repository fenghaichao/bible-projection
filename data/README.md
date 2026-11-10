# data/ — 圣经经文数据

本目录存放**经文正文**数据（和合本简 / 繁 + 吕振中译本）和 66 卷书卷元数据。
不包含原软件的任何商业内容（注释、灵修、背景音乐、语音文件、界面素材等均未提取）。

## 文件

| 文件 | 内容 |
| --- | --- |
| `bible-simplified.json` | 和合本简体经文，31,102 节 |
| `bible-traditional.json` | 和合本繁体经文，31,102 节（与简体一一对应） |
| `versions/lcc.json` | 吕振中译本经文，31,081 节（**公有领域，随仓库分发**） |
| `versions/manifest.json` | 译本清单：7 个中文译本（和合本简/繁 + 吕振中 + 和合本2010 + 中文标准 + 现代中文2019 + 环球新译本）；**和合本简 / 繁与吕振中共 3 个随仓库分发**，其余 4 个受版权保护的译本不进仓库 |
| `versions/README.md` | `versions/` 目录的用途、获取 / 更新 / 校验流程与版权提示 |
| `README.md` | 本文件 |

> 本目录**只含公有领域的经文**：和合本（简 / 繁）与吕振中译本。
> 其余 4 个译本受版权保护，
> 其正文既不在仓库里、也不在安装包里，通过应用内「获取译本」面板在线下载
> （数据来自信望愛 FHL API）或从本地 JSON 文件导入。

### `versions/manifest.json`

清单里 7 个条目中，**3 个的 `bundled` 为 `true`**：

- 和合本（简 / 繁）：**公有领域**（1919 年中文和合本），文件为本目录下的 `bible-simplified.json` / `bible-traditional.json`；
- 吕振中（`lcc`）：**公有领域**（依 FHL 版权说明页，该译本 1952 / 1970 年出版，已超过中国著作权保护期 50 年），文件为本目录下的 `versions/lcc.json`；
- 和合本修订版 2010（`rcuv`）、中文标准译本（`csb`）、现代中文译本 2019（`tcv2019`）、环球新译本（`ncv`）：**受版权保护**（分别为 © 香港圣经公会、© 全球圣经促进会 GBI、© 联合国圣经翻译中文委员会、© 环球圣经公会），`bundled` 为 `false` 且**没有 `file` 字段**——它们的正文需要使用者自行下载或导入，界面会加「需授权确认」标签并在下载前弹确认框。

清单里 `bundled: true` 条目的 `file` 相对本目录（`data/`）解析；
和合本简 / 繁的正文在 `data/` 根，吕振中的正文在 `data/versions/`。
应用侧仍保留「获取译本」面板的
在线下载与本地导入能力。详见 [`docs/data.md`](../docs/data.md) 的「多译本数据」章节
与 [`docs/versions.md`](../docs/versions.md)。

书卷元数据（书名、简繁体书名、缩写、分类、章数/节数、首节 ID、旧/新约）在
[`src/shared/books.js`](../src/shared/books.js)，以 CommonJS 模块导出：

```js
const { CATEGORIES, BOOKS } = require('../src/shared/books.js');
```

## 数据格式

`bible-simplified.json` / `bible-traditional.json` 是一个扁平的**数组的数组**：

```json
[[1,1,1,"起初神创造天地。"], [1,1,2,"地是空虚混沌，渊面黑暗；神的灵运行在水面上。"], ...]
```

每行 4 个字段：`[bookId, chapter, verse, text]`

- `bookId` — 1..66，顺序为圣经正典顺序（1=创世记 … 66=启示录），对应原库的 `VolumeSN`
- `chapter` — 章号（`ChapterSN`），从 1 开始
- `verse` — 节号（`VerseSN`），从 1 开始
- `text` — 该节经文正文（和合本）

排序：按 `bookId` → `chapter` → `verse` 升序，**两个文件的 `(bookId, chapter, verse)`
键集合完全一致**（31,102 个键，差异 0）。

文件编码：UTF-8 **无 BOM**，文件末尾无换行符。

## 统计

| 项目 | 简体 | 繁体 |
| --- | --- | --- |
| 经节数 | 31,102 | 31,102 |
| 文件大小 | 3,611,875 字节 | 3,609,279 字节 |
| SHA-256 | `909fc75b4439a72d0d8fd1b4aa9219b4468f7999aec41485a67f204a02de0a14` | `add8da202b31033bbc6f94e139c82e0cb7e87f0fe4cdca1477feabf1f968a640` |

> 复核上面的 SHA-256：  
> `Get-FileHash data\bible-simplified.json -Algorithm SHA256`  
> `Get-FileHash data\bible-traditional.json -Algorithm SHA256`

### 内置译本正文

本目录随仓库分发的经文正文共 3 个译本：

| 文件 | 译本 | 经节数 | 文件大小 | SHA-256 |
| --- | --- | --- | --- | --- |
| `bible-simplified.json` | 和合本（简体） | 31,102 | 3,611,875 字节 | `909fc75b4439a72d0d8fd1b4aa9219b4468f7999aec41485a67f204a02de0a14` |
| `bible-traditional.json` | 和合本（繁体） | 31,102 | 3,609,279 字节 | `add8da202b31033bbc6f94e139c82e0cb7e87f0fe4cdca1477feabf1f968a640` |
| `versions/lcc.json` | 吕振中译本（公有领域） | 31,081 | 3,967,569 字节 | `e0ea9f3b2f28fb62404e51ef02c050551d4834ee0992a873530a406cb8cd4483` |

> `versions/lcc.json` 的行格式与上表两个和合本文件相同（`[卷号, 章号, 节号, 正文]`，
> UTF-8 无 BOM，行序按 `(卷, 章, 节)` 升序，66 卷齐全，无空文本、无重复键）。
> 复核：`Get-FileHash data\versions\lcc.json -Algorithm SHA256`

`data/` 目录整体约 11.2 MB（未含吕振中时约 7.2 MB），安装包体积相应增加约 3.97 MB。

### 书卷分类（对应原库 `bibleid.KindSN` 1..8）

| KindSN | 分类名 | 卷数 | 包含书卷 |
| --- | --- | --- | --- |
| 1 | 摩西五经 | 5 | 创世记、出埃及记、利未记、民数记、申命记 |
| 2 | 旧约历史 | 12 | 约书亚记 … 以斯帖记 |
| 3 | 诗歌智慧 | 5 | 约伯记、诗篇、箴言、传道书、雅歌 |
| 4 | 大先知 | 5 | 以赛亚书、耶利米书、耶利米哀歌、以西结书、但以理书 |
| 5 | 小先知 | 12 | 何西阿书 … 玛拉基书 |
| 6 | 福音书 | 5 | 马太福音、马可福音、路加福音、约翰福音、使徒行传 |
| 7 | 书信 | 13 | 罗马书 … 腓利门书（保罗书信） |
| 8 | 启示录 | 9 | 希伯来书、雅各书、彼得前书、彼得后书、约翰壹/贰/叁书、犹大书、启示录 |

> 第 8 组在原库中同时装了 8 卷普通书信和《启示录》，因此该分类名取自原软件的习惯叫法。
> 如需更准确的措辞，改 `src/shared/books.js` 里 `CATEGORIES` 的第 8 项即可（UI 侧栏直接读该数组）。

### 已知数据差异（原库自身的问题，非抽取错误）

原库 `bibleid.VerseNumber` 给《启示录》记的是 **403** 节，但 `Bible` / `BibleF` 两张经文表里
实际有 **404** 节（各章节数 20/29/22/11/14/17/17/13/21/11/19/17/18/20/8/21/18/24/21/15/27/21，
合计 404），这也是和合本《启示录》的通行节数。`books.js` 采用**实际抽取到的 404**，
因此 `firstVerseId` 与节数首尾自洽（`30699 + 404 - 1 = 31102`）。

## 来源

- 原始程序：**《语音投影圣经》5.20-SP2 无声版**（甘泉软件，www.wzjdj.com），已停止维护。
- 原始数据文件：`C:\语音投影圣经无声版\bibleNosound.dat`
  （Microsoft Access / Jet 4 MDB，15,360,000 字节，
  SHA-256 `805740ba8a8304fe10abd4ec99420749eb81f82b4691823a2928dc41690f886b`）
- 用到的表：
  - `Bible`（简体经文）、`BibleF`（繁体经文）——取 `VolumeSN / ChapterSN / VerseSN / strjw`
  - `bibleid`（简体书卷表）、`bibleidF`（繁体书卷表）——取书名、缩写、`KindSN`、章数节数、`FirstSN`
- **未**读取：`bibleread`（旧版阅读历史）、`save`（旧版设置）、`savejw`（旧版收藏），
  以及 `Bible` / `BibleF` 中的 `soundname / soundstart / soundend / preend`（语音文件名与时间轴）
  等一切与商业内容相关的字段。

本项目为**独立重写**，未携带原软件的任何程序代码、注释、灵修、背景音乐或界面素材；
只使用了其中**公有领域**的和合本经文正文、公开的书卷名称，以及**公有领域**的吕振中译本
（由信望愛 FHL API 取得，见 `versions/lcc.json`）。

## 版权说明

- **中文和合本（CUV）经文本身属于公有领域**（1919 年中华圣经会出版，译者为
  沈桐、任廷旭、容显廷等，版权已于 2000 年期满进入公有领域），可自由使用与再分发。
- **吕振中译本（`lcc`）同样属于公有领域**：依信望愛版权说明页
  （<https://www.fhl.net/main/fhl/fhl8.html>），该译本 1952 年由香港圣书公会出版《新约新译修稿》、
  1970 年正式出版全书，**已超过中国著作权保护期 50 年**；FHL 模块清单 `abv.php` 中它的
  `candownload` 为 `1`（开放离线下载授权）。因此 `versions/lcc.json` 随仓库与安装包分发。
- 本目录中的 JSON 文件是对公有领域经文文本的机械抽取 / 转换结果，仅新增了 JSON 排版结构。
- 简体 / 繁体字形由原库提供（繁体非 CUV 原版用字，为该软件的转换结果，可能与
  台湾常用异体字存在个别字形差异）。
- `versions/manifest.json` 里列出的其余 **4 个译本**（`rcuv` / `csb` / `tcv2019` / `ncv`）
  **仍受版权保护**，版权归各自权利人所有；它们的正文**不在本仓库内**，由使用者自行取得授权后
  通过应用内下载（下载前需确认授权）或本地导入获得。信望愛 FHL 的 API 页面明确写着
  「有些僅授權給信望愛站使用……請勿任意使用，以免違法」，
  授权条件见 <https://www.fhl.net/main/fhl/fhl8.html>。
- 原程序《语音投影圣经》的著作权归甘泉软件所有；本项目不包含其代码与商业内容，
  与原作者无隶属或授权关系。

## 重新生成

用 `tools/extract-mdb.ps1` 可从原始 `.dat` 完整复现本目录的两个 JSON 文件，
以及 `src/shared/books.js`。

### 前置条件

1. **Windows**，已安装 64 位系统（本项目开发机为 Windows 10/11 x64）。
2. **Jet 4.0 OLE DB 提供程序**（`Microsoft.Jet.OLEDB.4.0`）。
   该提供程序只有 **32 位** 版本，64 位 PowerShell 会报 *Provider not found*。
   32 位 Windows 自带；64 位 Windows 需安装 Office/Access 的 32 位组件或 Jet 4.0 运行库。
3. 原始文件 `C:\语音投影圣经无声版\bibleNosound.dat`（库密码 `pasitoldata`）。

### 运行

**必须用 32 位 PowerShell**（`SysWOW64`）：

```cmd
C:\Windows\SysWOW64\WindowsPowerShell\v1.0\powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools\extract-mdb.ps1
```

脚本参数（均有默认值，可按需覆盖）：

```powershell
-DataFile   'C:\语音投影圣经无声版\bibleNosound.dat'   # 原始 MDB
-Password   'pasitoldata'                                # Jet 库密码
-OutDir     '<repo>\data'                               # 两个 JSON 的输出目录
-SharedDir  '<repo>\src\shared'                         # books.js 的输出目录
-ReportFile '<repo>\tools\extraction-report.txt'        # 校验报告
```

> **编码提示**：脚本含中文默认路径，请以 **UTF-8 带 BOM**（或 UTF-16LE）保存，
> 否则 Windows PowerShell 5.1 会用系统 ANSI 代码页解码而损坏中文路径。
> 仓库中已提交的 `tools/extract-mdb.ps1` 就是 UTF-8 with BOM，可直接运行。

### 输出

- `data/bible-simplified.json`、`data/bible-traditional.json`
- `src/shared/books.js`
- `tools/extraction-report.txt` —— 校验报告（行数、重复键、空/短文本、缺节、
  分类映射、抽样经文、各输出文件的 SHA-256）

抽取是确定性的：同样的输入会产出**逐字节相同**的输出文件（SHA-256 可复现）。

### 独立校验

```cmd
node tools\verify-data.js
```

该脚本用 Node 独立复核两个 JSON：行数、键集合一致性、排序、空/短文本、
每卷章数/节数与 `books.js` 的一致性、`firstVerseId` 链完整性，并打印 4 处抽样经文与 SHA-256。

## 抽样核对结果

| 经文 | 简体 | 繁体 |
| --- | --- | --- |
| 创世记 1:1 | 起初神创造天地。 | 起初神創造天地。 |
| 约翰福音 3:16 | 神爱世人，甚至将祂的独生子赐给他们，叫一切信祂的，不至灭亡，反得永生。 | 神愛世人，甚至將他的獨生子賜給他們，叫一切信他的，不至滅亡，反得永生。 |
| 箴言 3:5 | 你要专心仰赖耶和华，不可倚靠自己的聪明。 | 你要專心仰賴耶和華，不可倚靠自己的聰明， |
| 启示录 22:21 | 愿主耶稣的恩惠常与众圣徒同在。阿们。 | 愿主耶穌的恩惠常與眾圣徒同在。阿們。 |

> 繁体《箴言》3:5 结尾是「聰明，」而不是「聰明。」——这是原库繁简转换时保留的
> 标点差异，两份数据都原样保留，未做任何修改。
