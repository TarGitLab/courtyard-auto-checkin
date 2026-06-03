// ── BACKEND API CLIENT ────────────────────────────────────────────────────────
import { getServerUrl } from "./storage.js";

function getBaseUrl() {
  const url = getServerUrl();
  if (!url) throw new Error("Server URL not configured");
  return `${url}/api`;
}

async function apiFetch(path, options = {}) {
  const { headers: extraHeaders, ...rest } = options;
  const res = await fetch(`${getBaseUrl()}${path}`, {
    // ← changed
    headers: {
      "Content-Type": "application/json",
      ...(extraHeaders ?? {}),
    },
    ...rest,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

export async function fetchAccounts() {
  return apiFetch("/accounts");
}

export async function getBalance(courtyardUserId, token) {
  return apiFetch(`/points/balance?courtyardUserId=${encodeURIComponent(courtyardUserId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getDailyEligibility(courtyardUserId, token) {
  return apiFetch(`/points/eligibility?courtyardUserId=${encodeURIComponent(courtyardUserId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function claimDailyCheckin(courtyardUserId, token) {
  return apiFetch("/points/claim", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ courtyardUserId }),
  });
}

export async function autoVerify(email) {
  return apiFetch("/auto-verify", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}