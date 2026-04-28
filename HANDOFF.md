# AI Content System — Handoff Document

## 📋 สถานะปัจจุบัน

| Module | Status | หมายเหตุ |
|--------|--------|----------|
| Project Structure (monorepo) | ✅ เสร็จ | npm workspaces |
| Database (SQLite + Prisma) | ✅ เสร็จ | schema, seed, migrate |
| AI Module (generate + review) | ✅ เสร็จ | 5-gate review, rewrite, weekly analysis |
| API Server (Express) | ✅ เสร็จ | 12 endpoints, tested |
| Worker (node-cron) | ✅ เสร็จ | auto-gen, auto-post, weekly report |
| Frontend (Next.js) | ✅ เสร็จ | 6 pages dashboard |
| Social Stubs | ✅ เสร็จ | Twitter/FB/LinkedIn/Instagram |
| OpenAI + Deepseek support | ✅ เสร็จ | base_url configurable |
| End-to-end test | ⚠️ ต้องใส่ API key | ไม่มี key = รันไม่ได้ |

---

## 🏗️ สิ่งที่มี (What's Built)

### Architecture
```
ai-content-system/          ← npm workspaces monorepo
├── apps/
│   ├── api/                ← Express API server (:3001)
│   ├── worker/             ← Cron scheduler (auto-gen + auto-post)
│   └── web/                ← Next.js dashboard (:3000)
├── packages/
│   ├── db/                 ← Prisma schema + SQLite
│   ├── ai/                 ← OpenAI/Deepseek integration
│   └── social/             ← Social media posting stubs
├── .env.example            ← Config template
├── docker-compose.yml      ← PostgreSQL + Redis (optional)
└── package.json            ← Root workspace config
```

### Database Schema (5 tables)
- **User** — id, email, name
- **Config** — niche, tone, platforms, frequency, doNotTouch, brandVoice, language
- **Post** — content, score, status, topic, hook, hashtags, reviewDetails, engagement
- **ActivityLog** — action, message, details
- **WeeklyReport** — stats, analysis, recommendations

### API Endpoints (12)
| Method | Path | ใช้ทำอะไร |
|--------|------|----------|
| GET | /health | เช็ค server + db |
| GET | /config | ดู config |
| POST | /config | ตั้งค่า config |
| GET | /posts | ดู posts (filter by status/platform) |
| GET | /posts/stats | สรุป stats |
| GET | /posts/:id | ดู post เดียว |
| POST | /generate | **Generate + 5-gate review** |
| POST | /generate/batch | Batch generate (สูงสุด 10) |
| POST | /post/:id | Publish post |
| DELETE | /posts/:id | ลบ post |
| GET | /reports/weekly | Weekly AI report |
| GET | /logs | Activity log |

### AI Review Pipeline (5 Gates)
1. **Brand Safety** — hate speech, misinformation, controversial topics → FAIL = ทิ้งทันที
2. **Fact Check** — verify claims → FAIL = regenerate
3. **Tone Match** — score 1-100 → < 70 = rewrite
4. **Quality & Engagement** — hook, clarity, CTA → < 75 = rewrite
5. **Uniqueness** — check against history → too similar = regenerate

### Frontend Dashboard (6 pages)
1. **📊 Dashboard** — stats grid + quick generate + recent posts
2. **🤖 Generate** — single/batch + 5-gate review visualization
3. **📝 All Posts** — filter by status, publish/delete
4. **⚙️ Config** — niche, tone, platforms, frequency, do-not-touch, brand voice, language
5. **📈 Reports** — weekly AI analysis with best/worst posts
6. **📋 Activity Log** — system activity history

### Worker (Cron Jobs)
- **Every 4 hours** — auto-generate content (respects daily frequency limit)
- **Every 6 hours** — auto-publish approved posts
- **Monday 9 AM** — weekly report generation

---

## ⚠️ สิ่งที่ต้องทำต่อ (TODO)

### จำเป็น (Required)
1. **ใส่ LLM API key** — แก้ `.env` ใส่ OpenAI หรือ Deepseek key
2. **Test generate จริง** — ทดสอบว่า AI content ออกมาดี
3. **ปรับ prompt tuning** — ปรับ system prompt ให้เหมาะกับ niche จริง

