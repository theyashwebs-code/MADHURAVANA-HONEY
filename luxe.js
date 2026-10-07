/* MADHURAVANA luxe layer: Lenis smooth scroll + parallax + staggered reveals + magnetic buttons */
(function(){
  var d=document,root=d.documentElement,reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
  root.classList.add('lx');
  var bar=d.createElement('div');bar.className='lx-bar';d.body.appendChild(bar);
  var kids=d.querySelectorAll('.mh-hero-copy>*');[].forEach.call(kids,function(k,i){k.style.setProperty('--i',i)});
  addEventListener('load',function(){setTimeout(function(){root.classList.add('lx-go')},80)});
  setTimeout(function(){root.classList.add('lx-go')},1800);

  /* reveals */
  var groups=['.mh-golden-copy>*','.mh-features article','.mh-golden-product','.mh-ritual-copy>*','.mh-section-head>*','.mh-how-grid>div>*','.mh-how li','.mh-faq .faq-grid>div:first-child>*','.faq-list details'];
  var io='IntersectionObserver' in window?new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{threshold:.15,rootMargin:'0px 0px -6% 0px'}):null;
  function mark(el,i){if(el.classList.contains('lx-r'))return;el.classList.add('lx-r');el.style.setProperty('--i',i);io?io.observe(el):el.classList.add('in')}
  groups.forEach(function(g){[].forEach.call(d.querySelectorAll(g),mark)});
  var grid=d.getElementById('featured-products');
  if(grid){var sweep=function(){[].forEach.call(grid.children,mark)};sweep();new MutationObserver(sweep).observe(grid,{childList:true})}

  /* scroll loop: progress + parallax */
  var copy=d.querySelector('.mh-hero-copy'),scene=d.querySelector('.mh-scene'),rit=d.querySelector('.mh-ritual'),photo=d.querySelector('.mh-ritual-photo');
  function tick(){
    var y=scrollY,h=Math.max(1,root.scrollHeight-innerHeight);
    root.style.setProperty('--lx-p',Math.min(1,y/h).toFixed(4));
    if(reduce)return;
    if(y<innerHeight*1.2){
      if(copy&&matchMedia('(min-width:1001px)').matches){copy.style.transform='translate3d(0,'+(y*.16).toFixed(1)+'px,0)';copy.style.opacity=Math.max(0,1-y/(innerHeight*.9)).toFixed(3)}
      if(scene)scene.style.transform='translate3d(0,'+(y*.08).toFixed(1)+'px,0)';
    }
    if(rit&&photo){var r=rit.getBoundingClientRect();if(r.bottom>0&&r.top<innerHeight){var p=(r.top+r.height/2-innerHeight/2)/innerHeight;rit.style.setProperty('--ry',(p*-90).toFixed(1)+'px');rit.style.setProperty('--rs',(1.08+Math.abs(p)*.05).toFixed(3))}}
  }
  addEventListener('scroll',tick,{passive:true});tick();

  /* smooth scroll */
  if(window.Lenis&&!reduce){
    var L=new Lenis({duration:1.25,easing:function(t){return Math.min(1,1.001-Math.pow(2,-10*t))},smoothWheel:true});
    (function raf(t){L.raf(t);requestAnimationFrame(raf)})(0);
    d.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href^="#"]');if(!a)return;var id=a.getAttribute('href');if(id.length<2)return;var t=d.querySelector(id);if(!t)return;e.preventDefault();L.scrollTo(t,{offset:-72,duration:1.6})});
  }

  /* magnetic buttons (mouse only) */
  if(!reduce&&matchMedia('(pointer:fine)').matches){
    d.addEventListener('mousemove',function(e){
      var b=e.target.closest&&e.target.closest('.mh-btn');if(!b)return;
      var r=b.getBoundingClientRect();b.style.transform='translate('+((e.clientX-r.left-r.width/2)*.18).toFixed(1)+'px,'+((e.clientY-r.top-r.height/2)*.28-3).toFixed(1)+'px)';
    });
    d.addEventListener('mouseout',function(e){var b=e.target.closest&&e.target.closest('.mh-btn');if(b)b.style.transform=''});
  }
})();
