/* MADHURAVANA admin console.



   Admin console UI for MADHURAVANA. Supabase Auth + admin verification protect cloud access; localStorage is only browser cache/UI state. */



(function () {



  "use strict";







  var FRESH_KEY = "madhuravana_admin_fresh_start_v2";



  var SESSION_MS = 12 * 60 * 60 * 1000;



  var STATUSES = ["Order Placed", "Processing", "Shipped", "Out for Delivery", "Delivered", "Cancelled"];



  var VIEWS = [



    ["dashboard", "Dashboard"], ["online", "Online Orders"], ["offline", "Offline Orders"],



    ["products", "Products / Stock"], ["customers", "Customers"], ["settings", "Settings"]



  ];



  var IS_ADMIN_PAGE = document.body && document.body.dataset.page === "admin";







  if (!localStorage.getItem(FRESH_KEY)) { try { localStorage.setItem(FRESH_KEY, "1"); } catch (e) {} }







  /* ---------------- public pages: just route to admin.html ---------------- */



  if (!IS_ADMIN_PAGE) {



    window.addEventListener("open-admin-login", function () { location.href = "admin.html"; });



    if (location.hash === "#admin") location.replace("admin.html");



    window.addEventListener("hashchange", function () { if (location.hash === "#admin") location.href = "admin.html"; });



    return;



  }







  /* ---------------- helpers ---------------- */



  var $ = function (s, r) { return (r || document).querySelector(s); };



  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };



  var ui = {



    view: "dashboard",



    filters: { online: { q: "", status: "All" }, offline: { q: "", status: "All" } },



    panelOpen: { online: false, offline: false },



    custQ: "", prodBusy: {}



  };



  function statusClass(s) { return String(s || "").toLowerCase().replace(/\s+/g, "-"); }



  function onlyDigits(s) { return String(s || "").replace(/\D/g, ""); }



  function last10(s) { var d = onlyDigits(s); return d.length > 10 ? d.slice(-10) : d; }



  function debounce(fn, ms) { var t; return function () { var a = arguments, c = this; clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, ms); }; }



  function toast(m, t) { if (typeof showToast === "function") showToast(m, t || ""); }



  function ordersOf(type) { return type === "online" ? getOnlineOrders() : getOfflineOrders(); }



  function saveOrdersOf(type, list) { return type === "online" ? saveOnlineOrders(list) : saveOfflineOrders(list); }



  function allOrders() {



    return getOnlineOrders().concat(getOfflineOrders()).sort(function (a, b) {



      return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));



    });



  }



  function findOrder(id) {



    var types = ["online", "offline"];



    for (var i = 0; i < types.length; i++) {



      var list = ordersOf(types[i]), idx = list.findIndex(function (o) { return o.id === id; });



      if (idx >= 0) return { type: types[i], list: list, idx: idx, order: list[idx] };



    }



    return null;



  }



  function safeProducts(o) { return Array.isArray(o.products) ? o.products : []; }



  function addr(o) { var a = o.address || {}; return [a.street, a.city, a.state].filter(Boolean).join(", ") + (a.pincode ? " - " + a.pincode : ""); }



  function waLink(phone) { var p = last10(phone); return p.length === 10 ? "https\://wa.me/91" + p : ""; }



  function liveValue(o) { return o.status === "Cancelled" ? 0 : Number(o.total || 0); }







  /* ---------------- auth ---------------- */

  /*

     SECURITY MODEL

     - Supabase Auth is the ONLY admin login when the admin console is used.

     - The user's Supabase account must also pass sb.isAdmin().

     - localStorage is used only for UI state/cache; it is NEVER an auth source.

     - If Supabase is missing or not configured, the admin console fails closed.

     - Database security must still be enforced by Supabase RLS policies.

  */

  async function checkLogin(u, p) {

    var sb = window.MADHURAVANA_SUPABASE;

    if (!sb || typeof sb.isConfigured !== "function" || !sb.isConfigured()) return false;

    if (typeof sb.signIn !== "function" || typeof sb.isAdmin !== "function") return false;



    var r = await sb.signIn(u, p);

    if (!r || r.error) return false;



    var admin = await sb.isAdmin();

    if (!admin) {

      try { if (typeof sb.signOut === "function") await sb.signOut(); } catch (e) {}

      return { ok: false, reason: "not-admin" };

    }



    if (typeof sb.ensureDeviceAccess === "function") {

      var device = await sb.ensureDeviceAccess();

      if (!device || !device.ok) {

        return { ok: false, reason: device && device.bootstrap ? "initial-device-authorization-required" : "device-authorization-required", device: device };

      }

    }



    return { ok: true };

  }



  /* This is only a local UI marker. It is never trusted for cloud authorization. */

  function markUiSession() {

    try { safeSave(KEYS.session, { loggedIn: true, at: Date.now() }); } catch (e) {}

  }



  function clearUiSession() {

    try { localStorage.removeItem(KEYS.session); } catch (e) {}

  }



  function isUiSession() {

    var s = safeParse(KEYS.session, null);

    return !!(s && s.loggedIn && Date.now() - (s.at || 0) < SESSION_MS);

  }



  async function logout() {

    try {

      var sb = window.MADHURAVANA_SUPABASE;

      if (sb && typeof sb.isConfigured === "function" && sb.isConfigured() && typeof sb.signOut === "function") await sb.signOut();

    } catch (e) {

      console.error("Admin logout failed:", e);

    }

    clearUiSession();

    closeModal();

    renderLogin();

  }



  /* ---------------- modal system ---------------- */



  var escHandler = null;



  function closeModal() {



    var r = $("#modal-root"); if (r) r.innerHTML = "";



    document.body.classList.remove("no-scroll");



    if (escHandler) { document.removeEventListener("keydown", escHandler); escHandler = null; }



  }



  function openModal(html, opts) {



    opts = opts || {};



    var r = $("#modal-root"); if (!r) return null;



    closeModal();



    r.innerHTML = '\<div class="ax-backdrop" id="ax-backdrop">\<div class="ax-modal ' + (opts.cls || "") + '" role="dialog" aria-modal="true">' + html + "\</div>\</div>";



    document.body.classList.add("no-scroll");



    var bd = $("#ax-backdrop");



    bd.addEventListener("mousedown", function (e) { if (e.target === bd) closeModal(); });



    $$(".ax-x,[data-close]", bd).forEach(function (b) { b.addEventListener("click", closeModal); });



    escHandler = function (e) { if (e.key === "Escape") closeModal(); };



    document.addEventListener("keydown", escHandler);



    var f = $("input,select,textarea", bd); if (f && opts.focus !== false) setTimeout(function () { try { f.focus({ preventScroll: true }); } catch (e) {} }, 60);



    return bd;



  }



  function askConfirm(o) {



    return new Promise(function (resolve) {



      var bd = openModal('\<div class="ax-mhead">\<div>\<span class="ax-eyebrow">Please confirm\</span>\<h2>' + esc(o.title) + '\</h2>\</div>\<button class="ax-x" aria-label="Close">×\</button>\</div>\<p style="color:#6b5e55;font-size:.9rem;margin:0 0 6px">' + esc(o.text || "") + '\</p>\<div class="ax-mactions">\<button class="ax-btn ' + (o.danger ? "solid-danger" : "") + '" id="ax-yes">' + esc(o.ok || "Confirm") + '\</button>\<button class="ax-btn ghost" data-close>Cancel\</button>\</div>', { cls: "ax-confirm", focus: false });



      var done = false;



      $("#ax-yes", bd).addEventListener("click", function () { done = true; closeModal(); resolve(true); });



      var obs = new MutationObserver(function () { if (!document.body.contains(bd)) { obs.disconnect(); if (!done) resolve(false); } });



      obs.observe($("#modal-root"), { childList: true });



    });



  }







  /* ---------------- login screen ---------------- */



  var fails = 0, lockUntil = 0, storageBound = false;



  function renderLogin() {



    var root = $("#ax-root");



    root.innerHTML = '\<div class="ax-login">\<form class="ax-login-card" id="ax-login" autocomplete="on">\<div class="ax-brand">MADHURAVANA\<small>BUSINESS ADMIN\</small>\</div>\<h1>Welcome back\</h1>\<p>Sign in to manage orders, stock and customers.\</p>' +



      '\<label class="ax-field">Admin email\<input name="username" type="email" autocomplete="username" autocapitalize="none" required>\</label>' +



      '\<label class="ax-field">Password\<input name="password" type="password" autocomplete="current-password" required>\</label>' +



      '\<button class="ax-btn gold block" type="submit" id="ax-login-btn">Login\</button>' +



      '\<p class="ax-muted" style="margin:16px 0 0;text-align:center">\<a href="index.html" style="text-decoration:underline">← Back to website\</a>\</p>\</form>\</div>';



    var form = $("#ax-login");



    $("input", form).focus();



    form.addEventListener("submit", function (e) {



      e.preventDefault();



      var now = Date.now();



      if (now < lockUntil) { toast("Too many attempts. Try again in " + Math.ceil((lockUntil - now) / 1000) + "s.", "warn"); return; }



      var d = Object.fromEntries(new FormData(form));



      var btn = $("#ax-login-btn"); btn.disabled = true; btn.textContent = "Signing in…";



      checkLogin(String(d.username).trim(), String(d.password)).then(function (result) {



        if (result && result.ok) {



          fails = 0; markUiSession();



          if(window.MADHURAVANA_SUPABASE&&window.MADHURAVANA_SUPABASE.isConfigured()) window.MADHURAVANA_SUPABASE.subscribe();



          renderConsole();



          if(window.MADHURAVANA_SUPABASE&&window.MADHURAVANA_SUPABASE.pullOrders) window.MADHURAVANA_SUPABASE.pullOrders();



        } else if (result && result.reason === "initial-device-authorization-required") {

          fails = 0;

          renderBootstrapDeviceGate();

        } else if (result && result.reason === "device-authorization-required") {



          fails = 0;

          renderDeviceGate();



        } else {



          fails++; if (fails >= 5) { lockUntil = Date.now() + 30000; fails = 0; }



          btn.disabled = false; btn.textContent = "Login"; toast(result && result.reason === "not-admin" ? "This account is not an authorized admin." : "Invalid admin email or password.", "warn");



          var p = $('input[name="password"]', form); p.value = ""; p.focus();



        }



      }).catch(function(err){



        btn.disabled=false; btn.textContent="Login";



        toast("Could not connect to Supabase. Check your configuration.","warn");



        console.error(err);



      });



    });



  }







  /* ---------------- first-device bootstrap gate ---------------- */

  function renderBootstrapDeviceGate() {

    var root = $("#ax-root");

    root.innerHTML = '<div class="ax-login"><div class="ax-login-card">' +
      '<div class="ax-brand">MADHURAVANA<small>BUSINESS ADMIN</small></div>' +
      '<h1>Authorize this device</h1>' +
      '<p>Your admin account is valid. This is the first device, so enter the one-time <strong>Setup PIN</strong> generated in Supabase SQL.</p>' +
      '<form id="ax-bootstrap-form"><label class="ax-field">Setup PIN<input id="ax-bootstrap-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" placeholder="6-digit PIN" required></label>' +
      '<button class="ax-btn gold block" type="submit" id="ax-bootstrap-btn">Authorize this device</button></form>' +
      '<button class="ax-btn ghost block" id="ax-bootstrap-logout" style="margin-top:10px">Cancel / Log out</button>' +
      '<p class="ax-muted" style="margin:16px 0 0;text-align:center">This PIN is used only once to register the first admin device.</p></div></div>';

    $("#ax-bootstrap-form").addEventListener("submit", async function(e){
      e.preventDefault();
      var btn=$("#ax-bootstrap-btn"), code=$("#ax-bootstrap-code").value.trim();
      btn.disabled=true; btn.textContent="Authorizing…";
      try {
        var r=await window.MADHURAVANA_SUPABASE.bootstrapDevice(code);
        if(r && r.ok){ markUiSession(); renderConsole(); window.MADHURAVANA_SUPABASE.subscribe(); await window.MADHURAVANA_SUPABASE.pullOrders(); }
        else { btn.disabled=false; btn.textContent="Authorize this device"; toast((r&&r.reason)||"Invalid or expired setup PIN.","warn"); }
      } catch(err){ btn.disabled=false; btn.textContent="Authorize this device"; toast("Could not authorize this device.","warn"); console.error(err); }
    });

    $("#ax-bootstrap-logout").onclick=logout;
  }


  /* ---------------- device authorization gate ---------------- */

  function renderDeviceGate() {

    var root = $("#ax-root");

    root.innerHTML = '\<div class="ax-login">\<div class="ax-login-card">' +

      '\<div class="ax-brand">MADHURAVANA\<small>BUSINESS ADMIN\</small>\</div>' +

      '\<h1>Authorize this device\</h1>' +

      '\<p>Your admin account is valid, but this browser is not authorized. Generate a one-time code from your already-authorized admin device.\</p>' +

      '\<form id="ax-device-form">\<label class="ax-field">Authorization code\<input id="ax-device-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" placeholder="6-digit code" required>\</label>' +

      '\<button class="ax-btn gold block" type="submit" id="ax-device-btn">Authorize device\</button>\</form>' +

      '\<button class="ax-btn ghost block" id="ax-device-logout" style="margin-top:10px">Cancel / Log out\</button>' +

      '\<p class="ax-muted" style="margin:16px 0 0;text-align:center">The code expires quickly and can be used only once.\</p>\</div>\</div>';

    $("#ax-device-form").addEventListener("submit", async function(e){

      e.preventDefault();

      var btn=$("#ax-device-btn"), code=$("#ax-device-code").value.trim();

      btn.disabled=true; btn.textContent="Authorizing…";

      try {

        var r=await window.MADHURAVANA_SUPABASE.authorizeDevice(code);

        if(r && r.ok){ markUiSession(); renderConsole(); window.MADHURAVANA_SUPABASE.subscribe(); await window.MADHURAVANA_SUPABASE.pullOrders(); }

        else { btn.disabled=false; btn.textContent="Authorize device"; toast((r&&r.reason)||"Invalid or expired authorization code.","warn"); }

      } catch(err){ btn.disabled=false; btn.textContent="Authorize device"; toast("Could not authorize this device.","warn"); console.error(err); }

    });

    $("#ax-device-logout").onclick=logout;

    $("#ax-device-code").focus();

  }



  async function openDeviceSecurity() {

    var sb=window.MADHURAVANA_SUPABASE;

    if(!sb) return;

    var result=await sb.listDevices();

    var devices=(result&&result.data)||[];

    var html='\<div class="ax-mhead">\<div>\<span class="ax-eyebrow">Security\</span>\<h2>Authorized devices\</h2>\</div>\<button class="ax-x" data-close>×\</button>\</div>' +

      '\<p class="ax-note">Only browsers listed here can access orders and stock. To add another device, generate a one-time code here and enter it on the new device.\</p>' +

      '\<div class="ax-actions" style="margin:14px 0">\<button class="ax-btn gold" id="ax-new-device-code">Generate 6-digit code\</button>\</div>' +

      '\<div id="ax-device-code-box" style="margin-bottom:16px">\</div>';

    html += '\<div class="ax-panel" style="margin-top:10px">' + (devices.length ? devices.map(function(d){ return '\<div style="display:flex;justify-content:space-between;gap:12px;align-items:center;padding:10px 0;border-bottom:1px solid #eee">\<div>\<strong>'+esc(d.device_label||"Admin browser")+'\</strong>\<div class="ax-muted" style="font-size:.78rem">'+esc(d.is_primary?"Primary device":"Authorized device")+' · '+esc(d.last_seen_at?new Date(d.last_seen_at).toLocaleString():"Never")+'\</div>\</div>'+(!d.is_primary?'\<button class="ax-btn danger sm" data-revoke-device="'+esc(d.id)+'">Revoke\</button>':'\<span class="ax-muted">Primary\</span>')+'\</div>'; }).join('') : '\<p class="ax-muted">No devices registered yet.\</p>') + '\</div>';

    var bd=openModal(html,{cls:"ax-confirm",focus:false});

    if(!bd)return;

    $("#ax-new-device-code",bd).onclick=async function(){

      var b=this; b.disabled=true; b.textContent="Generating…";

      var r=await sb.createDeviceCode();

      var box=$("#ax-device-code-box",bd);

      if(r&&r.ok){ box.innerHTML='\<div style="padding:18px;text-align:center;border:1px dashed #c9a44c;border-radius:14px">\<div class="ax-muted">Enter this code on the new device\</div>\<div style="font-size:2rem;letter-spacing:.25em;font-weight:700;margin:8px 0">'+esc(r.code)+'\</div>\<div class="ax-muted">Expires in '+esc(String(r.expires_in_minutes||5))+' minutes\</div>\</div>'; }

      else { box.innerHTML='\<p class="ax-muted">'+esc((r&&r.reason)||"Could not create code.")+'\</p>'; }

      b.disabled=false; b.textContent="Generate new code";

    };

    $$("[data-revoke-device]",bd).forEach(function(b){ b.onclick=async function(){ if(!confirm("Revoke this device? It will lose admin access.")) return; var r=await sb.revokeDevice(this.dataset.revokeDevice); if(r&&r.ok){ toast("Device revoked.","ok"); closeModal(); openDeviceSecurity(); } else toast((r&&r.reason)||"Could not revoke device.","warn"); }; });

  }



  /* ---------------- console shell ---------------- */



  function navHtml() {



    var placed = getOnlineOrders().filter(function (o) { return o.status === "Order Placed"; }).length;



    return VIEWS.map(function (v) {



      var badge = v[0] === "online" && placed ? '\<span class="ax-badge">' + placed + "\</span>" : "";



      return '\<button data-view="' + v[0] + '" class="' + (ui.view === v[0] ? "active" : "") + '">' + v[1] + badge + "\</button>";



    }).join("");



  }



  function renderNav() {



    var n = $("#ax-nav"), m = $("#ax-mtabs"); if (n) n.innerHTML = navHtml(); if (m) m.innerHTML = navHtml();



  }



  function renderConsole() {



    var root = $("#ax-root");



    root.innerHTML = '\<div class="ax-shell">\<aside class="ax-side">\<div class="ax-brand">MADHURAVANA\<small>BUSINESS ADMIN\</small>\</div>\<nav class="ax-nav" id="ax-nav">\</nav>\<div class="ax-side-foot">\<a class="ax-btn" href="index.html">View Website ↗\</a>\<button class="ax-btn out" id="ax-logout">Log out\</button>\</div>\</aside>' +



      '\<main class="ax-main">\<div class="ax-mtabs" id="ax-mtabs">\</div>\<div class="ax-top">\<div>\<span class="ax-eyebrow">Madhuravana business console\</span>\<h1 id="ax-title">Dashboard\</h1>\</div>\<div class="ax-actions ax-mobile-only">\<a class="ax-btn ghost sm" href="index.html">Website ↗\</a>\<button class="ax-btn danger sm" id="ax-logout2">Log out\</button>\</div>\</div>\<div id="ax-content">\</div>\</main>\</div>';



    $("#ax-logout").onclick = logout; $("#ax-logout2").onclick = logout;



    root.onclick = function (e) {



      var b = e.target.closest("[data-view]"); if (b && b.closest("#ax-nav,#ax-mtabs")) go(b.dataset.view, true);



    };



    wireContent();



    var h = (location.hash || "").replace("#", "");



    go(VIEWS.some(function (v) { return v[0] === h; }) ? h : "dashboard", false);



  }



  function go(view, animate) {



    ui.view = view;



    if (location.hash !== "#" + view) history.replaceState(null, "", "#" + view);



    var t = VIEWS.filter(function (v) { return v[0] === view; })[0];



    $("#ax-title").textContent = t ? t[1] : "Dashboard";



    renderNav(); paint(animate);



    if (animate) window.scrollTo({ top: 0, behavior: "smooth" });



    var act = $("#ax-mtabs .active"); if (act && act.scrollIntoView) act.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });



  }



  function paint(animate) {



    var c = $("#ax-content"); if (!c) return;



    var y = window.scrollY;



    c.innerHTML = viewHtml(ui.view);



    c.classList.remove("ax-enter"); if (animate) { void c.offsetWidth; c.classList.add("ax-enter"); }



    afterPaint();



    if (!animate) window.scrollTo(0, y);



  }



  function refresh() { renderNav(); paint(false); }







  /* ---------------- views ---------------- */



  function viewHtml(v) {



    if (v === "dashboard") return dashboardHtml();



    if (v === "online" || v === "offline") return ordersHtml(v);



    if (v === "products") return productsHtml();



    if (v === "customers") return customersHtml();



    return settingsHtml();



  }



  function dashboardHtml() {



    var all = allOrders(), cnt = function (s) { return all.filter(function (o) { return o.status === s; }).length; };



    var delivered = all.filter(function (o) { return o.status === "Delivered"; }).reduce(function (s, o) { return s + Number(o.total || 0); }, 0);



    var live = all.reduce(function (s, o) { return s + liveValue(o); }, 0);



    var cards = [



      ["Total Orders", all.length, ""], ["Online Orders", getOnlineOrders().length, ""], ["Offline Orders", getOfflineOrders().length, ""],



      ["Order Placed", cnt("Order Placed"), ""], ["Processing", cnt("Processing"), ""], ["Shipped", cnt("Shipped"), ""],



      ["Out for Delivery", cnt("Out for Delivery"), ""], ["Delivered", cnt("Delivered"), ""], ["Cancelled", cnt("Cancelled"), ""],



      ["Active COD Value", money(live), "hl"], ["Delivered Value", money(delivered), "hl"]



    ];



    var out = getProducts().filter(function (p) { return !p.inStock; });



    return '\<div class="ax-grid">' + cards.map(function (c) { return '\<div class="ax-stat ' + c[2] + '">\<span>' + c[0] + "\</span>\<strong>" + c[1] + "\</strong>\</div>"; }).join("") + "\</div>" +



      (out.length ? '\<div class="ax-panel" style="padding:14px 18px">\<span class="ax-pill out">OUT OF STOCK\</span> &nbsp;' + out.map(function (p) { return esc(p.weight); }).join(", ") + ' \<button class="ax-btn ghost sm" data-view-go="products" style="margin-left:8px">Manage stock\</button>\</div>' : "") +



      '\<div class="ax-panel">\<div class="ax-ph">\<h2>Recent orders\</h2>\<div class="ax-actions">\<button class="ax-btn ghost sm" data-view-go="online">Online\</button>\<button class="ax-btn ghost sm" data-view-go="offline">Offline\</button>\</div>\</div>' + orderTable(all.slice(0, 8), false) + "\</div>";



  }



  function orderTable(list, editable) {



    if (!list.length) return '\<div class="ax-empty">\<h3>No orders yet.\</h3>\<p>Orders you add or customers place will appear here.\</p>\</div>';



    return '\<div class="ax-tablewrap">\<table class="ax-table">\<thead>\<tr>\<th>Order\</th>\<th>Customer\</th>\<th>Items\</th>\<th>Total\</th>\<th>Status\</th>\<th>Date\</th>\<th>\</th>\</tr>\</thead>\<tbody>' +



      list.map(function (o) {



        var items = safeProducts(o).reduce(function (s, p) { return s + Number(p.quantity || 0); }, 0);



        var st = editable



          ? '\<select class="ax-status ax-pill ' + statusClass(o.status) + '" data-order-status="' + esc(o.id) + '" aria-label="Order status">' + STATUSES.map(function (s) { return "\<option" + (s === o.status ? " selected" : "") + ">" + s + "\</option>"; }).join("") + "\</select>"



          : '\<span class="ax-pill ' + statusClass(o.status) + '">' + esc(o.status) + "\</span>";



        return "\<tr>\<td>\<strong>" + esc(o.id) + '\</strong>\<span class="ax-muted">' + esc(o.orderType || "") + "\</span>\</td>\<td>" + esc(o.customerName) + '\<span class="ax-muted">' + esc(o.phone) + "\</span>\</td>\<td>" + items + "\</td>\<td>\<strong>" + money(o.total || 0) + "\</strong>\</td>\<td>" + st + "\</td>\<td>" + esc(o.orderDate || "") + '\<span class="ax-muted">' + esc(o.orderTime || "") + '\</span>\</td>\<td>\<button class="ax-btn ghost sm" data-order-view="' + esc(o.id) + '">Details\</button>\</td>\</tr>';



      }).join("") + "\</tbody>\</table>\</div>";



  }



  function filteredOrders(type) {



    var f = ui.filters[type], q = f.q.trim().toLowerCase();



    return ordersOf(type).filter(function (o) {



      return (f.status === "All" || o.status === f.status) && (!q || (o.id + " " + o.customerName + " " + o.phone).toLowerCase().indexOf(q) >= 0);



    });



  }



  function productRowHtml() {



    var ps = getProducts();



    return '\<div class="ax-prow">\<select class="ax-input mp-id">' + ps.map(function (p) { return '\<option value="' + esc(p.id) + '"' + (p.inStock ? "" : " disabled") + ">" + esc(p.weight) + " · " + money(p.price) + (p.inStock ? "" : " · OUT OF STOCK") + "\</option>"; }).join("") + '\</select>\<input class="ax-input mp-qty" type="number" min="1" max="99" value="1" required>\<button type="button" class="ax-btn danger sm mp-del" aria-label="Remove product">×\</button>\</div>';



  }



  function ordersHtml(type) {



    var f = ui.filters[type], label = type === "online" ? "Online" : "Offline", list = filteredOrders(type), total = ordersOf(type).length;



    return '\<div class="ax-panel" style="margin-top:0">\<div class="ax-ph">\<div>\<h2>' + label + " Orders\</h2>\<span class=\"ax-muted\">" + total + " order" + (total === 1 ? "" : "s") + " · orders are entered by the business owner\</span>\</div>\<div class=\"ax-actions\">\<button class=\"ax-btn ghost sm\" data-export-csv=\"" + type + '">Export CSV\</button>\<button class="ax-btn gold sm" id="ax-toggle-new">' + (ui.panelOpen[type] ? "Close form" : "+ New order") + "\</button>\</div>\</div>" +



      (ui.panelOpen[type] ? newOrderHtml(type) : "") +



      '\<div class="ax-toolbar">\<input class="ax-input" id="ax-search" placeholder="Search order ID, name or phone" value="' + esc(f.q) + '">\<select class="ax-input" id="ax-filter">\<option>All\</option>' + STATUSES.map(function (s) { return "\<option" + (s === f.status ? " selected" : "") + ">" + s + "\</option>"; }).join("") + '\</select>\</div>\<div id="ax-orders-table">' + orderTable(list, true) + "\</div>\</div>";



  }



  function newOrderHtml(type) {



    return '\<form class="ax-newbox ax-form" id="ax-order-form" novalidate>' +



      '\<label class="ax-field">Customer name\<input name="customerName" required>\</label>\<label class="ax-field">Phone (10 digits)\<input name="phone" inputmode="numeric" maxlength="14" required>\</label>' +



      '\<label class="ax-field full">Street address\<input name="street" required>\</label>\<label class="ax-field">City\<input name="city" required>\</label>\<label class="ax-field">State\<input name="state" required>\</label>\<label class="ax-field">Pincode\<input name="pincode" inputmode="numeric" maxlength="6" required>\</label>\<div>\</div>' +



      '\<div class="full">\<div class="ax-ph" style="margin-bottom:8px">\<strong style="font-size:.8rem">Products\</strong>\<button type="button" class="ax-btn ghost sm" id="mp-add">+ Add product\</button>\</div>\<div id="mp-list">' + productRowHtml() + '\</div>\</div>' +



      '\<div class="full ax-total">\<strong>Total: \<span id="mp-total">' + money(0) + '\</span>\</strong>\<button class="ax-btn" type="submit">Save ' + (type === "online" ? "Online" : "Offline") + " order\</button>\</div>\</form>";



  }



  function productsHtml() {



    var ps = getProducts();



    return '\<div class="ax-panel" style="margin-top:0">\<div class="ax-ph">\<div>\<h2>Products / Stock\</h2>\<span class="ax-muted">Changes show on the website immediately\</span>\</div>\<button class="ax-btn gold sm" id="ax-add-product">+ Add product\</button>\</div>' +



      '\<div class="ax-tablewrap">\<table class="ax-table" style="min-width:640px">\<thead>\<tr>\<th>Product\</th>\<th>Weight\</th>\<th>Price\</th>\<th>Stock\</th>\<th>Amazon\</th>\<th>\</th>\</tr>\</thead>\<tbody>' +



      ps.map(function (p) {



        return "\<tr>\<td>\<strong>" + esc(p.name) + '\</strong>\<span class="ax-muted">' + esc(p.id) + "\</span>\</td>\<td>" + esc(p.weight) + "\</td>\<td>" + money(p.price) + '\</td>\<td>\<div class="ax-cell">\<button class="ax-switch ' + (p.inStock ? "on" : "") + '" data-stock="' + esc(p.id) + '" role="switch" aria-checked="' + (!!p.inStock) + '" aria-label="Toggle stock"' + (ui.prodBusy[p.id] ? " disabled" : "") + '>\</button>\<span class="ax-pill ' + (p.inStock ? "in" : "out") + '">' + (p.inStock ? "IN STOCK" : "OUT OF STOCK") + "\</span>\</div>\</td>\<td>" + (p.amazonUrl ? "Configured" : "—") + '\</td>\<td>\<div class="ax-actions">\<button class="ax-btn ghost sm" data-edit-product="' + esc(p.id) + '">Edit\</button>\<button class="ax-btn danger sm" data-del-product="' + esc(p.id) + '">Delete\</button>\</div>\</td>\</tr>';



      }).join("") + "\</tbody>\</table>\</div>\</div>";



  }



  function customerList() {



    var map = {}, q = ui.custQ.trim().toLowerCase();



    allOrders().forEach(function (o) {



      var key = last10(o.phone) || o.customerName; if (!key) return;



      var c = map[key] || (map[key] = { name: o.customerName, phone: o.phone, count: 0, total: 0, last: o.orderDate, lastAt: "", types: {} });



      c.count++; c.total += liveValue(o); c.types[o.orderType || ""] = 1;



      if (String(o.createdAt || "") >= c.lastAt) { c.lastAt = String(o.createdAt || ""); c.last = o.orderDate; c.name = o.customerName; }



    });



    return Object.keys(map).map(function (k) { return map[k]; }).filter(function (c) { return !q || (c.name + " " + c.phone).toLowerCase().indexOf(q) >= 0; }).sort(function (a, b) { return b.total - a.total; });



  }



  function customersHtml() {



    var list = customerList();



    return '\<div class="ax-panel" style="margin-top:0">\<div class="ax-ph">\<h2>Customers\</h2>\<span class="ax-muted" id="ax-cust-count">' + list.length + ' customer' + (list.length === 1 ? "" : "s") + '\</span>\</div>\<div class="ax-toolbar">\<input class="ax-input" id="ax-cust-search" placeholder="Search name or phone" value="' + esc(ui.custQ) + '">\</div>\<div id="ax-cust-table">' + custTable(list) + "\</div>\</div>";



  }



  function custTable(list) {



    if (!list.length) return '\<div class="ax-empty">\<h3>No customers yet.\</h3>\<p>Customers appear automatically from orders.\</p>\</div>';



    return '\<div class="ax-tablewrap">\<table class="ax-table" style="min-width:620px">\<thead>\<tr>\<th>Name\</th>\<th>Phone\</th>\<th>Orders\</th>\<th>Total purchase\</th>\<th>Last order\</th>\<th>Type\</th>\<th>\</th>\</tr>\</thead>\<tbody>' + list.map(function (c) {



      var w = waLink(c.phone);



      return "\<tr>\<td>\<strong>" + esc(c.name) + "\</strong>\</td>\<td>" + esc(c.phone) + "\</td>\<td>" + c.count + "\</td>\<td>" + money(c.total) + "\</td>\<td>" + esc(c.last || "") + "\</td>\<td>" + Object.keys(c.types).join(" / ") + "\</td>\<td>" + (w ? '\<a class="ax-btn ghost sm" target="\_blank" rel="noopener" href="' + w + '">WhatsApp\</a>' : "") + "\</td>\</tr>";



    }).join("") + "\</tbody>\</table>\</div>";



  }



  function settingsHtml() {



    var s = getSettings();



    return '\<div class="ax-settings">' +



      '\<div class="ax-panel">\<h2>Business configuration\</h2>\<form class="ax-form" id="ax-settings-form">\<label class="ax-field full">Brand name\<input name="brandName" value="' + esc(s.brandName) + '">\</label>\<label class="ax-field full">WhatsApp number (with country code, e.g. 917092722605)\<input name="whatsappNumber" inputmode="numeric" value="' + esc(s.whatsappNumber) + '">\</label>\<label class="ax-field full">Instagram URL\<input name="instagramUrl" value="' + esc(s.instagramUrl) + '">\</label>\<label class="ax-field">Phone\<input name="phone" value="' + esc(s.phone) + '">\</label>\<label class="ax-field">Email\<input name="email" type="email" value="' + esc(s.email) + '">\</label>\<label class="ax-field full">Address\<input name="address" value="' + esc(s.address) + '">\</label>\<div class="full">\<button class="ax-btn" type="submit">Save settings\</button>\</div>\</form>\</div>' +


      '\<div class="ax-panel">\<h2>Device security\</h2>\<p class="ax-note">This admin dashboard is locked to authorized browser devices. Generate a one-time code to authorize another device.\</p>\<div class="ax-actions">\<button class="ax-btn" id="ax-device-security">Manage authorized devices\</button>\</div>\</div>' +



      '\<div class="ax-panel ax-danger">\<h2>Danger zone\</h2>\<div class="ax-actions">\<button class="ax-btn danger" id="ax-clear-orders">Clear orders\</button>\<button class="ax-btn danger" id="ax-reset-products">Reset products\</button>\<button class="ax-btn danger" id="ax-clear-all">Clear all local data\</button>\</div>\</div>'



  }







  /* ---------------- events ---------------- */



  function wireContent() {



    var c = $("#ax-content");



    c.addEventListener("click", function (e) {



      var t = e.target.closest("button,a,[data-order-view]"); if (!t) return;



      if (t.dataset.viewGo) return go(t.dataset.viewGo, true);



      if (t.dataset.orderView) return showOrder(t.dataset.orderView);



      if (t.id === "ax-toggle-new") { ui.panelOpen[ui.view] = !ui.panelOpen[ui.view]; return paint(false); }



      if (t.dataset.exportCsv) return exportCsv(t.dataset.exportCsv);



      if (t.dataset.stock) return toggleStock(t.dataset.stock);



      if (t.dataset.editProduct) return productModal(t.dataset.editProduct);



      if (t.dataset.delProduct) return deleteProduct(t.dataset.delProduct);



      if (t.id === "ax-add-product") return productModal(null);



      if (t.id === "ax-export") return exportData();



      if (t.id === "ax-clear-orders") return clearOrders();



      if (t.id === "ax-reset-products") return resetProducts();



      if (t.id === "ax-clear-all") return clearAll();



      if (t.id === "ax-device-security") return openDeviceSecurity();



    });



    c.addEventListener("change", function (e) {



      var t = e.target;



      if (t.dataset && t.dataset.orderStatus) return setStatus(t.dataset.orderStatus, t.value, true);



      if (t.id === "ax-filter") { ui.filters[ui.view].status = t.value; return repaintTable(); }



      if (t.id === "ax-import") return importData(t);



      if (t.classList.contains("mp-id")) updateMpTotal();



    });



    c.addEventListener("input", function (e) {



      var t = e.target;



      if (t.id === "ax-search") { ui.filters[ui.view].q = t.value; return debouncedTable(); }



      if (t.id === "ax-cust-search") { ui.custQ = t.value; return debouncedCust(); }



      if (t.classList.contains("mp-qty")) updateMpTotal();



    });



    c.addEventListener("submit", function (e) {



      e.preventDefault();



      if (e.target.id === "ax-order-form") return saveManualOrder(e.target);



      if (e.target.id === "ax-settings-form") return saveSettingsForm(e.target);





    });



    c.addEventListener("click", function (e) {



      if (e.target.id === "mp-add") { $("#mp-list").insertAdjacentHTML("beforeend", productRowHtml()); updateMpTotal(); }



      var del = e.target.closest(".mp-del");



      if (del) { var rows = $$(".ax-prow", $("#mp-list")); if (rows.length === 1) return toast("At least one product is required.", "warn"); del.closest(".ax-prow").remove(); updateMpTotal(); }



    });



    if (storageBound) return; storageBound = true;



    window.addEventListener("storage", function (e) {



      if (!isUiSession() || !$("#ax-content")) return;



      if (e.key && [KEYS.online, KEYS.offline, KEYS.products].indexOf(e.key) < 0) return;



      if ($("#ax-backdrop") || $("#ax-order-form") && $("#ax-order-form").contains(document.activeElement)) { renderNav(); return; }



      refresh();



    });



  }



  var debouncedTable = debounce(function () { repaintTable(true); }, 140);



  var debouncedCust = debounce(function () {



    var t = $("#ax-cust-table"), list = customerList(); if (!t) return;



    t.innerHTML = custTable(list); var n = $("#ax-cust-count"); if (n) n.textContent = list.length + " customer" + (list.length === 1 ? "" : "s");



  }, 140);



  function repaintTable() {



    var t = $("#ax-orders-table"); if (t) t.innerHTML = orderTable(filteredOrders(ui.view), true);



  }



  function afterPaint() {



    if ($("#ax-order-form")) updateMpTotal();



  }



  function updateMpTotal() {



    var total = 0, ps = getProducts();



    $$(".ax-prow").forEach(function (r) {



      var p = ps.filter(function (x) { return x.id === $(".mp-id", r).value; })[0];



      var q = Math.max(1, Number($(".mp-qty", r).value || 1));



      if (p) total += p.price * q;



    });



    var el = $("#mp-total"); if (el) el.textContent = money(total);



  }







  /* ---------------- actions: orders ---------------- */



  function saveManualOrder(form) {



    var d = Object.fromEntries(new FormData(form)), phone = last10(d.phone), pin = String(d.pincode || "").trim();



    var type = ui.view === "online" ? "online" : "offline";



    if (!String(d.customerName).trim()) return toast("Enter the customer name.", "warn");



    if (!/^[0-9]{10}$/.test(phone)) return toast("Enter a valid 10-digit phone number.", "warn");



    if (!String(d.street).trim() || !String(d.city).trim() || !String(d.state).trim()) return toast("Please complete the address.", "warn");



    if (!/^[0-9]{6}$/.test(pin)) return toast("Enter a valid 6-digit pincode.", "warn");



    var ps = getProducts(), items = [], total = 0;



    $$(".ax-prow", form).forEach(function (r) {



      var p = ps.filter(function (x) { return x.id === $(".mp-id", r).value; })[0], q = Math.max(1, Math.min(99, Number($(".mp-qty", r).value || 1)));



      if (!p) return;



      var ex = items.filter(function (i) { return i.id === p.id; })[0];



      if (ex) ex.quantity += q; else items.push({ id: p.id, name: p.name, weight: p.weight, quantity: q, price: p.price });



      total += p.price * q;



    });



    if (!items.length) return toast("Add at least one product.", "warn");



    var now = new Date();



    var order = {



      id: type === "online" ? generateOnlineId() : generateOfflineId(), customerName: String(d.customerName).trim(), phone: phone, products: items, total: total,



      paymentMethod: "Cash on Delivery", address: { street: String(d.street).trim(), city: String(d.city).trim(), state: String(d.state).trim(), pincode: pin },



      orderType: type.toUpperCase(), orderDate: now.toLocaleDateString("en-IN"), orderTime: now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }), status: "Order Placed", createdAt: now.toISOString()



    };



    var list = ordersOf(type); list.unshift(order);



    if (!saveOrdersOf(type, list)) return;



    ui.panelOpen[type] = false; toast("✓ " + (type === "online" ? "Online" : "Offline") + " order " + order.id + " added"); refresh();



  }



  function setStatus(id, status, fromTable) {



    var f = findOrder(id); if (!f) return toast("Order not found.", "warn");



    f.order.status = status; if (!saveOrdersOf(f.type, f.list)) return;



    if(f.type==="online" && window.MADHURAVANA_SUPABASE && window.MADHURAVANA_SUPABASE.isConfigured()){



      window.MADHURAVANA_SUPABASE.updateOrderStatus(id,status).then(function(r){



        if(r&&r.error) toast("Cloud status update failed.","warn");



      });



    }



    toast("✓ " + id + " → " + status); renderNav();



    if (fromTable) { var sel = $('[data-order-status="' + id + '"]'); if (sel) sel.className = "ax-status ax-pill " + statusClass(status); if (ui.filters[ui.view] && ui.filters[ui.view].status !== "All") repaintTable(); if (ui.view === "dashboard") paint(false); }



    else refresh();



  }



  function showOrder(id) {



    var f = findOrder(id); if (!f) return; var o = f.order, w = waLink(o.phone);



    var items = safeProducts(o).map(function (p) { return esc(p.name) + " " + esc(p.weight) + " × " + Number(p.quantity || 0); }).join("\<br>");



    var bd = openModal('\<div class="ax-mhead">\<div>\<span class="ax-eyebrow">' + esc(o.orderType || "") + ' ORDER\</span>\<h2>' + esc(o.id) + '\</h2>\</div>\<button class="ax-x" aria-label="Close">×\</button>\</div>' +



      '\<div class="ax-row">\<span>Customer\</span>\<strong>' + esc(o.customerName) + '\</strong>\</div>\<div class="ax-row">\<span>Phone\</span>\<span>' + esc(o.phone) + '\</span>\</div>\<div class="ax-row">\<span>Products\</span>\<span>' + items + '\</span>\</div>\<div class="ax-row">\<span>Total\</span>\<strong>' + money(o.total || 0) + '\</strong>\</div>\<div class="ax-row">\<span>Payment\</span>\<span>' + esc(o.paymentMethod || "Cash on Delivery") + '\</span>\</div>\<div class="ax-row">\<span>Address\</span>\<span>' + esc(addr(o)) + '\</span>\</div>\<div class="ax-row">\<span>Date / Time\</span>\<span>' + esc(o.orderDate || "") + " · " + esc(o.orderTime || "") + "\</span>\</div>" +



      '\<label class="ax-field" style="margin-top:16px">Update status\<select id="ax-m-status">' + STATUSES.map(function (s) { return "\<option" + (s === o.status ? " selected" : "") + ">" + s + "\</option>"; }).join("") + "\</select>\</label>" +



      '\<div class="ax-mactions">\<button class="ax-btn" id="ax-m-save">Update status\</button>\<button class="ax-btn ghost" id="ax-m-print">Print\</button>' + (w ? '\<a class="ax-btn ghost" target="\_blank" rel="noopener" href="' + w + '">WhatsApp\</a>' : "") + '\<button class="ax-btn danger" id="ax-m-del">Delete\</button>\</div>', { cls: "wide", focus: false });



    $("#ax-m-save", bd).onclick = function () { var v = $("#ax-m-status", bd).value; closeModal(); setStatus(o.id, v, false); };



    $("#ax-m-print", bd).onclick = function () { printOrder(o); };



    $("#ax-m-del", bd)



      .onclick = function () {



        askConfirm({



          title: "Delete order " + o.id + "?",



          text: "This removes the order permanently.",



          ok: "Delete order",



          danger: true



        }).then(async function (yes) {



          if (!yes) { return; }



          if (await deleteOrderById(o.id)) {



            closeModal();



            toast("Order deleted");



            refresh();



          }



        });



      };



  }







  /* supabase.js replaces .client() with the client object itself after init, so accept both */



  function cloudClient() {



    var sb = window.MADHURAVANA_SUPABASE;



    return sb && (typeof sb.client === "function" ? sb.client() : sb.client);



  }







  /* Deletes from Supabase first (verifying a row was really removed), then from this browser. */



  async function deleteOrderById(id) {



    var g = findOrder(id);



    if (!g) { toast("Order not found.", "warn"); return false; }



    var sb = window.MADHURAVANA_SUPABASE;



    try {



      if (g.type === "online" && sb && sb.isConfigured && sb.isConfigured()) {



        var c = cloudClient();



        var r = await c.from("orders").delete().eq("id", id).select("id");



        if (r.error) { throw r.error; }



        if (!r.data || !r.data.length) {



          var chk = await c.from("orders").select("id").eq("id", id);



          if (chk.data && chk.data.length) {



            toast("Supabase blocked the delete. Run the delete-policy SQL in the Supabase SQL Editor.", "warn");



            return false;



          }



        }



      }



      var g2 = findOrder(id);



      if (g2) {



        g2.list.splice(g2.idx, 1);



        /* write locally only; saveOnlineOrders would re-upload every order */



        safeSave(g2.type === "online" ? KEYS.online : KEYS.offline, g2.list);



      }



      return true;



    } catch (err) {



      console.error("Order delete failed:", err);



      toast("Delete failed: " + (err && err.message ? err.message : "unknown error"), "warn");



      return false;



    }



  }







