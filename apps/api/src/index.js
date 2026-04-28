import "dotenv/config";
import express from "express";
import cors from "cors";
import prisma from "@ai-content/db";
import {
  generatePost,
  reviewPost,
  rewritePost,
  generateWeeklyAnalysis,
} from "@ai-content/ai";
import { postToPlatform } from "@ai-content/social";
import { generatePostImage, checkStatus as promptdeeStatus, getUsageStats } from "@ai-content/promptdee";

const app = express();
const PORT = process.env.API_PORT || 3001;

app.use(cors());
app.use(express.json());

// ═══════════════════════════════════════════════════════════════
// HELPERS — JSON parse for SQLite string fields
// ═══════════════════════════════════════════════════════════════

function parseJsonField(val, fallback = []) {
  if (!val) return fallback;
  if (Array.isArray(val)) return val;
  try { return JSON.parse(val); } catch { return fallback; }
}

function serializeConfig(c) {
  if (!c) return c;
  return {
    ...c,
    platforms: parseJsonField(c.platforms, ["twitter"]),
    doNotTouch: parseJsonField(c.doNotTouch, []),
  };
}

function serializePost(p) {
  if (!p) return p;
  return {
    ...p,
    hashtags: parseJsonField(p.hashtags, []),
    reviewDetails: parseJsonField(p.reviewDetails, null),
    engagement: parseJsonField(p.engagement, null),
  };
}

// ═══════════════════════════════════════════════════════════════
// HEALTH
// ═══════════════════════════════════════════════════════════════

