/* ============================================================
 * main.js —— 首页逻辑：文章列表、前端分页 + "加载更多"、站内搜索
 * 对应页面：index.html
 * ============================================================ */

import {
  initLayout, loadPosts, postCardHtml, emptyStateHtml, escapeHtml, config, applyEntranceGate, siteUrl
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

/* ---------- 搜索：标题 / 摘要 / 标签 / 正文全文 ----------
 * 首次输入关键词时才在后台拉取全部文章正文建立索引（约 1MB，只建一次），
 * 建好前先按元信息过滤，建好后自动用同一关键词重新过滤。
 */
let fullIndex = null;      // Map<postId, 正文小写文本>
let indexBuilding = null;  // 防止重复构建

function ensureFullIndex() {
  if (fullIndex) return Promise.resolve();
  if (!indexBuilding) {
    indexBuilding = (async () => {
      const entries = await Promise.all(state.all.map(async (post) => {
        try {
          const res = await fetch(siteUrl(post.url), { cache: 'no-cache' });
          if (!res.ok) return [post.id, ''];
          let raw = await res.text();
          raw = raw.replace(/^---[\s\S]*?\r?\n---\r?\n/, '');  // 去掉 Front Matter
          raw = raw.replace(/```[\s\S]*?```/g, ' ')
                   .replace(/[#>*_`~\[\]()!|]/g, ' ');
          return [post.id, raw.toLowerCase()];
        } catch {
          return [post.id, ''];
        }
      }));
      fullIndex = new Map(entries);
    })();
  }
  return indexBuilding;
}

async function applyFilter(keyword) {
  state.keyword = keyword.trim();
  const kw = state.keyword.toLowerCase();

  if (!kw) {
    state.filtered = state.all.slice();
    if (resultHint) resultHint.textContent = '';
  } else {
    const metaHit = state.all.filter((post) => {
      const haystack = [post.title, post.summary, post.tags.join(' ')].join(' ').toLowerCase();
      return haystack.includes(kw);
    });

    if (fullIndex) {
      // 全文索引就绪：元信息命中 + 正文命中 合并（保持日期倒序）
      const ids = new Set(metaHit.map((p) => p.id));
      state.all.forEach((p) => {
        if ((fullIndex.get(p.id) || '').includes(kw)) ids.add(p.id);
      });
      state.filtered = state.all.filter((p) => ids.has(p.id));
      if (resultHint) {
        resultHint.innerHTML = `关键词 <strong>${escapeHtml(state.keyword)}</strong> · 命中 ${state.filtered.length} 篇（含正文）`;
      }
    } else {
      state.filtered = metaHit;
      if (resultHint) {
        resultHint.innerHTML = `关键词 <strong>${escapeHtml(state.keyword)}</strong> · 命中 ${state.filtered.length} 篇（正文索引加载中…）`;
      }
      // 后台建索引，建好后若关键词未变则自动重新过滤
      ensureFullIndex().then(() => {
        if (state.keyword === keyword.trim()) applyFilter(keyword);
      });
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

/* ---------- 系列入口卡片（配置见 site-config.js 的 series） ---------- */
function renderSeriesCards() {
  const mount = document.getElementById('series-cards');
  const series = config.series || [];
  if (!mount || !series.length) return;

  const cards = series.map((item) => {
    const posts = item.ids
      .map((id) => state.all.find((p) => p.id === id))
      .filter(Boolean);
    if (!posts.length) return ''; // 系列内文章暂未发布则不显示
    const dates = posts.map((p) => p.date).sort();
    const start = dates[0];
    const end = dates[dates.length - 1];
    const range = start === end ? start : `${start} ~ ${end}`;
    const href = `${siteUrl('article.html')}?post=${encodeURIComponent(posts[0].id)}`;
    return `
      <a class="series-card" href="${href}">
        <span class="series-card__name">${escapeHtml(item.title)}</span>
        <span class="series-card__desc">${escapeHtml(item.desc)}</span>
        <span class="series-card__meta">${posts.length} 篇 · ${escapeHtml(range)} · 从头读 →</span>
      </a>`;
  });

  if (cards.some(Boolean)) {
    mount.innerHTML = cards.join('');
    mount.hidden = false;
    setupCardTilt();
  }
}

/* ---------- 网安日报（CI 抓取的外部内容，配置见 site-config.js 的 cyberDaily） ---------- */
async function renderCyberDaily() {
  const mount = document.getElementById('cyber-daily');
  const cfg = config.cyberDaily || {};
  if (!mount || cfg.enabled === false) return;

  try {
    const res = await fetch(siteUrl(cfg.dataUrl || 'assets/data/cyber-daily.json'), { cache: 'no-cache' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const items = (data.items || []).slice(0, cfg.maxItems || 5);
    if (!items.length) { mount.hidden = true; return; }

    const dateLabel = data.date ? data.date.slice(5).replace('-', '.') : '';
    mount.innerHTML = `
      <p class="cyber-card__heading">🔒 网安日报 <span class="cyber-card__date">${dateLabel}</span></p>
      <ul class="cyber-card__list">
        ${items.map((item) => `
          <li><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)}</a></li>`).join('')}
      </ul>
      <a class="cyber-card__more" href="${escapeHtml(data.source)}" target="_blank" rel="noopener noreferrer">查看完整日报 ↗</a>`;
    mount.hidden = false;
  } catch {
    mount.hidden = true; // 数据缺失/格式错误时静默隐藏
  }
}

/* ---------- 推荐站点外链卡片（配置见 site-config.js 的 featuredSites） ---------- */
function renderSiteLinks() {
  const mount = document.getElementById('site-links');
  const sites = config.featuredSites || [];
  if (!mount || !sites.length) return;

  mount.innerHTML = `
    <p class="site-links__heading">推荐站点</p>
    ${sites.map((site) => `
      <a class="site-link-card" href="${escapeHtml(site.url)}" target="_blank" rel="noopener noreferrer">
        <span class="site-link-card__name">${escapeHtml(site.name)} <span class="site-link-card__arrow" aria-hidden="true">↗</span></span>
        <span class="site-link-card__desc">${escapeHtml(site.desc)}</span>
      </a>`).join('')}
  `;
  mount.hidden = false;
}

/* ---------- 合集卡片 3D 倾斜（鼠标跟随；触屏自动跳过） ---------- */
function setupCardTilt() {
  if (!window.matchMedia('(hover: hover)').matches) return;
  document.querySelectorAll('.series-card').forEach((card) => {
    if (card.dataset.tilt === 'on') return;
    card.dataset.tilt = 'on';
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.transform =
        `perspective(700px) rotateX(${(-y * 7).toFixed(2)}deg) rotateY(${(x * 7).toFixed(2)}deg) translateY(-2px)`;
    });
    card.addEventListener('mouseleave', () => { card.style.transform = ''; });
  });
}

function initRevealAnimations() {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const targets = document.querySelectorAll('.post-card, .series-card, .home-widget');

  if (reducedMotion) {
    targets.forEach((el) => el.classList.add('is-visible'));
    return;
  }

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12 });

    targets.forEach((el) => {
      el.classList.add('reveal');
      observer.observe(el);
    });
    return;
  }

  targets.forEach((el) => {
    el.classList.add('reveal', 'is-visible');
  });
}

function bindCardMotion() {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion) return;

  document.querySelectorAll('.post-card, .series-card').forEach((card) => {
    if (card.dataset.motionBound === 'true') return;
    card.dataset.motionBound = 'true';

    card.addEventListener('pointermove', (event) => {
      const rect = card.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;
      card.style.setProperty('--x', `${x}%`);
      card.style.setProperty('--y', `${y}%`);
    });
  });
}

