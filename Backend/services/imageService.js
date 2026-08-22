// const fetch = require("node-fetch");
// const { createCanvas, loadImage } = require("@napi-rs/canvas");
// const supabase = require("../supabaseClient");

// const PLATFORM_COLOR = {
//   Instagram: "#E1306C",
//   Facebook: "#1877F2",
//   TikTok: "#010101",
//   LinkedIn: "#0A66C2",
//   YouTube: "#FF0000",
//   Twitter: "#1DA1F2",
// };

// async function generateRawImage(
//   adCopy,
//   brandName,
//   category,
//   platform,
//   audience,
//   headline,
//   imagePrompt
// ) {
//   const prompt =
//     imagePrompt ||
//     `Generate a cinematic high-end ${category} fashion advertisement photograph. ` +
//     `${headline}. Targeting ${audience}. ` +
//     `Urban night cityscape background, neon bokeh lights, professional studio lighting, ` +
//     `models wearing bold ${category} outfits with vibrant colors. ` +
//     `Commercial photography style, sharp focus, no text, no logos, no watermarks.`;

//   if (!process.env.MISTRAL_API_KEY) {
//     throw new Error("MISTRAL_API_KEY is not configured in Backend/.env");
//   }

//   console.log("[Mistral image prompt]:", prompt);

//   const response = await fetch(
//     "https://api.mistral.ai/v1/chat/completions",
//     {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//         Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
//       },
//       body: JSON.stringify({
//         model: "mistral-small-latest",
//         messages: [
//           {
//             role: "user",
//             content: prompt,
//           },
//         ],
//         tools: [
//           {
//             type: "image_generation",
//           },
//         ],
//         tool_choice: "any",
//       }),
//     }
//   );

//   if (!response.ok) {
//     const errorText = await response.text();
//     throw new Error(
//       `Mistral image generation error: ${errorText}`
//     );
//   }

//   const data = await response.json();

//   console.log(
//     "[Mistral image response]:",
//     JSON.stringify(data).slice(0, 3000)
//   );

//   const choices = data?.choices || [];

//   for (const choice of choices) {
//     const messages = choice?.messages || [];

//     for (const message of messages) {
//       const content = message?.content;

//       if (!content) {
//         continue;
//       }

//       if (typeof content === "string") {
//         const urlMatch = content.match(
//           /https?:\/\/[^\s"'<>]+/
//         );

//         if (urlMatch) {
//           return {
//             type: "url",
//             value: urlMatch[0],
//           };
//         }
//       }

//       if (Array.isArray(content)) {
//         for (const chunk of content) {
//           if (!chunk) {
//             continue;
//           }

//           if (chunk.type === "image_url") {
//             const imageUrl =
//               typeof chunk.image_url === "string"
//                 ? chunk.image_url
//                 : chunk.image_url?.url;

//             if (imageUrl) {
//               return {
//                 type: "url",
//                 value: imageUrl,
//               };
//             }
//           }

//           if (
//             chunk.type === "image" &&
//             chunk.image_url
//           ) {
//             const imageUrl =
//               typeof chunk.image_url === "string"
//                 ? chunk.image_url
//                 : chunk.image_url?.url;

//             if (imageUrl) {
//               return {
//                 type: "url",
//                 value: imageUrl,
//               };
//             }
//           }

//           if (chunk.type === "tool_file") {
//             if (chunk.file_id) {
//               return await downloadMistralFile(
//                 chunk.file_id
//               );
//             }
//           }

//           if (chunk.type === "file") {
//             if (chunk.file_id) {
//               return await downloadMistralFile(
//                 chunk.file_id
//               );
//             }
//           }
//         }
//       }
//     }
//   }

//   throw new Error(
//     "Mistral returned a response, but no generated image was found."
//   );
// }

// async function downloadMistralFile(fileId) {
//   const response = await fetch(
//     `https://api.mistral.ai/v1/files/${fileId}/content`,
//     {
//       method: "GET",
//       headers: {
//         Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
//       },
//     }
//   );

//   if (!response.ok) {
//     const errorText = await response.text();

//     throw new Error(
//       `Failed to download Mistral image file: ${errorText}`
//     );
//   }

