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
    empty: '没有找到匹配的经文。',
    needKeywords: '请至少输入一个关键字。',
    jump: '跳转到该节',
  },

  settings: {
    title: '设置',
    font: '字体',
    fontPresets: ['微软雅黑', '宋体', '楷体', '仿宋', '黑体'],
    size: '字号',
    lineHeight: '行距',
    textColor: '文字颜色',
    bgColor: '背景颜色',
    bgImage: '背景图路径',
    bgImageHint: '留空为纯色背景；路径需为本机绝对路径，例如 D:\\Program\\bg.jpg',
    clearBgImage: '清除背景图',
    italic: '斜体',
    underline: '下划线',
    showNotes: '显示标注（每节下方显示出处）',
    versesPerPage: '每页节数（投影模式每屏显示）',
    theme: '主题',
    themeDark: '深色',
    themeLight: '浅色',
    bgImageFailed: '背景图加载失败，请检查路径是否正确',
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
    rows: [
      ['Ctrl + F', '打开查找面板'],
      ['Ctrl + H', '打开最近阅读'],
      ['Ctrl + S / Ctrl + B', '收藏当前节'],
      ['Ctrl + ,', '打开设置'],
      ['Ctrl + C', '复制当前章（或选区）经文'],
      ['Ctrl + = / Ctrl + -', '放大 / 缩小字号'],
      ['Ctrl + 0 / Ctrl + /', '恢复默认字号'],
      ['F5 / F11', '进入 / 退出投影模式'],
      ['Esc', '关闭面板 / 退出绘制 / 退出投影'],
      ['← → / ↑ ↓', '上一节 / 下一节'],
      ['空格', '下一节'],
      ['PageUp / PageDown', '按每页节数翻页'],
      ['Home / End', '本章首节 / 本章末节'],
      ['Ctrl + ← / Ctrl + →', '上一卷 / 下一卷'],
      ['Ctrl + PageUp / Ctrl + PageDown', '上一章 / 下一章'],
      ['D / P', '开关绘制模式（投影模式）'],
      ['Z / Ctrl + Z', '撤销上一笔'],
      ['Ctrl + Shift + Z', '重做'],
      ['X / Ctrl + Shift + Delete', '清空全部标注'],
      ['鼠标左键拖动', '画笔；Ctrl + 拖动为橡皮擦'],
    ],
  },

  projection: {
    enter: '进入投影模式',
    exit: '退出投影模式',
    failed: '全屏切换失败，请检查系统权限',
    hint: '← → 翻节 · 空格 下一页 · 滚轮翻页 · D 绘制 · Esc 退出',
  },

  draw: {
    toggle: '绘制',
    stop: '停止绘制',
    undo: '撤销',
    clear: '清空',
    width: '粗细',
  },

  toast: {
    copied: '已复制当前章经文到剪贴板',
    copiedSelection: '已复制选中的经文到剪贴板',
    copyFailed: '复制失败',
    noBridge: '未检测到主进程桥接（window.bible），请检查 preload 配置',
    ipcFailed: (m) => `操作失败：${m}`,
    fontSize: (n) => `字号 ${n}`,
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
