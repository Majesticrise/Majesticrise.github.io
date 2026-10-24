/* ============================================================
 * article.js —— 文章详情页逻辑
 * 对应页面：article.html?post=<文件名去 .md>
 *
 * 依赖（CDN，按需加载）：
 *   - marked.js   ：把 Markdown 渲染成 HTML
 *   - highlight.js：代码块语法高亮（可选，加载失败不影响阅读）
 *   - DOMPurify   ：清洗渲染结果，避免 Markdown 中的脚本注入（可选）
 * ============================================================ */

import {
  initLayout, loadPosts, findPostById, siteUrl, escapeHtml, formatDate, mountGiscus, enableLightbox,
  requestGatePass, addCopyButtons
} from './components.js';

initLayout();

/* ---------- 依赖（全部本地化在 assets/vendor/，不依赖外部 CDN） ----------
 *   - marked.js   ：Markdown 渲染
 *   - highlight.js：代码高亮（亮/暗两套样式，跟随当前主题）
 *   - DOMPurify   ：清洗渲染结果，防止 Markdown 中的脚本注入
 */
const CDN = {
  marked: siteUrl('assets/vendor/marked/marked.min.js'),
  highlightJs: siteUrl('assets/vendor/highlight/highlight.min.js'),
  highlightCssLight: siteUrl('assets/vendor/highlight/styles/github.min.css'),
  highlightCssDark: siteUrl('assets/vendor/highlight/styles/github-dark.min.css'),
  purify: siteUrl('assets/vendor/purify/purify.min.js'),
  mermaid: siteUrl('assets/vendor/mermaid/mermaid.min.js')
};

const titleEl = document.getElementById('article-title');
const metaEl = document.getElementById('article-meta');
const tagsEl = document.getElementById('article-tags');
const bodyEl = document.getElementById('article-body');
const tocEl = document.getElementById('article-toc');
const pagerEl = document.getElementById('article-pager');
const crumbEl = document.getElementById('article-crumb');

/* ---------- 依赖加载（每个只加载一次） ---------- */
const loaderCache = new Map();

function loadScript(src) {
  if (!loaderCache.has(src)) {
    loaderCache.set(src, new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = src;
      el.async = true;
      el.onload = () => resolve(true);
      el.onerror = () => reject(new Error(`加载失败: ${src}`));
      document.head.appendChild(el);
    }));
  }
  return loaderCache.get(src);
}

function loadCss(href, id) {
  const selector = id ? `link[id="${id}"]` : `link[href="${href}"]`;
  if (document.querySelector(selector)) return;
  const link = document.createElement('link');
  if (id) link.id = id;
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

/* 代码高亮双主题：跟随手动切换（data-theme）和系统偏好 */
function applyHljsTheme() {
  const light = document.getElementById('hljs-light');
  const dark = document.getElementById('hljs-dark');
  if (!light || !dark) return;
  const isDark = document.documentElement.dataset.theme === 'dark' ||
    (!document.documentElement.dataset.theme && window.matchMedia('(prefers-color-scheme: dark)').matches);
  light.disabled = isDark;
  dark.disabled = !isDark;
}

/* ---------- Mermaid 图表：仅有 mermaid 代码块时才按需加载（约 3MB） ---------- */
async function renderMermaidBlocks(container) {
  const blocks = [...container.querySelectorAll('code.language-mermaid')];
  if (!blocks.length) return;

  try {
    await loadScript(CDN.mermaid);
    if (!window.mermaid) throw new Error('mermaid 未就绪');

    const isDark = document.documentElement.dataset.theme === 'dark' ||
      (!document.documentElement.dataset.theme && window.matchMedia('(prefers-color-scheme: dark)').matches);
    window.mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: isDark ? 'dark' : 'default'
    });

    for (const code of blocks) {
      const pre = code.closest('pre');
      if (!pre) continue;
      const div = document.createElement('div');
      div.className = 'mermaid';
      div.textContent = code.textContent;
      pre.replaceWith(div);
      try {
        await window.mermaid.run({ nodes: [div] });
      } catch (err) {
        // 语法错误时回退为源码展示，不让整页挂掉
        console.warn('[mermaid] 图表渲染失败，保留源码展示', err);
        const preFallback = document.createElement('pre');
        const codeFallback = document.createElement('code');
        codeFallback.className = 'language-mermaid';
        codeFallback.textContent = div.textContent;
        preFallback.appendChild(codeFallback);
        div.replaceWith(preFallback);
      }
    }
  } catch (err) {
    console.warn('[mermaid] 未加载，图表保持源码展示', err);
  }
}

/* ---------- Front Matter 解析（详情页兜底用） ---------- */
/**
 * 正常情况下 posts.json 已提供元数据；但如果你直接打开某个 md，
 * 或者 posts.json 是旧的，就从前言里补一份。
 */
