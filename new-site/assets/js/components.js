/* ============================================================
 * components.js —— 共享组件与工具函数
 * 职责：站点根路径解析、导航栏/页脚注入、文章清单加载（含回退）、
 *       文章卡片渲染、标签聚合、giscus 评论加载。
 * 所有页面都引用它，所以改导航/页脚只需要改这里或 site-config.js。
 * ============================================================ */

/* ---------- 1. 路径解析：不写死 new-site，也不写死仓库名 ---------- */
// 本文件位于 <站点根>/assets/js/components.js，向上两级就是站点根目录。
const SITE_ROOT = new URL('../../', import.meta.url).href;

/**
 * 把站内相对路径解析成"相对站点根"的绝对 URL。
 * 这样即使被部署到 https://user.github.io/repo/new-site/ 之类子目录也能正确工作，
 * 也可以安全地在 404 页面（URL 层级任意）里使用。
 * @param {string} path 例如 'posts/2026-08-19-hello.md'
 * @returns {string}
 */
export function siteUrl(path = '') {
  return new URL(String(path).replace(/^\.?\/+/, ''), SITE_ROOT).href;
}

export { SITE_ROOT };

/* ---------- 2. 小工具 ---------- */
export const config = window.SITE_CONFIG || {};

/** HTML 转义，所有来自 Markdown / JSON 的纯文本都要过一遍 */
export function escapeHtml(input) {
  return String(input == null ? '' : input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 日期格式化：2026-08-19 -> 2026年8月19日 */
export function formatDate(value) {
  if (!value) return '';
  const raw = String(value).slice(0, 10);
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return raw;
  return `${m[1]}年${Number(m[2])}月${Number(m[3])}日`;
}

/** 取当前页面的"逻辑页名"，用于高亮导航与按页分发逻辑 */
export function currentPage() {
  const file = window.location.pathname.split('/').pop() || 'index.html';
  return file === '' ? 'index.html' : file;
}

/* ---------- 3. 文章清单加载（带三层回退） ---------- */
let postsCache = null;

/**
 * 读取文章清单：
 *   1) assets/data/posts.json（由 GitHub Actions 脚本生成）
 *   2) assets/data/posts.fallback.json（仓库内置示例，保证本地能预览）
 *   3) 代码内置的极小清单（连 fallback 文件都缺失时的兜底）
 * @returns {Promise<Array>}
 */
export async function loadPosts() {
  if (postsCache) return postsCache;

  const candidates = [
    'assets/data/posts.json',
    'assets/data/posts.fallback.json'
  ];

  for (const path of candidates) {
    try {
      const res = await fetch(siteUrl(path), { cache: 'no-cache' });
      if (!res.ok) continue;
      const data = await res.json();
      const list = Array.isArray(data) ? data : (Array.isArray(data.posts) ? data.posts : []);
      if (list.length > 0) {
        postsCache = normalizePosts(list);
        return postsCache;
      }
    } catch (err) {
      // 文件不存在或 JSON 非法时继续尝试下一个来源
      console.warn(`[posts] 读取 ${path} 失败，尝试回退：`, err);
    }
  }

  // 最底层兜底：硬编码一条示例，避免首页白屏
  postsCache = normalizePosts(BUILTIN_FALLBACK);
  return postsCache;
}

const BUILTIN_FALLBACK = [
  {
    id: '2026-08-19-hello',
    title: '你好，世界',
    date: '2026-08-19',
    tags: ['公告'],
    summary: '示例文章：posts.json 尚未生成时的内置占位内容。',
    url: 'posts/2026-08-19-hello.md'
  }
];

function normalizePosts(list) {
  return list
    .filter(Boolean)
    .map((post) => ({
      id: post.id || String(post.url || '').replace(/^posts\//, '').replace(/\.md$/, ''),
      title: post.title || '无标题',
      date: String(post.date || '').slice(0, 10),
      tags: Array.isArray(post.tags) ? post.tags : (post.tags ? [post.tags] : []),
      summary: post.summary || '',
      // 加锁标识：清单里 gate: true 的文章需要答对进门问答才能阅读
      gate: post.gate === true,
      // url 统一成 'posts/xxx.md' 形式，渲染时再用 siteUrl() 解析
      url: post.url || `posts/${post.id}.md`
    }))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/** 按 id 取文章，用于详情页 */
export async function findPostById(id) {
  const posts = await loadPosts();
  return posts.find((p) => p.id === id) || null;
}

/* ---------- 4. 文章卡片渲染（首页与标签页共用） ---------- */
/**
 * @param {Array} posts 文章数组
 * @returns {string} HTML 字符串
 */
export function postCardHtml(post) {
  const href = `${siteUrl('article.html')}?post=${encodeURIComponent(post.id)}`;
  const tags = post.tags
    .map((t) => `<a class="tag" href="${siteUrl('tags.html')}#${encodeURIComponent(t)}">${escapeHtml(t)}</a>`)
    .join('');

  return `
    <article class="post-card">
      <h2 class="post-card__title">
        <a href="${href}">${escapeHtml(post.title)}</a>
      </h2>
      <p class="post-card__meta">
        <time datetime="${escapeHtml(post.date)}">${escapeHtml(formatDate(post.date))}</time>
      </p>
      ${post.summary ? `<p class="post-card__summary">${escapeHtml(post.summary)}</p>` : ''}
      ${tags ? `<div class="post-card__tags">${tags}</div>` : ''}
    </article>
  `;
}

/** 空状态提示 */
export function emptyStateHtml(text = '暂时没有匹配的文章。') {
  return `<p class="empty-state">${escapeHtml(text)}</p>`;
}

/* ---------- 5. 标签聚合 ---------- */
/**
 * 把文章数组聚合成 [{ name, count }]，按数量倒序。
 */
export function aggregateTags(posts) {
  const map = new Map();
  posts.forEach((post) => {
    post.tags.forEach((tag) => {
      const key = String(tag).trim();
      if (!key) return;
      map.set(key, (map.get(key) || 0) + 1);
    });
  });
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'));
}

/* ---------- 6. 导航栏 / 页脚注入 ---------- */
/**
 * 渲染导航栏到 <div id="site-header"></div>。
 * 【在这里修改导航】请改 assets/js/site-config.js 里的 nav 数组。
 */
function renderHeader() {
  const mount = document.getElementById('site-header');
  if (!mount) return;

  const page = currentPage();
  const navHtml = (config.nav || []).map((item) => {
    if (Array.isArray(item.children) && item.children.length) {
      const childHtml = item.children.map((child) => {
        const attrs = child.external ? ' target="_blank" rel="noopener"' : '';
        const label = child.external ? `${escapeHtml(child.label)} <span aria-hidden="true">↗</span>` : escapeHtml(child.label);
        const href = child.external ? child.href : siteUrl(child.href);
        return `<li><a class="dropdown-item" href="${href}"${attrs}>${label}</a></li>`;
      }).join('');

      return `
        <li class="nav-item has-dropdown">
          <button class="nav-link dropdown-toggle" type="button" aria-expanded="false">
            ${escapeHtml(item.label)} <span class="caret" aria-hidden="true">▾</span>
          </button>
          <ul class="dropdown-menu">${childHtml}</ul>
        </li>
      `;
    }

    const isActive = !item.external && item.href === page;
    const attrs = item.external ? ' target="_blank" rel="noopener"' : '';
    const label = item.external ? `${escapeHtml(item.label)} <span aria-hidden="true">↗</span>` : escapeHtml(item.label);
    const href = item.external ? item.href : siteUrl(item.href);
    return `<li class="nav-item"><a class="nav-link${isActive ? ' is-active' : ''}" href="${href}"${attrs}>${label}</a></li>`;
  }).join('');

  mount.innerHTML = `
    <header class="site-header">
      <div class="container header-inner">
        <a class="brand" href="${siteUrl('index.html')}">
          <span class="brand__title">${escapeHtml(config.siteTitle || '我的博客')}</span>
          ${config.siteSubtitle ? `<span class="brand__subtitle">${escapeHtml(config.siteSubtitle)}</span>` : ''}
        </a>

        <button class="nav-toggle" type="button" aria-label="切换导航" aria-expanded="false" aria-controls="site-nav">
          <span class="nav-toggle__bar"></span>
          <span class="nav-toggle__bar"></span>
          <span class="nav-toggle__bar"></span>
        </button>

        <nav class="site-nav" id="site-nav" aria-label="主导航">
          <ul class="nav-list">${navHtml}</ul>
        </nav>

        <button class="theme-toggle" type="button" aria-label="切换深浅色主题" title="切换深浅色主题">🌙</button>
      </div>
    </header>
  `;

  setupNavInteractions(mount);
}

/* ---------- 主题切换（深浅色，localStorage 记忆，页面内联脚本负责启动前恢复） ---------- */
const THEME_KEY = 'lea:theme';

function isDarkTheme() {
  const manual = document.documentElement.dataset.theme;
  if (manual === 'dark' || manual === 'light') return manual === 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function refreshThemeIcon(button) {
  button.textContent = isDarkTheme() ? '☀️' : '🌙';
}

function setupThemeToggle(button) {
  if (!button) return;
  refreshThemeIcon(button);
  button.addEventListener('click', () => {
    const next = isDarkTheme() ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch { /* 隐私模式下忽略 */ }
    refreshThemeIcon(button);
  });
}

/* ---------- 回到顶部按钮（长文滚动用） ---------- */
function initBackToTop() {
  if (document.querySelector('.back-to-top')) return;
  const button = document.createElement('button');
  button.className = 'back-to-top';
  button.type = 'button';
  button.setAttribute('aria-label', '回到顶部');
  button.title = '回到顶部';
  button.textContent = '↑';
  button.hidden = true;
  button.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  document.body.appendChild(button);

  const onScroll = () => { button.hidden = window.scrollY < 400; };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

function setupNavInteractions(mount) {
  const toggle = mount.querySelector('.nav-toggle');
  const nav = mount.querySelector('.site-nav');

  // 主题切换按钮
  setupThemeToggle(mount.querySelector('.theme-toggle'));

  // 移动端折叠
  toggle?.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!open));
    nav.classList.toggle('is-open', !open);
  });

  // 下拉菜单（移动端点击展开，桌面端 hover + focus 都可用）
  mount.querySelectorAll('.has-dropdown').forEach((li) => {
    const button = li.querySelector('.dropdown-toggle');
    button?.addEventListener('click', (event) => {
      event.preventDefault();
      const open = li.classList.toggle('is-open');
      button.setAttribute('aria-expanded', String(open));
    });
  });

  // 点击空白处收起下拉
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.has-dropdown')) {
      mount.querySelectorAll('.has-dropdown.is-open').forEach((li) => {
        li.classList.remove('is-open');
        li.querySelector('.dropdown-toggle')?.setAttribute('aria-expanded', 'false');
      });
    }
  });
}

