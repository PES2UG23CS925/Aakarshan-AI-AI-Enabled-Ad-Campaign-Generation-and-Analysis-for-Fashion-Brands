const express = require("express");
const router = express.Router();
const supabase = require("../supabaseClient");
const authMiddleware = require("../middleware/authMiddleware");

// Generate and save a new campaign
router.post("/generate", authMiddleware, async (req, res) => {
  try {
    const { brandName, category, audience, platform, prompt } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!brandName || !category || !audience || !platform) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Generate campaign content
    const headline = `🔥 ${brandName} launches new ${category} collection!`;
    const adCopy = `Discover premium ${category} designed for ${audience}.`;
    const cta = "Shop Now";

    // Insert campaign into Supabase
    const { data: campaign, error } = await supabase
      .from("campaigns")
      .insert([
        {
          user_id: userId,
          brand_name: brandName,
          category,
          target_audience: audience,
          platform,
          prompt: prompt || "",
          headline,
          ad_copy: adCopy,
          cta,
          status: "draft",
        },
      ])
      .select();

    if (error) {
      return res.status(400).json({ message: error.message });
    }

    // Log AI generation
    await supabase.from("ai_generations").insert([
      {
        user_id: userId,
        campaign_id: campaign[0].id,
        prompt: prompt || `${brandName} - ${category}`,
        model_used: "gpt-4",
        tokens_used: 150,
        status: "success",
      },
    ]);

    res.json({
      message: "Campaign generated successfully",
      campaign: campaign[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get all campaigns for a user
router.get("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: campaigns, error } = await supabase
      .from("campaigns")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      return res.status(400).json({ message: error.message });
    }

    res.json({
      message: "Campaigns retrieved successfully",
      campaigns,
      count: campaigns.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get a specific campaign
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const { data: campaign, error } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (error) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    res.json({
      message: "Campaign retrieved successfully",
      campaign,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Update a campaign
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { headline, ad_copy, cta, status } = req.body;

    const { data: campaign, error } = await supabase
      .from("campaigns")
      .update({ headline, ad_copy, cta, status })
      .eq("id", id)
      .eq("user_id", userId)
      .select();

    if (error) {
      return res.status(400).json({ message: error.message });
    }

    res.json({
      message: "Campaign updated successfully",
      campaign: campaign[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Delete a campaign
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const { error } = await supabase
      .from("campaigns")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      return res.status(400).json({ message: error.message });
    }

    res.json({ message: "Campaign deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
