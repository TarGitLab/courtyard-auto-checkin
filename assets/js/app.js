// ── APP ───────────────────────────────────────────────────────────────────────
import { formatCountdown, sleep, truncate } from "./helpers.js";
import { saveSession, getSession, isTokenExpired, getTokenExpiry, markDailyCheckin, isDailyCheckinDone, getServerUrl, setServerUrl , savePoints, getAllPoints} from "./storage.js";
import {  fetchAccounts,  getBalance,  autoVerify,  getDailyEligibility,  claimDailyCheckin,} from "./api.js";

// ═══════════════════════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════════════════════
let verifyAccIntervel = 20000; // 20s
let after5accInterval = 3 * 60 * 1000; // 3 minutes

let ACCOUNTS = [];
const state = {};
let countdownInterval = null;

// ═══════════════════════════════════════════════════════════════
//  TOAST
// ═══════════════════════════════════════════════════════════════
function toast(msg, type = "inf") {
  const c = document.getElementById("toast-container");
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => {
    t.style.opacity = "0";
    setTimeout(() => t.remove(), 300);
  }, 3500);
}

// ═══════════════════════════════════════════════════════════════
//  RENDER CARD
// ═══════════════════════════════════════════════════════════════
function renderAll() {
  const sorted = [...ACCOUNTS].sort((a, b) => {
    const priority = (email) => {
      const sess = getSession(email);
      const st = state[email] ?? {};
      const alreadyCheckedIn = isDailyCheckinDone(email);
      const noToken = !sess?.token;
      const expiredAndNotCheckedIn =
        sess?.token && isTokenExpired(sess.token) && !alreadyCheckedIn;

      if (noToken) return 0;
      if (expiredAndNotCheckedIn) return 1;
      if (st.eligibility?.eligible === true) return 2;
      return 3;
    };
    return priority(a) - priority(b);
  });
  sorted.forEach((account, index) => {
    renderCard(account, index);
  });
}

function renderCard(email , index = 0) {
  const sess = getSession(email);
  const st = state[email] ?? {};
  const expired = !sess?.token || isTokenExpired(sess.token);
  const expiry = sess?.token ? getTokenExpiry(sess.token) : null;
  const bal = st.balance;
  const elig = st.eligibility;

  const avatarLetter = index;

  let tokenBadge = `<span class="badge badge-none">NO TOKEN</span>`;
  if (sess?.token) {
    tokenBadge = expired
      ? `<span class="badge badge-exp">EXPIRED</span>`
      : ``;
      // `<span class="badge">ACTIVE</span>`;
  }

  let eligBadge = "";
  if (elig !== undefined) {
    eligBadge = elig.eligible
      ? `<span class="badge badge-eligible">ELIGIBLE ✓</span>`
      : `<span class="badge badge-ineligible">DONE ✗</span>`;
  }

  let tokenSection = "";
  if (sess?.token && !expired && expiry) {
    tokenSection = `
      <div class="info-block">
        <label>Token Expires</label>
        <div class="value countdown" id="cd-${btoa(email).replace(/=/g, "")}">
          ${formatCountdown(expiry)}
        </div>
      </div>
      <div class="info-block">
        <label>Access Token</label>
        <div class="token-preview">${truncate(sess.token, 20, 10)}</div>
      </div>`;
  } else if (sess?.token && expired) {
    tokenSection = `
      <div class="info-block">
        <label>Access Token</label>
        <div class="value expired">Token expired — re-verify to continue</div>
      </div>`;
  }

  let balSection = "";
  if (bal) {
    balSection = `
      <div class="info-block">
        <label>Spendable Points</label>
        <div class="value accent">${
          bal.points_balances?.spendable?.balance ?? "—"
        }</div>
      </div>`;
  }

  let walletSection = "";
  if (sess?.primaryWallet) {
    walletSection = `
      <div class="info-block">
        <label>Wallet</label>
        <div class="value mono">${truncate(sess.primaryWallet, 10, 6)}</div>
      </div>`;
  }

  let usernameSection = "";
  if (sess?.username) {
    usernameSection = `
      <div class="info-block">
        <label>Username</label>
        <div class="value">${sess.username}</div>
      </div>`;
  }

  let checkinResult = "";
  if (st.lastCheckin) {
    checkinResult = `
      <div class="info-block">
        <label>Last Check-in</label>
        <div class="value" style="color:var(--accent2)">+${st.lastCheckin.points} pts · ${st.lastCheckin.tier}</div>
      </div>`;
  }

  const hasValidToken = sess?.token && !expired;
  const verifyLabel = sess?.token
    ? expired
      ? "🔄 Re-verify OTP"
      : "✅ 🔄 Re-verify"
    : "🔑 Verify Email";

  const isClaimed = isDailyCheckinDone(email) ? `<button class="btn btn-success btn-sm">✅ Claimed</button>` : ``;
  
  const cardId = `card-${btoa(email).replace(/=/g, "")}`;
  const cardHtml = `
    <div class="account-card" id="${cardId}">
      <div class="card-header">
        <div class="">${avatarLetter}</div>
        <div class="account-email">${email}</div>
        ${isClaimed}
        ${tokenBadge}
        ${eligBadge}
        <div class="card-header-actions">
          <button class="btn btn-primary btn-sm" data-email="${email}" onclick="App.openOtpModal(this)">
            ${verifyLabel}
          </button>
          ${
            hasValidToken
              ? `
            <button class="btn btn-ghost btn-sm" onclick="App.fetchBalance('${email}')">💰 Balance</button>
            <button class="btn btn-ghost btn-sm" onclick="App.fetchEligibility('${email}')">📅 Eligibility</button>
            ${
              elig?.eligible
                ? `<button class="btn btn-success btn-sm" onclick="App.claimCheckin('${email}')">✅ Claim</button>`
                : ""
            }
          `
              : ""
          }
        </div>
      </div>
      <div class="card-body">
        ${usernameSection}
        ${balSection}
        ${walletSection}
        ${tokenSection}
        ${checkinResult}
      </div>
      <div class="card-footer">
        <span class="status-msg ${st.statusType ?? ""}" id="status-${btoa(
    email
  ).replace(/=/g, "")}">
          ${st.statusMsg ?? ""}
        </span>
        ${st.loading ? `<span class="spin">⟳</span>` : ""}
      </div>
    </div>`;

  const grid = document.getElementById("accounts-grid");
  const existing = document.getElementById(cardId);
  if (existing) {
    existing.outerHTML = cardHtml;
  } else {
    grid.insertAdjacentHTML("beforeend", cardHtml);
  }

  updateSummary();
}

