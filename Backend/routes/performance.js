const express   = require("express");
const router    = express.Router();
const { spawn } = require("child_process");
const path      = require("path");
const supabase  = require("../supabaseClient");
const auth      = require("../middleware/authMiddleware");
const { getTrends } = require("../services/trendService");

const SCRIPT = path.join(__dirname, "../ml_artifacts/inference.py");
// Windows usually has `python`, not `python3`. Override with PYTHON_BIN in .env if needed.
const PYTHON = process.env.PYTHON_BIN || (process.platform === "win32" ? "python" : "python3");

function runML(input) {
  return new Promise((resolve, reject) => {
    const py = spawn(PYTHON, [SCRIPT, JSON.stringify(input)]);
    let out = "", err = "";
    const timer = setTimeout(() => { py.kill(); reject(new Error("ML timed out")); }, 30000);
    py.on("error", e => { clearTimeout(timer); reject(new Error(`Could not start "${PYTHON}": ${e.message}. Set PYTHON_BIN in .env`)); });
    py.stdout.on("data", d => (out += d));
    py.stderr.on("data", d => (err += d));
    py.on("close", () => {
      clearTimeout(timer);
      try { resolve(JSON.parse(out)); }
      catch { reject(new Error(`ML failed: ${(err || out).slice(0, 300)}`)); }
    });
  });
}

// POST /api/performance/analyze/:campaignId
// Scores a campaign from its REAL counters + real viewer comments.
router.post("/analyze/:campaignId", auth, async (req, res) => {
  try {
    const { data: c, error } = await supabase.from("campaigns").select("*")
      .eq("id", req.params.campaignId).eq("user_id", req.user.id).single();
    if (error || !c) return res.status(404).json({ message: "Campaign not found" });

    if (!(c.views > 0)) {
      return res.status(400).json({
        message: "no_data",
        detail: "No real views yet. Share your ad link to collect views, likes, shares, comments and clicks before scoring.",
      });
    }

    const { data: cm } = await supabase.from("ad_events").select("comment_text")
      .eq("campaign_id", c.id).eq("event_type", "comment")
      .order("created_at", { ascending: false }).limit(200);

    const result = await runML({
      mode: "analyze",
      platform: c.platform,
      views: c.views || 0, likes: c.likes || 0, shares: c.shares || 0,
      comments: c.comments || 0, clicks: c.clicks || 0,
      hashtag_count: (c.hashtags || []).length,
      comment_texts: (cm || []).map(r => r.comment_text).filter(Boolean),
    });
    if (result.error) return res.status(result.error === "no_data" ? 400 : 500).json({ message: result.error });

    await supabase.from("campaigns").update({
      performance_score: result.performance_score,
      performance_tier: result.tier,
      performance_confidence: result.confidence,
      scored_at: new Date().toISOString(),
    }).eq("id", c.id);

    res.set("Cache-Control", "no-store");
    res.json({ ...result, campaign_id: c.id });
  } catch (err) {
    res.status(500).json({ message: "Analysis failed", detail: err.message });
  }
});

// GET /api/performance/timeline/:campaignId?days=14 — daily counts for charts
router.get("/timeline/:campaignId", auth, async (req, res) => {
  try {
    const { data: c } = await supabase.from("campaigns").select("id, created_at")
      .eq("id", req.params.campaignId).eq("user_id", req.user.id).single();
    if (!c) return res.status(404).json({ message: "Campaign not found" });

    const days = Math.min(Math.max(parseInt(req.query.days) || 14, 1), 60);
    const since = new Date(Date.now() - days * 864e5).toISOString();
    const { data: ev, error } = await supabase.from("ad_events")
      .select("event_type, created_at, comment_text")
      .eq("campaign_id", c.id).gte("created_at", since).order("created_at", { ascending: true }).limit(20000);
    if (error) return res.status(400).json({ message: error.message });

    const buckets = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
      buckets[d] = { date: d, view: 0, like: 0, share: 0, comment: 0, click: 0 };
    }
    ev.forEach(e => { const d = e.created_at.slice(0, 10); if (buckets[d]) buckets[d][e.event_type]++; });
    const recentComments = ev.filter(e => e.event_type === "comment").slice(-10).reverse()
      .map(e => ({ text: e.comment_text, at: e.created_at }));
    res.set("Cache-Control", "no-store");
    res.json({ timeline: Object.values(buckets), recent_comments: recentComments });
  } catch (err) { res.status(500).json({ message: "Server error", detail: err.message }); }
});

