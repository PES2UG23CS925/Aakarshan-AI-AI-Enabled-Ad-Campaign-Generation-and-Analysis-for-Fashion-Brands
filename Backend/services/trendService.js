// Live fashion-trend feed.
// Source: Google News RSS (public, no API key). Headlines are scored with the SAME
// TF-IDF + Logistic Regression sentiment model used for viewer comments (inference.py),
// and keyword frequencies give the "trending themes" that can be injected into the ad prompt.
// Results are cached (default 30 min) and fall back to a labelled offline snapshot if the
// network is unavailable, so the app never breaks because a news feed is down.
const fetch = require("node-fetch");
const { spawn } = require("child_process");
const path = require("path");

const SCRIPT = path.join(__dirname, "../ml_artifacts/inference.py");
const PYTHON = process.env.PYTHON_BIN || (process.platform === "win32" ? "python" : "python3");
const TTL_MS = Number(process.env.TREND_CACHE_MINUTES || 30) * 60 * 1000;
const cache = new Map(); // key -> { at, data }

const STOP = new Set(("the a an and or of to in on for with from by at as is are was were be been it its this that these those " +
  "new how what why who you your our we they their his her he she more most best top latest news says say said after over " +
  "into out up down about than just not no can will may could should would also vs fashion fashions style styles trend trends " +
  "trending week weeks month year years 2024 2025 2026 2027 2028 guide here now get gets set sets amid").split(" "));

const FALLBACK_HEADLINES = [
  "Quiet luxury and neutral tones dominate this season's collections",
  "Oversized tailoring returns to the runway with relaxed silhouettes",
  "Sustainable fabrics and recycled denim gain popularity among Gen Z shoppers",
  "Vintage and thrifted fashion keeps growing as resale platforms expand",
  "Athleisure blends with streetwear in comfortable everyday outfits",
  "Bold colour blocking and statement accessories are back for the festive season",
  "Shoppers complain about fast fashion quality and rising prices",
  "Designers celebrate handcrafted textiles and regional weaves",
];

function decode(s) {
  return String(s || "")
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ").trim();
}

// Pull <item><title> out of an RSS document (no XML dependency needed for this simple structure).
function parseRssTitles(xml, limit = 25) {
  const titles = [];
  const items = String(xml || "").match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  for (const it of items) {
    const m = it.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (!m) continue;
    let t = decode(m[1]);
    t = t.replace(/\s+-\s+[^-]{2,40}$/, "");        // strip trailing " - Publisher"
    if (t.length > 15 && !titles.includes(t)) titles.push(t);
    if (titles.length >= limit) break;
  }
  return titles;
}

function topKeywords(titles, n = 8) {
  const freq = new Map();
  for (const t of titles) {
    const seen = new Set();
    for (const w of t.toLowerCase().replace(/[^a-z' -]/g, " ").split(/\s+/)) {
      const word = w.replace(/^'+|'+$/g, "");
      if (word.length < 4 || STOP.has(word) || seen.has(word)) continue;
      seen.add(word);
      freq.set(word, (freq.get(word) || 0) + 1);
    }
  }
  return [...freq.entries()].filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n).map(([word, count]) => ({ word, count }));
}

function runSentiment(texts) {
  return new Promise((resolve, reject) => {
    const py = spawn(PYTHON, [SCRIPT, JSON.stringify({ mode: "sentiment", texts })]);
    let out = "", err = "";
    const timer = setTimeout(() => { py.kill(); reject(new Error("sentiment timed out")); }, 20000);
    py.on("error", e => { clearTimeout(timer); reject(e); });
    py.stdout.on("data", d => (out += d)); py.stderr.on("data", d => (err += d));
    py.on("close", () => { clearTimeout(timer); try { resolve(JSON.parse(out).results); } catch { reject(new Error(err.slice(0, 200) || "bad sentiment output")); } });
  });
}

function summarise(titles, results) {
  const counts = { Positive: 0, Neutral: 0, Negative: 0 };
  const headlines = titles.map((t, i) => {
    const r = results[i] || { label: "Neutral", confidence: 0, score: 0 };
    counts[r.label] = (counts[r.label] || 0) + 1;
    return { title: t, sentiment: r.label, confidence: r.confidence };
  });
  const n = Math.max(1, titles.length);
  const pct = k => Math.round((counts[k] || 0) / n * 100);
  return { headlines, sentiment: { positive: pct("Positive"), neutral: pct("Neutral"), negative: pct("Negative"), n: titles.length } };
}

async function fetchTitles(query) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-IN&gl=IN&ceid=IN:en`;
  const res = await fetch(url, { timeout: 8000, headers: { "User-Agent": "AakarshanAI/1.0 (+student project)" } });
  if (!res.ok) throw new Error(`news feed ${res.status}`);
  return parseRssTitles(await res.text());
}

// getTrends("Streetwear") -> { category, source, fetched_at, keywords[], sentiment{}, headlines[] }
async function getTrends(category = "") {
  const cat = String(category || "").trim().slice(0, 40);
  const key = cat.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return { ...hit.data, cached: true };

  let titles = [], source = "google-news-rss";
  try {
    titles = await fetchTitles(`${cat} fashion trends`.trim());
    if (titles.length < 3) throw new Error("too few headlines");
  } catch (e) {
    console.warn("[Trends] live feed unavailable, using offline snapshot:", e.message);
    titles = FALLBACK_HEADLINES; source = "offline-snapshot";
  }
  let results = [];
  try { results = await runSentiment(titles); } catch (e) { console.warn("[Trends] sentiment unavailable:", e.message); }
  const data = { category: cat || "General", source, fetched_at: new Date().toISOString(), keywords: topKeywords(titles), ...summarise(titles, results) };
  if (source === "google-news-rss") cache.set(key, { at: Date.now(), data });
  return { ...data, cached: false };
}

// One short line for the LLM prompt, e.g. "oversized, denim, sustainable (headline mood: 62% positive)"
function trendPromptLine(t) {
  if (!t || !t.keywords || !t.keywords.length) return "";
  return `Currently trending themes in fashion news: ${t.keywords.slice(0, 5).map(k => k.word).join(", ")}` +
    ` (overall headline mood ${t.sentiment.positive}% positive). Work one or two naturally into the copy if they fit the brand; never invent facts.`;
}

module.exports = { getTrends, parseRssTitles, topKeywords, trendPromptLine, _clearCache: () => cache.clear() };
