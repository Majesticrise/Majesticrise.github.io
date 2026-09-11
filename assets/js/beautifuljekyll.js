// Dean Attali / Beautiful Jekyll 2023

let BeautifulJekyllJS = {

  init : function() {
    setTimeout(BeautifulJekyllJS.initNavbar, 10);

    // Shorten the navbar after scrolling a little bit down
    window.addEventListener('scroll', function() {
      const navbar = document.querySelector('.navbar');
      if (!navbar) {
        return;
      }

      const scrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
      if (scrollTop > 50) {
        navbar.classList.add('top-nav-short');
      } else {
        navbar.classList.remove('top-nav-short');
      }
    });

    const mainNavbar = document.getElementById('main-navbar');
    if (mainNavbar) {
      mainNavbar.addEventListener('show.bs.collapse', function () {
        const navbar = document.querySelector('.navbar');
        if (navbar) {
          navbar.classList.add('top-nav-expanded');
        }
      });

      mainNavbar.addEventListener('hidden.bs.collapse', function () {
        const navbar = document.querySelector('.navbar');
        if (navbar) {
          navbar.classList.remove('top-nav-expanded');
        }
      });

      mainNavbar.querySelectorAll('a:not(.dropdown-toggle)').forEach(function (link) {
        link.addEventListener('click', function () {
          if (window.innerWidth < 1200 && window.jQuery) {
            window.jQuery(mainNavbar).collapse('hide');
          }
        });
      });
    }

    window.addEventListener('themechange', function () {
      setTimeout(BeautifulJekyllJS.initNavbar, 0);
    });

    BeautifulJekyllJS.initReadingProgress();
    BeautifulJekyllJS.initSearch();
  },

  initNavbar : function() {
    const navbar = document.querySelector('.navbar');
    if (!navbar) {
      return;
    }

    const bgColor = window.getComputedStyle(navbar).backgroundColor || 'rgb(255, 255, 255)';
    const rgbMatch = bgColor.match(/\d+/g);
    if (!rgbMatch || rgbMatch.length < 3) {
      BeautifulJekyllJS.updateNavbarHeight();
      return;
    }

    const r = parseInt(rgbMatch[0], 10);
    const g = parseInt(rgbMatch[1], 10);
    const b = parseInt(rgbMatch[2], 10);
    const brightness = Math.round((r * 299 + g * 587 + b * 114) / 1000);

    navbar.classList.toggle('navbar-dark', brightness <= 125);
    navbar.classList.toggle('navbar-light', brightness > 125);

    BeautifulJekyllJS.updateNavbarHeight();
  },

  updateNavbarHeight : function() {
    const navbar = document.querySelector('.navbar');
    if (!navbar) {
      return;
    }
    document.documentElement.style.setProperty('--navbar-height', navbar.offsetHeight + 'px');
  },

  initSearch : function() {
    const overlay = document.getElementById('beautifuljekyll-search-overlay');
    if (!overlay) {
      return;
    }

    const navSearchLink = document.getElementById('nav-search-link');
    const navSearchInput = document.getElementById('nav-search-input');
    const navSearchExit = document.getElementById('nav-search-exit');

    if (navSearchLink) {
      navSearchLink.addEventListener('click', function(e) {
        e.preventDefault();
        overlay.style.display = 'block';
        if (navSearchInput) {
          navSearchInput.focus();
          navSearchInput.select();
        }
        document.body.classList.add('overflow-hidden');
      });
    }

    if (navSearchExit) {
      navSearchExit.addEventListener('click', function(e) {
        e.preventDefault();
        overlay.style.display = 'none';
        document.body.classList.remove('overflow-hidden');
      });
    }

    document.addEventListener('keyup', function(e) {
      if (e.key === 'Escape') {
        overlay.style.display = 'none';
        document.body.classList.remove('overflow-hidden');
      }
    });
  },

  initReadingProgress : function() {
    const progressBar = document.getElementById('reading-progress-bar');
    if (!progressBar) {
      return;
    }

    const updateProgress = function() {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
      const documentHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
      const maxScroll = documentHeight - viewportHeight;
      const progress = maxScroll > 0 ? (scrollTop / maxScroll) * 100 : 0;
      progressBar.style.width = Math.min(100, Math.max(0, progress)) + '%';
    };

    updateProgress();
    BeautifulJekyllJS.updateNavbarHeight();
    window.addEventListener('scroll', updateProgress, { passive: true });
    window.addEventListener('resize', updateProgress);
    window.addEventListener('resize', BeautifulJekyllJS.updateNavbarHeight);

    const mainNavbar = document.getElementById('main-navbar');
    if (mainNavbar) {
      mainNavbar.addEventListener('show.bs.collapse', function () {
        setTimeout(BeautifulJekyllJS.updateNavbarHeight, 0);
      });
      mainNavbar.addEventListener('hidden.bs.collapse', function () {
        setTimeout(BeautifulJekyllJS.updateNavbarHeight, 0);
      });
    }
  }
};

// 2fc73a3a967e97599c9763d05e564189

document.addEventListener('DOMContentLoaded', BeautifulJekyllJS.init);
