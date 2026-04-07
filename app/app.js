console.log("Starting app...");

const express = require("express");
const sequelize = require("./db/database");
const campaignRoutes = require("./routes/campaign.routes");

const app = express();
const aiRoutes = require("./ai/ai.routes");

app.use("/api/ai", aiRoutes);

app.use(express.json());
app.use("/api", campaignRoutes);

app.get("/", (req, res) => {
  res.send("API Running");
});

sequelize.sync()
  .then(() => {
    console.log("Database connected");

    app.listen(3000, () => {
      console.log("Server running on port 3000");
    });

  })
  .catch(err => {
    console.error("DB Error:", err);
  });