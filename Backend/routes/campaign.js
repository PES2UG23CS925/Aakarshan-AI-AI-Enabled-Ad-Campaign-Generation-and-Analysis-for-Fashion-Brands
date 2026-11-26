const express  = require("express");
const router   = express.Router();
const crypto   = require("crypto");
const supabase = require("../supabaseClient");
const auth     = require("../middleware/authMiddleware");
const { generateAdCopy }    = require("../services/groqService");
const { generateAdVariants } = require("../services/imageService");
const { getTrends, trendPromptLine } = require("../services/trendService");

// Deterministic variant for a visitor: same person always sees the same ad, and the split is even.
function variantFor(visitorId, n) {
  if (!n || n < 2) return null;
  return crypto.createHash("sha1").update(String(visitorId)).digest().readUInt32BE(0) % n;
}

// POST /api/campaign/generate
router.post("/generate", auth, async (req, res) => {
  const t0 = Date.now();
  try {
    const { brandName, category, audience, platform, prompt, useTrends } = req.body;
    if (!brandName || !category || !audience || !platform)
      return res.status(400).json({ message: "All fields required" });

    // Step 0 (optional): pull live fashion-news trends and feed them into the prompt
    let trendLine = "", trendsUsed = [];
    if (useTrends) {
      try {
        const t = await getTrends(category);
        trendLine = trendPromptLine(t);
        trendsUsed = (t.keywords || []).slice(0, 5).map(k => k.word);
      } catch (e) { console.warn("[Trends skipped]:", e.message); }
    }

    // Step 1: Generate ad copy via Groq
    const tCopy = Date.now();
    let headline, adCopy, cta, hashtags, tokensUsed, modelUsed;
    try {
      const ai = await generateAdCopy({ brandName, category, audience, platform, extraPrompt: [prompt, trendLine].filter(Boolean).join("\n") });
      ({ headline, adCopy, cta, hashtags, tokensUsed, modelUsed } = ai);
    } catch (e) {
      console.error("[Groq fallback]:", e.message);
      headline   = `${brandName} — New ${category} Collection`;
      adCopy     = `Premium ${category} designed for ${audience}. ${prompt || ""}`.trim();
      cta        = "Shop Now";
      hashtags   = [brandName, category, "Fashion", "NewIn"].map(t => "#" + String(t).replace(/[^\p{L}\p{N}]/gu, "")).filter(t => t.length > 1);
      modelUsed  = "fallback";
      tokensUsed = 0;
    }

    const copyMs = Date.now() - tCopy;

    // Step 2: Insert row to get a campaign ID
    const { data: inserted, error: insertErr } = await supabase
      .from("campaigns")
      .insert([{
        user_id:           req.user.id,
        brand_name:        brandName,
        category,
        target_audience:   audience,
        platform,
        prompt:            prompt || "",
        headline,
        ad_copy:           adCopy,
        cta,
        hashtags:          hashtags || [],
        image_url:         null,
        status:            "active",
        performance_score: null,
        performance_tier:  null,
        views:             0,
        likes:             0,
        shares:            0,
        comments:          0,
        clicks:            0,
      }])
      .select()
      .single();

    if (insertErr) return res.status(400).json({ message: insertErr.message });
    const campaignId = inserted.id;

    // Step 3: Generate 3 ad image variants (in parallel) so the user can pick the best one.
    // image_url stays null on the campaign row until the user selects a variant
    // (see POST /:id/select-image below).
    let images = [];
    const tImg = Date.now();
    try {
      images = await generateAdVariants(adCopy, brandName, category, platform, audience, headline, {
        cta, hashtags: hashtags || [], campaignId,
      }, 3);
    } catch (e) {
      console.error("[Image generation error]:", e.message);
    }

    res.json({
      message:  "Campaign generated successfully",
      campaign: { ...inserted, image_url: null },
      images,
      ai_info:  { text_model: modelUsed, image_generated: images.length > 0, images_generated: images.length, tokens_used: tokensUsed, generation_time_ms: Date.now() - t0, copy_ms: copyMs, image_ms: Date.now() - tImg, trends_used: trendsUsed },
    });
  } catch (err) {
    console.error("[/generate]:", err.message);
    res.status(500).json({ message: "Generation failed", detail: err.message });
  }
});

// POST /api/campaign/:id/select-image — user picks their favourite of the 3 generated ads
router.post("/:id/select-image", auth, async (req, res) => {
  try {
    const { imageUrl } = req.body;
    if (!imageUrl) return res.status(400).json({ message: "imageUrl is required" });

    const { data, error } = await supabase
      .from("campaigns")
      .update({ image_url: imageUrl, variants: [] })
      .eq("id", req.params.id)
      .eq("user_id", req.user.id)
      .select()
      .single();

    if (error) return res.status(400).json({ message: error.message });
    res.json({ message: "Image selected", campaign: data });
  } catch (err) {
    res.status(500).json({ message: "Server error", detail: err.message });
  }
});

// POST /api/campaign/:id/start-ab — publish 2-4 variants; visitors are split evenly between them
router.post("/:id/start-ab", auth, async (req, res) => {
  try {
    const { variants } = req.body || {};
    const base = process.env.SUPABASE_URL || "";
    if (!Array.isArray(variants) || variants.length < 2 || variants.length > 4)
      return res.status(400).json({ message: "Provide 2-4 variant image URLs" });
    if (!variants.every(u => typeof u === "string" && u.startsWith(base) && u.length < 600))
      return res.status(400).json({ message: "Variant URLs must be images from your storage" });

    const { data, error } = await supabase.from("campaigns")
      .update({ variants, image_url: variants[0] })
      .eq("id", req.params.id).eq("user_id", req.user.id).select().single();
    if (error || !data) return res.status(404).json({ message: "Campaign not found" });
    res.json({ message: "A/B test started", campaign: data });
  } catch (err) { res.status(500).json({ message: "Server error", detail: err.message }); }
});

