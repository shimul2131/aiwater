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
    if (typeof fillVideoForm === "function") fillVideoForm();
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
    const rel = 'api/orders' + (subpath ? '/' + subpath : '');
    return new URL(rel, window.location.href).href;
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
    if (status === 'delivered') return 3;
    if (status === 'confirmed') return 2;
    if (status === 'cancelled') return 0;
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
      const res = await fetch(getApiUrl(), { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.orders)) {
          serverOrders = json.orders;
        }
      }
    } catch (err) {
      // Server not reachable (static file server mode)
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
    renderAll();
  }

  function startPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(() => {
      fetchOrders(false);
    }, 8000);
  }

  // Save Orders (handles both API and LocalStorage)
  async function updateOrderStatus(orderId, nextStatus) {
    try {
      const res = await fetch(getApiUrl(encodeURIComponent(orderId)), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });
      if (res.ok) {
        await res.json().catch(() => ({}));
      }
    } catch (e) {}

    // Update in local memory and storage (always — works even without API)
    orders = orders.map(o => {
      if (o.id === orderId) {
        return {
          ...o,
          status: nextStatus,
          confirmedAt: nextStatus === 'confirmed' ? (o.confirmedAt || new Date().toISOString()) : o.confirmedAt
        };
      }
      return o;
    });

    try {
      localStorage.setItem('ai_controller_orders', JSON.stringify(orders));
    } catch (e) {}

    // Confirm/deliver/cancel করে Pending ট্যাবে থাকলে অর্ডার উধাও মনে হয় —
    // তাই সেই স্ট্যাটাসের ট্যাবে নিয়ে দেখাই
    if (nextStatus === 'confirmed' || nextStatus === 'delivered' || nextStatus === 'cancelled') {
      setActiveFilter(nextStatus);
    }

    renderAll();

    if (nextStatus === 'confirmed') {
      showToast(`অর্ডার #${orderId} কনফার্ম হয়েছে — হ্যান্ডেল প্যানেল খুলছে...`, 'success');
      setTimeout(() => openHandlePanel(orderId), 250);
    } else if (nextStatus === 'delivered') {
      showToast(`অর্ডার #${orderId} ডেলিভারি সম্পন্ন চিহ্নিত হয়েছে।`, 'success');
    } else if (nextStatus === 'cancelled') {
      showToast(`অর্ডার #${orderId} বাতিল করা হয়েছে।`, 'error');
    }
  }

  async function deleteOrder(orderId) {
    if (!confirm(`আপনি কি নিশ্চিত যে অর্ডার #${orderId} মুছে ফেলতে চান?`)) return;

    try {
      await fetch(getApiUrl(encodeURIComponent(orderId)), { method: 'DELETE' });
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
  }

  function updateKPIs() {
    const total = orders.length;
    const pending = orders.filter(o => o.status === 'pending').length;
    const confirmed = orders.filter(o => o.status === 'confirmed').length;
    const delivered = orders.filter(o => o.status === 'delivered').length;
    const cancelled = orders.filter(o => o.status === 'cancelled').length;

    // Confirmed revenue includes confirmed + delivered
    const confirmedRevenue = orders
      .filter(o => o.status === 'confirmed' || o.status === 'delivered')
      .reduce((sum, o) => sum + (Number(o.totalPrice) || 0), 0);

    if (kpiTotal) kpiTotal.textContent = String(total);
    if (kpiPending) kpiPending.textContent = String(pending);
    if (kpiConfirmed) kpiConfirmed.textContent = String(confirmed);
    if (kpiDelivered) kpiDelivered.textContent = String(delivered);
    if (kpiRevenue) kpiRevenue.textContent = formatBdt(confirmedRevenue);

    if (kpiPendingBadge) {
      kpiPendingBadge.hidden = pending === 0;
      kpiPendingBadge.textContent = `${pending} টি নতুন`;
    }

    if (countAll) countAll.textContent = String(total);
    if (countPending) countPending.textContent = String(pending);
    if (countConfirmed) countConfirmed.textContent = String(confirmed);
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

    let statusBadgeText = 'অপেক্ষমান (পেন্ডিং)';
    let badgeClass = 'badge-pending';
    if (status === 'confirmed') {
      statusBadgeText = 'কনফার্মড';
      badgeClass = 'badge-confirmed';
    } else if (status === 'delivered') {
      statusBadgeText = 'ডেলিভার্ড';
      badgeClass = 'badge-delivered';
    } else if (status === 'cancelled') {
      statusBadgeText = 'বাতিল';
      badgeClass = 'badge-cancelled';
    }

    const cleanPhone = getCleanPhone(order.phone);
    const waConfirmMsg = encodeURIComponent(buildWaConfirmText(order));
    const telHref = 'tel:' + escapeHtml(order.phone || '');
    const waHref = 'https://wa.me/' + cleanPhone + '?text=' + waConfirmMsg;

    return `
      <article class="order-card status-${status}" data-id="${order.id}">
        <div class="order-card-header">
          <div class="order-header-left">
            <span class="order-id">#${escapeHtml(order.id)}</span>
            <span class="order-time">${escapeHtml(timeFormatted)}</span>
          </div>
          <span class="status-badge ${badgeClass}">${statusBadgeText}</span>
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
            ${order.confirmedAt ? `
              <div class="confirmed-tag">
                ✓ কনফার্ম করা হয়েছে: ${formatDateTime(order.confirmedAt)}
              </div>
            ` : ''}
          </div>
        </div>

        ${status === 'confirmed' ? `
          <div class="confirmed-handle-bar">
            <p class="confirmed-handle-title">কনফার্মড — এখন হ্যান্ডেল করুন</p>
            <div class="confirmed-handle-actions">
              <a class="btn-handle-mini btn-handle-call" href="${telHref}">📞 কল</a>
              <a class="btn-handle-mini btn-handle-wa" href="${waHref}" target="_blank" rel="noopener noreferrer">💬 WhatsApp</a>
              <button type="button" class="btn-handle-mini btn-handle-copy" onclick="window.adminActions.copyAddress('${order.id}')">📋 ঠিকানা</button>
              <button type="button" class="btn-handle-mini btn-handle-print" onclick="window.adminActions.openInvoice('${order.id}')">🖨 রশিদ</button>
              <button type="button" class="btn-handle-mini btn-handle-open" onclick="window.adminActions.openHandle('${order.id}')">⚡ ফুল হ্যান্ডেল</button>
            </div>
          </div>
        ` : ''}

        <div class="order-card-footer">
          <div class="actions-primary">
            ${status === 'pending' ? `
              <button type="button" class="btn-action-confirm" onclick="window.adminActions.confirmOrder('${order.id}')">
                ✓ অর্ডার কনফার্ম করুন
              </button>
              <button type="button" class="btn-action-cancel" onclick="window.adminActions.cancelOrder('${order.id}')">
                ✕ বাতিল
              </button>
            ` : ''}

            ${status === 'confirmed' ? `
              <button type="button" class="btn-action-deliver" onclick="window.adminActions.deliverOrder('${order.id}')">
                🚚 ডেলিভারি সম্পন্ন করুন
              </button>
              <button type="button" class="btn-action-pending" onclick="window.adminActions.pendingOrder('${order.id}')">
                ↩️ আবার পেন্ডিং
              </button>
              <button type="button" class="btn-action-cancel" onclick="window.adminActions.cancelOrder('${order.id}')">
                ✕ বাতিল
              </button>
            ` : ''}

            ${status === 'delivered' ? `
              <span style="color: var(--blue); font-weight: 700; font-size: 0.88rem;">✓ ডেলিভারি সম্পন্ন হয়েছে</span>
              <button type="button" class="btn-action-pending" onclick="window.adminActions.pendingOrder('${order.id}')">
                ↩️ পেন্ডিং
              </button>
            ` : ''}

            ${status === 'cancelled' ? `
              <span style="color: var(--rose); font-weight: 700; font-size: 0.88rem;">বাতিলকৃত অর্ডার</span>
              <button type="button" class="btn-action-pending" onclick="window.adminActions.pendingOrder('${order.id}')">
                ↩️ সক্রিয় করুন
              </button>
            ` : ''}
          </div>

          <div class="actions-secondary">
            <button type="button" class="btn-action-print" onclick="window.adminActions.openInvoice('${order.id}')" title="প্রিন্ট রশিদ">
              🖨 রশিদ
            </button>
            <button type="button" class="btn-action-delete" onclick="window.adminActions.deleteOrder('${order.id}')" title="অর্ডার মুছুন">
              🗑
            </button>
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
  // GLOBAL ADMIN ACTIONS EXPOSED
  // ====================================================
  window.adminActions = {
    confirmOrder(id) {
      updateOrderStatus(id, 'confirmed');
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
  // VIDEO LINKS MANAGER
  // ====================================================
  const videosForm = document.getElementById('videos-admin-form');
  const videoInputs = {
    appSetup: document.getElementById('video-appSetup'),
    controller: document.getElementById('video-controller'),
    installation: document.getElementById('video-installation'),
    appDetails: document.getElementById('video-appDetails')
  };

  function fillVideoForm() {
    const cfg = window.SITE_CONFIG || {};
    let videos = (cfg.videos || {});
    try {
      const saved = localStorage.getItem('ai_controller_videos');
      if (saved) videos = { ...videos, ...JSON.parse(saved) };
    } catch (e) {}

    Object.keys(videoInputs).forEach((key) => {
      if (videoInputs[key]) videoInputs[key].value = videos[key] || '';
    });
  }

  function buildSiteConfigJs(videos) {
    const cfg = window.SITE_CONFIG || {};
    const links = cfg.links || {};
    const images = cfg.images || {};
    const prices = cfg.prices || {};
    const reviews = cfg.reviews || [];

    const q = (v) => JSON.stringify(v == null ? '' : String(v));
    const reviewsBlock = reviews.length
      ? reviews.map((r) => '    ' + JSON.stringify(typeof r === 'string' ? r : r.src)).join(',\n')
      : '';

    return (
      '/**\n' +
      ' * Admin — YouTube, ছবি, মূল্য, Play Store ও রিভিউ\n' +
      ' */\n' +
      'window.SITE_CONFIG = {\n' +
      '  links: {\n' +
      '    playStore: ' + q(links.playStore || '') + ',\n' +
      '  },\n' +
      '  videos: {\n' +
      '    appSetup: ' + q(videos.appSetup) + ', // App Setup Video\n' +
      '    controller: ' + q(videos.controller) + ', // Controller Video\n' +
      '    installation: ' + q(videos.installation) + ', // Installation Video\n' +
      '    appDetails: ' + q(videos.appDetails) + ', // App Details Video\n' +
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

  function downloadTextFile(filename, text) {
    const blob = new Blob([text], { type: 'application/javascript;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
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

      try {
        localStorage.setItem('ai_controller_videos', JSON.stringify(videos));
        if (!window.SITE_CONFIG) window.SITE_CONFIG = {};
        window.SITE_CONFIG.videos = videos;
      } catch (err) {}

      downloadTextFile('site-config.js', buildSiteConfigJs(videos));
      showToast('ভিডিও সেভ হয়েছে! ডাউনলোড করা site-config.js GitHub-এ আপলোড করুন।', 'success');
    });
  }

  // Initialize
  checkAuth();
})();
