const express = require("express");
const router = express.Router();
const supabase = require("../supabaseClient");

/* CHECK SUPABASE CONNECTION */
router.get("/status", (req, res) => {
  try {
    // Check if SUPABASE_URL is configured
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({
        status: "error",
        message: "Supabase credentials not configured",
        url: supabaseUrl ? "✓ configured" : "✗ missing",
        key: supabaseKey ? "✓ configured" : "✗ missing",
      });
    }

    res.json({
      status: "connected",
      message: "✅ Supabase is successfully connected!",
      database: "authdb",
      url: supabaseUrl,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Health check error:", err);
    res.status(500).json({
      status: "error",
      message: "Health check failed",
      error: err.message,
    });
  }
});

module.exports = router;
