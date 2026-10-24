/* ============================================================
 * resources.js —— 资源页：取件码查询 + 日期彩蛋（一言）
 * 对应页面：resources.html
 *
 * 【在这里添加取件码】请改 assets/data/resources.json，不要改这里。
 * ============================================================ */

import { initLayout, siteUrl, escapeHtml, enableLightbox, addCopyButtons } from './components.js';

initLayout();

/* ---------- 元素 ---------- */
const form = document.getElementById('code-form');
const input = document.getElementById('code-input');
const feedback = document.getElementById('code-feedback');
const resultEl = document.getElementById('resource-result');
const pickerEl = document.getElementById('resource-picker');
const resetBtn = document.getElementById('reset-btn');

/* ---------- 常量 ---------- */
const RESOURCES_PATH = 'assets/data/resources.json';
const HITOKOTO_CACHE_KEY = 'lea:hitokoto:cache'; // 本地缓存，当天有效
const cfg = window.SITE_CONFIG || {};
const hitokotoCfg = cfg.hitokoto || { enabled: true, api: 'https://v1.hitokoto.cn' };

let resourceMap = null;      // 懒加载的资源映射
let mapLoadError = null;

/* ---------- 提示 ---------- */
function setFeedback(message, type = 'error') {
  if (!feedback) return;
  feedback.textContent = message || '';
  feedback.className = 'code-feedback' + (message ? ` code-feedback--${type}` : '');
  feedback.setAttribute('role', 'status');
}

function clearFeedback() {
  setFeedback('');
}

/* ---------- 日期工具 ---------- */
function todayParts() {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return {
    dashed: `${yyyy}-${mm}-${dd}`,   // YYYY-MM-DD
    compact: `${yyyy}${mm}${dd}`,    // YYYYMMDD
    key: `${yyyy}${mm}${dd}`
  };
}

/** 判断输入是否等于"今天"（两种格式） */
function isTodayCode(code) {
  const t = todayParts();
  return code === t.dashed || code === t.compact;
}

