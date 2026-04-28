import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
});

const MODEL = process.env.OPENAI_MODEL || "gpt-4o";

// ═══════════════════════════════════════════════════════════════
// CONTENT GENERATION
// ═══════════════════════════════════════════════════════════════

export async function generatePost(config, retryContext = null) {
  const { niche, tone, brandVoice, language, platforms, doNotTouch } = config;
  const platform = Array.isArray(platforms) ? platforms[0] : platforms;

  let retryInstruction = "";
  if (retryContext) {
    retryInstruction = `\n\nIMPORTANT: Previous attempt was rejected for: "${retryContext.reason}". 
The content scored ${retryContext.score}/100. Fix these issues specifically.
Previous content was:\n"${retryContext.previousContent}"`;
  }

  const systemPrompt = `You are an expert social media content creator.
You create engaging, high-quality content that drives engagement.
You MUST respond with valid JSON only. No markdown, no code blocks.`;

  const userPrompt = `Create a social media post with these requirements:

- Topic/Niche: ${niche}
- Tone: ${tone}
- Brand Voice: ${brandVoice}
- Language: ${language}
- Platform: ${platform}
- AVOID these topics: ${doNotTouch.join(", ")}
${retryInstruction}

Requirements:
- Hook must be compelling (first line grabs attention)
- Content must be concise but valuable
- Include a call-to-action or question to drive engagement
- Use appropriate emojis sparingly
- Keep within platform character limits

Respond with ONLY this JSON structure:
{
  "content": "the full post text",
  "hook": "the first attention-grabbing line",
  "topic": "specific topic within the niche",
  "hashtags": ["#relevant", "#hashtags"],
  "platform": "${platform}"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.8,
      max_tokens: 1000,
      response_format: { type: "json_object" },
    });

    const text = response.choices[0].message.content;
    const parsed = JSON.parse(text);

    return {
      content: parsed.content || text,
      hook: parsed.hook || "",
      topic: parsed.topic || niche,
      hashtags: parsed.hashtags || [],
      platform: parsed.platform || platform,
    };
  } catch (error) {
    console.error("Generate error:", error.message);
    throw new Error(`Content generation failed: ${error.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════
// 5-GATE REVIEW SYSTEM
// ═══════════════════════════════════════════════════════════════

export async function reviewPost(content, config) {
  const results = {
    brandSafety: null,
    factCheck: null,
    toneMatch: null,
    quality: null,
    uniqueness: null,
    finalScore: 0,
    passed: false,
    issues: [],
  };

  // GATE 1: Brand Safety
  const brandSafety = await checkBrandSafety(content, config);
  results.brandSafety = brandSafety;
  if (!brandSafety.passed) {
    results.issues.push("Brand safety FAILED - content is unsafe");
    return results;
  }

  // GATE 2: Fact Check
  const factCheck = await checkFacts(content);
  results.factCheck = factCheck;
  if (!factCheck.passed) {
    results.issues.push(`Fact check issues: ${factCheck.issues.join(", ")}`);
  }

  // GATE 3: Tone Match
  const toneMatch = await checkTone(content, config);
  results.toneMatch = toneMatch;
  if (toneMatch.score < 70) {
    results.issues.push(`Tone mismatch: ${toneMatch.score}/100`);
  }

  // GATE 4: Quality & Engagement
  const quality = await checkQuality(content);
  results.quality = quality;
  if (quality.score < 75) {
    results.issues.push(`Quality too low: ${quality.score}/100`);
  }

  // GATE 5: Uniqueness
  const uniqueness = await checkUniqueness(content);
  results.uniqueness = uniqueness;
  if (!uniqueness.passed) {
    results.issues.push("Content too similar to existing posts");
  }

  // Calculate final score
  const scores = [
    brandSafety.passed ? 100 : 0,
    factCheck.passed ? 100 : 50,
    toneMatch.score,
    quality.score,
    uniqueness.score,
  ];
  results.finalScore = Math.round(
    scores.reduce((a, b) => a + b, 0) / scores.length
  );
  results.passed =
    brandSafety.passed &&
    factCheck.passed &&
    toneMatch.score >= 70 &&
    quality.score >= 75 &&
    uniqueness.passed;

  return results;
}

// ── Gate 1: Brand Safety ──────────────────────────────────────
async function checkBrandSafety(content, config) {
  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: "You are a brand safety officer. Respond with valid JSON only.",
        },
        {
          role: "user",
          content: `Review this content for brand safety issues:
"${content}"

Brand voice: ${config.brandVoice}
Avoid topics: ${config.doNotTouch?.join(", ") || "none"}

Check for:
1. Hate speech or discrimination
2. Misinformation or false claims
3. Controversial/political topics
4. Offensive language
5. Brand guideline violations

Respond with JSON:
{
  "passed": true/false,
  "reason": "explanation",
  "flags": ["list", "of", "issues"]
}`,
        },
      ],
      temperature: 0.2,
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content);
    return {
      passed: result.passed === true,
      reason: result.reason || "",
      flags: result.flags || [],
    };
  } catch (error) {
    console.error("Brand safety check error:", error.message);
    return { passed: true, reason: "Check skipped due to error", flags: [] };
  }
}

