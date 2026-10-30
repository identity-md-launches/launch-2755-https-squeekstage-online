import { loadSnapshot, eventLine } from "../src/api.js";
import * as fmt from "../src/format.js";
import * as chain from "../src/chain.js";
import * as store from "../src/tips.js";

const view = document.getElementById("view");
const topbar = document.getElementById("topbar");
const footer = document.getElementById("footer");
const walletSlot = document.getElementById("wallet-slot");
const toastStack = document.getElementById("toast-stack");

const app = {
  settings: store.loadSettings(),
  account: null,
  snapshot: null,
  token: { address: "", symbol: "SQK", decimals: 18 },
  timers: [],
  alertQueue: [],
  seenTips: new Set(),
  tipBaselineReady: false,
  tipBaselineOwner: "",
  seenEvents: new Set(),
  eventBaselineReady: false,
  audio: null,
  routeGeneration: 0,
};

/* ------------------------------- utilities ------------------------------- */

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function toast(message, kind = "") {
  const el = document.createElement("div");
  el.className = `toast ${kind}`.trim();
  el.textContent = message;
  toastStack.appendChild(el);
  setTimeout(() => el.remove(), kind === "err" ? 7000 : 4200);
}

function toastTransaction(message, hash, kind = "") {
  const el = document.createElement("div");
  el.className = `toast ${kind}`.trim();
  const text = document.createElement("span");
  text.textContent = message;
  const link = document.createElement("a");
  link.href = chain.explorerTx(hash);
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = " View on Sepolia explorer";
  el.append(text, link);
  toastStack.appendChild(el);
  setTimeout(() => el.remove(), kind === "err" ? 7000 : 6000);
}

function every(ms, fn, immediate = true) {
  if (immediate) fn();
  const id = setInterval(fn, ms);
  app.timers.push(id);
  return id;
}

function stopTimers() {
  for (const id of app.timers) clearInterval(id);
  app.timers = [];
}