//   const buffer = Buffer.from(
//     await response.arrayBuffer()
//   );

//   return {
//     type: "b64",
//     value: buffer.toString("base64"),
//   };
// }

// async function compositeAd({
//   rawImage,
//   brandName,
//   headline,
//   adCopy,
//   cta,
//   platform,
//   hashtags,
//   category,
// }) {
//   const W = 1080;

//   const HEADER_H = 200;
//   const PHOTO_H = 700;
//   const FOOTER_H = 180;

//   const H =
//     HEADER_H +
//     PHOTO_H +
//     FOOTER_H;

//   const accent =
//     PLATFORM_COLOR[platform] ||
//     "#E1306C";

//   const canvas =
//     createCanvas(W, H);

//   const ctx =
//     canvas.getContext("2d");

//   ctx.fillStyle = "#FFFFFF";

//   ctx.fillRect(
//     0,
//     0,
//     W,
//     H
//   );

//   let img;

//   if (rawImage.type === "b64") {
//     img = await loadImage(
//       Buffer.from(
//         rawImage.value,
//         "base64"
//       )
//     );
//   } else if (rawImage.type === "url") {
//     const res = await fetch(
//       rawImage.value
//     );

//     if (!res.ok) {
//       throw new Error(
//         `Failed to download generated image: ${res.status}`
//       );
//     }

//     const imageBuffer =
//       Buffer.from(
//         await res.arrayBuffer()
//       );

//     img =
//       await loadImage(
//         imageBuffer
//       );
//   } else {
//     throw new Error(
//       "Invalid raw image type"
//     );
//   }

//   const scale =
//     Math.min(
//       W / img.width,
//       PHOTO_H / img.height
//     );

//   const drawW =
//     img.width * scale;

//   const drawH =
//     img.height * scale;

//   const drawX =
//     (W - drawW) / 2;

//   const drawY =
//     HEADER_H +
//     (PHOTO_H - drawH) / 2;

//   ctx.fillStyle = "#F5F5F5";

//   ctx.fillRect(
//     0,
//     HEADER_H,
//     W,
//     PHOTO_H
//   );

//   ctx.drawImage(
//     img,
//     drawX,
//     drawY,
//     drawW,
//     drawH
//   );

//   ctx.fillStyle = accent;

//   ctx.fillRect(
//     0,
//     HEADER_H - 4,
//     W,
//     4
//   );

//   ctx.fillRect(
//     0,
//     HEADER_H + PHOTO_H,
//     W,
//     4
//   );

//   const PAD = 64;

//   ctx.fillStyle = accent;

//   ctx.font =
//     "bold 52px Arial";

//   ctx.textBaseline = "top";

//   const circleX =
//     PAD + 28;

//   const circleY = 36;

//   ctx.beginPath();

//   ctx.arc(
//     circleX,
//     circleY + 14,
//     28,
//     0,
//     Math.PI * 2
//   );

//   ctx.fillStyle = accent;

//   ctx.fill();

//   ctx.fillStyle = "#FFFFFF";

//   ctx.font =
//     "bold 30px Arial";

//   ctx.textAlign = "center";

//   const firstLetter =
//     brandName &&
//     brandName.length > 0
//       ? brandName[0].toUpperCase()
//       : "A";

//   ctx.fillText(
//     firstLetter,
//     circleX,
//     circleY + 2
//   );

//   ctx.textAlign = "left";

//   ctx.fillStyle = accent;

//   ctx.font =
//     "bold 48px Arial";

//   ctx.fillText(
//     String(brandName || "")
//       .toUpperCase(),
//     PAD + 70,
//     24
//   );

//   ctx.font =
//     "400 24px Arial";

//   ctx.fillStyle = "#888";

//   ctx.fillText(
//     String(category || ""),
//     PAD + 70,
//     84
//   );

//   ctx.fillStyle = "#111111";

//   ctx.font =
//     "bold 54px Arial";

//   ctx.textBaseline =
//     "alphabetic";

//   const headLines =
//     wrapText(
//       ctx,
//       String(
//         headline || ""
//       ).toUpperCase(),
//       W - PAD * 2 - 160,
//       "bold 54px Arial"
//     );

//   let headY = 148;

