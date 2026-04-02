const { DataTypes } = require("sequelize");
const sequelize = require("../db/database");

const AIAd = sequelize.define("AIAd", {
  campaign_id: DataTypes.INTEGER,
  generated_text: DataTypes.TEXT,
  image_url: DataTypes.TEXT,
});

module.exports = AIAd;