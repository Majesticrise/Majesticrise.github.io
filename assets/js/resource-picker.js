(function(){
  // Source files stay as markdown in _resourceparts/*.md;
  // GitHub Pages/Jekyll builds them into /resourceparts/*.html automatically.
  const MAP_PATH = '/assets/resource-map.json';
  let resourceMap = null;

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

  function loadResourceForCode(code) {
    if (!resourceMap) {
      showFeedback('加载映射表中，请稍候...');
      return;
    }

    const trimmed = code.trim();
    if (!trimmed) {
      showFeedback('请输入取件码');
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