//   for (
//     const line of headLines.slice(0, 2)
//   ) {
//     ctx.fillText(
//       line,
//       PAD,
//       headY
//     );

//     headY += 62;
//   }

//   const footerTop =
//     HEADER_H +
//     PHOTO_H +
//     4;

//   ctx.font =
//     "italic 34px Arial";

//   ctx.fillStyle = "#444";

//   ctx.textBaseline = "top";

//   const tagline =
//     adCopy
//       ? String(adCopy)
//           .split(".")[0] + "."
//       : "Style that speaks for itself.";

//   const tagLines =
//     wrapText(
//       ctx,
//       tagline,
//       W - PAD * 2 - 200,
//       "italic 34px Arial"
//     );

//   let tagY =
//     footerTop + 28;

//   for (
//     const line of tagLines.slice(0, 2)
//   ) {
//     ctx.fillText(
//       line,
//       PAD,
//       tagY
//     );

//     tagY += 44;
//   }

//   if (
//     Array.isArray(hashtags) &&
//     hashtags.length > 0
//   ) {
//     ctx.font =
//       "400 24px Arial";

//     ctx.fillStyle = accent;

//     const hashtagText =
//       hashtags
//         .slice(0, 3)
//         .map((h) => {
//           const value =
//             String(h).trim();

//           return value.startsWith("#")
//             ? value
//             : `#${value}`;
//         })
//         .join("  ");

//     ctx.fillText(
//       hashtagText,
//       PAD,
//       tagY + 8
//     );
//   }

//   const ctaText =
//     cta || "Shop Now";

//   ctx.font =
//     "bold 28px Arial";

//   const ctaW =
//     ctx.measureText(
//       ctaText
//     ).width + 64;

//   const ctaH = 64;

//   const ctaX =
//     W -
//     ctaW -
//     PAD;

//   const ctaY =
//     footerTop + 58;

//   ctx.fillStyle = accent;

//   roundRect(
//     ctx,
//     ctaX,
//     ctaY,
//     ctaW,
//     ctaH,
//     32
//   );

//   ctx.fill();

//   ctx.fillStyle = "#FFFFFF";

//   ctx.textAlign =
//     "center";

//   ctx.textBaseline =
//     "middle";

//   ctx.fillText(
//     ctaText,
//     ctaX + ctaW / 2,
//     ctaY + ctaH / 2
//   );

//   ctx.font =
//     "400 20px Arial";

//   ctx.fillStyle = "#BBBBBB";

//   ctx.textAlign = "left";

//   ctx.textBaseline =
//     "alphabetic";

//   ctx.fillText(
//     `${platform} · Sponsored`,
//     PAD,
//     H - 18
//   );

//   return canvas.toBuffer(
//     "image/jpeg",
//     95
//   );
// }

// async function uploadToSupabase(
//   buffer,
//   campaignId
// ) {
//   const fileName =
//     `ads/${
//       campaignId || Date.now()
//     }_${
//       Math.random()
//         .toString(36)
//         .slice(2)
//     }.jpg`;

//   const {
//     error,
//   } =
//     await supabase.storage
//       .from(
//         "campaign-images"
//       )
//       .upload(
//         fileName,
//         buffer,
//         {
//           contentType:
//             "image/jpeg",
//           cacheControl:
//             "3600",
//           upsert: false,
//         }
//       );

//   if (error) {
//     throw new Error(
//       `Upload error: ${error.message}`
//     );
//   }

//   const {
//     data,
//   } =
//     supabase.storage
//       .from(
//         "campaign-images"
//       )
//       .getPublicUrl(
//         fileName
//       );

//   if (
//     !data ||
//     !data.publicUrl
//   ) {
//     throw new Error(
//       "Could not create Supabase public URL"
//     );
//   }

//   return data.publicUrl;
// }

// async function generateSingleImage(
//   adCopy,
//   brandName,
//   category,
//   platform,
//   audience,
//   headline,
//   extraData = {}
// ) {
//   const {
//     cta,
//     hashtags,
//     campaignId,
//     imagePrompt,
//   } = extraData;

//   const rawImage =
//     await generateRawImage(
//       adCopy,
//       brandName,
//       category,
//       platform,
//       audience,
//       headline,
//       imagePrompt
//     );