function setStatus(email, msg, type = "") {
  state[email] = { ...(state[email] ?? {}), statusMsg: msg, statusType: type };
  const el = document.getElementById(`status-${btoa(email).replace(/=/g, "")}`);
  if (el) {
    el.textContent = msg;
    el.className = `status-msg ${type}`;
  }
}

// ═══════════════════════════════════════════════════════════════
//  SUMMARY BAR
// ═══════════════════════════════════════════════════════════════
function updateSummary() {
  let total = ACCOUNTS.length;
  let active = 0,
    expired = 0,
    claimable = 0,
    claimed = 0,
    points = 0;

  for (const email of ACCOUNTS) {
    const sess = getSession(email);
    const st = state[email] ?? {};

    if (!sess?.token) {
      expired++;
      continue;
    }
    if(isDailyCheckinDone(email)) claimed++;
    
    if (isTokenExpired(sess.token)) {
       expired++;
    } else {
      active++;
    }

    if (st.eligibility?.eligible) claimable++;

    const bal = st.balance?.points_balances?.spendable?.balance;
    if (bal) points += Number(bal) || 0;
  }

  document.getElementById("s-total").textContent = total;
  document.getElementById("s-active").textContent = active;
  document.getElementById("s-expired").textContent = expired;
  document.getElementById("s-claimable").textContent = claimable;
  document.getElementById("s-claimed").textContent = claimed;
  document.getElementById("s-points").textContent = points.toLocaleString();
}

// ═══════════════════════════════════════════════════════════════
//  SEARCH
// ═══════════════════════════════════════════════════════════════
function searchFn(query) {
  const q = query.trim().toLowerCase();
  ACCOUNTS.forEach((email) => {
    const sess = getSession(email);
    const cardId = `card-${btoa(email).replace(/=/g, "")}`;
    const card = document.getElementById(cardId);
    if (!card) return;

    if (!q) {
      card.classList.remove("hidden");
      return;
    }

    const matchEmail = email.toLowerCase().includes(q);
    const matchUsername = (sess?.username ?? "").toLowerCase().includes(q);
    const matchWallet = (sess?.primaryWallet ?? "").toLowerCase().includes(q);

    card.classList.toggle(
      "hidden",
      !(matchEmail || matchUsername || matchWallet)
    );
  });
}

