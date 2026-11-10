# 译本清单与版权

本项目内置 **7 个中文圣经译本**，安装后即可在顶栏译本下拉里直接切换，**无需联网、无需下载**：

- 和合本（简体）、和合本（繁体）——**公有领域**（1919 年出版）；
- 吕振中译本、和合本修订版 2010、中文标准译本、现代中文译本 2019、环球新译本——
  **仍受版权保护**，但仓库按仓库所有者的要求**已内置**其正文。

> 再分发本仓库前，请自行确认内置译本是否符合各权利人的授权条款；
> 若有疑虑，建议把仓库设为 **private**。详见[第二节](#二版权说明)。

> 数据流与 IPC 契约见 [架构说明 · 多译本架构](architecture.md#8-多译本架构)。

---

## 一、译本清单

清单文件是仓库内的 `data/versions/manifest.json`，格式为 `{"versions": [ ... ]}`，
每个条目描述一个译本。

| id | 名称 | 内置文件 | 节数 | 版权归属 | 来源 |
| --- | --- | --- | --- | --- | --- |
| `simplified` | 和合本（简体） | `data/bible-simplified.json` | 31,102 | 公有领域（1919 年中文和合本） | 原版《语音投影圣经》Access 数据库 `bibleNosound.dat` |
| `traditional` | 和合本（繁体） | `data/bible-traditional.json` | 31,102 | 公有领域（1919 年中文和合本） | 同上 |
| `lcc` | 吕振中译本 | `data/versions/lcc.json` | 31,081 | © 吕振中 / 环球天道圣经机构 | 信望愛 FHL API |
| `rcuv` | 和合本修订版 2010 | `data/versions/rcuv.json` | 31,094 | © 香港圣经公会 | 信望愛 FHL API |
| `csb` | 中文标准译本 | `data/versions/csb.json` | 31,087 | © 全球圣经促进会 GBI | 信望愛 FHL API |
| `tcv2019` | 现代中文译本 2019 | `data/versions/tcv2019.json` | 31,087 | © 联合国圣经翻译中文委员会 | 信望愛 FHL API |
| `ncv` | 环球新译本 | `data/versions/ncv.json` | 31,061 | © 环球圣经公会 | 信望愛 FHL API |

数据来源 API：<https://bible.fhl.net/api/qb.php>（信望愛資訊中心）。

逐文件的大小、节数与 SHA-256 见 [data/versions/README.md](../data/versions/README.md)。

### 清单条目字段

| 字段 | 含义 |
| --- | --- |
| `id` | 译本标识，同时也是 `settings.version` 的取值 |
| `name` | 下拉框与界面上的显示名 |
| `bundled` | `true` 表示正文随仓库分发。**当前 7 个条目全部为 `true`** |
| `file` | 正文文件名，相对 `data/` 目录。和合本简 / 繁为 `bible-simplified.json` / `bible-traditional.json`，其余 5 个为 `versions/<id>.json` |
| `fhlVersion` | 信望愛 API 的版本参数，用于在线下载；和合本无此字段 |
| `copyright` | 版权归属，界面与本文档都会显示 |
| `source` | 正文来源，界面与本文档都会显示 |
| `lang` | 语言标记，如 `zh-Hans` / `zh-Hant` |

---

## 二、版权说明

### 2.1 和合本（1919）：公有领域

和合本（Chinese Union Version, 1919）的版权**已过期进入公有领域**，
因此其正文（简体与繁体）随仓库一起分发，可自由使用与再分发。
仓库内的两份正文来自原程序《语音投影圣经》数据库的抽取结果，详见 [数据说明](data.md)。

### 2.2 其余 5 个译本：受版权保护，但已按所有者要求内置

| 译本 | 权利人 |
| --- | --- |
| 吕振中译本 `lcc` | © 吕振中 / 环球天道圣经机构 |
| 和合本修订版 2010 `rcuv` | © 香港圣经公会 |
| 中文标准译本 `csb` | © 全球圣经促进会 GBI |
| 现代中文译本 2019 `tcv2019` | © 联合国圣经翻译中文委员会 |
| 环球新译本 `ncv` | © 环球圣经公会 |

- 这 5 个译本的正文**受版权保护**，版权归上表所列机构所有；
- 仓库**按仓库所有者的要求**内置了这些正文（文件位于 `data/versions/`），
  安装包因此增大约 **19 MB**（5 个 JSON 合计约 19.1 MB）；
- 数据的原始来源是**信望愛 FHL API**（<https://bible.fhl.net/api/qb.php>），
  `tools/fetch-versions.py` 只是一个**从公开 API 抓取并转换格式**的辅助脚本；
- **再分发本仓库前，请自行确认是否符合各权利人的授权条款**；
  若有疑虑，建议把仓库设为 **private**；
- 本项目不代替使用者判断其使用授权。

### 2.3 译本之间的分节差异

各译本**分节不同**（31,061 – 31,102 节）。这是译本本身的差异，不是数据损坏。
因此应用**不跨译本用节号定位经文**：历史、收藏与标注只记录「卷:章:节」的位置，
正文按当前译本取回。

---

## 三、译本数据的存放位置

| 类别 | 路径 | 是否进 Git |
| --- | --- | --- |
| 译本清单 | `data/versions/manifest.json` | ✅ 进仓库（只含元信息） |
| 内置和合本正文 | `data/bible-simplified.json`、`data/bible-traditional.json` | ✅ 进仓库（公有领域） |
| 内置的 5 个受版权译本 | `data/versions/<id>.json` | ✅ 进仓库（受版权保护，见 2.2） |
| 用户自行导入 / 下载的译本正文 | `%APPDATA%\BibleProjection\versions\<id>.json` | ❌ 不进仓库（用户数据目录） |
| 上述译本的元信息 | `%APPDATA%\BibleProjection\versions\<id>.meta.json` | ❌ 不进仓库 |

> `%APPDATA%` 在 Windows 上对应 `C:\Users\<用户名>\AppData\Roaming`，
> 与 Electron 的 `app.getPath('userData')` 指向同一处（应用目录名为 `BibleProjection`）。
> 卸载应用不会自动删除这里的译本文件。

**查找顺序**：内置优先，其次用户目录（见 `src/main/versions.js` 的 `resolveVersionFile()`）。
清单里没有、但用户目录里存在的译本（例如手工导入的），会在译本列表里以「本地导入」呈现。

### 译本文件格式

内置译本与用户安装的译本**同构**，即一个扁平数组：

```json
[[1, 1, 1, "起初神创造天地。"], [1, 1, 2, "地是混沌、地是空虚。"]]
```

每个元素是 `[书卷号, 章, 节, 经文正文]`，书卷号 1–66 对应 `src/shared/books.js` 里的卷序。
用户目录下的译本还配套一个 `<id>.meta.json`，记录该译本的元信息：

```json
{
  "id": "lcc",
  "name": "吕振中译本",
  "fhlVersion": "lcc",
  "verses": 31081,
  "copyright": "© 吕振中 / 环球天道圣经机构",
  "source": "信望愛資訊中心 FHL API（https://bible.fhl.net/api/qb.php）",
  "installedAt": "2026-01-01T00:00:00.000Z"
}
```

---

## 四、译本管理

### 4.1 应用内

顶栏有两个相关控件：

- **译本下拉框**（`#version-select`）：列出全部 7 个译本，**全部内置**，选中即切换。
  只有当某个译本的文件缺失时，它才会显示「XXX（未安装）」，
  此时选中不会切换，只会提示到「获取译本」面板处理。
- **「获取译本」按钮**（`#btn-versions`）：打开右侧抽屉里的「获取译本」面板。

「获取译本」面板里，每个译本一行，显示名称、「内置 / 已安装 / 未安装」标签、来源与版权：

| 状态 | 按钮 | 说明 |
| --- | --- | --- |
| 内置（默认） | 「使用此译本」 | 当前译本显示「当前译本」并禁用；点击即切换 |
| 已安装（用户导入 / 下载） | 「使用此译本」 | 同上 |
| 未安装（文件缺失） | 「下载安装」 | 下载中显示进度条与百分比，并可「停止跟踪」（只停止界面跟随，后台下载可能仍在继续） |
| 任意 | 面板底部「从本地文件导入…」 | 导入本地译本 JSON，文件格式与内置译本相同（`[书卷号, 章, 节, 正文]` 数组），译本 id 取文件名（去 `.json`） |
| 任意 | 面板底部「刷新列表」 | 重新读取译本清单与安装状态 |

下载过程中主进程通过 `bible:version-progress` 事件推送进度；
安装或导入成功后广播 `bible:versions-changed`，界面刷新列表并**自动切换到刚装好的译本**。

> **内置译本不提供重复下载**：主进程对清单里 `bundled: true` 的条目直接返回「该译本已内置」。
> 如果内置文件缺失（例如自行裁剪过安装目录），请用命令行脚本抓取到用户目录后再「从本地文件导入…」，
> 或把文件补回 `data/versions/`。

> **顶栏没有独立的「简 / 繁」按钮**：繁体经文请在译本下拉框里选「和合本（繁体）」。

### 4.2 命令行：重新抓取 / 更新内置译本

仓库自带抓取脚本 `tools/fetch-versions.py`（Python 3 + 网络）：

```bash
# 抓取全部 5 个可下载译本到 %APPDATA%\BibleProjection\versions
python tools/fetch-versions.py

# 只抓指定译本
python tools/fetch-versions.py --versions lcc,rcuv

# 抓取到指定目录
python tools/fetch-versions.py --versions ncv --out D:\vers
```

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `--versions` | 全部 5 个 | 逗号分隔的译本 id（`lcc` / `rcuv` / `csb` / `tcv2019` / `ncv`） |
| `--out` | `%APPDATA%\BibleProjection\versions` | 输出目录 |
| `--workers` | `6` | 并发线程数 |
| `--delay` | `0.12` | 每次请求之间的间隔（秒），避免给公开 API 造成压力 |

脚本会逐卷抓取 66 卷经文，写出 `<id>.json` 与配套的 `<id>.meta.json`。

**更新仓库内的内置文件**时，建议先抓到临时目录、清洗后再拷回 `data/versions/`：

```bash
python tools/fetch-versions.py --out D:\vers          # 1. 抓取到临时目录
node tools/clean-versions.js D:\vers                  # 2. 清洗
# 3. 把 D:\vers\<id>.json 拷回 data/versions\（manifest.json 不要覆盖）
```

> ⚠️ `tools/clean-versions.js` 会遍历目录下所有 `.json` 文件，
> **不要直接对 `data/versions/` 运行它**——该目录里的 `manifest.json` 不是数组，会导致脚本报错中断。
>
> 该脚本需要 Python 3 与网络连接，**属于用户侧取数工具，不参与 CI**；
> 内置译本文件本身不需要联网即可使用。

---

## 五、校验与清洗

| 脚本 | 作用 | 是否联网 |
| --- | --- | --- |
| `tools/verify-data.js` | 校验**内置和合本**的节数、键唯一性与简繁一致性 | ❌ 不联网 |
| `tools/verify-versions.js` | 校验译本文件的结构与内容：JSON 可解析、每行是 `[书卷号, 章, 节, 正文]`、行序按 `(书卷号, 章, 节)` 升序、键不重复、每章节号连续、文本非空、每卷节数与和合本基准比对、与和合本的键集合差异，并抽查创世记 1:1、约翰福音 3:16、箴言 3:5、启示录 22:21；同时校验 `data/versions/manifest.json` 的字段完整性 | ❌ 不联网 |
| `tools/clean-versions.js` | 对译本文件做一次清洗（去 HTML 标签与实体、行内注释、脚注编号 `【14】`、节内换行），清洗规则与 `src/main/versions.js` 的 `cleanText` 一致 | ❌ 不联网 |

常用用法：

```bash
node tools/verify-versions.js data/versions    # 校验仓库内置的全部 7 个译本 + 清单
node tools/verify-versions.js                  # 校验仓库内置数据 + 默认用户译本目录
node tools/verify-versions.js D:\vers          # 校验指定目录下的译本
node tools/verify-versions.js D:\vers --strict # 节数与和合本不一致也判 FAIL

node tools/clean-versions.js                   # 清洗默认用户译本目录
node tools/clean-versions.js D:\vers           # 清洗指定目录
```

> ⚠️ 脚本头部的注释把 `--repo-only` 写成「只校验仓库内置数据」，
> 但实现里它恰好是**跳过**仓库内置的两个和合本文件（只校验用户译本目录）。
> 想校验内置数据请用上面的 `node tools/verify-versions.js data/versions`。

> 译本之间本来就有分节差异（例如环球新译本比和合本少几十节），
> 这是译本本身的差异而不是数据损坏，因此默认只告警、不判失败；需要严格时加 `--strict`。
>
> 校验与清洗脚本都**只读 / 只改本地文件，不访问网络**；
> 它们目前也**不在 CI 中运行**（CI 只做安装与单元测试）。
