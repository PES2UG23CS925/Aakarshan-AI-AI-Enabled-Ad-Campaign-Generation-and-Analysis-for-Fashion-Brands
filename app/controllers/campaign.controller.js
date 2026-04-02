const service = require("../services/campaign.service");

exports.create = async (req, res) => {
  const data = await service.createCampaign(req.body);
  res.json(data);
};

exports.getAll = async (req, res) => {
  res.json(await service.getCampaigns());
};

exports.getOne = async (req, res) => {
  res.json(await service.getCampaign(req.params.id));
};

exports.update = async (req, res) => {
  res.json(await service.updateCampaign(req.params.id, req.body));
};

exports.delete = async (req, res) => {
  res.json(await service.deleteCampaign(req.params.id));
};