function applyAccent(accent) {
  if (/^#[0-9a-f]{6}$/i.test(accent ?? "")) document.documentElement.style.setProperty("--accent", accent);
}

function blip(freq = 660) {
  if (!app.settings.sound) return;
  try {
    app.audio ??= new (globalThis.AudioContext ?? globalThis.webkitAudioContext)();
    const ctx = app.audio;
    if (ctx.state === "suspended") ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.34);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch {
    /* audio is a nice-to-have */
  }
}

/* -------------------------------- wallet UI ------------------------------- */

function renderWallet() {
  if (!walletSlot) return;
  if (!app.account) {
    walletSlot.innerHTML = `<button class="btn btn-ghost" id="connect-btn" type="button">Connect</button>`;
    walletSlot.querySelector("#connect-btn").addEventListener("click", connectWallet);
    return;
  }
  const wrongChain = chain.getChainId() !== chain.SEPOLIA.chainId;
  walletSlot.innerHTML = `
    ${wrongChain ? `<button class="btn btn-sm" id="fix-chain" type="button">Switch to Sepolia</button>` : ""}
    <button class="btn btn-sm btn-ghost mono" id="wallet-chip" type="button" title="Copy address">${esc(fmt.shortAddr(app.account))}</button>`;
  walletSlot.querySelector("#wallet-chip")?.addEventListener("click", async () => {
    await navigator.clipboard?.writeText(app.account).catch(() => {});
    toast("Address copied");
  });
  walletSlot.querySelector("#fix-chain")?.addEventListener("click", async () => {
    try {
      await chain.ensureSepolia();
      renderWallet();
    } catch (err) {
      toast(err.message ?? "Could not switch network", "err");
    }
  });
}

async function connectWallet() {
  try {
    app.account = await chain.connect();
    if (chain.getChainId() !== chain.SEPOLIA.chainId) {
      try {
        await chain.ensureSepolia();
      } catch {
        toast("Connected. Switch to Sepolia to send tips.", "err");
      }
    }
    renderWallet();
    refreshRoute();
  } catch (err) {
    toast(err?.code === 4001 ? "Connection rejected in your wallet" : err.message ?? "Could not connect", "err");
  }
}

chain.onWalletChange(({ type }) => {
  if (type === "accounts") {
    app.account = chain.getAccount();
    renderWallet();
    refreshRoute();
  }
  if (type === "chain") {
    renderWallet();
    if (currentPath() === "/tip") refreshRoute();
  }
});

/* --------------------------------- router -------------------------------- */

const routes = { "/": homeView, "/stage": stageView, "/tip": tipView, "/setup": setupView, "/about": aboutView };

function currentPath() {
  const raw = location.hash.replace(/^#/, "");
  if (!raw || raw === "/") return "/";
  return raw.split("?")[0].replace(/\/$/, "") || "/";
}

function refreshRoute() {
  stopTimers();
  app.routeGeneration += 1;
  const path = currentPath();
  const isOverlay = path === "/stage" && new URLSearchParams(location.search).has("obs");
  document.body.classList.toggle("overlay-mode", isOverlay);
  if (topbar) topbar.hidden = false;
  for (const link of document.querySelectorAll("[data-nav]")) {
    if (`/${link.dataset.nav}` === path) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  const render = routes[path] ?? notFound;
  view.innerHTML = "";
  render();
  window.scrollTo({ top: 0, behavior: "instant" });
}

window.addEventListener("hashchange", refreshRoute);

/* --------------------------------- views --------------------------------- */

function homeView() {
  view.innerHTML = `
  <section class="hero">
    <div>
      <p class="eyebrow">Squeekchain · Code lane</p>
      <h1>The hamster runs.<br /><em>Your chat pays.</em></h1>
      <p class="lede">SqueekStage is a stream companion for Squeekchain: a broadcast overlay that turns the live
      wheel into a counter, a settlement ticker and a tip wall — and lets viewers send real SQK to the
      streamer from the same page. Static site, no backend, no custody.</p>
      <div class="hero-actions">
        <a class="btn btn-primary" href="#/stage">Open the overlay</a>
        <a class="btn" href="#/tip">Send a tip</a>
        <a class="btn btn-ghost" href="#/setup">Set it up</a>
      </div>
      <div class="stat-strip" id="home-stats">
        ${statCard("Distance", "—", "km")}
        ${statCard("Blocks settled", "—", "")}
        ${statCard("Work units", "—", "")}
        ${statCard("Last settlement", "—", "")}
      </div>
    </div>
    <div>
      <div class="card">
        <h3>How it works</h3>
        <ol class="steps">
          <li>Point the overlay at a streamer wallet — no login, no database.</li>
          <li>Viewers open the tip page, connect a wallet and send SQK on Sepolia.</li>
          <li>The overlay reads the token's Transfer logs and fires an alert on stream.</li>
        </ol>
        <p class="hint">Because tips are read from chain logs instead of a server, the overlay survives refreshes,
        network changes and OBS restarts — and anyone can audit it.</p>
      </div>
      <div class="card">
        <h3>Live from the wheel</h3>
        <div class="kv" id="home-live"><span>Reading the chain…</span><b>—</b></div>
      </div>
    </div>
  </section>`;

  every(10_000, async () => {
    const snap = await loadSnapshot();
    app.snapshot = snap;
    const distance = snap.stats?.lifetime?.observedDistanceMm;
    const km = distance ? fmt.fmtDistance(distance) : null;
    const blocks = snap.core?.core?.blockHeight;
    const work = snap.stats?.lifetime?.acceptedWorkUnits ?? snap.core?.core?.cumulativeWork;
    const last = snap.events?.events?.[0]?.occurredAt;
    const cells = view.querySelectorAll("#home-stats .v");
    if (cells.length === 4) {
      cells[0].innerHTML = km ? `${km.value}<small>${km.unit}</small>` : "—";
      cells[1].innerHTML = blocks ? `${fmt.fmtInt(blocks)}` : "—";
      cells[2].innerHTML = work ? `${fmt.fmtInt(work)}` : "—";
      cells[3].innerHTML = last ? `<small>${esc(fmt.timeAgo(last))}</small>` : "—";
    }
    const live = view.querySelector("#home-live");
    if (live) {
      live.innerHTML = `
        <span>Block height</span><b>${snap.core?.core?.blockHeight == null ? "—" : esc(fmt.fmtInt(snap.core.core.blockHeight))}</b>
        <span>Round</span><b>${snap.core?.core?.settledThroughRound == null ? "—" : esc(fmt.fmtInt(snap.core.core.settledThroughRound))}</b>
        <span>SQK live supply</span><b>${snap.economy?.supply?.liveSupplyBaseUnits == null ? "—" : esc(fmt.fromBaseUnits(snap.economy.supply.liveSupplyBaseUnits, Number(snap.economy?.asset?.decimals ?? 18), 0))}</b>
        <span>Staked</span><b>${snap.economy?.staking?.totalStakedBaseUnits == null ? "—" : esc(fmt.fromBaseUnits(snap.economy.staking.totalStakedBaseUnits, Number(snap.economy?.asset?.decimals ?? 18), 0))}</b>`;
      app.token = {
        address: snap.economy?.asset?.address ?? snap.economy?.identities?.token ?? "",
        symbol: snap.economy?.asset?.symbol ?? "SQK",
        decimals: Number(snap.economy?.asset?.decimals ?? 18),
      };
    }
  });
}

function statCard(k, v, unit) {
  return `<div class="stat"><div class="k">${esc(k)}</div><div class="v">${esc(v)}${unit ? `<small>${esc(unit)}</small>` : ""}</div></div>`;
}

/* -------------------------------- overlay -------------------------------- */

function stageView() {
  const demo = app.settings.demo;
  view.innerHTML = `
  <div class="stage-wrap">
    <div class="stage-shell">
      <div class="stage" id="stage">
        <div class="stage-top">
          <span class="pill live" id="live-pill"><span class="led"></span><span id="live-text">live</span></span>
          ${demo ? `<span class="pill warn"><span class="led"></span>demo feed</span>` : ""}
          <span class="pill" id="chain-pill">sepolia</span>
          <div class="stage-block">
            <div><div class="k">block</div><div class="v" id="s-block">—</div></div>
            <div><div class="k">round</div><div class="v" id="s-round" style="font-size:22px">—</div></div>
          </div>
        </div>

        <div class="wheel">
          <div class="wheel-dial">
            <svg viewBox="0 0 100 100" aria-hidden="true">
              <circle class="track" cx="50" cy="50" r="45"></circle>
              <circle class="arc" id="s-arc" cx="50" cy="50" r="45" stroke-dasharray="282.7" stroke-dashoffset="282.7"></circle>
            </svg>
            <div class="wheel-core"><span class="ham" aria-hidden="true">🐹</span></div>
          </div>
          <div class="wheel-read">
            <div class="label">wheel-o-meter · lifetime</div>
            <div class="big"><span id="s-distance">—</span><small id="s-distance-unit">km</small></div>
            <div class="wheel-sub">
              <div><div class="k">work units</div><div class="v" id="s-work">—</div></div>
              <div><div class="k">settlements</div><div class="v" id="s-settle">—</div></div>
              <div><div class="k">active days</div><div class="v" id="s-days">—</div></div>
              <div><div class="k">staked</div><div class="v" id="s-staked">—</div></div>
            </div>
          </div>
        </div>

        <div class="progress">
          <div class="bar"><div class="fill" id="s-fill"></div></div>
          <div class="meta"><span id="s-progress">block progress</span><span id="s-next">next block</span></div>
        </div>

        <div class="ticker"><div class="ticker-track" id="s-ticker"><span>reading chain…</span></div></div>
      </div>
      <div class="stage-alerts" id="s-alerts" aria-live="polite"></div>
    </div>

    <div class="stage-controls">
      <button class="btn btn-sm" id="copy-overlay" type="button">Copy OBS URL</button>
      <button class="btn btn-sm" id="test-alert" type="button">Test alert</button>
      <button class="btn btn-sm btn-ghost" id="fullscreen" type="button">Fullscreen</button>
      <span class="spacer"></span>
      <a class="btn btn-sm btn-ghost" href="#/setup">Setup</a>
      <a class="btn btn-sm btn-ghost" href="#/tip">Tip page</a>
    </div>
    <p class="hint" id="stage-status">—</p>
  </div>`;

  view.querySelector("#copy-overlay").addEventListener("click", async () => {
    const url = store.overlayUrl({ ...app.settings, streamer: app.settings.streamer || app.account });
    await navigator.clipboard?.writeText(url).catch(() => {});
    toast("Overlay URL copied — paste it into an OBS browser source");
  });
  view.querySelector("#test-alert").addEventListener("click", () => {
    pushAlert({ from: "0x7a3f…demo", amount: 12.34, demo: true });
  });
  view.querySelector("#fullscreen").addEventListener("click", () => {
    document.querySelector(".stage-shell")?.requestFullscreen?.().catch(() => toast("Fullscreen blocked", "err"));
  });

  applyAccent(app.settings.accent);
  startStage();
}

async function startStage() {
  const generation = app.routeGeneration;
  const el = (id) => document.getElementById(id);

  const paint = (snap) => {
    const core = snap.core?.core;
    const cfg = snap.core?.configuration;
    const econ = snap.economy;
    const life = snap.stats?.lifetime;

    el("s-block").textContent = core?.blockHeight ? fmt.fmtInt(core.blockHeight) : "—";
    el("s-round").textContent = core?.settledThroughRound ? fmt.fmtInt(core.settledThroughRound) : "—";

    const dist = life?.observedDistanceMm;
    if (dist) {
      const d = fmt.fmtDistance(dist);
      el("s-distance").textContent = d.value;
      el("s-distance-unit").textContent = d.unit;
    }
    el("s-work").textContent = life?.acceptedWorkUnits ? fmt.fmtInt(life.acceptedWorkUnits) : "—";
    el("s-settle").textContent = life?.settlementCount ? fmt.fmtInt(life.settlementCount) : "—";
    el("s-days").textContent = life?.activeDayCount ? fmt.fmtInt(life.activeDayCount) : "—";
    el("s-staked").textContent = econ?.staking?.totalStakedBaseUnits == null
      ? "—"
      : fmt.fromBaseUnits(econ.staking.totalStakedBaseUnits, Number(econ?.asset?.decimals ?? 18), 0);

    const units = Number(cfg?.blockUnitsPerBlock);
    const progress = Number(core?.blockProgress);
    const hasProgress = Number.isFinite(units) && units > 0 && Number.isFinite(progress);
    const p = hasProgress ? fmt.pct(progress, units) : 0;
    el("s-fill").style.width = `${p.toFixed(1)}%`;
    el("s-progress").textContent = hasProgress ? `block progress ${p.toFixed(1)}%` : "block progress —";
    el("s-next").textContent = hasProgress ? `${fmt.fmtCompact(Math.max(0, units - progress))} units to go` : "—";

    const arc = el("s-arc");
    if (arc) {
      const c = 2 * Math.PI * 45;
      arc.setAttribute("stroke-dasharray", c.toFixed(1));
      arc.setAttribute("stroke-dashoffset", (c * (1 - p / 100)).toFixed(1));
    }

    const live = String(snap.status?.measurement?.freshness ?? "").toLowerCase();
    const apiStale = (snap.staleSources ?? []).length > 0;
    const hasSnapshot = Boolean(snap.status || snap.core || snap.economy || snap.events || snap.stats);
    const isLive = ["online", "live", "fresh"].includes(live);
    const isStale = live === "stale" || (apiStale && hasSnapshot);
    el("live-text").textContent = isStale ? "stale" : isLive ? "live" : "offline";
    el("live-pill").className = `pill ${isStale ? "warn" : isLive ? "live" : "down"}`;
    el("chain-pill").textContent = "sepolia";

    const lines = (snap.events?.events ?? []).slice(0, 10).map(eventLine);
    if (lines.length) {
      el("s-ticker").innerHTML = lines
        .map((l) => `<span><b>${esc(l.label)}</b> ${esc(l.detail || "")} ${l.at ? `· ${esc(fmt.timeAgo(l.at))}` : ""}</span>`)
        .join("");
    }

    // Detect settlements anywhere in the newly observed event window.
    const hadEventBaseline = app.eventBaselineReady;
    let settlementLanded = false;
    for (const event of snap.events?.events ?? []) {
      const key = event.id ?? `${event.type}:${event.occurredAt}:${JSON.stringify(event.payload ?? {})}`;
      if (app.seenEvents.has(key)) continue;
      app.seenEvents.add(key);
      if (hadEventBaseline && event.type === "system.settlement_completed") settlementLanded = true;
    }
    app.eventBaselineReady = true;
    while (app.seenEvents.size > 120) app.seenEvents.delete(app.seenEvents.values().next().value);
    if (settlementLanded) {
      document.body.classList.add("running");
      setTimeout(() => document.body.classList.remove("running"), 4000);
    }
  };

  const status = el("stage-status");

  every(6000, async () => {
    if (generation !== app.routeGeneration || !document.getElementById("s-block")) return;
    const snap = await loadSnapshot().catch(() => null);
    if (!snap || generation !== app.routeGeneration || !document.getElementById("s-block")) return;
    app.snapshot = snap;
    app.token = {
      address: snap.economy?.asset?.address ?? snap.economy?.identities?.token ?? app.token.address,
      symbol: snap.economy?.asset?.symbol ?? "SQK",
      decimals: Number(snap.economy?.asset?.decimals ?? 18),
    };
    paint(snap);
    const tips = app.settings.streamer || app.account;
    status.textContent = tips
      ? `Tips read from ${fmt.shortAddr(String(tips))} don't need a server: the overlay scans Transfer logs every 12 seconds.`
      : "No streamer wallet yet — open Setup to choose the address that receives tips.";
  });

  if (app.settings.demo) {
    app.timers.push(store.startDemoFeed((tip) => pushAlert(tip)));
    document.body.classList.add("running");
    return;
  }

  const owner = app.settings.streamer || app.account;
  if (!owner) return;

  every(12_000, async () => {
    if (generation !== app.routeGeneration || !document.getElementById("s-block")) return;
    const feedKey = `${app.token.address.toLowerCase()}:${String(owner).toLowerCase()}`;
    if (app.tipBaselineOwner !== feedKey) {
      app.seenTips.clear();
      app.tipBaselineReady = false;
      app.tipBaselineOwner = feedKey;
    }
    const { tips, error } = await store.loadTips({ token: app.token.address, streamer: owner });
    if (generation !== app.routeGeneration || !document.getElementById("s-block")) return;
    if (error) {
      status.textContent = `Tip feed: ${error}`;
      return;
    }
    const min = Number(app.settings.minTip ?? 1);
    for (const tip of tips) {
      const key = `${tip.tx}-${tip.from}-${tip.amount}`;
      if (app.seenTips.has(key)) continue;
      app.seenTips.add(key);
      const amount = Number(tip.amount) / 10 ** app.token.decimals;
      if (app.tipBaselineReady && amount >= min) pushAlert({ ...tip, amount });
    }
    app.tipBaselineReady = true;
  }, true);
}

function pushAlert({ from, amount, demo, tx }) {
  const stack = document.getElementById("s-alerts");
  if (!stack) return;
  const el = document.createElement("div");
  el.className = "alert";
  el.innerHTML = `<span class="ham" aria-hidden="true">🐹</span>
    <div><div class="amt">+${esc(Number(amount).toFixed(2))} ${esc(app.token.symbol)}</div>
    <div class="who">${esc(fmt.shortAddr(from, 6))}${demo ? " · demo" : ""}</div></div>`;
  if (tx) el.title = tx;
  stack.appendChild(el);
  blip(720);
  setTimeout(() => {
    el.classList.add("out");
    setTimeout(() => el.remove(), 420);
  }, 6500);
  while (stack.children.length > 4) stack.firstElementChild.remove();
}

/* --------------------------------- tip ----------------------------------- */

function tipView() {
  const streamer = app.settings.streamer || app.account || "";
  const decimals = app.token.decimals;
  const presets = [1, 5, 10, 25, 100];
  view.innerHTML = `
  <div class="grid2">
    <section class="card">
      <h3>Send a tip</h3>
      <p class="hint">Tips are plain <span class="mono">${esc(app.token.symbol)}</span> transfers on Sepolia straight to the
      streamer's wallet. SqueekStage never holds your funds and never asks for a signature you can't read.</p>
      <div class="field">
        <label for="to">Streamer wallet</label>
        <input id="to" type="text" class="mono" value="${esc(streamer)}" placeholder="0x…" spellcheck="false" />
        <span class="hint">${streamer ? `Tips go to ${esc(fmt.shortAddr(streamer, 6))}` : "Set the streamer's address, or connect the wallet you stream from."}</span>
      </div>
      <div class="field">
        <span class="field-label" id="amount-label">Amount</span>
        <div class="amounts" id="amounts" role="group" aria-labelledby="amount-label">
          ${presets.map((p, i) => `<button class="chip" type="button" data-amount="${p}" aria-pressed="${i === 1 ? "true" : "false"}">${p}</button>`).join("")}
        </div>
      </div>
      <div class="field">
        <label for="custom">Custom amount</label>
        <input id="custom" type="number" min="0" step="0.0001" placeholder="0.00" inputmode="decimal" />
      </div>
      <div class="notice" id="tip-notice">Connect a wallet to see your balance and send.</div>
      <div style="height:12px"></div>
      <button class="btn btn-primary btn-block" id="send" type="button" disabled>Send tip</button>
      <p class="hint" style="margin-top:12px">Need test SQK? Use the Squeekchain faucet on
        <a class="link" href="https://squeekchain.com/genesis" target="_blank" rel="noopener">squeekchain.com/genesis</a>.</p>
    </section>

    <section>
      <div class="card">
        <h3>Recent tips</h3>
        <ul class="tips" id="tip-list"><li class="empty">Nothing on chain yet.</li></ul>
      </div>
      <div class="card">
        <h3>Top tippers</h3>
        <div class="kv" id="tip-board"><span>—</span><b>—</b></div>
      </div>
    </section>
  </div>`;

  const pick = (value) => {
    view.querySelector("#custom").value = "";
    for (const chip of view.querySelectorAll(".chip")) {
      chip.setAttribute("aria-pressed", String(Number(chip.dataset.amount) === Number(value)));
    }
  };

  for (const chip of view.querySelectorAll(".chip")) {
    chip.addEventListener("click", () => pick(chip.dataset.amount));
  }
  view.querySelector("#custom").addEventListener("input", () => {
    for (const chip of view.querySelectorAll(".chip")) chip.setAttribute("aria-pressed", "false");
  });

  const updateNotice = async () => {
    const notice = view.querySelector("#tip-notice");
    if (!app.account) {
      notice.textContent = "Connect a wallet to see your balance and send.";
      view.querySelector("#send").disabled = true;
      return;
    }
    if (!app.token.address) {
      notice.textContent = "Token address not loaded yet — the app reads it from the Squeekchain API.";
      return;
    }
    if (chain.getChainId() !== chain.SEPOLIA.chainId) {
      notice.className = "notice";
      notice.textContent = "Switch your wallet to Sepolia to read your SQK balance and send a tip.";
      view.querySelector("#send").disabled = true;
      return;
    }
    try {
      const bal = await chain.balanceOf(app.token.address, app.account);
      notice.className = "notice ok";
      notice.textContent = `Balance: ${fmt.fromBaseUnits(bal, decimals, 4)} ${app.token.symbol} · network ${chain.getChainId() === chain.SEPOLIA.chainId ? "Sepolia" : "wrong chain"}`;
      view.querySelector("#send").disabled = false;
    } catch {
      notice.textContent = "Could not read your balance. Check the wallet network (Sepolia).";
    }
  };

  view.querySelector("#send").addEventListener("click", async () => {
    const btn = view.querySelector("#send");
    const to = view.querySelector("#to").value.trim();
    const custom = view.querySelector("#custom").value.trim();
    const chip = [...view.querySelectorAll(".chip")].find((c) => c.getAttribute("aria-pressed") === "true");
    const amountText = custom || chip?.dataset.amount;
    try {
      if (!/^0x[0-9a-fA-F]{40}$/.test(to)) throw new Error("That is not a valid address");
      if (!amountText) throw new Error("Pick an amount");
      const amount = fmt.toBaseUnits(amountText, decimals);
      if (amount <= 0n) throw new Error("Amount must be above zero");
      if (!app.token.address) throw new Error("Token address not loaded yet");
      btn.disabled = true;
      btn.textContent = "Confirm in wallet…";
      await chain.ensureSepolia();
      const balance = await chain.balanceOf(app.token.address, app.account);
      if (balance < amount) throw new Error(`Insufficient ${app.token.symbol} balance for this tip.`);
      const tx = await chain.sendTransfer({ token: app.token.address, to, amountBaseUnits: amount });
      btn.textContent = "Waiting for Sepolia confirmation…";
      toastTransaction("Tip submitted; waiting for confirmation.", tx);
      const receipt = await chain.waitForTransaction(tx);
      if (!receipt) {
        toastTransaction("Tip is still pending; check its status.", tx);
        return;
      }
      if (BigInt(receipt.status ?? "0x1") === 0n) {
        toastTransaction("The tip transaction reverted on Sepolia.", tx, "err");
        return;
      }
      toastTransaction("Tip confirmed on Sepolia.", tx, "ok");
      blip(880);
      refreshTips();
      updateNotice();
    } catch (err) {
      const msg = err?.code === 4001 ? "Rejected in wallet" : err?.shortMessage ?? err?.message ?? "Tip failed";
      toast(msg, "err");
    } finally {
      btn.textContent = "Send tip";
      btn.disabled = false;
    }
  });

  async function refreshTips() {
    const token = app.token.address;
    const to = view.querySelector("#to").value.trim() || app.settings.streamer;
    const list = view.querySelector("#tip-list");
    const board = view.querySelector("#tip-board");
    if (!token || !to) return;
    const { tips, error } = await store.loadTips({ token, streamer: to, force: true });
    if (error) {
      list.innerHTML = `<li class="empty">${esc(error)}</li>`;
      return;
    }
    if (!tips.length) {
      list.innerHTML = `<li class="empty">No tips yet. Be the first hamster.</li>`;
      board.innerHTML = `<span>No tippers yet</span><b>—</b>`;
      return;
    }
    list.innerHTML = tips
      .slice(0, 25)
      .map(
        (t) => `<li><span>🐹</span>
        <span><span class="who">${esc(fmt.shortAddr(t.from, 5))}</span><br />
        <a class="when link" href="${esc(chain.explorerTx(t.tx))}" target="_blank" rel="noopener">block ${esc(fmt.fmtInt(t.block))}</a></span>
        <span class="amt">+${esc(fmt.fromBaseUnits(t.amount, decimals, 2))}</span></li>`,
      )
      .join("");
    const rows = store.leaderboard(tips, decimals);
    board.innerHTML = rows
      .map((r, i) => `<span>${i + 1}. ${esc(fmt.shortAddr(r.from, 5))} <span class="hint">(${r.count})</span></span><b>${esc(r.display.toFixed(2))}</b>`)
      .join("");
  }

  if (app.account) updateNotice();
  every(15000, refreshTips);
}

/* --------------------------------- setup --------------------------------- */

function setupView() {
  const s = app.settings;
  view.innerHTML = `
  <div class="grid2">
    <section class="card">
      <h3>Streamer setup</h3>
      <div class="field">
        <label for="streamer">Streamer wallet</label>
        <input id="streamer" type="text" class="mono" value="${esc(s.streamer)}" placeholder="0x…" spellcheck="false" />
        <span class="hint">The address that receives tips. ${app.account ? `Your connected wallet is ${esc(fmt.shortAddr(app.account, 6))}.` : ""}</span>
      </div>
      <div class="row">
        <div class="field">
          <label for="accent">Accent colour</label>
          <input id="accent" type="color" value="${esc(s.accent)}" />
        </div>
        <div class="field">
          <label for="min">Alert threshold (SQK)</label>
          <input id="min" type="number" min="0" step="0.1" value="${esc(s.minTip)}" />
        </div>
      </div>
      <div class="field">
        <label for="sound">Alert sound</label>
        <select id="sound">
          <option value="1" ${s.sound ? "selected" : ""}>On</option>
          <option value="0" ${!s.sound ? "selected" : ""}>Off</option>
        </select>
      </div>
      <div class="field">
        <label for="demo">Demo feed</label>
        <select id="demo">
          <option value="0" ${!s.demo ? "selected" : ""}>Off — real on-chain tips</option>
          <option value="1" ${s.demo ? "selected" : ""}>On — fake tips for previews</option>
        </select>
      </div>
      <button class="btn btn-primary btn-block" id="save" type="button">Save settings</button>
      <p class="hint" style="margin-top:12px">Settings stay in this browser (localStorage). The overlay URL carries them too,
      so a second machine can open the same stage without an account.</p>
    </section>

    <section>
      <div class="card">
        <h3>Overlay URL</h3>
        <div class="code" id="overlay-url">—</div>
        <div style="height:10px"></div>
        <button class="btn btn-block" id="copy">Copy for OBS</button>
        <p class="hint" style="margin-top:10px">In OBS: Sources → Browser → paste, 1920×1080, tick “Shutdown source when not visible”.</p>
      </div>
      <div class="card">
        <h3>Tip page URL</h3>
        <div class="code" id="tip-url">—</div>
        <div style="height:10px"></div>
        <button class="btn btn-block" id="copy-tip">Copy for chat</button>
      </div>
      <div class="card">
        <h3>Reset</h3>
        <p class="hint">Clears the streamer address, colours and demo flag from this browser.</p>
        <button class="btn btn-ghost btn-block" id="reset" type="button">Reset settings</button>
      </div>
    </section>
  </div>`;

  const paintUrls = () => {
    const cfg = { ...app.settings, streamer: app.settings.streamer || app.account || "" };
    view.querySelector("#overlay-url").textContent = store.overlayUrl(cfg);
    view.querySelector("#tip-url").textContent = store.tipUrl(cfg);
  };
  paintUrls();

  view.querySelector("#save").addEventListener("click", () => {
    const streamer = view.querySelector("#streamer").value.trim();
    if (streamer && !/^0x[0-9a-fA-F]{40}$/.test(streamer)) {
      toast("That is not a valid address", "err");
      return;
    }
    app.settings = store.saveSettings({
      streamer,
      accent: view.querySelector("#accent").value,
      minTip: view.querySelector("#min").value || "0",
      sound: view.querySelector("#sound").value === "1",
      demo: view.querySelector("#demo").value === "1",
    });
    applyAccent(app.settings.accent);
    paintUrls();
    toast("Saved", "ok");
  });

  view.querySelector("#copy").addEventListener("click", async () => {
    await navigator.clipboard?.writeText(view.querySelector("#overlay-url").textContent).catch(() => {});
    toast("Overlay URL copied");
  });
  view.querySelector("#copy-tip").addEventListener("click", async () => {
    await navigator.clipboard?.writeText(view.querySelector("#tip-url").textContent).catch(() => {});
    toast("Tip URL copied");
  });
  view.querySelector("#reset").addEventListener("click", () => {
    store.resetSettings();
    app.settings = store.loadSettings();
    applyAccent(app.settings.accent);
    toast("Settings cleared");
    refreshRoute();
  });

  // keep the streamer field in sync when a wallet connects later
  if (!app.settings.streamer && app.account) view.querySelector("#streamer").value = app.account;
}

/* --------------------------------- about --------------------------------- */

function aboutView() {
  view.innerHTML = `
  <section class="card">
    <p class="eyebrow">About</p>
    <h1 style="font-size:clamp(30px,5vw,52px);margin:6px 0 12px">A stage for the wheel</h1>
    <p class="lede">Squeekchain is a hamster-powered proof-of-work toychain: a real animal on a real wheel produces
    work, work settles into blocks, blocks pay SQK. SqueekStage gives that loop a face for streamers and a way for
    viewers to take part with on-chain tips.</p>
    <hr class="hr" />
    <div class="grid2">
      <div>
        <h3>Data it reads</h3>
        <div class="kv">
          <span><span class="mono">/v1/core</span></span><b>block height, progress, difficulty</b>
          <span><span class="mono">/v1/economy/state</span></span><b>token, staking, supply</b>
          <span><span class="mono">/v1/events</span></span><b>settlements, claims, merges</b>
          <span><span class="mono">/v1/measurement/stats</span></span><b>distance, work, streaks</b>
          <span><span class="mono">/v1/status</span></span><b>liveness of the stream</b>
          <span>ERC-20 <span class="mono">Transfer</span> logs</span><b>tips</b>
        </div>
      </div>
      <div>
        <h3>What it sends</h3>
        <p class="hint">One transaction type: an ERC-20 <span class="mono">transfer</span> of SQK from the viewer to the
        streamer. No approvals, no allowances, no proxy contracts, no custody.</p>
        <h3 style="margin-top:16px">Deliberate limits</h3>
        <p class="hint">Tips are public on chain, so amounts and addresses are visible. The overlay reads the last
        few thousand blocks per refresh and keeps a local cache; a very busy stream should point it at a dedicated RPC.</p>
      </div>
    </div>
  </section>`;
}

function notFound() {
  view.innerHTML = `<section class="card"><h1>Lost in the wheel</h1>
    <p class="lede">That page does not exist. <a class="link" href="#/">Back to the stage</a>.</p></section>`;
}

/* --------------------------------- boot ---------------------------------- */

(async function boot() {
  applyAccent(app.settings.accent);
  renderWallet();
  app.account = await chain.restore();
  renderWallet();

  // learn the token + addresses before the first paint of any view
  loadSnapshot().then((snap) => {
    app.snapshot = snap;
    app.token = {
      address: snap.economy?.asset?.address ?? snap.economy?.identities?.token ?? "",
      symbol: snap.economy?.asset?.symbol ?? "SQK",
      decimals: Number(snap.economy?.asset?.decimals ?? 18),
    };
    refreshRoute();
  });

  refreshRoute();
})();
