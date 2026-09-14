(() => {
  const cfg = window.SITE_CONFIG || {};

  function youtubeId(input) {
    if (!input || typeof input !== "string") return "";
    const trimmed = input.trim();
    if (!trimmed) return "";
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
    try {
      const url = new URL(trimmed);
      if (url.hostname.includes("youtu.be")) return url.pathname.slice(1).split("/")[0];
      if (url.hostname.includes("youtube.com")) return url.searchParams.get("v") || "";
    } catch {
      return "";
    }
    return "";
  }

  function embedHtml(id, title) {
    return (
      '<div class="video-embed">' +
      '<iframe src="https://www.youtube-nocookie.com/embed/' +
      id +
      '?rel=0" title="' +
      title +
      '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy"></iframe>' +
      "</div>"
    );
  }

  function mountVideo(containerId, linkId, url, title, placeholderId) {
    const wrap = document.getElementById(containerId);
    const link = document.getElementById(linkId);
    const id = youtubeId(url);
    if (!id) {
      if (wrap) wrap.hidden = true;
      if (link) link.hidden = true;
      return;
    }
    if (wrap) {
      wrap.hidden = false;
      wrap.innerHTML = embedHtml(id, title);
    }
    if (link) {
      link.hidden = false;
      link.href = "https://www.youtube.com/watch?v=" + id;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }
    const phId = placeholderId || null;
    if (phId) {
      const ph = document.getElementById(phId);
      if (ph) ph.hidden = true;
    }
  }

  function setProductImage(imgId, primary, fallback) {
    const img = document.getElementById(imgId);
    if (!img) return;
    img.src = primary || fallback;
    img.onerror = () => {
      if (fallback && img.src.indexOf(fallback) === -1) img.src = fallback;
    };
  }

  const images = cfg.images || {};
  const videos = Object.assign({}, cfg.videos || {});
  try {
    const savedVideos = localStorage.getItem("ai_controller_videos");
    if (savedVideos) Object.assign(videos, JSON.parse(savedVideos));
  } catch (e) {}
  const prices = cfg.prices || {};

  function formatBdt(amount) {
    if (!Number.isFinite(amount)) return "";
    return "৳" + Math.round(amount).toLocaleString("en-US");
  }

  function applyPrices() {
    document.querySelectorAll("[data-price]").forEach((el) => {
      const key = el.getAttribute("data-price");
      if (key && prices[key] != null) el.textContent = formatBdt(prices[key]);
    });

    const homeCtrl = document.querySelector(".home-meta .price-chip strong");
    if (homeCtrl && prices.controller != null) homeCtrl.textContent = formatBdt(prices.controller);

    // Mobile bottom bar — package start price (controller + sensor), not old 4990
    const stickyOrder = document.getElementById("sticky-order-btn");
    if (stickyOrder) {
      const base =
        (Number(prices.controller) || 0) + (Number(prices.sensor) || 0);
      if (base > 0) {
        stickyOrder.textContent = "অর্ডার · " + formatBdt(base);
      }
    }
  }

  let currentCalcState = {
    ctrl: 4500,
    sensorPrice: 1550,
    perFoot: 8,
    feet: 30,
    cableTotal: 240,
    total: 6290
  };

  function initPriceCalculator() {
    const root = document.getElementById("price-calc");
    if (!root) return;

    const feetInput = document.getElementById("calc-cable-feet");
    const lineController = document.getElementById("calc-line-controller");
    const lineSensor = document.getElementById("calc-line-sensor");
    const lineCable = document.getElementById("calc-line-cable");
    const totalEl = document.getElementById("calc-total");
    const feetLabel = document.getElementById("calc-feet-label");
    const orderBtn = document.getElementById("calc-order-btn");
    const formTotal = document.getElementById("form-order-total");

    function recalc() {
      const ctrl = Number(prices.controller) || 0;
      const sensorPrice = Number(prices.sensor) || 0;
      const perFoot = Number(prices.cablePerFoot) || 0;
      let feet = Number(feetInput && feetInput.value);
      if (!Number.isFinite(feet) || feet < 0) feet = 0;
      feet = Math.min(500, Math.round(feet));

      const cableTotal = feet * perFoot;
      const total = ctrl + sensorPrice + cableTotal;

      currentCalcState = {
        ctrl,
        sensorPrice,
        perFoot,
        feet,
        cableTotal,
        total
      };

      if (lineController) lineController.textContent = formatBdt(ctrl);
      if (lineSensor) lineSensor.textContent = formatBdt(sensorPrice);
      if (feetLabel) feetLabel.textContent = String(feet);
      if (lineCable) lineCable.textContent = formatBdt(cableTotal);
      if (totalEl) totalEl.textContent = formatBdt(total);
      if (formTotal) formTotal.textContent = formatBdt(total);

      if (orderBtn) {
        const msg =
          "আমি AI Water Controller অর্ডার করতে চাই।\n" +
          "প্যাকেজ: Controller + Premium Sensor\n" +
          "Controller: " +
          formatBdt(ctrl) +
          "\n" +
          "Premium Sensor: " +
          formatBdt(sensorPrice) +
          "\n" +
          "Cable: " +
          feet +
          " ফুট × " +
          formatBdt(perFoot) +
          " = " +
          formatBdt(cableTotal) +
          "\n" +
          "মোট: " +
          formatBdt(total);
        orderBtn.href =
          "https://wa.me/8801745242000?text=" + encodeURIComponent(msg);
      }
    }

    if (feetInput) {
      feetInput.addEventListener("input", recalc);
      feetInput.addEventListener("change", recalc);
    }
    recalc();
  }

  function initCustomerOrderForm() {
    const orderForm = document.getElementById("customer-order-form");
    const successCard = document.getElementById("order-success-card");
    const submitBtn = document.getElementById("btn-submit-order");
    const newOrderBtn = document.getElementById("btn-new-order");

    if (!orderForm) return;

    orderForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const nameInput = document.getElementById("order-customer-name");
      const phoneInput = document.getElementById("order-customer-phone");
      const addressInput = document.getElementById("order-customer-address");
      const noteInput = document.getElementById("order-customer-note");

      const name = (nameInput && nameInput.value ? nameInput.value : "").trim();
      const phone = (phoneInput && phoneInput.value ? phoneInput.value : "").trim();
      const address = (addressInput && addressInput.value ? addressInput.value : "").trim();
      const note = (noteInput && noteInput.value ? noteInput.value : "").trim();

      if (!name || !phone || !address) {
        alert("অনুগ্রহ করে আপনার নাম, মোবাইল নম্বর এবং সম্পূর্ণ ঠিকানা লিখুন।");
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = "<span>⏳ অর্ডার জমা হচ্ছে...</span>";
      }

      const calc = currentCalcState;
      const orderPayload = {
        name,
        phone,
        address,
        note,
        cableFeet: calc.feet,
        controllerPrice: calc.ctrl,
        sensorPrice: calc.sensorPrice,
        cablePrice: calc.cableTotal,
        totalPrice: calc.total
      };

      let createdOrder = null;

      // 1. Try sending to backend server API
      try {
        const apiUrl = new URL("api/orders", window.location.href).href;
        const res = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(orderPayload)
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.order) {
            createdOrder = json.order;
          }
        }
      } catch (err) {
        // Offline or static file mode
      }

      // 2. Fallback to LocalStorage if server API was unavailable
      if (!createdOrder) {
        const orderId = "ORD-" + Math.floor(100000 + Math.random() * 900000);
        const now = new Date();
        createdOrder = {
          id: orderId,
          createdAt: now.toISOString(),
          formattedTime: now.toLocaleString("en-US", { timeZone: "Asia/Dhaka" }),
          ...orderPayload,
          packageName: "AI Controller + Premium Sensor",
          status: "pending",
          confirmedAt: null
        };
      }

      // Always sync to LocalStorage
      try {
        const local = localStorage.getItem("ai_controller_orders");
        const list = local ? JSON.parse(local) : [];
        list.unshift(createdOrder);
        localStorage.setItem("ai_controller_orders", JSON.stringify(list));
      } catch (e) {}

      // Display Success Card
      orderForm.hidden = true;
      if (successCard) {
        const nameEl = document.getElementById("success-name");
        const idEl = document.getElementById("success-id");
        const phoneEl = document.getElementById("success-phone");
        const addressEl = document.getElementById("success-address");
        const cableEl = document.getElementById("success-cable");
        const totalEl = document.getElementById("success-total");

        if (nameEl) nameEl.textContent = createdOrder.name;
        if (idEl) idEl.textContent = "#" + createdOrder.id;
        if (phoneEl) phoneEl.textContent = createdOrder.phone;
        if (addressEl) addressEl.textContent = createdOrder.address;
        if (cableEl) cableEl.textContent = `${createdOrder.cableFeet} ফুট (${formatBdt(createdOrder.cablePrice)})`;
        if (totalEl) totalEl.textContent = formatBdt(createdOrder.totalPrice);

        const waBtn = document.getElementById("success-whatsapp-btn");
        if (waBtn) {
          const waMsg = encodeURIComponent(
            `আসসালামু আলাইকুম, আমি AI Water Controller ওয়েবসাইটে একটি অর্ডার দিয়েছি।\n` +
            `অর্ডার নম্বর: #${createdOrder.id}\n` +
            `নাম: ${createdOrder.name}\n` +
            `মোবাইল: ${createdOrder.phone}\n` +
            `প্যাকেজ: Controller + Premium Sensor\n` +
            `ক্যাবল: ${createdOrder.cableFeet} ফুট\n` +
            `মোট বিল: ${formatBdt(createdOrder.totalPrice)} (ক্যাশ অন ডেলিভারি)\n` +
            `ঠিকানা: ${createdOrder.address}`
          );
          waBtn.href = `https://wa.me/8801745242000?text=${waMsg}`;
        }

        successCard.hidden = false;
        successCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = "<span>✓ অর্ডার কনফার্ম করুন (ক্যাশ অন ডেলিভারি)</span>";
      }
    });

    if (newOrderBtn) {
      newOrderBtn.addEventListener("click", () => {
        if (successCard) successCard.hidden = true;
        if (orderForm) {
          orderForm.reset();
          orderForm.hidden = false;
          orderForm.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      });
    }
  }

  applyPrices();
  initPriceCalculator();
  initCustomerOrderForm();

  setProductImage("home-controller-img", images.controller, images.controllerFallback);
  setProductImage("pkg-controller-img", images.controller, images.controllerFallback);
  setProductImage("pkg-sensor-img", images.sensor, images.sensorFallback);

  const posterImg = document.getElementById("promo-poster-img");
  if (posterImg && images.poster) posterImg.src = images.poster;

  function initPlayStoreLinks() {
    const links = cfg.links || {};
    const playUrl = (links.playStore || "").trim();
    const hasLink = /^https?:\/\//i.test(playUrl);

    const heroBtn = document.getElementById("play-store-btn-hero");
    const demoBtn = document.getElementById("play-store-btn-demo");
    const flowBtn = document.getElementById("play-store-btn-flow");
    const wrap = document.getElementById("play-store-wrap");

    [heroBtn, demoBtn, flowBtn].forEach((btn) => {
      if (!btn) return;
      if (hasLink) {
        btn.href = playUrl;
        btn.hidden = false;
      } else {
        btn.hidden = true;
      }
    });

    if (wrap) wrap.hidden = !hasLink;
  }

  initPlayStoreLinks();

  function normalizeReviewList(list) {
    if (!Array.isArray(list)) return [];
    return list
      .map((item, i) => {
        if (typeof item === "string") {
          return { id: "cfg-" + i, src: item.trim(), alt: "কাস্টমার কমেন্ট" };
        }
        if (item && item.src) {
          return {
            id: item.id || "cfg-" + i,
            src: String(item.src).trim(),
            alt: item.alt || "কাস্টমার কমেন্ট",
          };
        }
        return null;
      })
      .filter((item) => item && item.src);
  }

  async function loadReviews() {
    let list = [];
    try {
      const apiUrl = new URL("api/reviews", window.location.href).href;
      const res = await fetch(apiUrl, { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.reviews) && json.reviews.length) {
          list = normalizeReviewList(json.reviews);
        }
      }
    } catch (e) {}

    if (!list.length) {
      list = normalizeReviewList(cfg.reviews || []);
    }
    return list;
  }

  function initReviewsSlider(reviews) {
    const slider = document.getElementById("reviews-slider");
    const track = document.getElementById("reviews-track");
    const dotsWrap = document.getElementById("reviews-dots");
    const empty = document.getElementById("reviews-empty");
    const prevBtn = document.getElementById("reviews-prev");
    const nextBtn = document.getElementById("reviews-next");

    if (!slider || !track) return;

    if (!reviews.length) {
      slider.hidden = true;
      if (empty) empty.hidden = false;
      return;
    }

    if (empty) empty.hidden = true;
    slider.hidden = false;

    track.innerHTML = reviews
      .map(
        (r) =>
          '<div class="reviews-slide">' +
          '<img src="' +
          r.src.replace(/"/g, "") +
          '" alt="' +
          String(r.alt || "কাস্টমার কমেন্ট").replace(/"/g, "") +
          '" loading="lazy" />' +
          "</div>"
      )
      .join("");

    dotsWrap.innerHTML = reviews
      .map(
        (_, i) =>
          '<button type="button" class="reviews-dot' +
          (i === 0 ? " is-active" : "") +
          '" data-index="' +
          i +
          '" aria-label="স্লাইড ' +
          (i + 1) +
          '"></button>'
      )
      .join("");

    let index = 0;
    let timer = null;
    const total = reviews.length;

    function goTo(i) {
      index = (i + total) % total;
      track.style.transform = "translateX(-" + index * 100 + "%)";
      dotsWrap.querySelectorAll(".reviews-dot").forEach((dot, di) => {
        dot.classList.toggle("is-active", di === index);
      });
    }

    function next() {
      goTo(index + 1);
    }

    function prev() {
      goTo(index - 1);
    }

    function startAuto() {
      stopAuto();
      if (total < 2) return;
      timer = window.setInterval(next, 4000);
    }

    function stopAuto() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }

    if (prevBtn) prevBtn.onclick = () => { prev(); startAuto(); };
    if (nextBtn) nextBtn.onclick = () => { next(); startAuto(); };

    dotsWrap.addEventListener("click", (e) => {
      const btn = e.target.closest(".reviews-dot");
      if (!btn) return;
      goTo(Number(btn.getAttribute("data-index")) || 0);
      startAuto();
    });

    slider.addEventListener("mouseenter", stopAuto);
    slider.addEventListener("mouseleave", startAuto);
    slider.addEventListener("touchstart", stopAuto, { passive: true });
    slider.addEventListener("touchend", startAuto, { passive: true });

    goTo(0);
    startAuto();
  }

  loadReviews().then(initReviewsSlider);

  mountVideo(
    "app-setup-video-wrap",
    null,
    videos.appSetup,
    "App Setup Video — AI Water Controller",
    "app-setup-video-placeholder"
  );
  mountVideo(
    "controller-video-wrap",
    null,
    videos.controller,
    "Controller Video — AI Water Controller",
    "controller-video-placeholder"
  );
  mountVideo(
    "install-video-wrap",
    null,
    videos.installation,
    "Installation Video — AI Water Controller",
    "install-video-placeholder"
  );
  mountVideo(
    "app-details-video-wrap",
    null,
    videos.appDetails,
    "App Details — AI Water Controller",
    "app-details-video-placeholder"
  );
  mountVideo("pkg-controller-video-wrap", "pkg-controller-video", videos.controller, "AI Water Controller ভিডিও");
  mountVideo("home-controller-video-wrap", "home-controller-video", videos.controller, "AI Water Controller ভিডিও");
})();