//   const buffer =
//     await compositeAd({
//       rawImage,
//       brandName,
//       headline,
//       adCopy,
//       cta:
//         cta || "Shop Now",
//       platform,
//       hashtags:
//         hashtags || [],
//       category,
//     });

//   return await uploadToSupabase(
//     buffer,
//     campaignId
//   );
// }

// // Backward-compatible single-image API
// async function generateImage(
//   adCopy,
//   brandName,
//   category,
//   platform,
//   audience,
//   headline,
//   extraData = {}
// ) {
//   return generateSingleImage(
//     adCopy,
//     brandName,
//     category,
//     platform,
//     audience,
//     headline,
//     extraData
//   );
// }

// function withTimeout(promise, ms, label) {
//   let timer;
//   const timeout = new Promise((_, reject) => {
//     timer = setTimeout(
//       () => reject(new Error(`${label} timed out after ${ms}ms`)),
//       ms
//     );
//   });
//   return Promise.race([promise, timeout]).finally(() =>
//     clearTimeout(timer)
//   );
// }

// // Generates `count` image variants and returns an array of URLs.
// // Runs only CONCURRENCY calls to Mistral at a time (a worker pool), instead
// // of firing all of them simultaneously — Mistral's image tool appears to
// // throttle/queue bursts of simultaneous calls, which was causing every
// // single one of 4 concurrent calls to time out. Each call is capped with a
// // generous timeout, and failures/timeouts for individual variants don't
// // fail the whole batch — we return whatever succeeded.
// async function generateImages(
//   adCopy,
//   brandName,
//   category,
//   platform,
//   audience,
//   headline,
//   extraData = {},
//   count = 4
// ) {
//   const PER_IMAGE_TIMEOUT_MS = 90000; // Mistral image-gen tool calls can genuinely take 60-90s under concurrent load
//   const CONCURRENCY = 2;              // run only 2 at a time — 4 at once was overloading/timing out every call

//   const results = new Array(count).fill(null);
//   let nextIndex = 0;

//   async function worker() {
//     while (nextIndex < count) {
//       const i = nextIndex++;
//       try {
//         results[i] = await withTimeout(
//           generateSingleImage(
//             adCopy,
//             brandName,
//             category,
//             platform,
//             audience,
//             headline,
//             extraData
//           ),
//           PER_IMAGE_TIMEOUT_MS,
//           `Image variant ${i + 1}`
//         );
//       } catch (err) {
//         console.error(
//           `[Image variant ${i + 1} failed]:`,
//           err.message
//         );
//         results[i] = null;
//       }
//     }
//   }

//   const workers = Array.from(
//     { length: Math.min(CONCURRENCY, count) },
//     () => worker()
//   );
//   await Promise.all(workers);

//   const urls = results.filter(Boolean);

//   if (urls.length === 0) {
//     throw new Error(
//       "All image generation attempts failed."
//     );
//   }

//   return urls;
// }

// function roundRect(
//   ctx,
//   x,
//   y,
//   w,
//   h,
//   r
// ) {
//   ctx.beginPath();

//   ctx.moveTo(
//     x + r,
//     y
//   );

//   ctx.lineTo(
//     x + w - r,
//     y
//   );

//   ctx.quadraticCurveTo(
//     x + w,
//     y,
//     x + w,
//     y + r
//   );

//   ctx.lineTo(
//     x + w,
//     y + h - r
//   );

//   ctx.quadraticCurveTo(
//     x + w,
//     y + h,
//     x + w - r,
//     y + h
//   );

//   ctx.lineTo(
//     x + r,
//     y + h
//   );

//   ctx.quadraticCurveTo(
//     x,
//     y + h,
//     x,
//     y + h - r
//   );

//   ctx.lineTo(
//     x,
//     y + r
//   );

//   ctx.quadraticCurveTo(
//     x,
//     y,
//     x + r,
//     y
//   );

//   ctx.closePath();
// }

// function wrapText(
//   ctx,
//   text,
//   maxWidth,
//   font
// ) {
//   ctx.font = font;

//   const words =
//     String(text).split(" ");

//   const lines = [];

//   let line = "";

//   for (
//     const word of words
//   ) {
//     const test =
//       line
//         ? `${line} ${word}`
//         : word;

