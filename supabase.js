

/* MADHURAVANA Supabase bridge

   Production version



   1) Add your Supabase Project URL + Publishable/anon key

      in supabase-config.js.



   2) NEVER put a service_role key in this file.



   Security model:

   - Supabase Auth handles authentication.

   - Supabase RLS handles database authorization.

   - admin_users determines which authenticated users are admins.

   - localStorage is ONLY a browser cache/UI convenience.

   - localStorage is NEVER trusted for authorization.

*/



(function () {

  "use strict";



  var cfg = window.MADHURAVANA_SUPABASE_CONFIG || {};



  var ready = false;

  var client = null;

  var channels = [];

  var authListenerBound = false;



  /* Device authorization. This is a random browser credential, not a hardware ID. */

  var DEVICE_TOKEN_KEY = "madhuravana_admin_device_token_v1";

  var DEVICE_HEADER = "x-madhuravana-device-token";

  var DEVICE_LABEL_KEY = "madhuravana_admin_device_label_v1";



  function randomDeviceToken() {

    var bytes = new Uint8Array(32);

    if (window.crypto && window.crypto.getRandomValues) {

      window.crypto.getRandomValues(bytes);

      var out = "";

      for (var i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, "0");

      return out;

    }

    return String(Date.now()) + "-" + String(Math.random()).slice(2) + "-" + String(Math.random()).slice(2);

  }

  function getDeviceToken() { try { return localStorage.getItem(DEVICE_TOKEN_KEY) || ""; } catch (e) { return ""; } }

  function saveDeviceToken(token) { try { localStorage.setItem(DEVICE_TOKEN_KEY, token); return true; } catch (e) { return false; } }

  function clearDeviceToken() { try { localStorage.removeItem(DEVICE_TOKEN_KEY); localStorage.removeItem(DEVICE_LABEL_KEY); } catch (e) {} }

  function deviceLabel() {

    try {

      var n = /Android/i.test(navigator.userAgent) ? "Android" : /iPhone|iPad/i.test(navigator.userAgent) ? "iPhone/iPad" : /Mac/i.test(navigator.userAgent) ? "Mac" : /Windows/i.test(navigator.userAgent) ? "Windows PC" : "Browser";

      return localStorage.getItem(DEVICE_LABEL_KEY) || (n + " • " + location.hostname);

    } catch (e) { return "Admin browser"; }

  }

  function saveDeviceLabel(label) { try { localStorage.setItem(DEVICE_LABEL_KEY, label); } catch (e) {} }



  /*

   * ---------------------------------------------------------

   * CONFIGURATION

   * ---------------------------------------------------------

   */



  function configured() {

    var url = String(cfg.url || "").trim();

    var key = String(cfg.key || "").trim();



    if (!url || !key) return false;



    if (url.indexOf("YOUR\_") !== -1) return false;

    if (key.indexOf("YOUR\_") !== -1) return false;



    /*

     * A service_role key must NEVER be used in browser code.

     * This check is only an additional safety guard.

     */

    if (key.indexOf("service_role") !== -1) {

      console.error(

        "MADHURAVANA SECURITY ERROR: service_role key detected in browser configuration."

      );

      return false;

    }



    return true;

  }



  /*

   * ---------------------------------------------------------

   * SCRIPT LOADER

   * ---------------------------------------------------------

   */



  function loadScript(src) {

    return new Promise(function (resolve, reject) {

      var existing = document.querySelector(

        'script[data-madhuravana-supabase="true"]'

      );



      if (existing) {

        if (window.supabase) {

          resolve();

          return;

        }



        existing.addEventListener("load", resolve, { once: true });

        existing.addEventListener("error", reject, { once: true });

        return;

      }



      var s = document.createElement("script");



      s.src = src;

      s.async = true;

      s.defer = true;

      s.dataset.madhuravanaSupabase = "true";



      s.onload = resolve;

      s.onerror = function () {

        reject(new Error("Could not load Supabase client library."));

      };



      document.head.appendChild(s);

    });

  }



  /*

   * ---------------------------------------------------------

   * INITIALIZATION

   * ---------------------------------------------------------

   */



  async function init() {

    if (ready && client) return true;



    if (!configured()) {

      console.error(

        "MADHURAVANA Supabase is not configured correctly."

      );

      return false;

    }



    try {

      if (!window.supabase) {

        await loadScript(

          "https\://cdn.jsdelivr.net/npm/@supabase/supabase-js\@2.57.0"

        );

      }



      if (

        !window.supabase ||

        typeof window.supabase.createClient !== "function"

      ) {

        throw new Error("Supabase client library is unavailable.");

      }



      client = window.supabase.createClient(cfg.url, cfg.key, {

        auth: {

          autoRefreshToken: true,

          persistSession: true,

          detectSessionInUrl: true

        },

        global: {

          fetch: function (input, init) {

            init = init || {};

            var headers = new Headers(init.headers || {});

            try {

              var deviceToken = localStorage.getItem(DEVICE_TOKEN_KEY) || "";

              if (deviceToken) headers.set(DEVICE_HEADER, deviceToken);

            } catch (e) {}

            init.headers = headers;

            return window.fetch(input, init);

          }

        }

      });



      ready = true;



      window.MADHURAVANA_SUPABASE.client = client;



      bindAuthStateListener();



      return true;

    } catch (e) {

      ready = false;

      client = null;



      console.error(

        "Supabase initialization failed:",

        e

      );



      return false;

    }

  }



  /*

   * ---------------------------------------------------------

   * LOCAL CACHE HELPERS

   * ---------------------------------------------------------

   *

   * IMPORTANT:

   * These values are NOT security credentials.

   * Supabase remains the source of truth.

   */



  function safeSaveLocal(key, value) {

    try {

      localStorage.setItem(

        key,

        JSON.stringify(value)

      );



      return true;

    } catch (e) {

      console.warn(

        "Could not save local cache:",

        e

      );



      return false;

    }

  }



  function safeRemoveLocal(key) {

    try {

      localStorage.removeItem(key);

    } catch (e) {}

  }



  /*

   * Remove cloud-derived customer/order cache.

   *

   * We deliberately do NOT clear offline business orders here,

   * because those are local business records and are separate

   * from the authenticated cloud order cache.

   */



  function clearSensitiveCloudCache() {

    try {

      if (

        typeof KEYS !== "undefined" &&

        KEYS.online

      ) {

        safeRemoveLocal(KEYS.online);

      }

    } catch (e) {}



    try {

      /*

       * Also support the known MADHURAVANA key as a fallback.

       * This does nothing if the application uses another key.

       */

      safeRemoveLocal("madhuravana_online_orders");

    } catch (e) {}

  }



  /*

   * ---------------------------------------------------------

   * ROW MAPPERS

   * ---------------------------------------------------------

   */



  function fromRow(r) {

    r = r || {};



    return {

      id: r.id,

      name: r.name,

      weight: r.weight,

      price: Number(r.price || 0),

      description: r.description || "",

      inStock: !!r.in_stock,

      amazonUrl: r.amazon_url || ""

    };

  }



  function toOrder(r) {

    r = r || {};



    return {

      id: r.id,

      customerName: r.customer_name,

      phone: r.phone,

      products: Array.isArray(r.products)

        ? r.products

        : [],

      total: Number(r.total || 0),

      paymentMethod:

        r.payment_method || "Cash on Delivery",

      address: r.address || {},

      orderType: r.order_type || "ONLINE",

      orderDate: r.order_date || "",

      orderTime: r.order_time || "",

      status: r.status || "Order Placed",

      createdAt: r.created_at

    };

  }



  function toRow(o) {

    o = o || {};



    return {

      id: o.id,

      customer_name: o.customerName,

      phone: o.phone,

      products: Array.isArray(o.products)

        ? o.products

        : [],

      total: Number(o.total || 0),

      payment_method:

        o.paymentMethod || "Cash on Delivery",

      address: o.address || {},

      order_type: o.orderType || "ONLINE",

      order_date: o.orderDate || "",

      order_time: o.orderTime || "",

      status: o.status || "Order Placed",

      created_at:

        o.createdAt ||

        new Date().toISOString()

    };

  }



  /*

   * ---------------------------------------------------------

   * PRODUCTS

   * ---------------------------------------------------------

   */



  async function pullProducts() {

    if (!ready || !client) return;



    try {

      var r = await client

        .from("products")

        .select("*")

        .order("id");



      if (r.error) {

        console.warn(

          "Supabase products:",

          r.error.message

        );

        return;

      }



      var rows = (r.data || []).map(fromRow);



      /*

       * Always update the cache after a successful request.

       * This prevents stale products if the table becomes empty.

       */

      safeSaveLocal(KEYS.products, rows);



      if (

        typeof window.renderPublicProductViews ===

        "function"

      ) {

        window.renderPublicProductViews();

      }

    } catch (e) {

      console.warn(

        "Supabase product sync failed:",

        e

      );

    }

  }



  /*

   * ---------------------------------------------------------

   * ORDERS

   * ---------------------------------------------------------

   *

   * IMPORTANT:

   * This function is intended for the authenticated admin

   * console only.

   *

   * Supabase RLS remains the real security boundary.

   */



  async function pullOrders() {

    if (!ready || !client) return;



    /*

     * Never pull private customer orders on public pages.

     */

    if (

      !document.body ||

      document.body.dataset.page !== "admin"

    ) {

      return;

    }



    try {

      /*

       * Verify the current Auth session before requesting

       * private order data.

       */

      var sessionResult =

        await client.auth.getSession();



      var session =

        sessionResult &&

        sessionResult.data &&

        sessionResult.data.session;



      if (!session) {

        clearSensitiveCloudCache();

        return;

      }



      /*

       * Verify admin authorization before pulling orders.

       */

      var admin = await isAdmin();



      if (!admin) {

        clearSensitiveCloudCache();

        return;

      }



      var r = await client

        .from("orders")

        .select("*")

        .order("created_at", {

          ascending: false

        });



      if (r.error) {

        console.warn(

          "Supabase orders:",

          r.error.message

        );

        return;

      }



      var online = (r.data || [])

        .filter(function (x) {

          return x.order_type === "ONLINE";

        })

        .map(toOrder);



      safeSaveLocal(

        KEYS.online,

        online

      );



      if (

        typeof window.refreshAdminFromCloud ===

        "function"

      ) {

        window.refreshAdminFromCloud();

      }

    } catch (e) {

      console.warn(

        "Supabase order sync failed:",

        e

      );

    }

  }



  /*

   * ---------------------------------------------------------

   * REALTIME

   * ---------------------------------------------------------

   */



  function removeChannels() {

    if (!client) return;



    channels.forEach(function (channel) {

      try {

        client.removeChannel(channel);

      } catch (e) {}

    });



    channels = [];

  }



  function subscribe() {

    if (!ready || !client) return;



    removeChannels();



    /*

     * PUBLIC PRODUCT REALTIME

     *

     * Public product visibility is controlled by the

     * products table RLS policy.

     */

    var pc = client

      .channel("madhuravana-products-live")

      .on(

        "postgres_changes",

        {

          event: "*",

          schema: "public",

          table: "products"

        },

        function () {

          pullProducts();

        }

      )

      .subscribe();



    channels.push(pc);



    /*

     * PRIVATE ORDERS REALTIME

     *

     * Only subscribe on admin.html.

     *

     * RLS must prevent unauthorized users from receiving

     * private order events.

     */

    if (

      document.body &&

      document.body.dataset.page === "admin"

    ) {

      var oc = client

        .channel("madhuravana-orders-live")

        .on(

          "postgres_changes",

          {

            event: "*",

            schema: "public",

            table: "orders"

          },

          function () {

            pullOrders();

          }

        );



      channels.push(oc);



      try {

        oc.subscribe(function (status) {

          if (status === "CHANNEL_ERROR") {

            console.warn(

              "Order realtime subscription failed."

            );

          }

        });

      } catch (e) {

        console.warn(

          "Order realtime subscription failed:",

          e

        );

      }

    }

  }



  /*

   * ---------------------------------------------------------

   * AUTH STATE HANDLING

   * ---------------------------------------------------------

   */



  function bindAuthStateListener() {

    if (

      authListenerBound ||

      !client ||

      !client.auth

    ) {

      return;

    }



    authListenerBound = true;



    client.auth.onAuthStateChange(

      function (event, session) {

        /*

         * Do not perform heavy async Supabase operations

         * directly inside this callback.

         */

        setTimeout(async function () {

          try {

            /*

             * No session = definitely no authenticated admin.

             */

            if (!session) {

              removeChannels();

              clearSensitiveCloudCache();



              /*

               * If the admin page is currently open,

               * return to the login screen.

               */

              if (

                document.body &&

                document.body.dataset.page ===

                  "admin"

              ) {

                if (

                  typeof window.renderLogin ===

                  "function"

                ) {

                  window.renderLogin();

                } else {

                  /*

                   * admin.js normally keeps renderLogin

                   * private, so reload safely.

                   */

                  if (

                    event === "SIGNED_OUT" ||

                    event === "TOKEN_REFRESHED"

                  ) {

                    location.reload();

                  }

                }

              }



              return;

            }



            /*

             * If a session exists on admin.html,

             * verify that the account is still an admin.

             */

            if (

              document.body &&

              document.body.dataset.page ===

                "admin"

            ) {

              var admin = await isAdmin();



              if (!admin) {

                removeChannels();

                clearSensitiveCloudCache();



                try {

                  await client.auth.signOut();

                } catch (e) {}



                location.reload();

                return;

              }



              subscribe();

              await pullOrders();

            } else {

              /*

               * Public pages only need product realtime.

               */

              subscribe();

            }

          } catch (e) {

            console.error(

              "Auth state handling failed:",

              e

            );

          }

        }, 0);

      }

    );

  }



  /*

   * ---------------------------------------------------------

   * ADMIN CHECK

   * ---------------------------------------------------------

   */



  async function isAdmin() {

    if (!ready || !client) return false;



    try {

      var s =

        await client.auth.getSession();



      var session =

        s &&

        s.data &&

        s.data.session;



      if (!session) return false;



      /*

       * The authenticated user's UUID must exist in

       * admin_users.

       *

       * RLS must ensure this query cannot be abused to

       * manufacture admin access.

       */

      var r = await client

        .from("admin_users")

        .select("user_id")

        .eq(

          "user_id",

          session.user.id

        )

        .maybeSingle();



      if (r.error) {

        console.warn(

          "Admin verification failed:",

          r.error.message

        );

        return false;

      }



      return !!r.data;

    } catch (e) {

      console.error(

        "Admin verification error:",

        e

      );



      return false;

    }

  }



  /*

   * ---------------------------------------------------------

   * PUBLIC API

   * ---------------------------------------------------------

   */



  window.MADHURAVANA_SUPABASE = {



    init: init,



    isConfigured: function () {

      return configured() && ready;

    },



    retryInit: async function () {

      if (ready && client) return true;

      return await init();

    },



    client: function () {

      return client;

    },



    pullProducts: pullProducts,



    pullOrders: pullOrders,



    subscribe: subscribe,



    async signIn(email, password) {

      if (!ready || !client) {

        throw new Error(

          "Supabase is not configured."

        );

      }



      return await client.auth.signInWithPassword({

        email: String(email || "").trim(),

        password: String(password || "")

      });

    },



    async signOut() {

      removeChannels();

      clearSensitiveCloudCache();



      if (!ready || !client) return;



      return await client.auth.signOut();

    },



    async getSession() {

      if (!ready || !client) {

        return {

          data: {

            session: null

          }

        };

      }



      try {

        return await client.auth.getSession();

      } catch (e) {

        return {

          data: {

            session: null

          },

          error: e

        };

      }

    },



    isAdmin: isAdmin,



    async deviceStatus() {
      if (!ready || !client) return { authorized: false, reason: "not-ready" };
      var token = getDeviceToken();
      if (!token) { token = randomDeviceToken(); saveDeviceToken(token); }
      try {
        var r = await client.rpc("get_admin_device_status");
        if (r.error) return { authorized: false, reason: r.error.message || "device-check-failed", error: r.error };
        return r.data || { authorized: false, reason: "device-check-failed" };
      } catch (e) { return { authorized: false, reason: e.message || "device-check-failed", error: e }; }
    },



    async ensureDeviceAccess() {

      if (!ready || !client) return { ok: false, reason: "not-ready" };

      var status = await this.deviceStatus();

      if (status.authorized) return { ok: true, status: status };

      // Never silently trust/register the first browser.
      if (Number(status.deviceCount || 0) === 0) {
        return { ok: false, reason: "initial-device-authorization-required", bootstrap: true, status: status };
      }

      return { ok: false, reason: "device-authorization-required", status: status };

    },



    async bootstrapDevice(code) {

      if (!ready || !client) return { ok: false, reason: "not-ready" };

      var token = getDeviceToken();

      if (!token) { token = randomDeviceToken(); saveDeviceToken(token); }

      try {

        var r = await client.rpc("claim_primary_admin_device_with_bootstrap_code", {
          p_code: String(code || "").trim(),
          p_device_token: token,
          p_device_label: deviceLabel()
        });

        if (r.error) return { ok: false, reason: r.error.message || "Invalid setup PIN.", error: r.error };

        if (r.data && r.data.ok) return { ok: true, primary: true, status: r.data };

        return { ok: false, reason: (r.data && r.data.reason) || "Invalid or expired setup PIN." };

      } catch (e) { return { ok: false, reason: e.message || "Invalid setup PIN.", error: e }; }

    },



    async authorizeDevice(code) {

      if (!ready || !client) return { ok: false, reason: "not-ready" };

      var token = getDeviceToken();

      if (!token) { token = randomDeviceToken(); saveDeviceToken(token); }

      try {

        var r = await client.rpc("authorize_admin_device_with_code", { p_code: String(code || "").trim(), p_device_token: token, p_device_label: deviceLabel() });

        if (r.error) return { ok: false, reason: r.error.message || "Invalid authorization code.", error: r.error };

        if (r.data && r.data.ok) return { ok: true, status: r.data };

        return { ok: false, reason: (r.data && r.data.reason) || "Invalid or expired authorization code." };

      } catch (e) { return { ok: false, reason: e.message || "Invalid authorization code.", error: e }; }

    },



    async createDeviceCode() {

      if (!ready || !client) return { ok: false, reason: "not-ready" };

      try {

        var r = await client.rpc("create_admin_device_code");

        if (r.error) return { ok: false, reason: r.error.message || "Could not create code.", error: r.error };

        return r.data || { ok: false, reason: "Could not create code." };

      } catch (e) { return { ok: false, reason: e.message || "Could not create code.", error: e }; }

    },



    async listDevices() {

      if (!ready || !client) return { data: [], error: new Error("not-ready") };

      return await client.rpc("list_admin_devices");

    },



    async revokeDevice(deviceId) {

      if (!ready || !client) return { ok: false, reason: "not-ready" };

      var r = await client.rpc("revoke_admin_device", { p_device_id: deviceId });

      if (r.error) return { ok: false, reason: r.error.message || "Could not revoke device.", error: r.error };

      return r.data || { ok: false, reason: "Could not revoke device." };

    },



    clearDeviceToken: clearDeviceToken,



    async saveProduct(p) {

      if (!ready || !client) {

        return {

          data: null,

          error: new Error(

            "Supabase is not ready."

          ),

          cloud: false

        };

      }



      try {

        var r = await client

          .from("products")

          .upsert({

            id: p.id,

            name: p.name,

            weight: p.weight,

            price: Number(p.price),

            description: p.description || "",

            in_stock: !!p.inStock,

            amazon_url: p.amazonUrl || "",

            updated_at:

              new Date().toISOString()

          });



        return {

          data: r.data,

          error: r.error,

          cloud: true

        };

      } catch (e) {

        return {

          data: null,

          error: e,

          cloud: true

        };

      }

    },



    async deleteProduct(id) {

      if (!ready || !client) {

        return {

          error: new Error(

            "Supabase is not ready."

          ),

          cloud: false

        };

      }



      try {

        var r = await client

          .from("products")

          .delete()

          .eq("id", id);



        return {

          error: r.error,

          cloud: true

        };

      } catch (e) {

        return {

          error: e,

          cloud: true

        };

      }

    },



    async saveOrder(o) {

      if (!ready || !client) {

        return {

          data: null,

          error: new Error(

            "Supabase is not ready."

          ),

          cloud: false

        };

      }



      try {

        var r = await client

          .from("orders")

          .insert(toRow(o));



        return {

          data: r.data,

          error: r.error,

          cloud: true

        };

      } catch (e) {

        return {

          data: null,

          error: e,

          cloud: true

        };

      }

    },



    async updateOrderStatus(id, status) {

      if (!ready || !client) {

        return {

          data: null,

          error: new Error(

            "Supabase is not ready."

          ),

          cloud: false

        };

      }



      try {

        var r = await client

          .from("orders")

          .update({

            status: status

          })

          .eq("id", id);



        return {

          data: r.data,

          error: r.error,

          cloud: true

        };

      } catch (e) {

        return {

          data: null,

          error: e,

          cloud: true

        };

      }

    }

  };



  /*

   * ---------------------------------------------------------

   * STARTUP

   * ---------------------------------------------------------

   */



  window.MADHURAVANA_SUPABASE.readyPromise =

    init().then(async function (ok) {



      if (!ok) {

        return false;

      }



      /*

       * Public product catalogue.

       */

      await pullProducts();



      /*

       * Private orders ONLY on admin.html.

       */

      if (

        document.body &&

        document.body.dataset.page ===

          "admin"

      ) {

        var sessionResult =

          await client.auth.getSession();



        var session =

          sessionResult &&

          sessionResult.data &&

          sessionResult.data.session;



        if (session) {

          var admin = await isAdmin();



          if (admin) {

            await pullOrders();

          } else {

            clearSensitiveCloudCache();



            try {

              await client.auth.signOut();

            } catch (e) {}

          }

        }

      }



      /*

       * Bind auth events once initialization is complete.

       */

      bindAuthStateListener();



      /*

       * Realtime:

       * - products on public pages

       * - products + orders on admin page

       */

      subscribe();



      return true;

    }).catch(function (e) {



      console.error(

        "MADHURAVANA Supabase startup failed:",

        e

      );



      ready = false;

      client = null;



      return false;

    });



})();
