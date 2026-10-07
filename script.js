/* MADHURAVANA Pure Honey — shared frontend application.
   Frontend-only MVP: localStorage is browser-specific and is not a secure/cloud database. */

const BUSINESS_CONFIG = {
  brandName: "MADHURAVANA Pure Honey",
  whatsappNumber: "917092722605", // Replace with business WhatsApp number, digits only, country code included.
  instagramUrl: "https://www.instagram.com/madhuravanahoney/", // Replace with real Instagram URL.
  phone: "7092722605",
  email: "yashwantchatti@gmail.com",
  address: "Hyderabad, Telangana"
};

const DEFAULT_PRODUCTS = [
  {id:"MH001",name:"MADHURAVANA Pure Honey",weight:"250g",price:299,description:"A beautiful everyday jar of naturally golden honey, ideal for morning rituals, tea and recipes.",inStock:true,amazonUrl:""},
  {id:"MH002",name:"MADHURAVANA Pure Honey",weight:"500g",price:499,description:"Our balanced everyday size for homes that love keeping a little more golden goodness close.",inStock:true,amazonUrl:""},
  {id:"MH003",name:"MADHURAVANA Pure Honey",weight:"1kg",price:899,description:"A generous family jar made for regular use, gifting and those who simply love honey.",inStock:true,amazonUrl:""}
];

const KEYS = {
  cart:"madhuravana_cart", products:"madhuravana_products", online:"madhuravana_online_orders",
  offline:"madhuravana_offline_orders", session:"madhuravana_admin_session", lastOrder:"madhuravana_last_order",
  settings:"madhuravana_settings", counter:"madhuravana_order_counter"
};

/* One-time reset: clears old test orders from every device */
(function(){
  const RESET_VERSION = "launch-1";
  try{
    if(localStorage.getItem("madhuravana_reset") !== RESET_VERSION){
      localStorage.removeItem(KEYS.online);
      localStorage.removeItem(KEYS.lastOrder);
      localStorage.setItem("madhuravana_reset", RESET_VERSION);
    }
  }catch(e){}
})();

function safeParse(key,fallback){try{const raw=localStorage.getItem(key);return raw===null?fallback:JSON.parse(raw)}catch(e){console.warn("localStorage read failed",key,e);return fallback}}
function safeSave(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true}catch(e){showToast("Browser storage is unavailable. Please check storage permissions.","warn");return false}}
function getProducts(){const p=safeParse(KEYS.products,null);if(!Array.isArray(p)){safeSave(KEYS.products,DEFAULT_PRODUCTS);return structuredClone(DEFAULT_PRODUCTS)}return p}
function saveProducts(v){
  const ok=safeSave(KEYS.products,v);
  const bridge=window.MADHURAVANA_SUPABASE;
  if(bridge&&bridge.isConfigured&&bridge.isConfigured()){
    Promise.all(v.map(p=>bridge.saveProduct(p))).then(rs=>{
      const bad=rs.find(x=>x&&x.error);
      if(bad) console.warn("Supabase product save failed:",bad.error);
    }).catch(e=>console.warn("Supabase product save failed:",e));
  }
  return ok;
}
function getCart(){return safeParse(KEYS.cart,[])}
function saveCart(v){return safeSave(KEYS.cart,v)}
function getOnlineOrders(){return safeParse(KEYS.online,[])}
function saveOnlineOrders(v){
  return safeSave(KEYS.online, v);
}
function getOfflineOrders(){return safeParse(KEYS.offline,[])}
function saveOfflineOrders(v){return safeSave(KEYS.offline,v)}
function getSettings(){return {...BUSINESS_CONFIG,...safeParse(KEYS.settings,{})}}
function saveSettings(v){return safeSave(KEYS.settings,v)}
function money(n){return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(n)}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function page(){return document.body.dataset.page||""}

