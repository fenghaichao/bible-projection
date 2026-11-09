// js/i18n.js — 全部界面文案（简体）。繁体只用于经文/书卷名数据开关，不属于界面文案。

export const T = {
  app: {
    name: '圣经投影',
    latin: 'SACRED PROJECTION',
  },

  topbar: {
    search: '查找',
    history: '历史',
    saved: '收藏',
    settings: '设置',
    projection: '投影模式',
    help: '帮助',
    lang: '简 / 繁',
    float: '浮动面板',
    searchPlaceholder: '查找经文（关键字 / 字母定位）',
  },

  sidebar: {
    all: '全部分类',
    back: '返回',
    books: (n) => `${n} 卷`,
    chapters: (n) => `${n} 章`,
    categoryFallback: '其它',
    empty: '没有可显示的内容。\n若经文数据缺失，请检查 data/ 目录。',
    pickBook: '选择书卷以查看章与节',
  },

  stage: {
    empty: '请选择左侧书卷以开始阅读',
    chapterLabel: (c) => `第 ${c} 章`,
    pageInfo: (a, b, t) => `${a}–${b} 节 / 共 ${t} 节`,
    pageHint: (a, b, t, per) => `${a}–${b} 节 / 共 ${t} 节 · 每页 ${per} 节`,
    pageLabel: (n) => `第 ${n} 页`,
    continuous: '（可继续向下滚动到下一章）',
  },

  search: {
    title: '查找经文',
    keywords: '关键字（空格分隔）',
    placeholder: '例如：爱 光',
    modeAll: '全部匹配',
    modeAny: '任一匹配',
    run: '搜索',
    idle: '输入关键字后按「搜索」，或直接回车。',
    running: '正在搜索…',
    count: (n) => `共 ${n} 条结果`,
    shown: (total, shown) => `共 ${total} 条结果，已显示 ${shown} 条`,
    capped: (n) => `结果过多，后端仅返回前 ${n} 条`,
    empty: '没有找到匹配的经文。',
    needKeywords: '请至少输入一个关键字。',
    jump: '跳转到该节',
    more: '显示更多',
    moreHint: (shown, total) => `已显示 ${shown} / ${total} 条`,
  },

  settings: {
    title: '设置',
    groupText: '经文显示',
    groupTitle: '标题与节号',
    groupShadow: '文字阴影',
    groupBgm: '背景音乐',
    groupProjection: '投影与显示',
    groupOther: '其他',
    font: '字体',
    fontFamily: '字体',
    fontPresets: ['微软雅黑', '宋体', '楷体', '仿宋', '黑体'],
    titleFont: '标题字体（留空＝跟随正文）',
    titleFontPlaceholder: '留空＝跟随正文',
    titleColor: '标题颜色',
    followText: '跟随正文色',
    verseColor: '节号颜色',
    followAccent: '跟随主题色',
    padding: '四边留白（像素）',
    paddingHint: '经文舞台四边的留白范围',
    size: '字号',
    lineHeight: '行距',
    textColor: '文字颜色',
    bgColor: '背景颜色',
    bgImage: '背景图路径',
    bgImageHint: '留空为纯色背景；路径需为本机绝对路径，例如 D:\\Program\\bg.jpg',
    clearBgImage: '清除背景图',
    browse: '浏览…',
    bgImageFailed: '背景图加载失败，请检查路径是否正确',
    bgImagePicked: '已选择背景图',
    shadow: '文字阴影',
    shadowColor: '阴影颜色',
    shadowBlur: '阴影模糊',
    shadowOffset: '阴影偏移',
    bgm: '背景音乐',
    bgmPath: '音乐文件路径',
    bgmPick: '选择音乐…',
    bgmClear: '清除音乐',
    bgmVolume: '音量',
    bgmLoop: '循环播放',
    bgmPicked: '已选择背景音乐',
    bgmFailed: '背景音乐加载失败，请检查文件路径',
    bgmNone: '未设置背景音乐',
    italic: '斜体',
    underline: '下划线',
    showNotes: '显示标注（每节下方显示出处）',
    versesPerPage: '每页节数（每屏显示的节数）',
    slideshow: '自动翻页间隔（秒，0 = 关闭）',
    slideshowHint: '仅在投影模式下生效',
    floatPanel: '显示浮动控制面板',
    mouseAdvance: '投影模式下点击画面翻节',
    theme: '主题',
    themeDark: '深色',
    themeLight: '浅色',
  },

  history: {
    title: '最近阅读',
    empty: '暂无阅读记录。',
    clear: '清空记录',
    cleared: '已清空阅读记录',
  },

  saved: {
    title: '我的收藏',
    empty: '还没有收藏经文。',
    remove: '删除收藏',
    removed: '已删除收藏',
    added: '已收藏该节',
    failed: '收藏失败',
  },

  help: {
    title: '帮助与快捷键',
    about: '圣经投影 · 完全离线运行的教会圣经投影与查经工具，支持简繁体经文、投影模式与绘画标注。',
    version: (v) => `版本 ${v}`,
    home: '打开项目主页',
    homeUrl: 'https://github.com/fenghaichao/bible-projection',
    shortcuts: '快捷键',
    aboutGroup: '关于',
    silentNote: '原版有声功能，无声版不适用',
    deviationNote:
      '与原版的差异：原版 Ctrl + S 为改变字体、Ctrl + ← / → 为切换历史经文；本版按功能核对表的取舍改为「收藏当前节」与「上一卷 / 下一卷」。',
    groups: [
      {
        title: '选经与定位',
        rows: [
          ['字母缩写', '速选书卷，例如 CSJ / CAJ / LWJ'],
          ['字母 + 数字', '定位章节，例如 CSJ4 或 CSJ 4'],
          ['CSJ4:14', '定位到第 4 章 14 节'],
          ['CSJ4Z / CSJ4:14Z', '整章 / 从该节至本章末节'],
          ['数字', '当前卷的第 N 章'],
          ['空格', '输入时自动补分隔符；空输入时为下一节'],
          ['Enter / Backspace / Esc', '跳转 / 删除 / 取消'],
        ],
      },
      {
        title: '翻页与显示',
        rows: [
          ['← → / ↑ ↓', '上一节 / 下一节'],
          ['空格', '下一节'],
          ['PageUp / PageDown', '按每页节数翻页'],
          ['Home / End', '本章首节 / 本章末节'],
          ['Ctrl + ← / Ctrl + →', '上一卷 / 下一卷'],
          ['Ctrl + PageUp / Ctrl + PageDown', '上一章 / 下一章'],
          ['Shift + > / Shift + <', '每页节数 +1 / -1'],
          ['Ctrl + 1…4', '切换多栏对照的当前组'],
          ['F5', '进入 / 退出投影模式（全屏）'],
          ['F6', '退出投影模式'],
          ['F11', '系统原生全屏（外观自动同步投影模式）'],
          ['Esc', '关闭面板 / 退出绘制 / 退出投影'],
        ],
      },
      {
        title: '文字与复制',
        rows: [
          ['Ctrl + C', '复制当前章（或选区）经文'],
          ['Ctrl + Shift + C', '仅复制当前节经文'],
          ['Alt + C', '仅复制章节标题'],
          ['鼠标右键', '复制 ▸ 复制经文 / 复制经文（分节）/ 复制经文（分节分行）'],
          ['鼠标右键', '全屏显示 / 停止播放 / 不显示经文'],
          ['Ctrl + = / Ctrl + -', '放大 / 缩小字号'],
          ['Ctrl + 0 / Ctrl + /', '恢复默认字号'],
          ['Ctrl + D', '切换经文字体'],
          ['Ctrl + T', '显示 / 隐藏出处标注'],
          ['顶栏「简 / 繁」', '切换简体 / 繁体经文'],
        ],
      },
      {
        title: '查找与收藏',
        rows: [
          ['Ctrl + F / F3', '打开查找面板'],
          ['Ctrl + H / F4', '打开最近阅读'],
          ['Ctrl + S', '收藏当前节'],
          ['Ctrl + ,', '打开设置'],
        ],
      },
      {
        title: '绘画标注（投影模式内）',
        rows: [
          ['Ctrl + B / Ctrl + P / D', '开关画布（绘制模式）'],
          ['鼠标左键拖动', '自由画线'],
          ['Shift + 拖动', '画矩形'],
          ['Ctrl + 拖动', '画圆形'],
          ['Alt + 拖动', '画线段'],
          ['E', '橡皮擦开关'],
          ['1 … 6', '画笔粗细'],
          ['W / G / L / B / Y / R', '画笔颜色'],
          ['双击画布', '添加文字标注（黑体 30 号 · 黄底深红字 · 30 字以内）'],
          ['Z / Ctrl + Z', '撤销上一笔'],
          ['Ctrl + Shift + Z', '重做'],
          ['Ctrl + E / X', '清空本章标注'],
        ],
      },
      {
        title: '投影与遥控',
        rows: [
          ['媒体键（上一曲 / 下一曲）', '翻到上一节 / 下一节'],
          ['投影下点击画面', '翻到下一节（可在设置中关闭）'],
          ['双击显示区', '打开最近阅读（普通模式）'],
          ['三击显示区', '清屏：隐藏经文，只留背景'],
          ['自动翻页', '按设置中的间隔自动翻节'],
          ['浮动控制面板', '显示区左缘悬停或顶栏按钮开启'],
        ],
      },
      {
        title: '原版有声功能（无声版不适用）',
        rows: [
          ['Insert / Delete', '原版：语音朗读控制 —— 无声版无语音，不适用'],
          ['Ctrl + Enter / Ctrl + End', '原版：朗读定位 —— 无声版不适用'],
          ['+ / -', '原版：播放速度 —— 无声版不适用'],
          ['播放控制栏', '原版：播放 / 暂停 / 停止 / 音量 —— 无声版不适用'],
          ['LRC 歌词同步', '原版：歌词逐句高亮 —— 无声版不适用'],
        ],
      },
    ],
    rows: [],
  },

  projection: {
    enter: '进入投影模式',
    exit: '退出投影模式',
    failed: '全屏切换失败，请检查系统权限',
    hint: '← → 翻节 · 空格 下一页 · 滚轮翻页 · D 绘制 · Esc 退出',
    slideshowPause: '暂停',
    slideshowResume: '继续',
    countdown: (s) => `${s} 秒后翻页`,
  },

  draw: {
    toggle: '绘制',
    stop: '停止绘制',
    text: '文字标注',
    undo: '撤销',
    clear: '清空',
    width: '粗细',
    saved: '标注已保存',
    restored: '已恢复本章标注',
    cleared: '已清空本章标注',
    textPlaceholder: '输入标注文字（最多 30 字）',
    eraserOn: '橡皮擦：开',
    eraserOff: '橡皮擦：关',
  },

  ctx: {
    copy: '复制',
    copyPlain: '复制经文',
    copyNumbered: '复制经文（分节）',
    copyLines: '复制经文（分节分行）',
    fullscreen: '全屏显示（F5）',
    stopPlay: '停止播放（End）',
    hideVerses: '不显示经文',
    showVerses: '显示经文',
  },

  columns: {
    add: '+ 对照栏',
    addHint: '新增一组经文用于对照（最多 4 组）',
    switchTo: (n) => `切换到第 ${n} 组`,
    limit: '最多只能同时显示 4 组经文',
  },

  letterbar: {
    title: '速选',
    hint: '字母选卷 · 数字选章 · Enter 跳转 · Esc 取消',
    candidates: (n) => `候选 ${n} 卷`,
    match: (name) => name,
    empty: '没有匹配的卷',
    chapterOf: (name, c) => `${name} 第 ${c} 章`,
    jumped: (name) => `已跳转到 ${name}`,
    multiple: (name) => `已跳转到第一个候选：${name}`,
  },

  float: {
    title: '浮动控制面板',
    prev: '上一节',
    next: '下一节',
    exit: '退出投影',
    close: '关闭',
    empty: '—',
  },

  toast: {
    copied: '已复制当前章经文到剪贴板',
    copiedSelection: '已复制选中的经文到剪贴板',
    copiedVerse: '已复制当前节经文到剪贴板',
    copiedTitle: '已复制章节标题到剪贴板',
    notesOn: '已显示出处标注',
    notesOff: '已隐藏出处标注',
    copiedVariant: (mode) => (mode === 'plain' ? '已复制经文' : mode === 'numbered' ? '已复制分节经文' : '已复制分节分行经文'),
    copyFailed: '复制失败',
    noBridge: '未检测到主进程桥接（window.bible），请检查 preload 配置',
    ipcFailed: (m) => `操作失败：${m}`,
    fontSize: (n) => `字号 ${n}`,
    versesPerPage: (n) => `每页 ${n} 节`,
    floatOn: '已打开浮动控制面板',
    floatOff: '已关闭浮动控制面板',
    bootFailed: (msg) => `启动失败：${msg}`,
    runtimeError: (msg) => `发生错误：${msg}`,
  },

  err: {
    noBook: '未找到该书卷',
    emptyBook: '该章暂无经文',
    noData: '尚未载入书卷数据',
  },

  book: {
    fallback: '经文',
  },
};

/** 扁平快捷键列表（由分组派生，兼容旧调用）。 */
T.help.rows = T.help.groups.flatMap((group) => group.rows);

/** 按 "a.b.c" 取文案。 */
export function t(path, fallback = '') {
  const value = String(path || '')
    .split('.')
    .reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), T);
  return value === undefined ? fallback : value;
}

/** 把 index.html / float.html 中标注了 data-i18n 的节点填上文案。 */
export function applyI18n(root = document) {
  if (!root || typeof root.querySelectorAll !== 'function') return;
  for (const node of root.querySelectorAll('[data-i18n]')) {
    const value = t(node.dataset.i18n, '');
    if (typeof value === 'string' && value) node.textContent = value;
  }
  // title / placeholder 等属性文案
  for (const node of root.querySelectorAll('[data-i18n-title]')) {
    const value = t(node.dataset.i18nTitle, '');
    if (typeof value === 'string' && value) node.setAttribute('title', value);
  }
  for (const node of root.querySelectorAll('[data-i18n-placeholder]')) {
    const value = t(node.dataset.i18nPlaceholder, '');
    if (typeof value === 'string' && value) node.setAttribute('placeholder', value);
  }
}
