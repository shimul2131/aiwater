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
    const phId = placeholderId || (containerId === "how-video-wrap" ? "how-video-placeholder" : null);
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
  const videos = cfg.videos || {};
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

    const ctrl = prices.controller;
    const basic = Number.isFinite(ctrl) && Number.isFinite(prices.sensorBasic) ? ctrl + prices.sensorBasic : null;
    const premium = Number.isFinite(ctrl) && Number.isFinite(prices.sensor) ? ctrl + prices.sensor : null;

    const pkg = document.getElementById("price-package");
    const pkgBasic = document.getElementById("price-package-basic");
    const pkgFooter = document.getElementById("price-package-footer");
    if (pkgBasic && basic != null) pkgBasic.textContent = formatBdt(basic);
    if (pkg && premium != null) pkg.textContent = formatBdt(premium);
    if (pkgFooter && basic != null && premium != null) {
      pkgFooter.textContent = formatBdt(basic) + " – " + formatBdt(premium);
    }

    const homeCtrl = document.querySelector(".home-meta .price-chip strong");
    if (homeCtrl && prices.controller != null) homeCtrl.textContent = formatBdt(prices.controller);
  }

  function initPriceCalculator() {
    const root = document.getElementById("price-calc");
    if (!root) return;

    const feetInput = document.getElementById("calc-cable-feet");
    const lineController = document.getElementById("calc-line-controller");
    const lineSensor = document.getElementById("calc-line-sensor");
    const lineCable = document.getElementById("calc-line-cable");
    const totalEl = document.getElementById("calc-total");
    const sensorLabel = document.getElementById("calc-sensor-label");
    const feetLabel = document.getElementById("calc-feet-label");
    const orderBtn = document.getElementById("calc-order-btn");
    const previewPremium = document.getElementById("calc-sensor-preview-premium");
    const previewBasic = document.getElementById("calc-sensor-preview-basic");

    function selectedPackage() {
      const checked = root.querySelector('input[name="calc-package"]:checked');
      return checked ? checked.value : "premium";
    }

    function recalc() {
      const ctrl = Number(prices.controller) || 0;
      const sensorPremium = Number(prices.sensor) || 0;
      const sensorBasic = Number(prices.sensorBasic) || 0;
      const perFoot = Number(prices.cablePerFoot) || 0;
      let feet = Number(feetInput && feetInput.value);
      if (!Number.isFinite(feet) || feet < 0) feet = 0;
      feet = Math.min(500, Math.round(feet));

      const isPremium = selectedPackage() === "premium";
      const sensorPrice = isPremium ? sensorPremium : sensorBasic;
      const sensorName = isPremium ? "Premium Sensor" : "Normal Sensor";
      const cableTotal = feet * perFoot;
      const total = ctrl + sensorPrice + cableTotal;

      if (lineController) lineController.textContent = formatBdt(ctrl);
      if (lineSensor) lineSensor.textContent = formatBdt(sensorPrice);
      if (sensorLabel) sensorLabel.textContent = sensorName;
      if (feetLabel) feetLabel.textContent = String(feet);
      if (lineCable) lineCable.textContent = formatBdt(cableTotal);
      if (totalEl) totalEl.textContent = formatBdt(total);
      if (previewPremium) previewPremium.hidden = !isPremium;
      if (previewBasic) previewBasic.hidden = isPremium;

      if (orderBtn) {
        const msg =
          "আমি AI Water Controller অর্ডার করতে চাই।\n" +
          "প্যাকেজ: " +
          (isPremium ? "Premium Sensor" : "Normal Sensor") +
          "\n" +
          "Controller: " +
          formatBdt(ctrl) +
          "\n" +
          sensorName +
          ": " +
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

    root.querySelectorAll('input[name="calc-package"]').forEach((el) => {
      el.addEventListener("change", recalc);
    });
    if (feetInput) {
      feetInput.addEventListener("input", recalc);
      feetInput.addEventListener("change", recalc);
    }
    recalc();
  }

  applyPrices();
  initPriceCalculator();

  setProductImage("home-controller-img", images.controller, images.controllerFallback);
  setProductImage("pkg-controller-img", images.controller, images.controllerFallback);
  setProductImage("pkg-sensor-img", images.sensor, images.sensorFallback);
  setProductImage("pkg-sensor-basic-img", images.sensorBasic, images.sensorBasicFallback || images.sensorFallback);

  const posterImg = document.getElementById("promo-poster-img");
  if (posterImg && images.poster) posterImg.src = images.poster;

  mountVideo(
    "install-video-wrap",
    null,
    videos.installation,
    "Total Installation & Setup — AI Water Controller",
    "install-video-placeholder"
  );
  mountVideo(
    "how-video-wrap",
    null,
    videos.howItWorks,
    "কীভাবে কাজ করে — AI Water Controller",
    "how-video-placeholder"
  );
  mountVideo("pkg-controller-video-wrap", "pkg-controller-video", videos.controller, "AI Water Controller ভিডিও");
  mountVideo("pkg-sensor-video-wrap", "pkg-sensor-video", videos.sensor, "Premium Industrial Sensor ভিডিও");
  mountVideo("home-controller-video-wrap", "home-controller-video", videos.controller, "AI Water Controller ভিডিও");
})();
