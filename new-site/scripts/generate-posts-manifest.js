#!/usr/bin/env node
/* ============================================================
 * generate-posts-manifest.js
 * 扫描 posts/*.md 的 Front Matter，生成 assets/data/posts.json
 *
 * 运行方式（仅需要在 GitHub Actions 或有 Node 的机器上）：
 *   cd new-site
 *   node scripts/generate-posts-manifest.js
 *
 * 本地没有 Node 也完全不影响预览：
 * 前端会依次尝试 posts.json → posts.fallback.json → 内置清单。
 *
 * 用到的都是 Node 内置模块，无需 npm install。
 * ============================================================ */

'use strict';

const fs = require('fs');
const path = require('path');

/* ---------- 路径配置（相对本脚本推导，不写死 new-site） ---------- */
const PROJECT_ROOT = path.resolve(__dirname, '..');
const POSTS_DIR = path.join(PROJECT_ROOT, 'posts');
const OUTPUT_FILE = path.join(PROJECT_ROOT, 'assets', 'data', 'posts.json');

/* ---------- Front Matter 解析 ---------- */
/**
 * 解析 Markdown 开头的 YAML Front Matter。
 * 只支持本项目用到的子集：字符串、日期、数字、布尔、内联数组、短横线数组。
 * 不引入 js-yaml，保证脚本零依赖。
 *
 * @param {string} raw 文件全文
 * @returns {{ data: Record<string, any>, body: string }}
 */
function parseFrontMatter(raw) {
  const text = raw.replace(/^\uFEFF/, ''); // 去掉 BOM

  const match = text.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/);
  if (!match) {
    return { data: {}, body: text };
  }

  const data = {};
  const lines = match[1].split(/\r?\n/);

  let currentListKey = null;

  for (const line of lines) {
    // 跳过空行与注释
    if (!line.trim() || /^\s*#/.test(line)) continue;

    // 形如 "  - item" 的数组项
    const listItem = line.match(/^\s*-\s+(.*)$/);
    if (listItem && currentListKey) {
      data[currentListKey].push(stripQuotes(listItem[1].trim()));
      continue;
    }

    // 形如 "key: value"
    const kv = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!kv) continue;

    const key = kv[1];
    const rawValue = kv[2].trim();

    // key:（空值）→ 可能是下面的短横线数组
    if (rawValue === '') {
      data[key] = [];
      currentListKey = key;
      continue;
    }

    currentListKey = null;

    // 内联数组：["a", "b"]
    if (/^\[.*\]$/.test(rawValue)) {
      data[key] = rawValue
        .slice(1, -1)
        .split(',')
        .map((item) => stripQuotes(item.trim()))
        .filter((item) => item !== '');
      continue;
    }

    data[key] = parseScalar(rawValue);
  }

  return { data, body: text.slice(match[0].length) };
}

function stripQuotes(value) {
  return String(value).replace(/^['"]|['"]$/g, '');
}

function parseScalar(value) {
  const unquoted = stripQuotes(value);

  if (/^(true|false)$/i.test(unquoted)) return unquoted.toLowerCase() === 'true';
  if (/^-?\d+(\.\d+)?$/.test(unquoted)) return Number(unquoted);

  // 日期统一成 YYYY-MM-DD 字符串
  const dateMatch = unquoted.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (dateMatch) {
    const [, y, m, d] = dateMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  return unquoted;
}

/* ---------- 从正文提取摘要（Front Matter 未提供 summary 时兜底） ---------- */
function deriveSummary(body, maxLength = 80) {
  const plain = body
    .replace(/```[\s\S]*?```/g, ' ')        // 去掉代码块
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')  // 去掉图片
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // 保留链接文字
    .replace(/^#{1,6}\s+/gm, '')            // 去掉标题标记
    .replace(/[>*_`~-]/g, '')               // 去掉常见 Markdown 符号
    .replace(/\s+/g, ' ')
    .trim();

  if (plain.length <= maxLength) return plain;
  return `${plain.slice(0, maxLength)}…`;
}

/* ---------- 从文件名推断日期（Front Matter 未提供 date 时兜底） ---------- */
function deriveDateFromFilename(filename) {
  const m = filename.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
}

/* ---------- 主流程 ---------- */
function generateManifest() {
  if (!fs.existsSync(POSTS_DIR)) {
    console.error(`✗ 找不到 posts 目录：${POSTS_DIR}`);
    process.exitCode = 1;
    return;
  }

  const files = fs
    .readdirSync(POSTS_DIR)
    .filter((name) => name.toLowerCase().endsWith('.md'))
    .sort();

  const posts = files.map((filename) => {
    const fullPath = path.join(POSTS_DIR, filename);
    const raw = fs.readFileSync(fullPath, 'utf8');
    const { data, body } = parseFrontMatter(raw);

    const id = filename.replace(/\.md$/i, '');

    return {
      id,
      title: String(data.title || id),
      date: String(data.date || deriveDateFromFilename(filename)),
      tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
      summary: String(data.summary || deriveSummary(body)),
      // 前端会再拼站点根，这里只记录相对路径
      url: `posts/${filename}`
    };
  });

  // 按日期倒序（同日期按 id 倒序，保证顺序稳定）
  posts.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.id < b.id ? 1 : -1;
  });

  // 确保输出目录存在
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(posts, null, 2)}\n`, 'utf8');

  console.log(`✓ 已生成 ${path.relative(PROJECT_ROOT, OUTPUT_FILE)}`);
  console.log(`  共 ${posts.length} 篇文章`);
  posts.slice(0, 5).forEach((post) => {
    console.log(`  - ${post.date}  ${post.title}  [${post.tags.join(', ')}]`);
  });
  if (posts.length > 5) console.log(`  ... 以及另外 ${posts.length - 5} 篇`);
}

generateManifest();