function showToast(message,type=""){const root=document.getElementById("toast-root");if(!root)return;const el=document.createElement("div");el.className=`toast ${type}`;el.textContent=message;root.appendChild(el);setTimeout(()=>el.remove(),3200)}
function miniJar(){return `<img class="jar-thumb" src="images/madhuravana-front-bottle.png" alt="MADHURAVANA Pure Honey product">`}

function renderHeader(){
  const root=document.getElementById("site-header"); if(!root)return;
  root.innerHTML=`<header class="site-header"><div class="container nav">
    <a class="brand" href="index.html" aria-label="MADHURAVANA Pure Honey">MADHURAVANA<small>Pure Honey</small></a>
    <button class="menu-btn" id="menu-btn" aria-label="Open menu" aria-expanded="false">☰</button>
    <nav class="nav-links" id="nav-links" aria-label="Primary navigation">
      <a href="index.html">Home</a><a href="shop.html">Shop</a><a href="track.html">Track Order</a><a href="index.html#about">About</a>
      <a class="cart-link" href="cart.html">Cart <span class="cart-count" id="cart-count">0</span></a>
    </nav>
  </div></header>`;
  const btn=document.getElementById("menu-btn"), nav=document.getElementById("nav-links");
  btn?.addEventListener("click",()=>{const open=nav.classList.toggle("open");btn.setAttribute("aria-expanded",String(open));});
  document.querySelectorAll("[data-instagram]").forEach(a=>a.href=getSettings().instagramUrl);
  document.querySelectorAll("[data-whatsapp]").forEach(a=>a.href=whatsappUrl("Hello MADHURAVANA, I have a question about your honey products."));
  updateCartCount();
}
function renderFooter(){
  const root=document.getElementById("site-footer");if(!root)return;
  root.innerHTML=`<footer class="site-footer"><div class="container footer-grid">
    <div><div class="footer-brand">MADHURAVANA<small>PURE HONEY</small></div><p style="margin-top:15px">Natural sweetness, thoughtfully presented. Premium honey for everyday rituals and special moments.</p></div>
    <div class="footer-col"><h4>Explore</h4><a href="index.html">Home</a><a href="shop.html">Shop</a><a href="index.html#about">About</a><a href="index.html#contact">Contact</a></div>
    <div class="footer-col"><h4>Connect</h4><a data-instagram target="_blank" rel="noopener">Instagram ↗</a><a data-whatsapp>WhatsApp ↗</a><p>${esc(getSettings().email)}</p><p>${esc(getSettings().phone)}</p></div>
  </div><div class="container footer-bottom"><span>© ${new Date().getFullYear()} MADHURAVANA Pure Honey</span><span>Made with natural warmth.</span></div></footer>`;
  document.querySelectorAll("[data-instagram]").forEach(a=>a.href=getSettings().instagramUrl);
  document.querySelectorAll("[data-whatsapp]").forEach(a=>a.href=whatsappUrl("Hello MADHURAVANA, I have a question about your honey products."));
}
function whatsappUrl(message){const n=getSettings().whatsappNumber.replace(/\D/g,"");return n&&n.length>=8?`https://wa.me/${n}?text=${encodeURIComponent(message)}`:"#"}
function updateCartCount(){const el=document.getElementById("cart-count");if(el)el.textContent=getCart().reduce((a,i)=>a+i.quantity,0)}

