import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seed() {
  console.log("🌱 Seeding database...");

  const user = await prisma.user.upsert({
    where: { email: "admin@aicontent.local" },
    update: {},
    create: {
      email: "admin@aicontent.local",
      name: "Admin",
    },
  });

  await prisma.config.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      niche: "technology",
      tone: "professional",
      platforms: JSON.stringify(["twitter", "facebook", "linkedin"]),
      frequency: 3,
      doNotTouch: JSON.stringify(["politics", "religion", "controversial"]),
      brandVoice: "informative, engaging, and slightly witty",
      language: "en",
    },
  });

  const samplePosts = [
    {
      userId: user.id,
      content: "🚀 The future of AI is here. Tools like GPT-4o are changing how we build software. What's your take on AI-assisted development?",
      platform: "twitter",
      score: 87,
      status: "posted",
      topic: "AI development",
      hook: "The future of AI is here",
      hashtags: JSON.stringify(["#AI", "#Tech", "#Future"]),
      publishedAt: new Date(),
    },
    {
      userId: user.id,
      content: "5 lessons I learned building production systems:\n\n1. Start simple\n2. Automate early\n3. Monitor everything\n4. Fail fast\n5. Document as you go\n\nWhich one resonates most with you?",
      platform: "twitter",
      score: 92,
      status: "posted",
      topic: "software engineering",
      hook: "5 lessons I learned",
      hashtags: JSON.stringify(["#Engineering", "#DevOps", "#TechTips"]),
      publishedAt: new Date(Date.now() - 86400000),
    },
    {
      userId: user.id,
      content: "Remote work isn't just about working from home — it's about designing your ideal environment. Here's how top engineers structure their day for maximum output...",
      platform: "linkedin",
      score: 78,
      status: "approved",
      topic: "productivity",
      hook: "Remote work isn't just about working from home",
      hashtags: JSON.stringify(["#RemoteWork", "#Productivity"]),
    },
    {
      userId: user.id,
      content: "Draft: Exploring the impact of edge computing on IoT devices in 2026.",
      platform: "twitter",
      score: 65,
      status: "draft",
      topic: "edge computing",
      hook: "Exploring the impact",
      hashtags: JSON.stringify(["#EdgeComputing", "#IoT"]),
    },
  ];

  for (const post of samplePosts) {
    await prisma.post.create({ data: post });
  }

  await prisma.activityLog.createMany({
    data: [
      { action: "system.start", message: "AI Content System initialized" },
      { action: "seed.complete", message: "Default user and config created" },
    ],
  });

  console.log("✅ Seed complete");
  console.log(`   User: ${user.email} (${user.id})`);
}

seed()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
