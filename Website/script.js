(() => {
  const nav = document.getElementById("site-nav");
  const toggle = document.querySelector(".nav-toggle");
  const whatsappURL =
    "https://wa.me/8801745242000?text=" +
    encodeURIComponent("আমি AI Water Controller সম্পর্কে বিস্তারিত জানতে চাই।");

  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "মেনু বন্ধ করুন" : "মেনু খুলুন");
      document.body.classList.toggle("nav-open", open);
    });

    nav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "মেনু খুলুন");
        document.body.classList.remove("nav-open");
      });
    });
  }

  document.querySelectorAll('a[href*="wa.me/8801745242000"]').forEach((el) => {
    el.setAttribute("href", whatsappURL);
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 900 && nav && toggle) {
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
      document.body.classList.remove("nav-open");
    }
  });

  // —— Demo app ——
  const motorSwitch = document.getElementById("motor-switch");
  const tankVisual = document.getElementById("demo-tank");
  const tankWater = document.getElementById("tank-water");
  const switchCaption = document.getElementById("switch-caption");
  const statusLabel = document.getElementById("demo-status-label");
  const demoPercent = document.getElementById("demo-percent");
  const demoLiters = document.getElementById("demo-liters");
  const sidePercent = document.getElementById("side-percent");
  const sideLiters = document.getElementById("side-liters");
  const mobileStatLiters = document.querySelector(".home-stat-liters");
  const mobileStatMotor = document.querySelector(".home-stat-motor");
  const mobileStatPercent = document.querySelector(".home-stat-percent");
  const demoTimer = document.getElementById("demo-timer");
  const timerWrap = document.getElementById("demo-timer-wrap");
  const modeLabel = document.getElementById("demo-mode-label");
  const autoInfo = document.getElementById("demo-auto-info");
  const scheduleInfo = document.getElementById("demo-schedule-info");

  const menuBtn = document.getElementById("demo-menu-btn");
  const sideMenu = document.getElementById("side-menu");
  const menuBackdrop = document.getElementById("menu-backdrop");
  const openAutoBtn = document.getElementById("open-auto-setup");
  const openScheduleBtn = document.getElementById("open-schedule-setup");

  const autoPage = document.getElementById("demo-auto-page");
  const autoPageClose = document.getElementById("auto-page-close");
  const startInput = document.getElementById("auto-start-pct");
  const stopInput = document.getElementById("auto-stop-pct");
  const delayInput = document.getElementById("auto-delay-sec");
  const autoEnabledInput = document.getElementById("auto-enabled");
  const saveBtn = document.getElementById("demo-auto-save");
  const saveMsg = document.getElementById("demo-save-msg");
  const cutInValue = document.getElementById("cutin-value");
  const cutOutValue = document.getElementById("cutout-value");
  const autoModeHint = document.getElementById("auto-mode-hint");

  const schedulePage = document.getElementById("demo-schedule-page");
  const schedulePageClose = document.getElementById("schedule-page-close");
  const scheduleDelayInput = document.getElementById("schedule-delay-sec");
  const scheduleDelaySave = document.getElementById("schedule-delay-save");
  const scheduleSaveMsg = document.getElementById("schedule-save-msg");
  const scheduleListEl = document.getElementById("schedule-list");
  const scheduleAddBtn = document.getElementById("schedule-add-btn");
  const scheduleEditor = document.getElementById("schedule-editor");
  const editStart = document.getElementById("edit-start");
  const editStop = document.getElementById("edit-stop");
  const editCancel = document.getElementById("edit-cancel");
  const editSave = document.getElementById("edit-save");

  const TANK_CAPACITY = 2600;
  const MAX_SCHEDULES = 8;
  let level = 18;
  let motorOn = false;
  let runSeconds = 0;
  let rafId = 0;
  let lastTs = 0;

  let autoEnabled = true;
  let startPct = 30;
  let stopPct = 90;
  let autoDelaySec = 2;
  let manualOverride = false;
  let waitingManualAfterCutOut = false;
  let startMode = "off";
  let pendingAutoStartAt = 0;
  let pendingScheduleStartAt = 0;
  let scheduleDelaySec = 20;
  let editingId = null;

  let schedules = [
    { id: "s1", enabled: true, start: "07:00", stop: "07:20" },
    { id: "s2", enabled: true, start: "11:00", stop: "11:20" },
    { id: "s3", enabled: true, start: "14:00", stop: "14:20" },
    { id: "s4", enabled: true, start: "18:00", stop: "18:20" },
    { id: "s5", enabled: true, start: "22:00", stop: "22:20" },
  ];

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function formatTimer(total) {
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = Math.floor(total % 60);
    return pad(h) + ":" + pad(m) + ":" + pad(s);
  }

  function modeText() {
    if (!motorOn) return "Off";
    if (startMode === "auto") return "Auto";
    if (startMode === "schedule") return "Schedule";
    if (startMode === "manual") return "Manual";
    return "Off";
  }

  function parseHM(value) {
    const parts = String(value || "00:00").split(":");
    return (Number(parts[0]) || 0) * 60 + (Number(parts[1]) || 0);
  }

  function nowMinutes() {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }

  function format12(hm) {
    let h = Math.floor(hm / 60);
    const m = hm % 60;
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12;
    if (h === 0) h = 12;
    return h + ":" + pad(m) + " " + ampm;
  }

  function durationLabel(start, stop) {
    const a = parseHM(start);
    const b = parseHM(stop);
    let mins = b >= a ? b - a : 24 * 60 - a + b;
    const hours = Math.floor(mins / 60);
    const rem = mins % 60;
    if (hours > 0 && rem > 0) return hours + "h " + rem + "m";
    if (hours > 0) return hours + "h";
    return rem + "m";
  }

  function inWindow(start, stop, now) {
    const a = parseHM(start);
    const b = parseHM(stop);
    if (a === b) return false;
    if (b > a) return now >= a && now < b;
    return now >= a || now < b;
  }

  function inScheduleWindow() {
    const now = nowMinutes();
    return schedules.some((s) => s.enabled && inWindow(s.start, s.stop, now));
  }

  function activeScheduleCount() {
    return schedules.filter((s) => s.enabled).length;
  }

  function flashMsg(el, text, ok) {
    if (!el) return;
    el.hidden = false;
    el.style.color = ok ? "#2e7d32" : "#c62828";
    el.textContent = text;
    window.setTimeout(() => {
      if (el) el.hidden = true;
    }, 1200);
  }

  function updateScheduleInfo() {
    if (!scheduleInfo) return;
    const n = activeScheduleCount();
    if (n === 0) {
      scheduleInfo.textContent = "Timer: OFF";
      return;
    }
    if (n === 1) {
      const s = schedules.find((x) => x.enabled);
      scheduleInfo.textContent = `Timer: ON  ${s.start}-${s.stop}`;
      return;
    }
    scheduleInfo.textContent = `Timer: ON  ${n}টি`;
  }

  function updateAutoInfo() {
    if (autoInfo) {
      if (waitingManualAfterCutOut && !motorOn) {
        autoInfo.textContent = `ম্যানুয়াল বন্ধ · চালু করতে সুইচ চাপুন`;
      } else if (!motorOn && level >= stopPct - 2) {
        autoInfo.textContent = `Cut-out ${stopPct}% · পানি কমলে আবার Auto চালু হবে`;
      } else if (!autoEnabled) {
        autoInfo.textContent = `Auto বন্ধ · বন্ধ লেভেল ${stopPct}% এ OFF হবে`;
      } else {
        autoInfo.textContent = `মোটর চালু ${startPct}% · মোটর বন্ধ ${stopPct}%`;
      }
    }
    if (modeLabel) modeLabel.textContent = modeText();
    if (autoModeHint) {
      autoModeHint.textContent = autoEnabled
        ? "Controller নিজে পাম্প চালাবে"
        : "বন্ধ — শুধু ম্যানুয়াল / টাইমার (cut-out OFF থাকবে)";
    }
    updateScheduleInfo();
  }

  function renderScheduleList() {
    if (!scheduleListEl) return;
    scheduleListEl.innerHTML = "";
    schedules.forEach((s) => {
      const row = document.createElement("div");
      row.className = "sched-item" + (s.enabled ? "" : " is-off");
      row.innerHTML =
        '<div class="sched-item-ico" aria-hidden="true">⏱</div>' +
        '<button type="button" class="sched-item-main" data-edit="' +
        s.id +
        '">' +
        '<span class="sched-item-time">' +
        '<span class="on">' +
        format12(parseHM(s.start)) +
        '</span><span class="arrow">→</span><span class="off">' +
        format12(parseHM(s.stop)) +
        "</span></span>" +
        '<span class="sched-item-dur">স্থায়িত্ব ' +
        durationLabel(s.start, s.stop) +
        "</span></button>" +
        '<label class="sched-item-toggle">' +
        '<input type="checkbox" data-toggle="' +
        s.id +
        '"' +
        (s.enabled ? " checked" : "") +
        " /><span></span></label>" +
        '<button type="button" class="sched-del" data-del="' +
        s.id +
        '" aria-label="মুছুন">🗑</button>';
      scheduleListEl.appendChild(row);
    });
  }

  function syncSliderLabels() {
    if (cutInValue && startInput) cutInValue.textContent = startInput.value + "%";
    if (cutOutValue && stopInput) cutOutValue.textContent = stopInput.value + "%";
  }

  function renderTank() {
    if (tankWater) tankWater.style.height = level + "%";
    const pct = Math.round(level);
    const liters = Math.round((level / 100) * TANK_CAPACITY);
    if (demoPercent) demoPercent.textContent = pct + "%";
    if (demoLiters) demoLiters.textContent = String(liters);
    if (sidePercent) sidePercent.textContent = pct + "%";
    if (sideLiters) sideLiters.textContent = liters.toLocaleString("en-US") + " L";
    if (mobileStatPercent) mobileStatPercent.textContent = pct + "%";
    if (mobileStatLiters) mobileStatLiters.textContent = liters.toLocaleString("en-US") + " L";
  }

  function renderTimer() {
    if (demoTimer) demoTimer.textContent = motorOn ? formatTimer(runSeconds) : "00:00:00";
    if (timerWrap) timerWrap.classList.toggle("is-running", motorOn);
    if (modeLabel) modeLabel.textContent = modeText();
  }

  function setMotorState(isOn, from, mode) {
    if (!motorSwitch) return;
    const source = from || "manual";

    if (source === "manual" && !isOn) {
      waitingManualAfterCutOut = true;
      manualOverride = true;
      pendingAutoStartAt = 0;
      pendingScheduleStartAt = 0;
      startMode = "off";
    }

    if (source === "manual" && isOn) {
      waitingManualAfterCutOut = false;
      manualOverride = false;
      pendingAutoStartAt = 0;
      pendingScheduleStartAt = 0;
      startMode = "manual";
    }

    if (source === "auto" || source === "schedule" || source === "cutout") {
      manualOverride = false;
      if (isOn) startMode = mode || source;
      else startMode = "off";
    }

    motorOn = isOn;
    if (!isOn) runSeconds = 0;
    motorSwitch.setAttribute("aria-checked", String(isOn));
    if (tankVisual) tankVisual.classList.toggle("is-filling", isOn);
    if (switchCaption) switchCaption.textContent = isOn ? "ON" : "OFF";
    if (statusLabel) {
      statusLabel.textContent = isOn ? "ON" : "OFF";
      statusLabel.classList.toggle("is-off", !isOn);
      statusLabel.classList.toggle("status-on", isOn);
    }
    if (mobileStatMotor) {
      mobileStatMotor.textContent = isOn ? "ON" : "OFF";
      mobileStatMotor.classList.toggle("is-off", !isOn);
      mobileStatMotor.classList.toggle("status-on", isOn);
    }
    updateAutoInfo();
    renderTimer();
    startLoop();
  }

  function applyLogic(now) {
    if (motorOn && level >= stopPct) {
      pendingAutoStartAt = 0;
      pendingScheduleStartAt = 0;
      setMotorState(false, "cutout");
      return;
    }

    const inSched = inScheduleWindow();

    if (motorOn && startMode === "schedule" && !inSched) {
      pendingScheduleStartAt = 0;
      setMotorState(false, "schedule");
      return;
    }

    if (
      !motorOn &&
      !waitingManualAfterCutOut &&
      !manualOverride &&
      inSched &&
      level < stopPct
    ) {
      if (!pendingScheduleStartAt) {
        pendingScheduleStartAt = now + scheduleDelaySec * 1000;
      }
      if (now >= pendingScheduleStartAt) {
        pendingScheduleStartAt = 0;
        setMotorState(true, "schedule", "schedule");
        return;
      }
    } else if (!inSched) {
      pendingScheduleStartAt = 0;
    }

    if (!autoEnabled) {
      pendingAutoStartAt = 0;
      return;
    }
    if (waitingManualAfterCutOut || manualOverride) {
      pendingAutoStartAt = 0;
      return;
    }
    if (inSched) return;

    if (!motorOn && level <= startPct) {
      if (!pendingAutoStartAt) pendingAutoStartAt = now + autoDelaySec * 1000;
      if (now >= pendingAutoStartAt) {
        pendingAutoStartAt = 0;
        setMotorState(true, "auto", "auto");
      }
    } else {
      pendingAutoStartAt = 0;
    }
  }

  function tick(ts) {
    if (!lastTs) lastTs = ts;
    const dt = (ts - lastTs) / 1000;
    lastTs = ts;

    if (motorOn) {
      level = Math.min(100, level + dt * 12);
      runSeconds += dt;
    } else if (level > 0) {
      level = Math.max(0, level - dt * 4);
    }

    applyLogic(performance.now());
    renderTank();
    renderTimer();
    rafId = requestAnimationFrame(tick);
  }

  function startLoop() {
    if (rafId) return;
    lastTs = 0;
    rafId = requestAnimationFrame(tick);
  }

  function closeAllPanels() {
    if (sideMenu) sideMenu.hidden = true;
    if (menuBackdrop) menuBackdrop.hidden = true;
    if (autoPage) autoPage.hidden = true;
    if (schedulePage) schedulePage.hidden = true;
    if (scheduleEditor) scheduleEditor.hidden = true;
    if (menuBtn) menuBtn.setAttribute("aria-expanded", "false");
  }

  function openSideMenu() {
    closeAllPanels();
    if (sideMenu) sideMenu.hidden = false;
    if (menuBackdrop) menuBackdrop.hidden = false;
    if (menuBtn) menuBtn.setAttribute("aria-expanded", "true");
  }

  function openAutoPage() {
    closeAllPanels();
    if (autoPage) autoPage.hidden = false;
    if (startInput) startInput.value = String(startPct);
    if (stopInput) stopInput.value = String(stopPct);
    if (delayInput) delayInput.value = String(autoDelaySec);
    if (autoEnabledInput) autoEnabledInput.checked = autoEnabled;
    if (saveMsg) saveMsg.hidden = true;
    syncSliderLabels();
    updateAutoInfo();
  }

  function openSchedulePage() {
    closeAllPanels();
    if (schedulePage) schedulePage.hidden = false;
    if (scheduleDelayInput) scheduleDelayInput.value = String(scheduleDelaySec);
    if (scheduleSaveMsg) scheduleSaveMsg.hidden = true;
    renderScheduleList();
    updateAutoInfo();
  }

  function openEditor(id) {
    const item = schedules.find((s) => s.id === id);
    if (!item || !scheduleEditor) return;
    editingId = id;
    if (editStart) editStart.value = item.start;
    if (editStop) editStop.value = item.stop;
    scheduleEditor.hidden = false;
  }

  function closeEditor() {
    editingId = null;
    if (scheduleEditor) scheduleEditor.hidden = true;
  }

  function saveEditor() {
    if (!editingId) return;
    const start = (editStart && editStart.value) || "07:00";
    const stop = (editStop && editStop.value) || "07:20";
    if (start === stop) {
      flashMsg(scheduleSaveMsg, "চালু ও বন্ধ সময় আলাদা হতে হবে", false);
      return;
    }
    schedules = schedules.map((s) =>
      s.id === editingId ? { ...s, start, stop } : s
    );
    closeEditor();
    renderScheduleList();
    updateAutoInfo();
    flashMsg(scheduleSaveMsg, "সংরক্ষিত হয়েছে", true);
  }

  function saveAutoSettings() {
    let start = Number(startInput && startInput.value);
    let stop = Number(stopInput && stopInput.value);
    let delay = Number(delayInput && delayInput.value);
    if (!Number.isFinite(start)) start = 30;
    if (!Number.isFinite(stop)) stop = 90;
    if (!Number.isFinite(delay) || delay < 0) delay = 5;
    start = Math.max(0, Math.min(100, Math.round(start)));
    stop = Math.max(0, Math.min(100, Math.round(stop)));
    delay = Math.max(0, Math.min(600, Math.round(delay)));

    if (start >= stop) {
      if (saveMsg) {
        saveMsg.hidden = false;
        saveMsg.style.color = "#ff2d55";
        saveMsg.textContent = "মোটর চালু লেভেল, মোটর বন্ধের চেয়ে কম হতে হবে";
      }
      return;
    }

    startPct = start;
    stopPct = stop;
    autoDelaySec = delay;
    autoEnabled = !!(autoEnabledInput && autoEnabledInput.checked);
    manualOverride = false;
    waitingManualAfterCutOut = false;
    pendingAutoStartAt = 0;
    updateAutoInfo();

    if (saveMsg) {
      saveMsg.hidden = false;
      saveMsg.style.color = "#39ff14";
      saveMsg.textContent = "Save Successfully";
    }

    if (motorOn && level >= stopPct) {
      setMotorState(false, "cutout");
    }

    startLoop();
    window.setTimeout(closeAllPanels, 800);
  }

  if (startInput) startInput.addEventListener("input", syncSliderLabels);
  if (stopInput) stopInput.addEventListener("input", syncSliderLabels);
  if (autoEnabledInput) {
    autoEnabledInput.addEventListener("change", () => {
      if (autoModeHint) {
        autoModeHint.textContent = autoEnabledInput.checked
          ? "Controller নিজে পাম্প চালাবে"
          : "বন্ধ — শুধু ম্যানুয়াল / টাইমার (cut-out OFF থাকবে)";
      }
    });
  }

  if (menuBtn) menuBtn.addEventListener("click", openSideMenu);
  if (menuBackdrop) menuBackdrop.addEventListener("click", closeAllPanels);
  if (openAutoBtn) openAutoBtn.addEventListener("click", openAutoPage);
  if (openScheduleBtn) openScheduleBtn.addEventListener("click", openSchedulePage);
  if (autoPageClose) autoPageClose.addEventListener("click", closeAllPanels);
  if (schedulePageClose) schedulePageClose.addEventListener("click", closeAllPanels);
  if (saveBtn) saveBtn.addEventListener("click", saveAutoSettings);

  if (scheduleDelaySave) {
    scheduleDelaySave.addEventListener("click", () => {
      let delay = Number(scheduleDelayInput && scheduleDelayInput.value);
      if (!Number.isFinite(delay) || delay < 0) delay = 0;
      scheduleDelaySec = Math.max(0, Math.min(600, Math.round(delay)));
      flashMsg(scheduleSaveMsg, "দেরি সেভ হয়েছে", true);
    });
  }

  if (scheduleAddBtn) {
    scheduleAddBtn.addEventListener("click", () => {
      if (schedules.length >= MAX_SCHEDULES) {
        flashMsg(scheduleSaveMsg, "সর্বোচ্চ ৮টি টাইমার", false);
        return;
      }
      const id = "s" + Date.now();
      schedules.push({ id, enabled: true, start: "12:00", stop: "12:20" });
      renderScheduleList();
      updateAutoInfo();
      openEditor(id);
    });
  }

  if (scheduleListEl) {
    scheduleListEl.addEventListener("click", (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      const edit = t.closest("[data-edit]");
      const del = t.closest("[data-del]");
      if (edit) {
        openEditor(edit.getAttribute("data-edit"));
        return;
      }
      if (del) {
        const id = del.getAttribute("data-del");
        schedules = schedules.filter((s) => s.id !== id);
        renderScheduleList();
        updateAutoInfo();
        flashMsg(scheduleSaveMsg, "মুছে ফেলা হয়েছে", true);
      }
    });
    scheduleListEl.addEventListener("change", (e) => {
      const t = e.target;
      if (!(t instanceof HTMLInputElement) || !t.matches("[data-toggle]")) return;
      const id = t.getAttribute("data-toggle");
      schedules = schedules.map((s) =>
        s.id === id ? { ...s, enabled: t.checked } : s
      );
      renderScheduleList();
      updateAutoInfo();
    });
  }

  if (editCancel) editCancel.addEventListener("click", closeEditor);
  if (editSave) editSave.addEventListener("click", saveEditor);
  if (scheduleEditor) {
    scheduleEditor.addEventListener("click", (e) => {
      if (e.target === scheduleEditor) closeEditor();
    });
  }

  if (motorSwitch) {
    updateAutoInfo();
    renderTank();
    renderTimer();
    motorSwitch.addEventListener("click", () => {
      const next = motorSwitch.getAttribute("aria-checked") !== "true";
      setMotorState(next, "manual");
    });
    startLoop();
  } else {
    startLoop();
  }
})();
