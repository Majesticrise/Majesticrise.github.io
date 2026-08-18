(function(){
  // Fetch the mapping file which contains Base64-encoded keys mapping to resource HTML paths
  const MAP_PATH = '/assets/resource-map.json';
  let resourceMap = null;

  function base64Encode(str) {
    try {
      return btoa(unescape(encodeURIComponent(str)));
    } catch(e) {
      return btoa(str);
    }
  }

  function showFeedback(msg, isError=true) {
    const fb = document.getElementById('resource-feedback');
    fb.textContent = msg;
    fb.style.color = isError ? '#c0392b' : '#2ecc71';
  }

  function clearFeedback() {
    const fb = document.getElementById('resource-feedback');
    fb.textContent = '';
  }

  function renderHtmlIntoContainer(html) {
    const container = document.getElementById('resource-display');
    container.innerHTML = html;
  }

  function loadResourceForCode(code) {
    if (!resourceMap) {
      showFeedback('加载映射表中，请稍候...');
      return;
    }
    const encoded = base64Encode(code.trim());
    const path = resourceMap[encoded];
    if (!path) {
      showFeedback('取件码错误，请重试');
      return;
    }

    const fetchPath = '/resourceparts/' + path;
    showFeedback('正在加载内容...', false);
    fetch(fetchPath).then(r => {
      if (!r.ok) throw new Error('网络错误');
      return r.text();
    }).then(html => {
      renderHtmlIntoContainer(html);
      clearFeedback();
    }).catch(err => {
      console.error(err);
      showFeedback('内容加载失败，请稍后重试');
    });
  }

  function init() {
    const btn = document.getElementById('resource-code-btn');
    const input = document.getElementById('resource-code-input');
    btn.addEventListener('click', function(){
      loadResourceForCode(input.value);
    });
    input.addEventListener('keydown', function(e){
      if (e.key === 'Enter') loadResourceForCode(input.value);
    });

    // fetch mapping
    fetch(MAP_PATH).then(r=> r.json()).then(json=> resourceMap = json).catch(()=>{
      console.warn('无法加载资源映射表');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();