const express = require("express");
const router = express.Router();
const { generateAd } = require("./ai.controller");

router.post("/generate-ad", generateAd);

module.exports = router;