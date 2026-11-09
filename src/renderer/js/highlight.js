// js/highlight.js — 正文关键字高亮（结果片段与舞台正文共用）

/**
 * 把关键字在文本中的命中位置包成 <mark>，返回 DocumentFragment。
 * 关键字按长度从长到短匹配，避免短词先命中导致长词被切断。
 */
export function highlightFragment(text, keywords) {
  const frag = document.createDocumentFragment();
  const src = typeof text === 'string' ? text : '';
  const list = (Array.isArray(keywords) ? keywords : [])
    .map((k) => String(k || '').trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  if (!src || !list.length) {
    frag.appendChild(document.createTextNode(src));
    return frag;
  }

  const lower = src.toLowerCase();
  let cursor = 0;

  while (cursor < src.length) {
    let hitIndex = -1;
    let hitLength = 0;

    for (const key of list) {
      const needle = key.toLowerCase();
      const index = lower.indexOf(needle, cursor);
      if (index < 0) continue;
      if (hitIndex < 0 || index < hitIndex || (index === hitIndex && needle.length > hitLength)) {
        hitIndex = index;
        hitLength = needle.length;
      }
    }

    if (hitIndex < 0) break;

    if (hitIndex > cursor) {
      frag.appendChild(document.createTextNode(src.slice(cursor, hitIndex)));
    }
    const mark = document.createElement('mark');
    mark.className = 'hl';
    mark.textContent = src.slice(hitIndex, hitIndex + hitLength);
    frag.appendChild(mark);
    cursor = hitIndex + hitLength;
  }

  if (cursor < src.length) {
    frag.appendChild(document.createTextNode(src.slice(cursor)));
  }
  return frag;
}

/** 用高亮片段填充节点。 */
export function renderHighlighted(node, text, keywords) {
  if (!node) return;
  node.textContent = '';
  node.appendChild(highlightFragment(text, keywords));
}
