/* ============================================================
 * main.js —— 首页逻辑：文章列表、前端分页 + "加载更多"、站内搜索
 * 对应页面：index.html
 * ============================================================ */

import {
  initLayout, loadPosts, postCardHtml, emptyStateHtml, escapeHtml, config
} from './components.js';

initLayout();

const state = {
  all: [],        // 全部文章（已按日期倒序）
  filtered: [],   // 搜索过滤后的文章
  shown: 0,       // 已渲染数量
  keyword: ''
};

const listEl = document.getElementById('post-list');
const moreBtn = document.getElementById('load-more');
const searchInput = document.getElementById('search-input');
const resultHint = document.getElementById('search-hint');
const statusEl = document.getElementById('list-status');

const PAGE_SIZE = Number(config.pageSize) > 0 ? Number(config.pageSize) : 5;

/* ---------- 渲染 ---------- */
function renderList(reset = false) {
  if (!listEl) return;

  if (reset) {
    listEl.innerHTML = '';
    state.shown = 0;
  }

  const next = state.filtered.slice(state.shown, state.shown + PAGE_SIZE);

  if (state.filtered.length === 0) {
    listEl.innerHTML = emptyStateHtml('没有找到匹配的文章，换个关键词试试？');
  } else if (next.length === 0 && state.shown === 0) {
    listEl.innerHTML = emptyStateHtml('还没有文章，去 posts/ 目录新建一个 Markdown 文件吧。');
  } else {
    listEl.insertAdjacentHTML('beforeend', next.map(postCardHtml).join(''));
  }

  state.shown += next.length;

  // 分页按钮状态
  if (moreBtn) {
    const remain = state.filtered.length - state.shown;
    if (remain > 0) {
      moreBtn.hidden = false;
      moreBtn.textContent = `加载更多（还有 ${remain} 篇）`;
    } else {
      moreBtn.hidden = true;
    }
  }

  // 状态文案
  if (statusEl) {
    if (state.filtered.length === 0) {
      statusEl.textContent = '';
    } else {
      statusEl.textContent = `共 ${state.filtered.length} 篇，已显示 ${Math.min(state.shown, state.filtered.length)} 篇`;
    }
  }
}

/* ---------- 搜索：标题 / 摘要 / 标签 ---------- */
function applyFilter(keyword) {
  state.keyword = keyword.trim();
  const kw = state.keyword.toLowerCase();

  if (!kw) {
    state.filtered = state.all.slice();
    if (resultHint) resultHint.textContent = '';
  } else {
    state.filtered = state.all.filter((post) => {
      const haystack = [post.title, post.summary, post.tags.join(' ')].join(' ').toLowerCase();
      return haystack.includes(kw);
    });
    if (resultHint) {
      resultHint.innerHTML = `关键词 <strong>${escapeHtml(state.keyword)}</strong> · 命中 ${state.filtered.length} 篇`;
    }
  }

  renderList(true);
}

/* ---------- 事件 ---------- */
moreBtn?.addEventListener('click', () => renderList(false));

// 输入防抖，避免每个按键都重排 DOM
let timer = null;
searchInput?.addEventListener('input', (event) => {
  const value = event.target.value;
  clearTimeout(timer);
  timer = setTimeout(() => applyFilter(value), 180);
});

// 支持从 tags.html 跳到 index.html?q=标签
const params = new URLSearchParams(window.location.search);
const initialQuery = params.get('q') || '';
if (initialQuery && searchInput) searchInput.value = initialQuery;
// 支持 ?tag=标签 直接过滤
const initialTag = params.get('tag') || '';

/* ---------- 启动 ---------- */
(async function boot() {
  state.all = await loadPosts();

  if (initialTag) {
    state.all = state.all.filter((p) =>
      p.tags.some((t) => String(t).toLowerCase() === initialTag.toLowerCase())
    );
    if (searchInput) searchInput.value = initialTag;
    if (resultHint) {
      resultHint.innerHTML = `标签 <strong>${escapeHtml(initialTag)}</strong> · 共 ${state.all.length} 篇`;
    }
  }

  state.filtered = state.all.slice();
  renderList(true);
})();
