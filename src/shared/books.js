'use strict';

// 66 books, ordered by canonical book id (1..66).
// category = KindSN 1..8 in the original bibleNosound.dat (see tools/extract-mdb.ps1).
const CATEGORIES = [
  "摩西五经",
  "旧约历史",
  "诗歌智慧",
  "大先知",
  "小先知",
  "福音书",
  "书信",
  "启示录"
];

/** 与 CATEGORIES 一一对应的繁体分类名（KindSN 1..8） */
const CATEGORIES_TRADITIONAL = [
  "摩西五經",
  "舊約歷史",
  "詩歌智慧",
  "大先知",
  "小先知",
  "福音書",
  "書信",
  "啟示錄"
];

/**
 * 取分类名。
 * @param {number} category KindSN（1..8）
 * @param {boolean} traditional 是否繁体
 */
function getCategoryName(category, traditional) {
  const idx = Number(category) - 1;
  if (idx < 0) return '';
  if (traditional) return CATEGORIES_TRADITIONAL[idx] || CATEGORIES[idx] || '';
  return CATEGORIES[idx] || '';
}

const RAW_BOOKS = [
  { id: 1, name: "创世记", nameTraditional: "創世記", short: "创", shortTraditional: "創", abbr: "CSJ", category: 1, categoryName: "摩西五经", chapters: 50, verses: 1533, firstVerseId: 1, testament: "旧约" },
  { id: 2, name: "出埃及记", nameTraditional: "出埃及記", short: "出", shortTraditional: "出", abbr: "CAJ", category: 1, categoryName: "摩西五经", chapters: 40, verses: 1213, firstVerseId: 1534, testament: "旧约" },
  { id: 3, name: "利未记", nameTraditional: "利未記", short: "利", shortTraditional: "利", abbr: "LWJ", category: 1, categoryName: "摩西五经", chapters: 27, verses: 859, firstVerseId: 2747, testament: "旧约" },
  { id: 4, name: "民数记", nameTraditional: "民數記", short: "民", shortTraditional: "民", abbr: "MSJ", category: 1, categoryName: "摩西五经", chapters: 36, verses: 1288, firstVerseId: 3606, testament: "旧约" },
  { id: 5, name: "申命记", nameTraditional: "申命記", short: "申", shortTraditional: "申", abbr: "SMJ", category: 1, categoryName: "摩西五经", chapters: 34, verses: 959, firstVerseId: 4894, testament: "旧约" },
  { id: 6, name: "约书亚记", nameTraditional: "約書亞記", short: "书", shortTraditional: "書", abbr: "YS", category: 2, categoryName: "旧约历史", chapters: 24, verses: 658, firstVerseId: 5853, testament: "旧约" },
  { id: 7, name: "士师记", nameTraditional: "士師記", short: "士", shortTraditional: "士", abbr: "SSJ", category: 2, categoryName: "旧约历史", chapters: 21, verses: 618, firstVerseId: 6511, testament: "旧约" },
  { id: 8, name: "路得记", nameTraditional: "路得記", short: "得", shortTraditional: "得", abbr: "LDJ", category: 2, categoryName: "旧约历史", chapters: 4, verses: 85, firstVerseId: 7129, testament: "旧约" },
  { id: 9, name: "撒母耳记上", nameTraditional: "撒母耳記上", short: "撒上", shortTraditional: "撒上", abbr: "SMS", category: 2, categoryName: "旧约历史", chapters: 31, verses: 810, firstVerseId: 7214, testament: "旧约" },
  { id: 10, name: "撒母耳记下", nameTraditional: "撒母耳記下", short: "撒下", shortTraditional: "撒下", abbr: "SMX", category: 2, categoryName: "旧约历史", chapters: 24, verses: 695, firstVerseId: 8024, testament: "旧约" },
  { id: 11, name: "列王纪上", nameTraditional: "列王紀上", short: "王上", shortTraditional: "王上", abbr: "LWS", category: 2, categoryName: "旧约历史", chapters: 22, verses: 816, firstVerseId: 8719, testament: "旧约" },
  { id: 12, name: "列王纪下", nameTraditional: "列王紀下", short: "王下", shortTraditional: "王下", abbr: "LWX", category: 2, categoryName: "旧约历史", chapters: 25, verses: 719, firstVerseId: 9535, testament: "旧约" },
  { id: 13, name: "历代志上", nameTraditional: "歷代志上", short: "代上", shortTraditional: "代上", abbr: "LDS", category: 2, categoryName: "旧约历史", chapters: 29, verses: 942, firstVerseId: 10254, testament: "旧约" },
  { id: 14, name: "历代志下", nameTraditional: "歷代志下", short: "代下", shortTraditional: "代下", abbr: "LDX", category: 2, categoryName: "旧约历史", chapters: 36, verses: 822, firstVerseId: 11196, testament: "旧约" },
  { id: 15, name: "以斯拉记", nameTraditional: "以斯拉記", short: "拉", shortTraditional: "拉", abbr: "YSL", category: 2, categoryName: "旧约历史", chapters: 10, verses: 280, firstVerseId: 12018, testament: "旧约" },
  { id: 16, name: "尼希米记", nameTraditional: "尼希米記", short: "尼", shortTraditional: "尼", abbr: "NXM", category: 2, categoryName: "旧约历史", chapters: 13, verses: 406, firstVerseId: 12298, testament: "旧约" },
  { id: 17, name: "以斯帖记", nameTraditional: "以斯帖記", short: "斯", shortTraditional: "斯", abbr: "YST", category: 2, categoryName: "旧约历史", chapters: 10, verses: 167, firstVerseId: 12704, testament: "旧约" },
  { id: 18, name: "约伯记", nameTraditional: "約伯記", short: "伯", shortTraditional: "伯", abbr: "YBJ", category: 3, categoryName: "诗歌智慧", chapters: 42, verses: 1070, firstVerseId: 12871, testament: "旧约" },
  { id: 19, name: "诗篇", nameTraditional: "詩篇", short: "诗", shortTraditional: "詩", abbr: "SP", category: 3, categoryName: "诗歌智慧", chapters: 150, verses: 2461, firstVerseId: 13941, testament: "旧约" },
  { id: 20, name: "箴言", nameTraditional: "箴言", short: "箴", shortTraditional: "箴", abbr: "ZY", category: 3, categoryName: "诗歌智慧", chapters: 31, verses: 915, firstVerseId: 16402, testament: "旧约" },
  { id: 21, name: "传道书", nameTraditional: "傳道書", short: "传", shortTraditional: "傳", abbr: "CDS", category: 3, categoryName: "诗歌智慧", chapters: 12, verses: 222, firstVerseId: 17317, testament: "旧约" },
  { id: 22, name: "雅歌", nameTraditional: "雅歌", short: "歌", shortTraditional: "歌", abbr: "YG", category: 3, categoryName: "诗歌智慧", chapters: 8, verses: 117, firstVerseId: 17539, testament: "旧约" },
  { id: 23, name: "以赛亚书", nameTraditional: "以賽亞書", short: "赛", shortTraditional: "賽", abbr: "YSY", category: 4, categoryName: "大先知", chapters: 66, verses: 1292, firstVerseId: 17656, testament: "旧约" },
  { id: 24, name: "耶利米书", nameTraditional: "耶利米書", short: "耶", shortTraditional: "耶", abbr: "YLM", category: 4, categoryName: "大先知", chapters: 52, verses: 1364, firstVerseId: 18948, testament: "旧约" },
  { id: 25, name: "耶利米哀歌", nameTraditional: "耶利米哀歌", short: "哀", shortTraditional: "哀", abbr: "YAG", category: 4, categoryName: "大先知", chapters: 5, verses: 154, firstVerseId: 20312, testament: "旧约" },
  { id: 26, name: "以西结书", nameTraditional: "以西結書", short: "结", shortTraditional: "結", abbr: "YXJ", category: 4, categoryName: "大先知", chapters: 48, verses: 1273, firstVerseId: 20466, testament: "旧约" },
  { id: 27, name: "但以理书", nameTraditional: "但以理書", short: "但", shortTraditional: "但", abbr: "DYL", category: 4, categoryName: "大先知", chapters: 12, verses: 357, firstVerseId: 21739, testament: "旧约" },
  { id: 28, name: "何西阿书", nameTraditional: "何西阿書", short: "何", shortTraditional: "何", abbr: "HXA", category: 5, categoryName: "小先知", chapters: 14, verses: 197, firstVerseId: 22096, testament: "旧约" },
  { id: 29, name: "约珥书", nameTraditional: "約珥書", short: "珥", shortTraditional: "珥", abbr: "YES", category: 5, categoryName: "小先知", chapters: 3, verses: 73, firstVerseId: 22293, testament: "旧约" },
  { id: 30, name: "阿摩司书", nameTraditional: "阿摩司書", short: "摩", shortTraditional: "摩", abbr: "AMS", category: 5, categoryName: "小先知", chapters: 9, verses: 146, firstVerseId: 22366, testament: "旧约" },
  { id: 31, name: "俄巴底亚书", nameTraditional: "俄巴底亞書", short: "俄", shortTraditional: "俄", abbr: "EBD", category: 5, categoryName: "小先知", chapters: 1, verses: 21, firstVerseId: 22512, testament: "旧约" },
  { id: 32, name: "约拿书", nameTraditional: "約拿書", short: "拿", shortTraditional: "拿", abbr: "YNS", category: 5, categoryName: "小先知", chapters: 4, verses: 48, firstVerseId: 22533, testament: "旧约" },
  { id: 33, name: "弥迦书", nameTraditional: "彌迦書", short: "弥", shortTraditional: "彌", abbr: "MJS", category: 5, categoryName: "小先知", chapters: 7, verses: 105, firstVerseId: 22581, testament: "旧约" },
  { id: 34, name: "那鸿书", nameTraditional: "那鴻書", short: "鸿", shortTraditional: "鴻", abbr: "NHS", category: 5, categoryName: "小先知", chapters: 3, verses: 47, firstVerseId: 22686, testament: "旧约" },
  { id: 35, name: "哈巴谷书", nameTraditional: "哈巴谷書", short: "哈", shortTraditional: "哈", abbr: "HBG", category: 5, categoryName: "小先知", chapters: 3, verses: 56, firstVerseId: 22733, testament: "旧约" },
  { id: 36, name: "西番雅书", nameTraditional: "西番雅書", short: "番", shortTraditional: "番", abbr: "XFY", category: 5, categoryName: "小先知", chapters: 3, verses: 53, firstVerseId: 22789, testament: "旧约" },
  { id: 37, name: "哈该书", nameTraditional: "哈該書", short: "该", shortTraditional: "該", abbr: "HGS", category: 5, categoryName: "小先知", chapters: 2, verses: 38, firstVerseId: 22842, testament: "旧约" },
  { id: 38, name: "撒迦利亚书", nameTraditional: "撒迦利亞書", short: "亚", shortTraditional: "亞", abbr: "SJL", category: 5, categoryName: "小先知", chapters: 14, verses: 211, firstVerseId: 22880, testament: "旧约" },
  { id: 39, name: "玛拉基书", nameTraditional: "瑪拉基書", short: "玛", shortTraditional: "瑪", abbr: "MLJ", category: 5, categoryName: "小先知", chapters: 4, verses: 55, firstVerseId: 23091, testament: "旧约" },
  { id: 40, name: "马太福音", nameTraditional: "馬太福音", short: "太", shortTraditional: "太", abbr: "MT", category: 6, categoryName: "福音书", chapters: 28, verses: 1071, firstVerseId: 23146, testament: "新约" },
  { id: 41, name: "马可福音", nameTraditional: "馬可福音", short: "可", shortTraditional: "可", abbr: "MK", category: 6, categoryName: "福音书", chapters: 16, verses: 678, firstVerseId: 24217, testament: "新约" },
  { id: 42, name: "路加福音", nameTraditional: "路加福音", short: "路", shortTraditional: "路", abbr: "LJ", category: 6, categoryName: "福音书", chapters: 24, verses: 1151, firstVerseId: 24895, testament: "新约" },
  { id: 43, name: "约翰福音", nameTraditional: "約翰福音", short: "约", shortTraditional: "約", abbr: "YH", category: 6, categoryName: "福音书", chapters: 21, verses: 878, firstVerseId: 26046, testament: "新约" },
  { id: 44, name: "使徒行传", nameTraditional: "使徒行傳", short: "徒", shortTraditional: "徒", abbr: "ST", category: 6, categoryName: "福音书", chapters: 28, verses: 1007, firstVerseId: 26924, testament: "新约" },
  { id: 45, name: "罗马书", nameTraditional: "羅馬書", short: "罗", shortTraditional: "羅", abbr: "LM", category: 7, categoryName: "书信", chapters: 16, verses: 433, firstVerseId: 27931, testament: "新约" },
  { id: 46, name: "哥林多前书", nameTraditional: "哥林多前書", short: "林前", shortTraditional: "林前", abbr: "GLQ", category: 7, categoryName: "书信", chapters: 16, verses: 437, firstVerseId: 28364, testament: "新约" },
  { id: 47, name: "哥林多后书", nameTraditional: "哥林多后書", short: "林后", shortTraditional: "林后", abbr: "GLH", category: 7, categoryName: "书信", chapters: 13, verses: 257, firstVerseId: 28801, testament: "新约" },
  { id: 48, name: "加拉太书", nameTraditional: "加拉太書", short: "加", shortTraditional: "加", abbr: "JLT", category: 7, categoryName: "书信", chapters: 6, verses: 149, firstVerseId: 29058, testament: "新约" },
  { id: 49, name: "以弗所书", nameTraditional: "以弗所書", short: "弗", shortTraditional: "弗", abbr: "YFS", category: 7, categoryName: "书信", chapters: 6, verses: 155, firstVerseId: 29207, testament: "新约" },
  { id: 50, name: "腓立比书", nameTraditional: "腓立比書", short: "腓", shortTraditional: "腓", abbr: "FLB", category: 7, categoryName: "书信", chapters: 4, verses: 104, firstVerseId: 29362, testament: "新约" },
  { id: 51, name: "歌罗西书", nameTraditional: "歌羅西書", short: "西", shortTraditional: "西", abbr: "GLX", category: 7, categoryName: "书信", chapters: 4, verses: 95, firstVerseId: 29466, testament: "新约" },
  { id: 52, name: "帖撒罗尼迦前书", nameTraditional: "帖撒羅尼迦前書", short: "帖前", shortTraditional: "帖前", abbr: "TSQ", category: 7, categoryName: "书信", chapters: 5, verses: 89, firstVerseId: 29561, testament: "新约" },
  { id: 53, name: "帖撒罗尼迦后书", nameTraditional: "帖撒羅尼迦后書", short: "帖后", shortTraditional: "帖后", abbr: "TSH", category: 7, categoryName: "书信", chapters: 3, verses: 47, firstVerseId: 29650, testament: "新约" },
  { id: 54, name: "提摩太前书", nameTraditional: "提摩太前書", short: "提前", shortTraditional: "提前", abbr: "TMQ", category: 7, categoryName: "书信", chapters: 6, verses: 113, firstVerseId: 29697, testament: "新约" },
  { id: 55, name: "提摩太后书", nameTraditional: "提摩太后書", short: "提后", shortTraditional: "提后", abbr: "TMH", category: 7, categoryName: "书信", chapters: 4, verses: 83, firstVerseId: 29810, testament: "新约" },
  { id: 56, name: "提多书", nameTraditional: "提多書", short: "多", shortTraditional: "多", abbr: "TDS", category: 7, categoryName: "书信", chapters: 3, verses: 46, firstVerseId: 29893, testament: "新约" },
  { id: 57, name: "腓利门书", nameTraditional: "腓利門書", short: "门", shortTraditional: "門", abbr: "FLM", category: 7, categoryName: "书信", chapters: 1, verses: 25, firstVerseId: 29939, testament: "新约" },
  { id: 58, name: "希伯来书", nameTraditional: "希伯來書", short: "来", shortTraditional: "來", abbr: "XBL", category: 8, categoryName: "启示录", chapters: 13, verses: 303, firstVerseId: 29964, testament: "新约" },
  { id: 59, name: "雅各书", nameTraditional: "雅各書", short: "雅", shortTraditional: "雅", abbr: "YGS", category: 8, categoryName: "启示录", chapters: 5, verses: 108, firstVerseId: 30267, testament: "新约" },
  { id: 60, name: "彼得前书", nameTraditional: "彼得前書", short: "彼前", shortTraditional: "彼前", abbr: "BDQ", category: 8, categoryName: "启示录", chapters: 5, verses: 105, firstVerseId: 30375, testament: "新约" },
  { id: 61, name: "彼得后书", nameTraditional: "彼得后書", short: "彼后", shortTraditional: "彼后", abbr: "BDH", category: 8, categoryName: "启示录", chapters: 3, verses: 61, firstVerseId: 30480, testament: "新约" },
  { id: 62, name: "约翰壹书", nameTraditional: "約翰壹書", short: "约壹", shortTraditional: "約壹", abbr: "YHY", category: 8, categoryName: "启示录", chapters: 5, verses: 105, firstVerseId: 30541, testament: "新约" },
  { id: 63, name: "约翰贰书", nameTraditional: "約翰貳書", short: "约贰", shortTraditional: "約貳", abbr: "YHE", category: 8, categoryName: "启示录", chapters: 1, verses: 13, firstVerseId: 30646, testament: "新约" },
  { id: 64, name: "约翰叁书", nameTraditional: "約翰叁書", short: "约叁", shortTraditional: "約叁", abbr: "YHS", category: 8, categoryName: "启示录", chapters: 1, verses: 15, firstVerseId: 30659, testament: "新约" },
  { id: 65, name: "犹大书", nameTraditional: "猶大書", short: "犹", shortTraditional: "猶", abbr: "YDS", category: 8, categoryName: "启示录", chapters: 1, verses: 25, firstVerseId: 30674, testament: "新约" },
  { id: 66, name: "启示录", nameTraditional: "啟示錄", short: "启", shortTraditional: "啟", abbr: "QSL", category: 8, categoryName: "启示录", chapters: 22, verses: 404, firstVerseId: 30699, testament: "新约" },
];

/** 在书卷上补出繁体分类名（categoryName 保持与原库一致的简体） */
const BOOKS = RAW_BOOKS.map((b) => ({
  ...b,
  categoryNameTraditional: getCategoryName(b.category, true),
}));

module.exports = {
  CATEGORIES,
  CATEGORIES_TRADITIONAL,
  BOOKS,
  getCategoryName,
};