//     if (
//       ctx.measureText(
//         test
//       ).width >
//         maxWidth &&
//       line
//     ) {
//       lines.push(line);
//       line = word;
//     } else {
//       line = test;
//     }
//   }

//   if (line) {
//     lines.push(line);
//   }

//   return lines;
// }

// module.exports = {
//   generateImage,
//   generateImages,
// };


const fetch = require("node-fetch");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const supabase = require("../supabaseClient");

const PLATFORM_COLOR = {
  Instagram: "#E1306C",
  Facebook: "#1877F2",
  TikTok: "#010101",
  LinkedIn: "#0A66C2",
  YouTube: "#FF0000",
  Twitter: "#1DA1F2",
};

// async function generateRawImage(
//   adCopy,
//   brandName,
//   category,
//   platform,
//   audience,
//   headline,
//   imagePrompt
// ) {
//   const prompt =
//     imagePrompt ||
//     `Generate a cinematic high-end ${category} fashion advertisement photograph. ` +
//     `${headline}. Targeting ${audience}. ` +
//     `Urban night cityscape background, neon bokeh lights, professional studio lighting, ` +
//     `models wearing bold ${category} outfits with vibrant colors. ` +
//     `Commercial photography style, sharp focus, no text, no logos, no watermarks.`;

//   if (!process.env.MISTRAL_API_KEY) {
//     throw new Error("MISTRAL_API_KEY is not configured in Backend/.env");
//   }

//   console.log("[Mistral image prompt]:", prompt);

//   const response = await fetch(
//     "https://api.mistral.ai/v1/chat/completions",
//     {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//         Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
//       },
//       body: JSON.stringify({
//         model: "mistral-small-latest",
//         messages: [
//           {
//             role: "user",
//             content: prompt,
//           },
//         ],
//         tools: [
//           {
//             type: "image_generation",
//           },
//         ],
//         tool_choice: "any",
//       }),
//     }
//   );

//   if (!response.ok) {
//     const errorText = await response.text();
//     throw new Error(
//       `Mistral image generation error: ${errorText}`
//     );
//   }

//   const data = await response.json();

async function generateRawImage(
  adCopy,
  brandName,
  category,
  platform,
  audience,
  headline,
  imagePrompt,
  timeoutMs = 60000 // fetch-level timeout — separate from the outer per-variant timeout
) {
  const prompt =
    imagePrompt ||
    `Generate a cinematic high-end ${category} fashion advertisement photograph. ` +
    `${headline}. Targeting ${audience}. ` +
    `Urban night cityscape background, neon bokeh lights, professional studio lighting, ` +
    `models wearing bold ${category} outfits with vibrant colors. ` +
    `Commercial photography style, sharp focus, no text, no logos, no watermarks.`;

  if (!process.env.MISTRAL_API_KEY) {
    throw new Error("MISTRAL_API_KEY is not configured in Backend/.env");
  }

  console.log("[Mistral image prompt]:", prompt);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(
      "https://api.mistral.ai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
        },
        body: JSON.stringify({
          model: "mistral-small-latest",
          messages: [{ role: "user", content: prompt }],
          tools: [{ type: "image_generation" }],
          tool_choice: "any",
        }),
        signal: controller.signal, // <-- this is what actually cancels the socket
      }
    );
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(`Mistral request aborted after ${timeoutMs}ms (fetch-level timeout)`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Mistral image generation error: ${errorText}`);
  }

  const data = await response.json();
  // ...rest unchanged (parsing choices, etc.)

  console.log(
    "[Mistral image response]:",
    JSON.stringify(data).slice(0, 3000)
  );

  const choices = data?.choices || [];

  for (const choice of choices) {
    const messages = choice?.messages || [];

    for (const message of messages) {
      const content = message?.content;

      if (!content) {
        continue;
      }

      if (typeof content === "string") {
        const urlMatch = content.match(
          /https?:\/\/[^\s"'<>]+/
        );

        if (urlMatch) {
          return {
            type: "url",
            value: urlMatch[0],
          };
        }
      }

      if (Array.isArray(content)) {
        for (const chunk of content) {
          if (!chunk) {
            continue;
          }

          if (chunk.type === "image_url") {
            const imageUrl =
              typeof chunk.image_url === "string"
                ? chunk.image_url
                : chunk.image_url?.url;

            if (imageUrl) {
              return {
                type: "url",
                value: imageUrl,
              };
            }
          }

          if (
            chunk.type === "image" &&
            chunk.image_url
          ) {
            const imageUrl =
              typeof chunk.image_url === "string"
                ? chunk.image_url
                : chunk.image_url?.url;

            if (imageUrl) {
              return {
                type: "url",
                value: imageUrl,
              };
            }
          }

          if (chunk.type === "tool_file") {
            if (chunk.file_id) {
              return await downloadMistralFile(
                chunk.file_id
              );
            }
          }

          if (chunk.type === "file") {
            if (chunk.file_id) {
              return await downloadMistralFile(
                chunk.file_id
              );
            }
          }
        }
      }
    }
  }

  throw new Error(
    "Mistral returned a response, but no generated image was found."
  );
}

async function downloadMistralFile(fileId) {
  const response = await fetch(
    `https://api.mistral.ai/v1/files/${fileId}/content`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Failed to download Mistral image file: ${errorText}`
    );
  }

  const buffer = Buffer.from(
    await response.arrayBuffer()
  );

  return {
    type: "b64",
    value: buffer.toString("base64"),
  };
}

