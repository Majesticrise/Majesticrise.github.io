(function () {
  const STORAGE_KEY = 'modern-theme';
  const root = document.documentElement;
  const button = document.getElementById('theme-toggle-btn');

  function applyTheme(theme) {
    if (!root) return;
    const normalized = theme === 'dark' ? 'dark' : 'light';
    root.setAttribute('data-theme', normalized);
    if (button) {
      const icon = button.querySelector('.theme-toggle-icon');
      const label = button.querySelector('.theme-toggle-label');
      const isDark = normalized === 'dark';
      button.setAttribute('aria-pressed', String(isDark));
      if (icon) icon.textContent = isDark ? '🌙' : '☀️';
      if (label) label.textContent = isDark ? '深色' : '浅色';
    }
  }

  function getPreferredTheme() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') {
      return stored;
    }

    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }

    return 'light';
  }

  function initTheme() {
    applyTheme(getPreferredTheme());
    if (!button) return;

    button.addEventListener('click', function () {
      const current = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      localStorage.setItem(STORAGE_KEY, next);
      applyTheme(next);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTheme);
  } else {
    initTheme();
  }
})();
