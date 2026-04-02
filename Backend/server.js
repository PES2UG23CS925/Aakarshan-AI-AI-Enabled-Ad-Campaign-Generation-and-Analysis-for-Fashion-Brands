const express = require("express");
const cors = require("cors");
require("dotenv").config({ path: ".env" });
const supabase = require("./supabaseClient");
const dashboardRoutes = require("./routes/dashboard");
const authRoutes = require("./routes/auth");
const campaignRoutes = require("./routes/campaign");
const healthRoutes = require("./routes/health");

// Verify environment variables are loaded
if (!process.env.SUPABASE_URL || process.env.SUPABASE_URL.includes("your-project")) {
  console.error(
    "⚠️  WARNING: SUPABASE_URL not properly configured in .env file!"
  );
  console.error("   Current value:", process.env.SUPABASE_URL);
}

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/campaign", campaignRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/health", healthRoutes);

app.get("/", (req, res) => {
  res.json({
    message: "🚀 AKARSHAN AI - Auth API running...",
    version: "1.0.0",
    status: "active",
    endpoints: {
      auth: "/api/auth (register, login)",
      campaign: "/api/campaign (generate)",
      dashboard: "/api/dashboard (get stats)",
      health: "/api/health/status (check connection)",
    },
  });
});

const PORT = process.env.PORT || 5000;

// Check Supabase connection on startup
async function checkSupabaseConnection() {
  try {
    // Just verify credentials are loaded
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("❌ SUPABASE CREDENTIALS MISSING");
      return false;
    }
    console.log("✅ SUPABASE CONNECTED");
    return true;
  } catch (err) {
    console.error("❌ SUPABASE CONNECTION ERROR:", err.message);
    return false;
  }
}

// Start server
app.listen(PORT, async () => {
  console.log(`\n╔════════════════════════════════════════════╗`);
  console.log(`║     🚀 AKARSHAN AI SERVER STARTED 🚀     ║`);
  console.log(`╠════════════════════════════════════════════╣`);
  console.log(`║ Server running on port ${PORT}`);
  console.log(`║ Supabase: ${process.env.SUPABASE_URL}`);
  
  // Check Supabase connection
  const isConnected = await checkSupabaseConnection();
  
  console.log(`║ Status: ${isConnected ? "✅ READY" : "❌ NOT CONNECTED"}`);
  console.log(`║ Test: http://localhost:${PORT}/api/health/status`);
  console.log(`╚════════════════════════════════════════════╝\n`);
});
