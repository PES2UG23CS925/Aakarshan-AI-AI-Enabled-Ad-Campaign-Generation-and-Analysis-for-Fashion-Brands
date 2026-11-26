// Tests for the final-release features: role-based admin API, request log buffer, /auth/me
// and the downloadable campaign report. Uses an in-memory fake of the Supabase client.
const Module = require("module");
const B = require("path").join(__dirname, "..") + "/";
process.env.SUPABASE_URL = "https://proj.supabase.co"; process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key"; process.env.PORT = "0"; process.env.GROQ_API_KEY = "k";
process.env.NODE_ENV = "production";

const now = Date.now();
const day = n => new Date(now - n * 864e5).toISOString();
const db = {
  users: [
    { id: "admin1", full_name: "Ada Admin", email: "ada@x.com", role: "admin", created_at: day(30) },
    { id: "u1", full_name: "Una User", email: "una@x.com", role: "user", created_at: day(20) },
    { id: "u2", full_name: "Uri User", email: "uri@x.com", created_at: day(5) },
  ],
  campaigns: [
    { id: "c1-aaaa-bbbb", user_id: "u1", brand_name: "=HYPERLINK(\"http://evil\")", category: "Streetwear", platform: "Instagram", target_audience: "Gen Z, 18-24", headline: "Own the street", views: 100, likes: 10, shares: 2, comments: 3, clicks: 5, variants: ["a", "b"], performance_score: 62.5, performance_tier: "High", performance_confidence: "High", created_at: day(10) },
    { id: "c2", user_id: "u2", brand_name: "Other", category: "Luxury", platform: "Twitter", views: 0, likes: 0, shares: 0, comments: 0, clicks: 0, variants: [], performance_score: null, created_at: day(2) },
  ],
  ad_events: [
    { campaign_id: "c1-aaaa-bbbb", event_type: "view", variant: 0, created_at: day(1) },
    { campaign_id: "c1-aaaa-bbbb", event_type: "view", variant: 1, created_at: day(1) },
    { campaign_id: "c1-aaaa-bbbb", event_type: "like", variant: 1, created_at: day(0) },
    { campaign_id: "c1-aaaa-bbbb", event_type: "click", variant: 0, created_at: day(0) },
    { campaign_id: "c2", event_type: "view", variant: null, created_at: day(40) },
  ],
};
let currentUser = "admin1";

function q(table) {
  const f = []; let upd = null, single = false, cols = null, count = null, head = false, lim = null, ord = null;
  const o = {
    select(c, opts) { if (c && c !== "*") cols = c.split(",").map(x => x.trim()); if (opts && opts.count) { count = true; head = !!opts.head; } return o; },
    eq(k, v) { f.push(r => r[k] == v); return o; },
    gte(k, v) { f.push(r => r[k] >= v); return o; },
    not(k, op, v) { f.push(r => r[k] !== null && r[k] !== undefined); return o; },
    order(k, opt) { ord = [k, opt && opt.ascending === false]; return o; },
    limit(n) { lim = n; return o; },
    update(u) { upd = u; return o; }, single() { single = true; return o; },
    then(res) {
      let r = db[table].filter(x => f.every(g => g(x)));
      if (upd) { r.forEach(x => Object.assign(x, upd)); }
      if (ord) r = [...r].sort((a, b) => (a[ord[0]] < b[ord[0]] ? -1 : 1) * (ord[1] ? -1 : 1));
      if (lim) r = r.slice(0, lim);
      const proj = x => { if (!cols || !x) return x; const y = {}; cols.forEach(c => (y[c] = x[c])); return y; };
      if (count) return res({ count: r.length, data: head ? null : r.map(proj), error: null });
      if (single) return res({ data: proj(r[0]) || null, error: r[0] ? null : { message: "not found" } });
      return res({ data: r.map(proj), error: null });
    },
  };
  return o;
}
const fake = { from: q, auth: { getUser: async () => ({ data: { user: { id: currentUser, email: "x@x.com" } }, error: null }) } };
const orig = Module._load;
Module._load = function (r) { if (/supabaseClient$/.test(r)) return fake; return orig.apply(this, arguments); };

let pass = 0, fail = 0;
const ok = (n, c) => { console.log((c ? "PASS " : "FAIL ") + n); c ? pass++ : fail++; };

