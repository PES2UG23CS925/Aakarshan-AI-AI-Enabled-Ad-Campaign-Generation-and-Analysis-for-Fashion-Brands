// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export const apiConfig = {
  baseURL: API_BASE_URL,
  endpoints: {
    // Authentication
    register: `${API_BASE_URL}/api/auth/register`,
    login: `${API_BASE_URL}/api/auth/login`,
    healthCheck: `${API_BASE_URL}/api/health/status`,
    
    // Campaigns
    generateCampaign: `${API_BASE_URL}/api/campaign/generate`,
    getCampaigns: `${API_BASE_URL}/api/campaign`,
    getCampaign: (id) => `${API_BASE_URL}/api/campaign/${id}`,
    updateCampaign: (id) => `${API_BASE_URL}/api/campaign/${id}`,
    deleteCampaign: (id) => `${API_BASE_URL}/api/campaign/${id}`,
    
    // Dashboard
    getDashboard: `${API_BASE_URL}/api/dashboard`,
    getDashboardMetrics: (days) => `${API_BASE_URL}/api/dashboard/metrics/${days}`,
  },
};

// API Service Methods
export const apiService = {
  // Authentication
  register: async (fullName, email, password) => {
    const res = await fetch(apiConfig.endpoints.register, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, email, password }),
    });
    return res.json();
  },

  login: async (email, password) => {
    const res = await fetch(apiConfig.endpoints.login, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    return res.json();
  },

  // Campaigns
  generateCampaign: async (campaignData, token) => {
    const res = await fetch(apiConfig.endpoints.generateCampaign, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(campaignData),
    });
    return res.json();
  },

  getCampaigns: async (token) => {
    const res = await fetch(apiConfig.endpoints.getCampaigns, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return res.json();
  },

  getCampaign: async (id, token) => {
    const res = await fetch(apiConfig.endpoints.getCampaign(id), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return res.json();
  },

  updateCampaign: async (id, campaignData, token) => {
    const res = await fetch(apiConfig.endpoints.updateCampaign(id), {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(campaignData),
    });
    return res.json();
  },

  deleteCampaign: async (id, token) => {
    const res = await fetch(apiConfig.endpoints.deleteCampaign(id), {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return res.json();
  },

  // Dashboard
  getDashboard: async (token) => {
    const res = await fetch(apiConfig.endpoints.getDashboard, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return res.json();
  },

  getDashboardMetrics: async (days, token) => {
    const res = await fetch(apiConfig.endpoints.getDashboardMetrics(days), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return res.json();
  },

  // Health Check
  checkHealth: async () => {
    try {
      const res = await fetch(apiConfig.endpoints.healthCheck);
      return res.json();
    } catch (err) {
      return { status: "disconnected", error: err.message };
    }
  },
};

export default apiService;