function productCard(p){
  const out=!p.inStock,u=`product.html?id=${encodeURIComponent(p.id)}`;
  return `<article class="product-card" data-rev="1"><a class="product-visual" href="${u}" aria-label="View ${esc(p.name)} ${esc(p.weight)}"><img src="images/madhuravana-front-bottle.png" alt="MADHURAVANA Pure Honey ${esc(p.weight)}" loading="lazy" decoding="async"></a><a class="p-name" href="${u}">${esc(p.name)}<small class="eyebrow">${esc(p.weight)}</small></a>
  <p class="p-desc">${esc(p.description)}<span class="stock-badge ${out?"out":""}" style="display:block;margin-top:7px">${out?"Out of stock":"In stock"}</span></p>
  <div class="p-buy"><span class="p-fig">${money(p.price)}</span><a class="reserve-link" href="${u}">View</a><button class="btn ${out?"btn-ghost":"btn-primary"} add-btn" data-add="${esc(p.id)}" ${out?"disabled":""}>${out?"Unavailable":"Add to cart"}</button></div></article>`;
}
function renderProductGrid(target,products){const el=document.getElementById(target);if(!el)return;el.innerHTML=products.map(productCard).join("")||`<div class="empty-state"><h2>No products found.</h2><p>Please check the product configuration.</p></div>`}
function attachAddButtons(){document.querySelectorAll("[data-add]").forEach(btn=>btn.addEventListener("click",()=>addToCart(btn.dataset.add,1)))}
function addToCart(id, quantity = 1) {
  const p = getProducts().find(x => x.id === id);

  if (!p) {
    showToast("Product not found.", "warn");
    return;
  }

  if (!p.inStock) {
    showToast("This product is currently out of stock.", "warn");
    return;
  }

  const cart = getCart();
  const item = cart.find(x => x.id === id);

  if (item) {
    item.quantity += quantity;
  } else {
    cart.push({
      id: id,
      quantity: quantity
    });
  }

  saveCart(cart);
  updateCartCount();

  showAddedToCartModal(p, quantity);
}
function showAddedToCartModal(product, quantity = 1) {
  const root = document.getElementById("modal-root");

  if (!root) {
    showToast(`✓ ${product.name} ${product.weight} added to cart`);
    return;
  }

  root.innerHTML = `
    <div class="cart-modal-overlay" id="cart-modal-overlay">
      <div class="cart-added-modal" role="dialog" aria-modal="true" aria-labelledby="cart-added-title">

        <button
          class="cart-modal-close"
          id="cart-modal-close"
          aria-label="Close"
        >×</button>

        <div class="cart-success-icon">✓</div>

        <div class="cart-modal-content">

          <span class="eyebrow">Added to your cart</span>

          <h2 id="cart-added-title">
            Product Added Successfully
          </h2>

          <div class="cart-modal-product">

            <div class="cart-modal-jar">
              ${miniJar()}
            </div>

            <div class="cart-modal-product-info">
              <h3>${esc(product.name)}</h3>

              <p>${esc(product.weight)}</p>

              <div class="cart-modal-price">
                ${money(product.price)}
              </div>

              <span class="cart-modal-quantity">
                Quantity: ${quantity}
              </span>
            </div>

          </div>

          <div class="cart-modal-actions">

            <a
              href="cart.html"
              class="btn btn-primary cart-view-btn"
            >
              View Cart →
            </a>

            <button
              type="button"
              class="btn btn-ghost cart-continue-btn"
              id="cart-continue-shopping"
            >
              Continue Shopping
            </button>

          </div>

        </div>
      </div>
    </div>
  `;

  const overlay = document.getElementById("cart-modal-overlay");
  const closeButton = document.getElementById("cart-modal-close");
  const continueButton = document.getElementById("cart-continue-shopping");

  const closeModal = () => {
    overlay.classList.add("closing");

    setTimeout(() => {
      root.innerHTML = "";
    }, 220);
  };

  closeButton?.addEventListener("click", closeModal);
  continueButton?.addEventListener("click", closeModal);

  overlay?.addEventListener("click", (e) => {
    if (e.target === overlay) {
      closeModal();
    }
  });

  document.addEventListener("keydown", function escHandler(e) {
    if (e.key === "Escape") {
      closeModal();
      document.removeEventListener("keydown", escHandler);
    }
  });
}
function changeCart(id,delta){const cart=getCart();const item=cart.find(x=>x.id===id);if(!item)return;item.quantity+=delta;if(item.quantity<=0){saveCart(cart.filter(x=>x.id!==id));showToast("✓ Product removed")}else saveCart(cart);renderCart();updateCartCount()}
function removeCart(id){saveCart(getCart().filter(x=>x.id!==id));renderCart();updateCartCount();showToast("✓ Product removed")}
function cartDetailed(){const products=getProducts();return getCart().map(i=>{const p=products.find(x=>x.id===i.id);return p?{...p,quantity:i.quantity}:null}).filter(Boolean)}
function cartTotal(){return cartDetailed().reduce((s,i)=>s+i.price*i.quantity,0)}

