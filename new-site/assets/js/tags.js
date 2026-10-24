/* ============================================================
 * tags.js —— 标签页：聚合标签 + 点击筛选文章
 * 对应页面：tags.html
 * ============================================================ */

import {
  initLayout, loadPosts, aggregateTags, postCardHtml, emptyStateHtml, escapeHtml
} from './components.js';

initLayout();

const cloudEl = document.getElementById('tag-cloud');
const resultEl = document.getElementById('tag-results');
const headingEl = document.getElementById('tag-heading');
const clearBtn = document.getElementById('tag-clear');

let allPosts = [];
let activeTag = '';

/* ---------- 渲染标签云 ---------- */
function renderCloud(tags) {
  if (!cloudEl) return;

  if (tags.length === 0) {
    cloudEl.innerHTML = emptyStateHtml('还没有任何标签。');
    return;
  }

  cloudEl.innerHTML = tags.map(({ name, count }) => {
    const isActive = name === activeTag;
    return `<button class="tag tag--button${isActive ? ' is-active' : ''}"
              type="button"
              data-tag="${escapeHtml(name)}"
              aria-pressed="${isActive}">
              ${escapeHtml(name)} <span class="tag__count">${count}</span>
            </button>`;
  }).join('');

  cloudEl.querySelectorAll('[data-tag]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tag = btn.dataset.tag;
      // 点击同一个标签则取消筛选
      selectTag(tag === activeTag ? '' : tag);
    });
  });
}

/* ---------- 渲染筛选结果 ---------- */
function renderResults() {
  if (!resultEl) return;

  if (!activeTag) {
    resultEl.innerHTML = allPosts.map(postCardHtml).join('');
    if (headingEl) headingEl.textContent = '全部文章';
    if (clearBtn) clearBtn.hidden = true;
    return;
  }

  const matched = allPosts.filter((p) =>
    p.tags.some((t) => String(t).toLowerCase() === activeTag.toLowerCase())
  );

  if (headingEl) {
    headingEl.innerHTML = `标签「${escapeHtml(activeTag)}」· ${matched.length} 篇`;
  }
  if (clearBtn) clearBtn.hidden = false;

  resultEl.innerHTML = matched.length
    ? matched.map(postCardHtml).join('')
    : emptyStateHtml(`标签「${activeTag}」下还没有文章。`);
}

/* ---------- 切换标签 ---------- */
function selectTag(tag) {
  activeTag = tag || '';
  renderCloud(aggregateTags(allPosts));
  renderResults();

  // 同步 URL hash，便于分享 / 刷新后保持筛选
  if (activeTag) {
    history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${encodeURIComponent(activeTag)}`);
  } else {
    history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  }
}

/* ---------- 事件 ---------- */
clearBtn?.addEventListener('click', () => selectTag(''));

window.addEventListener('hashchange', () => {
  const tag = decodeURIComponent(window.location.hash.replace(/^#/, ''));
  if (tag !== activeTag) selectTag(tag);
});

/* ---------- 启动 ---------- */
(async function boot() {
  allPosts = await loadPosts();

  // 支持 tags.html#标签 直达
  const initial = decodeURIComponent(window.location.hash.replace(/^#/, ''));
  activeTag = initial || '';

  renderCloud(aggregateTags(allPosts));
  renderResults();
})();