/* ---------- 首页小部件：现在时间 / 高考倒计时 ----------
 * 文案与目标日期在 site-config.js 的 homeWidgets 中配置。
 */
function initHomeWidgets() {
  const widgetCfg = config.homeWidgets || {};
  const timeCard = document.getElementById('widget-time');
  const countdownCard = document.getElementById('widget-countdown');

  // 现在时间（旧站的日曜日/月曜日星期风格可选）
  if (timeCard && widgetCfg.time?.enabled !== false) {
    timeCard.hidden = false;
    const labelEl = timeCard.querySelector('.home-widget__label');
    const valueEl = document.getElementById('home-time-value');
    if (labelEl && widgetCfg.time.label) labelEl.textContent = widgetCfg.time.label;

    const jpWeek = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];
    const cnWeek = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    const week = widgetCfg.time.weekdayStyle === 'cn' ? cnWeek : jpWeek;
    const pad = (n) => String(n).padStart(2, '0');

    const updateTime = () => {
      const now = new Date();
      valueEl.textContent =
        `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())} ` +
        `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}（${week[now.getDay()]}）`;
    };
    updateTime();
    setInterval(updateTime, 1000);
  }

  // 高考倒计时
  if (countdownCard && widgetCfg.countdown?.enabled) {
    countdownCard.hidden = false;
    const labelEl = countdownCard.querySelector('.home-widget__label');
    const valueEl = document.getElementById('home-countdown-value');
    if (labelEl && widgetCfg.countdown.label) labelEl.textContent = widgetCfg.countdown.label;

    const m = String(widgetCfg.countdown.target || '').match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (!m) {
      valueEl.textContent = '倒计时目标日期未配置';
      return;
    }
    // 按本地时区当天零点计算
    const target = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0).getTime();

    const updateCountdown = () => {
      const diff = target - Date.now();
      if (diff <= 0) {
        valueEl.textContent = widgetCfg.countdown.doneText || '🎉 高考已开始，祝考生金榜题名！';
        return;
      }
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      valueEl.textContent = `${days}天 ${hours}时 ${minutes}分 ${seconds}秒`;
    };
    updateCountdown();
    setInterval(updateCountdown, 1000);
  }
}

/* ---------- 启动 ---------- */
(async function boot() {
  // 进门问答：答错会跳转，因此必须最先执行（见 site-config.js 的 entranceGate）
  applyEntranceGate();

  initHomeWidgets();

  state.all = await loadPosts();
  renderCyberDaily();
  renderSeriesCards();
  renderSiteLinks();
  bindCardMotion();
  initRevealAnimations();

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
  initRevealAnimations();
})();
