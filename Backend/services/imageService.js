const fetch = require("node-fetch");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const supabase = require("../supabaseClient");

const PLATFORM_COLOR = {
  Instagram: "#E1306C",
  Facebook:  "#1877F2",
  TikTok:    "#010101",
  LinkedIn:  "#0A66C2",
  YouTube:   "#FF0000",
  Twitter:   "#1DA1F2",
};

// ── Step 1: Get raw photo from Pollinations.ai (gen.pollinations.ai, API key required) ────────
// Docs: https://github.com/pollinations/pollinations/blob/master/APIDOCS.md
// Get a free API key (raises rate limits, removes watermark) at https://enter.pollinations.ai
//
// variantIndex picks a different shot style per variant so the 3 generated ads
// actually look different from each other, not just re-rolls of the same photo.
const VARIANT_SHOT_STYLES = [
  "close-up three-quarter portrait shot, shallow depth of field, subject looking off-camera",
  "full-body dynamic walking pose, wide angle, subject centered on an urban street",
  "editorial studio-style pose against a gradient backdrop with dramatic side lighting",
];

// Reads the "Target Audience" field and returns an explicit subject description so the
// model actually matches the requested gender instead of defaulting to a female model.
function subjectDescriptor(audience) {
  const a = (audience || "").toLowerCase();
  const hasWomen = /\bwomen\b|\bwoman\b|\bfemale\b|\bgirls?\b|\bladies\b/.test(a);
  const hasMen   = /\bmen\b|\bman\b|\bmale\b|\bboys?\b|\bguys?\b/.test(a);
  if (hasMen && !hasWomen) return "a male model";
  if (hasWomen && !hasMen) return "a female model";
  if (hasMen && hasWomen)  return "male and female models together";
  return "a model";
}

