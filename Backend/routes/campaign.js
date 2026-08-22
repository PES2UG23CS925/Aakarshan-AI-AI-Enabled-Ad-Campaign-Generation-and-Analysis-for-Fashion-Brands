const express  = require("express");
const router   = express.Router();
const supabase = require("../supabaseClient");
const auth     = require("../middleware/authMiddleware");
const { generateAdCopy } = require("../services/groqService");
const { generateImages } = require("../services/imageService");

// POST /api/campaign/generate
router.post("/generate", auth, async (req, res) => {
  const t0 = Date.now();
  try {
    const { brandName, category, audience, platform, prompt } = req.body;
    if (!brandName || !category || !audience || !platform)
      return res.status(400).json({ message: "All fields required" });

    // Step 1: Generate ad copy via Groq/LLaMA
    let headline, adCopy, cta, hashtags, imagePrompt, tokensUsed, modelUsed;
    try {
      const ai = await generateAdCopy({ brandName, category, audience, platform, extraPrompt: prompt });
      ({ headline, adCopy, cta, hashtags, imagePrompt, tokensUsed, modelUsed } = ai);
    } catch (e) {
      console.error("[Groq fallback]:", e.message);
      headline   = `${brandName} — New ${category} Collection`;
      adCopy     = `Premium ${category} designed for ${audience}. ${prompt || ""}`.trim();
      cta        = "Shop Now";
      hashtags   = [];
      modelUsed  = "fallback";
      tokensUsed = 0;
    }

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
        image_urls:        [],
        status:            "active",
        performance_score: null,
        performance_tier:  null,
        views:             0,
        likes:             0,
        shares:            0,
        comments:          0,
      }])
      .select()
      .single();

    if (insertErr) return res.status(400).json({ message: insertErr.message });
    const campaignId = inserted.id;

    // Step 3: Generate 4 composited image variants & upload (in parallel)
    let imageUrls = [];
    try {
      imageUrls = await generateImages(adCopy, brandName, category, platform, audience, headline, {
        cta, hashtags: hashtags || [], campaignId, imagePrompt,
      }, 3);
      // Default image_url to the first variant until the client picks one
      await supabase.from("campaigns")
        .update({ image_url: imageUrls[0] || null, image_urls: imageUrls })
        .eq("id", campaignId);
    } catch (e) {
      console.error("[Image generation error]:", e.message);
    }

    res.json({
      message:  "Campaign generated successfully",
      campaign: { ...inserted, image_url: imageUrls[0] || null, image_urls: imageUrls },
      ai_info:  { text_model: modelUsed, image_generated: imageUrls.length > 0, images_generated: imageUrls.length, tokens_used: tokensUsed, generation_time_ms: Date.now() - t0 },
    });
  } catch (err) {
    console.error("[/generate]:", err.message);
    res.status(500).json({ message: "Generation failed", detail: err.message });
  }
});

// PATCH /api/campaign/:id/select-image  { imageUrl }
// Lets the client pick which of the generated variants (image_urls) becomes
// the campaign's final image_url.
router.patch("/:id/select-image", auth, async (req, res) => {
  try {
    const { imageUrl } = req.body;
    if (!imageUrl) return res.status(400).json({ message: "imageUrl is required" });

    const { data: c, error: findErr } = await supabase
      .from("campaigns").select("*")
      .eq("id", req.params.id).eq("user_id", req.user.id).single();
    if (findErr || !c) return res.status(404).json({ message: "Not found" });

    const candidates = Array.isArray(c.image_urls) ? c.image_urls : [];
    if (candidates.length > 0 && !candidates.includes(imageUrl)) {
      return res.status(400).json({ message: "imageUrl is not one of this campaign's generated variants" });
    }

    const { data: updated, error: updateErr } = await supabase
      .from("campaigns").update({ image_url: imageUrl })
      .eq("id", req.params.id).eq("user_id", req.user.id)
      .select().single();
    if (updateErr) return res.status(400).json({ message: updateErr.message });

    res.json({ message: "Image selected", campaign: updated });
  } catch (err) { res.status(500).json({ message: "Server error" }); }
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

// GET /api/campaign/public/:id — no auth
router.get("/public/:id", async (req, res) => {
  try {
    const { data, error } = await supabase.from("campaigns").select("*").eq("id", req.params.id).single();
    if (error) return res.status(404).json({ message: "Not found" });
    res.json({ campaign: data });
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

// POST /api/campaign/:id/simulate
router.post("/:id/simulate", async (req, res) => {
  try {
    const { data: c, error } = await supabase.from("campaigns").select("*").eq("id", req.params.id).single();
    if (error) return res.status(404).json({ message: "Not found" });
    const u = {
      views:    (c.views    || 0) + 1,
      likes:    (c.likes    || 0) + (Math.random() < 0.35 ? 1 : 0),
      shares:   (c.shares   || 0) + (Math.random() < 0.12 ? 1 : 0),
      comments: (c.comments || 0) + (Math.random() < 0.08 ? 1 : 0),
    };
    await supabase.from("campaigns").update(u).eq("id", req.params.id);
    res.json({ message: "Engagement recorded", ...u });
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
