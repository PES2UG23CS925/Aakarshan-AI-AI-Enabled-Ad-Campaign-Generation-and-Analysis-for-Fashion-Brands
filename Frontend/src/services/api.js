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
  const res = await fetch(`${BASE}${path}`, opts);
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
  recordEvent: (id, type, visitorId, text) =>
    fetch(`${BASE}/api/campaign/public/${id}/event`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, visitorId, text }), keepalive: true,
    }).then(r => r.json()).catch(() => ({ ok: false })),

  startAbTest: (id, variants) => req("POST", `/api/campaign/${id}/start-ab`, { variants }),
  getAbTest:   (id) => req("GET", `/api/performance/ab/${id}`),

  // Performance ML
  analyzePerformance: (id) => req("POST", `/api/performance/analyze/${id}`),
  getInsights:        ()   => req("GET",  "/api/performance/insights"),
  getTrends:          (category) => req("GET", `/api/performance/trends?category=${encodeURIComponent(category || "")}`),
  getPerfDashboard:   ()   => req("GET",  "/api/performance/dashboard"),
  getTimeline:        (id) => req("GET",  `/api/performance/timeline/${id}?days=14`),
};
