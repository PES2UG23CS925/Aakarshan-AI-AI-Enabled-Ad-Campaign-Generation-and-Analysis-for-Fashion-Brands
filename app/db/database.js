const { Sequelize } = require("sequelize");
const { DB } = require("../config/config");

const sequelize = new Sequelize(DB.name, DB.user, DB.pass, {
  host: DB.host,
  dialect: "postgres",
});

module.exports = sequelize;