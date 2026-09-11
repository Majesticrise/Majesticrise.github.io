(function () {
  function buildToc() {
    const container = document.querySelector('.post-toc');
    const article = document.querySelector('.blog-post');
    if (!container || !article) return;

    const headings = Array.from(article.querySelectorAll('h2, h3')).filter((heading) => {
      const text = heading.textContent.trim();
      return text.length > 0;
    });

    if (!headings.length) {
      container.style.display = 'none';
      return;
    }

    const list = document.createElement('ul');
    list.className = 'post-toc-list';

    headings.forEach((heading) => {
      const item = document.createElement('li');
      item.className = heading.tagName.toLowerCase() === 'h3' ? 'post-toc-item post-toc-item-sub' : 'post-toc-item';

      const anchor = document.createElement('a');
      const id = heading.id || heading.textContent.trim().toLowerCase().replace(/[^\w\u4e00-\u9fff\- ]+/g, '').replace(/\s+/g, '-');
      heading.id = id;
      anchor.href = '#' + id;
      anchor.textContent = heading.textContent.trim();
      item.appendChild(anchor);
      list.appendChild(item);
    });

    container.appendChild(list);

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      const visibleEntry = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visibleEntry) return;

      const currentId = visibleEntry.target.id;
      document.querySelectorAll('.post-toc a').forEach((link) => {
        const active = link.getAttribute('href') === '#' + currentId;
        link.classList.toggle('is-active', active);
      });
    }, {
      rootMargin: '-10% 0px -70% 0px',
      threshold: [0.1, 0.25, 0.5]
    });

    headings.forEach((heading) => observer.observe(heading));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildToc);
  } else {
    buildToc();
  }
})();
