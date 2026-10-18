/* MADHURAVANA — site-wide buttery smooth scroll (Lenis) */
(function () {
  if (window.__mhSmooth) return;
  window.__mhSmooth = true;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isAdmin = (document.body && document.body.dataset.page === 'admin') || /admin/i.test(location.pathname);
  if (reduce || isAdmin || typeof Lenis === 'undefined') return;

  var lenis = new Lenis({
    lerp: 0.085,            // lower = silkier / slower glide (0.06–0.12)
    wheelMultiplier: 0.95,
    smoothWheel: true,
    touchMultiplier: 1.4
  });
  window.lenis = lenis;

  function raf(t) { lenis.raf(t); requestAnimationFrame(raf); }
  requestAnimationFrame(raf);

  /* Anchor links (#about, #gifts, index.html#faq ...) glide too */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href*="#"]');
    if (!a) return;
    var url;
    try { url = new URL(a.href, location.href); } catch (_) { return; }
    if (url.pathname !== location.pathname || !url.hash || url.hash === '#') return;
    var target = document.querySelector(url.hash);
    if (!target) return;
    e.preventDefault();
    lenis.scrollTo(target, { offset: -80, duration: 1.4 });
    history.pushState(null, '', url.hash);
  });

  /* Pause smooth scroll while a modal is open (body gets .no-scroll) */
  new MutationObserver(function () {
    if (document.body.classList.contains('no-scroll')) lenis.stop(); else lenis.start();
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  /* Page height changes (products load, header injected, FAQ cards) */
  function resize() { if (lenis.resize) lenis.resize(); }
  window.addEventListener('load', resize);
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(document.body);

  /* Pause hero animations once the hero is off-screen (saves GPU) */
  var hero = document.querySelector('.mh-hero');
  if (hero && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (en) {
      hero.classList.toggle('is-off', !en[0].isIntersecting);
    }, { threshold: 0 }).observe(hero);
  }
})();
/* keep --rib-h equal to the real marquee height */
(function(){
  var rib = document.querySelector('.lx-ribbon');
  if(!rib) return;
  function setH(){
    document.documentElement.style.setProperty('--rib-h', rib.offsetHeight + 'px');
  }
  setH();
  window.addEventListener('resize', setH);
  window.addEventListener('load', setH);
  if('ResizeObserver' in window) new ResizeObserver(setH).observe(rib);
})();
