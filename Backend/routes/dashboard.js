const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const supabase = require("../supabaseClient");

// Get dashboard statistics for user
router.get("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all campaigns for the user
    const { data: campaigns, error: campaignError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("user_id", userId);

    if (campaignError) {
      console.error(campaignError);
    }

    // Get user info
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (userError) {
      console.error(userError);
    }

    // Calculate statistics
    const totalCampaigns = campaigns?.length || 0;
    const publishedCampaigns = campaigns?.filter(c => c.status === "published").length || 0;

    // Calculate aggregated metrics
    let totalViews = 0;
    let totalClicks = 0;
    let totalConversions = 0;
    let avgCTR = 0;
    let avgEngagementRate = 0;

    if (campaigns && campaigns.length > 0) {
      totalViews = campaigns.reduce((sum, c) => sum + (c.views_count || 0), 0);
      totalClicks = campaigns.reduce((sum, c) => sum + (c.clicks_count || 0), 0);
      totalConversions = campaigns.reduce((sum, c) => sum + (c.conversions_count || 0), 0);

      const ctrValues = campaigns
        .filter(c => c.ctr)
        .map(c => c.ctr);
      avgCTR = ctrValues.length > 0 ? (ctrValues.reduce((a, b) => a + b, 0) / ctrValues.length).toFixed(2) : 0;

      const engagementValues = campaigns
        .filter(c => c.engagement_rate)
        .map(c => c.engagement_rate);
      avgEngagementRate = engagementValues.length > 0 ? (engagementValues.reduce((a, b) => a + b, 0) / engagementValues.length).toFixed(2) : 0;
    }

    res.json({
      message: "Welcome to dashboard",
      user: {
        id: user?.id,
        fullName: user?.full_name,
        email: user?.email,
        subscription: user?.subscription_tier || "free",
      },
      statistics: {
        totalCampaigns,
        publishedCampaigns,
        draftCampaigns: totalCampaigns - publishedCampaigns,
        totalViews,
        totalClicks,
        totalConversions,
        avgCTR: `${avgCTR}%`,
        avgEngagementRate: `${avgEngagementRate}%`,
      },
      campaigns: campaigns || [],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get statistics for a specific date range
router.get("/metrics/:days", authMiddleware, async (req, res) => {
  try {
    const { days } = req.params;
    const userId = req.user.id;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Get campaigns created in last X days
    const { data: campaigns, error } = await supabase
      .from("campaigns")
      .select("*")
      .eq("user_id", userId)
      .gte("created_at", startDate.toISOString());

    if (error) {
      return res.status(400).json({ message: error.message });
    }

    res.json({
      message: `Dashboard metrics for last ${days} days`,
      period: `${days} days`,
      campaigns: campaigns.length,
      data: campaigns,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
