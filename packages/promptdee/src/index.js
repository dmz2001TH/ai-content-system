// ═══════════════════════════════════════════════════════════════
// PROMPTDEE API INTEGRATION
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

    const res = await fetch(`${BASE_URL}/${endpoint}`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    return await res.json();
  } catch (e) {
    return { success: false, message: e.message };
  }
}

// ── Chat (gpt-4o-mini) ───────────────────────────────────────
export async function chat(message) {
  console.log(`💬 PromptDee [Chat]: ${message.substring(0, 60)}...`);
  const data = await post("ai-chat", { message });
  if (data.success) return data.response;
  throw new Error(data.message || "Chat failed");
}

// ── Image Generation (flux-schnell) ───────────────────────────
export async function generateImage(prompt) {
  console.log(`🎨 PromptDee [Image]: ${prompt.substring(0, 60)}...`);
  const data = await post("generate-image", { prompt }, 60000);
  if (data.success) return data.imageUrl;
  throw new Error(data.message || "Image generation failed");
}

// ── Prompt Enhancement ────────────────────────────────────────
export async function enhancePrompt(rawPrompt) {
  console.log(`✨ PromptDee [Enhance]: ${rawPrompt.substring(0, 60)}...`);
  const data = await post("enhance-prompt", { prompt: rawPrompt });
  if (data.success) return data.enhanced_prompt;
  return rawPrompt; // fallback
}

// ── Usage Stats ───────────────────────────────────────────────
export async function getUsageStats() {
  const data = await get(`usage/${USER_ID}`);
  if (data.today) return data.today;
  return { error: "Could not fetch usage" };
}

// ── Server Status ─────────────────────────────────────────────
export async function checkStatus() {
  const data = await get("test");
  return data.status || "Offline";
}

// ── Generate Image for Post ───────────────────────────────────
export async function generatePostImage(content, topic) {
  // Create a good image prompt from the post content
  const imagePrompt = await chat(
    `Create a short, vivid image generation prompt (max 100 words) for a social media post about: "${topic}". The image should be eye-catching, modern, and suitable for social media. Return ONLY the prompt, nothing else.`
  );

  // Enhance the prompt for better image quality
  const enhanced = await enhancePrompt(imagePrompt.substring(0, 200));

  // Generate the image
  const imageUrl = await generateImage(enhanced.substring(0, 200));

  return { imageUrl, imagePrompt: enhanced };
}

export default {
  chat,
  generateImage,
  enhancePrompt,
  getUsageStats,
  checkStatus,
  generatePostImage,
};