app.get("/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", database: "connected", uptime: process.uptime() });
  } catch (error) {
    res.status(503).json({ status: "error", database: "disconnected", error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════

app.get("/config", async (req, res) => {
  try {
    const userId = req.query.userId || (await getDefaultUserId());
    const config = await prisma.config.findUnique({ where: { userId } });
    res.json(serializeConfig(config) || { error: "Config not found" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/config", async (req, res) => {
  try {
    const userId = req.body?.userId || (await getDefaultUserId());
    const { niche, tone, platforms, frequency, doNotTouch, brandVoice, language } = req.body || {};

    const data = {
      ...(niche && { niche }),
      ...(tone && { tone }),
      ...(platforms && { platforms: JSON.stringify(platforms) }),
      ...(frequency && { frequency }),
      ...(doNotTouch && { doNotTouch: JSON.stringify(doNotTouch) }),
      ...(brandVoice && { brandVoice }),
      ...(language && { language }),
    };

    const config = await prisma.config.upsert({
      where: { userId },
      update: data,
      create: {
        userId,
        niche: niche || "technology",
        tone: tone || "professional",
        platforms: JSON.stringify(platforms || ["twitter"]),
        frequency: frequency || 3,
        doNotTouch: JSON.stringify(doNotTouch || []),
        brandVoice: brandVoice || "informative and engaging",
        language: language || "en",
      },
    });

    await logActivity("config.updated", "Configuration updated", { userId });
    res.json(serializeConfig(config));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// POSTS
// ═══════════════════════════════════════════════════════════════

app.get("/posts", async (req, res) => {
  try {
    const userId = req.query.userId || (await getDefaultUserId());
    const { status, platform, limit = 50, offset = 0 } = req.query;

    const where = { userId };
    if (status) where.status = status;
    if (platform) where.platform = platform;

    const posts = await prisma.post.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: parseInt(limit),
      skip: parseInt(offset),
    });

    const total = await prisma.post.count({ where });
    res.json({ posts: posts.map(serializePost), total, limit: parseInt(limit), offset: parseInt(offset) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/posts/stats", async (req, res) => {
  try {
    const userId = req.query.userId || (await getDefaultUserId());

    const [total, drafts, approved, posted, rejected, avgResult] = await Promise.all([
      prisma.post.count({ where: { userId } }),
      prisma.post.count({ where: { userId, status: "draft" } }),
      prisma.post.count({ where: { userId, status: "approved" } }),
      prisma.post.count({ where: { userId, status: "posted" } }),
      prisma.post.count({ where: { userId, status: "rejected" } }),
      prisma.post.aggregate({ where: { userId }, _avg: { score: true } }),
    ]);

    res.json({
      total,
      byStatus: { draft: drafts, approved, posted, rejected },
      avgScore: Math.round(avgResult._avg.score || 0),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/posts/:id", async (req, res) => {
  try {
    const post = await prisma.post.findUnique({ where: { id: req.params.id } });
    if (!post) return res.status(404).json({ error: "Post not found" });
    res.json(serializePost(post));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// GENERATE (Full Pipeline)
// ═══════════════════════════════════════════════════════════════

app.post("/generate", async (req, res) => {
  try {
    const userId = req.body?.userId || (await getDefaultUserId());
    const rawConfig = await prisma.config.findUnique({ where: { userId } });

    if (!rawConfig) {
      return res.status(400).json({ error: "Config not found. Set up config first." });
    }

    const config = serializeConfig(rawConfig);
    await logActivity("generate.start", "Starting content generation", { userId });

    let attempts = 0;
    const MAX_ATTEMPTS = 3;
    let post = null;
    let review = null;
    let lastIssues = [];

    while (attempts < MAX_ATTEMPTS) {
      attempts++;
      console.log(`  📝 Generation attempt ${attempts}/${MAX_ATTEMPTS}...`);

      const retryContext =
        attempts > 1 && review
          ? { reason: lastIssues.join("; "), score: review.finalScore, previousContent: post.content }
          : null;

      post = await generatePost(config, retryContext);
      review = await reviewPost(post.content, config);
      console.log(`  📊 Review score: ${review.finalScore}/100 | Passed: ${review.passed}`);

      if (review.passed) break;

      lastIssues = review.issues;

      if (review.brandSafety?.passed && attempts < MAX_ATTEMPTS) {
        console.log("  ✏️ Rewriting based on review feedback...");
        const rewritten = await rewritePost(post.content, review.issues, config);
        post.content = rewritten.content;
        post.hook = rewritten.hook || post.hook;
        review = await reviewPost(post.content, config);
        if (review.passed) {
          console.log("  ✅ Rewrite passed review!");
          break;
        }
      }
    }

    const savedPost = await prisma.post.create({
      data: {
        userId,
        content: post.content,
        platform: post.platform || (Array.isArray(config.platforms) ? config.platforms[0] : "twitter"),
        score: review.finalScore,
        status: review.passed ? "approved" : "draft",
        topic: post.topic,
        hook: post.hook,
        hashtags: JSON.stringify(post.hashtags || []),
        reviewDetails: JSON.stringify(review),
        rejectionReason: review.passed ? null : lastIssues.join("; "),
      },
    });

    await logActivity(
      review.passed ? "generate.approved" : "generate.needs_review",
      `Content generated (attempt ${attempts}): score ${review.finalScore}/100`,
      { postId: savedPost.id, score: review.finalScore, attempts }
    );

    res.json({
      post: serializePost(savedPost),
      review: {
        score: review.finalScore,
        passed: review.passed,
        attempts,
        details: review,
      },
    });
  } catch (error) {
    console.error("Generate error:", error);
    await logActivity("generate.error", `Generation failed: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// POST / PUBLISH
// ═══════════════════════════════════════════════════════════════

app.post("/post/:id", async (req, res) => {
  try {
    const post = await prisma.post.findUnique({ where: { id: req.params.id } });
    if (!post) return res.status(404).json({ error: "Post not found" });
    if (post.status === "posted") return res.status(400).json({ error: "Already posted" });

    const result = await postToPlatform(post.platform, post.content);

    const updated = await prisma.post.update({
      where: { id: post.id },
      data: {
        status: "posted",
        publishedAt: new Date(),
        engagement: JSON.stringify({ postId: result.postId, url: result.url }),
      },
    });

    await logActivity("post.published", `Published to ${post.platform}`, { postId: post.id, platform: post.platform });
    res.json({ post: serializePost(updated), publishResult: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// DELETE POST
// ═══════════════════════════════════════════════════════════════

app.delete("/posts/:id", async (req, res) => {
  try {
    await prisma.post.delete({ where: { id: req.params.id } });
    await logActivity("post.deleted", "Post deleted", { postId: req.params.id });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// BATCH GENERATE
// ═══════════════════════════════════════════════════════════════

app.post("/generate/batch", async (req, res) => {
  try {
    const userId = req.body?.userId || (await getDefaultUserId());
    const count = Math.min(req.body?.count || 3, 10);
    const rawConfig = await prisma.config.findUnique({ where: { userId } });
    if (!rawConfig) return res.status(400).json({ error: "Config not found" });

    const config = serializeConfig(rawConfig);
    const results = [];

    for (let i = 0; i < count; i++) {
      try {
        const post = await generatePost(config);
        const review = await reviewPost(post.content, config);

        const saved = await prisma.post.create({
          data: {
            userId,
            content: post.content,
            platform: post.platform || (Array.isArray(config.platforms) ? config.platforms[0] : "twitter"),
            score: review.finalScore,
            status: review.passed ? "approved" : "draft",
            topic: post.topic,
            hook: post.hook,
            hashtags: JSON.stringify(post.hashtags || []),
            reviewDetails: JSON.stringify(review),
          },
        });
        results.push(serializePost(saved));
      } catch (e) {
        results.push({ error: e.message });
      }
    }

    await logActivity("generate.batch", `Batch generated ${count} posts`, { count });
    res.json({ posts: results, total: results.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// WEEKLY REPORT
// ═══════════════════════════════════════════════════════════════

app.get("/reports/weekly", async (req, res) => {
  try {
    const userId = req.query.userId || (await getDefaultUserId());
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const posts = await prisma.post.findMany({
      where: { userId, createdAt: { gte: weekAgo } },
      orderBy: { createdAt: "desc" },
    });

    const rawConfig = await prisma.config.findUnique({ where: { userId } });
    const config = serializeConfig(rawConfig);
    const analysis = await generateWeeklyAnalysis(posts.map(serializePost), config);

    const avgScore = posts.length > 0
      ? Math.round(posts.reduce((sum, p) => sum + p.score, 0) / posts.length)
      : 0;

    const bestPost = posts.reduce((best, p) => (p.score > (best?.score || 0) ? p : best), null);
    const worstPost = posts.reduce((worst, p) => (p.score < (worst?.score || Infinity) ? p : worst), null);

    res.json({
      period: { from: weekAgo.toISOString(), to: new Date().toISOString() },
      stats: {
        totalPosts: posts.length,
        avgScore,
        byStatus: {
          draft: posts.filter((p) => p.status === "draft").length,
          approved: posts.filter((p) => p.status === "approved").length,
          posted: posts.filter((p) => p.status === "posted").length,
          rejected: posts.filter((p) => p.status === "rejected").length,
        },
      },
      bestPost: bestPost ? { id: bestPost.id, score: bestPost.score, content: bestPost.content.substring(0, 150) } : null,
      worstPost: worstPost ? { id: worstPost.id, score: worstPost.score, content: worstPost.content.substring(0, 150) } : null,
      analysis,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// ACTIVITY LOG
// ═══════════════════════════════════════════════════════════════

app.get("/logs", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const logs = await prisma.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// CALENDAR / SCHEDULE
// ═══════════════════════════════════════════════════════════════

app.get("/calendar", async (req, res) => {
  try {
    const userId = req.query.userId || (await getDefaultUserId());
    const { month, year } = req.query;

    const now = new Date();
    const m = parseInt(month) || now.getMonth();
    const y = parseInt(year) || now.getFullYear();
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0, 23, 59, 59);

    const posts = await prisma.post.findMany({
      where: {
        userId,
        OR: [
          { scheduledAt: { gte: start, lte: end } },
          { publishedAt: { gte: start, lte: end } },
          { createdAt: { gte: start, lte: end } },
        ],
      },
      orderBy: { createdAt: "asc" },
    });

    const calendar = {};
    posts.forEach((p) => {
      const dateKey = (p.scheduledAt || p.publishedAt || p.createdAt)
        .toISOString()
        .split("T")[0];
      if (!calendar[dateKey]) calendar[dateKey] = [];
      calendar[dateKey].push(serializePost(p));
    });

    res.json({ month: m + 1, year, calendar, totalPosts: posts.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/posts/:id/schedule", async (req, res) => {
  try {
    const { scheduledAt } = req.body;
    if (!scheduledAt) return res.status(400).json({ error: "scheduledAt required (ISO date)" });

    const post = await prisma.post.update({
      where: { id: req.params.id },
      data: { scheduledAt: new Date(scheduledAt), status: "scheduled" },
    });

    await logActivity("post.scheduled", `Post scheduled for ${scheduledAt}`, { postId: post.id });
    res.json(serializePost(post));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/tasks", async (req, res) => {
  try {
    const userId = req.query.userId || (await getDefaultUserId());
    const now = new Date();

    const [upcoming, overdue, today] = await Promise.all([
      prisma.post.findMany({
        where: { userId, status: "scheduled", scheduledAt: { gt: now } },
        orderBy: { scheduledAt: "asc" },
        take: 20,
      }),
      prisma.post.findMany({
        where: { userId, status: "scheduled", scheduledAt: { lt: now } },
        orderBy: { scheduledAt: "asc" },
      }),
      prisma.post.findMany({
        where: {
          userId,
          scheduledAt: {
            gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
            lte: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59),
          },
        },
        orderBy: { scheduledAt: "asc" },
      }),
    ]);

    res.json({
      today: today.map(serializePost),
      upcoming: upcoming.map(serializePost),
      overdue: overdue.map(serializePost),
      summary: { today: today.length, upcoming: upcoming.length, overdue: overdue.length },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// IMAGE GENERATION (PromptDee)
// ═══════════════════════════════════════════════════════════════

app.post("/posts/:id/generate-image", async (req, res) => {
  try {
    const post = await prisma.post.findUnique({ where: { id: req.params.id } });
    if (!post) return res.status(404).json({ error: "Post not found" });

    const { imageUrl, imagePrompt } = await generatePostImage(post.content, post.topic || "social media");

    const updated = await prisma.post.update({
      where: { id: post.id },
      data: { mediaUrl: imageUrl, imagePrompt },
    });

    await logActivity("image.generated", "Image generated for post", { postId: post.id });
    res.json({ post: serializePost(updated), imageUrl, imagePrompt });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/promptdee/status", async (req, res) => {
  try {
    const status = await promptdeeStatus();
    const usage = await getUsageStats();
    res.json({ status, usage });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

async function getDefaultUserId() {
  let user = await prisma.user.findFirst({ where: { email: "admin@aicontent.local" } });
  if (!user) {
    user = await prisma.user.create({
      data: { email: "admin@aicontent.local", name: "Admin" },
    });
  }
  return user.id;
}

async function logActivity(action, message, details = null) {
  try {
    await prisma.activityLog.create({
      data: { action, message, details: details ? JSON.stringify(details) : null },
    });
  } catch (e) {
    console.error("Log error:", e.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// START
// ═══════════════════════════════════════════════════════════════

app.listen(PORT, () => {
  console.log(`\n🚀 API Server running on http://localhost:${PORT}`);
  console.log(`   Endpoints:`);
  console.log(`   GET  /health`);
  console.log(`   GET  /config`);
  console.log(`   POST /config`);
  console.log(`   GET  /posts`);
  console.log(`   GET  /posts/stats`);
  console.log(`   GET  /posts/:id`);
  console.log(`   POST /generate`);
  console.log(`   POST /generate/batch`);
  console.log(`   POST /post/:id`);
  console.log(`   DEL  /posts/:id`);
  console.log(`   GET  /reports/weekly`);
  console.log(`   GET  /logs\n`);
});
