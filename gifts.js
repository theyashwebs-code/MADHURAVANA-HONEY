/* MADHURAVANA gifts page: browse sets/occasions, pick jars, write a card, add everything to the normal cart.
   Uses the live product list (getProducts) so sizes and prices always match the shop/admin. */
(function () {
  if (document.body.dataset.page !== "gifts") return;
  document.documentElement.classList.add("gf-js");

  var MAX_QTY = 100;
  var MIN_QTY = 5;
  var OCCASIONS = [
    { id: "Birthday", icon: "🎂", msg: "Happy birthday! Here’s a little golden sweetness for the year ahead." },
    { id: "Wedding", icon: "💍", msg: "Wishing you both a lifetime as sweet as this. Congratulations!" },
    { id: "Housewarming", icon: "🏡", msg: "Wishing your new home warmth, health and plenty of good mornings." },
    { id: "Festival", icon: "🪔", msg: "Wishing you and your family a bright, healthy and joyful festival." },
    { id: "Thank you", icon: "🙏", msg: "Thank you for everything. This one is pure, just like your kindness." },
    { id: "Get well soon", icon: "💛", msg: "Get well soon. A spoonful of raw honey, with all my love." },
    { id: "Just because", icon: "✨", msg: "No reason at all, except that you matter to me." }
  ];

  var $ = function (id) { return document.getElementById(id); };
  var state = { qty: {}, occasion: "", to: "", from: "", msg: "", autoMsg: "", set: "" };
  var products = [];

  function loadProducts() {
    return getProducts().filter(function (p) { return p.inStock; })
      .sort(function (a, b) { return a.price - b.price; });
  }
  function sig(list) { return list.map(function (p) { return p.id + ":" + p.price + ":" + p.weight; }).join("|"); }
  function priceOf(id) { var p = products.filter(function (x) { return x.id === id; })[0]; return p ? p.price : 0; }
  function weightOf(id) { var p = products.filter(function (x) { return x.id === id; })[0]; return p ? p.weight : ""; }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function jarImg(h) { var i = new Image(); i.src = "images/madhuravana-front-bottle.png"; i.alt = ""; i.loading = "lazy"; i.style.height = h + "px"; return i; }
  function goTo(id) {
    var t = $(id); if (!t) return;
    var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    t.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }

  /* ---------- gift sets ---------- */
  function makeSets() {
    var n = products.length, sets = [];
    if (!n) return sets;
    sets.push({ id: "small", name: "A small gesture", desc: "A thoughtful jar and a note. Perfect for a thank-you.", art: [150], items: [[products[0].id, MIN_QTY]] });
    if (n > 1) sets.push({ id: "big", name: "Something generous", desc: "Our largest jar, for someone you really want to look after.", art: [215], items: [[products[n - 1].id, MIN_QTY]], ribbon: "Most loved" });
    if (n > 2) sets.push({ id: "all", name: "The full hamper", desc: "One of every size we offer, for a family or a big occasion.", art: [105, 140, 175], items: products.map(function (p) { return [p.id, MIN_QTY]; }) });
    sets.forEach(function (s) { s.total = s.items.reduce(function (t, it) { return t + priceOf(it[0]) * it[1]; }, 0); });
    return sets;
  }
  function renderSets() {
    var box = $("gf-showcase"); box.innerHTML = "";
    makeSets().forEach(function (s) {
      var card = el("article", "gf-set" + (state.set === s.id ? " is-on" : ""));
      if (s.ribbon) card.appendChild(el("span", "gf-ribbon", s.ribbon));
      var art = el("div", "gf-set-art"); s.art.forEach(function (h) { art.appendChild(jarImg(h)); });
      var body = el("div", "gf-set-body");
      body.appendChild(el("h3", "", s.name)); body.appendChild(el("p", "", s.desc));
      var inc = el("ul", "gf-set-inc");
      s.items.forEach(function (it) { inc.appendChild(el("li", "", it[1] + " × " + weightOf(it[0]) + " jar")); });
      inc.appendChild(el("li", "", "Your personal card message"));
      body.appendChild(inc);
      var foot = el("div", "gf-set-foot"); foot.appendChild(el("strong", "", money(s.total)));
      var b = el("button", "gf-btn", state.set === s.id ? "Selected" : "Choose this set"); b.type = "button";
      b.addEventListener("click", function () {
        state.qty = {}; s.items.forEach(function (it) { state.qty[it[0]] = it[1]; });
        state.set = s.id; renderAll(); goTo("build");
      });
      foot.appendChild(b); body.appendChild(foot);
      card.appendChild(art); card.appendChild(body); box.appendChild(card);
    });
    if (!box.children.length) box.appendChild(el("p", "gf-hint", "Our jars are restocking. Please check back soon, or message us on WhatsApp."));
  }

  /* ---------- jar cards ---------- */
  function hOf(w) {
    var m = String(w || "").toLowerCase().match(/(\d+(?:\.\d+)?)\s*(kg|g)\b/); if (!m) return 60;
    var g = parseFloat(m[1]) * (m[2] === "kg" ? 1000 : 1);
    return Math.round(84 * Math.max(.45, Math.min(1, .45 + .55 * Math.log(g / 100) / Math.LN10)));
  }
  function renderJars() {
    var box = $("gf-jars"); box.innerHTML = "";
    if (!products.length) { box.appendChild(el("p", "gf-hint", "Our jars are restocking. Please check back soon, or message us on WhatsApp.")); return; }
    products.forEach(function (p) {
      var q = state.qty[p.id] || 0;
      var row = el("div", "gf-jar" + (q > 0 ? " has-qty" : ""));
      var imgBox = el("div", "gf-jar-img"); var img = jarImg(hOf(p.weight));
      img.alt = "MADHURAVANA Pure Honey " + p.weight; imgBox.appendChild(img);
      var info = el("div", "gf-jar-info"); info.appendChild(el("b", "", p.weight)); info.appendChild(el("span", "", money(p.price) + " per jar"));
      var qty = el("div", "gf-qty");
      var minus = el("button", "", "−"); minus.type = "button"; minus.setAttribute("aria-label", "Fewer " + p.weight + " jars"); minus.disabled = q <= 0;
      var out = el("input", "gf-qty-in"); out.type = "text"; out.inputMode = "numeric"; out.maxLength = 3; out.value = String(q);
      out.setAttribute("aria-label", p.weight + " quantity");
      out.addEventListener("change", function () { var n = parseInt(out.value.replace(/\D/g, ""), 10); setQty(p.id, isNaN(n) ? 0 : n); });
      out.addEventListener("keydown", function (e) { if (e.key === "Enter") out.blur(); });
      var plus = el("button", "", "+"); plus.type = "button"; plus.setAttribute("aria-label", "More " + p.weight + " jars"); plus.disabled = q >= MAX_QTY;
      minus.addEventListener("click", function () { setQty(p.id, q <= MIN_QTY ? 0 : q - 1); });
      plus.addEventListener("click", function () { setQty(p.id, q < MIN_QTY ? MIN_QTY : q + 1); });
      qty.appendChild(minus); qty.appendChild(out); qty.appendChild(plus);
      row.appendChild(imgBox); row.appendChild(info); row.appendChild(qty); box.appendChild(row);
    });
  }
  function setQty(id, n) {
    n = n <= 0 ? 0 : Math.max(MIN_QTY, Math.min(MAX_QTY, n));
    state.qty[id] = n; state.set = ""; renderAll();
  }

  /* ---------- occasions ---------- */
  function pickOccasion(o) {
    var pristine = !state.msg || state.msg === state.autoMsg;
    state.occasion = o.id; state.autoMsg = o.msg;
    if (pristine) { state.msg = o.msg; $("gf-msg").value = o.msg; }
    renderChips(); renderOcc(); renderCard();
  }
  function renderOcc() {
    var box = $("gf-occ"); if (!box) return; box.innerHTML = "";
    OCCASIONS.forEach(function (o) {
      var b = el("button", "gf-occ-card"); b.type = "button"; b.setAttribute("aria-pressed", String(state.occasion === o.id));
      b.appendChild(el("span", "", o.icon)); b.appendChild(document.createTextNode(o.id));
      b.addEventListener("click", function () { pickOccasion(o); goTo("card-step"); });
      box.appendChild(b);
    });
  }
  function renderChips() {
    var box = $("gf-chips"); box.innerHTML = "";
    OCCASIONS.forEach(function (o) {
      var b = el("button", "gf-chip", o.id); b.type = "button"; b.setAttribute("aria-pressed", String(state.occasion === o.id));
      b.addEventListener("click", function () { pickOccasion(o); });
      box.appendChild(b);
    });
  }

  /* ---------- card + summary + mobile bar ---------- */
  function renderCard() {
    $("gf-card-to").textContent = state.to ? "For " + state.to : "For someone special";
    var m = $("gf-card-msg");
    m.textContent = state.msg || "Your message will appear here."; m.classList.toggle("ph", !state.msg);
    $("gf-card-from").textContent = state.from ? "— " + state.from : "";
    $("gf-count").textContent = String(state.msg.length);
  }
  function chosen() {
    return products.filter(function (p) { return (state.qty[p.id] || 0) > 0; })
      .map(function (p) { return { p: p, q: state.qty[p.id] }; });
  }
  function renderSummary() {
    var lines = $("gf-lines"); lines.innerHTML = "";
    var list = chosen(), total = 0, count = 0;
    if (!list.length) lines.appendChild(el("p", "gf-empty", "No jars chosen yet."));
    list.forEach(function (c) {
      var l = el("div", "gf-line"); l.appendChild(el("span", "", c.p.weight + " × " + c.q));
      l.appendChild(el("span", "", money(c.p.price * c.q))); lines.appendChild(l); total += c.p.price * c.q; count += c.q;
    });
    $("gf-total").textContent = money(total);
    $("gf-add").disabled = !list.length;
    var bar = $("gf-bar");
    bar.hidden = !list.length; document.body.classList.toggle("has-bar", !!list.length);
    $("gf-bar-total").textContent = money(total);
    $("gf-bar-count").textContent = count + (count === 1 ? " jar" : " jars");
  }
  function renderAll() {
    var setsBox = $("gf-showcase"), jarsBox = $("gf-jars");
    var setsX = setsBox.scrollLeft, jarsX = jarsBox.scrollLeft;
    renderSets(); renderJars(); renderSummary(); renderCard();
    setsBox.scrollLeft = setsX; jarsBox.scrollLeft = jarsX;
  }

  /* ---------- add to cart ---------- */
  function addToCartAndGo() {
    var list = chosen(); if (!list.length) return;
    var cart = getCart();
    list.forEach(function (c) {
      var it = cart.filter(function (x) { return x.id === c.p.id && x.gift; })[0];
      if (it) it.quantity += c.q; else cart.push({ id: c.p.id, quantity: c.q, gift: true });
    });
    saveCart(cart);
    var note = { fromGift: true, occasion: state.occasion, to: state.to.trim(), from: state.from.trim(), message: state.msg.trim(), savedAt: Date.now() };
    try {
      if (note.to || note.from || note.message) localStorage.setItem(GIFT_NOTE_KEY, JSON.stringify(note));
      else localStorage.removeItem(GIFT_NOTE_KEY);
    } catch (e) {}
    updateCartCount();
    location.href = "cart.html";
  }
  function restoreNote() {
    var n = getGiftNote(); if (!n) return;
    state.occasion = n.occasion || ""; state.to = n.to || ""; state.from = n.from || ""; state.msg = n.message || "";
    $("gf-to").value = state.to; $("gf-from").value = state.from; $("gf-msg").value = state.msg;
  }

  /* ---------- scroll reveal ---------- */
  function setupReveal() {
    if (!("IntersectionObserver" in window)) return;
    var targets = document.querySelectorAll(".gf-head,.gf-occ-card,.gf-set,.gf-why-photo,.gf-why-copy,.gf-steps-list li,.gf-step,.gf-side>*,.gf-bulk-copy,.gf-faq details");
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add("in"); io.unobserve(x.target); } });
    }, { threshold: .1 });
    targets.forEach(function (t) { t.classList.add("gf-rv"); io.observe(t); });
    /* safety: never leave anything hidden */
    setTimeout(function () { document.querySelectorAll(".gf-rv").forEach(function (t) { t.classList.add("in"); }); }, 4500);
  }

  function init() {
    products = loadProducts();
    restoreNote();
    if (products.length && !Object.keys(state.qty).length) state.qty[products[0].id] = MIN_QTY;
    $("gf-to").addEventListener("input", function (e) { state.to = e.target.value; renderCard(); });
    $("gf-from").addEventListener("input", function (e) { state.from = e.target.value; renderCard(); });
    $("gf-msg").addEventListener("input", function (e) { state.msg = e.target.value; renderCard(); });
    $("gf-add").addEventListener("click", addToCartAndGo);
    $("gf-bar-add").addEventListener("click", function () {
      /* on phones, make sure they have seen the card step before checking out */
      if (!state.to && !state.msg) { goTo("card-step"); } else addToCartAndGo();
    });
    renderOcc(); renderChips(); renderAll(); setupReveal();

    /* product list can be refreshed from the cloud a moment after load: re-draw if it changed */
    var last = sig(products), tries = 0;
    var t = setInterval(function () {
      var next = loadProducts();
      if (sig(next) !== last) {
        last = sig(next); products = next;
        Object.keys(state.qty).forEach(function (id) { if (!products.some(function (p) { return p.id === id; })) delete state.qty[id]; });
        renderAll();
      }
      if (++tries > 8) clearInterval(t);
    }, 1500);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
