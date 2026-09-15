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
  const linksCfg = cfg.links || {};

  function getWhatsAppNumber() {
    let n = String(linksCfg.whatsapp || "8801745242000").replace(/[^0-9]/g, "");
    if (n.startsWith("0")) n = "88" + n;
    if (!n.startsWith("88") && n.length === 11) n = "88" + n;
    return n || "8801745242000";
  }

  function getPhoneDisplay() {
    return String(linksCfg.phone || "01745242000").trim() || "01745242000";
  }

  function getCableFeetValue() {
    const feetInput = document.getElementById("calc-cable-feet");
    const raw = feetInput ? String(feetInput.value).trim() : "";
    if (raw === "") return null;
    let feet = Number(raw);
    if (!Number.isFinite(feet)) return null;
    feet = Math.round(feet);
    if (feet < 1 || feet > 500) return null;
    return feet;
  }

  function requireCableSize(scrollToCable) {
    const feet = getCableFeetValue();
    const feetInput = document.getElementById("calc-cable-feet");
    const hint = document.getElementById("cable-must-hint");
    if (feet != null) {
      if (feetInput) feetInput.classList.remove("is-invalid");
      if (hint) hint.classList.remove("is-visible");
      return feet;
    }
    if (feetInput) {
      feetInput.classList.add("is-invalid");
      if (scrollToCable !== false) {
        feetInput.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => {
          try {
            feetInput.focus({ preventScroll: true });
          } catch (err) {
            feetInput.focus();
          }
        }, 280);
      }
    }
    if (hint) hint.classList.add("is-visible");
    alert("অর্ডার করতে Cable সাইজ (কত ফুট) অবশ্যই দিতে হবে।");
    return null;
  }

  function setOrderFlowStep(stepNum) {
    const steps = document.querySelectorAll(".order-flow-steps li");
    steps.forEach((li, i) => {
      li.classList.toggle("is-current", i === stepNum - 1);
    });
  }

  function goToOrderForm(e) {
    if (e) e.preventDefault();
    if (requireCableSize(true) == null) return;

    const combo = document.getElementById("price-calc");
    const box = document.getElementById("order-form-container") || document.getElementById("order-form-box");
    const form = document.getElementById("customer-order-form");
    const successCard = document.getElementById("order-success-card");
    const nameInput = document.getElementById("order-customer-name");

    if (successCard) successCard.hidden = true;
    if (form) form.hidden = false;
    setOrderFlowStep(2);

    const target = box || combo;
    if (target) {
      target.classList.add("order-form-box--focus");
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(() => target.classList.remove("order-form-box--focus"), 2200);
    }
    if (nameInput) {
      setTimeout(() => {
        try {
          nameInput.focus({ preventScroll: true });
        } catch (err) {
          nameInput.focus();
        }
      }, 350);
    }
  }

  function initOrderFormLinks() {
    document.querySelectorAll("[data-go-order-form], #sticky-order-btn, #pkg-order-now-btn").forEach((el) => {
      el.addEventListener("click", goToOrderForm);
    });
  }

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
    feet: 0,
    cableTotal: 0,
    total: 6050
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
    const waBtn = document.getElementById("calc-whatsapp-btn");
    const formTotal = document.getElementById("form-order-total");
    const submitBtnLabel = document.querySelector("#btn-submit-order span");
    const cableHint = document.getElementById("cable-must-hint");

    function recalc() {
      const ctrl = Number(prices.controller) || 0;
      const sensorPrice = Number(prices.sensor) || 0;
      const perFoot = Number(prices.cablePerFoot) || 0;
      const parsed = getCableFeetValue();
      const feet = parsed == null ? 0 : parsed;

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
      if (feetLabel) feetLabel.textContent = parsed == null ? "—" : String(feet);
      if (lineCable) lineCable.textContent = formatBdt(cableTotal);
      if (totalEl) totalEl.textContent = formatBdt(total);
      if (formTotal) formTotal.textContent = formatBdt(total);
      if (submitBtnLabel) {
        submitBtnLabel.textContent = "✓ প্যাকেজ অর্ডার কনফার্ম করুন · " + formatBdt(total);
      }

      if (parsed != null) {
        if (feetInput) feetInput.classList.remove("is-invalid");
        if (cableHint) cableHint.classList.remove("is-visible");
      }

      if (orderBtn) {
        orderBtn.href = "#order-form-container";
      }

      if (waBtn) {
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
          (parsed == null ? "দেওয়া হয়নি" : feet + " ফুট × " + formatBdt(perFoot) + " = " + formatBdt(cableTotal)) +
          "\n" +
          "মোট: " +
          formatBdt(total);
        waBtn.href =
          "https://wa.me/" + getWhatsAppNumber() + "?text=" + encodeURIComponent(msg);
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

      if (requireCableSize(true) == null) {
        setOrderFlowStep(1);
        return;
      }

      if (!name || !phone || !address) {
        alert("অনুগ্রহ করে আপনার নাম, মোবাইল নম্বর এবং সম্পূর্ণ ঠিকানা লিখুন।");
        return;
      }

      setOrderFlowStep(3);

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
      let savedToCloud = false;

      // 1. Try cloud / backend API
      try {
        if (window.OrdersAPI) {
          createdOrder = await window.OrdersAPI.createOrderRemote(orderPayload);
          savedToCloud = true;
        } else {
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
              savedToCloud = true;
            }
          }
        }
      } catch (err) {
        // offline or static host without cloud API
      }

      // 2. Fallback order object if API unavailable
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

      // Same-browser backup only (does NOT sync to other phones/admin)
      try {
        const local = localStorage.getItem("ai_controller_orders");
        const list = local ? JSON.parse(local) : [];
        list.unshift(createdOrder);
        localStorage.setItem("ai_controller_orders", JSON.stringify(list));
      } catch (e) {}

      const waMsg = encodeURIComponent(
        "\u0986\u09b8\u09b8\u09be\u09b2\u09be\u09ae\u09c1 \u0986\u09b2\u09be\u0987\u0995\u09c1\u09ae, \u0986\u09ae\u09bf AI Water Controller \u0993\u09df\u09c7\u09ac\u09b8\u09be\u0987\u099f\u09c7 \u098f\u0995\u099f\u09bf \u0985\u09b0\u09cd\u09a1\u09be\u09b0 \u09a6\u09bf\u09df\u09c7\u099b\u09bf\u0964\n" +
        "\u0985\u09b0\u09cd\u09a1\u09be\u09b0 \u09a8\u09ae\u09cd\u09ac\u09b0: #" + createdOrder.id + "\n" +
        "\u09a8\u09be\u09ae: " + createdOrder.name + "\n" +
        "\u09ae\u09cb\u09ac\u09be\u0987\u09b2: " + createdOrder.phone + "\n" +
        "\u09aa\u09cd\u09af\u09be\u0995\u09c7\u099c: Controller + Premium Sensor\n" +
        "\u0995\u09cd\u09af\u09be\u09ac\u09b2: " + createdOrder.cableFeet + " \u09ab\u09c1\u099f\n" +
        "\u09ae\u09cb\u099f \u09ac\u09bf\u09b2: " + formatBdt(createdOrder.totalPrice) + " (\u0995\u09cd\u09af\u09be\u09b6 \u0985\u09a8 \u09a1\u09c7\u09b2\u09bf\u09ad\u09be\u09b0\u09bf)\n" +
        "\u09a0\u09bf\u0995\u09be\u09a8\u09be: " + createdOrder.address +
        (createdOrder.note ? ("\n\u09a8\u09cb\u099f: " + createdOrder.note) : "")
      );
      const waUrl = "https://wa.me/" + getWhatsAppNumber() + "?text=" + waMsg;

      // No cloud API -> admin stays empty; open WhatsApp so shop gets the order
      const hasCloud = window.OrdersAPI && window.OrdersAPI.hasCloudOrdersApi();
      if (!savedToCloud && !hasCloud) {
        try {
          window.open(waUrl, "_blank", "noopener,noreferrer");
        } catch (e) {}
      }

      orderForm.hidden = true;
      if (successCard) {
        const nameEl = document.getElementById("success-name");
        const idEl = document.getElementById("success-id");
        const phoneEl = document.getElementById("success-phone");
        const addressEl = document.getElementById("success-address");
        const cableEl = document.getElementById("success-cable");
        const totalEl = document.getElementById("success-total");
        const hintEl = document.getElementById("success-admin-hint");

        if (nameEl) nameEl.textContent = createdOrder.name;
        if (idEl) idEl.textContent = "#" + createdOrder.id;
        if (phoneEl) phoneEl.textContent = createdOrder.phone;
        if (addressEl) addressEl.textContent = createdOrder.address;
        if (cableEl) cableEl.textContent = createdOrder.cableFeet + " \u09ab\u09c1\u099f (" + formatBdt(createdOrder.cablePrice) + ")";
        if (totalEl) totalEl.textContent = formatBdt(createdOrder.totalPrice);

        const waBtn = document.getElementById("success-whatsapp-btn");
        if (waBtn) {
          waBtn.href = waUrl;
          waBtn.textContent = savedToCloud
            ? "\ud83d\udcac WhatsApp-\u098f \u0985\u09b0\u09cd\u09a1\u09be\u09b0 \u099f\u09cd\u09b0\u09cd\u09af\u09be\u0995 \u0995\u09b0\u09c1\u09a8"
            : "\ud83d\udcac WhatsApp-\u098f \u0985\u09b0\u09cd\u09a1\u09be\u09b0 \u09aa\u09be\u09a0\u09be\u09a8 (\u099c\u09b0\u09c1\u09b0\u09bf)";
        }

        if (hintEl) {
          hintEl.textContent = savedToCloud
            ? "\u0986\u09aa\u09a8\u09be\u09b0 \u0985\u09b0\u09cd\u09a1\u09be\u09b0 \u0985\u09cd\u09af\u09be\u09a1\u09ae\u09bf\u09a8 \u09aa\u09cd\u09af\u09be\u09a8\u09c7\u09b2\u09c7 \u09aa\u09cc\u0981\u099b\u09c7\u099b\u09c7\u0964 \u0986\u09ae\u09be\u09a6\u09c7\u09b0 \u09aa\u09cd\u09b0\u09a4\u09bf\u09a8\u09bf\u09a7\u09bf \u09b6\u09c0\u0998\u09cd\u09b0\u0987 \u09af\u09cb\u0997\u09be\u09af\u09cb\u0997 \u0995\u09b0\u09ac\u09c7\u0964"
            : "\u0985\u09b0\u09cd\u09a1\u09be\u09b0 \u09a8\u09bf\u09b6\u09cd\u099a\u09bf\u09a4 \u0995\u09b0\u09a4\u09c7 \u09a8\u09bf\u099a\u09c7\u09b0 WhatsApp \u09ac\u09be\u099f\u09a8\u09c7 \u099a\u09be\u09aa\u09c1\u09a8 \u0993 Send \u0995\u09b0\u09c1\u09a8 \u2014 \u09a4\u09be\u09b9\u09b2\u09c7 \u0986\u09ae\u09b0\u09be \u09b8\u09be\u09a5\u09c7 \u09b8\u09be\u09a5\u09c7 \u09aa\u09be\u09ac\u0964";
        }

        successCard.hidden = false;
        successCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = "<span>✓ প্যাকেজ অর্ডার কনফার্ম করুন</span>";
      }
    });

    if (newOrderBtn) {
      newOrderBtn.addEventListener("click", () => {
        if (successCard) successCard.hidden = true;
        if (orderForm) {
          orderForm.reset();
          orderForm.hidden = false;
        }
        setOrderFlowStep(1);
        const pkg = document.querySelector(".order-step--package");
        if (pkg) pkg.scrollIntoView({ behavior: "smooth", block: "start" });
        const feetInput = document.getElementById("calc-cable-feet");
        if (feetInput) {
          feetInput.focus();
          feetInput.dispatchEvent(new Event("input", { bubbles: true }));
        }
      });
    }
  }

  applyPrices();
  initPriceCalculator();
  initCustomerOrderForm();
  initOrderFormLinks();

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
