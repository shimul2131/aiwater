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
    const hidden = document.getElementById("calc-cable-feet-value");
    const customInput = document.getElementById("calc-cable-feet");
    const mode = (hidden && hidden.getAttribute("data-mode")) || "";

    if (mode === "custom") {
      const raw = customInput ? String(customInput.value).trim() : "";
      if (raw === "") return null;
      let feet = Number(raw);
      if (!Number.isFinite(feet)) return null;
      feet = Math.round(feet);
      if (feet < 1 || feet > 500) return null;
      return feet;
    }

    const fromHidden = hidden ? String(hidden.value).trim() : "";
    if (fromHidden === "") return null;
    let feet = Number(fromHidden);
    if (!Number.isFinite(feet)) return null;
    feet = Math.round(feet);
    if (feet < 1 || feet > 500) return null;
    return feet;
  }

  function updateCableSelectedLabel(feet) {
    const label = document.getElementById("cable-selected-label");
    const chip = document.getElementById("order-cable-chip");
    if (label) {
      if (feet != null) {
        label.hidden = false;
        const strong = label.querySelector("strong");
        if (strong) strong.textContent = String(feet);
      } else {
        label.hidden = true;
      }
    }
    if (chip) {
      if (feet != null) {
        chip.hidden = false;
        const strong = chip.querySelector("strong");
        if (strong) strong.textContent = String(feet);
      } else {
        chip.hidden = true;
      }
    }
  }

  function setCableFeetSelection(feetOrCustom, options) {
    const opts = options || {};
    const hidden = document.getElementById("calc-cable-feet-value");
    const customRow = document.getElementById("cable-custom-row");
    const customInput = document.getElementById("calc-cable-feet");
    const hint = document.getElementById("cable-must-hint");
    const buttons = document.querySelectorAll(".cable-feet-opt");

    buttons.forEach((btn) => {
      const val = btn.getAttribute("data-feet");
      const isCustom = feetOrCustom === "custom";
      const active = isCustom ? val === "custom" : String(val) === String(feetOrCustom);
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });

    if (feetOrCustom === "custom") {
      if (hidden) {
        hidden.value = "";
        hidden.setAttribute("data-mode", "custom");
      }
      if (customRow) customRow.hidden = false;
      if (!opts.skipFocus && customInput) {
        setTimeout(() => {
          try {
            customInput.focus({ preventScroll: true });
          } catch (err) {
            customInput.focus();
          }
        }, 50);
      }
      updateCableSelectedLabel(getCableFeetValue());
    } else {
      const feet = Number(feetOrCustom);
      if (hidden) {
        hidden.value = String(feet);
        hidden.setAttribute("data-mode", "preset");
      }
      if (customRow) customRow.hidden = true;
      if (customInput) {
        customInput.value = String(feet);
        customInput.classList.remove("is-invalid");
      }
      updateCableSelectedLabel(feet);
    }

    if (hint) hint.classList.remove("is-visible");
    if (typeof opts.onChange === "function") opts.onChange();
  }

  function requireCableSize(scrollToCable) {
    const feet = getCableFeetValue();
    const picker = document.getElementById("cable-feet-picker");
    const customInput = document.getElementById("calc-cable-feet");
    const hint = document.getElementById("cable-must-hint");
    const hidden = document.getElementById("calc-cable-feet-value");
    const mode = hidden ? hidden.getAttribute("data-mode") : "";

    if (feet != null) {
      if (customInput) customInput.classList.remove("is-invalid");
      if (hint) hint.classList.remove("is-visible");
      updateCableSelectedLabel(feet);
      return feet;
    }

    if (hint) hint.classList.add("is-visible");
    if (mode === "custom" && customInput) {
      customInput.classList.add("is-invalid");
    }
    if (scrollToCable !== false && picker) {
      picker.scrollIntoView({ behavior: "smooth", block: "center" });
      if (mode === "custom" && customInput) {
        setTimeout(() => {
          try {
            customInput.focus({ preventScroll: true });
          } catch (err) {
            customInput.focus();
          }
        }, 280);
      }
    }
    alert("অর্ডার করতে Cable কত ফুট লাগবে সেটা বেছে নিন (বা Custom লিখুন)।");
    return null;
  }

  function setOrderFlowStep(stepNum) {
    const steps = document.querySelectorAll(".order-flow-steps li");
    steps.forEach((li, i) => {
      li.classList.toggle("is-current", i === stepNum - 1);
    });
    const details = document.getElementById("order-form-container");
    // Step 1 = package only — hide order info until Order Now
    if (details) details.hidden = stepNum < 2;
  }

  function goToOrderForm(e) {
    if (e) e.preventDefault();
    const feet = requireCableSize(true);
    if (feet == null) return;
    updateCableSelectedLabel(feet);

    const combo = document.getElementById("price-calc");
    const box = document.getElementById("order-form-container") || document.getElementById("order-form-box");
    const form = document.getElementById("customer-order-form");
    const successCard = document.getElementById("order-success-card");
    const nameInput = document.getElementById("order-customer-name");
    const chip = document.getElementById("order-cable-chip");

    if (successCard) successCard.hidden = true;
    if (form) form.hidden = false;
    if (box) box.hidden = false;
    if (chip) {
      chip.hidden = false;
      const strong = chip.querySelector("strong");
      if (strong) strong.textContent = String(feet);
    }
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
    const submitBtnPrice = document.getElementById("btn-submit-order-price");
    const submitBtnLabel = document.querySelector("#btn-submit-order .btn-submit-order__text");
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
      if (submitBtnPrice) submitBtnPrice.textContent = formatBdt(total);
      if (submitBtnLabel) {
        submitBtnLabel.textContent = "প্যাকেজ অর্ডার কনফার্ম করুন";
      }

      if (parsed != null) {
        if (feetInput) feetInput.classList.remove("is-invalid");
        if (cableHint) cableHint.classList.remove("is-visible");
        updateCableSelectedLabel(parsed);
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

    const optionsWrap = document.querySelector(".cable-feet-options");
    if (optionsWrap) {
      optionsWrap.addEventListener("click", (e) => {
        const btn = e.target.closest(".cable-feet-opt");
        if (!btn) return;
        const val = btn.getAttribute("data-feet");
        if (val === "custom") {
          setCableFeetSelection("custom", { onChange: recalc });
        } else {
          setCableFeetSelection(val, { onChange: recalc });
        }
        recalc();
      });
    }

    if (feetInput) {
      feetInput.addEventListener("input", () => {
        const hidden = document.getElementById("calc-cable-feet-value");
        if (hidden) hidden.setAttribute("data-mode", "custom");
        recalc();
      });
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
        submitBtn.innerHTML =
          '<span class="btn-submit-order__row">' +
          '<span class="btn-submit-order__icon" aria-hidden="true">⏳</span>' +
          '<span class="btn-submit-order__text">অর্ডার জমা হচ্ছে...</span>' +
          "</span>";
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
      let cloudError = "";

      // 1. Try cloud / backend API
      try {
        if (window.OrdersAPI && window.OrdersAPI.hasCloudOrdersApi()) {
          createdOrder = await window.OrdersAPI.createOrderRemote(orderPayload);
          savedToCloud = true;
        } else if (window.OrdersAPI) {
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
        cloudError = err && err.message ? String(err.message) : "cloud fail";
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

      // No cloud save -> open WhatsApp so shop gets the order
      const hasCloud = window.OrdersAPI && window.OrdersAPI.hasCloudOrdersApi();
      if (!savedToCloud) {
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
          if (savedToCloud) {
            hintEl.textContent =
              "আপনার অর্ডার অ্যাডমিন প্যানেলে পৌঁছেছে। আমাদের প্রতিনিধি শীঘ্রই যোগাযোগ করবে।";
          } else if (hasCloud) {
            hintEl.textContent =
              "ক্লাউড Sync ব্যর্থ — WhatsApp খুলেছে। সেখান থেকে Send করুন যাতে অর্ডার পাই।";
          } else {
            hintEl.textContent =
              "অর্ডার নিশ্চিত করতে নিচের WhatsApp বাটনে চাপুন ও Send করুন — তাহলে আমরা সাথে সাথে পাব।";
          }
        }

        successCard.hidden = false;
        successCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML =
          '<span class="btn-submit-order__row">' +
          '<span class="btn-submit-order__icon" aria-hidden="true">✓</span>' +
          '<span class="btn-submit-order__text">প্যাকেজ অর্ডার কনফার্ম করুন</span>' +
          "</span>" +
          '<span class="btn-submit-order__price" id="btn-submit-order-price">' +
          formatBdt(currentCalcState.total) +
          "</span>";
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
        const hidden = document.getElementById("calc-cable-feet-value");
        const customRow = document.getElementById("cable-custom-row");
        const customInput = document.getElementById("calc-cable-feet");
        if (hidden) {
          hidden.value = "";
          hidden.removeAttribute("data-mode");
        }
        if (customRow) customRow.hidden = true;
        if (customInput) {
          customInput.value = "";
          customInput.classList.remove("is-invalid");
        }
        document.querySelectorAll(".cable-feet-opt").forEach((btn) => {
          btn.classList.remove("is-active");
          btn.setAttribute("aria-pressed", "false");
        });
        updateCableSelectedLabel(null);
        const pkg = document.querySelector(".order-step--package");
        if (pkg) pkg.scrollIntoView({ behavior: "smooth", block: "start" });
        if (customInput) customInput.dispatchEvent(new Event("input", { bubbles: true }));
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

  const DEFAULT_TEXT_REVIEWS = [
    {
      id: "demo-1",
      name: "রাকিব - ঢাকা",
      comment: "AI Water Controller লাগানোর পর আর ট্যাঙ্ক ওভারফ্লো হয় না। মোবাইল থেকে সহজেই মোটর চালু-বন্ধ করতে পারি।",
    },
    {
      id: "demo-2",
      name: "নাসির - চট্টগ্রাম",
      comment: "Premium Sensor খুব ভালো কাজ করে। পানির লেভেল অ্যাপে স্পষ্ট দেখা যায়।",
    },
    {
      id: "demo-3",
      name: "সাবিনা - রাজশাহী",
      comment: "ইনস্টল সহজ, সাপোর্টও ভালো পেয়েছি। কেবল মাপ অনুযায়ী নিয়েছি — সব মিলিয়ে সন্তুষ্ট।",
    },
  ];

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function normalizeReviewList(list) {
    if (!Array.isArray(list)) return [];
    return list
      .map((item, i) => {
        if (typeof item === "string") {
          return { id: "cfg-" + i, src: item.trim(), alt: "কাস্টমার কমেন্ট", type: "image" };
        }
        if (!item || typeof item !== "object") return null;
        if (item.comment || item.name) {
          return {
            id: item.id || "txt-" + i,
            name: String(item.name || "কাস্টমার").trim(),
            comment: String(item.comment || "").trim(),
            src: item.src ? String(item.src).trim() : "",
            type: "text",
          };
        }
        if (item.src) {
          return {
            id: item.id || "cfg-" + i,
            src: String(item.src).trim(),
            alt: item.alt || "কাস্টমার কমেন্ট",
            type: "image",
          };
        }
        return null;
      })
      .filter((item) => {
        if (!item) return false;
        if (item.type === "text") return !!item.comment;
        return !!item.src;
      });
  }

  const USER_REVIEWS_KEY = "ai_controller_user_reviews";
  const HIDDEN_REVIEWS_KEY = "ai_controller_hidden_review_ids";

  function readHiddenReviewIds() {
    try {
      const raw = localStorage.getItem(HIDDEN_REVIEWS_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list.map(String) : [];
    } catch (e) {
      return [];
    }
  }

  function readUserReviews() {
    try {
      const raw = localStorage.getItem(USER_REVIEWS_KEY);
      const hidden = new Set(readHiddenReviewIds());
      const list = normalizeReviewList(raw ? JSON.parse(raw) : []);
      return list.filter((r) => !hidden.has(String(r.id)));
    } catch (e) {
      return [];
    }
  }

  function saveUserReviews(list) {
    try {
      localStorage.setItem(USER_REVIEWS_KEY, JSON.stringify(list.slice(0, 40)));
    } catch (e) {}
  }

  async function loadReviews() {
    const hidden = new Set(readHiddenReviewIds());
    let cloudText = [];
    try {
      if (window.OrdersAPI && window.OrdersAPI.fetchReviewsList) {
        const list = await window.OrdersAPI.fetchReviewsList();
        cloudText = normalizeReviewList(
          (list || []).map((r) => ({
            id: r.id,
            name: r.name,
            comment: r.comment,
            createdAt: r.createdAt,
            type: "text",
          }))
        ).filter((r) => !hidden.has(String(r.id)));
      }
    } catch (e) {}

    const userReviews = readUserReviews().filter(
      (r) => !cloudText.some((c) => String(c.id) === String(r.id))
    );

    let configReviews = [];
    try {
      const apiUrl = new URL("api/reviews", window.location.href).href;
      const res = await fetch(apiUrl, { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.reviews) && json.reviews.length) {
          configReviews = normalizeReviewList(json.reviews);
        }
      }
    } catch (e) {}

    if (!configReviews.length) {
      configReviews = normalizeReviewList(cfg.reviews || []);
    }

    const merged = cloudText.concat(userReviews).concat(configReviews);
    const hasText = merged.some((r) => r.type === "text");
    if (!hasText) {
      return normalizeReviewList(DEFAULT_TEXT_REVIEWS)
        .filter((r) => !hidden.has(String(r.id)))
        .concat(merged);
    }
    return merged;
  }

  function buildReviewSlideHtml(r) {
    if (r.type === "image") {
      return (
        '<div class="reviews-slide reviews-slide--image">' +
        '<img src="' +
        escapeHtml(r.src) +
        '" alt="' +
        escapeHtml(r.alt || "কাস্টমার কমেন্ট") +
        '" loading="lazy" />' +
        "</div>"
      );
    }
    return (
      '<div class="reviews-slide reviews-slide--quote">' +
      '<blockquote class="reviews-quote">' +
      "<p>“" +
      escapeHtml(r.comment) +
      "”</p>" +
      (r.src
        ? '<img class="reviews-quote-photo" src="' + escapeHtml(r.src) + '" alt="" loading="lazy" />'
        : "") +
      '<cite class="reviews-author">' +
      escapeHtml(r.name || "কাস্টমার") +
      "</cite>" +
      "</blockquote>" +
      "</div>"
    );
  }

  let reviewsSliderApi = null;

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
      reviewsSliderApi = null;
      return;
    }

    if (empty) empty.hidden = true;
    slider.hidden = false;

    track.innerHTML = reviews.map(buildReviewSlideHtml).join("");

    if (dotsWrap) {
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
    }

    let index = 0;
    let timer = null;
    const total = reviews.length;

    function goTo(i) {
      index = (i + total) % total;
      track.style.transform = "translateX(-" + index * 100 + "%)";
      if (dotsWrap) {
        dotsWrap.querySelectorAll(".reviews-dot").forEach((dot, di) => {
          dot.classList.toggle("is-active", di === index);
        });
      }
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
      timer = window.setInterval(next, 4500);
    }

    function stopAuto() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }

    if (prevBtn) prevBtn.onclick = () => { prev(); startAuto(); };
    if (nextBtn) nextBtn.onclick = () => { next(); startAuto(); };

    if (dotsWrap) {
      dotsWrap.onclick = (e) => {
        const btn = e.target.closest(".reviews-dot");
        if (!btn) return;
        goTo(Number(btn.getAttribute("data-index")) || 0);
        startAuto();
      };
    }

    slider.onmouseenter = stopAuto;
    slider.onmouseleave = startAuto;
    slider.ontouchstart = stopAuto;
    slider.ontouchend = startAuto;

    goTo(0);
    startAuto();
    reviewsSliderApi = { refresh: initReviewsSlider };
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function compressImageDataUrl(dataUrl, maxW, quality) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxW / Math.max(img.width, 1));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        try {
          resolve(canvas.toDataURL("image/jpeg", quality));
        } catch (e) {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  function initReviewForm() {
    const form = document.getElementById("customer-review-form");
    const msg = document.getElementById("reviews-form-msg");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = ((document.getElementById("review-name") || {}).value || "").trim();
      const comment = ((document.getElementById("review-comment") || {}).value || "").trim();
      const photoInput = document.getElementById("review-photo");
      const submitBtn = document.getElementById("btn-review-submit");

      if (!name || !comment) {
        if (msg) {
          msg.hidden = false;
          msg.textContent = "নাম ও কমেন্ট লিখুন।";
        }
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "পাঠানো হচ্ছে...";
      }

      let src = "";
      try {
        const file = photoInput && photoInput.files && photoInput.files[0];
        if (file) {
          if (file.size > 4 * 1024 * 1024) {
            throw new Error("ছবি ৪MB এর কম হতে হবে");
          }
          const raw = await readFileAsDataUrl(file);
          src = await compressImageDataUrl(raw, 900, 0.72);
        }
      } catch (err) {
        if (msg) {
          msg.hidden = false;
          msg.textContent = err && err.message ? err.message : "ছবি আপলোড ব্যর্থ";
        }
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "রিভিউ পাঠান";
        }
        return;
      }

      const entry = {
        id: "user-" + Date.now(),
        name,
        comment,
        src,
        type: "text",
        createdAt: new Date().toISOString(),
      };

      try {
        if (window.OrdersAPI && window.OrdersAPI.createReviewRemote && window.OrdersAPI.hasCloudOrdersApi()) {
          const remote = await window.OrdersAPI.createReviewRemote({
            id: entry.id,
            name: entry.name,
            comment: entry.comment,
            createdAt: entry.createdAt,
          });
          if (remote && remote.id) entry.id = remote.id;
        }
      } catch (err) {}

      const list = [entry].concat(readUserReviews().filter((r) => String(r.id) !== String(entry.id)));
      saveUserReviews(list);

      const all = await loadReviews();
      initReviewsSlider(all);

      form.reset();
      if (msg) {
        msg.hidden = false;
        msg.textContent = "✓ ধন্যবাদ! আপনার রিভিউ স্লাইডারে যোগ হয়েছে।";
      }
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "রিভিউ পাঠান";
      }

      const sliderCard = document.querySelector(".reviews-slider-card");
      if (sliderCard) sliderCard.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  loadReviews().then(initReviewsSlider);
  initReviewForm();

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