/**
 * 渲染页脚到 <div id="site-footer"></div>。
 * 【在这里修改社交链接】改 site-config.js 里的 email / github / bilibili / rss。
 */
function renderFooter() {
  const mount = document.getElementById('site-footer');
  if (!mount) return;

  const busuanziEnabled = !!(config.busuanzi && config.busuanzi.enabled);
  const year = new Date().getFullYear();
  const social = [];

  if (config.email) {
    social.push(`<a href="mailto:${escapeHtml(config.email)}" title="邮箱">✉ ${escapeHtml(config.email)}</a>`);
  }
  if (config.github) {
    social.push(`<a href="${escapeHtml(config.github)}" target="_blank" rel="noopener" title="GitHub">⌨ GitHub</a>`);
  }
  if (config.bilibili) {
    social.push(`<a href="${escapeHtml(config.bilibili)}" target="_blank" rel="noopener" title="Bilibili">📺 Bilibili</a>`);
  }
  if (config.rss) {
    social.push(`<a href="${siteUrl(config.rss)}" title="RSS 订阅">📡 RSS</a>`);
  }

  mount.innerHTML = `
    <footer class="site-footer">
      <div class="container footer-inner">
        <div class="footer-social">${social.join('<span class="dot" aria-hidden="true">•</span>')}</div>
        <p class="footer-copy">
          © ${year} ${escapeHtml(config.author || '')} · ${escapeHtml(config.siteTitle || '')}
        </p>
        ${busuanziEnabled ? `
        <p class="footer-busuanzi">
          <!-- 不蒜子统计：脚本加载成功后会自动取消本行隐藏；失败则整行不显示 -->
          <span id="busuanzi_container_site_pv" style="display:none">
            本站总访问量 <span id="busuanzi_value_site_pv"></span> 次
          </span>
          <span aria-hidden="true"> · </span>
          <span id="busuanzi_container_site_uv" style="display:none">
            访客数 <span id="busuanzi_value_site_uv"></span> 人
          </span>
          <span aria-hidden="true"> · </span>
          <span id="busuanzi_container_page_pv" style="display:none">
            本页阅读 <span id="busuanzi_value_page_pv"></span> 次
          </span>
        </p>` : ''}
      </div>
    </footer>
  `;

  if (busuanziEnabled) {
    const script = document.createElement('script');
    script.src = 'https://busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js';
    script.async = true;
    document.body.appendChild(script);
  }
}

