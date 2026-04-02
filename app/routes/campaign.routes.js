const express = require("express");
const router = express.Router();
const controller = require("../controllers/campaign.controller");

router.post("/campaigns", controller.create);
router.get("/campaigns", controller.getAll);
router.get("/campaigns/:id", controller.getOne);
router.put("/campaigns/:id", controller.update);
router.delete("/campaigns/:id", controller.delete);

module.exports = router;