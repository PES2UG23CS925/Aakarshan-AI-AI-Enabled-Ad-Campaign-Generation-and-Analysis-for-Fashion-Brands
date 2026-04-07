const axios = require("axios");

const generateAdText = async (campaign) => {
  try {
    const prompt = `
    Create a fashion advertisement for:
    Product: ${campaign.title}
    Description: ${campaign.description}
    Budget: ${campaign.budget}
    `;

    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        }
      }
    );

    return response.data.choices[0].message.content;

  } catch (err) {
    console.error(err);
    throw err;
  }
};

module.exports = { generateAdText };