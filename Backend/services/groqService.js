const fetch = require("node-fetch");

async function generateAdContent({
  brandName,
  category,
  platform,
  audience,
  product,
}) {
  const prompt = `
You are an expert fashion advertising copywriter.

Create a complete advertising campaign for:

Brand: ${brandName}
Product: ${product}
Category: ${category}
Platform: ${platform}
Target Audience: ${audience}

Return ONLY valid JSON in exactly this format:

{
  "headline": "short catchy headline",
  "adCopy": "engaging advertising copy",
  "cta": "short call to action",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3"],
  "imagePrompt": "detailed cinematic image generation prompt"
}

Requirements:

- Headline should be short and memorable.
- Ad copy should be persuasive and suitable for ${platform}.
- CTA should be 2 to 4 words.
- Generate exactly 3 hashtags.
- imagePrompt must describe a premium commercial fashion photograph.
- The imagePrompt must NOT contain text, logos, watermarks or written words.
- Mention the product, clothing style, environment, lighting, colors and photography style.
- Make the image prompt suitable for an AI image generator.
- Do not include markdown.
- Return valid JSON only.
`;

  const response = await fetch(
    "https://api.mistral.ai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
      },
      body: JSON.stringify({
        model: "mistral-small-latest",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.8,
        max_tokens: 1000,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Mistral text generation error: ${errorText}`);
  }

  const data = await response.json();

  const content = data?.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("No text output from Mistral");
  }

  console.log("[Mistral text response]:", content);

  let cleaned = content.trim();

  if (cleaned.startsWith("```json")) {
    cleaned = cleaned
      .replace(/^```json\s*/, "")
      .replace(/\s*```$/, "");
  }

  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```\s*/, "")
      .replace(/\s*```$/, "");
  }

  try {
    return JSON.parse(cleaned);
  } catch (error) {
    console.error("Invalid JSON from Mistral:", cleaned);
    throw new Error("Mistral returned invalid JSON");
  }
}

module.exports = {
  generateAdCopy: generateAdContent,
  generateAdContent
};