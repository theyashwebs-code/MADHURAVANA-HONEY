(function(){
  var t=document.getElementById("fq-track");if(!t)return;
  var prev=document.getElementById("fq-prev"),next=document.getElementById("fq-next"),bar=document.querySelector(".fq-prog i");
  function step(){var c=t.querySelector(".fq-card");return c?c.offsetWidth+24:320}
  function upd(){var max=t.scrollWidth-t.clientWidth,p=max>0?t.scrollLeft/max:0;
    if(bar){var w=Math.max(12,t.clientWidth/t.scrollWidth*100);bar.style.width=w+"%";bar.style.marginLeft=(p*(100-w))+"%"}
    if(prev)prev.disabled=t.scrollLeft<8;if(next)next.disabled=t.scrollLeft>max-8}
  prev&&prev.addEventListener("click",function(){t.scrollBy({left:-step()*1.5,behavior:"smooth"})});
  next&&next.addEventListener("click",function(){t.scrollBy({left:step()*1.5,behavior:"smooth"})});
  t.addEventListener("scroll",upd,{passive:true});window.addEventListener("resize",upd);upd();
  t.addEventListener("keydown",function(e){if(e.key==="ArrowRight")t.scrollBy({left:step(),behavior:"smooth"});if(e.key==="ArrowLeft")t.scrollBy({left:-step(),behavior:"smooth"})});
  /* mouse drag */
  var down=false,sx=0,sl=0,moved=false;
  t.addEventListener("pointerdown",function(e){if(e.pointerType!=="mouse")return;down=true;moved=false;sx=e.clientX;sl=t.scrollLeft});
  window.addEventListener("pointermove",function(e){if(!down)return;var d=e.clientX-sx;if(Math.abs(d)>4){moved=true;t.classList.add("drag")}t.scrollLeft=sl-d});
  window.addEventListener("pointerup",function(){if(!down)return;down=false;t.classList.remove("drag")});
})();
