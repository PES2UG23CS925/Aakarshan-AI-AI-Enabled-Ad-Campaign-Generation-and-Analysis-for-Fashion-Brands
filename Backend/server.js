require("dotenv").config();
const express = require("express");
const cors    = require("cors");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Routes
app.use("/api/auth",        require("./routes/auth"));
app.use("/api/campaign",    require("./routes/campaign"));
app.use("/api/performance", require("./routes/performance"));

app.get("/", (_, res) => res.json({ status: "ok", version: "3.0.0" }));
app.get("/api/health", (_, res) => res.json({ status: "healthy" }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.message);
  res.status(500).json({ message: "Server error", detail: err.message });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════════════╗`);
  console.log(`║  🚀 AKARSHAN AI SERVER v3.0 READY   ║`);
  console.log(`║  Port: ${PORT}                          ║`);
  console.log(`║  ML: RandomForest 89.9% accuracy    ║`);
  console.log(`╚══════════════════════════════════════╝\n`);
});
