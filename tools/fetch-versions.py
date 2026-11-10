#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
从信望愛（FHL）圣经 API 抓取中文译本，转换为本项目的译本数据文件。

用法:
    python tools/fetch-versions.py                     # 抓取全部可安装译本到 userData 目录
    python tools/fetch-versions.py --versions lcc,rcuv
    python tools/fetch-versions.py --out D:\\vers --versions ncv

说明:
    * 数据来源 https://bible.fhl.net/api/qb.php （信望愛資訊中心）
    * 除和合本（公有领域）外，其余译本均受版权保护，
      因此抓取结果默认写入应用的用户数据目录，不进 Git 仓库。
    * 抓取前请自行确认所选译本的授权条款。
"""
import argparse
import concurrent.futures
import html
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

API = "https://bible.fhl.net/api/qb.php"

# 版本 id -> (FHL version 参数, 显示名, 版权/来源说明)
VERSIONS = {
    "lcc":     ("lcc",     "吕振中译本",        "© 吕振中 / 环球天道圣经机构"),
    "rcuv":    ("rcuv",    "和合本修订版 2010",  "© 香港圣经公会"),
    "csb":     ("csb",     "中文标准译本",      "© 全球圣经促进会 GBI"),
    "tcv95":   ("tcv95",   "现代中文译本 1995",  "© 联合国圣经翻译中文委员会"),
    "tcv2019": ("tcv2019", "现代中文译本 2019",  "© 联合国圣经翻译中文委员会"),
    "ncv":     ("ncv",     "环球新译本",        "© 环球圣经公会"),
}

BOOK_COUNT = 66
MAX_CHAPTER = 200


def clean_text(raw):
    """去掉标题标签、换行标签与行内注释，压缩空白。"""
    if not raw:
        return ""
    t = re.sub(r"<h[1-6][^>]*>.*?</h[1-6]>", "", raw, flags=re.S)
    t = re.sub(r"<\s*br\s*/?\s*>", " ", t)
    t = re.sub(r"<[^>]+>", "", t)
    t = html.unescape(t)
    t = re.sub(r"\(\s*\[[^\]]*\][^()]*\)", "", t)
    t = re.sub(r"（\s*\[[^\]]*\][^）]*）", "", t)
    t = re.sub(r"\([^()]*「[^()]*\)", "", t)
    t = re.sub(r"（[^（）]*「[^（）]*）", "", t)
    t = re.sub(r"【[0-9A-Za-z]+】", "", t)
    t = t.replace("　", " ")
    t = re.sub(r"\s+", " ", t)
    # 汉字之间的空格去掉（中文排版不需要），英文单词之间的空格保留
    t = re.sub(r"(?<=[\u3000-\u303f\u4e00-\u9fff\uff00-\uffef]) +(?=[\u3000-\u303f\u4e00-\u9fff\uff00-\uffef])", "", t)
    return t.strip()


def fetch(url, timeout=30, retries=3):
    last = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "bible-projection/0.1 (local import)"})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.read().decode("utf-8", "replace")
        except Exception as exc:  # noqa: BLE001 - 网络错误统一重试
            last = exc
            time.sleep(0.8 * (attempt + 1))
    raise RuntimeError("request failed: %s (%s)" % (url, last))


def fetch_book(args):
    """抓取一卷经文的全部章节，返回 [(bookId, chapter, verse, text), ...]"""
    bid, fhl_version, delay = args
    rows = []
    for chap in range(1, MAX_CHAPTER + 1):
        url = "%s?bid=%d&chap=%d&version=%s&gb=1" % (API, bid, chap, fhl_version)
        try:
            payload = json.loads(fetch(url))
        except Exception as exc:  # noqa: BLE001
            print("  [warn] %s %d:%d %s" % (fhl_version, bid, chap, exc), flush=True)
            break
        if payload.get("status") != "success":
            break
        records = payload.get("record") or []
        if not records:
            break
        for rec in records:
            text = clean_text(rec.get("bible_text", ""))
            if text:
                rows.append([bid, chap, int(rec.get("sec")), text])
        time.sleep(delay)
    return bid, rows


def fetch_version(version_id, out_dir, workers=6, delay=0.12):
    fhl_version, name, copyright_note = VERSIONS[version_id]
    print("== 抓取 %s (%s) ..." % (name, fhl_version), flush=True)
    jobs = [(bid, fhl_version, delay) for bid in range(1, BOOK_COUNT + 1)]
    rows = []
    done = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        for bid, book_rows in pool.map(fetch_book, jobs):
            rows.extend(book_rows)
            done += 1
            if done % 10 == 0:
                print("   %d/66 卷，累计 %d 节" % (done, len(rows)), flush=True)
    rows.sort(key=lambda r: (r[0], r[1], r[2]))

    os.makedirs(out_dir, exist_ok=True)
    data_path = os.path.join(out_dir, "%s.json" % version_id)
    with open(data_path, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(rows, fh, ensure_ascii=False, separators=(",", ":"))

    meta = {
        "id": version_id,
        "name": name,
        "fhlVersion": fhl_version,
        "verses": len(rows),
        "copyright": copyright_note,
        "source": "信望愛資訊中心 FHL API (https://bible.fhl.net/api/qb.php)",
        "file": "%s.json" % version_id,
    }
    meta_path = os.path.join(out_dir, "%s.meta.json" % version_id)
    with open(meta_path, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(meta, fh, ensure_ascii=False, indent=2)
    print("   完成：%s（%d 节）-> %s" % (name, len(rows), data_path), flush=True)
    return meta


def default_out_dir():
    base = os.environ.get("APPDATA") or os.path.expanduser("~")
    return os.path.join(base, "BibleProjection", "versions")


def main():
    ap = argparse.ArgumentParser(description="抓取 FHL 中文译本到本地译本库")
    ap.add_argument("--versions", default="lcc,rcuv,csb,tcv95,tcv2019,ncv")
    ap.add_argument("--out", default=default_out_dir())
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--delay", type=float, default=0.12)
    args = ap.parse_args()

    ids = [v.strip() for v in args.versions.split(",") if v.strip()]
    unknown = [v for v in ids if v not in VERSIONS]
    if unknown:
        print("未知译本: %s" % ", ".join(unknown), file=sys.stderr)
        return 2
    print("输出目录: %s" % args.out, flush=True)
    for vid in ids:
        fetch_version(vid, args.out, workers=args.workers, delay=args.delay)
    print("全部完成。", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