function renderCart(){
  const box=document.getElementById("cart-items"),summary=document.getElementById("cart-summary");if(!box||!summary)return;
  const items=cartDetailed();
  if(!items.length){box.innerHTML=`<div class="empty-state"><h2>Your cart is waiting.</h2><p>Choose a jar of MADHURAVANA Pure Honey and it will appear here.</p><a class="btn btn-primary" href="shop.html">Shop Honey</a></div>`;summary.innerHTML="";return}
  box.innerHTML=items.map(i=>`<div class="cart-item"><div class="cart-thumb">${miniJar()}</div><div><h3>${esc(i.name)}</h3><div class="muted">${esc(i.weight)} · ${money(i.price)}</div><div class="cart-controls"><button class="circle-btn" data-minus="${i.id}" aria-label="Decrease quantity">−</button><strong>${i.quantity}</strong><button class="circle-btn" data-plus="${i.id}" aria-label="Increase quantity">+</button><button class="remove-btn" data-remove="${i.id}">Remove</button></div></div><div class="price">${money(i.price*i.quantity)}</div></div>`).join("");
  const total=cartTotal();
  summary.innerHTML=`<h3>Order summary</h3>${items.map(i=>`<div class="summary-row"><span>${esc(i.weight)} × ${i.quantity}</span><strong>${money(i.price*i.quantity)}</strong></div>`).join("")}<div class="summary-total"><span>Total</span><span>${money(total)}</span></div><p class="form-note" style="margin-top:18px">Cash on Delivery · WhatsApp order preparation</p><a class="btn btn-primary btn-block" href="checkout.html">Proceed to Checkout</a><button class="btn btn-ghost btn-block" id="empty-cart" style="margin-top:8px">Empty Cart</button>`;
  box.querySelectorAll("[data-minus]").forEach(b=>b.onclick=()=>changeCart(b.dataset.minus,-1));box.querySelectorAll("[data-plus]").forEach(b=>b.onclick=()=>changeCart(b.dataset.plus,1));box.querySelectorAll("[data-remove]").forEach(b=>b.onclick=()=>removeCart(b.dataset.remove));document.getElementById("empty-cart").onclick=()=>{if(confirm("Empty your entire cart?")){saveCart([]);renderCart();updateCartCount();}};
}


