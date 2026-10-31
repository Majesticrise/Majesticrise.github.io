#!/usr/bin/env node
/* ============================================================
 * fetch-cyber-daily.js
 * 抓取"网安日报速递"当日页面（AI城 · 网络安全），
 * 解析出新闻标题列表，生成 assets/data/cyber-daily.json。
 *
 * 运行方式：GitHub Actions 部署时执行（零依赖，仅内置模块）：
 *   node scripts/fetch-cyber-daily.js
 *
 * 容错策略：
 *   - 当天页面不存在时依次回退尝试前 1~2 天
 *   - 网络失败时若本地已有旧数据则保留（不覆盖），否则写空结构
 *   - 任何情况下都正常退出（exit 0），不阻断部署
 * ============================================================ */

'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const OUTPUT_FILE = path.join(PROJECT_ROOT, 'assets', 'data', 'cyber-daily.json');

const SITE = 'https://unclecheng-li.github.io/cybersecurity-daily/';

function fetchText(url, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error('HTTP ' + res.statusCode));
        return;
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error('timeout')));
  });
}

/** 当天日期（北京时间）；抓不到时依次回退前 1~2 天 */
function candidateDays() {
  const days = [];
  for (let off = 0; off <= 2; off++) {
    const d = new Date(Date.now() - off * 86400000 + 8 * 3600000); // +8h 折算北京日期
    days.push(d.toISOString().slice(0, 10));
  }
  return [...new Set(days)];
}

/** 解析日报页面：h2 为头条、h3 为各条新闻，取小节第一个外链作为来源 */
function parseDaily(html, pageUrl) {
  const items = [];
  const re = /<h([23])[^>]*>([\s\S]*?)<\/h>([\s\S]*?)(?=<h[23][^>]*>|$)/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const title = m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (!title || title === '速览') continue; // "速览"是页面目录锚点，不是新闻
    const linkMatch = m[3].match(/href="(https?:\/\/[^"]+)"[^>]*>/);
    items.push({ title, url: linkMatch ? linkMatch[1] : pageUrl });
    if (items.length >= 8) break;
  }
  return items;
}

async function main() {
  const existing = fs.existsSync(OUTPUT_FILE)
    ? JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'))
    : null;

  for (const day of candidateDays()) {
    const pageUrl = `${SITE}/daily/${day}.html`;
    try {
      const html = await fetchText(pageUrl);
      const items = parseDaily(html, pageUrl);
      if (!items.length) throw new Error('未解析到条目');

      const data = {
        date: day,
        source: pageUrl,
        site: SITE,
        fetchedAt: new Date().toISOString(),
        items
      };
      fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');
      console.log(`✓ 网安日报 ${day}：${items.length} 条已写入 cyber-daily.json`);
      items.forEach((it) => console.log('  - ' + it.title.slice(0, 40)));
      return;
    } catch (err) {
      console.log(`- ${pageUrl} 不可用（${err.message}），尝试前一天…`);
    }
  }

  // 全部失败：保留旧数据（24h 内视为仍新鲜），否则写空结构让前端隐藏
  if (existing && existing.items && existing.items.length) {
    console.log('✗ 抓取失败，保留既有 cyber-daily.json（' + existing.date + '）');
    return;
  }
  const empty = {
    date: '', source: SITE, site: SITE,
    fetchedAt: new Date().toISOString(), items: []
  };
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(empty, null, 2) + '\n', 'utf8');
  console.log('✗ 抓取失败且无旧数据，已写入空结构（前端将隐藏该板块）');
}

main().catch((err) => {
  console.error('✗ 意外错误：', err.message);
  process.exit(0); // 不阻断部署
});