// ═══════════════════════════════════════════════════════════════
//  COUNTDOWN TICKER
// ═══════════════════════════════════════════════════════════════
function startCountdownTicker() {
  if (countdownInterval) clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    ACCOUNTS.forEach((email) => {
      const sess = getSession(email);
      if (!sess?.token) return;
      const expiry = getTokenExpiry(sess.token);
      if (!expiry) return;
      const el = document.getElementById(`cd-${btoa(email).replace(/=/g, "")}`);
      if (!el) return;
      const txt = formatCountdown(expiry);
      el.textContent = txt;
      if (txt === "EXPIRED") renderCard(email);
    });
  }, 1000);
}

// ═══════════════════════════════════════════════════════════════
//  OTP FLOW
// ═══════════════════════════════════════════════════════════════
async function openOtpModal(element) {
  const email = element.dataset.email;
  const eleInner = element.textContent;

  element.disabled = true;
  element.textContent = "⏳ Verifying…";
  setStatus(email, "Sending OTP & auto-fetching…", "");

  try {
    const data = await autoVerify(email); // ← uses api.js

    saveSession(email, data.session);
    toast(`✅ ${email} authenticated!`, "ok");
    setStatus(email, `Logged in as ${data.session.username}`, "ok");
    renderCard(email);

    // Auto claim daily check-in after verification
    try {
      const eligData = await getDailyEligibility(data.session.courtyardUserId, data.session.token);
      state[email] = { ...(state[email] ?? {}), eligibility: eligData };

      if (eligData.eligible) {
        const checkin = await claimDailyCheckin(data.session.courtyardUserId, data.session.token);
        state[email] = {
          ...(state[email] ?? {}),
          eligibility: { eligible: false },
          lastCheckin: checkin,
        };
        markDailyCheckin(email); 
        toast(`🎉 ${email}: Auto-claimed +${checkin.points} pts · ${checkin.tier}`, "ok");
        setStatus(email, `Claimed +${checkin.points} pts (${checkin.tier})`, "ok");
      } else {
        markDailyCheckin(email);
        setStatus(email, `Already checked in today`, "");
      }

      renderCard(email);
    } catch (e) {
      toast(`⚠️ ${email}: Check-in failed — ${e.message}`, "err");
    }

  } catch (e) {
    toast(`Auto-verify failed: ${e.message}`, "err");
    setStatus(email, `Error: ${e.message}`, "err");
  } finally {
    element.disabled = false;
    element.textContent = eleInner;
  }
}

// ═══════════════════════════════════════════════════════════════
//  FETCH BALANCE
// ═══════════════════════════════════════════════════════════════
async function fetchBalanceFn(email) {
  const sess = getSession(email);
  if (!sess?.token || isTokenExpired(sess.token)) {
    toast(`${email}: token expired — re-verify first`, "err");
    return;
  }
  setStatus(email, "Fetching balance…", "");
  state[email] = { ...(state[email] ?? {}), loading: true };
  renderCard(email);
  try {
    const data = await getBalance(sess.courtyardUserId, sess.token);
    state[email] = { ...(state[email] ?? {}), balance: data, loading: false };
    savePoints(email, data.points_balances?.spendable?.balance ?? 0);
    setStatus(
      email,
      `Balance: ${data.points_balances?.spendable?.balance ?? "?"} pts`,
      "ok"
    );
    renderCard(email);
    toast(
      `💰 ${email}: ${data.points_balances?.spendable?.balance} spendable pts`,
      "ok"
    );
  } catch (e) {
    state[email] = { ...(state[email] ?? {}), loading: false };
    setStatus(email, `Balance error: ${e.message}`, "err");
    renderCard(email);
  }
}