async function compositeAd({
  rawImage,
  brandName,
  headline,
  adCopy,
  cta,
  platform,
  hashtags,
  category,
}) {
  const W = 1080;

  const HEADER_H = 200;
  const PHOTO_H = 700;
  const FOOTER_H = 180;

  const H =
    HEADER_H +
    PHOTO_H +
    FOOTER_H;

  const accent =
    PLATFORM_COLOR[platform] ||
    "#E1306C";

  const canvas =
    createCanvas(W, H);

  const ctx =
    canvas.getContext("2d");

  ctx.fillStyle = "#FFFFFF";

  ctx.fillRect(
    0,
    0,
    W,
    H
  );

  let img;

  if (rawImage.type === "b64") {
    img = await loadImage(
      Buffer.from(
        rawImage.value,
        "base64"
      )
    );
  } else if (rawImage.type === "url") {
    const res = await fetch(
      rawImage.value
    );

    if (!res.ok) {
      throw new Error(
        `Failed to download generated image: ${res.status}`
      );
    }

    const imageBuffer =
      Buffer.from(
        await res.arrayBuffer()
      );

    img =
      await loadImage(
        imageBuffer
      );
  } else {
    throw new Error(
      "Invalid raw image type"
    );
  }

  const scale =
    Math.min(
      W / img.width,
      PHOTO_H / img.height
    );

  const drawW =
    img.width * scale;

  const drawH =
    img.height * scale;

  const drawX =
    (W - drawW) / 2;

  const drawY =
    HEADER_H +
    (PHOTO_H - drawH) / 2;

  ctx.fillStyle = "#F5F5F5";

  ctx.fillRect(
    0,
    HEADER_H,
    W,
    PHOTO_H
  );

  ctx.drawImage(
    img,
    drawX,
    drawY,
    drawW,
    drawH
  );

  ctx.fillStyle = accent;

  ctx.fillRect(
    0,
    HEADER_H - 4,
    W,
    4
  );

  ctx.fillRect(
    0,
    HEADER_H + PHOTO_H,
    W,
    4
  );

  const PAD = 64;

  ctx.fillStyle = accent;

  ctx.font =
    "bold 52px Arial";

  ctx.textBaseline = "top";

  const circleX =
    PAD + 28;

  const circleY = 36;

  ctx.beginPath();

  ctx.arc(
    circleX,
    circleY + 14,
    28,
    0,
    Math.PI * 2
  );

  ctx.fillStyle = accent;

  ctx.fill();

  ctx.fillStyle = "#FFFFFF";

  ctx.font =
    "bold 30px Arial";

  ctx.textAlign = "center";

  const firstLetter =
    brandName &&
    brandName.length > 0
      ? brandName[0].toUpperCase()
      : "A";

  ctx.fillText(
    firstLetter,
    circleX,
    circleY + 2
  );

  ctx.textAlign = "left";

  ctx.fillStyle = accent;

  ctx.font =
    "bold 48px Arial";

  ctx.fillText(
    String(brandName || "")
      .toUpperCase(),
    PAD + 70,
    24
  );

  ctx.font =
    "400 24px Arial";

  ctx.fillStyle = "#888";

  ctx.fillText(
    String(category || ""),
    PAD + 70,
    84
  );

  ctx.fillStyle = "#111111";

  ctx.font =
    "bold 54px Arial";

  ctx.textBaseline =
    "alphabetic";

  const headLines =
    wrapText(
      ctx,
      String(
        headline || ""
      ).toUpperCase(),
      W - PAD * 2 - 160,
      "bold 54px Arial"
    );

  let headY = 148;

  for (
    const line of headLines.slice(0, 2)
  ) {
    ctx.fillText(
      line,
      PAD,
      headY
    );

    headY += 62;
  }

  const footerTop =
    HEADER_H +
    PHOTO_H +
    4;

  ctx.font =
    "italic 34px Arial";

  ctx.fillStyle = "#444";

  ctx.textBaseline = "top";

  const tagline =
    adCopy
      ? String(adCopy)
          .split(".")[0] + "."
      : "Style that speaks for itself.";

  const tagLines =
    wrapText(
      ctx,
      tagline,
      W - PAD * 2 - 200,
      "italic 34px Arial"
    );

  let tagY =
    footerTop + 28;

  for (
    const line of tagLines.slice(0, 2)
  ) {
    ctx.fillText(
      line,
      PAD,
      tagY
    );

    tagY += 44;
  }

  if (
    Array.isArray(hashtags) &&
    hashtags.length > 0
  ) {
    ctx.font =
      "400 24px Arial";

    ctx.fillStyle = accent;

    const hashtagText =
      hashtags
        .slice(0, 3)
        .map((h) => {
          const value =
            String(h).trim();

          return value.startsWith("#")
            ? value
            : `#${value}`;
        })
        .join("  ");

    ctx.fillText(
      hashtagText,
      PAD,
      tagY + 8
    );
  }

  const ctaText =
    cta || "Shop Now";

  ctx.font =
    "bold 28px Arial";

  const ctaW =
    ctx.measureText(
      ctaText
    ).width + 64;

  const ctaH = 64;

  const ctaX =
    W -
    ctaW -
    PAD;

  const ctaY =
    footerTop + 58;

  ctx.fillStyle = accent;

  roundRect(
    ctx,
    ctaX,
    ctaY,
    ctaW,
    ctaH,
    32
  );

  ctx.fill();

  ctx.fillStyle = "#FFFFFF";

  ctx.textAlign =
    "center";

  ctx.textBaseline =
    "middle";

  ctx.fillText(
    ctaText,
    ctaX + ctaW / 2,
    ctaY + ctaH / 2
  );

  ctx.font =
    "400 20px Arial";

  ctx.fillStyle = "#BBBBBB";

  ctx.textAlign = "left";

  ctx.textBaseline =
    "alphabetic";

  ctx.fillText(
    `${platform} · Sponsored`,
    PAD,
    H - 18
  );

  return canvas.toBuffer(
    "image/jpeg",
    95
  );
}

