/* MADHURAVANA home — desktop-only cinematic extras. Does nothing on tablet/mobile. */
(function(){
  var mq=matchMedia('(min-width:1001px)');
  if(!mq.matches)return;
  var dots=[].slice.call(document.querySelectorAll('.mh-dots a'));
  var targets=['.mh-hero','#about','#collection','#how'].map(function(s){return document.querySelector(s)});
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
  }
})();
