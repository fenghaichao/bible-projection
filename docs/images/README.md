# 界面截图

本目录存放 README 与文档引用的界面截图。

**当前已有 3 张真实截图**，均由 Electron 运行时抓取（`webContents.capturePage()`）或 CDP `Page.captureScreenshot`
在实际运行的窗口中取得，不是示意图或渲染稿。

| 文件 | 尺寸 | 内容 |
| --- | --- | --- |
| `main-window.png` | 1264 × 781 | 主界面：顶栏工具、左侧 8 大类 66 卷书目、右侧大字号经文显示区（创世记第 1 章） |
| `projection-mode.png` | 1920 × 1080 | 投影模式：整屏单节居中、右上角绘制工具栏、右下角快捷键提示条 |
| `settings-panel.png` | 1264 × 781 | 设置面板：字体/字号/行距/颜色/背景图/背景音乐/阴影/标题字体与标题颜色/节号颜色/四边缩进等 |

引用方式（相对仓库根目录）：

```markdown
![主界面](docs/images/main-window.png)
![投影模式](docs/images/projection-mode.png)
![设置面板](docs/images/settings-panel.png)
```

## 约定与后续补充

截图统一使用 PNG、不包含任何个人隐私信息。后续如需补充，建议沿用以下命名：

| 用途 | 建议文件名 | 说明 |
| --- | --- | --- |
| 查找结果 | `search.png` | 多关键字查找与结果列表 |
| 简繁切换 | `traditional.png` | 繁体对照效果 |
| 历史与收藏 | `history.png` | 历史记录与收藏夹面板 |
| 浮动控制面板 | `float-panel.png` | 悬浮控制面板与新约/旧约目录 |

> 提示：仓库根目录的 `.gitignore` 已忽略 `shots/` 与 `tmp/`，临时截图请先放在那里，
> 确认后再复制到本目录。
