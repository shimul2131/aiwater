(() => {
  const cfg = window.SITE_CONFIG || {};
  const ADMIN_PASSWORD = String(
    (cfg.admin && cfg.admin.password) || "fres1234"
  ).trim();

  // Elements
  const loginScreen = document.getElementById('login-screen');
  const dashboardScreen = document.getElementById('dashboard-screen');
  const loginForm = document.getElementById('login-form');
  const adminPassInput = document.getElementById('admin-pass');
  const btnTogglePass = document.getElementById('btn-toggle-pass');
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
    if (loginScreen) loginScreen.hidden = false;
    if (dashboardScreen) dashboardScreen.hidden = true;
    if (pollTimer) clearInterval(pollTimer);
  }

  function showDashboard() {
    if (loginScreen) loginScreen.hidden = true;
    if (dashboardScreen) dashboardScreen.hidden = false;
    fetchOrders(true);
    startPolling();
    if (typeof fetchAdminReviews === 'function') fetchAdminReviews();
  }

  if (btnTogglePass && adminPassInput) {
    btnTogglePass.addEventListener('click', () => {
      const isPass = adminPassInput.type === 'password';
      adminPassInput.type = isPass ? 'text' : 'password';
      btnTogglePass.textContent = isPass ? '🙈' : '👁';
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const entered = String(adminPassInput.value || '')
        .trim()
        .replace(/\u200b/g, ''); // strip zero-width chars from mobile copy/paste
      if (entered === ADMIN_PASSWORD) {
        sessionStorage.setItem('ai_controller_admin_auth', 'true');
        if (loginError) loginError.hidden = true;
        showDashboard();
      } else {
        if (loginError) {
          loginError.hidden = false;
          loginError.textContent = '❌ ভুল পাসওয়ার্ড! আবার চেষ্টা করুন।';
        }
        adminPassInput.focus();
        adminPassInput.select();
      }
    });
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

  async function fetchOrders(isFirstLoad = false) {
    let fetched = null;

    try {
      const res = await fetch(getApiUrl(), { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.orders)) {
          fetched = json.orders;
          // Sync to localStorage as backup
          try {
            localStorage.setItem('ai_controller_orders', JSON.stringify(fetched));
          } catch (e) {}
        }
      }
    } catch (err) {
      // Server not reachable (static file server mode) -> Fallback to localStorage
    }

    if (!fetched) {
      try {
        const local = localStorage.getItem('ai_controller_orders');
        fetched = local ? JSON.parse(local) : [];
      } catch (e) {
        fetched = [];
      }
    }

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
    let updated = false;

    try {
      const res = await fetch(getApiUrl(encodeURIComponent(orderId)), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) updated = true;
      }
    } catch (e) {}

    // Update in local memory and storage
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

    renderAll();

    if (nextStatus === 'confirmed') {
      showToast(`অর্ডার #${orderId} সফলভাবে কনফার্ম করা হয়েছে!`, 'success');
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
        } else if (currentFilter !== 'all') {
          emptyMessage.textContent = `এই ফিল্টারে (${currentFilter}) কোনো অর্ডার নেই।`;
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

    // Clean phone for whatsapp
    let cleanPhone = (order.phone || '').replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = '88' + cleanPhone;

    const waConfirmMsg = encodeURIComponent(
      `আসসালামু আলাইকুম ${order.name || ''} সাহেব,\n` +
      `AI Water Controller-এ আপনার অর্ডার (#${order.id}) কনফার্ম করা হয়েছে।\n` +
      `প্যাকেজ: Controller + Premium Sensor\n` +
      `ক্যাবল: ${cableFeet} ফুট\n` +
      `মোট মূল্য: ${formatBdt(totalPrice)} (ক্যাশ অন ডেলিভারি)\n` +
      `ঠিকানা: ${order.address || ''}\n` +
      `আমরা শীঘ্রই পণ্যটি পাঠিয়ে দিচ্ছি। ধন্যবাদ!`
    );

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
          <!-- Customer Info -->
          <div class="customer-info-box">
            <div class="info-box-title">👤 গ্রাহকের তথ্য</div>
            <div class="info-row">
              <strong>নাম:</strong> <span>${escapeHtml(order.name || '')}</span>
            </div>
            <div class="info-row">
              <strong>মোবাইল:</strong>
              <div class="customer-phone-wrap">
                <span class="customer-phone-number">${escapeHtml(order.phone || '')}</span>
                <a href="tel:${escapeHtml(order.phone || '')}" class="btn-phone-call" title="কল করুন">📞 কল</a>
                <a href="https://wa.me/${cleanPhone}?text=${waConfirmMsg}" target="_blank" rel="noopener noreferrer" class="btn-phone-wa" title="WhatsApp-এ মেসেজ">💬 WhatsApp</a>
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

          <!-- Package Details -->
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
    }
  };

  // ====================================================
  // EVENT LISTENERS
  // ====================================================
  if (filterTabs) {
    filterTabs.addEventListener('click', (e) => {
      const btn = e.target.closest('.filter-tab');
      if (!btn) return;
      filterTabs.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      currentFilter = btn.getAttribute('data-filter') || 'all';
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

  // Initialize
  checkAuth();
})();
