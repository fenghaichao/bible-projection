# `data/versions/` —— 内置译本数据

本目录存放本项目**内置**的 5 个受版权保护的中文圣经译本正文，以及描述全部译本的清单
`manifest.json`。应用启动时直接读取这里的文件，**不需要联网、不需要下载**。

相关文档：项目级的[数据说明](../../docs/data.md) ·
[译本清单与版权](../../docs/versions.md) ·
[架构说明 · 多译本架构](../../docs/architecture.md#8-多译本架构)

---

## 1. 目录内容

| 文件 | 说明 |
| --- | --- |
| `manifest.json` | 译本清单（**只有元信息，没有经文正文**）。应用通过它知道有哪些译本、各自的文件名、版权归属与来源 |
| `lcc.json` | 吕振中译本正文 |
| `rcuv.json` | 和合本修订版 2010 正文 |
| `csb.json` | 中文标准译本正文 |
| `tcv2019.json` | 现代中文译本 2019 正文 |
| `ncv.json` | 环球新译本正文 |

> 和合本（简体 / 繁体）不在本目录，它们的正文是仓库根下的
> `data/bible-simplified.json` 与 `data/bible-traditional.json`——
> 两者同样是内置译本，只是文件位置与其它 5 个不同。

`manifest.json` 的结构：

```json
{
  "versions": [
    {
      "id": "lcc",
      "name": "吕振中译本",
      "bundled": true,
      "fhlVersion": "lcc",
      "copyright": "© 吕振中 / 环球天道圣经机构",
      "source": "信望愛資訊中心 FHL API（https://bible.fhl.net/api/qb.php）",
      "lang": "zh-Hans",
      "file": "versions/lcc.json"
    }
  ]
}
```

| 字段 | 含义 |
| --- | --- |
| `id` | 译本标识，也是 `settings.version` 的取值 |
| `name` | 界面显示名 |
| `bundled` | `true` 表示正文随仓库分发（**当前 7 个译本全部为 `true`**） |
| `file` | 正文文件名，相对 `data/` 目录（和合本简 / 繁是 `bible-simplified.json` / `bible-traditional.json`，其余是 `versions/<id>.json`） |
| `fhlVersion` | 信望愛 FHL API 的版本参数，用于在线下载 |
| `copyright` / `source` | 版权归属与正文来源，界面与文档都会显示 |
| `lang` | 语言标记（`zh-Hans` / `zh-Hant`） |

---

## 2. 译本文件一览

| id | 名称 | 文件 | 字节 | 节数 | SHA-256 |
| --- | --- | --- | --- | --- | --- |
| `simplified` | 和合本（简体） | `data/bible-simplified.json` | 3,611,875 | 31,102 | `909fc75b4439a72d0d8fd1b4aa9219b4468f7999aec41485a67f204a02de0a14` |
| `traditional` | 和合本（繁体） | `data/bible-traditional.json` | 3,609,279 | 31,102 | `add8da202b31033bbc6f94e139c82e0cb7e87f0fe4cdca1477feabf1f968a640` |
| `lcc` | 吕振中译本 | `data/versions/lcc.json` | 3,967,569 | 31,081 | `e0ea9f3b2f28fb62404e51ef02c050551d4834ee0992a873530a406cb8cd4483` |
| `rcuv` | 和合本修订版 2010 | `data/versions/rcuv.json` | 3,684,802 | 31,094 | `33a037fe5fb3018e3cd7b55533c4903c3555f82af0477fc3f846a9d70751d7e9` |
| `csb` | 中文标准译本 | `data/versions/csb.json` | 3,910,196 | 31,087 | `c9d7812d1c082257d37a6b8335d6c0943b3ae3989cce6bca63d52cc9daeb50ec` |
| `tcv2019` | 现代中文译本 2019 | `data/versions/tcv2019.json` | 3,702,221 | 31,087 | `bf4c8139825506daa3cf5d379b752e0663631a4664c41c732103904426db939c` |
| `ncv` | 环球新译本 | `data/versions/ncv.json` | 3,861,545 | 31,061 | `093391463a32e999570d477efac3a1b77e83c66f0c65ab532ea5a7c3d545fb78` |

| 译本 | 版权归属 | 来源 |
| --- | --- | --- |
| 和合本（简体 / 繁体） | 公有领域（1919 年中文和合本） | 原版《语音投影圣经》Access 数据库 `bibleNosound.dat`（抽取流程见[数据说明 §2](../../docs/data.md#2-抽取流程)） |
| 吕振中译本 | © 吕振中 / 环球天道圣经机构 | 信望愛資訊中心 FHL API（<https://bible.fhl.net/api/qb.php>） |
| 和合本修订版 2010 | © 香港圣经公会 | 同上 |
| 中文标准译本 | © 全球圣经促进会 GBI | 同上 |
| 现代中文译本 2019 | © 联合国圣经翻译中文委员会 | 同上 |
| 环球新译本 | © 环球圣经公会 | 同上 |

> **分节差异**：各译本的节数不同（31,061 – 31,102），这是译本自身的分节体系差异，不是数据损坏。
> 应用**不跨译本用节号定位经文**——历史、收藏与标注只记「卷:章:节」。
> 详见[数据说明 §8.6](../../docs/data.md#86-译本之间的分节差异重要)。

---

## 3. 文件格式

每个译本文件都是**单行 JSON 数组**，每行（每个数组元素）是一节经文：

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

> 用户自行安装 / 导入的译本（存放在 `%APPDATA%\BibleProjection\versions\`）用的是**同一种格式**，
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

### 抓取

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

### 更新仓库里的内置文件

```bash
python tools/fetch-versions.py --out D:\vers          # 1. 抓取到临时目录
node tools/clean-versions.js D:\vers                  # 2. 清洗
# 3. 把 D:\vers\<id>.json 拷回 data\versions\（不要覆盖 manifest.json）
```

> ⚠️ `tools/clean-versions.js` 会遍历目录下所有 `.json` 文件，
> **不要直接对 `data/versions/` 运行它**——该目录里的 `manifest.json` 不是数组，
> 会让脚本报 `TypeError: rows is not iterable` 中断。

### 校验

```bash
node tools/verify-versions.js data/versions      # 校验仓库内置的全部 7 个译本 + 译本清单
node tools/verify-versions.js                    # 校验仓库内置数据 + 默认用户译本目录
node tools/verify-versions.js D:\vers            # 校验指定目录
node tools/verify-versions.js D:\vers --strict   # 节数与和合本不一致也判 FAIL
```

> ⚠️ 脚本头部的注释把 `--repo-only` 写成「只校验仓库内置数据」，
> 但实现里它恰好是**跳过**仓库内置的两个和合本文件（只校验用户译本目录）；
> 校验内置数据请用 `node tools/verify-versions.js data/versions`。

校验内容：JSON 可解析、每行是 `[bookId, chapter, verse, text]`、行序升序、键不重复、
每章节号连续、文本非空、每卷节数与和合本比对、与和合本的键集合差异、
抽查创世记 1:1 / 约翰福音 3:16 / 箴言 3:5 / 启示录 22:21，以及 `manifest.json` 的字段完整性。

> 译本之间本来就有分节差异，因此「节数与和合本不一致」默认只告警、不判失败；需要严格时加 `--strict`。
> 校验脚本**不联网**，目前也**不在 CI 中运行**。

---

## 6. 版权提示

- **和合本（1919）属公有领域**，其正文可自由使用与再分发。
- **其余 5 个译本受版权保护**，版权归上表所列机构所有；
  仓库按仓库所有者的要求内置了这些正文（安装包因此增大约 **19 MB**）。
- **再分发本仓库前，请自行确认是否符合各权利人的授权条款；若有疑虑，建议把仓库设为 private。**
- 本目录的文件均来自公开的 FHL API 与原程序数据库的**格式转换**，
  不包含任何译本之外的原程序代码或资源。
