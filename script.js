(function () {
  var header = document.querySelector('.header');
  var nav = document.getElementById('nav');
  var toggle = document.getElementById('menuToggle');
  var fab = document.querySelector('.fab');
  var hero = document.querySelector('.hero');

  document.getElementById('year').textContent = new Date().getFullYear();

  // Mobile menu
  function setMenu(open) {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }
  toggle.addEventListener('click', function () {
    setMenu(!nav.classList.contains('is-open'));
  });
  nav.addEventListener('click', function (e) {
    if (e.target.closest('a')) setMenu(false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') setMenu(false);
  });

  // Header shadow + floating DM button once past the hero
  function onScroll() {
    header.classList.toggle('is-scrolled', window.scrollY > 10);
    fab.classList.toggle('is-visible', window.scrollY > hero.offsetHeight * 0.7);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Product filters
  var filters = document.querySelectorAll('.filter');
  var products = document.querySelectorAll('.product');
  filters.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var cat = btn.dataset.filter;
      filters.forEach(function (b) {
        b.classList.toggle('is-active', b === btn);
        b.setAttribute('aria-pressed', String(b === btn));
      });
      products.forEach(function (p) {
        p.hidden = cat !== 'all' && p.dataset.cat !== cat;
        if (!p.hidden) p.classList.add('is-in');
      });
    });
  });

  // Gallery slider: arrows, counter and progress bar
  document.querySelectorAll('[data-carousel]').forEach(function (car) {
    var track = car.querySelector('.gallery');
    var items = track.children;
    var prev = car.querySelector('[data-dir="-1"]');
    var next = car.querySelector('[data-dir="1"]');
    var count = car.querySelector('.carousel__count');
    var bar = car.querySelector('.carousel__bar');
    function step() {
      return items.length > 1 ? items[1].offsetLeft - items[0].offsetLeft : track.clientWidth;
    }
    function perViewCount() {
      var s = step(), gap = s - items[0].offsetWidth;
      return Math.max(1, Math.floor((track.clientWidth + gap) / s + 0.02));
    }
    function update() {
      var s = step(), total = items.length;
      var perView = perViewCount();
      var max = track.scrollWidth - track.clientWidth;
      var first = Math.min(total - perView, Math.round(track.scrollLeft / s));
      if (track.scrollLeft >= max - 2) first = total - perView;
      first = Math.max(0, first);
      var last = Math.min(total, first + perView);
      count.textContent = (perView > 1 ? (first + 1) + '–' + last : last) + ' / ' + total;
      bar.style.width = (Math.min(perView, total) / total * 100) + '%';
      bar.style.marginLeft = (first / total * 100) + '%';
      prev.disabled = track.scrollLeft <= 2;
      next.disabled = track.scrollLeft >= max - 2;
    }
    [prev, next].forEach(function (btn) {
      btn.addEventListener('click', function () {
        var s = step();
        var target = (Math.round(track.scrollLeft / s) + Number(btn.dataset.dir) * perViewCount()) * s;
        track.scrollTo({ left: target, behavior: 'smooth' });
      });
    });
    var raf = null;
    track.addEventListener('scroll', function () {
      if (raf) return;
      raf = requestAnimationFrame(function () { raf = null; update(); });
    }, { passive: true });
    window.addEventListener('resize', update);
    update();
  });

  // Video reels: load only near the viewport, autoplay muted while visible, play/pause + sound buttons
  var reels = document.querySelectorAll('.reel__video');
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function loadReel(v) {
    if (v.dataset.loaded) return;
    v.dataset.loaded = '1';
    v.poster = v.dataset.poster;
    v.querySelectorAll('source[data-src]').forEach(function (s) { s.src = s.dataset.src; });
    v.load();
  }
  function setPlayBtn(v) {
    var b = v.parentNode.querySelector('.reel__play');
    b.setAttribute('aria-pressed', String(v.paused));
    b.setAttribute('aria-label', v.paused ? 'Play video' : 'Pause video');
  }
  reels.forEach(function (v) {
    var frame = v.parentNode;
    if (reduceMotion) v.dataset.userPaused = '1';
    v.addEventListener('play', function () { setPlayBtn(v); });
    v.addEventListener('pause', function () { setPlayBtn(v); });
    frame.querySelector('.reel__play').addEventListener('click', function () {
      loadReel(v);
      if (v.paused) { v.dataset.userPaused = ''; v.play().catch(function () {}); }
      else { v.dataset.userPaused = '1'; v.pause(); }
    });
    frame.querySelector('.reel__sound').addEventListener('click', function () {
      var on = v.muted;
      reels.forEach(function (o) {
        o.muted = true;
        var b = o.parentNode.querySelector('.reel__sound');
        b.setAttribute('aria-pressed', 'false'); b.setAttribute('aria-label', 'Turn sound on');
      });
      if (on) {
        loadReel(v);
        v.muted = false; v.dataset.userPaused = '';
        if (v.paused) v.play().catch(function () {});
        this.setAttribute('aria-pressed', 'true'); this.setAttribute('aria-label', 'Turn sound off');
      }
    });
    setPlayBtn(v);
  });
  if (reels.length && 'IntersectionObserver' in window) {
    var near = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { loadReel(e.target); near.unobserve(e.target); } });
    }, { rootMargin: '300px 0px' });
    var vis = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting && !v.dataset.userPaused) { loadReel(v); v.play().catch(function () {}); }
        else if (!e.isIntersecting && !v.paused) v.pause();
      });
    }, { threshold: 0.5 });
    reels.forEach(function (v) { near.observe(v); vis.observe(v); });
  } else {
    reels.forEach(loadReel);
  }

  // Lightbox: gallery photos and product photos open full size
  var lb = document.getElementById('lightbox');
  if (lb && typeof lb.showModal === 'function') {
    var lbImg = lb.querySelector('.lightbox__img');
    var lbTitle = lb.querySelector('.lightbox__title');
    var lbCount = lb.querySelector('.lightbox__count');
    var group = [], index = 0, lastFocus = null;

    function fullSrc(img) {
      return img.closest('[data-full]') ? img.closest('[data-full]').dataset.full : img.getAttribute('src').replace(/\.jpg$/, '.webp');
    }
    function itemsFor(name) {
      if (name === 'gallery') {
        return Array.prototype.map.call(document.querySelectorAll('[data-lightbox="gallery"]'), function (el) {
          return { src: el.dataset.full, alt: el.querySelector('img').alt, caption: el.dataset.caption };
        });
      }
      return Array.prototype.filter.call(document.querySelectorAll('[data-lightbox-host]'), function (host) {
        return !host.closest('.product').hidden;
      }).map(function (host) {
        var img = host.querySelector('img');
        return { src: fullSrc(img), alt: img.alt, caption: host.closest('.product').querySelector('h3').textContent };
      });
    }
    function show(i) {
      index = (i + group.length) % group.length;
      var it = group[index];
      lbImg.classList.add('is-loading');
      lbImg.onload = function () { lbImg.classList.remove('is-loading'); };
      lbImg.src = it.src;
      lbImg.alt = it.alt;
      lbTitle.textContent = it.caption;
      lbCount.textContent = (index + 1) + ' / ' + group.length;
      var multi = group.length > 1;
      lb.querySelector('.lightbox__prev').hidden = !multi;
      lb.querySelector('.lightbox__next').hidden = !multi;
      [1, -1].forEach(function (d) { new Image().src = group[(index + d + group.length) % group.length].src; });
    }
    function open(name, src) {
      group = itemsFor(name);
      var i = group.findIndex(function (it) { return it.src === src; });
      lastFocus = document.activeElement;
      show(i < 0 ? 0 : i);
      document.documentElement.classList.add('lb-open');
      lb.showModal();
    }
    function close() { lb.close(); }
    lb.addEventListener('close', function () {
      document.documentElement.classList.remove('lb-open');
      lbImg.removeAttribute('src');
      if (lastFocus) lastFocus.focus();
    });

    document.querySelectorAll('[data-lightbox="gallery"]').forEach(function (el) {
      el.addEventListener('click', function () { open('gallery', el.dataset.full); });
    });
    document.querySelectorAll('[data-lightbox-host]').forEach(function (host) {
      var img = host.querySelector('img');
      img.setAttribute('tabindex', '0');
      img.setAttribute('role', 'button');
      img.setAttribute('aria-label', 'Open photo: ' + host.closest('.product').querySelector('h3').textContent);
      img.addEventListener('click', function () { open('shop', fullSrc(img)); });
      img.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open('shop', fullSrc(img)); }
      });
    });

    lb.addEventListener('click', function (e) {
      var action = e.target.closest('[data-lb]');
      if (action) {
        var a = action.dataset.lb;
        if (a === 'close') close(); else show(index + (a === 'next' ? 1 : -1));
      } else if (!e.target.closest('.lightbox__img, .lightbox__caption')) {
        close();
      }
    });
    lb.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') show(index + 1);
      if (e.key === 'ArrowLeft') show(index - 1);
    });
    var touchX = null;
    lb.addEventListener('touchstart', function (e) { touchX = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', function (e) {
      if (touchX === null) return;
      var dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 50 && group.length > 1) show(index + (dx < 0 ? 1 : -1));
      touchX = null;
    });
  }

  // Reveal on scroll
  var items = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    items.forEach(function (el) { el.classList.add('is-in'); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  items.forEach(function (el, i) {
    el.style.transitionDelay = (i % 3) * 90 + 'ms';
    io.observe(el);
  });
})();
