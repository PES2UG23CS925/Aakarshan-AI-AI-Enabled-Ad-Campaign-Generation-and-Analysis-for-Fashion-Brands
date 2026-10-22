#!/usr/bin/env node
/*
 * Simulates many INDEPENDENT visitors hitting your public ad link, so an A/B
 * test (or a single campaign) has a believable spread of data to show in a
 * demo/viva. This is for demoing your own project locally - it is fake traffic,
 * not a claim about real ad performance. Never point it at someone else's
 * campaign or a production deployment.
 *
 * What it does, per simulated visitor:
 *   1. GET  /api/campaign/public/:id?visitor=<random-id>   (assigns a variant, like a real browser)
 *   2. POST .../event  type=view                            (always)
 *   3. POST .../event  type=like|share|comment|click         (each with its own probability)
 * Comments are picked from a small pool of realistic fashion-ad reactions and
 * sent to a random Positive/Negative/Neutral bucket, so the sentiment panel
 * on the report page also has something to show.
 *
 * Usage:
 *   node scripts/simulate_demo_traffic.js <campaignId> [visitors] [apiBase]
 *   node scripts/simulate_demo_traffic.js 3f9c... 150
 *   node scripts/simulate_demo_traffic.js 3f9c... 150 http://localhost:5000
 */
const campaignId = process.argv[2];
const N = parseInt(process.argv[3] || "150", 10);
const BASE = process.argv[4] || "http://localhost:5000";

if (!campaignId) {
  console.error("Usage: node scripts/simulate_demo_traffic.js <campaignId> [visitors] [apiBase]");
  process.exit(1);
}

const COMMENTS = [
  "Love this look, so stylish!", "Absolutely gorgeous, need this",
  "Great quality for the price", "This is fire, ordering now",
  "Not a fan of the colour", "Too expensive for what it is",
  "Looks cheap tbh", "Does it come in other sizes?",
  "Is this available in Bangalore?", "When does the sale start?",
];

const rand = (p) => Math.random() < p;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Retries once on a rate-limit (429) instead of silently miscounting the result.
async function fetchJSON(url, opts, retries = 4) {
  for (let i = 0; i <= retries; i++) {
    const res = await fetch(url, opts);
    if (res.status === 429) { await wait(2000); continue; }
    return res.json();
  }
  throw new Error(`Rate-limited too many times on ${url}. Is the server's public rate limit unusually strict?`);
}

const post = (id, type, visitorId, text) =>
  fetchJSON(`${BASE}/api/campaign/public/${id}/event`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, visitorId, text }),
  });

async function main() {
  console.log(`Simulating ${N} independent visitors for campaign ${campaignId} against ${BASE} ...`);
  const tally = {};
  for (let i = 0; i < N; i++) {
    const visitorId = `sim-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`;
    const view = await fetchJSON(`${BASE}/api/campaign/public/${campaignId}?visitor=${visitorId}`);
    if (view.message === "Not found") { console.error("Campaign not found — check the id."); process.exit(1); }
    tally[view.variant] = (tally[view.variant] || 0) + 1;

    await post(campaignId, "view", visitorId);
    if (rand(0.35)) await post(campaignId, "like", visitorId);
    if (rand(0.10)) await post(campaignId, "share", visitorId);
    if (rand(0.15)) await post(campaignId, "click", visitorId);
    if (rand(0.12)) await post(campaignId, "comment", visitorId, pick(COMMENTS));

    if ((i + 1) % 25 === 0) console.log(`  ${i + 1}/${N} visitors simulated...`);
    await wait(15); // gentle pacing, stays well under the 120/min rate limit
  }
  console.log("\nDone. Visitors landed in each variant bucket:", tally);
  console.log("Refresh the report page to see the updated A/B panel.");
}

main().catch((e) => { console.error("Simulation failed:", e.message); process.exit(1); });
