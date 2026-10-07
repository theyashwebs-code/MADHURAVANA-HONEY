

(function () {
  "use strict";

  var cfg = window.MADHURAVANA_SUPABASE_CONFIG || {};

  var ready = false;
  var client = null;
  var channels = [];
  var authListenerBound = false;

  /*
   * ---------------------------------------------------------
   * CONFIGURATION
   * ---------------------------------------------------------
   */

  function configured() {
    var url = String(cfg.url || "").trim();
    var key = String(cfg.key || "").trim();

    if (!url || !key) return false;

    if (url.indexOf("YOUR_") !== -1) return false;
    if (key.indexOf("YOUR_") !== -1) return false;

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
          "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.0"
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
