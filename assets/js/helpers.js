// ── GENERAL UTILS ─────────────────────────────────────────────────────────────

export function formatCountdown(expiryMs) {
  const diff = expiryMs - Date.now();
  if (diff <= 0) return "EXPIRED";
  const totalSec = Math.floor(diff / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function truncate(str, head = 6, tail = 4) {
  if (!str || str.length <= head + tail + 3) return str ?? "—";
  return `${str.slice(0, head)}…${str.slice(-tail)}`;
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