async function generateRawImage(adCopy, brandName, category, platform, audience, headline, seed, variantIndex = 0) {
  const shotStyle = VARIANT_SHOT_STYLES[variantIndex % VARIANT_SHOT_STYLES.length];
  const subject    = subjectDescriptor(audience);

  const prompt =
    `Photorealistic professional fashion advertising photograph of ${subject}, ${shotStyle}. ` +
    `Wearing a bold high-end ${category} outfit in solid, plain colors, designed for an audience of ${audience}. ` +
    `Urban night cityscape background, neon bokeh lights, cinematic studio lighting. ` +
    `Shot on a Canon EOS R5 with an 85mm f/1.4 lens, natural skin texture with visible pores, ` +
    `subtle film grain, realistic shadows, unretouched RAW photograph look, real human proportions. ` +
    `Commercial advertising photography, tack-sharp focus. Clothing has no text, no printed words, no logos, no graphics.`;

  const negativePrompt =
    "text, typography, letters, words, gibberish text, illegible logo, printed graphic, watermark, signature, " +
    "cartoon, illustration, drawing, painting, 3D render, CGI, anime, plastic skin, over-smoothed skin, airbrushed, " +
    "extra limbs, extra fingers, mutated hands, deformed face, blurry, low quality, low resolution";

  const params = new URLSearchParams({
    width: "1080",
    height: "1350",
    model: "flux",
    nologo: "true",
    safe: "true",
    seed: String(seed),
    negative_prompt: negativePrompt,
  });

  // Pollinations moved to the unified gen.pollinations.ai gateway. The old
  // image.pollinations.ai endpoint no longer works reliably and API keys (sk_/pk_)
  // created at https://enter.pollinations.ai are only valid on the new one.
  const base = (process.env.POLLINATIONS_BASE_URL || "https://gen.pollinations.ai").replace(/\/+$/, "");
  const key  = (process.env.POLLINATIONS_API_KEY || "").trim();
  if (!key) {
    console.warn("[Pollinations] POLLINATIONS_API_KEY is empty - create one at https://enter.pollinations.ai and put it in Backend/.env");
  }
  const url = `${base}/image/${encodeURIComponent(prompt)}?${params.toString()}`;
  const headers = { Accept: "image/*" };
  if (key) headers.Authorization = `Bearer ${key}`;

  // Pollinations' anonymous tier only allows 1 request at a time and 429s the rest,
  // so retry with backoff instead of failing immediately.
  const MAX_ATTEMPTS = 4;
  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url, { headers, timeout: 120000 });
      if (response.status === 401 || response.status === 403) {
        // Bad/missing key: retrying will never help, fail fast with a clear message.
        const body = await response.text().catch(() => "");
        const err = new Error(`Pollinations auth failed (${response.status}). Check POLLINATIONS_API_KEY in Backend/.env. ${body.slice(0, 200)}`);
        err.fatal = true;
        throw err;
      }
      if (response.status === 402) {
        const err = new Error("Pollinations: out of pollen credits (402). Top up or wait for the free refill at https://enter.pollinations.ai");
        err.fatal = true;
        throw err;
      }
      if (response.status === 429) {
        lastErr = new Error(`Pollinations rate-limited (429) on attempt ${attempt}`);
        await sleep(attempt * 6000); // 6s, 12s, 18s...
        continue;
      }
      if (!response.ok) throw new Error(`Pollinations error: ${response.status} ${await response.text()}`);

      const ctype = response.headers.get("content-type") || "";
      if (!ctype.startsWith("image/")) throw new Error(`Pollinations returned non-image (${ctype})`);
      const buffer = Buffer.from(await response.arrayBuffer());
      if (!buffer || buffer.length < 500) throw new Error("Pollinations returned an empty image");
      return { type: "buffer", value: buffer };
    } catch (e) {
      lastErr = e;
      if (e.fatal) throw e;
      if (attempt < MAX_ATTEMPTS) await sleep(attempt * 4000);
    }
  }
  throw lastErr || new Error("Pollinations image generation failed");
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Step 2: Composite ad layout ONTO image (Titan-ad style) ──────────────────
// Layout: white header zone (brand + headline) → photo → white footer zone (tagline + CTA)
// No text floats over the image — keeps it clean like a real print/digital ad
async function compositeAd({ rawImage, brandName, headline, adCopy, cta, platform, hashtags, category }) {
  const W = 1080;
  const HEADER_H = 230;  // white zone above photo (room for brand row + up to 2 headline lines)
  const PHOTO_H  = 630;  // photo zone
  const FOOTER_H = 220;  // white zone below photo
  const H = HEADER_H + PHOTO_H + FOOTER_H; // 1080 total

  const accent = PLATFORM_COLOR[platform] || "#E1306C";

  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext("2d");

  // ── Background: clean white ──
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, W, H);

  // ── Load and draw the photo in the middle zone ──
  let img;
  if (rawImage.type === "buffer") {
    img = await loadImage(rawImage.value);
  } else if (rawImage.type === "b64") {
    img = await loadImage(Buffer.from(rawImage.value, "base64"));
  } else {
    const res = await fetch(rawImage.value);
    img = await loadImage(Buffer.from(await res.arrayBuffer()));
  }

  // Cover-fit into photo zone
// Use CONTAIN instead of COVER (prevents cropping)
const scale = Math.min(W / img.width, PHOTO_H / img.height);

const drawW = img.width  * scale;
const drawH = img.height * scale;

// Center properly inside photo zone
const drawX = (W - drawW) / 2;
const drawY = HEADER_H + (PHOTO_H - drawH) / 2;

// Optional: add subtle background behind image (prevents empty gaps looking bad)
ctx.fillStyle = "#f5f5f5";
ctx.fillRect(0, HEADER_H, W, PHOTO_H);

