/* ============================================================
 * archive.js —— 归档页：全部文章按年份分组
 * 对应页面：archive.html
 * ============================================================ */

import { initLayout, loadPosts, escapeHtml, siteUrl, tagAccentClass } from './components.js';

initLayout();

const mount = document.getElementById('archive-list');

function render(posts) {
  if (!mount) return;

  if (!posts.length) {
    mount.innerHTML = '<p class="empty-state">还没有文章。</p>';
    return;
  }

  // 按年份分组（posts 已按日期倒序，组内天然有序）
  const byYear = new Map();
  posts.forEach((post) => {
    const year = (post.date || '????').slice(0, 4);
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year).push(post);
  });

  let html = '';
  for (const year of [...byYear.keys()].sort((a, b) => (a < b ? 1 : -1))) {
    const items = byYear.get(year);
    html += `
      <section class="archive-year">
        <h2 class="archive-year__title">${escapeHtml(year)} <span class="archive-year__count">${items.length} 篇</span></h2>
        <ul class="archive-list">`;

    for (const post of items) {
      const href = `${siteUrl('article.html')}?post=${encodeURIComponent(post.id)}`;
      const tags = post.tags
        .map((t) => `<a class="tag ${tagAccentClass(t)}" href="${siteUrl('tags.html')}#${encodeURIComponent(t)}">${escapeHtml(t)}</a>`)
        .join('');
      html += `
          <li class="archive-item">
            <time class="archive-item__date" datetime="${escapeHtml(post.date)}">${escapeHtml(post.date.slice(5))}</time>
            <a class="archive-item__title" href="${href}">${escapeHtml(post.title)}</a>
            ${tags ? `<span class="archive-item__tags">${tags}</span>` : ''}
          </li>`;
    }

    html += '</ul></section>';
  }

  mount.innerHTML = html;
}

(async () => {
  render(await loadPosts());
})();
