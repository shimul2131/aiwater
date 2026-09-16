(() => {
  // Password is never printed on the login page.
  // Kept split so it is not obvious in HTML; change by editing these parts.
  const ADMIN_PASSWORD = ["fres", "1234"].join("");

  // Elements
  const loginScreen = document.getElementById('login-screen');
  const dashboardScreen = document.getElementById('dashboard-screen');
  const loginForm = document.getElementById('login-form');
  const adminPassInput = document.getElementById('admin-pass');
  const loginError = document.getElementById('login-error');
  const btnLogout = document.getElementById('btn-logout');

  // Dashboard Elements
  const kpiTotal = document.getElementById('kpi-total');
  const kpiPending = document.getElementById('kpi-pending');
  const kpiConfirmed = document.getElementById('kpi-confirmed');
  const kpiDelivered = document.getElementById('kpi-delivered');
  const kpiRevenue = document.getElementById('kpi-revenue');
  const kpiPendingBadge = document.getElementById('kpi-pending-badge');

  const countAll = document.getElementById('count-all');
  const countPending = document.getElementById('count-pending');
  const countConfirmed = document.getElementById('count-confirmed');
  const countProcessing = document.getElementById('count-processing');
  const countReady = document.getElementById('count-ready');
  const countShipped = document.getElementById('count-shipped');
  const countDelivered = document.getElementById('count-delivered');
  const countCancelled = document.getElementById('count-cancelled');

  const filterTabs = document.getElementById('filter-tabs');
  const orderSearch = document.getElementById('order-search');
  const btnClearSearch = document.getElementById('btn-clear-search');
  const ordersGrid = document.getElementById('orders-grid');
  const ordersEmpty = document.getElementById('orders-empty');
  const emptyMessage = document.getElementById('empty-message');

  const btnManualRefresh = document.getElementById('btn-manual-refresh');
  const btnSoundToggle = document.getElementById('btn-sound-toggle');
  const soundIcon = document.getElementById('sound-icon');
  const orderSound = document.getElementById('order-sound');
  const toastContainer = document.getElementById('toast-container');

  // Invoice Modal
  const invoiceModal = document.getElementById('invoice-modal');
  const btnCloseInvoice = document.getElementById('btn-close-invoice');

  // App State
  let orders = [];
  let currentFilter = 'all';
  let searchQuery = '';
  let soundEnabled = true;
  let previousOrderIds = new Set();
  let pollTimer = null;

  // Format Bangla Currency
  function formatBdt(amount) {
    if (!Number.isFinite(amount)) return '৳০';
    return '৳' + Math.round(amount).toLocaleString('en-US');
  }

  // Format Date & Time nicely in Bangla
  function formatDateTime(isoString) {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleString('bn-BD', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Dhaka'
      });
    } catch {
      return isoString;
    }
  }

  // Toast Notification
  function showToast(message, type = 'success') {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = (type === 'success' ? '✓ ' : 'ℹ ') + message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // Play New Order Sound
  function playNotificationSound() {
    if (!soundEnabled || !orderSound) return;
    try {
      orderSound.currentTime = 0;
      const playPromise = orderSound.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Autoplay was prevented
        });
      }
    } catch (e) {
      // Audio error ignored
    }
  }

  // ====================================================
  // AUTHENTICATION
  // ====================================================
  function checkAuth() {
    const isAuth = sessionStorage.getItem('ai_controller_admin_auth') === 'true';
    if (isAuth) {
      showDashboard();
    } else {
      showLogin();
    }
  }

  function showLogin() {
    if (loginScreen) {
      loginScreen.hidden = false;
      loginScreen.style.display = "";
    }
    if (dashboardScreen) {
      dashboardScreen.hidden = true;
      dashboardScreen.style.display = "none";
    }
    if (pollTimer) clearInterval(pollTimer);
  }

  function showDashboard() {
    if (loginScreen) {
      loginScreen.hidden = true;
      loginScreen.style.display = "none";
    }
    if (dashboardScreen) {
      dashboardScreen.hidden = false;
      dashboardScreen.style.display = "";
    }
    fetchOrders(true);
    startPolling();
    if (typeof fetchAdminReviews === "function") fetchAdminReviews();
    if (typeof fetchAdminComments === "function") fetchAdminComments();
    if (typeof fillManageForms === "function") fillManageForms();
    else if (typeof fillVideoForm === "function") fillVideoForm();
    if (typeof showAdminPanel === "function") showAdminPanel("orders");
  }

  if (loginForm && adminPassInput) {
    function tryLogin(e) {
      if (e) e.preventDefault();
      try {
        const entered = String(adminPassInput.value || "")
          .trim()
          .replace(/\u200b/g, "")
          .replace(/\s+/g, "");
        if (entered === ADMIN_PASSWORD) {
          sessionStorage.setItem("ai_controller_admin_auth", "true");
          if (loginError) loginError.hidden = true;
          showDashboard();
        } else {
          if (loginError) {
            loginError.hidden = false;
            loginError.textContent = "❌ ভুল পাসওয়ার্ড! আবার চেষ্টা করুন।";
          }
          adminPassInput.focus();
          adminPassInput.select();
        }
      } catch (err) {
        if (loginError) {
          loginError.hidden = false;
          loginError.textContent = "❌ লগইন সমস্যা। পেজ রিফ্রেশ করে আবার চেষ্টা করুন।";
        }
      }
    }

    loginForm.addEventListener("submit", tryLogin);
    const btnLogin = document.getElementById("btn-login");
    if (btnLogin) {
      btnLogin.addEventListener("click", tryLogin);
    }
  }

  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      if (confirm('আপনি কি অ্যাডমিন প্যানেল থেকে লগআউট করতে চান?')) {
        sessionStorage.removeItem('ai_controller_admin_auth');
        showLogin();
      }
    });
  }

  // ====================================================
  // DATA FETCHING & SYNC
  // ====================================================
  function getApiUrl(subpath = '') {
    if (window.OrdersAPI) return window.OrdersAPI.getOrdersApiUrl(subpath);
    const rel = 'api/orders' + (subpath ? '/' + subpath : '');
    return new URL(rel, window.location.href).href;
  }

  async function updateOrdersApiBanner() {
    const banner = document.getElementById('orders-api-banner');
    const syncBox = document.getElementById('order-sync-box');
    const pcAlert = document.getElementById('pc-sync-alert');
    const bannerText = document.getElementById('orders-api-banner-text');
    const hasCloud = window.OrdersAPI && window.OrdersAPI.hasCloudOrdersApi();

    let cloudOk = false;
    let failMsg = "";
    if (hasCloud && window.OrdersAPI.testCloudConnection) {
      try {
        const result = await window.OrdersAPI.testCloudConnection();
        cloudOk = !!(result && result.ok);
        if (!cloudOk) failMsg = (result && result.message) || "";
      } catch (e) {
        cloudOk = false;
        failMsg = e && e.message ? e.message : String(e);
      }
    } else {
      failMsg =
        'লাইভে <code>site-config.js</code> নেই বা ordersApi খালি। GitHub-এ <code>site-config.js</code> আপলোড করুন। এখন ফোন Admin → <b>Copy JSON</b> → পিসি <b>Paste Import</b>।';
    }

    if (!cloudOk && bannerText) {
      bannerText.innerHTML =
        failMsg ||
        'ক্লাউড Sync ব্যর্থ। Order Sync → <b>Test Sync</b> চাপুন। পুরনো অর্ডার: ফোন <b>Copy JSON</b> → পিসি <b>Paste Import</b>।';
    }

    const showWarn = !cloudOk;
    if (banner) banner.hidden = !showWarn;
    if (syncBox) syncBox.hidden = cloudOk;
    if (pcAlert) pcAlert.hidden = cloudOk;
  }

  function readLocalOrders() {
    try {
      const local = localStorage.getItem('ai_controller_orders');
      return local ? JSON.parse(local) : [];
    } catch (e) {
      return [];
    }
  }

  function statusRank(status) {
    if (status === 'delivered') return 6;
    if (status === 'shipped') return 5;
    if (status === 'ready_to_ship') return 4;
    if (status === 'processing') return 3;
    if (status === 'confirmed') return 2;
    if (status === 'cancelled' || status === 'returned') return 0;
    return 1; // pending
  }

  // Merge API + localStorage so confirm/cancel is not wiped by the next poll
  // (static host: API missing; or local-only orders; or PATCH failed but UI updated)
  function mergeOrders(serverOrders, localOrders) {
    const map = new Map();

    (serverOrders || []).forEach(o => {
      if (o && o.id) map.set(o.id, o);
    });

    (localOrders || []).forEach(o => {
      if (!o || !o.id) return;
      const existing = map.get(o.id);
      if (!existing) {
        map.set(o.id, o);
        return;
      }
      const localNewer =
        statusRank(o.status) > statusRank(existing.status) ||
        (o.status === existing.status &&
          o.confirmedAt &&
          (!existing.confirmedAt || String(o.confirmedAt) > String(existing.confirmedAt)));
      if (localNewer) {
        map.set(o.id, { ...existing, ...o });
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    });
  }

  function setActiveFilter(filter) {
    currentFilter = filter || 'all';
    if (filterTabs) {
      filterTabs.querySelectorAll('.filter-tab').forEach(b => {
        b.classList.toggle('is-active', b.getAttribute('data-filter') === currentFilter);
      });
    }
  }

  async function fetchOrders(isFirstLoad = false) {
    let serverOrders = null;
    const localOrders = readLocalOrders();

    try {
      if (window.OrdersAPI) {
        serverOrders = await window.OrdersAPI.fetchOrdersList();
      } else {
        const res = await fetch(getApiUrl(), { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.orders)) {
            serverOrders = json.orders;
          }
        }
      }
    } catch (err) {
      // Server/cloud not reachable
    }

    const fetched = serverOrders
      ? mergeOrders(serverOrders, localOrders)
      : localOrders;

    try {
      localStorage.setItem('ai_controller_orders', JSON.stringify(fetched));
    } catch (e) {}

    // Check for newly arrived orders
    if (!isFirstLoad && fetched.length > 0) {
      let hasNewOrder = false;
      fetched.forEach(o => {
        if (!previousOrderIds.has(o.id) && o.status === 'pending') {
          hasNewOrder = true;
        }
      });

      if (hasNewOrder) {
        playNotificationSound();
        showToast('🔔 নতুন অর্ডার এসেছে! চেক করুন।', 'success');
      }
    }

    previousOrderIds = new Set(fetched.map(o => o.id));
    orders = fetched;
    await updateOrdersApiBanner();
    renderAll();
  }

  function startPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(() => {
      fetchOrders(false);
    }, 8000);
  }

  // Save Orders (handles both API and LocalStorage)
  async function updateOrderStatus(orderId, nextStatusOrPatch) {
    const patch =
      typeof nextStatusOrPatch === 'string'
        ? { status: nextStatusOrPatch }
        : Object.assign({}, nextStatusOrPatch || {});
    const nextStatus = patch.status;

    try {
      if (window.OrdersAPI) {
        await window.OrdersAPI.updateOrderRemote(orderId, patch);
      } else {
        const res = await fetch(getApiUrl(encodeURIComponent(orderId)), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch)
        });
        if (res.ok) {
          await res.json().catch(() => ({}));
        }
      }
    } catch (e) {}

    orders = orders.map(o => {
      if (o.id !== orderId) return o;
      const merged = Object.assign({}, o, patch);
      if (nextStatus === 'confirmed') {
        merged.confirmedAt = o.confirmedAt || new Date().toISOString();
      }
      return merged;
    });

    try {
      localStorage.setItem('ai_controller_orders', JSON.stringify(orders));
    } catch (e) {}

    if (
      nextStatus === 'confirmed' ||
      nextStatus === 'processing' ||
      nextStatus === 'ready_to_ship' ||
      nextStatus === 'shipped' ||
      nextStatus === 'delivered' ||
      nextStatus === 'cancelled'
    ) {
      setActiveFilter(nextStatus);
    }

    renderAll();

    if (nextStatus === 'confirmed') {
      showToast(`অর্ডার #${orderId} কনফার্ম হয়েছে — হ্যান্ডেল প্যানেল খুলছে...`, 'success');
      setTimeout(() => openHandlePanel(orderId), 250);
    } else if (nextStatus === 'processing') {
      showToast(`অর্ডার #${orderId} প্রসেসিং-এ আছে`, 'success');
    } else if (nextStatus === 'ready_to_ship') {
      showToast(`অর্ডার #${orderId} শিপমেন্টের জন্য রেডি`, 'success');
    } else if (nextStatus === 'shipped') {
      showToast(`অর্ডার #${orderId} শিপড হয়েছে`, 'success');
    } else if (nextStatus === 'delivered') {
      showToast(`অর্ডার #${orderId} ডেলিভারি সম্পন্ন চিহ্নিত হয়েছে।`, 'success');
    } else if (nextStatus === 'cancelled') {
      showToast(`অর্ডার #${orderId} বাতিল করা হয়েছে।`, 'error');
    }
  }

  async function deleteOrder(orderId) {
    if (!confirm(`আপনি কি নিশ্চিত যে অর্ডার #${orderId} মুছে ফেলতে চান?`)) return;

    try {
      if (window.OrdersAPI) {
        await window.OrdersAPI.deleteOrderRemote(orderId);
      } else {
        await fetch(getApiUrl(encodeURIComponent(orderId)), { method: 'DELETE' });
      }
    } catch (e) {}

    orders = orders.filter(o => o.id !== orderId);
    try {
      localStorage.setItem('ai_controller_orders', JSON.stringify(orders));
    } catch (e) {}

    showToast(`অর্ডার #${orderId} মুছে ফেলা হয়েছে।`, 'info');
    renderAll();
  }

  // ====================================================
  // RENDERING
  // ====================================================
  function renderAll() {
    updateKPIs();
    renderOrders();
    renderDashboardRecent();
  }

  function renderDashboardRecent() {
    const wrap = document.getElementById('dashboard-recent-orders');
    if (!wrap) return;
    const recent = (orders || []).slice(0, 6);
    if (!recent.length) {
      wrap.innerHTML = '<p class="cms-empty">No orders yet. New website orders will appear here.</p>';
      return;
    }
    wrap.innerHTML = recent.map((o) => {
      const status = o.status || 'pending';
      return (
        '<button type="button" class="cms-recent-item" data-goto="orders">' +
          '<div>' +
            '<strong>#' + escapeHtml(o.id) + '</strong>' +
            '<span>' + escapeHtml(o.name || 'Customer') + ' · ' + escapeHtml(o.phone || '') + '</span>' +
          '</div>' +
          '<em class="cms-status cms-status-' + status + '">' + status + '</em>' +
        '</button>'
      );
    }).join('');
  }

  function updateKPIs() {
    const total = orders.length;
    const pending = orders.filter(o => o.status === 'pending').length;
    const confirmed = orders.filter(o => o.status === 'confirmed').length;
    const processing = orders.filter(o => o.status === 'processing').length;
    const ready = orders.filter(o => o.status === 'ready_to_ship').length;
    const shipped = orders.filter(o => o.status === 'shipped').length;
    const delivered = orders.filter(o => o.status === 'delivered').length;
    const cancelled = orders.filter(o => o.status === 'cancelled').length;

    const confirmedRevenue = orders
      .filter(o =>
        o.status === 'confirmed' ||
        o.status === 'processing' ||
        o.status === 'ready_to_ship' ||
        o.status === 'shipped' ||
        o.status === 'delivered'
      )
      .reduce((sum, o) => sum + (Number(o.totalPrice) || 0), 0);

    if (kpiTotal) kpiTotal.textContent = String(total);
    if (kpiPending) kpiPending.textContent = String(pending);
    if (kpiConfirmed) kpiConfirmed.textContent = String(confirmed + processing + ready);
    if (kpiDelivered) kpiDelivered.textContent = String(delivered);
    if (kpiRevenue) kpiRevenue.textContent = formatBdt(confirmedRevenue);

    if (kpiPendingBadge) {
      kpiPendingBadge.hidden = pending === 0;
      kpiPendingBadge.textContent = pending + ' new';
    }
    const sideBadge = document.getElementById('sidebar-pending-count');
    if (sideBadge) {
      sideBadge.hidden = pending === 0;
      sideBadge.textContent = String(pending);
    }

    if (countAll) countAll.textContent = String(total);
    if (countPending) countPending.textContent = String(pending);
    if (countConfirmed) countConfirmed.textContent = String(confirmed);
    if (countProcessing) countProcessing.textContent = String(processing);
    if (countReady) countReady.textContent = String(ready);
    if (countShipped) countShipped.textContent = String(shipped);
    if (countDelivered) countDelivered.textContent = String(delivered);
    if (countCancelled) countCancelled.textContent = String(cancelled);
  }

  function getFilteredOrders() {
    return orders.filter(order => {
      // Status filter
      if (currentFilter !== 'all' && order.status !== currentFilter) {
        return false;
      }
      // Search query
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const idMatch = (order.id || '').toLowerCase().includes(q);
        const nameMatch = (order.name || '').toLowerCase().includes(q);
        const phoneMatch = (order.phone || '').toLowerCase().includes(q);
        const addressMatch = (order.address || '').toLowerCase().includes(q);
        if (!idMatch && !nameMatch && !phoneMatch && !addressMatch) {
          return false;
        }
      }
      return true;
    });
  }

  function renderOrders() {
    if (!ordersGrid) return;
    const filtered = getFilteredOrders();

    if (filtered.length === 0) {
      ordersGrid.innerHTML = '';
      if (ordersEmpty) {
        ordersEmpty.hidden = false;
        if (searchQuery) {
          emptyMessage.textContent = `"${searchQuery}" এর সাথে মিলে এমন কোনো অর্ডার পাওয়া যায়নি।`;
        } else if (currentFilter === 'pending') {
          emptyMessage.textContent = 'কোনো পেন্ডিং অর্ডার নেই।';
        } else if (currentFilter === 'confirmed') {
          emptyMessage.textContent = 'কোনো কনফার্মড অর্ডার নেই।';
        } else if (currentFilter === 'delivered') {
          emptyMessage.textContent = 'কোনো ডেলিভার্ড অর্ডার নেই।';
        } else if (currentFilter === 'cancelled') {
          emptyMessage.textContent = 'কোনো বাতিল অর্ডার নেই।';
        } else {
          emptyMessage.textContent = 'এখনও কোনো গ্রাহক অর্ডার করেননি। গ্রাহক অর্ডার করলেই এখানে চলে আসবে।';
        }
      }
      return;
    }

    if (ordersEmpty) ordersEmpty.hidden = true;

    ordersGrid.innerHTML = filtered.map(order => createOrderCardHtml(order)).join('');
  }

  function createOrderCardHtml(order) {
    const status = order.status || 'pending';
    const cableFeet = Number(order.cableFeet) || 0;
    const cablePrice = Number(order.cablePrice) || (cableFeet * 8);
    const totalPrice = Number(order.totalPrice) || (4500 + 1550 + cablePrice);
    const timeFormatted = formatDateTime(order.createdAt);

    let statusBadgeText = 'পেন্ডিং';
    let badgeClass = 'badge-pending';
    if (status === 'confirmed') {
      statusBadgeText = 'কনফার্মড';
      badgeClass = 'badge-confirmed';
    } else if (status === 'processing') {
      statusBadgeText = 'প্রসেসিং';
      badgeClass = 'badge-processing';
    } else if (status === 'ready_to_ship') {
      statusBadgeText = 'শিপ রেডি';
      badgeClass = 'badge-ready';
    } else if (status === 'shipped') {
      statusBadgeText = 'শিপড';
      badgeClass = 'badge-shipped';
    } else if (status === 'delivered') {
      statusBadgeText = 'ডেলিভার্ড';
      badgeClass = 'badge-delivered';
    } else if (status === 'cancelled') {
      statusBadgeText = 'বাতিল';
      badgeClass = 'badge-cancelled';
    } else if (status === 'returned') {
      statusBadgeText = 'রিটার্ন';
      badgeClass = 'badge-cancelled';
    }

    const cleanPhone = getCleanPhone(order.phone);
    const waConfirmMsg = encodeURIComponent(buildWaConfirmText(order));
    const telHref = 'tel:' + escapeHtml(order.phone || '');
    const waHref = 'https://wa.me/' + cleanPhone + '?text=' + waConfirmMsg;
    const pipeline = ['pending', 'confirmed', 'processing', 'ready_to_ship', 'shipped', 'delivered'];
    const pipeIdx = pipeline.indexOf(status);

    return `
      <article class="order-card status-${status}" data-id="${order.id}">
        <div class="order-card-header">
          <div class="order-header-left">
            <span class="order-id">#${escapeHtml(order.id)}</span>
            <span class="order-time">${escapeHtml(timeFormatted)}</span>
          </div>
          <span class="status-badge ${badgeClass}">${statusBadgeText}</span>
        </div>

        <div class="order-pipeline" aria-hidden="true">
          ${pipeline.map((s, i) => '<span class="pipe-dot' + (i <= pipeIdx && pipeIdx >= 0 ? ' is-on' : '') + '"></span>').join('<span class="pipe-line"></span>')}
        </div>

        <div class="order-card-body">
          <div class="customer-info-box">
            <div class="info-box-title">👤 গ্রাহকের তথ্য</div>
            <div class="info-row">
              <strong>নাম:</strong> <span>${escapeHtml(order.name || '')}</span>
            </div>
            <div class="info-row">
              <strong>মোবাইল:</strong>
              <div class="customer-phone-wrap">
                <span class="customer-phone-number">${escapeHtml(order.phone || '')}</span>
                <a href="${telHref}" class="btn-phone-call" title="কল করুন">📞 কল</a>
                <a href="${waHref}" target="_blank" rel="noopener noreferrer" class="btn-phone-wa" title="WhatsApp-এ মেসেজ">💬 WhatsApp</a>
              </div>
            </div>
            <div class="info-row">
              <strong>ঠিকানা:</strong> <span>${escapeHtml(order.address || '')}</span>
            </div>
            ${order.note ? `
              <div class="customer-note-badge">
                <strong>নোট:</strong> ${escapeHtml(order.note)}
              </div>
            ` : ''}
          </div>

          <div class="package-info-box">
            <div class="info-box-title">📦 পণ্যের বিবরণ</div>
            <div class="info-row">
              <strong>ডিভাইস:</strong> <span>AI Controller + Premium Sensor</span>
            </div>
            <div class="info-row">
              <strong>Sensor Cable:</strong> <span>${cableFeet} ফুট (${formatBdt(cablePrice)})</span>
            </div>
            <div class="info-row">
              <strong>পেমেন্ট মাধ্যম:</strong> <span>ক্যাশ অন ডেলিভারি (COD)</span>
            </div>
            <div class="info-row" style="margin-top: 0.5rem; padding-top: 0.45rem; border-top: 1px dashed #cbd5e1;">
              <strong>সর্বমোট বিল:</strong>
              <span class="package-total-price">${formatBdt(totalPrice)}</span>
            </div>
            ${order.courierName || order.consignmentNo ? `
              <div class="confirmed-tag">
                🚚 ${escapeHtml(order.courierName || 'Courier')}
                ${order.consignmentNo ? ' · CN: <strong>' + escapeHtml(order.consignmentNo) + '</strong>' : ''}
                ${order.courierCharge !== '' && order.courierCharge != null ? ' · চার্জ ' + formatBdt(Number(order.courierCharge) || 0) : ''}
              </div>
            ` : ''}
            ${order.steadfastTracking ? `
              <div class="confirmed-tag steadfast-tag">
                Steadfast Tracking: <strong>${escapeHtml(order.steadfastTracking)}</strong>
              </div>
            ` : ''}
          </div>
        </div>

        ${(status === 'confirmed' || status === 'processing' || status === 'ready_to_ship') ? `
          <div class="confirmed-handle-bar">
            <p class="confirmed-handle-title">হ্যান্ডেল টুলস</p>
            <div class="confirmed-handle-actions">
              <a class="btn-handle-mini btn-handle-call" href="${telHref}">📞 কল</a>
              <a class="btn-handle-mini btn-handle-wa" href="${waHref}" target="_blank" rel="noopener noreferrer">💬 WhatsApp</a>
              <button type="button" class="btn-handle-mini btn-handle-copy" onclick="window.adminActions.copyAddress('${order.id}')">📋 ঠিকানা</button>
              <button type="button" class="btn-handle-mini btn-handle-print" onclick="window.adminActions.openInvoice('${order.id}')">🖨 রশিদ</button>
              <button type="button" class="btn-handle-mini btn-steadfast" onclick="window.adminActions.sendSteadfast('${order.id}')">Steadfast API</button>
              <button type="button" class="btn-handle-mini btn-courier-manual" onclick="window.adminActions.openCourier('${order.id}')">📝 Manual Courier</button>
            </div>
          </div>
        ` : ''}

        <div class="order-card-footer">
          <div class="actions-primary">
            ${status === 'pending' ? `
              <button type="button" class="btn-action-confirm" onclick="window.adminActions.confirmOrder('${order.id}')">✓ Confirm Order</button>
              <button type="button" class="btn-action-cancel" onclick="window.adminActions.cancelOrder('${order.id}')">✕ বাতিল</button>
            ` : ''}

            ${status === 'confirmed' ? `
              <button type="button" class="btn-action-confirm" onclick="window.adminActions.setStatus('${order.id}','processing')">→ Processing</button>
              <button type="button" class="btn-action-deliver" onclick="window.adminActions.openCourier('${order.id}')">📝 Manual Courier → Ship</button>
              <button type="button" class="btn-action-cancel" onclick="window.adminActions.cancelOrder('${order.id}')">✕ বাতিল</button>
            ` : ''}

            ${status === 'processing' ? `
              <button type="button" class="btn-action-confirm" onclick="window.adminActions.setStatus('${order.id}','ready_to_ship')">→ Ready to Ship</button>
              <button type="button" class="btn-action-deliver" onclick="window.adminActions.openCourier('${order.id}')">📝 Manual Courier → Ship</button>
              <button type="button" class="btn-action-cancel" onclick="window.adminActions.cancelOrder('${order.id}')">✕ বাতিল</button>
            ` : ''}

            ${status === 'ready_to_ship' ? `
              <button type="button" class="btn-action-deliver" onclick="window.adminActions.openCourier('${order.id}')">📝 Manual Courier → Shipped</button>
              <button type="button" class="btn-action-confirm btn-steadfast-main" onclick="window.adminActions.sendSteadfast('${order.id}')">🚚 Steadfast API</button>
              <button type="button" class="btn-action-cancel" onclick="window.adminActions.cancelOrder('${order.id}')">✕ বাতিল</button>
            ` : ''}

            ${status === 'shipped' ? `
              <button type="button" class="btn-action-deliver" onclick="window.adminActions.deliverOrder('${order.id}')">✓ Delivered</button>
              <button type="button" class="btn-action-pending" onclick="window.adminActions.openCourier('${order.id}')">✎ Courier Edit</button>
            ` : ''}

            ${status === 'delivered' ? `
              <span style="color: var(--blue); font-weight: 700; font-size: 0.88rem;">✓ ডেলিভারি সম্পন্ন</span>
            ` : ''}

            ${status === 'cancelled' ? `
              <span style="color: var(--rose); font-weight: 700; font-size: 0.88rem;">বাতিলকৃত অর্ডার</span>
              <button type="button" class="btn-action-pending" onclick="window.adminActions.pendingOrder('${order.id}')">↩️ সক্রিয় করুন</button>
            ` : ''}
          </div>

          <div class="actions-secondary">
            <button type="button" class="btn-action-print" onclick="window.adminActions.openEdit('${order.id}')" title="এডিট">✎ এডিট</button>
            <button type="button" class="btn-action-print" onclick="window.adminActions.openInvoice('${order.id}')" title="প্রিন্ট রশিদ">🖨 রশিদ</button>
            <button type="button" class="btn-action-delete" onclick="window.adminActions.deleteOrder('${order.id}')" title="অর্ডার মুছুন">🗑</button>
          </div>
        </div>
      </article>
    `;
  }

  function getCleanPhone(phone) {
    let cleanPhone = String(phone || '').replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = '88' + cleanPhone;
    return cleanPhone;
  }

  function buildWaConfirmText(order) {
    const cableFeet = Number(order.cableFeet) || 0;
    const totalPrice = Number(order.totalPrice) || 0;
    return (
      `আসসালামু আলাইকুম ${order.name || ''} সাহেব,\n` +
      `AI Water Controller-এ আপনার অর্ডার (#${order.id}) কনফার্ম করা হয়েছে।\n` +
      `প্যাকেজ: Controller + Premium Sensor\n` +
      `ক্যাবল: ${cableFeet} ফুট\n` +
      `মোট মূল্য: ${formatBdt(totalPrice)} (ক্যাশ অন ডেলিভারি)\n` +
      `ঠিকানা: ${order.address || ''}\n` +
      `আমরা শীঘ্রই পণ্যটি পাঠিয়ে দিচ্ছি। ধন্যবাদ!`
    );
  }

  function buildOrderSummaryText(order) {
    const cableFeet = Number(order.cableFeet) || 0;
    const totalPrice = Number(order.totalPrice) || 0;
    return (
      `অর্ডার #${order.id}\n` +
      `নাম: ${order.name || ''}\n` +
      `মোবাইল: ${order.phone || ''}\n` +
      `ঠিকানা: ${order.address || ''}\n` +
      `প্যাকেজ: AI Controller + Premium Sensor\n` +
      `ক্যাবল: ${cableFeet} ফুট\n` +
      `মোট: ${formatBdt(totalPrice)} (COD)\n` +
      (order.note ? `নোট: ${order.note}\n` : '')
    );
  }

  async function copyText(text, okMsg) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      showToast(okMsg || 'কপি হয়েছে!', 'success');
    } catch (e) {
      showToast('কপি করা যায়নি। ম্যানুয়ালি সিলেক্ট করুন।', 'error');
    }
  }

  // ====================================================
  // HANDLE PANEL (after confirm)
  // ====================================================
  const handleModal = document.getElementById('handle-modal');
  const btnCloseHandle = document.getElementById('btn-close-handle');
  let handleOrderId = null;

  function closeHandlePanel() {
    if (handleModal) handleModal.hidden = true;
    handleOrderId = null;
  }

  function openHandlePanel(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (!order || !handleModal) return;

    handleOrderId = orderId;
    const cableFeet = Number(order.cableFeet) || 0;
    const totalPrice = Number(order.totalPrice) || (4500 + 1550 + cableFeet * 8);
    const cleanPhone = getCleanPhone(order.phone);
    const waHref = 'https://wa.me/' + cleanPhone + '?text=' + encodeURIComponent(buildWaConfirmText(order));
    const telHref = 'tel:' + (order.phone || '');

    const meta = document.getElementById('handle-order-meta');
    const nameEl = document.getElementById('handle-name');
    const phoneEl = document.getElementById('handle-phone');
    const addressEl = document.getElementById('handle-address');
    const totalEl = document.getElementById('handle-total');
    const btnCall = document.getElementById('handle-btn-call');
    const btnWa = document.getElementById('handle-btn-wa');

    if (meta) meta.textContent = `#${order.id} · ${formatDateTime(order.createdAt)}`;
    if (nameEl) nameEl.textContent = order.name || '—';
    if (phoneEl) phoneEl.textContent = order.phone || '—';
    if (addressEl) addressEl.textContent = order.address || '—';
    if (totalEl) totalEl.textContent = formatBdt(totalPrice);
    if (btnCall) btnCall.href = telHref;
    if (btnWa) btnWa.href = waHref;

    handleModal.hidden = false;
  }

  if (btnCloseHandle) {
    btnCloseHandle.addEventListener('click', closeHandlePanel);
  }
  if (handleModal) {
    handleModal.addEventListener('click', (e) => {
      if (e.target === handleModal) closeHandlePanel();
    });
  }

  const handleBtnCopyAddress = document.getElementById('handle-btn-copy-address');
  const handleBtnCopyFull = document.getElementById('handle-btn-copy-full');
  const handleBtnInvoice = document.getElementById('handle-btn-invoice');
  const handleBtnDeliver = document.getElementById('handle-btn-deliver');

  if (handleBtnCopyAddress) {
    handleBtnCopyAddress.addEventListener('click', () => {
      const order = orders.find(o => o.id === handleOrderId);
      if (!order) return;
      copyText(order.address || '', 'ঠিকানা কপি হয়েছে!');
    });
  }
  if (handleBtnCopyFull) {
    handleBtnCopyFull.addEventListener('click', () => {
      const order = orders.find(o => o.id === handleOrderId);
      if (!order) return;
      copyText(buildOrderSummaryText(order), 'পুরো অর্ডার কপি হয়েছে!');
    });
  }
  if (handleBtnInvoice) {
    handleBtnInvoice.addEventListener('click', () => {
      if (!handleOrderId) return;
      const id = handleOrderId;
      closeHandlePanel();
      openInvoice(id);
    });
  }
  if (handleBtnDeliver) {
    handleBtnDeliver.addEventListener('click', () => {
      if (!handleOrderId) return;
      const id = handleOrderId;
      closeHandlePanel();
      updateOrderStatus(id, 'delivered');
    });
  }

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ====================================================
  // INVOICE MODAL
  // ====================================================
  function openInvoice(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (!order || !invoiceModal) return;

    const cableFeet = Number(order.cableFeet) || 0;
    const cablePrice = Number(order.cablePrice) || (cableFeet * 8);
    const totalPrice = Number(order.totalPrice) || (4500 + 1550 + cablePrice);

    document.getElementById('inv-id').textContent = '#' + order.id;
    document.getElementById('inv-date').textContent = formatDateTime(order.createdAt);
    document.getElementById('inv-status').textContent = order.status === 'confirmed' ? 'কনফার্মড' : (order.status === 'delivered' ? 'ডেলিভার্ড' : 'পেন্ডিং');
    document.getElementById('inv-name').textContent = order.name || '';
    document.getElementById('inv-phone').textContent = order.phone || '';
    document.getElementById('inv-address').textContent = order.address || '';

    const noteRow = document.getElementById('inv-note-row');
    if (order.note) {
      noteRow.hidden = false;
      document.getElementById('inv-note').textContent = order.note;
    } else {
      noteRow.hidden = true;
    }

    document.getElementById('inv-ctrl-price').textContent = formatBdt(order.controllerPrice || 4500);
    document.getElementById('inv-sensor-price').textContent = formatBdt(order.sensorPrice || 1550);
    document.getElementById('inv-cable-feet').textContent = String(cableFeet);
    document.getElementById('inv-cable-feet-2').textContent = String(cableFeet);
    document.getElementById('inv-cable-price').textContent = formatBdt(cablePrice);
    document.getElementById('inv-total-price').textContent = formatBdt(totalPrice);

    invoiceModal.hidden = false;
  }

  if (btnCloseInvoice && invoiceModal) {
    btnCloseInvoice.addEventListener('click', () => {
      invoiceModal.hidden = true;
    });
    invoiceModal.addEventListener('click', (e) => {
      if (e.target === invoiceModal) invoiceModal.hidden = true;
    });
  }

  // ====================================================
  // MANUAL COURIER
  // ====================================================
  const courierModal = document.getElementById('courier-modal');
  const courierForm = document.getElementById('courier-form');
  const btnCloseCourier = document.getElementById('btn-close-courier');

  function closeCourierModal() {
    if (courierModal) courierModal.hidden = true;
  }

  function openCourierModal(orderId) {
    const order = orders.find((o) => o.id === orderId);
    if (!order || !courierModal) return;
    const idEl = document.getElementById('courier-order-id');
    const meta = document.getElementById('courier-order-meta');
    const nameEl = document.getElementById('courier-name');
    const cnEl = document.getElementById('courier-consignment');
    const chargeEl = document.getElementById('courier-charge');
    const noteEl = document.getElementById('courier-note');
    if (idEl) idEl.value = order.id;
    if (meta) meta.textContent = '#' + order.id + ' · ' + (order.name || '');
    if (nameEl) nameEl.value = order.courierName || (order.steadfastTracking ? 'Steadfast' : '');
    if (cnEl) cnEl.value = order.consignmentNo || order.steadfastTracking || '';
    if (chargeEl) chargeEl.value = order.courierCharge !== '' && order.courierCharge != null ? order.courierCharge : '';
    if (noteEl) noteEl.value = order.shippingNote || '';
    courierModal.hidden = false;
  }

  async function saveCourierForm(e) {
    if (e) e.preventDefault();
    const id = ((document.getElementById('courier-order-id') || {}).value || '').trim();
    const courierName = ((document.getElementById('courier-name') || {}).value || '').trim();
    const consignmentNo = ((document.getElementById('courier-consignment') || {}).value || '').trim();
    const courierChargeRaw = ((document.getElementById('courier-charge') || {}).value || '').trim();
    const shippingNote = ((document.getElementById('courier-note') || {}).value || '').trim();
    if (!id || !courierName || !consignmentNo) {
      showToast('Courier Name ও Consignment No দিন', 'error');
      return;
    }
    const courierCharge = courierChargeRaw === '' ? '' : Number(courierChargeRaw) || 0;
    closeCourierModal();
    await updateOrderStatus(id, {
      status: 'shipped',
      courierName,
      consignmentNo,
      courierCharge,
      shippingNote
    });
  }

  if (btnCloseCourier) btnCloseCourier.addEventListener('click', closeCourierModal);
  if (courierModal) {
    courierModal.addEventListener('click', (e) => {
      if (e.target === courierModal) closeCourierModal();
    });
  }
  if (courierForm) courierForm.addEventListener('submit', saveCourierForm);

  // ====================================================
  // EDIT ORDER
  // ====================================================
  const editModal = document.getElementById('edit-order-modal');
  const editForm = document.getElementById('edit-order-form');
  const btnCloseEdit = document.getElementById('btn-close-edit-order');

  function getPackagePrices() {
    const cfg = window.SITE_CONFIG || {};
    const p = cfg.prices || {};
    return {
      controller: Number(p.controller) || 4500,
      sensor: Number(p.sensor) || 1550,
      cablePerFoot: Number(p.cablePerFoot) || 8
    };
  }

  function closeEditOrder() {
    if (editModal) editModal.hidden = true;
  }

  function updateEditTotalPreview() {
    const feet = Number((document.getElementById('edit-order-cable') || {}).value) || 0;
    const prices = getPackagePrices();
    const total = prices.controller + prices.sensor + feet * prices.cablePerFoot;
    const el = document.getElementById('edit-order-total');
    if (el) el.textContent = formatBdt(total);
  }

  function openEditOrder(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (!order || !editModal) return;
    const idEl = document.getElementById('edit-order-id');
    const meta = document.getElementById('edit-order-meta');
    const nameEl = document.getElementById('edit-order-name');
    const phoneEl = document.getElementById('edit-order-phone');
    const addressEl = document.getElementById('edit-order-address');
    const cableEl = document.getElementById('edit-order-cable');
    const noteEl = document.getElementById('edit-order-note');
    if (idEl) idEl.value = order.id;
    if (meta) meta.textContent = '#' + order.id;
    if (nameEl) nameEl.value = order.name || '';
    if (phoneEl) phoneEl.value = order.phone || '';
    if (addressEl) addressEl.value = order.address || '';
    if (cableEl) cableEl.value = Number(order.cableFeet) > 0 ? Number(order.cableFeet) : '';
    if (noteEl) noteEl.value = order.note || '';
    updateEditTotalPreview();
    editModal.hidden = false;
  }

  async function saveEditedOrder(e) {
    if (e) e.preventDefault();
    const id = ((document.getElementById('edit-order-id') || {}).value || '').trim();
    const name = ((document.getElementById('edit-order-name') || {}).value || '').trim();
    const phone = ((document.getElementById('edit-order-phone') || {}).value || '').trim();
    const address = ((document.getElementById('edit-order-address') || {}).value || '').trim();
    const note = ((document.getElementById('edit-order-note') || {}).value || '').trim();
    const feet = Number((document.getElementById('edit-order-cable') || {}).value);
    if (!id || !name || !phone || !address) {
      showToast('নাম, মোবাইল ও ঠিকানা দিন', 'error');
      return;
    }
    if (!Number.isFinite(feet) || feet < 1) {
      showToast('Cable সাইজ (ফুট) অবশ্যই দিতে হবে', 'error');
      return;
    }
    const prices = getPackagePrices();
    const cablePrice = feet * prices.cablePerFoot;
    const totalPrice = prices.controller + prices.sensor + cablePrice;
    const patch = {
      name,
      phone,
      address,
      note,
      cableFeet: feet,
      controllerPrice: prices.controller,
      sensorPrice: prices.sensor,
      cablePrice,
      totalPrice
    };

    try {
      if (window.OrdersAPI) {
        await window.OrdersAPI.updateOrderRemote(id, patch);
      }
    } catch (err) {
      showToast('ক্লাউড আপডেট ব্যর্থ — লোকালে সেভ হচ্ছে', 'error');
    }

    orders = orders.map(o => (o.id === id ? Object.assign({}, o, patch) : o));
    try {
      localStorage.setItem('ai_controller_orders', JSON.stringify(orders));
    } catch (err) {}
    closeEditOrder();
    renderAll();
    showToast('অর্ডার আপডেট হয়েছে: #' + id, 'success');
  }

  if (btnCloseEdit) btnCloseEdit.addEventListener('click', closeEditOrder);
  if (editModal) {
    editModal.addEventListener('click', (e) => {
      if (e.target === editModal) closeEditOrder();
    });
  }
  if (editForm) editForm.addEventListener('submit', saveEditedOrder);
  const editCableInput = document.getElementById('edit-order-cable');
  if (editCableInput) {
    editCableInput.addEventListener('input', updateEditTotalPreview);
  }

  async function sendOrderToSteadfast(orderId) {
    const order = orders.find((o) => o.id === orderId);
    if (!order) {
      showToast('অর্ডার পাওয়া যায়নি', 'error');
      return;
    }
    if (order.steadfastTracking) {
      if (!confirm('এই অর্ডারে ইতিমধ্যে Tracking আছে: ' + order.steadfastTracking + '\nআবার পাঠাবেন?')) return;
    } else if (!confirm('অর্ডার #' + orderId + ' Steadfast Courier-এ পাঠাবেন?')) {
      return;
    }

    showToast('Steadfast-এ পাঠানো হচ্ছে...', 'info');
    try {
      if (!window.OrdersAPI || !window.OrdersAPI.sendOrderToSteadfast) {
        throw new Error('orders-api.js আপডেট করুন');
      }
      if (!window.OrdersAPI.hasCloudOrdersApi()) {
        throw new Error('আগে Order Sync URL সেট করুন');
      }
      const result = await window.OrdersAPI.sendOrderToSteadfast(orderId, order);
      const tracking = (result && result.tracking) || (result.order && result.order.steadfastTracking) || '';
      const consignmentId =
        (result && result.consignmentId) ||
        (result.order && result.order.steadfastConsignmentId) ||
        '';

      orders = orders.map((o) => {
        if (o.id !== orderId) return o;
        return Object.assign({}, o, {
          steadfastTracking: tracking,
          steadfastConsignmentId: consignmentId,
          courierName: o.courierName || 'Steadfast',
          consignmentNo: tracking || o.consignmentNo || '',
          status:
            o.status === 'confirmed' || o.status === 'processing' || o.status === 'ready_to_ship'
              ? 'shipped'
              : o.status,
        });
      });
      try {
        localStorage.setItem('ai_controller_orders', JSON.stringify(orders));
      } catch (e) {}
      setActiveFilter('shipped');
      renderAll();
      showToast(
        tracking ? 'Steadfast OK · Tracking: ' + tracking : 'Steadfast-এ পাঠানো হয়েছে',
        'success'
      );
    } catch (err) {
      showToast('❌ ' + (err && err.message ? err.message : String(err)), 'error');
    }
  }

  // ====================================================
  // GLOBAL ADMIN ACTIONS EXPOSED
  // ====================================================
  window.adminActions = {
    confirmOrder(id) {
      updateOrderStatus(id, 'confirmed');
    },
    setStatus(id, status) {
      updateOrderStatus(id, status);
    },
    deliverOrder(id) {
      updateOrderStatus(id, 'delivered');
    },
    pendingOrder(id) {
      updateOrderStatus(id, 'pending');
    },
    cancelOrder(id) {
      if (confirm(`আপনি কি নিশ্চিত যে অর্ডার #${id} বাতিল করতে চান?`)) {
        updateOrderStatus(id, 'cancelled');
      }
    },
    deleteOrder(id) {
      deleteOrder(id);
    },
    openInvoice(id) {
      openInvoice(id);
    },
    openHandle(id) {
      openHandlePanel(id);
    },
    openEdit(id) {
      openEditOrder(id);
    },
    openCourier(id) {
      openCourierModal(id);
    },
    sendSteadfast(id) {
      sendOrderToSteadfast(id);
    },
    copyAddress(id) {
      const order = orders.find(o => o.id === id);
      if (!order) return;
      copyText(order.address || '', 'ঠিকানা কপি হয়েছে!');
    }
  };

  // ====================================================
  // EVENT LISTENERS
  // ====================================================
  if (filterTabs) {
    filterTabs.addEventListener('click', (e) => {
      const btn = e.target.closest('.filter-tab');
      if (!btn) return;
      setActiveFilter(btn.getAttribute('data-filter') || 'all');
      renderOrders();
    });
  }

  if (orderSearch) {
    orderSearch.addEventListener('input', (e) => {
      searchQuery = (e.target.value || '').trim();
      if (btnClearSearch) btnClearSearch.hidden = !searchQuery;
      renderOrders();
    });
  }

  if (btnClearSearch && orderSearch) {
    btnClearSearch.addEventListener('click', () => {
      orderSearch.value = '';
      searchQuery = '';
      btnClearSearch.hidden = true;
      orderSearch.focus();
      renderOrders();
    });
  }

  if (btnManualRefresh) {
    btnManualRefresh.addEventListener('click', () => {
      btnManualRefresh.textContent = '⏳ চেক হচ্ছে...';
      fetchOrders(false).finally(() => {
        setTimeout(() => {
          btnManualRefresh.textContent = '🔄 রিফ্রেশ';
        }, 500);
      });
    });
  }

  if (btnSoundToggle) {
    btnSoundToggle.addEventListener('click', () => {
      soundEnabled = !soundEnabled;
      if (soundIcon) soundIcon.textContent = soundEnabled ? '🔊' : '🔇';
      showToast(soundEnabled ? 'সাউন্ড নোটিফিকেশন চালু হয়েছে' : 'সাউন্ড নোটিফিকেশন বন্ধ করা হয়েছে', 'info');
    });
  }

  // ====================================================
  // CUSTOMER TEXT COMMENTS (table + delete)
  // ====================================================
  const USER_REVIEWS_KEY = 'ai_controller_user_reviews';
  const HIDDEN_REVIEWS_KEY = 'ai_controller_hidden_review_ids';
  const commentsBody = document.getElementById('comments-admin-body');
  const commentsEmpty = document.getElementById('comments-admin-empty');
  const btnRefreshComments = document.getElementById('btn-refresh-comments');
  let adminComments = [];

  function readLocalTextReviews() {
    try {
      const raw = localStorage.getItem(USER_REVIEWS_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list.filter((r) => r && (r.comment || r.name)) : [];
    } catch (e) {
      return [];
    }
  }

  function writeLocalTextReviews(list) {
    try {
      localStorage.setItem(USER_REVIEWS_KEY, JSON.stringify(list.slice(0, 80)));
    } catch (e) {}
  }

  function readHiddenReviewIds() {
    try {
      const raw = localStorage.getItem(HIDDEN_REVIEWS_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list.map(String) : [];
    } catch (e) {
      return [];
    }
  }

  function addHiddenReviewId(id) {
    const ids = readHiddenReviewIds();
    if (!ids.includes(String(id))) ids.push(String(id));
    try {
      localStorage.setItem(HIDDEN_REVIEWS_KEY, JSON.stringify(ids));
    } catch (e) {}
  }

  function mergeCommentLists(cloudList, localList) {
    const map = new Map();
    (cloudList || []).forEach((r) => {
      if (r && r.id) map.set(String(r.id), Object.assign({ type: 'text' }, r));
    });
    (localList || []).forEach((r) => {
      if (!r || !r.id) return;
      if (!map.has(String(r.id))) map.set(String(r.id), Object.assign({ type: 'text' }, r));
    });
    const hidden = new Set(readHiddenReviewIds());
    return Array.from(map.values())
      .filter((r) => r.comment && !hidden.has(String(r.id)))
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  }

  function renderAdminComments() {
    if (!commentsBody) return;
    if (!adminComments.length) {
      commentsBody.innerHTML = '';
      if (commentsEmpty) commentsEmpty.hidden = false;
      return;
    }
    if (commentsEmpty) commentsEmpty.hidden = true;
    commentsBody.innerHTML = adminComments
      .map((r) => {
        const when = r.createdAt ? formatDateTime(r.createdAt) : '—';
        return (
          '<tr data-comment-id="' +
          escapeHtml(r.id) +
          '">' +
          '<td>' +
          escapeHtml(r.name || 'কাস্টমার') +
          '</td>' +
          '<td class="comment-cell">' +
          escapeHtml(r.comment || '') +
          '</td>' +
          '<td>' +
          escapeHtml(when) +
          '</td>' +
          '<td><button type="button" class="btn-review-delete" data-del-comment="' +
          escapeHtml(r.id) +
          '">🗑 ডিলিট</button></td>' +
          '</tr>'
        );
      })
      .join('');
  }

  async function fetchAdminComments() {
    let cloud = [];
    try {
      if (window.OrdersAPI && window.OrdersAPI.fetchReviewsList) {
        cloud = await window.OrdersAPI.fetchReviewsList();
      }
    } catch (e) {}
    adminComments = mergeCommentLists(cloud, readLocalTextReviews());
    renderAdminComments();
  }

  async function deleteAdminComment(id) {
    if (!id) return;
    if (!confirm('এই কমেন্ট মুছে ফেলবেন?')) return;

    let cloudOk = false;
    try {
      if (window.OrdersAPI && window.OrdersAPI.hasCloudOrdersApi && window.OrdersAPI.hasCloudOrdersApi()) {
        await window.OrdersAPI.deleteReviewRemote(id);
        cloudOk = true;
      }
    } catch (err) {
      // continue local delete
    }

    writeLocalTextReviews(readLocalTextReviews().filter((r) => String(r.id) !== String(id)));
    addHiddenReviewId(id);
    adminComments = adminComments.filter((r) => String(r.id) !== String(id));
    renderAdminComments();
    showToast(cloudOk ? 'কমেন্ট ডিলিট হয়েছে' : 'লোকাল থেকে ডিলিট হয়েছে', 'info');
  }

  if (commentsBody) {
    commentsBody.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-del-comment]');
      if (!btn) return;
      deleteAdminComment(btn.getAttribute('data-del-comment'));
    });
  }
  if (btnRefreshComments) {
    btnRefreshComments.addEventListener('click', async () => {
      btnRefreshComments.disabled = true;
      await fetchAdminComments();
      btnRefreshComments.disabled = false;
      showToast('কমেন্ট রিফ্রেশ হয়েছে', 'success');
    });
  }

  // ====================================================
  // CUSTOMER REVIEW SCREENSHOTS
  // ====================================================
  const reviewUploadForm = document.getElementById('review-upload-form');
  const reviewFileInput = document.getElementById('review-file-input');
  const reviewAltInput = document.getElementById('review-alt-input');
  const reviewsAdminGrid = document.getElementById('reviews-admin-grid');
  const reviewsAdminEmpty = document.getElementById('reviews-admin-empty');
  const btnUploadReview = document.getElementById('btn-upload-review');
  let adminReviews = [];

  function getReviewsApiUrl(subpath) {
    const rel = 'api/reviews' + (subpath ? '/' + subpath : '');
    return new URL(rel, window.location.href).href;
  }

  function renderAdminReviews() {
    if (!reviewsAdminGrid) return;
    if (!adminReviews.length) {
      reviewsAdminGrid.innerHTML = '';
      if (reviewsAdminEmpty) reviewsAdminEmpty.hidden = false;
      return;
    }
    if (reviewsAdminEmpty) reviewsAdminEmpty.hidden = true;
    reviewsAdminGrid.innerHTML = adminReviews
      .map(
        (r) =>
          '<article class="review-admin-card" data-id="' +
          escapeHtml(r.id) +
          '">' +
          '<img src="' +
          escapeHtml(r.src) +
          '" alt="' +
          escapeHtml(r.alt || 'রিভিউ') +
          '" />' +
          '<div class="review-admin-meta">' +
          '<span>' +
          escapeHtml(r.alt || 'কাস্টমার কমেন্ট') +
          '</span>' +
          '<button type="button" class="btn-review-delete" data-del="' +
          escapeHtml(r.id) +
          '">🗑 মুছুন</button>' +
          '</div></article>'
      )
      .join('');
  }

  async function fetchAdminReviews() {
    try {
      const res = await fetch(getReviewsApiUrl(), { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.reviews)) {
          adminReviews = json.reviews;
          renderAdminReviews();
          return;
        }
      }
    } catch (e) {}

    // Fallback: site-config reviews
    const cfgList = (window.SITE_CONFIG && window.SITE_CONFIG.reviews) || [];
    adminReviews = cfgList.map((src, i) =>
      typeof src === 'string'
        ? { id: 'cfg-' + i, src, alt: 'কাস্টমার কমেন্ট' }
        : src
    );
    renderAdminReviews();
  }

  if (reviewUploadForm && reviewFileInput) {
    reviewUploadForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const file = reviewFileInput.files && reviewFileInput.files[0];
      if (!file) {
        showToast('আগে একটি স্ক্রিনশট সিলেক্ট করুন', 'error');
        return;
      }
      if (file.size > 8 * 1024 * 1024) {
        showToast('ছবি ৮MB এর কম হতে হবে', 'error');
        return;
      }

      if (btnUploadReview) {
        btnUploadReview.disabled = true;
        btnUploadReview.textContent = '⏳ আপলোড হচ্ছে...';
      }

      try {
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const res = await fetch(getReviewsApiUrl(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: base64,
            alt: (reviewAltInput && reviewAltInput.value) || 'কাস্টমার কমেন্ট'
          })
        });

        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error((json && json.error) || 'আপলোড ব্যর্থ');
        }

        adminReviews = json.reviews || [];
        renderAdminReviews();
        reviewUploadForm.reset();
        showToast('কমেন্ট স্ক্রিনশট সাইটে যোগ হয়েছে!', 'success');
      } catch (err) {
        showToast(
          'সার্ভার আপলোড ব্যর্থ। ছবি `assets/reviews/` এ রেখে site-config.js এ পাথ যোগ করুন।',
          'error'
        );
      } finally {
        if (btnUploadReview) {
          btnUploadReview.disabled = false;
          btnUploadReview.textContent = '✓ আপলোড ও সাইটে যোগ করুন';
        }
      }
    });
  }

  if (reviewsAdminGrid) {
    reviewsAdminGrid.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-del]');
      if (!btn) return;
      const id = btn.getAttribute('data-del');
      if (!confirm('এই রিভিউ স্ক্রিনশট মুছে ফেলবেন?')) return;
      try {
        const res = await fetch(getReviewsApiUrl(encodeURIComponent(id)), { method: 'DELETE' });
        const json = await res.json();
        if (json.success) {
          adminReviews = json.reviews || [];
          renderAdminReviews();
          showToast('রিভিউ মুছে ফেলা হয়েছে', 'info');
        }
      } catch (err) {
        showToast('মুছতে ব্যর্থ — সার্ভার চালু আছে কি?', 'error');
      }
    });
  }

  // ====================================================
  // SIDEBAR + MANAGE (price / links / videos / cloud)
  // ====================================================
  const PANEL_TITLES = {
    dashboard: 'Dashboard',
    orders: 'অর্ডার ম্যানেজ',
    prices: 'Pricing',
    links: 'Contact Links',
    videos: 'Videos',
    reviews: 'কমেন্ট / রিভিউ',
    cloud: 'Order Sync'
  };

  const PANEL_CRUMBS = {
    dashboard: 'Main / Dashboard',
    orders: 'Main / অর্ডার ম্যানেজ',
    prices: 'Website / Pricing',
    links: 'Website / Contact Links',
    videos: 'Website / Videos',
    reviews: 'Website / Reviews',
    cloud: 'System / Order Sync'
  };

  function showAdminPanel(panelId) {
    const id = panelId || 'dashboard';
    document.querySelectorAll('.admin-panel').forEach((panel) => {
      const on = panel.getAttribute('data-panel') === id;
      panel.hidden = !on;
      panel.classList.toggle('is-active', on);
    });
    document.querySelectorAll('.sidebar-link').forEach((btn) => {
      btn.classList.toggle('is-active', btn.getAttribute('data-panel') === id);
    });
    const title = document.getElementById('panel-page-title');
    const crumb = document.getElementById('panel-crumb');
    if (title) title.textContent = PANEL_TITLES[id] || 'Admin';
    if (crumb) crumb.textContent = PANEL_CRUMBS[id] || 'Admin';
    document.body.classList.remove('sidebar-open');
    if (id === 'orders' || id === 'dashboard') {
      if (typeof renderAll === 'function') renderAll();
    }
    if (id === 'reviews') {
      if (typeof fetchAdminComments === 'function') fetchAdminComments();
      if (typeof fetchAdminReviews === 'function') fetchAdminReviews();
    }
  }

  const sidebarNav = document.getElementById('sidebar-nav');
  if (sidebarNav) {
    sidebarNav.addEventListener('click', (e) => {
      const btn = e.target.closest('.sidebar-link');
      if (!btn) return;
      showAdminPanel(btn.getAttribute('data-panel'));
    });
  }

  document.addEventListener('click', (e) => {
    const go = e.target.closest('[data-goto]');
    if (!go) return;
    const panel = go.getAttribute('data-goto');
    if (panel) showAdminPanel(panel);
  });

  const btnSidebarToggle = document.getElementById('btn-sidebar-toggle');
  if (btnSidebarToggle) {
    btnSidebarToggle.addEventListener('click', () => {
      document.body.classList.toggle('sidebar-open');
    });
  }
  document.addEventListener('click', (e) => {
    if (!document.body.classList.contains('sidebar-open')) return;
    if (e.target.closest('.admin-sidebar') || e.target.closest('#btn-sidebar-toggle')) return;
    document.body.classList.remove('sidebar-open');
  });

  const videosForm = document.getElementById('videos-admin-form');
  const pricesForm = document.getElementById('prices-admin-form');
  const linksForm = document.getElementById('links-admin-form');
  const cloudForm = document.getElementById('cloud-admin-form');

  const videoInputs = {
    appSetup: document.getElementById('video-appSetup'),
    controller: document.getElementById('video-controller'),
    installation: document.getElementById('video-installation'),
    appDetails: document.getElementById('video-appDetails')
  };

  function readManageStateFromDom() {
    const cfg = window.SITE_CONFIG || {};
    const videos = {
      appSetup: (videoInputs.appSetup && videoInputs.appSetup.value || '').trim(),
      controller: (videoInputs.controller && videoInputs.controller.value || '').trim(),
      installation: (videoInputs.installation && videoInputs.installation.value || '').trim(),
      appDetails: (videoInputs.appDetails && videoInputs.appDetails.value || '').trim()
    };
    const prices = {
      controller: Number((document.getElementById('price-controller') || {}).value) || Number((cfg.prices || {}).controller) || 4500,
      sensor: Number((document.getElementById('price-sensor') || {}).value) || Number((cfg.prices || {}).sensor) || 1550,
      cablePerFoot: Number((document.getElementById('price-cable') || {}).value) || Number((cfg.prices || {}).cablePerFoot) || 8
    };
    const links = {
      playStore: ((document.getElementById('link-playStore') || {}).value || '').trim(),
      whatsapp: ((document.getElementById('link-whatsapp') || {}).value || '').trim(),
      phone: ((document.getElementById('link-phone') || {}).value || '').trim()
    };
    const ordersApi = ((document.getElementById('cloud-ordersApi') || {}).value || '').trim();
    return { videos, prices, links, ordersApi };
  }

  function fillManageForms() {
    const cfg = window.SITE_CONFIG || {};
    let videos = Object.assign({}, cfg.videos || {});
    try {
      const saved = localStorage.getItem('ai_controller_videos');
      if (saved) videos = Object.assign(videos, JSON.parse(saved));
    } catch (e) {}

    Object.keys(videoInputs).forEach((key) => {
      if (videoInputs[key]) videoInputs[key].value = videos[key] || '';
    });

    const prices = cfg.prices || {};
    const pc = document.getElementById('price-controller');
    const ps = document.getElementById('price-sensor');
    const pcf = document.getElementById('price-cable');
    if (pc) pc.value = prices.controller != null ? prices.controller : 4500;
    if (ps) ps.value = prices.sensor != null ? prices.sensor : 1550;
    if (pcf) pcf.value = prices.cablePerFoot != null ? prices.cablePerFoot : 8;
    updatePricePreview();

    const links = cfg.links || {};
    const lp = document.getElementById('link-playStore');
    const lw = document.getElementById('link-whatsapp');
    const lph = document.getElementById('link-phone');
    if (lp) lp.value = links.playStore || '';
    if (lw) lw.value = links.whatsapp || '8801745242000';
    if (lph) lph.value = links.phone || '01745242000';

    const cloud = document.getElementById('cloud-ordersApi');
    if (cloud) cloud.value = cfg.ordersApi || '';
  }

  function fillVideoForm() {
    fillManageForms();
  }

  function updatePricePreview() {
    const el = document.getElementById('price-preview');
    if (!el) return;
    const c = Number((document.getElementById('price-controller') || {}).value) || 0;
    const s = Number((document.getElementById('price-sensor') || {}).value) || 0;
    el.textContent = 'Package start (controller + sensor): BDT ' + (c + s).toLocaleString('en-US');
  }

  ['price-controller', 'price-sensor', 'price-cable'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updatePricePreview);
  });

  function buildSiteConfigJs(overrides) {
    const cfg = window.SITE_CONFIG || {};
    const state = Object.assign({
      videos: cfg.videos || {},
      prices: cfg.prices || {},
      links: cfg.links || {},
      ordersApi: cfg.ordersApi || ''
    }, overrides || {}, readManageStateFromDom(), overrides || {});

    // prefer explicit overrides for the fields being saved
    if (overrides) {
      if (overrides.videos) state.videos = overrides.videos;
      if (overrides.prices) state.prices = overrides.prices;
      if (overrides.links) state.links = overrides.links;
      if (overrides.ordersApi != null) state.ordersApi = overrides.ordersApi;
    }

    const images = cfg.images || {};
    const reviews = cfg.reviews || [];
    const q = (v) => JSON.stringify(v == null ? '' : String(v));
    const reviewsBlock = reviews.length
      ? reviews.map((r) => '    ' + JSON.stringify(typeof r === 'string' ? r : r.src)).join(',\n')
      : '';

    const videos = state.videos || {};
    const prices = state.prices || {};
    const links = state.links || {};

    return (
      '/**\n' +
      ' * Admin — prices, links, videos, reviews, ordersApi\n' +
      ' */\n' +
      'window.SITE_CONFIG = {\n' +
      '  ordersApi: ' + q(state.ordersApi || '') + ',\n' +
      '  links: {\n' +
      '    playStore: ' + q(links.playStore || '') + ',\n' +
      '    whatsapp: ' + q(links.whatsapp || '') + ',\n' +
      '    phone: ' + q(links.phone || '') + ',\n' +
      '  },\n' +
      '  videos: {\n' +
      '    appSetup: ' + q(videos.appSetup || '') + ',\n' +
      '    controller: ' + q(videos.controller || '') + ',\n' +
      '    installation: ' + q(videos.installation || '') + ',\n' +
      '    appDetails: ' + q(videos.appDetails || '') + ',\n' +
      '  },\n' +
      '  reviews: [\n' +
      (reviewsBlock ? reviewsBlock + '\n' : '') +
      '  ],\n' +
      '  images: {\n' +
      '    controller: ' + q(images.controller || 'assets/product-controller.png') + ',\n' +
      '    sensor: ' + q(images.sensor || 'assets/sensor.png') + ',\n' +
      '    controllerFallback: ' + q(images.controllerFallback || 'assets/product-controller.svg') + ',\n' +
      '    sensorFallback: ' + q(images.sensorFallback || 'assets/sensor.svg') + ',\n' +
      '    poster: ' + q(images.poster || 'assets/promo-poster.png') + ',\n' +
      '  },\n' +
      '  prices: {\n' +
      '    controller: ' + Number(prices.controller || 4500) + ',\n' +
      '    sensor: ' + Number(prices.sensor || 1550) + ',\n' +
      '    cablePerFoot: ' + Number(prices.cablePerFoot || 8) + ',\n' +
      '  },\n' +
      '};\n'
    );
  }

  function downloadTextFile(filename, textContent) {
    const blob = new Blob([textContent], { type: 'application/javascript;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function saveConfigAndDownload(overrides, toastMsg) {
    const state = readManageStateFromDom();
    const merged = Object.assign({}, state, overrides || {});
    if (overrides) {
      if (overrides.videos) merged.videos = overrides.videos;
      if (overrides.prices) merged.prices = overrides.prices;
      if (overrides.links) merged.links = overrides.links;
      if (overrides.ordersApi != null) merged.ordersApi = overrides.ordersApi;
    }

    window.SITE_CONFIG = Object.assign({}, window.SITE_CONFIG || {}, {
      ordersApi: merged.ordersApi,
      links: merged.links,
      videos: merged.videos,
      prices: merged.prices
    });

    try {
      localStorage.setItem('ai_controller_videos', JSON.stringify(merged.videos));
    } catch (e) {}

    downloadTextFile('site-config.js', buildSiteConfigJs(merged));
    showToast(toastMsg || 'Saved! Upload downloaded site-config.js to GitHub.', 'success');
  }

  if (videosForm) {
    videosForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const videos = {
        appSetup: (videoInputs.appSetup && videoInputs.appSetup.value || '').trim(),
        controller: (videoInputs.controller && videoInputs.controller.value || '').trim(),
        installation: (videoInputs.installation && videoInputs.installation.value || '').trim(),
        appDetails: (videoInputs.appDetails && videoInputs.appDetails.value || '').trim()
      };
      saveConfigAndDownload({ videos }, 'Videos saved — upload site-config.js');
    });
  }

  if (pricesForm) {
    pricesForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const prices = {
        controller: Number((document.getElementById('price-controller') || {}).value) || 0,
        sensor: Number((document.getElementById('price-sensor') || {}).value) || 0,
        cablePerFoot: Number((document.getElementById('price-cable') || {}).value) || 0
      };
      saveConfigAndDownload({ prices }, 'Prices saved — upload site-config.js');
    });
  }

  if (linksForm) {
    linksForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const links = {
        playStore: ((document.getElementById('link-playStore') || {}).value || '').trim(),
        whatsapp: ((document.getElementById('link-whatsapp') || {}).value || '').trim(),
        phone: ((document.getElementById('link-phone') || {}).value || '').trim()
      };
      saveConfigAndDownload({ links }, 'Links saved — upload site-config.js');
    });
  }

  if (cloudForm) {
    cloudForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const ordersApi = ((document.getElementById('cloud-ordersApi') || {}).value || '').trim();
      saveConfigAndDownload({ ordersApi }, 'Cloud API saved — upload site-config.js');
    });
  }

  const cloudTestBtn = document.getElementById('cloud-test-btn');
  const cloudTestResult = document.getElementById('cloud-test-result');
  if (cloudTestBtn) {
    cloudTestBtn.addEventListener('click', async () => {
      const ordersApi = ((document.getElementById('cloud-ordersApi') || {}).value || '').trim();
      if (cloudTestResult) cloudTestResult.textContent = 'টেস্ট হচ্ছে...';
      cloudTestBtn.disabled = true;
      try {
        if (!window.OrdersAPI || !window.OrdersAPI.testCloudConnection) {
          if (cloudTestResult) cloudTestResult.textContent = 'orders-api.js লোড হয়নি — পেজ রিফ্রেশ করুন';
          showToast('orders-api.js লোড হয়নি', 'error');
          return;
        }
        const result = await window.OrdersAPI.testCloudConnection(ordersApi);
        if (cloudTestResult) cloudTestResult.textContent = result.message;
        showToast(result.message, result.ok ? 'success' : 'error');
        if (result.ok) await fetchOrders(false);
      } catch (err) {
        const msg = '❌ ' + (err && err.message ? err.message : String(err));
        if (cloudTestResult) cloudTestResult.textContent = msg;
        showToast(msg, 'error');
      } finally {
        cloudTestBtn.disabled = false;
      }
    });
  }

  const btnSteadfastStatus = document.getElementById('btn-steadfast-status');
  const steadfastStatusText = document.getElementById('steadfast-status-text');
  if (btnSteadfastStatus) {
    btnSteadfastStatus.addEventListener('click', async () => {
      if (steadfastStatusText) steadfastStatusText.textContent = 'চেক হচ্ছে...';
      btnSteadfastStatus.disabled = true;
      try {
        if (!window.OrdersAPI || !window.OrdersAPI.steadfastConfigured) {
          throw new Error('orders-api.js আপডেট নেই');
        }
        if (!window.OrdersAPI.hasCloudOrdersApi()) {
          throw new Error('আগে Order Sync URL সেট করুন');
        }
        const ok = await window.OrdersAPI.steadfastConfigured();
        const msg = ok
          ? '✅ Steadfast API Key সেট আছে — কনফার্মড অর্ডারে পাঠাতে পারবেন'
          : '❌ API Key সেট নেই — Apps Script এ setSteadfastCredentials Run করুন';
        if (steadfastStatusText) steadfastStatusText.textContent = msg;
        showToast(msg, ok ? 'success' : 'error');
      } catch (err) {
        const msg = '❌ ' + (err && err.message ? err.message : String(err));
        if (steadfastStatusText) steadfastStatusText.textContent = msg;
        showToast(msg, 'error');
      } finally {
        btnSteadfastStatus.disabled = false;
      }
    });
  }

  const manualForm = document.getElementById('manual-order-form');
  if (manualForm) {
    manualForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = ((document.getElementById('manual-name') || {}).value || '').trim();
      const phone = ((document.getElementById('manual-phone') || {}).value || '').trim();
      const address = ((document.getElementById('manual-address') || {}).value || '').trim();
      const note = ((document.getElementById('manual-note') || {}).value || '').trim();
      const feet = Number((document.getElementById('manual-cable') || {}).value);
      const prices = getPackagePrices();
      const ctrl = prices.controller;
      const sensor = prices.sensor;
      const cablePrice = (Number.isFinite(feet) ? feet : 0) * prices.cablePerFoot;
      const total = ctrl + sensor + cablePrice;
      if (!name || !phone || !address) {
        showToast('নাম, মোবাইল ও ঠিকানা দিন', 'error');
        return;
      }
      if (!Number.isFinite(feet) || feet < 1) {
        showToast('Cable সাইজ (ফুট) অবশ্যই দিতে হবে', 'error');
        return;
      }
      const payload = {
        name, phone, address, note,
        cableFeet: feet,
        controllerPrice: ctrl,
        sensorPrice: sensor,
        cablePrice,
        totalPrice: total,
        packageName: 'AI Controller + Premium Sensor',
        status: 'pending',
        confirmedAt: null
      };
      let created = null;
      try {
        if (window.OrdersAPI) created = await window.OrdersAPI.createOrderRemote(payload);
      } catch (err) {}
      if (!created) {
        created = {
          id: 'ORD-' + Math.floor(100000 + Math.random() * 900000),
          createdAt: new Date().toISOString(),
          formattedTime: new Date().toLocaleString('en-US', { timeZone: 'Asia/Dhaka' }),
          ...payload
        };
      }
      orders = [created, ...orders.filter(o => o.id !== created.id)];
      try { localStorage.setItem('ai_controller_orders', JSON.stringify(orders)); } catch (e) {}
      manualForm.reset();
      setActiveFilter('pending');
      renderAll();
      showToast('ম্যানুয়াল অর্ডার যোগ হয়েছে: #' + created.id, 'success');
    });
  }

  function exportOrdersFile() {
    const list = orders.length ? orders : readLocalOrders();
    if (!list.length) {
      showToast('Export করার মতো কোনো অর্ডার নেই', 'error');
      return;
    }
    const blob = new Blob([JSON.stringify(list, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ai-controller-orders.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast(list.length + 'টি অর্ডার Export হয়েছে — পিসিতে Import করুন', 'success');
  }

  async function copyOrdersJson() {
    const list = orders.length ? orders : readLocalOrders();
    if (!list.length) {
      showToast('Copy করার মতো কোনো অর্ডার নেই', 'error');
      return;
    }
    const text = JSON.stringify(list);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      showToast('JSON কপি হয়েছে — পিসিতে Paste Import করুন', 'success');
    } catch (e) {
      showToast('কপি ব্যর্থ। Export ব্যবহার করুন।', 'error');
    }
  }

  function importOrdersList(list) {
    if (!Array.isArray(list) || !list.length) {
      showToast('সঠিক অর্ডার লিস্ট পাওয়া যায়নি', 'error');
      return;
    }
    const cleaned = list.filter(o => o && o.id);
    if (!cleaned.length) {
      showToast('ইমপোর্ট ফাইলে অর্ডার নেই', 'error');
      return;
    }
    orders = mergeOrders(cleaned, orders);
    try {
      localStorage.setItem('ai_controller_orders', JSON.stringify(orders));
    } catch (e) {}
    previousOrderIds = new Set(orders.map(o => o.id));
    setActiveFilter('all');
    renderAll();
    showToast(cleaned.length + 'টি অর্ডার Import হয়েছে', 'success');
  }

  const btnExportOrders = document.getElementById('btn-export-orders');
  const btnCopyOrdersJson = document.getElementById('btn-copy-orders-json');
  const importOrdersFile = document.getElementById('import-orders-file');
  const btnImportOrdersText = document.getElementById('btn-import-orders-text');

  if (btnExportOrders) btnExportOrders.addEventListener('click', exportOrdersFile);
  if (btnCopyOrdersJson) btnCopyOrdersJson.addEventListener('click', copyOrdersJson);

  const btnRefreshOrders = document.getElementById('btn-refresh-orders');
  if (btnRefreshOrders) {
    btnRefreshOrders.addEventListener('click', async () => {
      btnRefreshOrders.disabled = true;
      btnRefreshOrders.textContent = '↻ লোড হচ্ছে...';
      try {
        await fetchOrders(false);
        showToast('অর্ডার রিফ্রেশ হয়েছে', 'success');
      } catch (err) {
        showToast('রিফ্রেশ ব্যর্থ', 'error');
      } finally {
        btnRefreshOrders.disabled = false;
        btnRefreshOrders.textContent = '↻ রিফ্রেশ';
      }
    });
  }

  if (importOrdersFile) {
    importOrdersFile.addEventListener('change', async () => {
      const file = importOrdersFile.files && importOrdersFile.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        importOrdersList(Array.isArray(parsed) ? parsed : (parsed.orders || []));
      } catch (e) {
        showToast('JSON ফাইল পড়া যায়নি', 'error');
      }
      importOrdersFile.value = '';
    });
  }

  if (btnImportOrdersText) {
    btnImportOrdersText.addEventListener('click', () => {
      const ta = document.getElementById('import-orders-text');
      const raw = (ta && ta.value || '').trim();
      if (!raw) {
        showToast('আগে JSON পেস্ট করুন', 'error');
        return;
      }
      try {
        const parsed = JSON.parse(raw);
        importOrdersList(Array.isArray(parsed) ? parsed : (parsed.orders || []));
        if (ta) ta.value = '';
      } catch (e) {
        showToast('JSON সঠিক নয়', 'error');
      }
    });
  }

  // Initialize
  checkAuth();
})();