(async () => {
  const express = require(B + "node_modules/express");
  const realListen = express.application.listen; let srv;
  express.application.listen = function (p, cb) { srv = realListen.call(this, 0, cb); return srv; };
  require(B + "server.js"); await new Promise(r => setTimeout(r, 300));
  const base = `http://localhost:${srv.address().port}`;
  const J = async (m, u, b, h = {}) => {
    const x = await fetch(base + u, { method: m, headers: { "Content-Type": "application/json", Authorization: "Bearer t", ...h }, body: b ? JSON.stringify(b) : undefined });
    const ct = x.headers.get("content-type") || "";
    return [x.status, ct.includes("json") ? await x.json().catch(() => null) : await x.text(), x.headers];
  };
  const as = id => { currentUser = id; };

  // ---- /api/auth/me ----
  as("admin1"); let [s, d] = await J("GET", "/api/auth/me");
  ok("/auth/me returns the profile with role=admin", s === 200 && d.user.role === "admin");
  as("u2"); [s, d] = await J("GET", "/api/auth/me");
  ok("/auth/me defaults a missing role to 'user'", s === 200 && d.user.role === "user");

  // ---- RBAC ----
  as("u1");
  for (const p of ["/api/admin/overview", "/api/admin/users", "/api/admin/logs"]) { [s] = await J("GET", p); ok(`normal user gets 403 on ${p}`, s === 403); }
  [s] = await J("PATCH", "/api/admin/users/u2/role", { role: "admin" }); ok("normal user cannot change roles (403)", s === 403 && db.users[2].role === undefined);
  const raw = await fetch(base + "/api/admin/users"); ok("no token => 401", raw.status === 401);

  // ---- admin endpoints ----
  as("admin1");
  [s, d] = await J("GET", "/api/admin/overview");
  ok("overview: totals (3 users, 2 campaigns, 5 events)", s === 200 && d.totals.users === 3 && d.totals.campaigns === 2 && d.totals.events === 5);
  ok("overview: only events newer than 24h are counted (2 of 5)", d.totals.events_last_24h === 2);
  ok("overview: only scored campaigns enter the average (62.5)", d.avg_score === 62.5 && d.totals.scored_campaigns === 1);
  ok("overview: platform split and recent list", d.campaigns_by_platform.Instagram === 1 && d.recent_campaigns.length === 2);
  [s, d] = await J("GET", "/api/admin/users");
  const una = d.users.find(u => u.id === "u1");
  ok("users: lists accounts with campaign counts and default role", d.users.length === 3 && una.campaigns === 1 && d.users.find(u => u.id === "u2").role === "user");
  ok("users: no password or token fields exposed", d.users.every(u => !("password" in u) && !("token" in u)));
  [s] = await J("PATCH", "/api/admin/users/u2/role", { role: "owner" }); ok("role change rejects invalid role (400)", s === 400);
  [s] = await J("PATCH", "/api/admin/users/admin1/role", { role: "user" }); ok("admin cannot demote themselves (400)", s === 400 && db.users[0].role === "admin");
  [s, d] = await J("PATCH", "/api/admin/users/u2/role", { role: "admin" }); ok("admin can promote a user", s === 200 && d.user.role === "admin" && db.users[2].role === "admin");
  [s] = await J("PATCH", "/api/admin/users/nope/role", { role: "user" }); ok("unknown user => 404", s === 404);

  // ---- log buffer ----
  [s, d] = await J("GET", "/api/admin/logs?limit=5");
  ok("logs: returns at most `limit` newest-first entries", s === 200 && d.logs.length === 5 && d.logs[0].ts >= d.logs[4].ts);
  ok("logs: entries have method/path/status/ms and no query strings", d.logs.every(l => l.method && l.path && l.status && typeof l.ms === "number" && !l.path.includes("?")));
  ok("logs: 403s are recorded as warnings", (await J("GET", "/api/admin/logs?limit=200"))[1].logs.some(l => l.status === 403 && l.level === "warn"));

  // ---- report export ----
  as("u1");
  [s, d] = await J("GET", "/api/performance/report/c1-aaaa-bbbb?format=json");
  ok("report json: totals and rates (ER = 15/100, CTR = 5/100)", s === 200 && d.totals.views === 100 && d.totals.engagement_rate === 0.15 && d.totals.ctr === 0.05);
  ok("report json: 30-day timeline with the 3 recent view/like/click events", d.timeline.length === 30 && d.timeline.reduce((a, r) => a + r.views + r.likes + r.clicks, 0) === 4);
  ok("report json: per-variant stats from tagged events", d.variants.length === 2 && d.variants[1].likes === 1 && d.variants[0].clicks === 1 && d.variants[1].views === 1);
  ok("report json: includes the stored score and tier", d.score.performance_score === 62.5 && d.score.tier === "High");
  let r = await fetch(base + "/api/performance/report/c1-aaaa-bbbb", { headers: { Authorization: "Bearer t" } });
  const csv = await r.text();
  ok("report csv: attachment with csv content type", r.status === 200 && /text\/csv/.test(r.headers.get("content-type")) && /attachment; filename="aakarshan_report_c1-aaaa-/.test(r.headers.get("content-disposition")));
  ok("report csv: sections present", /Daily timeline/.test(csv) && /A\/B variants/.test(csv) && /engagement_rate,0.15/.test(csv));
  ok("report csv: formula injection neutralised (=HYPERLINK ... becomes text)", csv.includes("'=HYPERLINK") && !/^=HYPERLINK/m.test(csv) && !/,=HYPERLINK/.test(csv));
  [s] = await J("GET", "/api/performance/report/c1-aaaa-bbbb?format=xml"); ok("report: unsupported format => 400", s === 400);
  [s] = await J("GET", "/api/performance/report/c2"); ok("report: other user's campaign => 404", s === 404);

  console.log(`\n${pass} passed, ${fail} failed`);
  srv.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
