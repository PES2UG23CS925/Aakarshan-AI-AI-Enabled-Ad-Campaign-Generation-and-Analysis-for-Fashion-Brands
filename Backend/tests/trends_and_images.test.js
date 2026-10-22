// Tests for the live trend feed and the parallel image generator (all network calls mocked).
const Module = require("module");
const path = require("path");
const B = path.join(__dirname, "..") + "/";
process.env.SUPABASE_URL = "https://proj.supabase.co";

let pass = 0, fail = 0;
const ok = (n, c) => { console.log((c ? "PASS " : "FAIL ") + n); c ? pass++ : fail++; };

// ---- mocks: node-fetch (news + pollinations) and Supabase storage ----
const { createCanvas } = require(B + "node_modules/@napi-rs/canvas");
const c0 = createCanvas(200, 250); const cx = c0.getContext("2d"); cx.fillStyle = "#336"; cx.fillRect(0, 0, 200, 250);
const PNG = c0.toBuffer("image/png");

const RSS = `<?xml version="1.0"?><rss><channel><title>x</title>` + [
  "Oversized denim is the trend everyone loves - Vogue India",
  "Why oversized blazers are back and shoppers love them - Elle",
  "Sustainable denim brands are gaining popularity - Mint",
  "Streetwear fans complain about terrible quality and high prices - HT",
  "Sustainable fabrics, great comfort: the new wardrobe staples - TOI",
].map(t => `<item><title><![CDATA[${t}]]></title><link>http://x</link></item>`).join("") + `</channel></rss>`;

let fetchCalls = [], newsMode = "ok", imgDelay = 0, imgStatus = 200, inFlight = 0, maxInFlight = 0;
const mockFetch = async (url, opts = {}) => {
  fetchCalls.push({ url, opts });
  if (url.includes("news.google.com")) {
    if (newsMode === "down") throw new Error("ENOTFOUND");
    return { ok: true, status: 200, text: async () => RSS };
  }
  inFlight++; maxInFlight = Math.max(maxInFlight, inFlight);
  await new Promise(r => setTimeout(r, imgDelay)); inFlight--;
  return {
    ok: imgStatus === 200, status: imgStatus, text: async () => "denied",
    headers: { get: () => "image/png" }, arrayBuffer: async () => PNG.buffer.slice(PNG.byteOffset, PNG.byteOffset + PNG.length),
  };
};
let uploads = 0;
const fakeSupabase = { storage: { from: () => ({ upload: async () => { uploads++; return { error: null }; }, getPublicUrl: f => ({ data: { publicUrl: "https://proj.supabase.co/" + f } }) }) } };
const orig = Module._load;
Module._load = function (r) { if (r === "node-fetch") return mockFetch; if (/supabaseClient$/.test(r)) return fakeSupabase; return orig.apply(this, arguments); };

(async () => {
  const T = require(B + "services/trendService.js");

  // ---- RSS parsing + keywords ----
  const titles = T.parseRssTitles(RSS);
  ok("RSS: parses 5 headlines and strips the trailing publisher name", titles.length === 5 && titles[0] === "Oversized denim is the trend everyone loves");
  const kw = T.topKeywords(titles).map(k => k.word);
  ok(`keywords: repeated themes found (${kw.join(",")})`, kw.includes("denim") && kw.includes("oversized") && kw.includes("sustainable"));
  ok("keywords: single-occurrence words are not 'trends'", !kw.includes("vogue") && !kw.includes("blazers"));

  // ---- getTrends: live path, sentiment model, caching ----
  T._clearCache(); fetchCalls = [];
  let t = await T.getTrends("Streetwear");
  ok("getTrends: live source used", t.source === "google-news-rss" && t.headlines.length === 5);
  ok("getTrends: query includes the category", decodeURIComponent(fetchCalls[0].url).includes("Streetwear fashion trends"));
  ok("getTrends: every headline got a sentiment label from the ML model", t.headlines.every(h => ["Positive", "Neutral", "Negative"].includes(h.sentiment)));
  ok("getTrends: sentiment percentages sum to ~100", Math.abs(t.sentiment.positive + t.sentiment.neutral + t.sentiment.negative - 100) <= 2);
  const negHeadline = t.headlines.find(h => /terrible quality/.test(h.title));
  ok(`getTrends: clearly negative headline classified Negative (${negHeadline.sentiment})`, negHeadline.sentiment === "Negative");
  const before = fetchCalls.length; const t2 = await T.getTrends("streetwear");
  ok("getTrends: second call is served from cache (no extra fetch)", t2.cached === true && fetchCalls.length === before);

  // ---- fallback when the feed is down ----
  T._clearCache(); newsMode = "down";
  t = await T.getTrends("Denim");
  ok("getTrends: feed down -> labelled offline snapshot, no exception", t.source === "offline-snapshot" && t.headlines.length > 0 && t.keywords.length > 0);
  newsMode = "ok";
  const line = T.trendPromptLine({ keywords: [{ word: "denim", count: 3 }, { word: "oversized", count: 2 }], sentiment: { positive: 60 } });
  ok("trendPromptLine: builds a short prompt sentence", /denim, oversized/.test(line) && /60% positive/.test(line) && T.trendPromptLine(null) === "");

  // ---- parallel image generation ----
  const I = require(B + "services/imageService.js");
  const args = ["Fresh new drop.", "Brand", "Streetwear", "Instagram", "Gen Z men", "Own The Street", { cta: "Shop", hashtags: ["a"], campaignId: "c1" }];
  imgDelay = 250;

  process.env.POLLINATIONS_API_KEY = "sk_test"; maxInFlight = 0; uploads = 0; fetchCalls = [];
  let t0 = Date.now(); let imgs = await I.generateAdVariants(...args, 3);
  const withKey = Date.now() - t0;
  ok(`images (with key): 3 variants returned & uploaded`, imgs.length === 3 && uploads === 3);
  ok(`images (with key): rendered in parallel (max in flight ${maxInFlight}, ${withKey}ms)`, maxInFlight === 3);
  ok("images: request goes to gen.pollinations.ai with Bearer key", fetchCalls.every(c => c.url.startsWith("https://gen.pollinations.ai/image/") && c.opts.headers.Authorization === "Bearer sk_test"));
  const shots = fetchCalls.map(c => decodeURIComponent(c.url));
  ok("images: the 3 variants use 3 different shot styles", new Set(shots.map(u => (u.match(/Photorealistic[^.]*\./) || [""])[0])).size === 3);

  process.env.POLLINATIONS_API_KEY = ""; maxInFlight = 0; uploads = 0;
  t0 = Date.now(); imgs = await I.generateAdVariants(...args, 3);
  const noKey = Date.now() - t0;
  ok(`images (no key): stays sequential for the anonymous tier (max in flight ${maxInFlight})`, imgs.length === 3 && maxInFlight === 1);
  ok(`images: parallel mode is faster than sequential (${withKey}ms vs ${noKey}ms)`, withKey < noKey);

  process.env.POLLINATIONS_API_KEY = "sk_bad"; imgStatus = 401; fetchCalls = [];
  let err = null; try { await I.generateAdVariants(...args, 3); } catch (e) { err = e; }
  ok("images: bad key -> fails fast with a clear auth error, no retry storm", err && /auth failed \(401\)/.test(err.message) && fetchCalls.length <= 3);

  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
