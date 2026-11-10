# `data/versions/` —— 译本清单

本目录**只放清单与说明**，不放任何译本正文：

| 文件 | 说明 |
| --- | --- |
| `manifest.json` | 译本清单（**只有元信息，没有经文正文**）。应用通过它知道有哪些译本、哪些随程序分发、各自的版权归属与来源 |
| `README.md` | 本文件 |

> **受版权保护的译本正文不入库。** 本仓库是公开的，把受版权保护的译本打包进来
> 等同于替权利人做再分发，风险很高。因此这里只保留清单（不含正文），
> 译本正文由使用者自行下载或导入。详见[第六节](#6-版权提示)。

> 和合本（简体 / 繁体）也不在本目录，它们的正文是上级目录下的
> `data/bible-simplified.json` 与 `data/bible-traditional.json`——
> 两者是清单里 `bundled: true` 的两条，随程序分发。

相关文档：项目级的[数据说明](../../docs/data.md) ·
[译本清单与版权](../../docs/versions.md) ·
[架构说明 · 多译本架构](../../docs/architecture.md#8-多译本架构)

---

## 1. `manifest.json` 的结构

```json
{
  "versions": [
    {
      "id": "simplified",
      "name": "和合本（简体）",
      "bundled": true,
      "file": "bible-simplified.json",
      "copyright": "公有领域（1919 年中文和合本）",
      "source": "原版《语音投影圣经》Access 数据库 bibleNosound.dat",
      "lang": "zh-Hans"
    },
    {
      "id": "lcc",
      "name": "吕振中译本",
      "bundled": false,
      "fhlVersion": "lcc",
      "copyright": "© 吕振中 / 环球天道圣经机构",
      "source": "信望愛資訊中心 FHL API（https://bible.fhl.net/api/qb.php）",
      "lang": "zh-Hans"
    }
  ]
}
```

| 字段 | 含义 |
| --- | --- |
| `id` | 译本标识，也是 `settings.version` 的取值 |
| `name` | 界面显示名 |
| `bundled` | `true` = 正文随仓库与安装包分发；`false` = 正文不随仓库分发，需自行下载或导入。**当前只有和合本简 / 繁两条为 `true`** |
| `file` | 正文文件名，相对 `data/` 目录。**仅 `bundled: true` 的条目才有**（和合本简 / 繁是 `bible-simplified.json` / `bible-traditional.json`） |
| `fhlVersion` | 信望愛 FHL API 的版本参数，用于在线下载；和合本无此字段 |
| `copyright` / `source` | 版权归属与正文来源，界面与文档都会显示 |
| `lang` | 语言标记（`zh-Hans` / `zh-Hant`） |

---

## 2. 清单里的 7 个译本

| id | 名称 | 是否内置 | 版权归属 | 来源 |
| --- | --- | --- | --- | --- |
| `simplified` | 和合本（简体） | ✅ `data/bible-simplified.json` | 公有领域（1919 年中文和合本） | 原版《语音投影圣经》Access 数据库 `bibleNosound.dat` |
| `traditional` | 和合本（繁体） | ✅ `data/bible-traditional.json` | 公有领域（1919 年中文和合本） | 同上 |
| `lcc` | 吕振中译本 | ❌ 按需下载 | © 吕振中 / 环球天道圣经机构 | [FHL API](https://bible.fhl.net/api/qb.php) |
| `rcuv` | 和合本修订版 2010 | ❌ 按需下载 | © 香港圣经公会 | 同上 |
| `csb` | 中文标准译本 | ❌ 按需下载 | © 全球圣经促进会 GBI | 同上 |
| `tcv2019` | 现代中文译本 2019 | ❌ 按需下载 | © 联合国圣经翻译中文委员会 | 同上 |
| `ncv` | 环球新译本 | ❌ 按需下载 | © 环球圣经公会 | 同上 |

> **分节差异**：各译本的节数不同（31,061 – 31,102），这是译本自身的分节体系差异，不是数据损坏。
> 应用**不跨译本用节号定位经文**——历史、收藏与标注只记「卷:章:节」。
> 详见[数据说明 §8.6](../../docs/data.md#86-译本之间的分节差异重要)。

---

## 3. 译本文件格式

译本文件是**单行 JSON 数组**，每个数组元素是一节经文：

```json
[[1,1,1,"起初神创造天地。"],[1,1,2,"地是空虚混沌，渊面黑暗；神的灵运行在水面上。"]]
```

| 下标 | 含义 | 类型 | 说明 |
| --- | --- | --- | --- |
| `0` | 卷号 `bookId` | `number` | 1–66，与 `src/shared/books.js` 的 `id` 对应 |
| `1` | 章号 `chapter` | `number` | 从 1 开始 |
| `2` | 节号 `verse` | `number` | 从 1 开始 |
| `3` | 经文正文 | `string` | 单行文本，不含换行 |

约定与实测：

- **行序**按 `(卷, 章, 节)` 升序；
- **66 卷齐全**，卷数 66、章数 1,189（各译本一致）；
- **空文本 0**（清洗后为空的节整节丢弃，避免投影时出现空行）；
- **键唯一**（无重复的 `(卷, 章, 节)`）；
- UTF-8 无 BOM。

> 用户自行下载 / 导入的译本（存放在 `%APPDATA%\BibleProjection\versions\`）用的是**同一种格式**，
> 只是多一个配套的 `<id>.meta.json` 记录名称、节数、版权与来源。

---

## 4. 清洗规则

抓取来的原始文本带有标题标签、脚注编号、行内译注与换行，
`tools/fetch-versions.py`（抓取时）、`tools/clean-versions.js`（事后重洗）
与 `src/main/versions.js` 的 `cleanText()`（应用内下载时）**使用同一套规则**：

1. 去掉 `<h1>` – `<h6>` 标题标签；
2. `<br/>` 换成空格，其余 HTML 标签去掉；
3. HTML 实体反转义（`&amp;` `&lt;` `&gt;` `&quot;` `&#39;` `&nbsp;`）；
4. 去掉行内注释：`( [1.1] … )`、`（[1.1] …）`、`( 「…」)`、`（ 「…」）`；
5. 去掉脚注编号 `【14】`；
6. 全角空格（`　`）转半角，连续空白压成一个空格；
7. 删除汉字之间的多余半角空格（英文单词之间的空格保留）；
8. 清洗后为空的节整节丢弃。

---

## 5. 获取与更新

### 应用内获取

顶栏「获取译本」面板里：

- 未安装的译本点「下载安装」——应用按清单里的 `fhlVersion` 从信望愛 FHL API 逐卷下载，
  写入 `%APPDATA%\BibleProjection\versions\<id>.json`（另有一份 `<id>.meta.json` 记录元信息），
  下载中显示进度条，可「停止跟踪」；完成后自动切换到该译本；
- 已有文件的可点面板底部「从本地文件导入…」，选一个上面那种格式的 JSON。

### 命令行抓取

```bash
# 抓取全部 5 个可下载译本到 %APPDATA%\BibleProjection\versions
python tools/fetch-versions.py

# 只抓指定译本 / 指定输出目录
python tools/fetch-versions.py --versions lcc,rcuv
python tools/fetch-versions.py --out D:\vers --versions ncv
```

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `--versions` | 全部 5 个 | 逗号分隔的译本 id（`lcc` / `rcuv` / `csb` / `tcv2019` / `ncv`） |
| `--out` | `%APPDATA%\BibleProjection\versions` | 输出目录 |
| `--workers` | `6` | 并发线程数 |
| `--delay` | `0.12` | 每次请求之间的间隔（秒） |

脚本需要 **Python 3 + 网络连接**，属于用户侧取数工具，**不进 CI**。
它抓取的原始数据来自**信望愛 FHL API**（<https://bible.fhl.net/api/qb.php>）。

> ℹ️ `tools/clean-versions.js` 会遍历目录下所有 `.json` 文件，
> 现在已**自动跳过 `manifest.json`**（提示「目录里没有译本数据」），
> 因此可以直接对 `data/versions/` 运行，不会再抛 `TypeError: rows is not iterable`。

### 校验

```bash
node tools/verify-versions.js data/versions      # 校验仓库内的译本清单 + 内置和合本
node tools/verify-versions.js                    # 校验仓库内置数据 + 默认用户译本目录
node tools/verify-versions.js D:\vers            # 校验指定目录
node tools/verify-versions.js D:\vers --strict   # 节数与和合本不一致也判 FAIL
```

> ℹ️ `tools/verify-versions.js --repo-only` 的语义已修正为「**只校验仓库内置数据**」，
> 即只检查 `data/` 下随仓库分发的和合本简 / 繁；不带该参数则校验用户译本目录
> （`%APPDATA%\BibleProjection\versions`）。

校验内容：JSON 可解析、每行是 `[bookId, chapter, verse, text]`、行序升序、键不重复、
每章节号连续、文本非空、每卷节数与和合本比对、与和合本的键集合差异、
抽查创世记 1:1 / 约翰福音 3:16 / 箴言 3:5 / 启示录 22:21，以及 `manifest.json` 的字段完整性。

> 译本之间本来就有分节差异，因此「节数与和合本不一致」默认只告警、不判失败；需要严格时加 `--strict`。
> 校验脚本**不联网**，目前也**不在 CI 中运行**。

---

## 6. 版权提示

- **和合本（1919）属公有领域**，其正文可自由使用与再分发，随程序分发。
- **其余 5 个译本受版权保护**，版权归上表所列机构所有；
  **本仓库与安装包均不含它们的正文**，也不提供镜像、压缩包或直链。
- 两种获取方式：应用内「获取译本」面板在线下载，或从本地 JSON 文件导入；
  下载的文件只写入本机 `%APPDATA%\BibleProjection\versions\`。
- **下载并使用即表示你已自行取得使用授权**——请先阅读信望愛 FHL 的版权声明：

  > 注意，信望愛站上各個聖經譯本，有些僅授權給信望愛站使用，
  > 請查閱版權說明（<https://www.fhl.net/main/fhl/fhl8.html>），請勿任意使用，以免違法。

  各译本的具体授权条件见该页面，请**逐一核对后再使用**。
- 本目录的文件仅来自公开的 FHL API 与原程序数据库的**格式转换**，
  不包含任何译本之外的原程序代码或资源。
