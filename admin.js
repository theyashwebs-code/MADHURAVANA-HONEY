/* MADHURAVANA admin console.
   Frontend-only: data lives in this browser's localStorage (same keys as before).
   This is NOT secure authentication - see Settings > Limitations. */
(function () {
  "use strict";

  var ADMIN_CONFIG = { username: "admin", password: "ChangeThisPassword" }; // default login; change it inside Settings.
  var CRED_KEY = "madhuravana_admin_credentials";
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
  function waLink(phone) { var p = last10(phone); return p.length === 10 ? "https://wa.me/91" + p : ""; }
  function liveValue(o) { return o.status === "Cancelled" ? 0 : Number(o.total || 0); }

  /* ---------------- auth ---------------- */
  function sha(text) {
    if (window.crypto && crypto.subtle && window.TextEncoder) {
      return crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)).then(function (b) {
        return Array.prototype.map.call(new Uint8Array(b), function (x) { return ("0" + x.toString(16)).slice(-2); }).join("");
      });
    }
    return Promise.resolve("plain:" + text);
  }
  function getCreds() { return safeParse(CRED_KEY, null); }
  async function checkLogin(u, p) {
    var sb=window.MADHURAVANA_SUPABASE;
    if(sb&&sb.isConfigured&&sb.isConfigured()){
      var r=await sb.signIn(u,p);
      if(r.error) return false;
      return await sb.isAdmin();
    }
    var c = getCreds();
    if (!c) return u === ADMIN_CONFIG.username && p === ADMIN_CONFIG.password;
    var h = await sha(c.salt + p);
    return u === c.username && h === c.hash;
  }
  function setCreds(u, p) {
    var salt = Math.random().toString(36).slice(2) + Date.now().toString(36);
    return sha(salt + p).then(function (h) { return safeSave(CRED_KEY, { username: u, salt: salt, hash: h }); });
  }
  function isAdmin() {
    var s = safeParse(KEYS.session, null);
    return !!(s && s.loggedIn && Date.now() - (s.at || 0) < SESSION_MS);
  }
  async function logout() {
    try { if(window.MADHURAVANA_SUPABASE&&window.MADHURAVANA_SUPABASE.isConfigured()) await window.MADHURAVANA_SUPABASE.signOut(); } catch(e) {}
    try { localStorage.removeItem(KEYS.session); } catch (e) {}
    closeModal(); renderLogin();
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
    r.innerHTML = '<div class="ax-backdrop" id="ax-backdrop"><div class="ax-modal ' + (opts.cls || "") + '" role="dialog" aria-modal="true">' + html + "</div></div>";
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
      var bd = openModal('<div class="ax-mhead"><div><span class="ax-eyebrow">Please confirm</span><h2>' + esc(o.title) + '</h2></div><button class="ax-x" aria-label="Close">×</button></div><p style="color:#6b5e55;font-size:.9rem;margin:0 0 6px">' + esc(o.text || "") + '</p><div class="ax-mactions"><button class="ax-btn ' + (o.danger ? "solid-danger" : "") + '" id="ax-yes">' + esc(o.ok || "Confirm") + '</button><button class="ax-btn ghost" data-close>Cancel</button></div>', { cls: "ax-confirm", focus: false });
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
    root.innerHTML = '<div class="ax-login"><form class="ax-login-card" id="ax-login" autocomplete="on"><div class="ax-brand">MADHURAVANA<small>BUSINESS ADMIN</small></div><h1>Welcome back</h1><p>Sign in to manage orders, stock and customers.</p>' +
      '<label class="ax-field">Admin email<input name="username" type="email" autocomplete="username" autocapitalize="none" required></label>' +
      '<label class="ax-field">Password<input name="password" type="password" autocomplete="current-password" required></label>' +
      '<button class="ax-btn gold block" type="submit" id="ax-login-btn">Login</button>' +
      '<p class="ax-muted" style="margin:16px 0 0;text-align:center"><a href="index.html" style="text-decoration:underline">← Back to website</a></p></form></div>';
    var form = $("#ax-login");
    $("input", form).focus();
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var now = Date.now();
      if (now < lockUntil) { toast("Too many attempts. Try again in " + Math.ceil((lockUntil - now) / 1000) + "s.", "warn"); return; }
      var d = Object.fromEntries(new FormData(form));
      var btn = $("#ax-login-btn"); btn.disabled = true; btn.textContent = "Signing in…";
      checkLogin(String(d.username).trim(), String(d.password)).then(function (ok) {
        if (ok) {
          fails = 0; safeSave(KEYS.session, { loggedIn: true, at: Date.now() });
          if(window.MADHURAVANA_SUPABASE&&window.MADHURAVANA_SUPABASE.isConfigured()) window.MADHURAVANA_SUPABASE.subscribe();
          renderConsole();
          if(window.MADHURAVANA_SUPABASE&&window.MADHURAVANA_SUPABASE.pullOrders) window.MADHURAVANA_SUPABASE.pullOrders();
        } else {
          fails++; if (fails >= 5) { lockUntil = Date.now() + 30000; fails = 0; }
          btn.disabled = false; btn.textContent = "Login"; toast("Invalid admin email or password.", "warn");
          var p = $('input[name="password"]', form); p.value = ""; p.focus();
        }
      }).catch(function(err){
        btn.disabled=false; btn.textContent="Login";
        toast("Could not connect to Supabase. Check your configuration.","warn");
        console.error(err);
      });
    });
  }

  /* ---------------- console shell ---------------- */
  function navHtml() {
    var placed = getOnlineOrders().filter(function (o) { return o.status === "Order Placed"; }).length;
    return VIEWS.map(function (v) {
      var badge = v[0] === "online" && placed ? '<span class="ax-badge">' + placed + "</span>" : "";
      return '<button data-view="' + v[0] + '" class="' + (ui.view === v[0] ? "active" : "") + '">' + v[1] + badge + "</button>";
    }).join("");
  }
  function renderNav() {
    var n = $("#ax-nav"), m = $("#ax-mtabs"); if (n) n.innerHTML = navHtml(); if (m) m.innerHTML = navHtml();
  }
  function renderConsole() {
    var root = $("#ax-root");
    root.innerHTML = '<div class="ax-shell"><aside class="ax-side"><div class="ax-brand">MADHURAVANA<small>BUSINESS ADMIN</small></div><nav class="ax-nav" id="ax-nav"></nav><div class="ax-side-foot"><a class="ax-btn" href="index.html">View Website ↗</a><button class="ax-btn out" id="ax-logout">Log out</button></div></aside>' +
      '<main class="ax-main"><div class="ax-mtabs" id="ax-mtabs"></div><div class="ax-top"><div><span class="ax-eyebrow">Madhuravana business console</span><h1 id="ax-title">Dashboard</h1></div><div class="ax-actions ax-mobile-only"><a class="ax-btn ghost sm" href="index.html">Website ↗</a><button class="ax-btn danger sm" id="ax-logout2">Log out</button></div></div><div id="ax-content"></div></main></div>';
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
    return '<div class="ax-grid">' + cards.map(function (c) { return '<div class="ax-stat ' + c[2] + '"><span>' + c[0] + "</span><strong>" + c[1] + "</strong></div>"; }).join("") + "</div>" +
      (out.length ? '<div class="ax-panel" style="padding:14px 18px"><span class="ax-pill out">OUT OF STOCK</span> &nbsp;' + out.map(function (p) { return esc(p.weight); }).join(", ") + ' <button class="ax-btn ghost sm" data-view-go="products" style="margin-left:8px">Manage stock</button></div>' : "") +
      '<div class="ax-panel"><div class="ax-ph"><h2>Recent orders</h2><div class="ax-actions"><button class="ax-btn ghost sm" data-view-go="online">Online</button><button class="ax-btn ghost sm" data-view-go="offline">Offline</button></div></div>' + orderTable(all.slice(0, 8), false) + "</div>";
  }
  function orderTable(list, editable) {
    if (!list.length) return '<div class="ax-empty"><h3>No orders yet.</h3><p>Orders you add or customers place will appear here.</p></div>';
    return '<div class="ax-tablewrap"><table class="ax-table"><thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th><th>Date</th><th></th></tr></thead><tbody>' +
      list.map(function (o) {
        var items = safeProducts(o).reduce(function (s, p) { return s + Number(p.quantity || 0); }, 0);
        var st = editable
          ? '<select class="ax-status ax-pill ' + statusClass(o.status) + '" data-order-status="' + esc(o.id) + '" aria-label="Order status">' + STATUSES.map(function (s) { return "<option" + (s === o.status ? " selected" : "") + ">" + s + "</option>"; }).join("") + "</select>"
          : '<span class="ax-pill ' + statusClass(o.status) + '">' + esc(o.status) + "</span>";
        return "<tr><td><strong>" + esc(o.id) + '</strong><span class="ax-muted">' + esc(o.orderType || "") + "</span></td><td>" + esc(o.customerName) + '<span class="ax-muted">' + esc(o.phone) + "</span></td><td>" + items + "</td><td><strong>" + money(o.total || 0) + "</strong></td><td>" + st + "</td><td>" + esc(o.orderDate || "") + '<span class="ax-muted">' + esc(o.orderTime || "") + '</span></td><td><button class="ax-btn ghost sm" data-order-view="' + esc(o.id) + '">Details</button></td></tr>';
      }).join("") + "</tbody></table></div>";
  }
  function filteredOrders(type) {
    var f = ui.filters[type], q = f.q.trim().toLowerCase();
    return ordersOf(type).filter(function (o) {
      return (f.status === "All" || o.status === f.status) && (!q || (o.id + " " + o.customerName + " " + o.phone).toLowerCase().indexOf(q) >= 0);
    });
  }
  function productRowHtml() {
    var ps = getProducts();
    return '<div class="ax-prow"><select class="ax-input mp-id">' + ps.map(function (p) { return '<option value="' + esc(p.id) + '"' + (p.inStock ? "" : " disabled") + ">" + esc(p.weight) + " · " + money(p.price) + (p.inStock ? "" : " · OUT OF STOCK") + "</option>"; }).join("") + '</select><input class="ax-input mp-qty" type="number" min="1" max="99" value="1" required><button type="button" class="ax-btn danger sm mp-del" aria-label="Remove product">×</button></div>';
  }
  function ordersHtml(type) {
    var f = ui.filters[type], label = type === "online" ? "Online" : "Offline", list = filteredOrders(type), total = ordersOf(type).length;
    return '<div class="ax-panel" style="margin-top:0"><div class="ax-ph"><div><h2>' + label + " Orders</h2><span class=\"ax-muted\">" + total + " order" + (total === 1 ? "" : "s") + " · orders are entered by the business owner</span></div><div class=\"ax-actions\"><button class=\"ax-btn ghost sm\" data-export-csv=\"" + type + '">Export CSV</button><button class="ax-btn gold sm" id="ax-toggle-new">' + (ui.panelOpen[type] ? "Close form" : "+ New order") + "</button></div></div>" +
      (ui.panelOpen[type] ? newOrderHtml(type) : "") +
      '<div class="ax-toolbar"><input class="ax-input" id="ax-search" placeholder="Search order ID, name or phone" value="' + esc(f.q) + '"><select class="ax-input" id="ax-filter"><option>All</option>' + STATUSES.map(function (s) { return "<option" + (s === f.status ? " selected" : "") + ">" + s + "</option>"; }).join("") + '</select></div><div id="ax-orders-table">' + orderTable(list, true) + "</div></div>";
  }
  function newOrderHtml(type) {
    return '<form class="ax-newbox ax-form" id="ax-order-form" novalidate>' +
      '<label class="ax-field">Customer name<input name="customerName" required></label><label class="ax-field">Phone (10 digits)<input name="phone" inputmode="numeric" maxlength="14" required></label>' +
      '<label class="ax-field full">Street address<input name="street" required></label><label class="ax-field">City<input name="city" required></label><label class="ax-field">State<input name="state" required></label><label class="ax-field">Pincode<input name="pincode" inputmode="numeric" maxlength="6" required></label><div></div>' +
      '<div class="full"><div class="ax-ph" style="margin-bottom:8px"><strong style="font-size:.8rem">Products</strong><button type="button" class="ax-btn ghost sm" id="mp-add">+ Add product</button></div><div id="mp-list">' + productRowHtml() + '</div></div>' +
      '<div class="full ax-total"><strong>Total: <span id="mp-total">' + money(0) + '</span></strong><button class="ax-btn" type="submit">Save ' + (type === "online" ? "Online" : "Offline") + " order</button></div></form>";
  }
  function productsHtml() {
    var ps = getProducts();
    return '<div class="ax-panel" style="margin-top:0"><div class="ax-ph"><div><h2>Products / Stock</h2><span class="ax-muted">Changes show on the website immediately</span></div><button class="ax-btn gold sm" id="ax-add-product">+ Add product</button></div>' +
      '<div class="ax-tablewrap"><table class="ax-table" style="min-width:640px"><thead><tr><th>Product</th><th>Weight</th><th>Price</th><th>Stock</th><th>Amazon</th><th></th></tr></thead><tbody>' +
      ps.map(function (p) {
        return "<tr><td><strong>" + esc(p.name) + '</strong><span class="ax-muted">' + esc(p.id) + "</span></td><td>" + esc(p.weight) + "</td><td>" + money(p.price) + '</td><td><div class="ax-cell"><button class="ax-switch ' + (p.inStock ? "on" : "") + '" data-stock="' + esc(p.id) + '" role="switch" aria-checked="' + (!!p.inStock) + '" aria-label="Toggle stock"' + (ui.prodBusy[p.id] ? " disabled" : "") + '></button><span class="ax-pill ' + (p.inStock ? "in" : "out") + '">' + (p.inStock ? "IN STOCK" : "OUT OF STOCK") + "</span></div></td><td>" + (p.amazonUrl ? "Configured" : "—") + '</td><td><div class="ax-actions"><button class="ax-btn ghost sm" data-edit-product="' + esc(p.id) + '">Edit</button><button class="ax-btn danger sm" data-del-product="' + esc(p.id) + '">Delete</button></div></td></tr>';
      }).join("") + "</tbody></table></div></div>";
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
    return '<div class="ax-panel" style="margin-top:0"><div class="ax-ph"><h2>Customers</h2><span class="ax-muted" id="ax-cust-count">' + list.length + ' customer' + (list.length === 1 ? "" : "s") + '</span></div><div class="ax-toolbar"><input class="ax-input" id="ax-cust-search" placeholder="Search name or phone" value="' + esc(ui.custQ) + '"></div><div id="ax-cust-table">' + custTable(list) + "</div></div>";
  }
  function custTable(list) {
    if (!list.length) return '<div class="ax-empty"><h3>No customers yet.</h3><p>Customers appear automatically from orders.</p></div>';
    return '<div class="ax-tablewrap"><table class="ax-table" style="min-width:620px"><thead><tr><th>Name</th><th>Phone</th><th>Orders</th><th>Total purchase</th><th>Last order</th><th>Type</th><th></th></tr></thead><tbody>' + list.map(function (c) {
      var w = waLink(c.phone);
      return "<tr><td><strong>" + esc(c.name) + "</strong></td><td>" + esc(c.phone) + "</td><td>" + c.count + "</td><td>" + money(c.total) + "</td><td>" + esc(c.last || "") + "</td><td>" + Object.keys(c.types).join(" / ") + "</td><td>" + (w ? '<a class="ax-btn ghost sm" target="_blank" rel="noopener" href="' + w + '">WhatsApp</a>' : "") + "</td></tr>";
    }).join("") + "</tbody></table></div>";
  }
  function settingsHtml() {
    var s = getSettings(), cr = getCreds();
    return '<div class="ax-settings">' +
      '<div class="ax-panel"><h2>Business configuration</h2><form class="ax-form" id="ax-settings-form"><label class="ax-field full">Brand name<input name="brandName" value="' + esc(s.brandName) + '"></label><label class="ax-field full">WhatsApp number (with country code, e.g. 917092722605)<input name="whatsappNumber" inputmode="numeric" value="' + esc(s.whatsappNumber) + '"></label><label class="ax-field full">Instagram URL<input name="instagramUrl" value="' + esc(s.instagramUrl) + '"></label><label class="ax-field">Phone<input name="phone" value="' + esc(s.phone) + '"></label><label class="ax-field">Email<input name="email" type="email" value="' + esc(s.email) + '"></label><label class="ax-field full">Address<input name="address" value="' + esc(s.address) + '"></label><div class="full"><button class="ax-btn" type="submit">Save settings</button></div></form></div>' +
      '<div class="ax-panel"><h2>Admin login</h2><p class="ax-muted">Supabase mode uses the admin email/password created under Authentication → Users. Do not store production credentials in this website.</p><form class="ax-form" id="ax-pass-form" autocomplete="off"><label class="ax-field full">Admin ID<input name="username" value="' + esc(cr ? cr.username : ADMIN_CONFIG.username) + '" required></label><label class="ax-field full">Current password<input name="current" type="password" required></label><label class="ax-field">New password (min 6)<input name="next" type="password" minlength="6" required></label><label class="ax-field">Confirm new password<input name="again" type="password" minlength="6" required></label><div class="full"><button class="ax-btn" type="submit">Update login</button></div></form></div>' +
      '<div class="ax-panel"><h2>Backup</h2><p class="ax-note" style="margin:0 0 14px">Data is stored in this browser only. Export a backup regularly.</p><div class="ax-actions"><button class="ax-btn ghost" id="ax-export">Export data</button><label class="ax-btn ghost" style="cursor:pointer">Import data<input id="ax-import" type="file" accept=".json,application/json" hidden></label></div><p class="ax-muted" style="margin:12px 0 0">Export includes products, online orders, offline orders and settings.</p></div>' +
      '<div class="ax-panel ax-danger"><h2>Danger zone</h2><div class="ax-actions"><button class="ax-btn danger" id="ax-clear-orders">Clear orders</button><button class="ax-btn danger" id="ax-reset-products">Reset products</button><button class="ax-btn danger" id="ax-clear-all">Clear all local data</button></div></div>' +
      '<div class="ax-panel" style="grid-column:1/-1"><h2>Supabase status</h2><p class="ax-note" style="margin:0">When <strong>supabase-config.js</strong> is configured, products and online COD orders are stored in Supabase, admin login uses Supabase Auth, and Realtime keeps stock and online orders synchronized across devices. Without configuration, the site safely falls back to browser-local storage.</p></div></div>';
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
      if (e.target.id === "ax-pass-form") return savePassword(e.target);
    });
    c.addEventListener("click", function (e) {
      if (e.target.id === "mp-add") { $("#mp-list").insertAdjacentHTML("beforeend", productRowHtml()); updateMpTotal(); }
      var del = e.target.closest(".mp-del");
      if (del) { var rows = $$(".ax-prow", $("#mp-list")); if (rows.length === 1) return toast("At least one product is required.", "warn"); del.closest(".ax-prow").remove(); updateMpTotal(); }
    });
    if (storageBound) return; storageBound = true;
    window.addEventListener("storage", function (e) {
      if (!isAdmin() || !$("#ax-content")) return;
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
    var items = safeProducts(o).map(function (p) { return esc(p.name) + " " + esc(p.weight) + " × " + Number(p.quantity || 0); }).join("<br>");
    var bd = openModal('<div class="ax-mhead"><div><span class="ax-eyebrow">' + esc(o.orderType || "") + ' ORDER</span><h2>' + esc(o.id) + '</h2></div><button class="ax-x" aria-label="Close">×</button></div>' +
      '<div class="ax-row"><span>Customer</span><strong>' + esc(o.customerName) + '</strong></div><div class="ax-row"><span>Phone</span><span>' + esc(o.phone) + '</span></div><div class="ax-row"><span>Products</span><span>' + items + '</span></div><div class="ax-row"><span>Total</span><strong>' + money(o.total || 0) + '</strong></div><div class="ax-row"><span>Payment</span><span>' + esc(o.paymentMethod || "Cash on Delivery") + '</span></div><div class="ax-row"><span>Address</span><span>' + esc(addr(o)) + '</span></div><div class="ax-row"><span>Date / Time</span><span>' + esc(o.orderDate || "") + " · " + esc(o.orderTime || "") + "</span></div>" +
      '<label class="ax-field" style="margin-top:16px">Update status<select id="ax-m-status">' + STATUSES.map(function (s) { return "<option" + (s === o.status ? " selected" : "") + ">" + s + "</option>"; }).join("") + "</select></label>" +
      '<div class="ax-mactions"><button class="ax-btn" id="ax-m-save">Update status</button><button class="ax-btn ghost" id="ax-m-print">Print</button>' + (w ? '<a class="ax-btn ghost" target="_blank" rel="noopener" href="' + w + '">WhatsApp</a>' : "") + '<button class="ax-btn danger" id="ax-m-del">Delete</button></div>', { cls: "wide", focus: false });
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
    var w = window.open("", "_blank", "width=800,height=900");
    if (!w) return toast("Please allow pop-ups to print the order.", "warn");
    var rows = safeProducts(o).map(function (p) { return esc(p.name) + " - " + esc(p.weight) + " × " + Number(p.quantity || 0) + " — " + money(Number(p.price || 0) * Number(p.quantity || 0)); }).join("<br>");
    w.document.write("<html><head><title>" + esc(o.id) + "</title><style>body{font:14px Arial;padding:40px;color:#2b1b12}h1{font:700 28px Georgia}.line{padding:9px 0;border-bottom:1px solid #ddd}small{color:#777}</style></head><body><h1>MADHURAVANA Pure Honey</h1><p><strong>" + esc(o.id) + "</strong> · " + esc(o.orderType || "") + '</p><div class="line"><strong>Customer:</strong> ' + esc(o.customerName) + " · " + esc(o.phone) + '</div><div class="line"><strong>Products:</strong><br>' + rows + '</div><div class="line"><strong>Total:</strong> ' + money(o.total || 0) + '</div><div class="line"><strong>Payment:</strong> ' + esc(o.paymentMethod || "Cash on Delivery") + '</div><div class="line"><strong>Address:</strong> ' + esc(addr(o)) + '</div><div class="line"><strong>Status:</strong> ' + esc(o.status) + "</div><p><small>Printed " + new Date().toLocaleString("en-IN") + "</small></p><script>window.onload=function(){window.print()}<\/script></body></html>");
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
    var bd = openModal('<div class="ax-mhead"><div><span class="ax-eyebrow">' + (x ? "Edit" : "New") + ' product</span><h2>' + (x ? esc(x.weight) : "Add product") + '</h2></div><button class="ax-x" aria-label="Close">×</button></div><form class="ax-form" id="ax-pform"><label class="ax-field full">Name<input name="name" value="' + esc(x ? x.name : "MADHURAVANA Pure Honey") + '" required></label><label class="ax-field">Weight (e.g. 250g)<input name="weight" value="' + esc(x ? x.weight : "") + '" required></label><label class="ax-field">Price (₹)<input name="price" type="number" min="1" step="1" value="' + (x ? x.price : "") + '" required></label><label class="ax-field full">Description<textarea name="description">' + esc(x ? x.description : "") + '</textarea></label><label class="ax-field full">Amazon URL (optional)<input name="amazonUrl" value="' + esc(x ? x.amazonUrl || "" : "") + '"></label><div class="full ax-mactions" style="margin-top:4px"><button class="ax-btn" type="submit">Save product</button><button type="button" class="ax-btn ghost" data-close>Cancel</button></div></form>');
    $("#ax-pform", bd).addEventListener("submit", function (e) {
      e.preventDefault(); var d = Object.fromEntries(new FormData(e.currentTarget)), price = Number(d.price);
      if (!String(d.weight).trim()) return toast("Enter the weight.", "warn");
      if (!(price > 0)) return toast("Enter a valid price.", "warn");
      var url = String(d.amazonUrl || "").trim(); if (url && !/^https?:\/\//i.test(url)) return toast("Amazon URL must start with http:// or https://", "warn");
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
    if (d.instagramUrl && !/^https?:\/\//i.test(d.instagramUrl)) return toast("Instagram URL must start with https://", "warn");
    if (saveSettings(d)) toast("✓ Settings saved");
  }
  function savePassword(form) {
    var d = Object.fromEntries(new FormData(form)), u = String(d.username).trim();
    if (!u) return toast("Enter an admin ID.", "warn");
    if (String(d.next).length < 6) return toast("New password must be at least 6 characters.", "warn");
    if (d.next !== d.again) return toast("New passwords do not match.", "warn");
    checkLogin(getCreds() ? getCreds().username : ADMIN_CONFIG.username, String(d.current)).then(function (ok) {
      if (!ok) return toast("Current password is incorrect.", "warn");
      return setCreds(u, String(d.next)).then(function (saved) { if (saved) { form.reset(); toast("✓ Login updated. Use the new details next time."); } });
    });
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
        var r=await c.from("orders").delete().neq("id","__never__");
        if(r.error) return toast("Cloud order deletion failed.","warn");
      }
      saveOnlineOrders([]); saveOfflineOrders([]); toast("Orders cleared"); refresh();
    });
  }
  function resetProducts() { askConfirm({ title: "Reset products?", text: "The catalogue returns to the default products.", ok: "Reset products", danger: true }).then(function (y) { if (y) { saveProducts(JSON.parse(JSON.stringify(DEFAULT_PRODUCTS))); toast("Products reset"); refresh(); } }); }
  function clearAll() {
    askConfirm({ title: "Clear ALL local data?", text: "Products, orders, cart, settings and admin login will be erased from this browser.", ok: "Erase everything", danger: true }).then(function (y) {
      if (!y) return; Object.keys(KEYS).forEach(function (k) { localStorage.removeItem(KEYS[k]); }); ["madhuravana_offline_counter", CRED_KEY].forEach(function (k) { localStorage.removeItem(k); });
      toast("All local data cleared."); setTimeout(function () { location.href = "index.html"; }, 700);
    });
  }

  /* ---------------- boot ---------------- */
  async function boot() {
    var sb=window.MADHURAVANA_SUPABASE;
    if(sb&&sb.readyPromise) await sb.readyPromise;
    if(sb&&sb.isConfigured&&sb.isConfigured()){
      var session=await sb.getSession();
      if(session.data&&session.data.session && await sb.isAdmin()){
        safeSave(KEYS.session,{loggedIn:true,at:Date.now()});
        sb.subscribe();
        renderConsole();
        sb.pullOrders();
      } else {
        try{localStorage.removeItem(KEYS.session)}catch(e){}
        renderLogin();
      }
    } else {
      if (isAdmin()) renderConsole(); else renderLogin();
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
