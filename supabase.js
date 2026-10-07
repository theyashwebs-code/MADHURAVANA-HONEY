/* MADHURAVANA Supabase bridge
   1) Copy supabase-config.example.js to supabase-config.js
   2) Add your Supabase Project URL + Publishable (anon) key.
   Never put a service_role key in this file.
*/
(function () {
  "use strict";
  var cfg = window.MADHURAVANA_SUPABASE_CONFIG || {};
  var ready = false;
  var client = null;
  var channels = [];

  function configured() {
    return !!(cfg.url && cfg.key && !String(cfg.url).includes("YOUR_") && !String(cfg.key).includes("YOUR_"));
  }
  function loadScript(src) {
    return new Promise(function(resolve,reject){
      var s=document.createElement("script");
      s.src=src; s.async=true;
      s.onload=resolve; s.onerror=reject;
      document.head.appendChild(s);
    });
  }
  async function init() {
    if (!configured()) return false;
    try {
if (!window.supabase) {
  await loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.0");
}
      client = window.supabase.createClient(cfg.url, cfg.key, {
        auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true}
      });
      ready = true;
      window.MADHURAVANA_SUPABASE.client = client;
      return true;
    } catch(e) {
      console.error("Supabase initialization failed", e);
      return false;
    }
  }

  function fromRow(r) {
    return {
      id:r.id,name:r.name,weight:r.weight,price:Number(r.price),
      description:r.description||"",inStock:!!r.in_stock,amazonUrl:r.amazon_url||""
    };
  }
  function toOrder(r) {
    return {
      id:r.id,customerName:r.customer_name,phone:r.phone,
      products:Array.isArray(r.products)?r.products:[],
      total:Number(r.total||0),paymentMethod:r.payment_method||"Cash on Delivery",
      address:r.address||{},orderType:r.order_type||"ONLINE",
      orderDate:r.order_date||"",orderTime:r.order_time||"",
      status:r.status||"Order Placed",createdAt:r.created_at
    };
  }
  function toRow(o) {
    return {
      id:o.id,customer_name:o.customerName,phone:o.phone,
      products:o.products,total:Number(o.total||0),
      payment_method:o.paymentMethod||"Cash on Delivery",
      address:o.address||{},order_type:o.orderType||"ONLINE",
      order_date:o.orderDate||"",order_time:o.orderTime||"",
      status:o.status||"Order Placed",created_at:o.createdAt||new Date().toISOString()
    };
  }
  async function pullProducts() {
    if(!ready) return;
    var r=await client.from("products").select("*").order("id");
    if(r.error){console.warn("Supabase products:",r.error.message);return;}
    var rows=(r.data||[]).map(fromRow);
    if(rows.length) {
      safeSaveLocal(KEYS.products,rows);
      if(typeof window.renderPublicProductViews==="function") window.renderPublicProductViews();
    }
  }
  async function pullOrders() {
    if(!ready) return;
    var r=await client.from("orders").select("*").order("created_at",{ascending:false});
    if(r.error){console.warn("Supabase orders:",r.error.message);return;}
    var online=(r.data||[]).filter(function(x){return x.order_type==="ONLINE";}).map(toOrder);
    safeSaveLocal(KEYS.online,online);
    if(document.body && document.body.dataset.page==="admin" && typeof window.refreshAdminFromCloud==="function") window.refreshAdminFromCloud();
  }
  function safeSaveLocal(key,value){
    try{localStorage.setItem(key,JSON.stringify(value));return true}catch(e){return false}
  }
  function subscribe() {
    if(!ready) return;
    channels.forEach(function(c){client.removeChannel(c)}); channels=[];
    var pc=client.channel("madhuravana-products-live")
      .on("postgres_changes",{event:"*",schema:"public",table:"products"},function(){pullProducts()})
      .subscribe();
    channels.push(pc);

    // Orders are private: only an authenticated admin can receive them under the RLS policy.
    if(document.body && document.body.dataset.page==="admin"){
      var oc=client.channel("madhuravana-orders-live")
        .on("postgres_changes",{event:"*",schema:"public",table:"orders"},function(){pullOrders()})
        .subscribe();
      channels.push(oc);
    }
  }

  window.MADHURAVANA_SUPABASE = {
    init:init,
    isConfigured:function(){return configured() && ready},
    retryInit:async function(){ if(ready) return true; return await init(); },
    client:function(){return client},
    pullProducts:pullProducts,
    pullOrders:pullOrders,
    subscribe:subscribe,
    async signIn(email,password){
      if(!ready) throw new Error("Supabase is not configured.");
      return await client.auth.signInWithPassword({email:email,password:password});
    },
    async signOut(){ if(ready) return await client.auth.signOut(); },
    async getSession(){ if(!ready) return {data:{session:null}}; return await client.auth.getSession(); },
    async isAdmin(){
      if(!ready)return false;
      var s=await client.auth.getSession();
      if(!s.data.session)return false;
      var r=await client.from("admin_users").select("user_id").eq("user_id",s.data.session.user.id).maybeSingle();
      return !!(r.data && !r.error);
    },
    async saveProduct(p){
      if(!ready)return {data:null,error:null,cloud:false};
      var r=await client.from("products").upsert({
        id:p.id,name:p.name,weight:p.weight,price:Number(p.price),
        description:p.description||"",in_stock:!!p.inStock,amazon_url:p.amazonUrl||"",
        updated_at:new Date().toISOString()
      });
      return {data:r.data,error:r.error,cloud:true};
    },
    async deleteProduct(id){
      if(!ready)return {error:null,cloud:false};
      var r=await client.from("products").delete().eq("id",id);
      return {error:r.error,cloud:true};
    },
    async saveOrder(o){
      if(!ready)return {data:null,error:null,cloud:false};
      var r=await client.from("orders").insert(toRow(o));
      return {data:r.data,error:r.error,cloud:true};
    },
    async updateOrderStatus(id,status){
      if(!ready)return {data:null,error:null,cloud:false};
      var r=await client.from("orders").update({status:status}).eq("id",id);
      return {data:r.data,error:r.error,cloud:true};
    }
  };

  window.MADHURAVANA_SUPABASE.readyPromise = init().then(async function(ok){
    if(ok){
      await pullProducts();
      if(document.body && document.body.dataset.page==="admin"){
        await pullOrders();
      }
      var s=await client.auth.getSession();
      if(s.data.session) client.auth.onAuthStateChange(function(){});
      subscribe();
    }
    return ok;
  });
})();