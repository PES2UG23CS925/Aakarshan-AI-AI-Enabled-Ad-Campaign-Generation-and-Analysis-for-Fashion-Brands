// Small in-memory ring buffer of recent API requests and errors, shown on the admin "Logs" tab.
// It resets when the server restarts; it is a monitoring aid, not an audit trail.
const MAX = 300;
const entries = [];

function push(entry) {
  entries.push({ ts: new Date().toISOString(), ...entry });
  if (entries.length > MAX) entries.shift();
}

function recent(n = 100) {
  const k = Math.min(Math.max(parseInt(n) || 100, 1), MAX);
  return entries.slice(-k).reverse();
}

function clear() { entries.length = 0; }

module.exports = { push, recent, clear, MAX };
