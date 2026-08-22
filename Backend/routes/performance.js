const express  = require("express");
const router   = express.Router();
const { spawn } = require("child_process");
const path     = require("path");
const supabase = require("../supabaseClient");
const auth     = require("../middleware/authMiddleware");

const SCRIPT = path.join(__dirname, "../ml_artifacts/inference.py");

function runML(input) {
  return new Promise((resolve, reject) => {
    const py = spawn("python3", [SCRIPT, JSON.stringify(input)]);
    let out = "", err = "";
    py.stdout.on("data", d => (out += d));
    py.stderr.on("data", d => (err += d));
    py.on("close", code => {
      if (code !== 0) return reject(new Error(`Python error: ${err}`));
      try { resolve(JSON.parse(out)); }
      catch (e) { reject(new Error(`Bad JSON: ${out}`)); }
    });
  });
}

// ── POST /api/performance/analyze/:campaignId ─────────────────────────────────
// Run ML on a campaign's real engagement data and save score back to campaign
router.post("/analyze/:campaignId", auth, async (req, res) => {
  try {
    const { data: campaign, error } = await supabase
      .from("campaigns").select("*")
      .eq("id", req.params.campaignId).eq("user_id", req.user.id).single();
    if (error) return res.status(404).json({ message: "Campaign not found" });

    const views    = campaign.views    || 0;
    const likes    = campaign.likes    || 0;
    const shares   = campaign.shares   || 0;
    const comments = campaign.comments || 0;

    // Require at least some real engagement before running ML
    if (views === 0) {
      return res.status(400).json({
        message: "no_data",
        detail: "No real engagement data yet. Share your ad link to collect views, likes, shares, and comments before running analysis."
      });
    }

    const input = {
      mode:            "analyze",
      platform:        campaign.platform || "Instagram",
      day_of_week:     new Date(campaign.created_at).toLocaleString("en-US", { weekday: "long" }),
      sentiment_label: "Positive",
      emotion_type:    "Happy",
      topic_category:  campaign.category || "Product",
      campaign_phase:  "Launch",
      language:        "en",
      sentiment_score: 0.7,
      toxicity_score:  0.05,
      hashtag_count:   (campaign.hashtags || []).length,
      mention_count:   0,
      keyword_count:   3,
      text_length:     (campaign.ad_copy || "").length,
      has_mention:     0,
      user_past_sentiment_avg: 0.3,
      user_engagement_growth:  0.1,
      buzz_change_rate:        0.0,
      likes_count:     likes,
      shares_count:    shares,
      comments_count:  comments,
      impressions:     views,
    };

    const result = await runML(input);
    if (result.error) return res.status(500).json({ message: result.error });

    // Save score back to campaign
    await supabase.from("campaigns").update({
      performance_score: result.performance_score,
      performance_tier:  result.tier,
    }).eq("id", req.params.campaignId);

    res.json({ ...result, campaign_id: req.params.campaignId });
  } catch (err) {
    res.status(500).json({ message: "Analysis failed", detail: err.message });
  }
});

// ── GET /api/performance/insights ────────────────────────────────────────────
router.get("/insights", async (req, res) => {
  try {
    const result = await runML({ mode: "insights" });
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: "Insights failed", detail: err.message });
  }
});

// ── GET /api/performance/dashboard ───────────────────────────────────────────
// Aggregate stats for the brand's campaigns
router.get("/dashboard", auth, async (req, res) => {
  try {
    const { data: campaigns, error } = await supabase
      .from("campaigns").select("*").eq("user_id", req.user.id);
    if (error) return res.status(400).json({ message: error.message });

    const scored = campaigns.filter(c => c.performance_score !== null);
    const avgScore = scored.length
      ? scored.reduce((a, c) => a + c.performance_score, 0) / scored.length
      : 0;

    const tierCounts = { Low: 0, Medium: 0, High: 0, Viral: 0 };
    scored.forEach(c => { if (tierCounts[c.performance_tier] !== undefined) tierCounts[c.performance_tier]++; });

    const bestCampaign = scored.sort((a, b) => b.performance_score - a.performance_score)[0] || null;

    res.json({
      total_campaigns:   campaigns.length,
      scored_campaigns:  scored.length,
      avg_score:         Math.round(avgScore * 10) / 10,
      tier_breakdown:    tierCounts,
      best_campaign:     bestCampaign,
      total_views:       campaigns.reduce((a, c) => a + (c.views || 0), 0),
      total_likes:       campaigns.reduce((a, c) => a + (c.likes || 0), 0),
      total_shares:      campaigns.reduce((a, c) => a + (c.shares || 0), 0),
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