// GET /api/campaign
router.get("/", auth, async (req, res) => {
  try {
    const { data, error } = await supabase.from("campaigns").select("*")
      .eq("user_id", req.user.id).order("created_at", { ascending: false });
    if (error) return res.status(400).json({ message: error.message });
    res.json({ campaigns: data, count: data.length });
  } catch (err) { res.status(500).json({ message: "Server error" }); }
});

// GET /api/campaign/public/:id?visitor=<id> — no auth. Only public display fields.
// For A/B campaigns the visitor is assigned one variant and only that image is returned.
router.get("/public/:id", async (req, res) => {
  try {
    const { data, error } = await supabase.from("campaigns")
      .select("id, brand_name, platform, headline, ad_copy, cta, hashtags, image_url, variants")
      .eq("id", req.params.id).single();
    if (error || !data) return res.status(404).json({ message: "Not found" });
    const vs = Array.isArray(data.variants) ? data.variants : [];
    const { variants, ...pub } = data;

    // Preview mode: force one specific variant to view/demo it (e.g. for your reviewers).
    // Preview never touches real stats — the frontend must not send events while previewing.
    if (req.query.preview === "1") {
      const forced = parseInt(req.query.v, 10);
      if (vs.length && Number.isInteger(forced) && forced >= 0 && forced < vs.length) {
        pub.image_url = vs[forced];
        res.set("Cache-Control", "no-store");
        return res.json({ campaign: pub, variant: forced, preview: true });
      }
      return res.status(400).json({ message: "Invalid preview variant" });
    }

    // Pinned link (?v=N): this exact link always shows variant N and its stats count toward N,
    // so each variant can be shared on its own. Without it, visitors are split by their visitor id.
    const pinned = parseInt(req.query.v, 10);
    const idx = Number.isInteger(pinned) && pinned >= 0 && pinned < vs.length
      ? pinned : variantFor(req.query.visitor || "", vs.length);
    if (idx !== null) pub.image_url = vs[idx];
    res.set("Cache-Control", "no-store");
    res.json({ campaign: pub, variant: idx });
  } catch (err) { res.status(500).json({ message: "Server error" }); }
});

// POST /api/campaign/public/:id/event — no auth. Records ONE real viewer action.
// body: { type: view|like|share|comment|click, visitorId, text? }
// De-duplication, rate limits and the counter update happen atomically inside
// Postgres (record_ad_event, see supabase_migration.sql), so refreshes, double
// clicks and concurrent visitors can no longer corrupt the numbers.
const EVENT_TYPES = ["view", "like", "share", "comment", "click"];
router.post("/public/:id/event", async (req, res) => {
  try {
    const { type, visitorId, text, variant: pinnedVariant } = req.body || {};
    if (!EVENT_TYPES.includes(type)) return res.status(400).json({ message: "Invalid event type" });
    if (typeof visitorId !== "string" || visitorId.length < 8 || visitorId.length > 64)
      return res.status(400).json({ message: "Invalid visitorId" });

    // variant is computed here from the visitor id (never trusted from the client)
    const { data: camp } = await supabase.from("campaigns").select("variants").eq("id", req.params.id).single();
    if (!camp) return res.status(404).json({ message: "not_found" });
    const nVariants = Array.isArray(camp.variants) ? camp.variants.length : 0;
    // A pinned variant link may name its variant (validated against the real range); otherwise hash the visitor.
    const variant = Number.isInteger(pinnedVariant) && pinnedVariant >= 0 && pinnedVariant < nVariants
      ? pinnedVariant : variantFor(visitorId, nVariants);

    const { data, error } = await supabase.rpc("record_ad_event", {
      p_campaign_id: String(req.params.id),
      p_type: type,
      p_visitor: visitorId,
      p_text: type === "comment" ? String(text || "").slice(0, 500) : null,
      p_variant: variant,
    });
    if (error) {
      console.error("[record_ad_event]", error.message);
      return res.status(500).json({ message: "Could not record event", detail: error.message });
    }
    if (!data?.ok) return res.status(data?.error === "not_found" ? 404 : 400).json({ message: data?.error });
    res.set("Cache-Control", "no-store");
    res.json(data);
  } catch (err) { res.status(500).json({ message: "Server error" }); }
});

// GET /api/campaign/:id
router.get("/:id", auth, async (req, res) => {
  try {
    const { data, error } = await supabase.from("campaigns").select("*")
      .eq("id", req.params.id).eq("user_id", req.user.id).single();
    if (error) return res.status(404).json({ message: "Not found" });
    res.json({ campaign: data });
  } catch (err) { res.status(500).json({ message: "Server error" }); }
});

// DELETE /api/campaign/:id
router.delete("/:id", auth, async (req, res) => {
  try {
    const { error } = await supabase.from("campaigns").delete()
      .eq("id", req.params.id).eq("user_id", req.user.id);
    if (error) return res.status(400).json({ message: error.message });
    res.json({ message: "Campaign deleted" });
  } catch (err) { res.status(500).json({ message: "Server error" }); }
});

module.exports = router;
