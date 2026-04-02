const AWS = require("aws-sdk");
const { AWS: AWSConfig } = require("../config/config");

// Configure AWS
AWS.config.update({
  accessKeyId: AWSConfig.accessKey,
  secretAccessKey: AWSConfig.secretKey,
  region: AWSConfig.region,
});

const s3 = new AWS.S3();

// Upload function
const uploadFile = async (file) => {
  const params = {
    Bucket: AWSConfig.bucket,
    Key: Date.now() + "_" + file.originalname, // unique file name
    Body: file.buffer,
    ContentType: file.mimetype,
  };

  const upload = await s3.upload(params).promise();

  return upload.Location; // URL of uploaded file
};

module.exports = { uploadFile };