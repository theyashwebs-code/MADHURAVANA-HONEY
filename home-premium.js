/* MADHURAVANA home — desktop-only cinematic extras. Does nothing on tablet/mobile. */
(function(){
  var mq=matchMedia('(min-width:1001px)');
  if(!mq.matches)return;
  var dots=[].slice.call(document.querySelectorAll('.mh-dots a'));
  var targets=['.mh-hero','#about','#gifts','#how','#faq'].map(function(s){return document.querySelector(s)});
  if('IntersectionObserver' in window){
    var io=new IntersectionObserver(function(es){es.forEach(function(e){
      if(e.isIntersecting){var i=targets.indexOf(e.target);dots.forEach(function(d,k){d.classList.toggle('on',k===i)})}
    })},{threshold:.45});
    targets.forEach(function(t){t&&io.observe(t)});
  }
  var hero=document.querySelector('.mh-hero');
  if(hero&&!matchMedia('(prefers-reduced-motion:reduce)').matches){
    hero.addEventListener('mousemove',function(e){
      var r=hero.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;
      hero.style.setProperty('--px',(x*18).toFixed(1)+'px');hero.style.setProperty('--py',(y*12).toFixed(1)+'px');
    });
    hero.addEventListener('mouseleave',function(){
      hero.style.setProperty('--px','0px');hero.style.setProperty('--py','0px');
    });
  }
})();
/* ===== Side dots: reliable scroll-spy + click ===== */
(function () {
  var dots = document.querySelectorAll('.mh-dots a');
  if (!dots.length) return;

  var items = Array.prototype.map.call(dots, function (a) {
    var id = a.getAttribute('href');
    var el = id === '#top' ? document.querySelector('.mh-hero') : document.querySelector(id);
    return { a: a, el: el };
  }).filter(function (x) { return x.el; });

  function setActive() {
    var line = window.innerHeight * 0.4;
    var current = items[0];
    items.forEach(function (x) {
      if (x.el.getBoundingClientRect().top <= line) current = x;
    });
    dots.forEach(function (d) { d.classList.toggle('on', d === current.a); });
  }

  window.addEventListener('scroll', setActive, { passive: true });
  window.addEventListener('resize', setActive);
  setActive();

  items.forEach(function (x) {
    x.a.addEventListener('click', function (e) {
      e.preventDefault();
      if (window.lenis && window.lenis.scrollTo) {
        window.lenis.scrollTo(x.el, { offset: -70 });
      } else {
        x.el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
})();
