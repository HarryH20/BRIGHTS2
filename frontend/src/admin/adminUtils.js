export function parseDevice(ua) {
  if (!ua) return "—";
  const s = ua.toLowerCase();

  let os = "Unknown";
  if (s.includes("iphone")) os = "iPhone";
  else if (s.includes("ipad")) os = "iPad";
  else if (s.includes("android")) os = "Android";
  else if (s.includes("windows nt")) os = "Windows";
  else if (s.includes("mac os x")) os = "macOS";
  else if (s.includes("linux")) os = "Linux";

  let browser = "";
  if (s.includes("edg/")) browser = "Edge";
  else if (s.includes("opr/") || s.includes("opera")) browser = "Opera";
  else if (s.includes("chrome/")) browser = "Chrome";
  else if (s.includes("firefox/")) browser = "Firefox";
  else if (s.includes("safari/")) browser = "Safari";

  return browser ? `${os} · ${browser}` : os;
}

export function fmtTs(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

export function fmtDuration(seconds) {
  if (seconds == null) return "active";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}