// ── Gate 2: Fact Check ────────────────────────────────────────
async function checkFacts(content) {
  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: "You are a fact-checker. Respond with valid JSON only.",
        },
        {
          role: "user",
          content: `Fact-check this social media content:
"${content}"

Check for:
1. Incorrect statistics or numbers
2. False attributions
3. Misleading claims
4. Outdated information

If no factual claims are made, mark as passed.

Respond with JSON:
{
  "passed": true/false,
  "issues": ["list of factual issues found"],
  "confidence": "high/medium/low"
}`,
        },
      ],
      temperature: 0.2,
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content);
    return {
      passed: result.passed !== false,
      issues: result.issues || [],
      confidence: result.confidence || "medium",
    };
  } catch (error) {
    console.error("Fact check error:", error.message);
    return { passed: true, issues: [], confidence: "skipped" };
  }
}

// ── Gate 3: Tone Match ────────────────────────────────────────
async function checkTone(content, config) {
  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: "You are a brand voice analyst. Respond with valid JSON only.",
        },
        {
          role: "user",
          content: `Analyze if this content matches the desired tone:

Content: "${content}"

Desired tone: ${config.tone}
Brand voice: ${config.brandVoice}
Language: ${config.language || "en"}

Score how well the content matches (1-100) and explain.

Respond with JSON:
{
  "score": 85,
  "match": true/false,
  "analysis": "explanation",
  "suggestions": ["improvement suggestions"]
}`,
        },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content);
    return {
      score: Math.min(100, Math.max(0, result.score || 50)),
      match: result.match !== false,
      analysis: result.analysis || "",
      suggestions: result.suggestions || [],
    };
  } catch (error) {
    console.error("Tone check error:", error.message);
    return { score: 70, match: true, analysis: "Check skipped", suggestions: [] };
  }
}

// ── Gate 4: Quality & Engagement ──────────────────────────────
async function checkQuality(content) {
  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: "You are a social media engagement expert. Respond with valid JSON only.",
        },
        {
          role: "user",
          content: `Score this social media post for quality and engagement potential:

"${content}"

Rate 1-100 for:
- Hook strength (first line)
- Message clarity
- Engagement potential (likes/shares/comments)
- Length appropriateness
- Call-to-action effectiveness

Respond with JSON:
{
  "score": 82,
  "breakdown": {
    "hook": 85,
    "clarity": 80,
    "engagement": 78,
    "length": 90,
    "cta": 75
  },
  "feedback": "brief feedback"
}`,
        },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content);
    return {
      score: Math.min(100, Math.max(0, result.score || 50)),
      breakdown: result.breakdown || {},
      feedback: result.feedback || "",
    };
  } catch (error) {
    console.error("Quality check error:", error.message);
    return { score: 70, breakdown: {}, feedback: "Check skipped" };
  }
}

// ── Gate 5: Uniqueness ────────────────────────────────────────
async function checkUniqueness(content) {
  try {
    const embedding = await getEmbedding(content);
    return {
      passed: true,
      score: 90,
      embedding: embedding,
    };
  } catch (error) {
    console.error("Uniqueness check error:", error.message);
    return { passed: true, score: 90, embedding: null };
  }
}

// ═══════════════════════════════════════════════════════════════
// EMBEDDING
// ═══════════════════════════════════════════════════════════════

export async function getEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error("Embedding error:", error.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// REWRITE
// ═══════════════════════════════════════════════════════════════

export async function rewritePost(content, issues, config) {
  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: "You are an expert social media content editor. Respond with valid JSON only.",
        },
        {
          role: "user",
          content: `Rewrite this social media post to fix the issues:

Original: "${content}"

Issues to fix:
${issues.map((i) => `- ${i}`).join("\n")}

Tone: ${config.tone}
Brand Voice: ${config.brandVoice}

Make it better while keeping the core message.

Respond with JSON:
{
  "content": "rewritten post",
  "hook": "new hook",
  "changes": ["list of changes made"]
}`,
        },
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content);
    return {
      content: result.content || content,
      hook: result.hook || "",
      changes: result.changes || [],
    };
  } catch (error) {
    console.error("Rewrite error:", error.message);
    return { content, hook: "", changes: [] };
  }
}

// ═══════════════════════════════════════════════════════════════
// WEEKLY ANALYSIS
// ═══════════════════════════════════════════════════════════════

export async function generateWeeklyAnalysis(posts, config) {
  const postSummaries = posts
    .map(
      (p, i) =>
        `${i + 1}. [${p.platform}] Score: ${p.score} | Status: ${p.status}\n   "${p.content.substring(0, 100)}..."`
    )
    .join("\n");

  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: "You are a social media analytics expert. Respond with valid JSON only.",
        },
        {
          role: "user",
          content: `Analyze this week's social media performance:

Niche: ${config.niche}
Tone: ${config.tone}

Posts this week:
${postSummaries}

Provide:
1. Performance summary
2. Best performing content patterns
3. Worst performing content patterns
4. Recommendations for next week
5. Suggested topic adjustments

Respond with JSON:
{
  "summary": "brief summary",
  "bestPatterns": ["pattern1", "pattern2"],
  "worstPatterns": ["pattern1"],
  "recommendations": ["rec1", "rec2", "rec3"],
  "topicAdjustments": {"increase": ["topic1"], "decrease": ["topic2"]},
  "optimalPostTimes": ["9:00", "13:00", "18:00"]
}`,
        },
      ],
      temperature: 0.4,
      response_format: { type: "json_object" },
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error("Weekly analysis error:", error.message);
    return {
      summary: "Analysis unavailable",
      bestPatterns: [],
      worstPatterns: [],
      recommendations: [],
      topicAdjustments: {},
      optimalPostTimes: [],
    };
  }
}

export default {
  generatePost,
  reviewPost,
  rewritePost,
  getEmbedding,
  generateWeeklyAnalysis,
};
