const service = require("../services/campaign.service");

// ======================
// CREATE CAMPAIGN
// ======================
exports.create = async (req, res) => {
  try {
    const data = req.body;

    // Basic validation
    if (!data.title || !data.status || !data.user_id) {
      return res.status(400).json({
        error: "Title, status, and user_id are required",
      });
    }

    const campaign = await service.createCampaign(data);

    res.status(201).json({
      message: "Campaign created successfully",
      data: campaign,
    });

  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
};

// ======================
// GET ALL CAMPAIGNS
// ======================
exports.getAll = async (req, res) => {
  try {
    const campaigns = await service.getCampaigns();

    res.status(200).json({
      count: campaigns.length,
      data: campaigns,
    });

  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
};

// ======================
// GET SINGLE CAMPAIGN
// ======================
exports.getOne = async (req, res) => {
  try {
    const campaign = await service.getCampaign(req.params.id);

    if (!campaign) {
      return res.status(404).json({
        error: "Campaign not found",
      });
    }

    res.status(200).json(campaign);

  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
};

// ======================
// UPDATE CAMPAIGN
// ======================
exports.update = async (req, res) => {
  try {
    const updated = await service.updateCampaign(req.params.id, req.body);

    if (!updated) {
      return res.status(404).json({
        error: "Campaign not found",
      });
    }

    res.status(200).json({
      message: "Campaign updated successfully",
      data: updated,
    });

  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
};

// ======================
// DELETE CAMPAIGN
// ======================
exports.delete = async (req, res) => {
  try {
    const deleted = await service.deleteCampaign(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        error: "Campaign not found",
      });
    }

    res.status(200).json({
      message: "Campaign deleted successfully",
    });

  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
};