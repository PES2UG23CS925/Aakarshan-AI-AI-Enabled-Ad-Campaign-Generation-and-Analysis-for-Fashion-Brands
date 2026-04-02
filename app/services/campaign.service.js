const Campaign = require("../models/campaign.model");

exports.createCampaign = async (data) => {
  return await Campaign.create(data);
};

exports.getCampaigns = async () => {
  return await Campaign.findAll();
};

exports.getCampaign = async (id) => {
  return await Campaign.findByPk(id);
};

exports.updateCampaign = async (id, data) => {
  const campaign = await Campaign.findByPk(id);
  if (!campaign) return null;

  return await campaign.update(data);
};

exports.deleteCampaign = async (id) => {
  const campaign = await Campaign.findByPk(id);
  if (!campaign) return false;

  await campaign.destroy();
  return true;
};