async function uploadToSupabase(
  buffer,
  campaignId
) {
  const fileName =
    `ads/${
      campaignId || Date.now()
    }_${
      Math.random()
        .toString(36)
        .slice(2)
    }.jpg`;

  const {
    error,
  } =
    await supabase.storage
      .from(
        "campaign-images"
      )
      .upload(
        fileName,
        buffer,
        {
          contentType:
            "image/jpeg",
          cacheControl:
            "3600",
          upsert: false,
        }
      );

  if (error) {
    throw new Error(
      `Upload error: ${error.message}`
    );
  }

  const {
    data,
  } =
    supabase.storage
      .from(
        "campaign-images"
      )
      .getPublicUrl(
        fileName
      );

  if (
    !data ||
    !data.publicUrl
  ) {
    throw new Error(
      "Could not create Supabase public URL"
    );
  }

  return data.publicUrl;
}

async function generateSingleImage(
  adCopy,
  brandName,
  category,
  platform,
  audience,
  headline,
  extraData = {}
) {
  const {
    cta,
    hashtags,
    campaignId,
    imagePrompt,
  } = extraData;

  const rawImage =
    await generateRawImage(
      adCopy,
      brandName,
      category,
      platform,
      audience,
      headline,
      imagePrompt
    );

  const buffer =
    await compositeAd({
      rawImage,
      brandName,
      headline,
      adCopy,
      cta:
        cta || "Shop Now",
      platform,
      hashtags:
        hashtags || [],
      category,
    });

  return await uploadToSupabase(
    buffer,
    campaignId
  );
}