function printOrder(o) {



  var w = window.open("", "\_blank", "width=900,height=1000");



  if (!w) return toast("Please allow pop-ups to print the order.", "warn");







  var s = getSettings();



  var a = o.address || {};



  var isOnline = String(o.orderType || "").toUpperCase() === "ONLINE";



  var logo = new URL("images/madhuravana-front-bottle.png", location.href).href;



  var status = o.status || "Order Placed";



  var statusCls = String(status).toLowerCase().replace(/\s+/g, "-");







  var rows = safeProducts(o).map(function (p, i) {



    var qty = Number(p.quantity || 0);



    var price = Number(p.price || 0);







    return '\<tr>' +



      '\<td class="n">' + (i + 1) + '\</td>' +



      '\<td>' +



        '\<strong>' + esc(p.name || "MADHURAVANA Pure Honey") + '\</strong>' +



        '\<span>' + esc(p.weight || "") + '\</span>' +



      '\</td>' +



      '\<td class="c">' + qty + '\</td>' +



      '\<td class="r">' + money(price) + '\</td>' +



      '\<td class="r">\<strong>' + money(price * qty) + '\</strong>\</td>' +



    '\</tr>';



  }).join("");







  var totalQty = safeProducts(o).reduce(function (t, p) {



    return t + Number(p.quantity || 0);



  }, 0);







  var addrLines = [



    a.street,



    [a.city, a.state].filter(Boolean).join(", "),



    a.pincode ? "PIN " + a.pincode : ""



  ].filter(Boolean).map(esc).join("\<br>");







  var locBlock = o.location



    ? '\<div class="loc">\<b>Delivery location\</b>\<br>' + esc(o.location) + '\</div>'



    : "";







  var css = [



    '@page{size:A4;margin:0}',



    '*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}',



    'html,body{margin:0;background:#e9e3d3}',



    'body{font:13px/1.5 "Segoe UI",Arial,sans-serif;color:#2b1b12}',



    '.sheet{width:210mm;min-height:297mm;margin:0 auto;background:#fffdf7;position:relative;overflow:hidden}',



    '.head{position:relative;padding:34px 44px 56px;color:#173b25;',



      'background:url("data:image/svg+xml,%3Csvg xmlns=\'http\://www.w3.org/2000/svg\' width=\'56\' height=\'100\' viewBox=\'0 0 56 100\'%3E%3Cpath d=\'M28 66L0 50L0 16L28 0L56 16L56 50L28 66L28 100\' fill=\'none\' stroke=\'%23ffffff\' stroke-opacity=\'.28\' stroke-width=\'2\'/%3E%3Cpath d=\'M28 0L28 34L0 50L0 84L28 100L56 84L56 50L28 34\' fill=\'none\' stroke=\'%23ffffff\' stroke-opacity=\'.28\' stroke-width=\'2\'/%3E%3C/svg%3E"),',



      'linear-gradient(135deg,#ffd45c,#f6a800 60%,#e48a00)}',



    '.head:after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:22px;background:#fffdf7;border-radius:22px 22px 0 0}',



    '.top{display:flex;justify-content:space-between;align-items:center;gap:20px}',



    '.brand{font:700 34px/1 Georgia,"Times New Roman",serif;letter-spacing:.04em;color:#173b25}',



    '.brand small{display:block;margin-top:8px;font:800 11px/1 "Segoe UI",Arial,sans-serif;letter-spacing:.42em;color:#6b3a00}',



    '.tag{margin-top:10px;font:italic 13px Georgia,serif;color:#5a2f00}',



    '.jar{height:104px;width:auto;filter:drop-shadow(0 8px 8px rgba(90,47,0,.35));margin:-6px 6px -22px 0}',



    '.body{padding:6px 44px 0}',



    '.titlebar{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;margin:2px 0 22px;padding-bottom:14px;border-bottom:2px solid #173b25}',



    '.titlebar h1{margin:0;font:600 26px Georgia,serif;color:#173b25;letter-spacing:.02em}',



    '.titlebar .id{font:700 13px "Courier New",monospace;color:#8a4a00;letter-spacing:.06em;margin-top:4px}',



    '.badges{display:flex;gap:8px;align-items:center}',



    '.badge{display:inline-block;padding:6px 14px;border-radius:99px;font:800 10.5px "Segoe UI",Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase}',



    '.badge.type{background:#173b25;color:#ffd45c}',



    '.badge.st{background:#fff1ce;color:#805d15;border:1px solid #e6c25f}',



    '.badge.st.delivered{background:#e2f0df;color:#41613b;border-color:#a9cfa0}',



    '.badge.st.cancelled{background:#f5ded9;color:#913c2d;border-color:#e0a79d}',



    '.grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:24px}',



    '.card{border:1px solid #ecd9a4;border-radius:14px;padding:14px 16px;background:#fff9e8}',



    '.card h4{margin:0 0 7px;font:800 9.5px "Segoe UI",Arial,sans-serif;letter-spacing:.24em;text-transform:uppercase;color:#a56a00}',



    '.card p{margin:0;font-size:12.5px;color:#2b1b12}',



    '.card p strong{font-size:14px;color:#173b25}',



    '.loc{margin-top:8px;font-size:10.5px;color:#6b5a48;word-break:break-all}',



    'table{width:100%;border-collapse:separate;border-spacing:0;margin-top:4px}',



    'thead th{background:#173b25;color:#ffd45c;font:800 10px "Segoe UI",Arial,sans-serif;letter-spacing:.16em;text-transform:uppercase;padding:11px 12px;text-align:left}',



    'thead th:first-child{border-radius:12px 0 0 12px}',



    'thead th:last-child{border-radius:0 12px 12px 0}',



    'td{padding:13px 12px;border-bottom:1px solid #f0e3bd;vertical-align:middle}',



    'td strong{display:block;color:#173b25}',



    'td span{color:#8a6a30;font-size:11.5px}',



    '.n{width:34px;color:#a56a00;font-weight:700}',



    '.c{text-align:center;width:60px}',



    '.r{text-align:right;width:104px}',



    'th.c{text-align:center}',



    'th.r{text-align:right}',



    '.sum{display:flex;justify-content:space-between;align-items:stretch;gap:20px;margin-top:22px}',



    '.cod{flex:1;border:2px dashed #e6a800;border-radius:16px;padding:14px 18px;background:#fffaf0}',



    '.cod b{display:block;font:800 10px "Segoe UI",Arial,sans-serif;letter-spacing:.22em;text-transform:uppercase;color:#a56a00;margin-bottom:5px}',



    '.cod span{font-size:12px;color:#5a4630}',



    '.total{min-width:230px;border-radius:16px;padding:14px 20px;color:#fff;background:linear-gradient(135deg,#173b25,#245a38)}',



    '.total .row{display:flex;justify-content:space-between;font-size:12px;opacity:.85;padding:2px 0}',



    '.total .grand{display:flex;justify-content:space-between;align-items:baseline;margin-top:8px;padding-top:9px;border-top:1px solid rgba(255,212,92,.45)}',



    '.total .grand span{font:800 10px "Segoe UI",Arial,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#ffd45c}',



    '.total .grand strong{font:700 26px Georgia,serif;color:#ffd45c}',



    '.thanks{margin:30px 0 0;text-align:center}',



    '.thanks h3{margin:0;font:italic 600 21px Georgia,serif;color:#173b25}',



    '.thanks p{margin:5px 0 0;color:#8a6a30;font-size:12px}',



    '.sign{display:flex;justify-content:space-between;margin:34px 6px 0}',



    '.sign div{width:190px;text-align:center;border-top:1px solid #b99a4a;padding-top:6px;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:#8a6a30}',



    '.foot{position:absolute;left:0;right:0;bottom:0;padding:15px 44px;display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap;font-size:11px;color:#fff3cf;background:#173b25}',



    '.foot b{color:#ffd45c;letter-spacing:.14em}',



    '@media print{html,body{background:#fffdf7}.sheet{margin:0;box-shadow:none}}'



  ].join("");







  var html =



    '\<!DOCTYPE html>\<html>\<head>\<meta charset="utf-8">\<title>' +



    esc(o.id) +



    ' | MADHURAVANA Pure Honey\</title>' +







    '\<style>' + css + '\</style>\</head>\<body>\<div class="sheet">' +







    '\<div class="head">\<div class="top">\<div>' +



    '\<div class="brand">MADHURAVANA\<small>PURE HONEY\</small>\</div>' +



    '\<div class="tag">Pure. Natural. Unprocessed. From the heart of Kerala.\</div>' +



    '\</div>' +







    '\<img class="jar" src="' + logo + '" alt="">\</div>\</div>' +







    '\<div class="body">' +







    '\<div class="titlebar">\<div>' +



    '\<h1>' + (isOnline ? "Online Order" : "Offline Order") + ' invoice\</h1>' +



    '\<div class="id">' + esc(o.id) + '\</div>' +



    '\</div>' +







    '\<div class="badges">' +



    '\<span class="badge type">' +



    esc(o.orderType || (isOnline ? "ONLINE" : "OFFLINE")) +



    '\</span>' +







    '\<span class="badge st ' + statusCls + '">' +



    esc(status) +



    '\</span>' +







    '\</div>\</div>' +







    '\<div class="grid">' +







    '\<div class="card">' +



    '\<h4>Customer\</h4>' +



    '\<p>\<strong>' + esc(o.customerName) + '\</strong>\<br>' +



    esc(o.phone) +



    '\</p>' +



    '\</div>' +







    '\<div class="card">' +



    '\<h4>Deliver to\</h4>' +



    '\<p>' + (addrLines || "—") + '\</p>' +



    locBlock +



    '\</div>' +







    '\<div class="card">' +



    '\<h4>Order details\</h4>' +



    '\<p>Date: \<strong style="font-size:12.5px">' +



    esc(o.orderDate || "") +



    '\</strong>\<br>Time: ' +



    esc(o.orderTime || "") +



    '\<br>Items: ' +



    totalQty +



    '\</p>' +



    '\</div>' +







    '\</div>' +







    '\<table>' +



    '\<thead>' +



    '\<tr>' +



    '\<th>#\</th>' +



    '\<th>Product\</th>' +



    '\<th class="c">Qty\</th>' +



    '\<th class="r">Price\</th>' +



    '\<th class="r">Amount\</th>' +



    '\</tr>' +



    '\</thead>' +



    '\<tbody>' +



    rows +



    '\</tbody>' +



    '\</table>' +







    '\<div class="sum">' +







    '\<div class="cod">' +



    '\<b>Payment\</b>' +



    '\<strong style="color:#173b25;font-size:15px">' +



    esc(o.paymentMethod || "Cash on Delivery") +



    '\</strong>\<br>' +



    '\<span>Please collect the amount shown when the parcel is delivered.\</span>' +



    '\</div>' +







    '\<div class="total">' +







    '\<div class="row">' +



    '\<span>Subtotal (' +



    totalQty +



    ' item' +



    (totalQty === 1 ? "" : "s") +



    ')\</span>' +



    '\<span>' +



    money(o.total || 0) +



    '\</span>' +



    '\</div>' +







    '\<div class="grand">' +



    '\<span>Total\</span>' +



    '\<strong>' +



    money(o.total || 0) +



    '\</strong>' +



    '\</div>' +







    '\</div>' +



    '\</div>' +







    '\<div class="thanks">' +



    '\<h3>Thank you for choosing pure honey.\</h3>' +



    '\<p>Every jar carries a taste of Kerala\'s natural warmth.\</p>' +



    '\</div>' +







    '\<div class="sign">' +



    '\<div>Packed by\</div>' +



    '\<div>Received by\</div>' +



    '\</div>' +







    '\</div>' +







    '\<div class="foot">' +



    '\<span>\<b>MADHURAVANA PURE HONEY\</b>\</span>' +



    '\<span>' + esc(s.phone || "") + '\</span>' +



    '\<span>' + esc(s.email || "") + '\</span>' +



    '\<span>' + esc(s.address || "") + '\</span>' +



    '\</div>' +







    '\</div>' +







    '\<script>' +



    '(function(){' +



    'var done=false;' +



    'function go(){if(done)return;done=true;window.print()}' +



    'var imgs=[].slice.call(document.images);' +



    'Promise.all(imgs.map(function(i){' +



    'return i.complete?1:new Promise(function(r){i.onload=i.onerror=r})' +



    '})).then(go);' +



    'setTimeout(go,2500)' +



    '})()' +



    '<\\/script>' +







    '\</body>\</html>';







  w.document.open();



  w.document.write(html);



  w.document.close();



}



  function csvCell(v) { v = String(v == null ? "" : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }



  function exportCsv(type) {



    var list = ordersOf(type); if (!list.length) return toast("No orders to export.", "warn");



    var rows = [["Order ID", "Type", "Date", "Time", "Customer", "Phone", "Products", "Total", "Payment", "Status", "Address"]].concat(list.map(function (o) {



      return [o.id, o.orderType, o.orderDate, o.orderTime, o.customerName, o.phone, safeProducts(o).map(function (p) { return p.weight + " x" + p.quantity; }).join("; "), o.total, o.paymentMethod, o.status, addr(o)];



    }));



    download("\ufeff" + rows.map(function (r) { return r.map(csvCell).join(","); }).join("\n"), "madhuravana-" + type + "-orders-" + new Date().toISOString().slice(0, 10) + ".csv", "text/csv;charset=utf-8");



    toast("✓ CSV exported");



  }



  function download(text, name, type) {



    var a = document.createElement("a"), url = URL.createObjectURL(new Blob([text], { type: type }));



    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 1500);



  }







  /* ---------------- actions: products ---------------- */



  function toggleStock(id) {



    if (ui.prodBusy[id]) return;



    var ps = getProducts(), p = ps.filter(function (x) { return x.id === id; })[0]; if (!p) return;



    var next = !p.inStock; ui.prodBusy[id] = true;



    // optimistic UI: flip instantly for a smooth feel



    var sw = $('[data-stock="' + id + '"]'); if (sw) { sw.classList.toggle("on", next); sw.setAttribute("aria-checked", next); sw.disabled = true; }



    p.inStock = next; saveProducts(ps); ui.prodBusy[id] = false;



    toast(next ? "✓ " + p.weight + " is now IN STOCK" : "✓ " + p.weight + " is now OUT OF STOCK");



    refresh();



  }



  function productModal(id) {



    var ps = getProducts(), x = id ? ps.filter(function (p) { return p.id === id; })[0] : null; if (id && !x) return;



    var bd = openModal('\<div class="ax-mhead">\<div>\<span class="ax-eyebrow">' + (x ? "Edit" : "New") + ' product\</span>\<h2>' + (x ? esc(x.weight) : "Add product") + '\</h2>\</div>\<button class="ax-x" aria-label="Close">×\</button>\</div>\<form class="ax-form" id="ax-pform">\<label class="ax-field full">Name\<input name="name" value="' + esc(x ? x.name : "MADHURAVANA Pure Honey") + '" required>\</label>\<label class="ax-field">Weight (e.g. 250g)\<input name="weight" value="' + esc(x ? x.weight : "") + '" required>\</label>\<label class="ax-field">Price (₹)\<input name="price" type="number" min="1" step="1" value="' + (x ? x.price : "") + '" required>\</label>\<label class="ax-field full">Description\<textarea name="description">' + esc(x ? x.description : "") + '\</textarea>\</label>\<label class="ax-field full">Amazon URL (optional)\<input name="amazonUrl" value="' + esc(x ? x.amazonUrl || "" : "") + '">\</label>\<div class="full ax-mactions" style="margin-top:4px">\<button class="ax-btn" type="submit">Save product\</button>\<button type="button" class="ax-btn ghost" data-close>Cancel\</button>\</div>\</form>');



    $("#ax-pform", bd).addEventListener("submit", function (e) {



      e.preventDefault(); var d = Object.fromEntries(new FormData(e.currentTarget)), price = Number(d.price);



      if (!String(d.weight).trim()) return toast("Enter the weight.", "warn");



      if (!(price > 0)) return toast("Enter a valid price.", "warn");



      var url = String(d.amazonUrl || "").trim(); if (url && !/^https?:\/\//i.test(url)) return toast("Amazon URL must start with http\:// or https\://", "warn");



      var list = getProducts();



      if (x) { var t = list.filter(function (p) { return p.id === x.id; })[0]; t.name = String(d.name).trim(); t.weight = String(d.weight).trim(); t.price = price; t.description = String(d.description).trim(); t.amazonUrl = url; }



      else {



        var n = list.length + 1, nid; do { nid = "MH" + String(n++).padStart(3, "0"); } while (list.some(function (p) { return p.id === nid; }));



        list.push({ id: nid, name: String(d.name).trim(), weight: String(d.weight).trim(), price: price, description: String(d.description).trim(), inStock: true, amazonUrl: url });



      }



      if (!saveProducts(list)) return; closeModal(); toast(x ? "✓ Product updated" : "✓ Product added"); refresh();



    });



  }



  function deleteProduct(id) {



    var ps = getProducts(); if (ps.length <= 1) return toast("You need at least one product.", "warn");



    var p = ps.filter(function (x) { return x.id === id; })[0]; if (!p) return;



    askConfirm({ title: "Delete " + p.weight + "?", text: "It will disappear from the shop. Past orders are kept.", ok: "Delete product", danger: true }).then(function (yes) {



      if (!yes) return;



      if(window.MADHURAVANA_SUPABASE && window.MADHURAVANA_SUPABASE.isConfigured()){



        window.MADHURAVANA_SUPABASE.deleteProduct(id).then(function(r){ if(r&&r.error) toast("Cloud delete failed.","warn"); });



      }



      saveProducts(getProducts().filter(function (x) { return x.id !== id; }));



      toast("Product deleted"); refresh();



    });



  }







  /* ---------------- actions: settings ---------------- */



  function saveSettingsForm(form) {



    var d = Object.fromEntries(new FormData(form)); Object.keys(d).forEach(function (k) { d[k] = String(d[k]).trim(); });



    d.whatsappNumber = onlyDigits(d.whatsappNumber);



    if (d.whatsappNumber && d.whatsappNumber.length < 10) return toast("Enter the WhatsApp number with country code.", "warn");



    if (d.instagramUrl && !/^https?:\/\//i.test(d.instagramUrl)) return toast("Instagram URL must start with https\://", "warn");



    if (saveSettings(d)) toast("✓ Settings saved");



  }



  function exportData() {



    download(JSON.stringify({ exportedAt: new Date().toISOString(), products: getProducts(), onlineOrders: getOnlineOrders(), offlineOrders: getOfflineOrders(), settings: getSettings() }, null, 2), "madhuravana-backup-" + new Date().toISOString().slice(0, 10) + ".json", "application/json");



    toast("✓ Backup exported");



  }



  function importData(input) {



    var file = input.files && input.files[0]; if (!file) return;



    var rd = new FileReader();



    rd.onload = function () {



      try {



        var d = JSON.parse(rd.result);



        if (!Array.isArray(d.products) || !Array.isArray(d.onlineOrders) || !Array.isArray(d.offlineOrders)) throw new Error("bad");



        askConfirm({ title: "Import this backup?", text: "Current products, orders and settings in this browser will be replaced.", ok: "Import & replace", danger: true }).then(function (yes) {



          input.value = ""; if (!yes) return;



          saveProducts(d.products); saveOnlineOrders(d.onlineOrders); saveOfflineOrders(d.offlineOrders); if (d.settings) saveSettings(d.settings);



          toast("✓ Backup imported"); go("dashboard", true);



        });



      } catch (err) { input.value = ""; toast("Invalid backup file.", "warn"); }



    };



    rd.onerror = function () { toast("Could not read that file.", "warn"); };



    rd.readAsText(file);



  }



  function clearOrders() {



    askConfirm({ title: "Delete ALL orders?", text: "All online and offline orders will be removed. Export a backup first.", ok: "Delete all orders", danger: true }).then(async function (y) {



      if (!y) return;



      var sb=window.MADHURAVANA_SUPABASE;



      if(sb&&sb.isConfigured&&sb.isConfigured()){



        var c=cloudClient();



        var r=await c.from("orders").delete().neq("id","\_\_never\_\_");



        if(r.error) return toast("Cloud order deletion failed.","warn");



      }



      saveOnlineOrders([]); saveOfflineOrders([]); toast("Orders cleared"); refresh();



    });



  }



  function resetProducts() { askConfirm({ title: "Reset products?", text: "The catalogue returns to the default products.", ok: "Reset products", danger: true }).then(function (y) { if (y) { saveProducts(JSON.parse(JSON.stringify(DEFAULT_PRODUCTS))); toast("Products reset"); refresh(); } }); }



  function clearAll() {



    askConfirm({ title: "Clear ALL local data?", text: "Products, orders, cart, settings and admin login will be erased from this browser.", ok: "Erase everything", danger: true }).then(function (y) {



      if (!y) return; Object.keys(KEYS).forEach(function (k) { localStorage.removeItem(KEYS[k]); }); ["madhuravana_offline_counter"].forEach(function (k) { localStorage.removeItem(k); });



      toast("All local data cleared."); setTimeout(function () { location.href = "index.html"; }, 700);



    });



  }







  /* ---------------- boot ---------------- */

  async function boot() {

    var sb = window.MADHURAVANA_SUPABASE;

    try {

      if (sb && sb.readyPromise) await sb.readyPromise;



      /* NEVER allow a localStorage-only admin console. */

      if (!sb || typeof sb.isConfigured !== "function" || !sb.isConfigured()) {

        clearUiSession();

        renderLogin();

        toast("Admin security is not configured. Connect Supabase before using the admin console.", "warn");

        return;

      }



      if (typeof sb.getSession !== "function" || typeof sb.isAdmin !== "function") {

        clearUiSession();

        renderLogin();

        toast("Admin authentication is unavailable. Check your Supabase bridge.", "warn");

        return;

      }



      var sessionResult = await sb.getSession();

      var session = sessionResult && sessionResult.data && sessionResult.data.session;



      if (session && await sb.isAdmin()) {

        var device = typeof sb.deviceStatus === "function" ? await sb.deviceStatus() : { authorized: true };

        if (!device.authorized) {

          clearUiSession();

          try { await sb.signOut(); } catch (e) {}

          renderLogin();

          toast("This browser is not an authorized admin device. Sign in on the primary device and generate a one-time authorization code.", "warn");

          return;

        }

        markUiSession();

        if (typeof sb.subscribe === "function") sb.subscribe();

        renderConsole();

        if (typeof sb.pullOrders === "function") await sb.pullOrders();

      } else {

        clearUiSession();

        renderLogin();

      }

    } catch (err) {

      console.error("Admin boot failed:", err);

      clearUiSession();

      renderLogin();

      toast("Could not verify admin access. Check your Supabase configuration.", "warn");

    }

  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();



})();
