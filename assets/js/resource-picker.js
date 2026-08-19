(function(){
  // Source files stay as markdown in _resourceparts/*.md;
  // GitHub Pages/Jekyll builds them into /resourceparts/*.html automatically.
  const MAP_PATH = '/assets/resource-map.json';
  let resourceMap = null;

  // ---------- 新增：一言缓存 ----------
  let hitokotoCache = null; // 缓存当天一言，避免重复请求

  function base64Encode(str) {
    try {
      return btoa(unescape(encodeURIComponent(str)));
    } catch (e) {
      return btoa(str);
    }
  }

  function showFeedback(msg, isError = true) {
    const fb = document.getElementById('resource-feedback');
    if (!fb) return;
    fb.textContent = msg;
    fb.style.color = isError ? '#c0392b' : '#2ecc71';
  }

  function clearFeedback() {
    const fb = document.getElementById('resource-feedback');
    if (!fb) return;
    fb.textContent = '';
  }

  function renderHtmlIntoContainer(html) {
    const container = document.getElementById('resource-display');
    if (!container) return;
    container.innerHTML = html;
  }

  // ---------- 新增：获取今日日期字符串 YYYY-MM-DD ----------
  function getTodayStr() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  }

  // ---------- 新增：从 hitokoto API 获取一言 ----------
  async function fetchHitokoto() {
    try {
      const response = await fetch('https://v1.hitokoto.cn');
      if (!response.ok) throw new Error('网络响应失败');
      const data = await response.json();
      return {
        text: data.hitokoto,
        from: data.from || '未知出处',
        uuid: data.uuid
      };
    } catch (error) {
      console.error('一言获取失败:', error);
      return null;
    }
  }

  // ---------- 新增：显示一言到容器 ----------
  async function showHitokoto() {
    const container = document.getElementById('resource-display');
    const lockArea = document.getElementById('lock-area');
    const feedback = document.getElementById('resource-feedback');
    if (!container) return;

    // 显示加载状态
    showFeedback('正在获取今日一言...', false);

    // 如果有缓存则直接使用，否则请求
    let hitokoto = hitokotoCache;
    if (!hitokoto) {
      hitokoto = await fetchHitokoto();
      if (hitokoto) {
        hitokotoCache = hitokoto;
      }
    }

    if (!hitokoto) {
      showFeedback('一言获取失败，请稍后重试');
      return;
    }

    // 渲染一言到容器
    const html = `
      <blockquote style="font-size:1.2rem;border-left:4px solid var(--link-col);padding:1rem 1.5rem;margin:1.5rem 0;">
        ${hitokoto.text}
      </blockquote>
      <p style="text-align:right;color:var(--mid-col);font-style:italic;">
        —— ${hitokoto.from}
        <a href="https://hitokoto.cn/?uuid=${hitokoto.uuid}" target="_blank" style="margin-left:0.5rem;font-size:0.8rem;text-decoration:none;">🔗</a>
      </p>
    `;
    container.innerHTML = html;
    container.style.display = 'block';
    if (lockArea) lockArea.style.display = 'none';
    clearFeedback();
  }

  // ---------- 修改：主加载函数 ----------
  function loadResourceForCode(code) {
    const trimmed = code.trim();
    if (!trimmed) {
      showFeedback('请输入取件码');
      return;
    }

    // ========== 新增：日期彩蛋检测 ==========
    const todayStr = getTodayStr();
    if (trimmed === todayStr) {
      showHitokoto();
      return; // 直接结束，不走下面的映射表逻辑
    }
    // ========== 日期彩蛋结束 ==========

    // --- 原有逻辑：基于映射表加载 ---
    if (!resourceMap) {
      showFeedback('加载映射表中，请稍候...');
      return;
    }

    const encoded = base64Encode(trimmed);
    const htmlFileName = resourceMap[encoded];
    if (!htmlFileName) {
      showFeedback('取件码错误，请重试');
      return;
    }

    const fetchPath = '/resourceparts/' + htmlFileName;
    showFeedback('正在加载内容...', false);

    fetch(fetchPath)
      .then((response) => {
        if (!response.ok) {
          throw new Error('资源未发布或文件不存在');
        }
        return response.text();
      })
      .then((html) => {
        renderHtmlIntoContainer(html);
        clearFeedback();
      })
      .catch((error) => {
        console.error(error);
        showFeedback('内容加载失败，请稍后重试');
      });
  }

  function init() {
    const btn = document.getElementById('resource-code-btn');
    const input = document.getElementById('resource-code-input');
    if (!btn || !input) return;

    btn.addEventListener('click', function () {
      loadResourceForCode(input.value);
    });

    input.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        loadResourceForCode(input.value);
      }
    });

    fetch(MAP_PATH)
      .then((response) => response.json())
      .then((json) => {
        resourceMap = json;
      })
      .catch(() => {
        console.warn('无法加载资源映射表');
        showFeedback('内容加载失败，请稍后重试');
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();