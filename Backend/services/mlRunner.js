// Runs ml_artifacts/inference.py. Keeps ONE long-lived python process (loads numpy/scipy/sklearn
// and the sentiment model once) instead of spawning a fresh interpreter for every request, which
// made the ML report take several seconds. Falls back to one-shot spawn if the worker can't run.
const { spawn } = require("child_process");
const path = require("path");

const SCRIPT = path.join(__dirname, "../ml_artifacts/inference.py");
const PYTHON = process.env.PYTHON_BIN || (process.platform === "win32" ? "python" : "python3");
const TIMEOUT_MS = 30000;
const CACHE_TTL_MS = 20000;

// ---- one-shot fallback ----
function runOnce(input) {
  return new Promise((resolve, reject) => {
    const py = spawn(PYTHON, [SCRIPT, JSON.stringify(input)]);
    let out = "", err = "";
    const timer = setTimeout(() => { py.kill(); reject(new Error("ML timed out")); }, TIMEOUT_MS);
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

// ---- persistent worker ----
let worker = null, buf = "", nextId = 1, workerBroken = false;
const pending = new Map();

function failAll(err) { for (const [, p] of pending) { clearTimeout(p.timer); p.reject(err); } pending.clear(); }

function startWorker() {
  if (worker || workerBroken) return worker;
  const py = spawn(PYTHON, [SCRIPT, "--serve"], { stdio: ["pipe", "pipe", "pipe"] });
  worker = py; buf = "";
  py.stdout.on("data", chunk => {
    buf += chunk;
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line) continue;
      let msg; try { msg = JSON.parse(line); } catch { continue; }
      if (msg.ready) continue;
      const p = pending.get(msg.id);
      if (p) { clearTimeout(p.timer); pending.delete(msg.id); p.resolve(msg.result); }
    }
  });
  py.stderr.on("data", () => {});
  py.stdin.on("error", () => {});
  const died = (e) => { if (worker === py) { worker = null; failAll(e || new Error("ML worker stopped")); } };
  py.on("error", e => { workerBroken = true; died(new Error(`Could not start "${PYTHON}": ${e.message}`)); });
  py.on("close", () => died());
  return py;
}

function runWorker(input) {
  return new Promise((resolve, reject) => {
    const py = startWorker();
    if (!py) return reject(new Error("worker unavailable"));
    const id = nextId++;
    const timer = setTimeout(() => { pending.delete(id); try { py.kill(); } catch {} reject(new Error("ML timed out")); }, TIMEOUT_MS);
    pending.set(id, { resolve, reject, timer });
    py.stdin.write(JSON.stringify({ id, input }) + "\n");
  });
}

// ---- public API: cache identical requests for a few seconds and share in-flight work ----
const cache = new Map();   // key -> { at, promise }
function runML(input) {
  const key = JSON.stringify(input);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < (input.mode === "insights" ? 10 * 60000 : CACHE_TTL_MS)) return hit.promise;
  const promise = runWorker(input).catch(() => runOnce(input));
  cache.set(key, { at: Date.now(), promise });
  promise.catch(() => cache.delete(key));
  if (cache.size > 200) for (const k of cache.keys()) { cache.delete(k); if (cache.size <= 100) break; }
  return promise;
}

// Warm the worker at boot so the first report is fast too.
function warmUp() { try { startWorker(); } catch {} }
function stop() { try { worker && worker.kill(); } catch {} worker = null; }
process.on("exit", stop);

module.exports = { runML, warmUp, stop };
