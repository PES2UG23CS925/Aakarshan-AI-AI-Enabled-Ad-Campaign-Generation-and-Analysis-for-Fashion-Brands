const logBuffer = require("../services/logBuffer");

// Records method, path (without the query string, which can contain visitor ids), status and duration.
module.exports = function requestLogger(req, res, next) {
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const path = (req.originalUrl || req.url || "").split("?")[0];
    if (path === "/api/health") return;                     // keep the buffer useful
    logBuffer.push({
      level: res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info",
      method: req.method,
      path,
      status: res.statusCode,
      ms: Math.round(Number(process.hrtime.bigint() - start) / 1e6),
    });
  });
  next();
};