function generateOnlineId(){
  const d=new Date(),date=`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;
  const bytes=window.crypto&&crypto.getRandomValues?crypto.getRandomValues(new Uint8Array(4)):null;
  const suffix=bytes?Array.from(bytes).map(x=>x.toString(16).padStart(2,"0")).join("").toUpperCase():Math.random().toString(36).slice(2,10).toUpperCase();
  return `MH${date}${suffix}`;
}
function generateOfflineId(){const n=(safeParse("madhuravana_offline_counter",1000)||1000)+1;safeSave("madhuravana_offline_counter",n);return `OFF-MH-${n}`}


function renderProduct(){
  const root=document.getElementById("product-detail");if(!root)return;
  const id=new URLSearchParams(location.search).get("id");const p=getProducts().find(x=>x.id===id);
  if(!p){root.innerHTML=`<div class="empty-state"><h2>Product not found.</h2><a class="btn btn-primary" href="shop.html">Back to Shop</a></div>`;return}
  root.innerHTML=`<div class="product-detail"><div class="detail-visual">${miniJar()}<span class="still-label">${esc(p.weight)}</span></div><div class="detail-copy"><span class="eyebrow">${esc(p.weight)}</span><h1>${esc(p.name)}</h1><div class="price">${money(p.price)}</div><p class="description">${esc(p.description)}</p><div class="availability ${p.inStock?"ok":"no"}">${p.inStock?"✓ In Stock":"× Currently Out of Stock"}</div>${p.inStock?`<div class="qty-control"><button id="qty-minus" aria-label="Decrease quantity">−</button><span id="qty">1</span><button id="qty-plus" aria-label="Increase quantity">+</button></div><div class="product-actions"><button class="btn btn-primary" id="detail-add">Add to Cart</button></div>`:`<p class="form-note">Currently unavailable. Please check back after stock is updated.</p>`}${p.amazonUrl?`<a class="text-link" style="display:inline-block;margin-top:20px" href="${esc(p.amazonUrl)}" target="_blank" rel="noopener">Buy on Amazon ↗</a>`:""}</div></div>`;
  if(p.inStock){let q=1;document.getElementById("qty-minus").onclick=()=>{q=Math.max(1,q-1);document.getElementById("qty").textContent=q};document.getElementById("qty-plus").onclick=()=>{q=Math.min(20,q+1);document.getElementById("qty").textContent=q};document.getElementById("detail-add").onclick=()=>addToCart(p.id,q)}
}

let deliveryLocation = "";

function isMapsLink(v){
  return /google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps/i.test(v);
}

function renderCheckout(){
  const summary=document.getElementById("checkout-summary");if(!summary)return;
  const form=document.getElementById("checkout-form");
  const items=cartDetailed();
  if(!items.length){
    summary.innerHTML=`<div class="empty-state"><h2>Cart is empty.</h2><a class="btn btn-primary" href="shop.html">Shop Honey</a></div>`;
    form.style.display="none";return;
  }
  summary.innerHTML=`<h3>Order summary</h3>${items.map(i=>`<div class="summary-row"><span>${esc(i.name)} · ${esc(i.weight)} × ${i.quantity}</span><strong>${money(i.price*i.quantity)}</strong></div>`).join("")}<div class="summary-total"><span>Total</span><span>${money(cartTotal())}</span></div>`;

  form.addEventListener("submit",submitCheckout);
  setupLocation();

  form.elements.phone.addEventListener("input",function(){this.value=this.value.replace(/\D/g,"").slice(0,15)});
  form.elements.pincode.addEventListener("input",function(){this.value=this.value.replace(/\D/g,"").slice(0,6)});
}

function setupLocation(){
  const locBtn=document.getElementById("use-location-btn");
  const mapsBtn=document.getElementById("maps-btn");
  const status=document.getElementById("location-status");
  const mapsBox=document.getElementById("maps-link-input");
  const mapsUrl=document.getElementById("maps-url");
  if(!locBtn||!mapsBtn||!status||!mapsBox||!mapsUrl)return;

  const say=(msg,err=false)=>{status.textContent=msg;status.classList.add("show");status.classList.toggle("error",err)};

  locBtn.addEventListener("click",()=>{
    if(!navigator.geolocation){say("Your browser doesn't support location. Please add a Google Maps link instead.",true);return}
    locBtn.disabled=true;locBtn.textContent="📍 Finding your location...";
    navigator.geolocation.getCurrentPosition(
      pos=>{
        deliveryLocation=`https://www.google.com/maps?q=${pos.coords.latitude},${pos.coords.longitude}`;
        mapsUrl.value="";
        say("✓ Location captured. It will be sent with your order.");
        locBtn.disabled=false;locBtn.textContent="✓ Location Added";
      },
      ()=>{
        locBtn.disabled=false;locBtn.textContent="📍 Use My Current Location";
        say("Couldn't get your location. Allow location access or add a Google Maps link.",true);
      },
      {enableHighAccuracy:true,timeout:10000,maximumAge:60000}
    );
  });

  mapsBtn.addEventListener("click",()=>{
    const open=mapsBox.classList.toggle("show");
    mapsBtn.textContent=open?"✓ Google Maps Link":"🗺️ Add Google Maps Link";
    if(open)mapsUrl.focus();
  });

  mapsUrl.addEventListener("input",()=>{
    const v=mapsUrl.value.trim();
    if(!v){deliveryLocation="";return}
    if(isMapsLink(v)){deliveryLocation=v;say("✓ Google Maps location added to your order.")}
    else{deliveryLocation="";say("Please paste a valid Google Maps link.",true)}
  });
}