// GET /api/performance/ab/:campaignId — Bayesian A/B comparison of the published variants
router.get("/ab/:campaignId", auth, async (req, res) => {
  try {
    const { data: c } = await supabase.from("campaigns").select("id, variants, platform")
      .eq("id", req.params.campaignId).eq("user_id", req.user.id).single();
    if (!c) return res.status(404).json({ message: "Campaign not found" });
    const vs = Array.isArray(c.variants) ? c.variants : [];
    if (vs.length < 2) return res.json({ active: false });

    const { data: ev, error } = await supabase.from("ad_events").select("event_type, variant")
      .eq("campaign_id", c.id).not("variant", "is", null).limit(50000);
    if (error) return res.status(400).json({ message: error.message });

    const stats = vs.map((url, i) => ({ index: i, image_url: url, views: 0, likes: 0, shares: 0, comments: 0, clicks: 0 }));
    const key = { view: "views", like: "likes", share: "shares", comment: "comments", click: "clicks" };
    (ev || []).forEach(e => { if (stats[e.variant]) stats[e.variant][key[e.event_type]]++; });

    const result = await runML({ mode: "ab_test", platform: c.platform, variants: stats });
    if (result.error) return res.status(500).json({ message: result.error });
    res.set("Cache-Control", "no-store");
    res.json({ active: true, ...result });
  } catch (err) { res.status(500).json({ message: "A/B analysis failed", detail: err.message }); }
});

// GET /api/performance/trends?category=Streetwear — live fashion-news trends + sentiment
router.get("/trends", auth, async (req, res) => {
  try { res.set("Cache-Control", "no-store"); res.json(await getTrends(req.query.category)); }
  catch (err) { res.status(500).json({ message: "Trend feed failed", detail: err.message }); }
});

// GET /api/performance/insights — benchmark + honest model metrics
router.get("/insights", auth, async (_req, res) => {
  try { res.json(await runML({ mode: "insights" })); }
  catch (err) { res.status(500).json({ message: "Insights failed", detail: err.message }); }
});

// GET /api/performance/dashboard — brand-level analytics + feedback loop
router.get("/dashboard", auth, async (req, res) => {
  try {
    const { data: campaigns, error } = await supabase.from("campaigns").select("*").eq("user_id", req.user.id);
    if (error) return res.status(400).json({ message: error.message });

    const sum = k => campaigns.reduce((a, c) => a + (c[k] || 0), 0);
    const scored = campaigns.filter(c => c.performance_score !== null && c.performance_score !== undefined);
    const avg = arr => arr.length ? Math.round(arr.reduce((a, c) => a + c.performance_score, 0) / arr.length * 10) / 10 : null;

    const tier_breakdown = { Low: 0, Medium: 0, High: 0, Viral: 0 };
    scored.forEach(c => { if (c.performance_tier in tier_breakdown) tier_breakdown[c.performance_tier]++; });

    const group = key => {
      const m = {};
      scored.forEach(c => { (m[c[key]] = m[c[key]] || []).push(c); });
      return Object.entries(m).map(([label, arr]) => ({ label, campaigns: arr.length, avg_score: avg(arr) }))
        .sort((a, b) => b.avg_score - a.avg_score);
    };
    const by_platform = group("platform"), by_category = group("category");

    // Feedback loop: learn from THIS brand's own history. Needs >=2 groups to compare.
    const insights = [];
    if (by_platform.length >= 2) {
      const top = by_platform[0], bot = by_platform[by_platform.length - 1];
      insights.push(`${top.label} is your strongest platform (avg ${top.avg_score}) vs ${bot.label} (${bot.avg_score}). Prioritise it for your next campaign.`);
    }
    if (by_category.length >= 2) {
      const top = by_category[0];
      insights.push(`"${top.label}" campaigns score highest for you (avg ${top.avg_score}). Reuse their copy tone and visual style.`);
    }
    const lowConf = scored.filter(c => c.performance_confidence === "Low").length;
    if (lowConf) insights.push(`${lowConf} scored campaign(s) have fewer than 20 views, so their scores are provisional.`);
    if (scored.length < 2) insights.push("Score at least two campaigns on different platforms or categories to unlock personalised insights.");

    const views = sum("views");
    res.set("Cache-Control", "no-store");
    res.json({
      total_campaigns: campaigns.length,
      scored_campaigns: scored.length,
      avg_score: avg(scored) ?? 0,
      tier_breakdown,
      best_campaign: [...scored].sort((a, b) => b.performance_score - a.performance_score)[0] || null,
      total_views: views, total_likes: sum("likes"), total_shares: sum("shares"),
      total_comments: sum("comments"), total_clicks: sum("clicks"),
      overall_ctr: views ? Math.round(sum("clicks") / views * 10000) / 10000 : 0,
      by_platform, by_category, insights,
    });
  } catch (err) { res.status(500).json({ message: "Server error", detail: err.message }); }
});

module.exports = router;
