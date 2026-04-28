// ═══════════════════════════════════════════════════════════════
// SOCIAL MEDIA POSTING MODULE
// Real API integration with fallback to stub
// ═══════════════════════════════════════════════════════════════

// ── Twitter/X (OAuth 1.0a + API v2) ──────────────────────────
export async function postToTwitter(content, credentials = null) {
  if (!credentials?.apiKey || !credentials?.accessToken) {
    console.log("🐦 [TWITTER] No credentials — stub mode");
    return { success: true, platform: "twitter", postId: `tw_${Date.now()}`, url: `https://twitter.com/user/status/${Date.now()}`, content: content.substring(0, 280), timestamp: new Date().toISOString(), stub: true };
  }

  try {
    const crypto = await import("crypto");
    const oauth = buildOAuth1Header("POST", "https://api.twitter.com/2/tweets", credentials);
    const res = await fetch("https://api.twitter.com/2/tweets", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: oauth },
      body: JSON.stringify({ text: content.substring(0, 280) }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || data.title || "Twitter API error");
    return { success: true, platform: "twitter", postId: data.data?.id, url: `https://twitter.com/i/status/${data.data?.id}`, content, timestamp: new Date().toISOString() };
  } catch (error) {
    console.error("🐦 [TWITTER] Error:", error.message);
    return { success: false, platform: "twitter", error: error.message };
  }
}

function buildOAuth1Header(method, url, creds) {
  const crypto = require("crypto");
  const oauthParams = {
    oauth_consumer_key: creds.apiKey,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: creds.accessToken,
    oauth_version: "1.0",
  };
  const paramString = Object.entries(oauthParams).sort().map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
  const signatureBase = `${method.toUpperCase()}&${encodeURIComponent(url)}&${encodeURIComponent(paramString)}`;
  const signingKey = `${encodeURIComponent(creds.apiSecret)}&${encodeURIComponent(creds.accessTokenSecret)}`;
  oauthParams.oauth_signature = crypto.createHmac("sha1", signingKey).update(signatureBase).digest("base64");
  return "OAuth " + Object.entries(oauthParams).sort().map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`).join(", ");
}

// ── Facebook (Graph API) ──────────────────────────────────────
export async function postToFacebook(content, credentials = null) {
  if (!credentials?.pageId || !credentials?.accessToken) {
    console.log("📘 [FACEBOOK] No credentials — stub mode");
    return { success: true, platform: "facebook", postId: `fb_${Date.now()}`, url: `https://facebook.com/posts/${Date.now()}`, content, timestamp: new Date().toISOString(), stub: true };
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${credentials.pageId}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: content, access_token: credentials.accessToken }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return { success: true, platform: "facebook", postId: data.id, url: `https://facebook.com/${data.id}`, content, timestamp: new Date().toISOString() };
  } catch (error) {
    console.error("📘 [FACEBOOK] Error:", error.message);
    return { success: false, platform: "facebook", error: error.message };
  }
}

// ── LinkedIn ──────────────────────────────────────────────────
export async function postToLinkedIn(content, credentials = null) {
  if (!credentials?.accessToken || !credentials?.personUrn) {
    console.log("💼 [LINKEDIN] No credentials — stub mode");
    return { success: true, platform: "linkedin", postId: `li_${Date.now()}`, url: `https://linkedin.com/posts/${Date.now()}`, content, timestamp: new Date().toISOString(), stub: true };
  }

  try {
    const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${credentials.accessToken}`, "X-Restli-Protocol-Version": "2.0.0" },
      body: JSON.stringify({
        author: credentials.personUrn,
        lifecycleState: "PUBLISHED",
        specificContent: { "com.linkedin.ugc.ShareContent": { shareCommentary: { text: content }, shareMediaCategory: "NONE" } },
        visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "LinkedIn API error");
    return { success: true, platform: "linkedin", postId: data.id, url: `https://linkedin.com/feed/update/${data.id}`, content, timestamp: new Date().toISOString() };
  } catch (error) {
    console.error("💼 [LINKEDIN] Error:", error.message);
    return { success: false, platform: "linkedin", error: error.message };
  }
}

// ── Instagram (via Facebook Graph API) ────────────────────────
export async function postToInstagram(content, credentials = null) {
  if (!credentials?.igUserId || !credentials?.accessToken) {
    console.log("📸 [INSTAGRAM] No credentials — stub mode");
    return { success: true, platform: "instagram", postId: `ig_${Date.now()}`, url: `https://instagram.com/p/${Date.now()}`, content, timestamp: new Date().toISOString(), stub: true };
  }

  try {
    // Step 1: Create media container
    const containerRes = await fetch(`https://graph.facebook.com/v19.0/${credentials.igUserId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caption: content.substring(0, 2200), access_token: credentials.accessToken }),
    });
    const container = await containerRes.json();
    if (container.error) throw new Error(container.error.message);

    // Step 2: Publish
    const publishRes = await fetch(`https://graph.facebook.com/v19.0/${credentials.igUserId}/media_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creation_id: container.id, access_token: credentials.accessToken }),
    });
    const published = await publishRes.json();
    if (published.error) throw new Error(published.error.message);

    return { success: true, platform: "instagram", postId: published.id, url: `https://instagram.com/p/${published.id}`, content, timestamp: new Date().toISOString() };
  } catch (error) {
    console.error("📸 [INSTAGRAM] Error:", error.message);
    return { success: false, platform: "instagram", error: error.message };
  }
}

const PLATFORM_MAP = {
  twitter: postToTwitter,
  facebook: postToFacebook,
  linkedin: postToLinkedIn,
  instagram: postToInstagram,
};

export async function postToPlatform(platform, content, credentials = null) {
  const fn = PLATFORM_MAP[platform];
  if (!fn) return { success: false, platform, error: `Unknown platform: ${platform}` };
  return fn(content, credentials);
}

export async function postToAll(content, platforms, credentialsMap = {}) {
  const results = [];
  for (const platform of platforms) {
    const creds = credentialsMap[platform] || null;
    results.push(await postToPlatform(platform, content, creds));
  }
  return results;
}

export default { postToTwitter, postToFacebook, postToLinkedIn, postToInstagram, postToPlatform, postToAll };