async function submitCheckout(e){
  e.preventDefault();
  const f=e.currentTarget;
  const data=Object.fromEntries(new FormData(f).entries());

  if(!String(data.name||"").trim())return showToast("Please enter your full name.","warn");

  let phone=String(data.phone||"").replace(/\D/g,"");
  if(phone.length===12&&phone.startsWith("91"))phone=phone.slice(2);
  else if(phone.length===11&&phone.startsWith("0"))phone=phone.slice(1);
  data.pincode=String(data.pincode||"").replace(/\D/g,"");

  if(!/^[0-9]{10}$/.test(phone))return showToast("Please enter a valid 10-digit mobile number.","warn");
  if(!String(data.address||"").trim()||!String(data.city||"").trim()||!String(data.state||"").trim())
    return showToast("Please complete the delivery address.","warn");
  if(!/^[0-9]{6}$/.test(data.pincode))return showToast("Please enter a valid 6-digit pincode.","warn");

  const typed=(document.getElementById("maps-url")?.value||"").trim();
  if(typed){
    if(!isMapsLink(typed))return showToast("Please paste a valid Google Maps link.","warn");
    deliveryLocation=typed;
  }

  const items=cartDetailed();
  if(!items.length)return showToast("Your cart is empty.","warn");

  const products=getProducts();
  for(const i of items){
    const live=products.find(p=>p.id===i.id);
    if(!live||!live.inStock)return showToast(`${i.name} (${i.weight}) is currently out of stock.`,"warn");
  }

  const now=new Date();
  const order={
    id:generateOnlineId(),
    customerName:data.name.trim(),
    phone,
    products:items.map(i=>({id:i.id,name:i.name,weight:i.weight,quantity:i.quantity,price:i.price})),
    total:cartTotal(),
    paymentMethod:"Cash on Delivery",
    address:{street:data.address.trim(),city:data.city.trim(),state:data.state.trim(),pincode:data.pincode},
    location:deliveryLocation||"",
    orderType:"ONLINE",
    orderDate:now.toLocaleDateString("en-IN"),
    orderTime:now.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}),
    status:"Order Placed",
    createdAt:now.toISOString()
  };

  const url=whatsappUrl(buildWhatsAppMessage(order));
  if(url==="#")return showToast("Business WhatsApp number is not configured.","warn");

  const btn=f.querySelector('button[type="submit"]');
  const label=btn?btn.innerHTML:"";
  if(btn){btn.disabled=true;btn.classList.add("loading");btn.innerHTML="<span>↗</span> Opening WhatsApp..."}

  /* 1. save locally */
  const orders=getOnlineOrders();orders.unshift(order);saveOnlineOrders(orders);
  safeSave(KEYS.lastOrder,{...order,whatsappUrl:url});

  /* 2. cloud backup: best effort, waits max ~3s, never blocks WhatsApp */
  try{
    const bridge=window.MADHURAVANA_SUPABASE;
    if(bridge&&bridge.readyPromise){
      const ready=await Promise.race([bridge.readyPromise,new Promise(r=>setTimeout(()=>r(false),1500))]);
      if(ready&&bridge.isConfigured&&bridge.isConfigured()&&bridge.saveOrder){
        await Promise.race([
          Promise.resolve(bridge.saveOrder(order)).catch(err=>console.warn("Supabase save failed",err)),
          new Promise(r=>setTimeout(r,3000))
        ]);
      }
    }
  }catch(err){console.warn("Supabase save skipped",err)}

  /* 3. clear cart and go straight to WhatsApp (no success page) */
  saveCart([]);updateCartCount();
  window.location.href=url;

  setTimeout(()=>{if(btn){btn.disabled=false;btn.classList.remove("loading");btn.innerHTML=label}},4000);
}

