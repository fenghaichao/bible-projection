# 译本清单与版权

本项目支持多个中文圣经译本。**仓库内只内置公有领域的和合本（简体 / 繁体）**；
其余译本仍受版权保护，需要使用者自行下载安装，**本仓库不分发受版权保护的译本正文**。

> 数据流与 IPC 契约见 [架构说明 · 多译本架构](architecture.md#8-多译本架构)。

---

## 一、译本清单

清单文件是仓库内的 `data/versions/manifest.json`，格式为 `{"versions": [ ... ]}`，
每个条目描述一个译本。

| id | 名称 | 版权归属 | 来源 | 是否内置 |
| --- | --- | --- | --- | --- |
| `simplified` | 和合本（简体） | 公有领域（1919 年中文和合本） | 原版《语音投影圣经》Access 数据库 `bibleNosound.dat` | ✅ 内置 |
| `traditional` | 和合本（繁体） | 公有领域（1919 年中文和合本） | 原版《语音投影圣经》Access 数据库 `bibleNosound.dat` | ✅ 内置 |
| `lcc` | 吕振中译本 | © 吕振中 / 环球天道圣经机构 | 信望愛 FHL API | ⬇️ 需自行下载 |
| `rcuv` | 和合本修订版 2010 | © 香港圣经公会 | 信望愛 FHL API | ⬇️ 需自行下载 |
| `csb` | 中文标准译本 | © 全球圣经促进会 GBI | 信望愛 FHL API | ⬇️ 需自行下载 |
| `tcv95` | 现代中文译本 1995 | © 联合国圣经翻译中文委员会 | 信望愛 FHL API | ⬇️ 需自行下载 |
| `tcv2019` | 现代中文译本 2019 | © 联合国圣经翻译中文委员会 | 信望愛 FHL API | ⬇️ 需自行下载 |
| `ncv` | 环球新译本 | © 环球圣经公会 | 信望愛 FHL API | ⬇️ 需自行下载 |

数据来源 API：<https://bible.fhl.net/api/qb.php>（信望愛資訊中心）。

### 清单条目字段

| 字段 | 含义 |
| --- | --- |
| `id` | 译本标识，同时也是 `settings.version` 的取值 |
| `name` | 下拉框与界面上的显示名 |
| `bundled` | `true` 表示正文随仓库分发（只有和合本简体 / 繁体为 `true`） |
| `file` | 正文文件名，相对 `data/` 目录，仅 `bundled` 条目使用 |
| `fhlVersion` | 信望愛 API 的版本参数，用于在线下载，仅可安装条目使用 |
| `copyright` | 版权归属，界面与本文档都会显示 |
| `source` | 正文来源，界面与本文档都会显示 |
| `lang` | 语言标记，如 `zh-Hans` / `zh-Hant` |

---

## 二、版权说明

### 2.1 内置译本：和合本（1919）

和合本（Chinese Union Version, 1919）的版权**已过期进入公有领域**，
因此其正文（简体与繁体）随仓库一起分发，可自由使用与再分发。
仓库内的两份正文来自原程序《语音投影圣经》数据库的抽取结果，详见 [数据说明](data.md)。

### 2.2 可安装译本

上表中标「需自行下载」的 6 个译本**全部仍受版权保护**，版权归各译本机构所有
（见表中「版权归属」一列）：

- 本仓库**不包含**这些译本的正文文件；
- 本仓库**不提供**这些译本正文的镜像、压缩包或下载链接；
- `tools/fetch-versions.py` 只是**从信望愛公开 API 抓取**并转换格式的辅助脚本，
  运行它等于你自己访问该 API 并把结果保存到本机；
- 使用者需自行确认所选译本的授权条款，并自行承担相应责任。

---

## 三、译本数据的存放位置

| 类别 | 路径 | 是否进 Git |
| --- | --- | --- |
| 译本清单 | `data/versions/manifest.json` | ✅ 进仓库（只含元信息，不含正文） |
| 内置和合本正文 | `data/bible-simplified.json`、`data/bible-traditional.json` | ✅ 进仓库（公有领域） |
| 已安装译本正文 | `%APPDATA%\BibleProjection\versions\<id>.json` | ❌ 不进仓库（用户数据目录） |
| 已安装译本元信息 | `%APPDATA%\BibleProjection\versions\<id>.meta.json` | ❌ 不进仓库 |

> `%APPDATA%` 在 Windows 上对应 `C:\Users\<用户名>\AppData\Roaming`，
> 与 Electron 的 `app.getPath('userData')` 指向同一处（应用目录名为 `BibleProjection`）。
> 卸载应用不会自动删除这里的译本文件。

### 译本文件格式

已安装译本的数据文件与内置和合本**同构**，即一个扁平数组：

```json
[[1, 1, 1, "起初神创造天地。"], [1, 1, 2, "地是混沌、地是空虚。"]]
```

每个元素是 `[书卷号, 章, 节, 经文正文]`，书卷号 1–66 对应 `src/shared/books.js` 里的卷序。
配套的 `<id>.meta.json` 记录该译本的元信息：

```json
{
  "id": "lcc",
  "name": "吕振中译本",
  "fhlVersion": "lcc",
  "verses": 31102,
  "copyright": "© 吕振中 / 环球天道圣经机构",
  "source": "信望愛資訊中心 FHL API（https://bible.fhl.net/api/qb.php）",
  "installedAt": "2026-01-01T00:00:00.000Z"
}
```

---

## 四、如何安装译本

### 4.1 应用内安装

顶栏有两个相关控件：

- **译本下拉框**（`#version-select`）：列出全部译本——已安装的只显示名字，
  未安装的显示「XXX（未安装）」。**选中未安装的译本不会切换**，只会提示
  「尚未安装，请先在「获取译本」中下载」并打开该面板；选中已安装的译本则立即切换。
- **「获取译本」按钮**（`#btn-versions`）：打开右侧抽屉里的「获取译本」面板。

「获取译本」面板里，每个译本一行，显示名称、「已安装 / 未安装 / 内置」标签、来源与版权：

| 状态 | 按钮 | 说明 |
| --- | --- | --- |
| 已安装 | 「使用此译本」 | 当前译本显示「当前译本」并禁用；点击即切换 |
| 未安装 | 「下载安装」 | 下载中显示进度条与百分比，并可「停止跟踪」（只停止界面跟随，后台下载可能仍在继续） |
| 任意 | 面板底部「从本地文件导入…」 | 导入本地译本 JSON，文件格式与内置和合本相同（`[书卷号, 章, 节, 正文]` 数组），译本 id 取文件名（去 `.json`） |
| 任意 | 面板底部「刷新列表」 | 重新读取译本清单与安装状态 |

下载过程中主进程通过 `bible:version-progress` 事件推送进度；
安装或导入成功后广播 `bible:versions-changed`，界面刷新列表并**自动切换到刚装好的译本**。

> **顶栏没有独立的「简 / 繁」按钮**：繁体经文请在译本下拉框里选「和合本（繁体）」。

### 4.2 命令行安装

仓库自带抓取脚本 `tools/fetch-versions.py`：

```bash
# 抓取全部 6 个可安装译本到 %APPDATA%\BibleProjection\versions
python tools/fetch-versions.py

# 只抓指定译本
python tools/fetch-versions.py --versions lcc,rcuv

# 抓取到指定目录
python tools/fetch-versions.py --versions ncv --out D:\vers
```

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `--versions` | 全部 6 个 | 逗号分隔的译本 id（`lcc` / `rcuv` / `csb` / `tcv95` / `tcv2019` / `ncv`） |
| `--out` | `%APPDATA%\BibleProjection\versions` | 输出目录 |
| `--workers` | `6` | 并发线程数 |
| `--delay` | `0.12` | 每次请求之间的间隔（秒），避免给公开 API 造成压力 |

脚本会逐卷抓取 66 卷经文，清理标题标签与行内注释后写入 `<id>.json`，
并生成配套的 `<id>.meta.json`。

> 抓取前请自行确认所选译本的授权条款。
> 该脚本需要 Python 3 与网络连接，**属于用户侧取数工具，不参与 CI**。

---

## 五、校验与清洗

| 脚本 | 作用 | 是否联网 |
| --- | --- | --- |
| `tools/verify-data.js` | 校验**内置和合本**的节数、键唯一性与简繁一致性 | ❌ 不联网 |
| `tools/verify-versions.js` | 校验译本文件的结构与内容：JSON 可解析、每行是 `[书卷号, 章, 节, 正文]`、行序按 `(书卷号, 章, 节)` 升序、键不重复、每章节号连续、文本非空、每卷节数与和合本基准比对、与和合本的键集合差异，并抽查创世记 1:1、约翰福音 3:16、箴言 3:5、启示录 22:21；同时校验 `data/versions/manifest.json` 的字段完整性 | ❌ 不联网 |
| `tools/clean-versions.js` | 对已下载的译本做一次清洗（去脚注编号 `【14】`、行内注释、节内换行），清洗规则与 `src/main/versions.js` 的 `cleanText` 一致 | ❌ 不联网 |

常用用法：

```bash
node tools/verify-versions.js                  # 校验仓库内置数据 + 默认用户译本目录
node tools/verify-versions.js --repo-only      # 只校验仓库内置数据
node tools/verify-versions.js D:\vers          # 校验指定目录下的译本
node tools/verify-versions.js D:\vers --strict # 节数与和合本不一致也判 FAIL

node tools/clean-versions.js                   # 清洗默认用户译本目录
node tools/clean-versions.js D:\vers           # 清洗指定目录
```

> 译本之间本来就有分节差异（例如吕振中译本比和合本多「约翰福音 7:53」），
> 这是译本本身的差异而不是数据损坏，因此默认只告警、不判失败；需要严格时加 `--strict`。
>
> 校验与清洗脚本都**只读 / 只改本地文件，不访问网络**，因此不会触及受版权保护的译本分发问题；
> 它们目前也**不在 CI 中运行**（CI 只做安装与单元测试）。
