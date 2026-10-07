/* MADHURAVANA order tracking: Supabase RPC track_order(id, phone) with same-browser fallback */
(function () {
  var STEPS = [
    ["Order Placed", "We have received your order."],
    ["Processing", "Your honey is being packed with care."],
    ["Shipped", "Your parcel has left us and is on the way."],
    ["Out for Delivery", "The delivery partner is bringing it to your door."],
    ["Delivered", "Delivered. Enjoy your pure honey!"]
  ];
  var $ = function (s) { return document.querySelector(s); };
  var form = $("#tk-form"), out = $("#tk-result"), timer = null;
  function digits(s) { return String(s || "").replace(/\D/g, "").slice(-10); }
  function cloud() { var sb = window.MADHURAVANA_SUPABASE; return sb && (typeof sb.client === "function" ? sb.client() : sb.client); }
  function configured() { var sb = window.MADHURAVANA_SUPABASE; return !!(sb && sb.isConfigured && sb.isConfigured() && cloud()); }

  async function lookup(id, phone) {
    if (window.MADHURAVANA_SUPABASE && window.MADHURAVANA_SUPABASE.readyPromise) { try { await window.MADHURAVANA_SUPABASE.readyPromise; } catch (e) {} }
    if (configured()) {
      var r = await cloud().rpc("track_order", { p_id: id, p_phone: phone });
      if (r.error) { console.warn("track_order:", r.error.message); }
      else if (r.data && r.data.length) { var d = r.data[0]; return { id: d.id, status: d.status, date: d.order_date, time: d.order_time, total: d.total, products: d.products || [], name: d.customer_name, city: d.city }; }
      else return null;
    }
    /* same-browser fallback (also used if the SQL has not been run yet) */
    var list = []; try { list = getOnlineOrders(); } catch (e) {}
    var o = list.filter(function (x) { return String(x.id).toUpperCase() === id.toUpperCase() && digits(x.phone) === digits(phone); })[0];
    return o ? { id: o.id, status: o.status, date: o.orderDate, time: o.orderTime, total: o.total, products: o.products || [], name: String(o.customerName || "").split(" ")[0], city: (o.address || {}).city } : null;
  }

  function render(o) {
    var cancelled = o.status === "Cancelled", idx = STEPS.map(function (s) { return s[0]; }).indexOf(o.status);
    var pill = cancelled ? "bad" : (idx === 4 ? "done" : "");
    var steps = cancelled
      ? '<li class="on"><span class="tk-dot">✓</span><div><strong>Order Placed</strong><span>We received your order.</span></div></li><li class="now"><span class="tk-dot" style="background:#9b3c2e;color:#fff;animation:none;box-shadow:none">✕</span><div><strong>Cancelled</strong><span>This order was cancelled. Contact us on WhatsApp if this is a mistake.</span></div></li>'
      : STEPS.map(function (s, i) { var c = i < idx ? "on" : (i === idx ? "now" : ""); return '<li class="' + c + '"><span class="tk-dot">' + (i < idx || idx === 4 && i === 4 ? "✓" : i + 1) + '</span><div><strong>' + s[0] + '</strong><span>' + (i <= idx ? s[1] : "") + '</span></div></li>'; }).join("");
    var items = (o.products || []).map(function (p) { return "<div><span>" + esc(p.name || "Honey") + " " + esc(p.weight || "") + " × " + Number(p.quantity || 0) + "</span><span>" + money(Number(p.price || 0) * Number(p.quantity || 0)) + "</span></div>"; }).join("");
    out.innerHTML = '<div class="tk-card"><div class="tk-head"><div><h2>Hi ' + esc(o.name || "there") + ', here is your order</h2><small>' + esc(o.id) + " · " + esc(o.date || "") + " " + esc(o.time || "") + (o.city ? " · " + esc(o.city) : "") + '</small></div><span class="tk-pill ' + pill + '">' + esc(o.status) + '</span></div><ol class="tk-steps">' + steps + '</ol><div class="tk-items">' + items + '<div class="tot"><span>Total (Cash on Delivery)</span><span>' + money(o.total || 0) + '</span></div></div><p class="tk-note">This page refreshes by itself. Questions? Message us on WhatsApp.</p></div>';
  }

  async function run(quiet) {
    var id = $("#tk-id").value.trim(), phone = $("#tk-phone").value.trim();
    if (digits(phone).length !== 10) { out.innerHTML = '<div class="tk-msg">Enter the 10-digit phone number used for the order.</div>'; return; }
    var btn = $("#tk-btn"); if (!quiet) { btn.disabled = true; btn.textContent = "Checking…"; }
    try {
      var o = await lookup(id, phone);
      if (o) render(o); else out.innerHTML = '<div class="tk-msg">No order found. Check the Order ID and phone number. The ID looks like MH20261007…</div>';
    } catch (e) { out.innerHTML = '<div class="tk-msg">Could not check right now. Please try again.</div>'; console.error(e); }
    btn.disabled = false; btn.textContent = "Track order";
    clearInterval(timer); if (out.querySelector(".tk-card")) timer = setInterval(function () { run(true); }, 30000);
  }

    function renderMyOrders() {
    var box = $("#tk-orders"); if (!box) return;
    var list = []; try { list = getOnlineOrders(); } catch (e) {}
    if (!list.length) { box.innerHTML = ""; return; }
    list = list.slice(0, 10);
    box.innerHTML = '<h2 class="tk-my-title">My orders</h2><p class="tk-my-sub">Orders placed from this device. Tap one to track it.</p>' +
      list.map(function (o) {
        var n = (o.products || []).reduce(function (s, p) { return s + Number(p.quantity || 0); }, 0);
        return '<button type="button" class="tk-my" data-id="' + esc(o.id) + '" data-phone="' + esc(o.phone) + '"><div><strong>' + esc(o.id) + '</strong><small>' + esc(o.orderDate || "") + " · " + n + " item" + (n !== 1 ? "s" : "") + " · " + money(o.total || 0) + '</small></div><span class="tk-pill" data-pill="' + esc(o.id) + '">' + esc(o.status || "Order Placed") + '</span></button>';
      }).join("");

    box.querySelectorAll(".tk-my").forEach(function (b) {
      b.addEventListener("click", function () {
        $("#tk-id").value = b.dataset.id;
        $("#tk-phone").value = digits(b.dataset.phone);
        run(false);
        out.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    /* refresh live status for each order, one at a time */
    (async function () {
      for (var i = 0; i < list.length; i++) {
        try {
          var r = await lookup(list[i].id, digits(list[i].phone));
          if (!r) continue;
          var pill = box.querySelector('[data-pill="' + list[i].id + '"]');
          if (pill) {
            pill.textContent = r.status;
            pill.className = "tk-pill" + (r.status === "Cancelled" ? " bad" : r.status === "Delivered" ? " done" : "");
          }
        } catch (e) {}
      }
    })();
  }
  renderMyOrders();

  form.addEventListener("submit", function (e) { e.preventDefault(); run(false); });
  var q = new URLSearchParams(location.search), last = null;
  try { last = safeParse(KEYS.lastOrder, null); } catch (e) {}
  var pre = q.get("order") || (last && last.id) || "";
  $("#tk-id").value = pre;
  if (last && last.id === pre && last.phone) { $("#tk-phone").value = digits(last.phone); run(false); }
  else if (pre) $("#tk-phone").focus();
})();