### ควรทำ (Nice to have)
4. **Social API integration** — เชื่อม Twitter/Facebook/LinkedIn จริง (ตอนนี้เป็น stub)
5. **Embedding-based uniqueness** — ใช้ pgvector เทียบ embedding (ตอนนี้ stub)
6. **Image generation** — เพิ่ม DALL-E/Flux สำหรับ generate รูป
7. **Authentication** — เพิ่ม login (ตอนนี้ใช้ default user)
8. **Deploy** — ขึ้น VPS/Railway/Vercel

---

## 🚀 วิธีติดตั้ง (Installation)

### ขั้นตอน
```bash
# 1. Clone repo
git clone https://github.com/YOUR_USERNAME/ai-content-system.git
cd ai-content-system

# 2. ติดตั้ง dependencies
npm install

# 3. Setup database
npx prisma generate --schema=packages/db/prisma/schema.prisma
npx prisma db push --schema=packages/db/prisma/schema.prisma
npm run db:seed

# 4. ตั้งค่า API key
cp .env.example .env
# แก้ .env ใส่ API key (OpenAI หรือ Deepseek)

# 5. รัน (3 terminals)
npm run dev:api       # Terminal 1 — API server :3001
npm run dev:worker    # Terminal 2 — Cron worker
npm run dev:web       # Terminal 3 — Frontend :3000

# 6. เปิด browser
open http://localhost:3000
```

### LLM Options
```bash
# OpenAI:
OPENAI_API_KEY="sk-..."
OPENAI_BASE_URL="https://api.openai.com/v1"
OPENAI_MODEL="gpt-4o"

# Deepseek:
OPENAI_API_KEY="sk-..."
OPENAI_BASE_URL="https://api.deepseek.com/v1"
OPENAI_MODEL="deepseek-chat"
```

---

## 🔄 Flow การทำงาน

```
User เปิด Dashboard (localhost:3000)
    │
    ├─ ตั้งค่า Config (niche, tone, platforms, frequency)
    │
    ├─ กด "Generate Post"
    │   │
    │   ▼
    │   API: POST /generate
    │   │
    │   ├─ 1. generatePost() ← เรียก LLM
    │   ├─ 2. reviewPost() ← 5-gate review
    │   │   ├─ Gate 1: Brand Safety (FAIL → ทิ้ง)
    │   │   ├─ Gate 2: Fact Check (FAIL → regenerate)
    │   │   ├─ Gate 3: Tone Match (< 70 → rewrite)
    │   │   ├─ Gate 4: Quality (< 75 → rewrite)
    │   │   └─ Gate 5: Uniqueness (too similar → regenerate)
    │   ├─ 3. ถ้าไม่ผ่าน → rewrite + review อีกรอบ (สูงสุด 3 ครั้ง)
    │   └─ 4. Save to DB → ส่งกลับ
    │
    ├─ ดู Posts → filter, publish, delete
    │
    ├─ Worker (background)
    │   ├─ ทุก 4 ชม: auto-generate ตาม frequency
    │   ├─ ทุก 6 ชม: auto-publish approved posts
    │   └─ จันทร์ 9 โมง: weekly report
    │
    └─ ดู Weekly Report → AI analysis + recommendations
```

---

## 📁 ไฟล์ทั้งหมด (23 files)

```
ai-content-system/
├── package.json                          ← Root workspace
├── .env.example                          ← Config template
├── .env                                  ← Actual config (gitignore)
├── docker-compose.yml                    ← PostgreSQL + Redis (optional)
├── HANDOFF.md                            ← This file
├── packages/
│   ├── db/
│   │   ├── package.json
│   │   ├── prisma/schema.prisma          ← Database schema
│   │   └── src/
│   │       ├── index.js                  ← Prisma client export
│   │       └── seed.js                   ← Sample data
│   ├── ai/
│   │   ├── package.json
│   │   └── src/index.js                  ← AI generate + 5-gate review
│   └── social/
│       ├── package.json
│       └── src/index.js                  ← Social media stubs
└── apps/
    ├── api/
    │   ├── package.json
    │   └── src/index.js                  ← Express API (12 endpoints)
    ├── worker/
    │   ├── package.json
    │   └── src/index.js                  ← Cron jobs
    └── web/
        ├── package.json
        ├── next.config.js                ← API proxy
        └── app/
            ├── layout.js                 ← HTML layout
            ├── globals.css               ← Dark theme styles
            └── page.js                   ← Dashboard (6 pages)
```
