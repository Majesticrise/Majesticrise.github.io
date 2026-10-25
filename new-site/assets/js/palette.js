/* ============================================================
 * palette.js —— Ctrl+K 命令面板
 * 功能：搜文章、跳页面、切换主题，全键盘操作（↑↓ 选择、Enter 执行、Esc 关闭）
 * 由 components.js 在 Ctrl/Cmd+K 时按需加载本模块。
 * ============================================================ */

import { loadPosts, siteUrl } from './components.js';

let overlay = null;      // 遮罩 + 面板（懒建一次）
let inputEl = null;
let listEl = null;
let items = [];          // 当前过滤后的命令列表
let activeIndex = 0;

function buildItems(keyword) {
  const kw = (keyword || '').trim().toLowerCase();
  const pages = [
    { label: '首页', hint: '页面', run: () => { window.location.href = siteUrl('index.html'); } },
    { label: '归档', hint: '页面', run: () => { window.location.href = siteUrl('archive.html'); } },
    { label: '标签', hint: '页面', run: () => { window.location.href = siteUrl('tags.html'); } },
    { label: '资源取件', hint: '页面', run: () => { window.location.href = siteUrl('resources.html'); } },
    { label: '关于我', hint: '页面', run: () => { window.location.href = siteUrl('about.html'); } },
    {
      label: '切换深浅色主题', hint: '动作',
      run: () => { document.querySelector('.theme-toggle')?.click(); }
    }
  ];

  const pageHits = pages.filter((p) => !kw || p.label.toLowerCase().includes(kw));

  const postHits = (window.__palettePosts || [])
    .filter((p) => !kw || (p.title + ' ' + (p.tags || []).join(' ')).toLowerCase().includes(kw))
    .slice(0, 10)
    .map((p) => ({
      label: p.title,
      hint: '文章 · ' + p.date,
      run: () => { window.location.href = `${siteUrl('article.html')}?post=${encodeURIComponent(p.id)}`; }
    }));

  return [...pageHits, ...postHits];
}

function renderList() {
  if (!listEl) return;
  listEl.innerHTML = items
    .map((item, i) => `
      <li class="palette-item${i === activeIndex ? ' is-active' : ''}" data-index="${i}">
        <span class="palette-item__label">${item.label}</span>
        <span class="palette-item__hint">${item.hint}</span>
      </li>`)
    .join('');

  listEl.querySelectorAll('.palette-item').forEach((li) => {
    li.addEventListener('click', () => runItem(Number(li.dataset.index)));
    li.addEventListener('mousemove', () => setActive(Number(li.dataset.index)));
  });

  const active = listEl.querySelector('.palette-item.is-active');
  active?.scrollIntoView({ block: 'nearest' });
}

function setActive(index) {
  if (!items.length) return;
  activeIndex = Math.max(0, Math.min(index, items.length - 1));
  listEl.querySelectorAll('.palette-item').forEach((li, i) => {
    li.classList.toggle('is-active', i === activeIndex);
  });
  listEl.querySelector('.palette-item.is-active')?.scrollIntoView({ block: 'nearest' });
}

function runItem(index) {
  const item = items[index];
  close();
  item?.run();
}

function open() {
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'palette-overlay';
    overlay.innerHTML = `
      <div class="palette-panel" role="dialog" aria-modal="true" aria-label="命令面板">
        <input class="palette-input" type="text" placeholder="搜索文章、跳转页面、切换主题…"
               aria-label="命令面板搜索">
        <ul class="palette-results"></ul>
        <div class="palette-foot">↑↓ 选择 · Enter 执行 · Esc 关闭</div>
      </div>`;
    document.body.appendChild(overlay);

    inputEl = overlay.querySelector('.palette-input');
    listEl = overlay.querySelector('.palette-results');

    inputEl.addEventListener('input', () => {
      items = buildItems(inputEl.value);
      activeIndex = 0;
      renderList();
    });
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(activeIndex + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(activeIndex - 1); }
      else if (e.key === 'Enter') { e.preventDefault(); runItem(activeIndex); }
      else if (e.key === 'Escape') { e.preventDefault(); close(); }
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
  }

  // 每次打开重建文章命令（loadPosts 有缓存，代价极小）
  loadPosts().then((posts) => { window.__palettePosts = posts; });
  items = [];
  activeIndex = 0;
  overlay.classList.add('is-open');
  inputEl.value = '';
  items = buildItems('');
  renderList();
  inputEl.focus();
}

function close() {
  overlay?.classList.remove('is-open');
}

export function togglePalette() {
  if (overlay && overlay.classList.contains('is-open')) close();
  else open();
}