// ═══════════════════════════════════════════════════════════════
//  FETCH ELIGIBILITY
// ═══════════════════════════════════════════════════════════════
async function fetchEligibilityFn(email) {
  const sess = getSession(email);
  if (!sess?.token || isTokenExpired(sess.token)) {
    toast(`${email}: token expired — re-verify first`, "err");
    return;
  }
  setStatus(email, "Checking eligibility…", "");
  state[email] = { ...(state[email] ?? {}), loading: true };
  renderCard(email);
  try {
    const data = await getDailyEligibility(sess.courtyardUserId, sess.token);
    state[email] = {
      ...(state[email] ?? {}),
      eligibility: data,
      loading: false,
    };
    const msg = data.eligible
      ? "Eligible for check-in ✓"
      : "Already checked in today";
    if (!data.eligible) markDailyCheckin(email);
    setStatus(email, msg, data.eligible ? "ok" : "");
    renderCard(email);
    toast(`${email}: ${msg}`, data.eligible ? "ok" : "inf");
  } catch (e) {
    state[email] = { ...(state[email] ?? {}), loading: false };
    setStatus(email, `Eligibility error: ${e.message}`, "err");
    renderCard(email);
  }
}

// ═══════════════════════════════════════════════════════════════
//  CLAIM CHECK-IN
// ═══════════════════════════════════════════════════════════════
async function claimCheckinFn(email) {
  const sess = getSession(email);
  if (!sess?.token || isTokenExpired(sess.token)) {
    toast(`${email}: token expired — re-verify first`, "err");
    return;
  }
  setStatus(email, "Claiming check-in…", "");
  state[email] = { ...(state[email] ?? {}), loading: true };
  renderCard(email);
  try {
    const data = await claimDailyCheckin(sess.courtyardUserId, sess.token);
    state[email] = {
      ...(state[email] ?? {}),
      eligibility: { eligible: false },
      lastCheckin: data,
      loading: false,
    };
    markDailyCheckin(email);
    setStatus(email, `Claimed! +${data.points} pts (${data.tier})`, "ok");
    renderCard(email);
    toast(`🎉 ${email}: +${data.points} pts · ${data.tier}`, "ok");
  } catch (e) {
    state[email] = { ...(state[email] ?? {}), loading: false };
    setStatus(email, `Claim error: ${e.message}`, "err");
    renderCard(email);
  }
}

// ═══════════════════════════════════════════════════════════════
//  BULK ACTIONS
// ═══════════════════════════════════════════════════════════════
async function fetchAllBalances() {

    let permission = confirm("Do you want to fetch all accounts balances.");

    if (!permission) {
      return;
    }

  document.getElementById("global-status").textContent =
    "Fetching all balances…";
  for (const email of ACCOUNTS) await fetchBalanceFn(email);
  document.getElementById("global-status").textContent =
    "All balances fetched.";
}

async function verifyAllEmails() {

  let batchCount = 0;

  let permission = confirm("Do you want to verify all accounts.");

  if(!permission){
     return;
  }

  let eachAccountDelay = prompt("Enter delay between each account verification in seconds (default 20s):", "20");

  if(eachAccountDelay !== null){
    let delaySec = parseInt(eachAccountDelay);
    if(!isNaN(delaySec) && delaySec >= 0){
      verifyAccIntervel = delaySec * 1000;
    } else {
      alert("Invalid input for delay. Using default 20 seconds.");
    }
  }

  let after5accDelay = prompt("Enter delay after every 5 accounts verification in seconds (default 180s):", "180");

  if(after5accDelay !== null){
    let delaySec = parseInt(after5accDelay);
    if(!isNaN(delaySec) && delaySec >= 0){
      after5accInterval = delaySec * 1000;
    } else {
      alert("Invalid input for delay. Using default 180 seconds.");
    }
  }

  document.getElementById("global-status").textContent = "Verifying all emails…";
  let success = 0,
    failed = 0;
  for (const email of ACCOUNTS) {
    const sess = getSession(email);

    const alreadyCheckedIn = isDailyCheckinDone(email);
    const tokenStillValid = sess?.token && !isTokenExpired(sess.token);
    if (tokenStillValid || alreadyCheckedIn) continue;

    setStatus(email, "Verifying…", "");
    try {
      const data = await autoVerify(email);
      saveSession(email, data.session);
      state[email] = { ...(state[email] ?? {}) };
      fetchBalanceFn(email);
      setStatus(email, `Logged in as ${data.session.username}`, "ok");
      renderCard(email);

      try {
        const eligData = await getDailyEligibility(data.session.courtyardUserId, data.session.token);
        state[email] = { ...(state[email] ?? {}), eligibility: eligData };
        if (eligData.eligible) {
          const checkin = await claimDailyCheckin(data.session.courtyardUserId, data.session.token);
          state[email] = { ...(state[email] ?? {}), eligibility: { eligible: false }, lastCheckin: checkin };
          markDailyCheckin(email);
          setStatus(email, `Claimed +${checkin.points} pts (${checkin.tier})`, "ok");
        } else {
          markDailyCheckin(email);
        }
        renderCard(email);
      } catch (e) {
        toast(`⚠️ ${email}: Check-in failed — ${e.message}`, "err");
      }

      success++;

      batchCount++;

      if (batchCount % 5 === 0) {
        const pauseMsg = `Batch of 5 done — waiting 3 minutes before next batch…`;
        document.getElementById("global-status").textContent = pauseMsg;
        toast(pauseMsg, "inf");
        batchCount = 0;
        await sleep(after5accInterval);
      }

    } catch (e) {
      setStatus(email, `Error: ${e.message}`, "err");
      renderCard(email);
      failed++;
    }

    await sleep(verifyAccIntervel);
  }
  const msg = `Verify all done — ✅ ${success} success, ❌ ${failed} failed`;
  document.getElementById("global-status").textContent = msg;
  toast(msg, failed === 0 ? "ok" : "inf");
}

