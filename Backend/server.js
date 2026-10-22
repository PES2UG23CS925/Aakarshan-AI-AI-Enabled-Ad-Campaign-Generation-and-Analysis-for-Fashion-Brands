const fs = require("fs");
const path = require("path");
// The project shipped the config as "env" (no dot), which dotenv ignores. Load .env first,
// then fall back to "env" so existing setups keep working.
require("dotenv").config({ path: path.join(__dirname, ".env") });
if (!process.env.GROQ_API_KEY && fs.existsSync(path.join(__dirname, "env"))) {
  require("dotenv").config({ path: path.join(__dirname, "env") });
}
const express   = require("express");
const cors      = require("cors");
const helmet    = require("helmet");
const rateLimit = require("express-rate-limit");

const app = express();
app.set("trust proxy", 1);                 // correct client IPs behind Render/Vercel/nginx
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

// CORS: set ALLOWED_ORIGINS=https://yourapp.com,https://www.yourapp.com in production.
// Unset => local dev origins only.
const allowed = (process.env.ALLOWED_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173")
  .split(",").map(s => s.trim()).filter(Boolean);
app.use(cors({ origin: (o, cb) => (!o || allowed.includes(o)) ? cb(null, true) : cb(new Error("Origin not allowed")) }));
app.use(express.json({ limit: "100kb" }));

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

app.get("/", (_, res) => res.json({ status: "ok", version: "5.0.0" }));
app.get("/api/health", (_, res) => res.json({ status: "healthy" }));

app.use((err, req, res, next) => {
  console.error(err.message);
  res.status(err.message === "Origin not allowed" ? 403 : 500).json({ message: err.message === "Origin not allowed" ? err.message : "Server error" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════════════╗`);
  console.log(`║  🚀 AKARSHAN AI SERVER v4.0 READY   ║`);
  console.log(`║  Port: ${String(PORT).padEnd(30)}║`);
  console.log(`║  ML: benchmark + sentiment + A/B    ║`);
  console.log(`╚══════════════════════════════════════╝\n`);
});
