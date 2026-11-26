const express = require("express");
const router = express.Router();
const supabase = require("../supabaseClient");
const auth = require("../middleware/authMiddleware");
const admin = require("../middleware/adminMiddleware");
const logBuffer = require("../services/logBuffer");

router.use(auth, admin);

async function count(table, filter) {
  let q = supabase.from(table).select("*", { count: "exact", head: true });
  if (filter) q = filter(q);
  const { count: n, error } = await q;
  if (error) throw new Error(error.message);
  return n || 0;
}

// GET /api/admin/overview - platform-wide numbers for monitoring
router.get("/overview", async (_req, res) => {
  try {
    const since = new Date(Date.now() - 864e5).toISOString();
    const [users, campaigns, events, events24h] = await Promise.all([
      count("users"), count("campaigns"), count("ad_events"),
      count("ad_events", q => q.gte("created_at", since)),
    ]);
    const { data: cs, error } = await supabase.from("campaigns")
      .select("id, brand_name, platform, views, performance_score, performance_tier, created_at")
      .order("created_at", { ascending: false }).limit(5000);
    if (error) throw new Error(error.message);

    const scored = cs.filter(c => c.performance_score !== null && c.performance_score !== undefined);
    const byPlatform = {};
    cs.forEach(c => { byPlatform[c.platform] = (byPlatform[c.platform] || 0) + 1; });
    res.set("Cache-Control", "no-store");
    res.json({
      totals: { users, campaigns, events, events_last_24h: events24h, scored_campaigns: scored.length },
      avg_score: scored.length ? Math.round(10 * scored.reduce((s, c) => s + Number(c.performance_score), 0) / scored.length) / 10 : null,
      campaigns_by_platform: byPlatform,
      recent_campaigns: cs.slice(0, 8),
    });
  } catch (err) { res.status(500).json({ message: "Overview failed", detail: err.message }); }
});

// GET /api/admin/users - accounts with their campaign counts
router.get("/users", async (_req, res) => {
  try {
    const { data: users, error } = await supabase.from("users")
      .select("id, full_name, email, role, created_at").order("created_at", { ascending: false }).limit(500);
    if (error) throw new Error(error.message);
    const { data: cs } = await supabase.from("campaigns").select("user_id").limit(20000);
    const per = {};
    (cs || []).forEach(c => { per[c.user_id] = (per[c.user_id] || 0) + 1; });
    res.set("Cache-Control", "no-store");
    res.json({ users: users.map(u => ({ ...u, role: u.role || "user", campaigns: per[u.id] || 0 })) });
  } catch (err) { res.status(500).json({ message: "Could not list users", detail: err.message }); }
});

// PATCH /api/admin/users/:id/role  { role: "user" | "admin" }
router.patch("/users/:id/role", async (req, res) => {
  try {
    const role = req.body && req.body.role;
    if (!["user", "admin"].includes(role)) return res.status(400).json({ message: "role must be 'user' or 'admin'" });
    if (req.params.id === req.user.id) return res.status(400).json({ message: "You cannot change your own role" });
    const { data, error } = await supabase.from("users").update({ role }).eq("id", req.params.id).select("id, full_name, email, role").single();
    if (error || !data) return res.status(404).json({ message: "User not found" });
    res.json({ user: data });
  } catch (err) { res.status(500).json({ message: "Server error", detail: err.message }); }
});

// GET /api/admin/logs?limit=100 - recent API requests (in-memory)
router.get("/logs", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ logs: logBuffer.recent(req.query.limit), capacity: logBuffer.MAX });
});

module.exports = router;
