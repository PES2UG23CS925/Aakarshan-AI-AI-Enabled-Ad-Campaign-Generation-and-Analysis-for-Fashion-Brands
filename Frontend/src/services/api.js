import { supabase } from "../supabaseClient";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

async function getToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

async function req(method, path, body) {
  const token = await getToken();
  const opts = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  };
  // Never throw: a dropped connection or a non-JSON reply becomes { message } so pages can show it
  // instead of crashing (this was the "error when going back to Campaigns").
  let res;
  try { res = await fetch(`${BASE}${path}`, opts); }
  catch { return { message: "Can't reach the server. Check your connection and try again." }; }
  try { return await res.json(); } catch { return { message: `Server error (${res.status})` }; }
}

export const api = {
  // Auth
  register: (fullName, email, password) =>
    req("POST", "/api/auth/register", { fullName, email, password }),
  login: (email, password) =>
    req("POST", "/api/auth/login", { email, password }),

  // Campaigns
  generateCampaign: (data) => req("POST", "/api/campaign/generate", data),
  getCampaigns:     ()     => req("GET",  "/api/campaign"),
  getCampaign:      (id)   => req("GET",  `/api/campaign/${id}`),
  deleteCampaign:   (id)   => req("DELETE", `/api/campaign/${id}`),
  selectImage:      (id, imageUrl) => req("POST", `/api/campaign/${id}/select-image`, { imageUrl }),
  // Public (no login): one real viewer action. Server de-duplicates per visitor.
  getPublicAd: (id, visitor, extra) => fetch(`${BASE}/api/campaign/public/${id}?${new URLSearchParams({ visitor: visitor || "", ...extra })}`, { cache: "no-store" }).then(r => r.json()),
  recordEvent: (id, type, visitorId, text, variant) =>
    fetch(`${BASE}/api/campaign/public/${id}/event`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, visitorId, text, ...(Number.isInteger(variant) ? { variant } : {}) }), keepalive: true,
    }).then(r => r.json()).catch(() => ({ ok: false })),

  startAbTest: (id, variants) => req("POST", `/api/campaign/${id}/start-ab`, { variants }),
  getAbTest:   (id) => req("GET", `/api/performance/ab/${id}`),

  // Performance ML
  analyzePerformance: (id) => req("POST", `/api/performance/analyze/${id}`),
  getInsights:        ()   => req("GET",  "/api/performance/insights"),
  getTrends:          (category) => req("GET", `/api/performance/trends?category=${encodeURIComponent(category || "")}`),
  getPerfDashboard:   ()   => req("GET",  "/api/performance/dashboard"),
  getTimeline:        (id) => req("GET",  `/api/performance/timeline/${id}?days=14`),

  // Report download (CSV or JSON): fetched with the auth header, then saved through a temporary link
  downloadReport: async (id, format = "csv") => {
    const token = await getToken();
    const res = await fetch(`${BASE}/api/performance/report/${id}?format=${format}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!res.ok) { let m = "Could not download the report"; try { m = (await res.json()).message || m; } catch { /* keep default */ } throw new Error(m); }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `aakarshan_report_${String(id).slice(0, 8)}.${format}`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  },

  // Account + admin console (admin routes return 403 for normal users)
  me:            () => req("GET", "/api/auth/me"),
  adminOverview: () => req("GET", "/api/admin/overview"),
  adminUsers:    () => req("GET", "/api/admin/users"),
  adminSetRole:  (id, role) => req("PATCH", `/api/admin/users/${id}/role`, { role }),
  adminLogs:     (limit = 100) => req("GET", `/api/admin/logs?limit=${limit}`),
};
