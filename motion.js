/* MADHURAVANA motion — intentionally light: normal page scrolling + subtle reveals only. */
(function () {
  function init() {
    var $ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

    /* Split headings into words for a gentle reveal, without scroll-driven choreography. */
    $("[data-words]").forEach(function (el) {
      var step = Number(el.dataset.words) || 38, i = 0;
      (function walk(n) {
        Array.prototype.slice.call(n.childNodes).forEach(function (c) {
          if (c.nodeType === 3) {
            var f = document.createDocumentFragment();
            c.textContent.split(/(\s+)/).forEach(function (t) {
              if (!t) return;
              if (/^\s+$/.test(t)) return f.appendChild(document.createTextNode(" "));
              var s = document.createElement("span");
              s.className = "w"; s.style.setProperty("--wd", i++ * step + "ms"); s.textContent = t; f.appendChild(s);
            });
            n.replaceChild(f, c);
          } else if (c.nodeType === 1 && c.tagName !== "BR") walk(c);
        });
      })(el);
    });

    var home = document.body.dataset.page === "home";
    var h = document.querySelector(".site-header");
    if (h) h.classList.toggle("is-solid", !home || scrollY > 30);
    addEventListener("scroll", function(){ if(h) h.classList.toggle("is-solid", !home || scrollY > 30); }, {passive:true});

    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
      if (matchMedia("(pointer:fine)").matches) {
        var cur = document.createElement("span");
        cur.className = "mv-cursor";
        document.body.appendChild(cur);
        addEventListener("pointermove", function(e){ cur.style.left=e.clientX+"px"; cur.style.top=e.clientY+"px"; }, {passive:true});
        document.querySelectorAll("a,button,summary,select,input").forEach(function(el){
          el.addEventListener("mouseenter",function(){cur.classList.add("is-link")});
          el.addEventListener("mouseleave",function(){cur.classList.remove("is-link")});
        });
      }
    }

    /* Fit the large wordmark safely. */
    var fit = $("[data-fit]");
    function doFit() {
      fit.forEach(function (el) {
        el.style.removeProperty("font-size");
        var avail = el.parentNode.clientWidth - (parseFloat(getComputedStyle(el.parentNode).paddingLeft) || 0) - (parseFloat(getComputedStyle(el.parentNode).paddingRight) || 0);
        var probe = document.createElement("span");
        probe.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap;font:inherit;letter-spacing:inherit;text-transform:inherit";
        probe.textContent = el.textContent; el.appendChild(probe);
        var need = probe.getBoundingClientRect().width; el.removeChild(probe);
        var fs = parseFloat(getComputedStyle(el).fontSize);
        if (need > avail && need > 0) el.style.setProperty("font-size", (fs * avail / need * .985) + "px", "important");
      });
    }
    if (fit.length) { doFit(); addEventListener("resize", doFit); if (document.fonts && document.fonts.ready) document.fonts.ready.then(doFit); }

    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("on"); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: "0px 0px -4% 0px" });
    function watch(scope) {
      (scope.querySelectorAll ? scope.querySelectorAll(".w:not(.on),[data-rev]:not(.on)") : []).forEach(function (n) { io.observe(n); });
      if (scope.matches && scope.matches("[data-rev]")) io.observe(scope);
    }
    watch(document);
    ["featured-products", "shop-products"].forEach(function (id) {
      var box = document.getElementById(id);
      if (box) new MutationObserver(function (ms) {
        ms.forEach(function (m) { m.addedNodes.forEach(function (n) { if (n.nodeType === 1) watch(n); }); });
      }).observe(box, { childList: true });
    });

    /* Keep the small hover interaction; no scroll hijacking. */
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches && matchMedia("(pointer:fine)").matches) {
      document.addEventListener("pointermove", function (e) {
        var c = e.target.closest && e.target.closest(".product-card");
        document.querySelectorAll(".product-card.tilt").forEach(function (x) { if (x !== c) { x.classList.remove("tilt"); x.style.transform = ""; } });
        if (!c) return;
        var r = c.getBoundingClientRect(), px = (e.clientX - r.left) / r.width - .5, py = (e.clientY - r.top) / r.height - .5;
        c.classList.add("tilt");
        c.style.setProperty("transform", "translateY(-3px) perspective(900px) rotateX(" + (-py * 2).toFixed(2) + "deg) rotateY(" + (px * 3).toFixed(2) + "deg)", "important");
      }, { passive: true });
    }

    if (document.body.dataset.page === "success" && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      var cols = ["#e8a317", "#ffd978", "#f6c453", "#b97a0c", "#fff1b8"];
      for (var i = 0; i < 30; i++) {
        var d = document.createElement("i"); d.className = "wow-confetti"; d.style.left = Math.random()*100+"vw"; d.style.background=cols[i%cols.length];
        d.style.setProperty("--dx",(Math.random()*160-80)+"px"); d.style.animationDuration=(2.4+Math.random()*2)+"s"; d.style.animationDelay=(Math.random()*1)+"s";
        document.body.appendChild(d); setTimeout((function(n){return function(){n.remove()}})(d),6000);
      }
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