/* ---------- 资源数据加载 ---------- */
async function loadResources() {
  if (resourceMap) return resourceMap;
  if (mapLoadError) throw mapLoadError;

  try {
    const res = await fetch(siteUrl(RESOURCES_PATH), { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    let data = await res.json();

    // 忽略以下划线开头的说明性字段（例如 "_comment"）
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      data = Object.fromEntries(
        Object.entries(data).filter(([key]) => !key.startsWith('_'))
      );
    }

    resourceMap = data || {};
    return resourceMap;
  } catch (err) {
    mapLoadError = err;
    throw err;
  }
}

/* ---------- 视图切换 ---------- */
function showResult(html, title) {
  if (!resultEl) return;
  resultEl.innerHTML = `
    <div class="resource-card">
      ${title ? `<h2 class="resource-card__title">${escapeHtml(title)}</h2>` : ''}
      <div class="resource-card__body">${html}</div>
      <div class="resource-card__actions">
        <button class="btn btn--ghost" type="button" id="reset-btn-inline">重新输入</button>
      </div>
    </div>
  `;
  resultEl.hidden = false;
  if (pickerEl) pickerEl.hidden = true;

  // 外链新窗口打开；站内链接保持当前页跳转
  resultEl.querySelectorAll('a[href^="http"]').forEach((a) => {
    try {
      if (new URL(a.href, location.href).origin === location.origin) return;
    } catch { /* 非法 URL 按外链处理 */ }
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
  });

  // 资源内容里的图片：懒加载 + 点击放大；代码块加复制按钮
  resultEl.querySelectorAll('img').forEach((img) => {
    img.loading = 'lazy';
    img.decoding = 'async';
  });
  enableLightbox(resultEl);
  addCopyButtons(resultEl);

  document.getElementById('reset-btn-inline')?.addEventListener('click', resetView);
  resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetView() {
  if (resultEl) {
    resultEl.hidden = true;
    resultEl.innerHTML = '';
  }
  if (pickerEl) pickerEl.hidden = false;
  if (input) {
    input.value = '';
    input.focus();
  }
  clearFeedback();
}

/* ---------- 日期彩蛋：一言 ---------- */
function readHitokotoCache() {
  try {
    const raw = localStorage.getItem(HITOKOTO_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const today = todayParts().key;
    // 只接受"今天"的缓存
    return parsed && parsed.day === today ? parsed.data : null;
  } catch {
    return null;
  }
}

function writeHitokotoCache(data) {
  try {
    localStorage.setItem(HITOKOTO_CACHE_KEY, JSON.stringify({
      day: todayParts().key,
      data
    }));
  } catch {
    // 隐私模式下 localStorage 可能不可用，忽略即可
  }
}

async function fetchHitokoto() {
  const cached = readHitokotoCache();
  if (cached) return cached;

  const res = await fetch(hitokotoCfg.api || 'https://v1.hitokoto.cn', { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const json = await res.json();
  const data = {
    text: json.hitokoto || '',
    from: json.from || '',
    fromWho: json.from_who || '',
    uuid: json.uuid || ''
  };

  if (!data.text) throw new Error('返回内容为空');
  writeHitokotoCache(data);
  return data;
}

async function showHitokoto() {
  if (!hitokotoCfg.enabled) {
    setFeedback('今日彩蛋已关闭。');
    return;
  }

  setFeedback('正在向一言服务器请求今天的句子…', 'info');
  if (resultEl) {
    resultEl.hidden = false;
    resultEl.innerHTML = '<p class="muted">加载中…</p>';
  }

  try {
    const data = await fetchHitokoto();
    const source = data.from || '未知出处';
    const who = data.fromWho ? ` · ${data.fromWho}` : '';
    const link = data.uuid
      ? `<a href="https://hitokoto.cn/?uuid=${encodeURIComponent(data.uuid)}" target="_blank" rel="noopener noreferrer">查看来源 ↗</a>`
      : '';

    const html = `
      <blockquote class="hitokoto">${escapeHtml(data.text)}</blockquote>
      <p class="hitokoto__from">—— ${escapeHtml(source)}${escapeHtml(who)}</p>
      <p class="hitokoto__link">${link}</p>
    `;

    if (resultEl) {
      resultEl.innerHTML = `
        <div class="resource-card resource-card--hitokoto">
          <h2 class="resource-card__title">今天的彩蛋</h2>
          <div class="resource-card__body">${html}</div>
          <div class="resource-card__actions">
            <button class="btn btn--ghost" type="button" id="reset-btn-inline">重新输入</button>
          </div>
        </div>
      `;
      resultEl.hidden = false;
      document.getElementById('reset-btn-inline')?.addEventListener('click', resetView);
    }
    if (pickerEl) pickerEl.hidden = true;
    clearFeedback();
  } catch (err) {
    console.error('[hitokoto] 获取失败', err);
    // 失败时保持输入区可见，给一个友好提示
    if (resultEl) {
      resultEl.hidden = true;
      resultEl.innerHTML = '';
    }
    if (pickerEl) pickerEl.hidden = false;
    setFeedback('一言服务器暂时连不上，稍后再试；也可以直接输入资源取件码。', 'warn');
  }
}

/* ---------- 主流程：提交取件码 ---------- */
async function handleSubmit(rawCode) {
  const code = String(rawCode || '').trim();
  if (!code) {
    setFeedback('请输入取件码。');
    return;
  }

  // 1) 日期彩蛋优先
  if (isTodayCode(code)) {
    await showHitokoto();
    return;
  }

  // 2) 查资源映射
  setFeedback('正在查询…', 'info');

  try {
    const map = await loadResources();
    const entry = map[code];

    if (!entry) {
      // 大小写不敏感兜底查找，方便用户输入
      const lower = code.toLowerCase();
      const hitKey = Object.keys(map).find((k) => k.toLowerCase() === lower);
      if (hitKey) {
        const hit = map[hitKey];
        renderResource(hit);
        return;
      }
      setFeedback('没有找到这个取件码，请检查是否输入有误。');
      if (input) input.select();
      return;
    }

    renderResource(entry);
  } catch (err) {
    console.error('[resources] 读取映射失败', err);
    setFeedback('资源数据加载失败，请确认 assets/data/resources.json 存在且格式正确。');
  }
}

function renderResource(entry) {
  clearFeedback();

  if (typeof entry === 'string') {
    try {
      showResult(entry, '');
      return;
    } catch {
      // 字符串直接当作 HTML 使用
      showResult(entry, '');
      return;
    }
  }

  const title = entry.title || '';
  const html = entry.html || '<p class="muted">该取件码暂无内容。</p>';
  showResult(html, title);
}

/* ---------- 事件绑定 ---------- */
form?.addEventListener('submit', (event) => {
  event.preventDefault();
  handleSubmit(input?.value);
});

resetBtn?.addEventListener('click', resetView);

// 输入时清掉上一次的错误提示
input?.addEventListener('input', () => {
  if (feedback?.textContent) clearFeedback();
});

// 自动聚焦（桌面端）
if (input && window.matchMedia('(min-width: 768px)').matches) {
  input.focus();
}

// 支持 #code=ABC123 直接取件（便于分享链接）
const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
const presetCode = hashParams.get('code') || new URLSearchParams(window.location.search).get('code');
if (presetCode) {
  if (input) input.value = presetCode;
  handleSubmit(presetCode);
}
