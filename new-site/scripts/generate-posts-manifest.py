#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""generate-posts-manifest.py —— 扫描 posts/*.md，生成文章清单（Python 版）

【什么时候用】本地没有 Node 时，改了 posts/ 之后想立刻更新清单：
    cd new-site
    python scripts/generate-posts-manifest.py

会同时重新生成两份文件（内容一致）：
  - assets/data/posts.json           线上清单（CI 里由 generate-posts-manifest.js 重新生成）
  - assets/data/posts.fallback.json  本地预览回退清单

只用到标准库，无需安装任何包。
"""

import json
import os
import re

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
POSTS_DIR = os.path.join(PROJECT_ROOT, "posts")
DATA_DIR = os.path.join(PROJECT_ROOT, "assets", "data")


def parse_front_matter(raw):
    """解析 Front Matter，支持行内数组 tags: ["a", "b"] 与短横线数组"""
    text = raw.lstrip("\ufeff")
    m = re.match(r"^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)", text)
    if not m:
        return {}, text
    data = {}
    current_list_key = None
    for line in m.group(1).splitlines():
        if not line.strip() or line.strip().startswith("#"):
            continue
        item = re.match(r"^\s*-\s+(.*)$", line)
        if item and current_list_key:
            data[current_list_key].append(strip_quotes(item.group(1)))
            continue
        kv = re.match(r"^([A-Za-z0-9_-]+)\s*:\s*(.*)$", line)
        if not kv:
            continue
        key, raw_value = kv.group(1), kv.group(2).strip()
        if raw_value == "":
            data[key] = []
            current_list_key = key
            continue
        current_list_key = None
        if raw_value.startswith("[") and raw_value.endswith("]"):
            data[key] = [strip_quotes(v.strip()) for v in raw_value[1:-1].split(",") if v.strip()]
        else:
            data[key] = strip_quotes(raw_value)
    return data, text[m.end():]


def strip_quotes(value):
    return str(value).strip().strip("'\"")


def derive_summary(body, limit=80):
    """Front Matter 没有 summary 时，从正文提取一段纯文本"""
    plain = re.sub(r"```[\s\S]*?```", " ", body)
    plain = re.sub(r"!\[[^\]]*\]\([^)]*\)", " ", plain)
    plain = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", plain)
    plain = re.sub(r"^#{1,6}\s+", "", plain, flags=re.M)
    plain = re.sub(r"[>*_`~-]", "", plain)
    plain = re.sub(r"\s+", " ", plain).strip()
    return plain[:limit] + ("…" if len(plain) > limit else "")


def derive_date(filename):
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", filename)
    return m.group(0) if m else ""


def main():
    if not os.path.isdir(POSTS_DIR):
        print(f"✗ 找不到 posts 目录：{POSTS_DIR}")
        raise SystemExit(1)

    posts = []
    for name in sorted(os.listdir(POSTS_DIR)):
        if not name.lower().endswith(".md"):
            continue
        raw = open(os.path.join(POSTS_DIR, name), encoding="utf-8").read()
        fm, body = parse_front_matter(raw)
        posts.append({
            "id": name[:-3],
            "title": str(fm.get("title") or name[:-3]),
            "date": str(fm.get("date") or derive_date(name))[:10],
            "tags": [str(t) for t in fm.get("tags", [])] if isinstance(fm.get("tags"), list) else [],
            "summary": str(fm.get("summary") or derive_summary(body)),
            "url": f"posts/{name}",
        })

    # 按日期倒序（同日期按 id 倒序，保证顺序稳定）
    posts.sort(key=lambda p: (p["date"], p["id"]), reverse=True)

    os.makedirs(DATA_DIR, exist_ok=True)
    for fname in ("posts.json", "posts.fallback.json"):
        with open(os.path.join(DATA_DIR, fname), "w", encoding="utf-8", newline="\n") as f:
            json.dump(posts, f, ensure_ascii=False, indent=2)
            f.write("\n")

    print(f"✓ 已生成 assets/data/posts.json 与 posts.fallback.json（共 {len(posts)} 篇）")
    for p in posts[:5]:
        print(f"  - {p['date']}  {p['title']}  [{', '.join(p['tags'])}]")
    if len(posts) > 5:
        print(f"  ... 以及另外 {len(posts) - 5} 篇")


if __name__ == "__main__":
    main()
