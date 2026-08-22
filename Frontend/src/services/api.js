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
  return res.json();
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
  selectImage:      (id, imageUrl) => req("PATCH", `/api/campaign/${id}/select-image`, { imageUrl }),
  simulateEngagement: (id) => fetch(`${BASE}/api/campaign/${id}/simulate`, { method: "POST" }).then(r => r.json()),

  // Performance ML
  analyzePerformance: (id) => req("POST", `/api/performance/analyze/${id}`),
  getInsights:        ()   => req("GET",  "/api/performance/insights"),
  getPerfDashboard:   ()   => req("GET",  "/api/performance/dashboard"),
};
