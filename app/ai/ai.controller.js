const { generateAdText } = require("./ai.service");
const Campaign = require("../models/campaign.model");
const AIAd = require("../models/aiAds.model");

const generateAd = async (req, res) => {
  try {
    const { campaignId } = req.body;

    const campaign = await Campaign.findByPk(campaignId);

    if (!campaign) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    const adText = await generateAdText(campaign);

    // Save to DB
    const ad = await AIAd.create({
      campaign_id: campaignId,
      generated_text: adText
    });

    res.json({ ad });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { generateAd };