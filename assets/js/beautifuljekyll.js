// Dean Attali / Beautiful Jekyll 2023

let BeautifulJekyllJS = {

  bigImgEl : null,
  numImgs : null,

  init : function() {
    setTimeout(BeautifulJekyllJS.initNavbar, 10);

    // Shorten the navbar after scrolling a little bit down
    $(window).scroll(function() {
        if ($(".navbar").offset().top > 50) {
            $(".navbar").addClass("top-nav-short");
        } else {
            $(".navbar").removeClass("top-nav-short");
        }
    });

    // On mobile, hide the avatar when expanding the navbar menu
    $('#main-navbar').on('show.bs.collapse', function () {
      $(".navbar").addClass("top-nav-expanded");
    });
    $('#main-navbar').on('hidden.bs.collapse', function () {
      $(".navbar").removeClass("top-nav-expanded");
    });

    // On mobile, collapse the navbar after selecting a menu item
    $('#main-navbar a:not(.dropdown-toggle)').click(function() {
      $('#main-navbar').collapse('hide');
    });

    // show the big header image
    BeautifulJekyllJS.initImgs();

    BeautifulJekyllJS.initArticleStats();
    BeautifulJekyllJS.initReadingProgress();
    BeautifulJekyllJS.initSearch();
  },

  initNavbar : function() {
    // Set the navbar-dark/light class based on its background color
    const rgb = $('.navbar').css("background-color").replace(/[^\d,]/g,'').split(",");
    const brightness = Math.round(( // http://www.w3.org/TR/AERT#color-contrast
      parseInt(rgb[0]) * 299 +
      parseInt(rgb[1]) * 587 +
      parseInt(rgb[2]) * 114
    ) / 1000);
    if (brightness <= 125) {
      $(".navbar").removeClass("navbar-light").addClass("navbar-dark");
    } else {
      $(".navbar").removeClass("navbar-dark").addClass("navbar-light");
    }

    BeautifulJekyllJS.updateNavbarHeight();
  },

  updateNavbarHeight : function() {
    const navbar = document.querySelector(".navbar");
    if (!navbar) {
      return;
    }
    document.documentElement.style.setProperty("--navbar-height", navbar.offsetHeight + "px");
  },

  initArticleStats : function() {
    const wordCountEl = document.getElementById("post-word-count");
    const readMinutesEl = document.getElementById("post-read-minutes");
    const sourceEl = document.getElementById("post-text-source");

    if (!wordCountEl || !readMinutesEl || !sourceEl) {
      return;
    }

    const rawText = (sourceEl.textContent || "").replace(/\u00a0/g, " ");
    const normalizedText = rawText.replace(/\s+/g, " ").trim();
    const cjkCount = (normalizedText.match(/[\u4e00-\u9fff]/g) || []).length;
    const latinTokenCount = (normalizedText.match(/[A-Za-z0-9]+(?:'[A-Za-z0-9]+)?/g) || []).length;
    const count = cjkCount + latinTokenCount;
    const minutes = Math.max(1, Math.ceil(count / 500));

    wordCountEl.textContent = `本文约 ${count} 字`;
    readMinutesEl.textContent = `预计阅读 ${minutes} 分钟`;
  },

  initImgs : function() {
    // If the page was large images to randomly select from, choose an image
    if ($("#header-big-imgs").length > 0) {
      BeautifulJekyllJS.bigImgEl = $("#header-big-imgs");
      BeautifulJekyllJS.numImgs = BeautifulJekyllJS.bigImgEl.attr("data-num-img");

      // 2fc73a3a967e97599c9763d05e564189
      // set an initial image
      const imgInfo = BeautifulJekyllJS.getImgInfo();
      const src = imgInfo.src;
      const desc = imgInfo.desc;
      BeautifulJekyllJS.setImg(src, desc);

      // For better UX, prefetch the next image so that it will already be loaded when we want to show it
      const getNextImg = function() {
        const imgInfo = BeautifulJekyllJS.getImgInfo();
        const src = imgInfo.src;
        const desc = imgInfo.desc;

        const prefetchImg = new Image();
        prefetchImg.src = src;
        // if I want to do something once the image is ready: `prefetchImg.onload = function(){}`

        setTimeout(function(){
          const img = $("<div></div>").addClass("big-img-transition").css("background-image", 'url(' + src + ')');
          $(".intro-header.big-img").prepend(img);
          setTimeout(function(){ img.css("opacity", "1"); }, 50);

          // after the animation of fading in the new image is done, prefetch the next one
          //img.one("transitioned webkitTransitionEnd oTransitionEnd MSTransitionEnd", function(){
          setTimeout(function() {
            BeautifulJekyllJS.setImg(src, desc);
            img.remove();
            getNextImg();
          }, 1000);
          //});
        }, 6000);
      };

      // If there are multiple images, cycle through them
      if (BeautifulJekyllJS.numImgs > 1) {
        getNextImg();
      }
    }
  },

  getImgInfo : function() {
    const randNum = Math.floor((Math.random() * BeautifulJekyllJS.numImgs) + 1);
    const src = BeautifulJekyllJS.bigImgEl.attr("data-img-src-" + randNum);
    const desc = BeautifulJekyllJS.bigImgEl.attr("data-img-desc-" + randNum);

    return {
      src : src,
      desc : desc
    }
  },

  setImg : function(src, desc) {
    $(".intro-header.big-img").css("background-image", 'url(' + src + ')');
    if (typeof desc !== typeof undefined && desc !== false) {
      $(".img-desc").text(desc).show();
    } else {
      $(".img-desc").hide();
    }
  },

  initSearch : function() {
    if (!document.getElementById("beautifuljekyll-search-overlay")) {
      return;
    }

    $("#nav-search-link").click(function(e) {
      e.preventDefault();
      $("#beautifuljekyll-search-overlay").show();
      $("#nav-search-input").focus().select();
      $("body").addClass("overflow-hidden");
    });
    $("#nav-search-exit").click(function(e) {
      e.preventDefault();
      $("#beautifuljekyll-search-overlay").hide();
      $("body").removeClass("overflow-hidden");
    });
    $(document).on('keyup', function(e) {
      if (e.key == "Escape") {
        $("#beautifuljekyll-search-overlay").hide();
        $("body").removeClass("overflow-hidden");
      }
    });
  },

  initReadingProgress : function() {
    const progressBar = document.getElementById("reading-progress-bar");
    if (!progressBar) {
      return;
    }

    const updateProgress = function() {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
      const documentHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
      const maxScroll = documentHeight - viewportHeight;
      const progress = maxScroll > 0 ? (scrollTop / maxScroll) * 100 : 0;
      progressBar.style.width = Math.min(100, Math.max(0, progress)) + "%";
    };

    updateProgress();
    BeautifulJekyllJS.updateNavbarHeight();
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);
    window.addEventListener("resize", BeautifulJekyllJS.updateNavbarHeight);
    $('#main-navbar').on('show.bs.collapse hidden.bs.collapse', function () {
      setTimeout(BeautifulJekyllJS.updateNavbarHeight, 0);
    });
  }
};

// 2fc73a3a967e97599c9763d05e564189

document.addEventListener('DOMContentLoaded', BeautifulJekyllJS.init);
