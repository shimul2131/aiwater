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

  async function parseJsonSafe(res) {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      return null;
    }
  }

  async function fetchOrdersList() {
    const cloud = isCloudOrdersApi();
    const url = getOrdersApiUrl();

    if (cloud) {
      // GET list from Apps Script
      const res = await fetch(url + (url.includes("?") ? "&" : "?") + "_=" + Date.now(), {
        method: "GET",
        cache: "no-store",
        redirect: "follow",
      });
      if (!res.ok) throw new Error("cloud get failed");
      const json = await parseJsonSafe(res);
      if (json && json.success && Array.isArray(json.orders)) return json.orders;
      throw new Error("cloud bad payload");
    }

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("api get failed");
    const json = await parseJsonSafe(res);
    if (json && json.success && Array.isArray(json.orders)) return json.orders;
    throw new Error("api bad payload");
  }

  async function createOrderRemote(orderPayload) {
    const cloud = isCloudOrdersApi();
    const url = getOrdersApiUrl();

    if (cloud) {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "create", ...orderPayload }),
        redirect: "follow",
      });
      if (!res.ok) throw new Error("cloud create failed");
      const json = await parseJsonSafe(res);
      if (json && json.success && json.order) return json.order;
      throw new Error((json && json.error) || "cloud create bad payload");
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(orderPayload),
    });
    if (!res.ok) throw new Error("api create failed");
    const json = await parseJsonSafe(res);
    if (json && json.success && json.order) return json.order;
    throw new Error("api create bad payload");
  }

  async function updateOrderRemote(orderId, nextStatus) {
    const cloud = isCloudOrdersApi();
    const url = getOrdersApiUrl();

    if (cloud) {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "update", id: orderId, status: nextStatus }),
        redirect: "follow",
      });
      if (!res.ok) throw new Error("cloud update failed");
      const json = await parseJsonSafe(res);
      if (json && json.success) return json.order || true;
      throw new Error((json && json.error) || "cloud update bad");
    }

    const res = await fetch(getOrdersApiUrl(encodeURIComponent(orderId)), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (!res.ok) throw new Error("api update failed");
    const json = await parseJsonSafe(res);
    if (json && json.success) return json.order || true;
    throw new Error("api update bad");
  }

  async function deleteOrderRemote(orderId) {
    const cloud = isCloudOrdersApi();
    const url = getOrdersApiUrl();

    if (cloud) {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "delete", id: orderId }),
        redirect: "follow",
      });
      if (!res.ok) throw new Error("cloud delete failed");
      const json = await parseJsonSafe(res);
      if (json && json.success) return true;
      throw new Error((json && json.error) || "cloud delete bad");
    }

    await fetch(getOrdersApiUrl(encodeURIComponent(orderId)), { method: "DELETE" });
    return true;
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
  };
})();