function buildWhatsAppMessage(o){
  return `NEW MADHURAVANA HONEY ORDER\n\nOrder ID: ${o.id}\n\nCUSTOMER DETAILS\n\nName: ${o.customerName}\nPhone: ${o.phone}\n\nORDER DETAILS\n\n${o.products.map(p=>`${p.name} - ${p.weight}\nQuantity: ${p.quantity}\nPrice: ${money(p.price*p.quantity)}`).join("\n\n")}\n\nTOTAL: ${money(o.total)}\n\nPAYMENT METHOD:\nCash on Delivery\n\nDELIVERY ADDRESS:\n${o.address.street}\n${o.address.city}\n${o.address.state}\n${o.address.pincode}${o.location?`\n\nDELIVERY LOCATION:\n${o.location}`:""}`;
}

function renderPublicProductViews(){
  const p=page();
  if(p==="home")renderHome();
  if(p==="shop")renderShop();
  if(p==="product")renderProduct();
  if(p==="cart")renderCart();
  if(p==="checkout")renderCheckout();
}
function renderHome(){const target=document.getElementById("featured-products");if(target){renderProductGrid("featured-products",getProducts());attachAddButtons()}}
function renderShop(){const all=getProducts();const sort=document.getElementById("shop-sort");const paint=()=>{let p=[...all];if(sort.value==="low")p.sort((a,b)=>a.price-b.price);if(sort.value==="high")p.sort((a,b)=>b.price-a.price);renderProductGrid("shop-products",p);attachAddButtons();document.getElementById("shop-count").textContent=`${p.length} product${p.length!==1?"s":""}`};sort?.addEventListener("change",paint);paint()}

function renderSuccess(){
  const data=safeParse(KEYS.lastOrder,null);const params=new URLSearchParams(location.search);const id=params.get("order");const o=data&&data.id===id?data:data;
  if(!o)return;
  document.getElementById("success-order-card").innerHTML=`<strong>${esc(o.id)}</strong><div class="summary-row"><span>Customer</span><span>${esc(o.customerName)}</span></div><div class="summary-row"><span>Items</span><span>${o.products.reduce((s,p)=>s+p.quantity,0)}</span></div><div class="summary-total"><span>Total</span><span>${money(o.total)}</span></div>`;
  const a=document.getElementById("success-whatsapp");a.href=o.whatsappUrl||whatsappUrl(buildWhatsAppMessage(o));
}

function revealSetup(){const els=document.querySelectorAll(".reveal");if(!("IntersectionObserver" in window)){els.forEach(e=>e.classList.add("visible"));return}const io=new IntersectionObserver(entries=>entries.forEach(x=>x.isIntersecting&&x.target.classList.add("visible")),{threshold:.08});els.forEach(e=>io.observe(e))}
function keyboardAdmin(){document.addEventListener("keydown",e=>{if(e.ctrlKey&&e.shiftKey&&e.key.toLowerCase()==="a"){e.preventDefault();window.dispatchEvent(new CustomEvent("open-admin-login"))}})}

document.addEventListener("DOMContentLoaded",()=>{
  getProducts();renderHeader();renderFooter();keyboardAdmin();revealSetup();
  if(page()==="home")renderHome();
  if(page()==="shop")renderShop();
  if(page()==="product")renderProduct();
  if(page()==="cart")renderCart();
  if(page()==="checkout")renderCheckout();
  if(page()==="success")renderSuccess();

  if(window.MADHURAVANA_SUPABASE && window.MADHURAVANA_SUPABASE.readyPromise){
    window.MADHURAVANA_SUPABASE.readyPromise.then(function(ok){
      if(ok && window.MADHURAVANA_SUPABASE.pullProducts) window.MADHURAVANA_SUPABASE.pullProducts();
    });
  }
});
window.MADHURAVANA={BUSINESS_CONFIG,DEFAULT_PRODUCTS,KEYS,getProducts,saveProducts,getCart,saveCart,getOnlineOrders,saveOnlineOrders,getOfflineOrders,saveOfflineOrders,getSettings,saveSettings,money,showToast,whatsappUrl,buildWhatsAppMessage,updateCartCount,renderPublicProductViews};
