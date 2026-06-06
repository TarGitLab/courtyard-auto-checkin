// ── STORAGE UTILS ─────────────────────────────────────────────────────────────
const STORAGE_KEY = "courtyard_accounts";

export function loadAllSessions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveSession(email, session) {
  const all = loadAllSessions();
  all[email] = { ...all[email], ...session, updatedAt: Date.now() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function getSession(email) {
  return loadAllSessions()[email] ?? null;
}

export function clearSession(email) {
  const all = loadAllSessions();
  delete all[email];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function isTokenExpired(token) {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return Date.now() >= payload.exp * 1000;
  } catch {
    return true;
  }
}

export function getTokenExpiry(token) {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp * 1000;
  } catch {
    return null;
  }
}


// Key format: checkin_YYYY-MM-DD_email
function getDailyCheckinKey(email) {
  const today = new Date().toISOString().slice(0, 10); // "2025-01-31"
  return `checkin_${today}_${email}`;
}

function cleanOldCheckinKeys(email) {
  const todayKey = getDailyCheckinKey(email);
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    // Remove any checkin key for this email that isn't today's
    if (key.startsWith("checkin_") && key.endsWith(`_${email}`) && key !== todayKey) {
      localStorage.removeItem(key);
    }
  }
}

export function markDailyCheckin(email) {
  cleanOldCheckinKeys(email); // remove yesterday's key first
  localStorage.setItem(getDailyCheckinKey(email), "done");
}

export function isDailyCheckinDone(email) {
  return localStorage.getItem(getDailyCheckinKey(email)) === "done";
}

export function getServerUrl() {
  return localStorage.getItem("server_url") ?? null;
}

export function setServerUrl(url) {
  localStorage.setItem("server_url", url.replace(/\/$/, "")); // strip trailing slash
}


export function savePoints(email, points) {
  const key = "courtyard_points";
  const all = JSON.parse(localStorage.getItem(key) ?? "{}");
  all[email] = Number(points) || 0;
  localStorage.setItem(key, JSON.stringify(all));
}

export function getAllPoints() {
  const all = JSON.parse(localStorage.getItem("courtyard_points") ?? "{}");
  return all;
}

export function fetBalance(email) {
  const key = "courtyard_points";
  const all = JSON.parse(localStorage.getItem(key) ?? "{}");
  if(all[email] === undefined) return 0;
  return all[email];
}