function parseFrontMatter(raw) {
  const match = raw.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { data: {}, body: raw };

  const data = {};
  match[1].split(/\r?\n/).forEach((line) => {
    const m = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!m) return;
    const key = m[1];
    let value = m[2].trim();

    if (/^\[.*\]$/.test(value)) {
      // tags: ["a", "b"]
      value = value.slice(1, -1).split(',')
        .map((v) => v.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
    } else {
      value = value.replace(/^['"]|['"]$/g, '');
    }
    data[key] = value;
  });

  return { data, body: raw.slice(match[0].length) };
}

/* ---------- 相对图片/链接修正 ---------- */
// Markdown 里的 ./img/a.png 原本是相对 posts/ 目录的，渲染后要指回真实位置。
// 顺带给图片加懒加载（聊天长图多，首屏外不加载）。
function fixRelativeUrls(container) {
  container.querySelectorAll('img').forEach((img) => {
    img.loading = 'lazy';
    img.decoding = 'async';
    const value = img.getAttribute('src');
    if (value && !/^(https?:|mailto:|tel:|data:|#|\/)/i.test(value)) {
      img.src = new URL(value, siteUrl('posts/')).href;
    }
  });

  container.querySelectorAll('a[href]').forEach((node) => {
    const value = node.getAttribute('href');
    if (!value) return;
    // 跳过外链、锚点、绝对路径、data:
    if (/^(https?:|mailto:|tel:|data:|#|\/)/i.test(value)) return;
    node.setAttribute('href', new URL(value, siteUrl('posts/')).href);
  });

  // 外链新窗口打开；站内链接（ rewritten 后同源）保持当前页跳转
  container.querySelectorAll('a[href^="http"]').forEach((a) => {
    try {
      if (new URL(a.href, location.href).origin === location.origin) return;
    } catch { /* 非法 URL 按外链处理 */ }
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
  });
}

/* ---------- 目录（TOC） ---------- */
function buildToc(container) {
  if (!tocEl) return;

  const headings = [...container.querySelectorAll('h2, h3')];
  if (headings.length < 2) {
    tocEl.hidden = true;
    return;
  }

  const items = headings.map((h, index) => {
    if (!h.id) {
      h.id = `section-${index + 1}`;
    }
    return `<li class="toc__item toc__item--${h.tagName.toLowerCase()}">
      <a href="#${escapeHtml(h.id)}">${escapeHtml(h.textContent)}</a>
    </li>`;
  }).join('');

  tocEl.innerHTML = `<p class="toc__title">目录</p><ul class="toc__list">${items}</ul>`;
  tocEl.hidden = false;
}

/* ---------- 上一篇 / 下一篇 ---------- */
function renderPager(posts, currentId) {
  if (!pagerEl) return;

  const index = posts.findIndex((p) => p.id === currentId);
  if (index === -1) {
    pagerEl.innerHTML = '';
    return;
  }

  // posts 已按日期倒序：index-1 是更新的一篇，index+1 是更早的一篇
  const newer = posts[index - 1];
  const older = posts[index + 1];

  const link = (post, label) => {
    if (!post) return `<span class="pager__link pager__link--disabled">${label}：没有了</span>`;
    return `<a class="pager__link" href="${siteUrl('article.html')}?post=${encodeURIComponent(post.id)}">
      ${label}：${escapeHtml(post.title)}
    </a>`;
  };

  pagerEl.innerHTML = `
    <div class="pager__col pager__col--prev">${link(newer, '上一篇')}</div>
    <div class="pager__col pager__col--next">${link(older, '下一篇')}</div>
  `;
}

/* ---------- 错误状态 ---------- */
function showError(message, detail = '') {
  if (!bodyEl) return;
  bodyEl.innerHTML = `
    <div class="notice notice--error">
      <p><strong>${escapeHtml(message)}</strong></p>
      ${detail ? `<p class="muted">${escapeHtml(detail)}</p>` : ''}
      <p><a class="btn btn--primary" href="${siteUrl('index.html')}">返回文章列表</a></p>
    </div>
  `;
  if (titleEl) titleEl.textContent = '出错了';
  if (metaEl) metaEl.innerHTML = '';
  if (tagsEl) tagsEl.innerHTML = '';
  if (tocEl) tocEl.hidden = true;
  if (pagerEl) pagerEl.innerHTML = '';
}

/* ---------- 主流程 ---------- */
(async function boot() {
  const params = new URLSearchParams(window.location.search);
  const postId = (params.get('post') || '').trim();

  if (!postId) {
    showError('缺少文章参数', '请在地址后加上 ?post=文件名（不含 .md），例如 article.html?post=2026-08-19-hello');
    return;
  }

  // 安全校验：只允许文件名，禁止路径穿越
  if (!/^[\w\u4e00-\u9fa5.\-]+$/.test(postId)) {
    showError('参数不合法', '文件名只能包含字母、数字、中文、点、横线或下划线。');
    return;
  }

  const posts = await loadPosts();
  const meta = await findPostById(postId);

  // 读取 Markdown 源文件
  let raw = '';
  try {
    const res = await fetch(siteUrl(`posts/${postId}.md`), { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    raw = await res.text();
  } catch (err) {
    showError('找不到这篇文章', `posts/${postId}.md 不存在或无法读取。`);
    return;
  }

  const { data: fm, body: markdown } = parseFrontMatter(raw);

  /* --- 加锁文章：Front Matter 里写了 `gate: true` 的，需先答对进门问答 ---
   * 技术类、杂谈类文章不加此标识即可直接阅读（问答内容见 site-config.js）。
   */
  const gateLocked = (meta?.gate === true) ||
    fm.gate === true || String(fm.gate).toLowerCase() === 'true';
  if (gateLocked) {
    const gate = window.SITE_CONFIG?.entranceGate || {};
    if (!requestGatePass()) {
      if (gate.redirectUrl) window.location.href = gate.redirectUrl;
      showError('这篇文章已上锁', '回答正确才能阅读。');
      return;
    }
  }

  // 预计阅读时长：按正文纯文本长度估算（中文约 400 字/分钟），至少 1 分钟
  const plainLength = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~-]/g, '')
    .replace(/\s+/g, '')
    .length;
  const readMinutes = Math.max(1, Math.round(plainLength / 400));

  // 合并元数据：优先 posts.json，其次 Front Matter
  const post = {
    id: postId,
    title: meta?.title || fm.title || postId,
    date: meta?.date || fm.date || '',
    tags: meta?.tags || (Array.isArray(fm.tags) ? fm.tags : (fm.tags ? [fm.tags] : [])),
    summary: meta?.summary || fm.summary || ''
  };

  /* --- 头部 --- */
  document.title = `${post.title} · ${window.SITE_CONFIG?.siteTitle || ''}`;
  const descMeta = document.querySelector('meta[name="description"]');
  if (descMeta && post.summary) descMeta.setAttribute('content', post.summary);

  if (titleEl) titleEl.textContent = post.title;
  if (crumbEl) {
    crumbEl.innerHTML = `<a href="${siteUrl('index.html')}">首页</a> / <span>${escapeHtml(post.title)}</span>`;
  }
  if (metaEl) {
    metaEl.innerHTML =
      `<time datetime="${escapeHtml(post.date)}">${escapeHtml(formatDate(post.date))}</time>` +
      `<span class="meta-sep" aria-hidden="true"> · </span>` +
      `<span class="read-minutes">预计阅读 ${readMinutes} 分钟</span>`;
  }
  if (tagsEl) {
    tagsEl.innerHTML = post.tags
      .map((t) => `<a class="tag" href="${siteUrl('tags.html')}#${encodeURIComponent(t)}">${escapeHtml(t)}</a>`)
      .join('');
  }

  /* --- 渲染 Markdown --- */
  let html = '';

  try {
    await loadScript(CDN.marked);

    if (!window.marked) throw new Error('marked 未就绪');

    // 配置 marked：gfm + 换行转 <br>
    window.marked.setOptions({ gfm: true, breaks: true });

    html = window.marked.parse(markdown);
  } catch (err) {
    console.error('[marked] 渲染失败，降级为 <pre> 显示原文', err);
    html = `<pre class="markdown-fallback">${escapeHtml(markdown)}</pre>`;
  }

  // 可选：DOMPurify 清洗（加载失败就跳过，不阻断阅读）
  try {
    await loadScript(CDN.purify);
    if (window.DOMPurify) {
      html = window.DOMPurify.sanitize(html, { ADD_ATTR: ['target'] });
    }
  } catch {
    console.warn('[purify] 未加载，跳过 HTML 清洗');
  }

  if (bodyEl) {
    bodyEl.innerHTML = html;
    fixRelativeUrls(bodyEl);
    buildToc(bodyEl);
    enableLightbox(bodyEl); // 点击图片放大查看（聊天截图刚需）
  }

  /* --- 代码高亮（本地双主题，跟随深浅色切换） + 复制按钮 + Mermaid 图表 --- */
  try {
    loadCss(CDN.highlightCssLight, 'hljs-light');
    loadCss(CDN.highlightCssDark, 'hljs-dark');
    await loadScript(CDN.highlightJs);
    if (window.hljs && bodyEl) {
      bodyEl.querySelectorAll('pre code').forEach((block) => {
        window.hljs.highlightElement(block);
      });
    }
    applyHljsTheme();
    // 手动切换主题（data-theme 变化）或系统偏好变化时同步高亮主题
    new MutationObserver(applyHljsTheme).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyHljsTheme);
  } catch {
    console.warn('[highlight.js] 未加载，代码块保持无高亮');
  }

  if (bodyEl) {
    addCopyButtons(bodyEl);
    await renderMermaidBlocks(bodyEl);
  }

  /* --- 上一篇 / 下一篇 --- */
  renderPager(posts, postId);

  /* --- 评论 --- */
  mountGiscus(postId);
})();
