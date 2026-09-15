/**
 * Shared orders API helper (local server OR Google Apps Script cloud URL)
 * Loaded before site-content.js / used by admin via same SITE_CONFIG.ordersApi
 */
(() => {
  function getConfiguredOrdersApi() {
    const cfg = window.SITE_CONFIG || {};
    const cloud = (cfg.ordersApi || "").trim();
    return cloud;
  }

  function getOrdersApiUrl(subpath) {
    const cloud = getConfiguredOrdersApi();
    if (cloud) {
      return cloud.replace(/\/$/, "");
    }
    const rel = "api/orders" + (subpath ? "/" + subpath : "");
    return new URL(rel, window.location.href).href;
  }

  function isCloudOrdersApi() {
    const u = getConfiguredOrdersApi();
    return /script\.google\.com|macros/i.test(u);
  }

  function hasCloudOrdersApi() {
    return !!getConfiguredOrdersApi();
  }

  function looksLikeLoginHtml(text) {
    if (!text || typeof text !== "string") return false;
    const t = text.slice(0, 800).toLowerCase();
    return (
      t.includes("<!doctype html") ||
      t.includes("<html") ||
      t.includes("accounts.google.com") ||
      t.includes("sign in") ||
      t.includes("signin")
    );
  }

  function cloudAccessError() {
    return new Error(
      "Apps Script লগইন চাইছে। Deploy → Who has access = Anyone (Anyone with Google account নয়) → New version Deploy করুন।"
    );
  }

  async function parseJsonSafe(res) {
    const text = await res.text();
    if (looksLikeLoginHtml(text)) {
      throw cloudAccessError();
    }
    try {
      return JSON.parse(text);
    } catch (e) {
      throw new Error("API JSON ফেরত দেয়নি — Deploy/URL চেক করুন");
    }
  }

  async function cloudPost(body) {
    const url = getOrdersApiUrl();
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body),
      redirect: "follow",
      cache: "no-store",
    });
    // After redirect to Google login, status can still be 200 with HTML
    const json = await parseJsonSafe(res);
    return json;
  }

  async function fetchOrdersList() {
    const cloud = isCloudOrdersApi();
    const url = getOrdersApiUrl();

    if (cloud) {
      // Prefer POST list — more reliable than GET with Apps Script redirects
      try {
        const json = await cloudPost({ action: "list" });
        if (json && json.success && Array.isArray(json.orders)) return json.orders;
        throw new Error((json && json.error) || "cloud bad payload");
      } catch (err) {
        // Fallback GET (older scripts)
        const res = await fetch(url + (url.includes("?") ? "&" : "?") + "_=" + Date.now(), {
          method: "GET",
          cache: "no-store",
          redirect: "follow",
        });
        const json = await parseJsonSafe(res);
        if (json && json.success && Array.isArray(json.orders)) return json.orders;
        throw err;
      }
    }

    const res = await fetch(url, { cache: "no-store" });
    const json = await parseJsonSafe(res);
    if (json && json.success && Array.isArray(json.orders)) return json.orders;
    throw new Error("api bad payload");
  }

  async function createOrderRemote(orderPayload) {
    const cloud = isCloudOrdersApi();
    const url = getOrdersApiUrl();

    if (cloud) {
      const json = await cloudPost({ action: "create", ...orderPayload });
      if (json && json.success && json.order) return json.order;
      throw new Error((json && json.error) || "cloud create bad payload");
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(orderPayload),
    });
    const json = await parseJsonSafe(res);
    if (json && json.success && json.order) return json.order;
    throw new Error("api create bad payload");
  }

  async function updateOrderRemote(orderId, nextStatusOrPatch) {
    const cloud = isCloudOrdersApi();
    const url = getOrdersApiUrl();
    const patch =
      typeof nextStatusOrPatch === "string"
        ? { status: nextStatusOrPatch }
        : nextStatusOrPatch || {};

    if (cloud) {
      const json = await cloudPost({ action: "update", id: orderId, ...patch });
      if (json && json.success) return json.order || true;
      throw new Error((json && json.error) || "cloud update bad");
    }

    const res = await fetch(getOrdersApiUrl(encodeURIComponent(orderId)), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const json = await parseJsonSafe(res);
    if (json && json.success) return json.order || true;
    throw new Error("api update bad");
  }

  async function deleteOrderRemote(orderId) {
    const cloud = isCloudOrdersApi();

    if (cloud) {
      const json = await cloudPost({ action: "delete", id: orderId });
      if (json && json.success) return true;
      throw new Error((json && json.error) || "cloud delete bad");
    }

    await fetch(getOrdersApiUrl(encodeURIComponent(orderId)), { method: "DELETE" });
    return true;
  }

  /** Admin: verify cloud URL works (no write). */
  async function testCloudConnection(overrideUrl) {
    const configured = (overrideUrl || getConfiguredOrdersApi() || "").trim();
    if (!configured) {
      return { ok: false, message: "আগে ordersApi URL বসান" };
    }
    try {
      const res = await fetch(configured.replace(/\/$/, ""), {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "list" }),
        redirect: "follow",
        cache: "no-store",
      });
      const text = await res.text();
      if (looksLikeLoginHtml(text) || /accounts\.google\.com/i.test(res.url || "")) {
        return {
          ok: false,
          message:
            "❌ লগইন পেজ আসছে। Deploy-এ Who has access = Anyone দিন (Google account ওয়ালা নয়), তারপর New version → Deploy।",
        };
      }
      let json;
      try {
        json = JSON.parse(text);
      } catch (e) {
        return { ok: false, message: "❌ JSON আসেনি। /exec URL ও Web app Deploy ঠিক আছে কি?" };
      }
      if (json && json.success && Array.isArray(json.orders)) {
        return {
          ok: true,
          message: "✅ Sync কাজ করছে — অর্ডার: " + json.orders.length + "টি",
          count: json.orders.length,
        };
      }
      return { ok: false, message: "❌ " + ((json && json.error) || "অজানা রেসপন্স") };
    } catch (err) {
      return { ok: false, message: "❌ " + (err && err.message ? err.message : String(err)) };
    }
  }

  window.OrdersAPI = {
    getConfiguredOrdersApi,
    getOrdersApiUrl,
    isCloudOrdersApi,
    hasCloudOrdersApi,
    fetchOrdersList,
    createOrderRemote,
    updateOrderRemote,
    deleteOrderRemote,
    testCloudConnection,
  };
})();