ctx.drawImage(img, drawX, drawY, drawW, drawH);

  // Thin accent line between header and photo
  ctx.fillStyle = accent;
  ctx.fillRect(0, HEADER_H - 4, W, 4);
  ctx.fillRect(0, HEADER_H + PHOTO_H, W, 4);

  // ── HEADER ZONE: brand logo text + headline ──
  const PAD = 64;

  // Brand name — large, bold, accent colour (like "TITAN" in reference)
  ctx.fillStyle   = accent;
  ctx.font        = `bold 52px Arial`;
  ctx.textBaseline = "top";

  // Brand icon circle
  const circleX = PAD + 28;
  const circleY = 36;
  ctx.beginPath();
  ctx.arc(circleX, circleY + 14, 28, 0, Math.PI * 2);
  ctx.fillStyle = accent;
  ctx.fill();
  ctx.fillStyle   = "#fff";
  ctx.font        = `bold 30px Arial`;
  ctx.textAlign   = "center";
  ctx.fillText(brandName[0].toUpperCase(), circleX, circleY + 2);

  // Brand name text
  ctx.textAlign   = "left";
  ctx.fillStyle   = accent;
  ctx.font        = `bold 48px Arial`;
  ctx.fillText(brandName.toUpperCase(), PAD + 70, 24);

  // Category pill
  ctx.font        = "400 24px Arial";
  ctx.fillStyle   = "#888";
  ctx.fillText(category, PAD + 70, 84);

  // Headline — dark, prominent (like "WHEN ONE ISN'T ENOUGH" in reference)
  // Clipped to the header zone so long headlines can never bleed into the photo below,
  // and font size shrinks automatically if it needs more than 2 lines to fit.
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, HEADER_H - 4);
  ctx.clip();

  ctx.fillStyle   = "#111111";
  ctx.textBaseline = "alphabetic";
  const headMaxWidth = W - PAD * 2 - 40;
  let headFontSize = 54;
  let headLines = wrapText(ctx, headline.toUpperCase(), headMaxWidth, `bold ${headFontSize}px Arial`);
  if (headLines.length > 2) {
    headFontSize = 40;
    headLines = wrapText(ctx, headline.toUpperCase(), headMaxWidth, `bold ${headFontSize}px Arial`);
  }
  headLines = headLines.slice(0, 2);
  ctx.font = `bold ${headFontSize}px Arial`;
  const headLineHeight = headFontSize + 12;
  let headY = 148;
  for (const line of headLines) {
    ctx.fillText(line, PAD, headY);
    headY += headLineHeight;
  }
  ctx.restore();

  // ── FOOTER ZONE: ad copy tagline + CTA + hashtags ──
  const footerTop = HEADER_H + PHOTO_H + 4;

  // Clipped to the footer zone so tagline/hashtags can never bleed past the card edge.
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, footerTop, W, FOOTER_H - 4);
  ctx.clip();

  // Italic tagline (like "Upgrade to two. One's on us" in reference)
  ctx.font        = `italic 34px Arial`;
  ctx.fillStyle   = "#444";
  ctx.textBaseline = "top";
  const tagline   = adCopy ? adCopy.split(".")[0] + "." : `Style that speaks for itself.`;
  const tagLines  = wrapText(ctx, tagline, W - PAD * 2 - 200, `italic 34px Arial`);
  let tagY = footerTop + 28;
  for (const line of tagLines.slice(0, 2)) {
    ctx.fillText(line, PAD, tagY);
    tagY += 44;
  }

  // Hashtags — small, accent coloured
  if (hashtags && hashtags.length > 0) {
    ctx.font      = "400 24px Arial";
    ctx.fillStyle = accent;
    ctx.fillText(hashtags.slice(0, 3).map(h => `#${h}`).join("  "), PAD, tagY + 8);
  }
  ctx.restore();

  // CTA pill button — bottom right of footer (like "Buy 1 Get 1 Free" badge)
  const ctaText = cta || "Shop Now";
  ctx.font      = `bold 28px Arial`;
  const ctaW    = ctx.measureText(ctaText).width + 64;
  const ctaH    = 64;
  const ctaX    = W - ctaW - PAD;
  const ctaY    = footerTop + 58;

  ctx.fillStyle = accent;
  roundRect(ctx, ctaX, ctaY, ctaW, ctaH, 32);
  ctx.fill();

  ctx.fillStyle    = "#fff";
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(ctaText, ctaX + ctaW / 2, ctaY + ctaH / 2);

  // Platform label — tiny bottom left corner
  ctx.font        = "400 20px Arial";
  ctx.fillStyle   = "#bbb";
  ctx.textAlign   = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(`${platform} · Sponsored`, PAD, H - 18);

  return canvas.toBuffer("image/jpeg", 95);
}

