import "dotenv/config";
import cron from "node-cron";
import prisma from "@ai-content/db";
import {
  generatePost,
  reviewPost,
  rewritePost,
  generateWeeklyAnalysis,
} from "@ai-content/ai";
import { postToPlatform } from "@ai-content/social";

console.log("🤖 AI Content Worker starting...\n");

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
    console.log(`📋 ${action}: ${message}`);
  } catch (e) {
    console.error("Log error:", e.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// CONTENT GENERATION JOB (every 4 hours)
// ═══════════════════════════════════════════════════════════════

async function runContentGeneration() {
  console.log("\n⏰ [CONTENT GEN] Running scheduled content generation...");

  try {
    const userId = await getDefaultUserId();
    const rawConfig = await prisma.config.findUnique({ where: { userId } });

    if (!rawConfig) {
      console.log("⚠️  No config found, skipping...");
      return;
    }

    const config = serializeConfig(rawConfig);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayPosts = await prisma.post.count({
      where: { userId, createdAt: { gte: today } },
    });

    if (todayPosts >= config.frequency) {
      console.log(`✅ Already ${todayPosts}/${config.frequency} posts today. Skipping.`);
      return;
    }

    const needed = config.frequency - todayPosts;
    console.log(`📊 Need ${needed} more posts today (have ${todayPosts}/${config.frequency})`);

    for (let i = 0; i < needed; i++) {
      console.log(`\n  📝 Generating post ${i + 1}/${needed}...`);

      let attempts = 0;
      const MAX_ATTEMPTS = 3;
      let post = null;
      let review = null;

      while (attempts < MAX_ATTEMPTS) {
        attempts++;
        const retryContext =
          attempts > 1 && review
            ? { reason: review.issues.join("; "), score: review.finalScore, previousContent: post.content }
            : null;

        post = await generatePost(config, retryContext);
        review = await reviewPost(post.content, config);
        console.log(`    Score: ${review.finalScore}/100 | Passed: ${review.passed}`);

        if (review.passed) break;

        if (review.brandSafety?.passed && attempts < MAX_ATTEMPTS) {
          const rewritten = await rewritePost(post.content, review.issues, config);
          post.content = rewritten.content;
          post.hook = rewritten.hook || post.hook;
          review = await reviewPost(post.content, config);
          if (review.passed) break;
        }
      }

      await prisma.post.create({
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
          rejectionReason: review.passed ? null : review.issues.join("; "),
        },
      });

      await logActivity(
        review.passed ? "cron.approved" : "cron.draft",
        `Auto-generated: ${review.finalScore}/100`
      );

      if (i < needed - 1) await new Promise((r) => setTimeout(r, 2000));
    }

    console.log("\n✅ Content generation complete!");
  } catch (error) {
    console.error("❌ Content gen error:", error.message);
    await logActivity("cron.error", `Generation failed: ${error.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════
// AUTO-POST JOB (every 6 hours)
// ═══════════════════════════════════════════════════════════════

async function runAutoPost() {
  console.log("\n📤 [AUTO-POST] Publishing approved posts...");

  try {
    const approved = await prisma.post.findMany({
      where: { status: "approved" },
      orderBy: { score: "desc" },
      take: 3,
    });

    if (approved.length === 0) {
      console.log("  No approved posts to publish.");
      return;
    }

    for (const post of approved) {
      const result = await postToPlatform(post.platform, post.content);

      await prisma.post.update({
        where: { id: post.id },
        data: {
          status: "posted",
          publishedAt: new Date(),
          engagement: JSON.stringify({ postId: result.postId, url: result.url }),
        },
      });

      await logActivity("cron.posted", `Auto-posted to ${post.platform}`, { postId: post.id });
      await new Promise((r) => setTimeout(r, 1000));
    }

    console.log(`  ✅ Published ${approved.length} posts`);
  } catch (error) {
    console.error("❌ Auto-post error:", error.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// WEEKLY REPORT JOB (Monday 9 AM)
// ═══════════════════════════════════════════════════════════════

async function runWeeklyReport() {
  console.log("\n📊 [WEEKLY REPORT] Generating...");

  try {
    const userId = await getDefaultUserId();
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const posts = await prisma.post.findMany({
      where: { userId, createdAt: { gte: weekAgo } },
    });

    const rawConfig = await prisma.config.findUnique({ where: { userId } });
    const config = serializeConfig(rawConfig);
    const analysis = await generateWeeklyAnalysis(posts, config);

    const avgScore = posts.length > 0
      ? Math.round(posts.reduce((s, p) => s + p.score, 0) / posts.length)
      : 0;

    const report = {
      totalPosts: posts.length,
      avgScore,
      byStatus: {
        draft: posts.filter((p) => p.status === "draft").length,
        approved: posts.filter((p) => p.status === "approved").length,
        posted: posts.filter((p) => p.status === "posted").length,
      },
      analysis,
    };

    console.log(`\n  📋 Weekly Summary:`);
    console.log(`     Posts: ${report.totalPosts}`);
    console.log(`     Avg Score: ${report.avgScore}`);
    console.log(`     Posted: ${report.byStatus.posted}`);
    console.log(`     Approved: ${report.byStatus.approved}`);
    console.log(`     Drafts: ${report.byStatus.draft}`);

    if (analysis.recommendations?.length > 0) {
      console.log(`\n  💡 Recommendations:`);
      analysis.recommendations.forEach((r) => console.log(`     • ${r}`));
    }

    await logActivity("report.weekly", "Weekly report generated", report);
  } catch (error) {
    console.error("❌ Weekly report error:", error.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// CRON SCHEDULES
// ═══════════════════════════════════════════════════════════════

cron.schedule("0 */4 * * *", runContentGeneration);
cron.schedule("0 */6 * * *", runAutoPost);
cron.schedule("0 9 * * 1", runWeeklyReport);

console.log("📅 Scheduled jobs:");
console.log("   • Content generation: every 4 hours");
console.log("   • Auto-post: every 6 hours");
console.log("   • Weekly report: Monday 9:00 AM");
console.log("\n⏳ Waiting for next scheduled run...\n");

// Run initial generation on startup (after 10 seconds)
setTimeout(async () => {
  console.log("🚀 Running initial content generation...");
  await runContentGeneration();
}, 10000);
