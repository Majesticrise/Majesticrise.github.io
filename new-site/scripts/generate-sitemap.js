#!/usr/bin/env node
/* ============================================================
 * generate-sitemap.js
 * 读取 assets/data/posts.json，生成 sitemap.xml
 *
 * 运行方式（通常由 GitHub Actions 自动执行）：
 *   cd new-site
 *   node scripts/generate-sitemap.js
 *   # 或显式指定站点地址
 *   SITE_URL=https://example.com node scripts/generate-sitemap.js
 *
 * 零依赖，只用 Node 内置模块。
 * ============================================================ */

'use strict';

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const POSTS_JSON = path.join(PROJECT_ROOT, 'assets', 'data', 'posts.json');
const FALLBACK_JSON = path.join(PROJECT_ROOT, 'assets', 'data', 'posts.fallback.json');
const OUTPUT_FILE = path.join(PROJECT_ROOT, 'sitemap.xml');

/* ---------- 站点地址 ---------- */
function resolveSiteUrl() {
  const fromArg = process.argv.find((arg) => arg.startsWith('--site-url='));
  const fromEnv = process.env.SITE_URL;
  const raw = (fromArg ? fromArg.split('=').slice(1).join('=') : '') || fromEnv || 'https://majesticrise.github.io';
  return raw.replace(/\/+$/, '');
}

const SITE_URL = resolveSiteUrl();

/* ---------- 静态页面清单 ---------- */
// 【在这里添加页面】新增静态 HTML 页面后，把路径加到这个数组里
const STATIC_PAGES = [
  { loc: 'index.html', changefreq: 'daily', priority: '1.0' },
  { loc: 'about.html', changefreq: 'monthly', priority: '0.6' },
  { loc: 'resources.html', changefreq: 'monthly', priority: '0.6' },
  { loc: 'tags.html', changefreq: 'weekly', priority: '0.5' }
];

function escapeXml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
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

function urlEntry({ loc, lastmod, changefreq, priority }) {
  return [
    '  <url>',
    `    <loc>${escapeXml(loc)}</loc>`,
    lastmod ? `    <lastmod>${escapeXml(lastmod)}</lastmod>` : '',
    changefreq ? `    <changefreq>${changefreq}</changefreq>` : '',
    priority ? `    <priority>${priority}</priority>` : '',
    '  </url>'
  ].filter(Boolean).join('\n');
}

function generateSitemap() {
  const posts = readPosts();
  const homepage = `${SITE_URL}/`;

  const staticEntries = STATIC_PAGES.map((page) =>
    urlEntry({
      loc: page.loc === 'index.html' ? homepage : `${SITE_URL}/${page.loc}`,
      changefreq: page.changefreq,
      priority: page.priority
    })
  );

  const postEntries = posts.map((post) =>
    urlEntry({
      // 详情页通过查询参数定位，sitemap 里照实写成带 ?post= 的形式
      loc: `${SITE_URL}/article.html?post=${encodeURIComponent(post.id)}`,
      lastmod: post.date,
      changefreq: 'monthly',
      priority: '0.8'
    })
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...staticEntries, ...postEntries].join('\n')}
</urlset>
`;

  fs.writeFileSync(OUTPUT_FILE, xml, 'utf8');
  console.log(`✓ 已生成 sitemap.xml（${staticEntries.length + postEntries.length} 条）`);
  console.log(`  SITE_URL = ${SITE_URL}`);
}

generateSitemap();
