#!/usr/bin/env node
/* ============================================================
 * generate-feed.js
 * 读取 assets/data/posts.json，生成 feed.xml（RSS 2.0）
 *
 * 运行方式（通常由 GitHub Actions 自动执行）：
 *   cd new-site
 *   node scripts/generate-feed.js
 *
 * 站点地址来源优先级：
 *   1) 环境变量 SITE_URL（推荐在 workflow 里传）
 *   2) 参数 --site-url=https://example.com
 *   3) 默认值 https://majesticrise.github.io
 *
 * 零依赖，只用 Node 内置模块。
 * ============================================================ */

'use strict';

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const POSTS_JSON = path.join(PROJECT_ROOT, 'assets', 'data', 'posts.json');
const FALLBACK_JSON = path.join(PROJECT_ROOT, 'assets', 'data', 'posts.fallback.json');
const OUTPUT_FILE = path.join(PROJECT_ROOT, 'feed.xml');

const SITE_TITLE = 'LEA聊天记录大赏';
const SITE_DESCRIPTION = '更新订阅';
const SITE_AUTHOR = 'Majesticrise';
const SITE_LANGUAGE = 'zh-CN';

/* ---------- 站点地址 ---------- */
function resolveSiteUrl() {
  const fromArg = process.argv.find((arg) => arg.startsWith('--site-url='));
  const fromEnv = process.env.SITE_URL;
  const raw = (fromArg ? fromArg.split('=').slice(1).join('=') : '') || fromEnv || 'https://majesticrise.github.io';
  return raw.replace(/\/+$/, '');
}

const SITE_URL = resolveSiteUrl();

/* ---------- 工具 ---------- */
function escapeXml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** 把 YYYY-MM-DD 转成 RFC 822 时间（RSS 需要） */
function toRfc822(dateStr) {
  const safe = /^\d{4}-\d{2}-\d{2}$/.test(String(dateStr)) ? dateStr : '1970-01-01';
  const date = new Date(`${safe}T00:00:00+08:00`);
  if (Number.isNaN(date.getTime())) return new Date(0).toUTCString();
  return date.toUTCString();
}

function readPosts() {
  const source = fs.existsSync(POSTS_JSON) ? POSTS_JSON : FALLBACK_JSON;
  if (!fs.existsSync(source)) {
    console.error('✗ 找不到 posts.json，也没有 fallback 文件。请先运行 generate-posts-manifest.js');
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(source, 'utf8'));
  const list = Array.isArray(data) ? data : (Array.isArray(data.posts) ? data.posts : []);
  return list.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/* ---------- 生成 ---------- */
function generateFeed() {
  const posts = readPosts();
  const lastBuildDate = posts.length ? toRfc822(posts[0].date) : new Date().toUTCString();

  const items = posts.map((post) => {
    const link = `${SITE_URL}/article.html?post=${encodeURIComponent(post.id)}`;
    const categories = (post.tags || [])
      .map((tag) => `      <category>${escapeXml(tag)}</category>`)
      .join('\n');

    return [
      '    <item>',
      `      <title>${escapeXml(post.title)}</title>`,
      `      <link>${escapeXml(link)}</link>`,
      `      <guid isPermaLink="false">${escapeXml(post.id)}</guid>`,
      `      <pubDate>${toRfc822(post.date)}</pubDate>`,
      `      <description>${escapeXml(post.summary || '')}</description>`,
      categories,
      '    </item>'
    ].filter(Boolean).join('\n');
  }).join('\n\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE_TITLE)}</title>
    <link>${escapeXml(`${SITE_URL}/`)}</link>
    <description>${escapeXml(SITE_DESCRIPTION)}</description>
    <language>${SITE_LANGUAGE}</language>
    <managingEditor>${escapeXml(SITE_AUTHOR)}</managingEditor>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${escapeXml(`${SITE_URL}/feed.xml`)}" rel="self" type="application/rss+xml" />

${items}

  </channel>
</rss>
`;

  fs.writeFileSync(OUTPUT_FILE, xml, 'utf8');
  console.log(`✓ 已生成 feed.xml（${posts.length} 条）`);
  console.log(`  SITE_URL = ${SITE_URL}`);
}

generateFeed();
