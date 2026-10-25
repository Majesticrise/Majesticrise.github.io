/* ============================================================
 * search.js —— 首页内联搜索增强（可选独立模块）
 * 目前首页搜索已在 main.js 中实现；如果你想把搜索框放到导航栏并
 * 在任意页面使用，可以引入本模块（例如在 index.html 里改为
 * <script type="module" src="assets/js/search.js"></script> 之后调用
 * initGlobalSearch('#global-search')）。
 * ============================================================ */

import { loadPosts, siteUrl, escapeHtml } from './components.js';

/**
 * 在指定容器挂载一个全局搜索框（输入即出结果下拉）。
 * @param {string} selector 容器选择器
 */
export function initGlobalSearch(selector) {
  const mount = document.querySelector(selector);
  if (!mount) return;

  mount.innerHTML = `
    <div class="global-search">
      <input type="search" class="global-search__input" placeholder="搜索文章 / 标签…" aria-label="站内搜索">
      <ul class="global-search__results" hidden></ul>
    </div>
  `;

  const input = mount.querySelector('.global-search__input');
  const results = mount.querySelector('.global-search__results');
  let posts = [];

  loadPosts().then((list) => { posts = list; });

  let timer = null;
  // 回车：跳到首页全文搜索结果
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      const kw = input.value.trim();
      if (kw) {
        window.location.href = `${new URL('index.html', document.baseURI).href}?q=${encodeURIComponent(kw)}`;
      }
    } else if (event.key === 'Escape') {
      results.hidden = true;
    }
  });

  // 点击页面其他位置收起下拉
  document.addEventListener('click', (event) => {
    if (!mount.contains(event.target)) results.hidden = true;
  });

  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const kw = input.value.trim().toLowerCase();
      if (!kw) {
        results.hidden = true;
        results.innerHTML = '';
        return;
      }

      const hits = posts.filter((post) => {
        const hay = [post.title, post.summary, post.tags.join(' ')].join(' ').toLowerCase();
        return hay.includes(kw);
      }).slice(0, 8);

      results.innerHTML = hits.length
        ? hits.map((post) => `
            <li>
              <a href="${siteUrl('article.html')}?post=${encodeURIComponent(post.id)}">
                <span class="global-search__title">${escapeHtml(post.title)}</span>
                <span class="global-search__date">${escapeHtml(post.date)}</span>
              </a>
            </li>`).join('')
        : '<li class="global-search__empty">没有匹配结果</li>';

      results.hidden = false;
    }, 150);
  });
}
