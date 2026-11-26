const fs = require("fs");
const path = require("path");
// The project shipped the config as "env" (no dot), which dotenv ignores. Load .env first,
// then fall back to "env" so existing setups keep working.
require("dotenv").config({ path: path.join(__dirname, ".env") });
if (!process.env.GROQ_API_KEY && fs.existsSync(path.join(__dirname, "env"))) {
  require("dotenv").config({ path: path.join(__dirname, "env") });
}
// Fail fast with a clear message instead of crashing later on the first request.
const REQUIRED_ENV = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(", ")}. See Backend/.env.example.`);
  process.exit(1);
}
const express   = require("express");
const cors      = require("cors");
const helmet    = require("helmet");
const rateLimit = require("express-rate-limit");

const pkg = require("./package.json");
const requestLogger = require("./middleware/requestLogger");

const app = express();
app.set("trust proxy", 1);                 // correct client IPs behind Render/Vercel/nginx
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

// CORS: set ALLOWED_ORIGINS=https://yourapp.com,https://www.yourapp.com in production.
// Unset => local dev origins only.
const allowed = (process.env.ALLOWED_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173")
  .split(",").map(s => s.trim()).filter(Boolean);
app.use(cors({ origin: (o, cb) => (!o || allowed.includes(o)) ? cb(null, true) : cb(new Error("Origin not allowed")) }));
app.use(express.json({ limit: "100kb" }));
app.use(requestLogger);

const limiter = (windowMs, max, message) => rateLimit({
  windowMs, max, standardHeaders: true, legacyHeaders: false, message: { message },
});
app.use("/api/auth",                     limiter(15 * 60 * 1000, 30,  "Too many attempts, try again in a few minutes"));
app.use("/api/campaign/generate",        limiter(60 * 60 * 1000, 20,  "Generation limit reached (20/hour). Try again later."));
// Relaxed in dev so local demo/test tools (many "visitors" from one machine) don't trip this;
// production deployments (NODE_ENV=production) keep the strict per-IP limit.
const isProd = process.env.NODE_ENV === "production";
app.use("/api/campaign/public",          limiter(60 * 1000,      isProd ? 120 : 3000, "Too many requests"));
app.use("/api",                          limiter(60 * 1000,      isProd ? 300 : 5000, "Too many requests"));

app.use("/api/auth",        require("./routes/auth"));
app.use("/api/campaign",    require("./routes/campaign"));
app.use("/api/performance", require("./routes/performance"));
app.use("/api/admin",       require("./routes/admin"));

app.get("/", (_, res) => res.json({ status: "ok", version: pkg.version }));
app.get("/api/health", (_, res) => res.json({ status: "healthy", uptime_s: Math.round(process.uptime()) }));

app.use((err, req, res, next) => {
  console.error(err.message);
  require("./services/logBuffer").push({ level: "error", method: req.method, path: (req.originalUrl || "").split("?")[0], status: 500, message: err.message });
  res.status(err.message === "Origin not allowed" ? 403 : 500).json({ message: err.message === "Origin not allowed" ? err.message : "Server error" });
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  require("./services/mlRunner").warmUp();   // load the ML worker now so the first report is fast
  console.log(`\n╔══════════════════════════════════════╗`);
  console.log(`║  🚀 AKARSHAN AI SERVER v${pkg.version} READY`.padEnd(39) + "║");
  console.log(`║  Port: ${String(PORT).padEnd(30)}║`);
  console.log(`║  ML: benchmark + sentiment + A/B    ║`);
  console.log(`╚══════════════════════════════════════╝\n`);
});

// Keep-alive must outlast the load balancer's idle timeout (avoids sporadic 502s behind Render/nginx).
server.keepAliveTimeout = 65000;
server.headersTimeout   = 66000;

// Graceful shutdown: stop accepting connections, let in-flight requests finish, stop the ML worker.
let closing = false;
function shutdown(signal) {
  if (closing) return;
  closing = true;
  console.log(`${signal} received, shutting down...`);
  require("./services/mlRunner").stop();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();   // force-exit if something hangs
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));

// One bad request must never take the whole API down silently.
process.on("unhandledRejection", (e) => console.error("[unhandledRejection]", e && e.message ? e.message : e));
process.on("uncaughtException",  (e) => { console.error("[uncaughtException]", e); shutdown("uncaughtException"); });

module.exports = app;