async function fetchAllEligibility() {

  let permission = confirm("Do you want to fetch all accounts daily checkin status.");

  if (!permission) {
    return;
  }

  document.getElementById("global-status").textContent =
    "Checking all eligibility…";
  for (const email of ACCOUNTS) await fetchEligibilityFn(email);
  document.getElementById("global-status").textContent =
    "Eligibility check done.";
}

async function claimAllEligible() {

  let permission = confirm("Do you want to claim all accounts daily checkin.");

  if (!permission) {
    return;
  }

  document.getElementById("global-status").textContent =
    "Claiming eligible check-ins…";
  let claimed = 0;
  for (const email of ACCOUNTS) {
    const st = state[email];
    if (st?.eligibility?.eligible) {
      await claimCheckinFn(email);
      claimed++;
    }
  }
  const msg =
    claimed > 0
      ? `Claimed ${claimed} check-in(s)!`
      : "No eligible accounts to claim.";
  document.getElementById("global-status").textContent = msg;
  toast(msg, claimed > 0 ? "ok" : "inf");
}

async function resetServerUrl (){
  const url = prompt("Enter new server URL:", getServerUrl() ?? "");
  if (url !== null && url.trim()) {
    setServerUrl(url.trim());
    toast("Server URL updated — reloading…", "ok");
    setTimeout(() => location.reload(), 1000);
  }
}

function sumAllPoints() {
  const all = getAllPoints();
  const total = Object.values(all).reduce((acc, v) => acc + v, 0);
  document.getElementById("s-points").textContent = total.toLocaleString();
  toast(`💰 Total spendable: ${total.toLocaleString()} pts`, "ok");
}
  // ═══════════════════════════════════════════════════════════════
  //  EXPOSE TO WINDOW
  // ═══════════════════════════════════════════════════════════════
  window.App = {
    openOtpModal,
    verifyAllEmails,
    fetchBalance: fetchBalanceFn,
    fetchEligibility: fetchEligibilityFn,
    claimCheckin: claimCheckinFn,
    fetchAllBalances,
    fetchAllEligibility,
    claimAllEligible,
    search: searchFn,
    resetServerUrl,
    sumAllPoints,
  };

// ── INIT ──────────────────────────────────────────────────────
(async () => {
  // Check for server URL first
  let serverUrl = getServerUrl();
  if (!serverUrl) {
    serverUrl = prompt("🌐 Enter your backend server URL (e.g. http://localhost:3001):");
    if (!serverUrl || !serverUrl.trim()) {
      document.getElementById("global-status").textContent = "⚠️ No server URL provided. Reload to try again.";
      return;
    }
    setServerUrl(serverUrl.trim());
  }

  try {
    const { accounts } = await fetchAccounts();
    ACCOUNTS.push(...accounts);
    renderAll();
    updateSummary();
    startCountdownTicker();
  } catch (e) {
    document.getElementById("global-status").textContent = `⚠️ Cannot reach backend: ${e.message}`;
    console.error("Init failed:", e);
  }
})();