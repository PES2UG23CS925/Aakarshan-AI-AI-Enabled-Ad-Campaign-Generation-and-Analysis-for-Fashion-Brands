const { DataTypes } = require("sequelize");
const sequelize = require("../db/database");

const CampaignImage = sequelize.define("CampaignImage", {
  campaign_id: DataTypes.INTEGER,
  image_url: DataTypes.TEXT,
});

module.exports = CampaignImage;