/* ---------- 7. giscus 评论（默认关闭，见 site-config.js） ---------- */
/**
 * 在 <div id="comments"></div> 内挂载 giscus。
 * mapping 使用 pathname，因此同一篇文章的评论是稳定的。
 */
export function mountGiscus(postId) {
  const mount = document.getElementById('comments');
  if (!mount) return;

  const giscus = config.giscus || {};
  if (!giscus.enabled) {
    mount.innerHTML = '';
    return;
  }
  if (!giscus.repoId || !giscus.categoryId) {
    console.warn('[giscus] 已启用但缺少 repoId / categoryId，请在 site-config.js 中补充。');
    return;
  }

  // 用文章 id 区分不同页面的讨论串
  const term = postId ? `${window.location.pathname}?post=${postId}` : window.location.pathname;

  const script = document.createElement('script');
  script.src = 'https://giscus.app/client.js';
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.setAttribute('data-repo', giscus.repo);
  script.setAttribute('data-repo-id', giscus.repoId);
  script.setAttribute('data-category', giscus.category);
  script.setAttribute('data-category-id', giscus.categoryId);
  script.setAttribute('data-mapping', 'specific');
  script.setAttribute('data-term', term);
  script.setAttribute('data-reactions-enabled', giscus.reactionsEnabled || '1');
  script.setAttribute('data-input-position', giscus.inputPosition || 'top');
  script.setAttribute('data-theme', giscus.theme || 'light');
  script.setAttribute('data-lang', giscus.lang || 'zh-CN');
  script.setAttribute('data-loading', 'lazy');

  mount.innerHTML = '';
  mount.appendChild(script);
}