// Backward-compatible single-image API
async function generateImage(
  adCopy,
  brandName,
  category,
  platform,
  audience,
  headline,
  extraData = {}
) {
  return generateSingleImage(
    adCopy,
    brandName,
    category,
    platform,
    audience,
    headline,
    extraData
  );
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms
    );
  });
  return Promise.race([promise, timeout]).finally(() =>
    clearTimeout(timer)
  );
}

// Generates `count` image variants and returns an array of URLs.
// Runs strictly ONE call to Mistral at a time (fully sequential) — even 2
// concurrent calls was causing every single request to time out, so
// concurrency itself appears to be the problem, not just raw speed. Each
// call gets a generous timeout (these prompts can legitimately take
// 60-150s, especially multi-person, detail-heavy scenes) plus one retry
// before being given up on. Failures for individual variants don't fail
// the whole batch — we return whatever succeeded.
async function generateImages(
  adCopy,
  brandName,
  category,
  platform,
  audience,
  headline,
  extraData = {},
  count = 3
) {
  const PER_IMAGE_TIMEOUT_MS = 150000; // 2.5 min — these calls can genuinely be this slow
  const MAX_ATTEMPTS = 2;              // 1 retry per image on failure/timeout

  const urls = [];

  for (let i = 0; i < count; i++) {
    let success = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const startedAt = Date.now();
      try {
        success = await withTimeout(
          generateSingleImage(
            adCopy,
            brandName,
            category,
            platform,
            audience,
            headline,
            extraData
          ),
          PER_IMAGE_TIMEOUT_MS,
          `Image variant ${i + 1} (attempt ${attempt})`
        );
        console.log(
          `[Image variant ${i + 1} succeeded on attempt ${attempt}]: took ${
            Date.now() - startedAt
          }ms`
        );
        break;
      } catch (err) {
      console.error(`[Image variant ${i + 1} attempt ${attempt} failed]:`, err.message);
      if (err.message.includes("429") || err.message.includes("rate_limited")) {
        await new Promise(res => setTimeout(res, 8000)); // back off before retry
      }
    }
    }

    if (success) {
      urls.push(success);
    }
  }

  if (urls.length === 0) {
    throw new Error(
      "All image generation attempts failed."
    );
  }

  return urls;
}

function roundRect(
  ctx,
  x,
  y,
  w,
  h,
  r
) {
  ctx.beginPath();

  ctx.moveTo(
    x + r,
    y
  );

  ctx.lineTo(
    x + w - r,
    y
  );

  ctx.quadraticCurveTo(
    x + w,
    y,
    x + w,
    y + r
  );

  ctx.lineTo(
    x + w,
    y + h - r
  );

  ctx.quadraticCurveTo(
    x + w,
    y + h,
    x + w - r,
    y + h
  );

  ctx.lineTo(
    x + r,
    y + h
  );

  ctx.quadraticCurveTo(
    x,
    y + h,
    x,
    y + h - r
  );

  ctx.lineTo(
    x,
    y + r
  );

  ctx.quadraticCurveTo(
    x,
    y,
    x + r,
    y
  );

  ctx.closePath();
}

function wrapText(
  ctx,
  text,
  maxWidth,
  font
) {
  ctx.font = font;

  const words =
    String(text).split(" ");

  const lines = [];

  let line = "";

  for (
    const word of words
  ) {
    const test =
      line
        ? `${line} ${word}`
        : word;

    if (
      ctx.measureText(
        test
      ).width >
        maxWidth &&
      line
    ) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }

  if (line) {
    lines.push(line);
  }

  return lines;
}

module.exports = {
  generateImage,
  generateImages,
};