// ── Step 3: Upload to Supabase Storage ────────────────────────────────────────
async function uploadToSupabase(buffer, campaignId, variantIndex) {
  const fileName = `ads/${campaignId || Date.now()}_v${variantIndex}_${Math.random().toString(36).slice(2)}.jpg`;
  const { error } = await supabase.storage
    .from("campaign-images")
    .upload(fileName, buffer, { contentType: "image/jpeg", cacheControl: "3600", upsert: false });

  if (error) throw new Error(`Upload error: ${error.message}`);
  const { data } = supabase.storage.from("campaign-images").getPublicUrl(fileName);
  return data.publicUrl;
}

// ── Generate ONE ad variant (raw photo → composite → upload) ──────────────────
async function generateOneVariant(adCopy, brandName, category, platform, audience, headline, extraData, seed, variantIndex) {
  const { cta, hashtags, campaignId } = extraData;
  const rawImage = await generateRawImage(adCopy, brandName, category, platform, audience, headline, seed, variantIndex);
  const buffer   = await compositeAd({ rawImage, brandName, headline, adCopy, cta: cta || "Shop Now", platform, hashtags: hashtags || [], category });
  return await uploadToSupabase(buffer, campaignId, variantIndex);
}

// ── Main export: generate MULTIPLE ad variants (one at a time) ────────────────
// Pollinations' free tier only allows ~1 request in flight per IP, so we run these
// sequentially rather than in parallel to avoid 429s. Each variant uses a different
// shot style AND a widely-spread random seed so the 3 results actually look distinct.
// Returns an array of image URLs the user can choose between (default 3).
async function generateAdVariants(adCopy, brandName, category, platform, audience, headline, extraData = {}, count = 3) {
  // Speed (panel feedback from Review 1/2): with an API key Pollinations allows concurrent
  // requests, so the variants render in parallel (~1x the time of one image instead of ~3x).
  // Without a key the anonymous tier allows one request at a time, so we stay sequential.
  // Override with IMAGE_CONCURRENCY in .env.
  const hasKey = !!(process.env.POLLINATIONS_API_KEY || "").trim();
  const concurrency = Math.max(1, Math.min(count, Number(process.env.IMAGE_CONCURRENCY) || (hasKey ? count : 1)));

  const results = new Array(count).fill(null);
  let next = 0, fatal = null;
  async function worker() {
    while (next < count && !fatal) {
      const i = next++;
      // Fully independent random seed per variant: Flux can return near-identical images
      // for seeds that are close together.
      const seed = Math.floor(Math.random() * 1_000_000_000);
      try {
        results[i] = await generateOneVariant(adCopy, brandName, category, platform, audience, headline, extraData, seed, i);
      } catch (e) {
        console.error(`[Image variant ${i} failed]:`, e.message);
        if (e.fatal) fatal = e; // bad key / no credits: stop the other workers too
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));

  const images = results.filter(Boolean); // keeps variant order (shot styles stay aligned)
  if (images.length === 0) throw fatal || new Error("All image variants failed to generate");
  return images;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapText(ctx, text, maxWidth, font) {
  ctx.font = font;
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

module.exports = { generateAdVariants };
