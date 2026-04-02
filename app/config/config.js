require("dotenv").config();

module.exports = {
  DB: {
    name: process.env.DB_NAME,
    user: process.env.DB_USER,
    pass: process.env.DB_PASS,
    host: process.env.DB_HOST,
  },
  AWS: {
    accessKey: process.env.AWS_ACCESS_KEY,
    secretKey: process.env.AWS_SECRET_KEY,
    bucket: process.env.BUCKET_NAME,
    region: process.env.REGION,
  },
};