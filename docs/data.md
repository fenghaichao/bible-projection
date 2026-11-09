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

两个文件结构完全一致，只是文字分别为简体与繁体。

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

应用运行时不会重复解析这两个文件——`src/main/bible.js` 会把它们加载成
`Map<"卷:章:节", 经文>`，详见 [architecture.md](architecture.md#3-数据加载与查找策略)。

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
| `data/bible-simplified.json` | 3,611,879 | `f14272b94595aa39fa7ae1f2fc77fdd4d34b9a564a6e5b8fab4c23ca71bdbf03` |
| `data/bible-traditional.json` | 3,609,283 | `0053afb0c5023d252ff381bcb401e69c43221f8e36a9d19e7917218565900f4b` |
| `src/shared/books.js` | 15,641 | `bd730fdb0997f703efdadecd277a484b9d5664e5233736b7502e0b7b6939b963` |

重新抽取后若指纹不一致，说明源数据库或脚本发生了变化，请在 PR 中说明。

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
