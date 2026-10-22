const fetch = require("node-fetch");

const MODEL = "openai/gpt-oss-120b";

// Pull the first {...} block out of a response (handles ```json fences and stray prose)
function extractJson(text) {
  const clean = String(text || "").replace(/```json|```/gi, "").trim();
  const start = clean.indexOf("{"), end = clean.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("No JSON object in model response");
  return JSON.parse(clean.slice(start, end + 1));
}

function normalise(p) {
  const str = (v, max) => String(v || "").trim().slice(0, max);
  const headline = str(p.headline, 90), adCopy = str(p.adCopy, 500), cta = str(p.cta, 40);
  if (!headline || !adCopy) throw new Error("Model returned empty headline/adCopy");
  const hashtags = (Array.isArray(p.hashtags) ? p.hashtags : [])
    .map(h => "#" + String(h).replace(/[^\p{L}\p{N}_]/gu, "")).filter(h => h.length > 1).slice(0, 6);
  return { headline, adCopy, cta: cta || "Shop Now", hashtags };
}

async function generateAdCopy({ brandName, category, audience, platform, extraPrompt }) {
  const systemPrompt = "You are an expert fashion advertising copywriter. Write compelling, on-brand social ad copy. Respond with valid JSON only.";
  const userPrompt = `Create an ad campaign for:
Brand: ${brandName}
Category: ${category}
Target Audience: ${audience}
Platform: ${platform} (match its tone and conventions)
Extra Instructions: ${extraPrompt || "None"}

Respond ONLY with this JSON (no markdown, no extra text):
{
  "headline": "short punchy headline under 10 words",
  "adCopy": "engaging ad body text, 2-3 sentences, speaks directly to the audience",
  "cta": "call to action under 5 words",
  "hashtags": ["tag1", "tag2", "tag3", "tag4"]
}`;

  // Attempt 1: JSON mode + low reasoning effort + room for reasoning tokens.
  // Attempts 2-3: plain request (in case the API rejects the extra options), then one more retry.
  const attempts = [
    { response_format: { type: "json_object" }, reasoning_effort: "low", max_tokens: 2000 },
    { max_tokens: 2000 },
    { max_tokens: 2000 },
  ];
  let lastErr;
  for (let i = 0; i < attempts.length; i++) {
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
        body: JSON.stringify({
          model: MODEL,
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
          temperature: 0.7,
          ...attempts[i],
        }),
      });
      if (!response.ok) throw new Error(`Groq API ${response.status}: ${(await response.text()).slice(0, 200)}`);
      const data = await response.json();
      const parsed = normalise(extractJson(data.choices?.[0]?.message?.content));
      return { ...parsed, tokensUsed: data.usage?.total_tokens || 0, modelUsed: MODEL, attempts: i + 1 };
    } catch (e) {
      lastErr = e;
      if (/ 401| 403/.test(e.message)) break;        // bad key: retrying won't help
      await new Promise(r => setTimeout(r, 400 * (i + 1)));
    }
  }
  throw lastErr;
}

module.exports = { generateAdCopy, extractJson, normalise };
