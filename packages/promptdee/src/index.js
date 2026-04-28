// ═══════════════════════════════════════════════════════════════
// PROMPTDEE API INTEGRATION — PRODUCTION GRADE
// Free AI Chat + Image Generation + Prompt Enhancement
// ═══════════════════════════════════════════════════════════════

const BASE_URL = "https://www.promptdee.net/api";
const USER_ID = process.env.PROMPTDEE_USER_ID || "ai_content_system";

async function post(endpoint, payload, timeout = 30000) {
  payload.userId = USER_ID;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const res = await fetch(`${BASE_URL}/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timer);
    return await res.json();
  } catch (e) {
    return { success: false, message: e.message };
  }
}

async function get(endpoint, timeout = 10000) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const res = await fetch(`${BASE_URL}/${endpoint}`, { signal: controller.signal });
    clearTimeout(timer);
    return await res.json();
  } catch (e) {
    return { success: false, message: e.message };
  }
}

// ═══════════════════════════════════════════════════════════════
// IMAGE PROMPT ENGINEERING — EXPERT LEVEL
// ═══════════════════════════════════════════════════════════════

const STYLE_PRESETS = {
  modern: {
    suffix: "modern minimalist style, clean lines, gradient background, professional lighting, 4k ultra detailed, sharp focus, award-winning design",
    negative: "blurry, distorted, text, watermark, low quality, cartoon, anime",
  },
  cinematic: {
    suffix: "cinematic photography, dramatic lighting, shallow depth of field, film grain, anamorphic lens, color grading, volumetric light, 8k",
    negative: "flat lighting, overexposed, cartoon, illustration, text, watermark",
  },
  vibrant: {
    suffix: "vibrant colors, bold composition, eye-catching, social media optimized, high contrast, dynamic angles, trending on behance, 4k",
    negative: "muted colors, dark, blurry, text, watermark, low quality",
  },
  tech: {
    suffix: "futuristic technology, neon glow, dark background, holographic elements, circuit patterns, digital art, cyberpunk aesthetic, 4k ultra HD",
    negative: "hand drawn, sketch, low quality, text, watermark, blurry",
  },
  nature: {
    suffix: "natural lighting, golden hour, organic composition, earth tones, environmental photography, National Geographic style, 8k resolution",
    negative: "artificial, synthetic, cartoon, text, watermark, oversaturated",
  },
  flat: {
    suffix: "flat design illustration, vector art style, bold colors, clean shapes, modern graphic design, dribbble trending, high resolution",
    negative: "realistic, 3d, photographic, text, watermark, low quality, gradient",
  },
  luxury: {
    suffix: "luxury aesthetic, gold accents, marble texture, premium feel, elegant composition, studio lighting, high-end product photography, 8k",
    negative: "cheap, low quality, cartoon, text, watermark, cluttered",
  },
  infographic: {
    suffix: "clean infographic style, data visualization, icons, charts, professional layout, corporate design, white background, sharp vectors",
    negative: "messy, cluttered, low quality, text, watermark, hand drawn",
  },
};

const PLATFORM_SPECS = {
  twitter: { ratio: "16:9", maxChars: 280, style: "modern" },
  facebook: { ratio: "1.91:1", maxChars: 500, style: "vibrant" },
  instagram: { ratio: "1:1", maxChars: 2200, style: "cinematic" },
  linkedin: { ratio: "1.91:1", maxChars: 1300, style: "modern" },
  tiktok: { ratio: "9:16", maxChars: 150, style: "vibrant" },
  youtube: { ratio: "16:9", maxChars: 5000, style: "cinematic" },
};

function detectContentCategory(content, topic) {
  const text = `${content} ${topic}`.toLowerCase();

  if (/ai|tech|code|software|programming|digital|cyber|data|cloud|saas/.test(text)) return "tech";
  if (/food|cook|recipe|restaurant|meal|cuisine|chef/.test(text)) return "food";
  if (/fitness|workout|gym|health|exercise|yoga|nutrition/.test(text)) return "fitness";
  if (/travel|adventure|explore|destination|vacation|trip/.test(text)) return "travel";
  if (/money|finance|invest|stock|crypto|business|startup|entrepreneur/.test(text)) return "finance";
  if (/fashion|style|outfit|clothing|beauty|makeup|skincare/.test(text)) return "fashion";
  if (/education|learn|study|course|tutorial|knowledge|tip/.test(text)) return "education";
  if (/nature|environment|green|sustainable|eco|climate/.test(text)) return "nature";
  if (/luxury|premium|exclusive|高端|vip/.test(text)) return "luxury";
  return "modern";
}

function buildImagePrompt(content, topic, platform = "twitter") {
  const category = detectContentCategory(content, topic);
  const spec = PLATFORM_SPECS[platform] || PLATFORM_SPECS.twitter;
  const style = STYLE_PRESETS[spec.style] || STYLE_PRESETS.modern;

  const keyPhrases = content
    .replace(/[#@]\w+/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 15)
    .join(", ");

  const categoryPrompts = {
    tech: `Ultra-modern technology hero image: ${keyPhrases}. Sleek glassmorphism UI floating in space, holographic data visualization, ambient neon blue and purple glow, dark gradient background, bokeh light particles, Apple-level product photography, studio lighting with rim light accent, clean minimal composition with strong visual hierarchy. Shot on Hasselblad H6D, 85mm lens, f/1.4.`,

    food: `Michelin-star food photography: ${keyPhrases}. Artfully plated dish on dark slate surface, dramatic chiaroscuro lighting, steam rising, fresh herbs as garnish, copper utensils in background, shallow depth of field with creamy bokeh, overhead 45-degree angle, warm tungsten accent light, editorial food magazine cover quality. Phase One IQ4 150MP, 120mm macro lens.`,

    fitness: `High-energy fitness campaign shot: ${keyPhrases}. Athletic model in dynamic motion, dramatic side lighting with visible light rays, gym environment with modern equipment, sweat droplets frozen in motion, motivational atmosphere, dark moody background with pops of neon, Nike/Adidas campaign quality, sports photographer masterclass. Sony A1, 70-200mm f/2.8, high-speed sync flash.`,

    travel: `National Geographic award-winning landscape: ${keyPhrases}. Breathtaking vista, golden hour light painting the scene, dramatic cloud formations, leading lines drawing the eye, rich saturated colors, sense of scale with human element, ultra-wide perspective, hyperdetailed textures in rock and water, time-blended exposure for perfect dynamic range. DJI Mavic 3 Pro, Hasselblad lens, panoramic stitch.`,

    finance: `Bloomberg Terminal meets modern design: ${keyPhrases}. Clean data visualization with glowing charts, upward trend arrows in gold, dark navy background, premium glass desk setup, subtle city skyline bokeh through floor-to-ceiling windows, executive boardroom atmosphere, wealth and success imagery, Fortune 500 corporate photography quality. Phase One XT, 55mm lens.`,

    fashion: `Vogue editorial fashion spread: ${keyPhrases}. High-fashion model in striking pose, dramatic Rembrandt lighting, luxury fabric textures, bold color palette against minimalist backdrop, haute couture styling, artistic composition with negative space, museum-quality fashion photography, Dior/Chanel campaign aesthetic. Hasselblad X2D, 80mm f/1.9, Profoto lighting.`,

    education: `Premium educational content design: ${keyPhrases}. Clean modern infographic with depth, floating 3D elements, gradient mesh background, knowledge symbols rendered in glass and light, organized visual hierarchy, bright inviting palette with professional polish, Duolingo/Notion level design quality, isometric perspective with soft shadows.`,

    nature: `BBC Earth documentary still: ${keyPhrases}. Pristine wilderness, dramatic weather and lighting, rich organic textures, environmental storytelling, macro details in flora and fauna, conservation message, earth tones with vivid accents, time-lapse cloud trails, National Geographic photographer level composition. Nikon Z9, 400mm f/2.8 TC.`,

    luxury: `Robb Report luxury editorial: ${keyPhrases}. Premium materials—brushed gold, polished marble, Italian leather—arranged with precision, soft studio lighting with specular highlights, exclusive atmosphere, negative space for text overlay, high-end product placement, architectural digest meets haute horlogerie aesthetic. Sinar P3, 150mm lens, focus stacking.`,

    modern: `Apple-level product hero shot: ${keyPhrases}. Clean composition with strong focal point, subtle gradient background, professional studio lighting with soft fill and rim accent, geometric balance, contemporary aesthetic, premium feel with minimal elements, award-winning graphic design, perfect visual weight distribution. Phase One IQ4, 110mm lens, tethered capture.`,
  };

  const visualConcept = categoryPrompts[category] || categoryPrompts.modern;

  return `${visualConcept} Aspect ratio ${spec.ratio}. ${style.suffix}. Professional social media content image, scroll-stopping visual, high engagement potential. RAW quality, color graded in DaVinci Resolve, final output 8K resolution.`;
}

// ═══════════════════════════════════════════════════════════════
// API FUNCTIONS
// ═══════════════════════════════════════════════════════════════

export async function chat(message) {
  console.log(`💬 PromptDee [Chat]: ${message.substring(0, 60)}...`);
  const data = await post("ai-chat", { message });
  if (data.success) return data.response;
  throw new Error(data.message || "Chat failed");
}

export async function generateImage(prompt) {
  console.log(`🎨 PromptDee [Image]: ${prompt.substring(0, 80)}...`);
  const data = await post("generate-image", { prompt }, 60000);
  if (data.success) return data.imageUrl;
  throw new Error(data.message || "Image generation failed");
}

export async function enhancePrompt(rawPrompt) {
  console.log(`✨ PromptDee [Enhance]: ${rawPrompt.substring(0, 60)}...`);
  const data = await post("enhance-prompt", { prompt: rawPrompt });
  if (data.success) return data.enhanced_prompt;
  return rawPrompt;
}

export async function getUsageStats() {
  const data = await get(`usage/${USER_ID}`);
  if (data.today) return data.today;
  return { error: "Could not fetch usage" };
}

export async function checkStatus() {
  const data = await get("test");
  return data.status || "Offline";
}

// ═══════════════════════════════════════════════════════════════
// SMART IMAGE GENERATION — 3 LAYER PROMPT PIPELINE
// ═══════════════════════════════════════════════════════════════

export async function generatePostImage(content, topic, platform = "twitter") {
  console.log("🎨 [IMAGE PIPELINE] Starting 3-layer prompt engineering...");

  // Layer 1: Build expert prompt from content analysis
  const basePrompt = buildImagePrompt(content, topic, platform);
  console.log(`  Layer 1 (Base): ${basePrompt.substring(0, 100)}...`);

  // Layer 2: Enhance with PromptDee AI
  let enhancedPrompt;
  try {
    enhancedPrompt = await enhancePrompt(basePrompt.substring(0, 300));
    console.log(`  Layer 2 (Enhanced): ${enhancedPrompt.substring(0, 100)}...`);
  } catch (e) {
    enhancedPrompt = basePrompt;
    console.log(`  Layer 2 (Fallback): Using base prompt`);
  }

  // Layer 3: Final polish — add professional quality boosters
  const finalPrompt = `${enhancedPrompt.substring(0, 300)}, masterpiece, best quality, highly detailed, professional, trending on social media, high engagement visual, no text, no watermark, no logo, no signature, sharp focus, perfect exposure, magazine cover quality, award-winning photography`;

  console.log(`  Layer 3 (Final): ${finalPrompt.substring(0, 100)}...`);

  // Generate image
  const imageUrl = await generateImage(finalPrompt);

  return {
    imageUrl,
    imagePrompt: finalPrompt,
    layers: {
      base: basePrompt,
      enhanced: enhancedPrompt,
      final: finalPrompt,
    },
  };
}

// ═══════════════════════════════════════════════════════════════
// BATCH IMAGE GENERATION
// ═══════════════════════════════════════════════════════════════

export async function generateBatchImages(posts) {
  const results = [];
  for (const post of posts) {
    try {
      const result = await generatePostImage(post.content, post.topic, post.platform);
      results.push({ postId: post.id, ...result });
      await new Promise((r) => setTimeout(r, 2000));
    } catch (e) {
      results.push({ postId: post.id, error: e.message });
    }
  }
  return results;
}

export async function analyzeContentForImage(content) {
  const response = await chat(`Analyze this social media post and suggest the BEST visual style for maximum engagement:

"${content.substring(0, 300)}"

Reply with ONLY a JSON object:
{
  "mood": "energetic/calm/professional/playful/dramatic",
  "colors": ["primary color", "secondary color"],
  "composition": "centered/rule-of-thirds/symmetrical/dynamic",
  "elements": ["key visual element 1", "element 2"],
  "style": "photography/illustration/3d/abstract/minimalist"
}`);

  try {
    return JSON.parse(response);
  } catch {
    return { mood: "professional", colors: ["blue", "white"], composition: "centered", elements: ["abstract"], style: "minimalist" };
  }
}

export default {
  chat,
  generateImage,
  enhancePrompt,
  getUsageStats,
  checkStatus,
  generatePostImage,
  generateBatchImages,
  analyzeContentForImage,
  buildImagePrompt,
  STYLE_PRESETS,
  PLATFORM_SPECS,
};
