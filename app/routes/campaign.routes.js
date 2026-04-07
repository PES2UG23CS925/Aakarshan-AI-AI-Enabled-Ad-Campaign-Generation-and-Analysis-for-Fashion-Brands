const express = require("express");
const router = express.Router();

const controller = require("../controllers/campaign.controller");
const upload = require("../utils/upload");
const cloudinary = require("../utils/cloudinary");

// =====================
// Campaign CRUD Routes
// =====================
router.post("/campaigns", controller.create);
router.get("/campaigns", controller.getAll);
router.get("/campaigns/:id", controller.getOne);
router.put("/campaigns/:id", controller.update);
router.delete("/campaigns/:id", controller.delete);

// =====================
// Image Upload Route
// =====================
router.post(
  "/upload-image",
  upload.single("image"),  // 👈 multer middleware
  async (req, res) => {
    try {
      console.log("FILE:", req.file); // ✅ correct place

      // ❌ If no file received
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // ✅ Upload to Cloudinary
      const stream = cloudinary.uploader.upload_stream(
        { folder: "campaigns" },
        (error, result) => {
          if (error) {
            return res.status(500).json({ error: error.message });
          }

          return res.json({
            imageUrl: result.secure_url,
          });
        }
      );

      // ✅ Send buffer
      stream.end(req.file.buffer);

    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

module.exports = router;