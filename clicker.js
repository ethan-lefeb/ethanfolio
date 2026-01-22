(() => {
  const SAVE_COOKIE = "clickerSave";

  const els = {
    bits: document.getElementById("bitsValue"),
    bytes: document.getElementById("bytesValue"),
    clickers: document.getElementById("clickersValue"),
    upgrade: document.getElementById("upgradeValue"),
    bps: document.getElementById("bpsValue"),
    ratePerClicker: document.getElementById("ratePerClicker"),
    clickerCost: document.getElementById("clickerCost"),
    upgradeCost: document.getElementById("upgradeCost"),
    toast: document.getElementById("toast"),
    clickBtn: document.getElementById("clickBtn"),
    buyClickerBtn: document.getElementById("buyClickerBtn"),
    buyUpgradeBtn: document.getElementById("buyUpgradeBtn"),
    resetBtn: document.getElementById("resetBtn"),
  };

  const nowMs = () => Date.now();

  const cookieBasePath = () => {
    const p = window.location.pathname;
    const i = p.lastIndexOf("/");
    return i >= 0 ? p.slice(0, i + 1) : "/";
  };

  const setCookie = (name, value, maxAgeSeconds) => {
    const path = cookieBasePath();
    const safe = encodeURIComponent(value);
    document.cookie = `${name}=${safe}; Max-Age=${maxAgeSeconds}; Path=${path}; SameSite=Lax`;
  };

  const getCookie = (name) => {
    const parts = document.cookie.split(";").map(s => s.trim());
    for (const part of parts) {
      if (!part) continue;
      const eq = part.indexOf("=");
      if (eq === -1) continue;
      const k = part.slice(0, eq);
      if (k === name) return decodeURIComponent(part.slice(eq + 1));
    }
    return null;
  };

  const defaultState = () => ({
    bits: 0,
    bytes: 0,
    clickersOwned: 0,
    upgradeLevel: 0,
    lastOnlineMs: nowMs(),
  });

  const load = () => {
    const raw = getCookie(SAVE_COOKIE);
    if (!raw) return defaultState();
    try {
      const parsed = JSON.parse(raw);
      const s = defaultState();
      for (const k of Object.keys(s)) {
        if (typeof parsed[k] === typeof s[k]) s[k] = parsed[k];
      }
      return s;
    } catch {
      return defaultState();
    }
  };

  const save = () => {
    state.lastOnlineMs = nowMs();
    setCookie(SAVE_COOKIE, JSON.stringify(state), 60 * 60 * 24 * 365);
  };

  const showToast = (msg) => {
    els.toast.textContent = msg;
    els.toast.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      els.toast.classList.remove("show");
      els.toast.textContent = "";
    }, 4500);
  };

  const normalize = () => {
    if (!Number.isFinite(state.bits) || state.bits < 0) state.bits = 0;
    if (!Number.isFinite(state.bytes) || state.bytes < 0) state.bytes = 0;
    if (!Number.isFinite(state.clickersOwned) || state.clickersOwned < 0) state.clickersOwned = 0;
    if (!Number.isFinite(state.upgradeLevel) || state.upgradeLevel < 0) state.upgradeLevel = 0;

    state.bits = Math.floor(state.bits);
  };

  const ratePerClicker = () => 1 + state.upgradeLevel;
  const bitsPerSecond = () => state.clickersOwned * ratePerClicker();

  const clickerCostBytes = () => {
    const n = state.clickersOwned + 1;
    return Math.pow(2, n - 1);
  };

  const upgradeCostBits = () => {
    return 10 * Math.pow(2, state.upgradeLevel);
  };

  const render = () => {
    els.bits.textContent = String(state.bits);
    els.bytes.textContent = String(state.bytes);
    els.clickers.textContent = String(state.clickersOwned);
    els.upgrade.textContent = String(state.upgradeLevel);
    els.bps.textContent = String(bitsPerSecond());
    els.ratePerClicker.textContent = String(ratePerClicker());
    els.clickerCost.textContent = String(clickerCostBytes());
    els.upgradeCost.textContent = String(upgradeCostBits());

    els.buyClickerBtn.disabled = state.bytes < clickerCostBytes();
    els.buyUpgradeBtn.disabled = state.bits < upgradeCostBits();
  };

  const gainBits = (amount) => {
    if (!Number.isFinite(amount) || amount <= 0) return;

    const beforeBits = Math.floor(state.bits);
    const beforeHundreds = Math.floor(beforeBits / 100);

    state.bits = beforeBits + amount;
    normalize();

    const afterHundreds = Math.floor(state.bits / 100);
    const earnedBytes = afterHundreds - beforeHundreds;

    if (earnedBytes > 0) state.bytes += earnedBytes;
  };

  const applyOfflineProgress = () => {
    const last = state.lastOnlineMs || nowMs();
    const deltaSec = Math.max(0, Math.floor((nowMs() - last) / 1000));
    if (deltaSec <= 0) return;

    const bps = bitsPerSecond();
    if (bps <= 0) return;

    const beforeBytes = state.bytes;
    const beforeBits = state.bits;

    gainBits(deltaSec * bps);

    const gainedBytes = state.bytes - beforeBytes;
    const gainedBits = state.bits - beforeBits;

    const parts = [];
    if (gainedBits > 0) parts.push(`${gainedBits} bit${gainedBits === 1 ? "" : "s"}`);
    if (gainedBytes > 0) parts.push(`${gainedBytes} byte${gainedBytes === 1 ? "" : "s"}`);
    if (parts.length) showToast(`Offline progress: +${parts.join(", ")} while you were away.`);
  };

  const state = load();
  let toastTimer = 0;

  normalize();
  applyOfflineProgress();
  render();
  save();

  els.clickBtn.addEventListener("click", () => {
    gainBits(1);
    render();
    save();
  });

  els.buyClickerBtn.addEventListener("click", () => {
    const cost = clickerCostBytes();
    if (state.bytes < cost) return;
    state.bytes -= cost;
    state.clickersOwned += 1;
    normalize();
    render();
    save();
  });

  els.buyUpgradeBtn.addEventListener("click", () => {
    const cost = upgradeCostBits();
    if (state.bits < cost) return;
    state.bits -= cost;
    state.upgradeLevel += 1;
    normalize();
    render();
    save();
  });

  els.resetBtn.addEventListener("click", () => {
    const ok = window.confirm("Reset your clicker save? This cannot be undone.");
    if (!ok) return;
    const fresh = defaultState();
    state.bits = fresh.bits;
    state.bytes = fresh.bytes;
    state.clickersOwned = fresh.clickersOwned;
    state.upgradeLevel = fresh.upgradeLevel;
    state.lastOnlineMs = fresh.lastOnlineMs;
    save();
    render();
    showToast("Save reset.");
  });

  // live production (1 tick/sec)
  window.setInterval(() => {
    const bps = bitsPerSecond();
    if (bps > 0) {
      gainBits(bps);
      render();
    }
  }, 1000);

  // persist timestamp at least every 5 minutes
  window.setInterval(() => {
    save();
  }, 5 * 60 * 1000);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") save();
  });

  window.addEventListener("beforeunload", () => {
    save();
  });
})();
