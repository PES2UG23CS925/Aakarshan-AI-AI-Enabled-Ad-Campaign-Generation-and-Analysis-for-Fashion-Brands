const { DataTypes } = require("sequelize");
const sequelize = require("../db/database");

const Campaign = sequelize.define("Campaign", {
  title: DataTypes.STRING,
  description: DataTypes.TEXT,
  status: DataTypes.STRING,
  budget: DataTypes.FLOAT,
  start_date: DataTypes.DATE,
  end_date: DataTypes.DATE,
  user_id: DataTypes.INTEGER,
});

module.exports = Campaign;