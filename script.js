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
