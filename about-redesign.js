/* Reveal + gentle bottle tilt for the redesigned About section */
(function(){
  var root=document.getElementById("about");if(!root)return;
  var els=[].slice.call(root.querySelectorAll("[data-ab]"));
  if(!("IntersectionObserver" in window)){els.forEach(function(e){e.classList.add("in")});}
  else{
    var io=new IntersectionObserver(function(es){es.forEach(function(x){if(x.isIntersecting){x.target.classList.add("in");io.unobserve(x.target)}})},{threshold:.15,rootMargin:"0px 0px -6% 0px"});
    els.forEach(function(e){io.observe(e)});
  }
  var hero=root.querySelector(".ab-hero"),b=root.querySelector(".ab-bottle");
  if(hero&&b&&window.matchMedia("(hover:hover)").matches){
    hero.addEventListener("mousemove",function(e){var r=hero.getBoundingClientRect();var x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;b.style.animation="none";b.style.transform="rotateY("+(x*14)+"deg) rotateX("+(-y*8)+"deg) translateY(-6px)"});
    hero.addEventListener("mouseleave",function(){b.style.transform="";b.style.animation=""});
  }
})();