/* ---------- 8. 进门问答（首页彩蛋 + 加锁文章，配置见 site-config.js） ---------- */
/**
 * 弹出问答，返回是否通过。
 * 答对返回 true（oncePerSession 开启时记入 sessionStorage）；
 * 答错/取消返回 false；浏览器禁用弹窗时放行（返回 true，不困住访客）。
 * 调用方自行决定不通过时的行为（通常是跳转到 gate.redirectUrl）。
 */
export function requestGatePass() {
  const gate = config.entranceGate;
  if (!gate || !gate.enabled) return true;

  const sessionKey = 'lea:gate:passed';
  if (gate.oncePerSession) {
    try {
      if (sessionStorage.getItem(sessionKey) === '1') return true;
    } catch { /* 隐私模式下 sessionStorage 不可用，忽略 */ }
  }

  let answer = null;
  try {
    answer = window.prompt(gate.question || '', '');
  } catch {
    return true; // 浏览器禁用了弹窗时不拦截访客
  }

  if (answer !== null && String(answer).trim() === String(gate.answer ?? '')) {
    if (gate.oncePerSession) {
      try { sessionStorage.setItem(sessionKey, '1'); } catch { /* 忽略 */ }
    }
    return true;
  }
  return false;
}

/**
 * 首页进门问答（旧站彩蛋）：不通过则跳转到 redirectUrl。
 * 只在首页（index.html）调用；是否启用由 entranceGate.homeEnabled 控制。
 */
export function applyEntranceGate() {
  const gate = config.entranceGate;
  if (!gate || !gate.enabled || !gate.homeEnabled) return;
  if (!requestGatePass() && gate.redirectUrl) {
    window.location.href = gate.redirectUrl;
  }
}

/* ---------- 9. 图片灯箱 ---------- */
/**
 * 给容器内的图片开启点击放大（聊天截图、资源图等）。
 * 点击遮罩或按 Esc 关闭。用在文章正文和资源内容上。
 */
export function enableLightbox(container) {
  if (!container || container.dataset.lightbox === 'on') return;
  container.dataset.lightbox = 'on';

  container.addEventListener('click', (event) => {
    const img = event.target.closest('img');
    if (!img) return;
    openLightbox(img.currentSrc || img.src, img.alt);
  });
}

function openLightbox(src, alt) {
  let overlay = document.getElementById('lightbox-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'lightbox-overlay';
    overlay.className = 'lightbox-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', '图片查看');
    overlay.innerHTML = '<img alt="">';
    overlay.addEventListener('click', closeLightbox);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeLightbox();
    });
    document.body.appendChild(overlay);
  }
  const big = overlay.querySelector('img');
  big.src = src;
  big.alt = alt || '';
  overlay.classList.add('is-open');
}

function closeLightbox() {
  document.getElementById('lightbox-overlay')?.classList.remove('is-open');
}

/* ---------- 9.5 代码块复制按钮 ---------- */
/**
 * 给容器内所有 <pre> 加"复制"按钮（文章正文与资源内容共用）。
 */
export function addCopyButtons(container) {
  if (!container) return;
  container.querySelectorAll('pre').forEach((pre) => {
    if (pre.querySelector('.code-copy-btn')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'code-copy-btn';
    btn.textContent = '复制';
    btn.setAttribute('aria-label', '复制代码');
    btn.addEventListener('click', async () => {
      const code = pre.querySelector('code');
      const text = code ? code.innerText : pre.innerText;
      let ok = false;
      try {
        await navigator.clipboard.writeText(text);
        ok = true;
      } catch {
        // 后备方案：隐藏 textarea + execCommand（剪贴板 API 不可用时）
        try {
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          ok = document.execCommand('copy');
          ta.remove();
        } catch {
          ok = false;
        }
      }
      btn.textContent = ok ? '已复制 ✓' : '复制失败';
      setTimeout(() => { btn.textContent = '复制'; }, 1500);
    });
    pre.appendChild(btn);
  });
}

/* ---------- 10. 页面通用初始化 ---------- */
/** 每个页面在 DOM 就绪后调用一次 */
export function initLayout() {
  renderHeader();
  renderFooter();
  initBackToTop();
}
