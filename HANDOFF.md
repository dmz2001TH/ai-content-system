# 🤖 AI Content System — Agent Handoff

> Last updated: 2026-04-29 05:58 GMT+8
> Commit: `c455e39` — feat: auto image gen, platform credentials UI, pro image quality, image display in tasks

---

## 📋 Project Overview

**Repo:** https://github.com/dmz2001TH/ai-content-system
**Stack:** Next.js 15 + Express 5 + Prisma (SQLite) + DeepSeek AI + PromptDee Image Gen
**Structure:** Monorepo (npm workspaces)

```
apps/
  web/          → Next.js frontend (port 3000)
  api/          → Express API server (port 3001)
  worker/       → Cron worker (auto-generate, auto-post, weekly report)
packages/
  db/           → Prisma schema + SQLite database
  ai/           → DeepSeek AI integration (content gen, 5-gate review)
  social/       → Social media posting (Twitter, Facebook, LinkedIn, Instagram)
  promptdee/    → Image generation via PromptDee API
```

**Environment:** Windows, uses `.bat` file to start (`set DATABASE_URL=file:./dev.db`)
**AI Model:** DeepSeek Chat (`https://api.deepseek.com/v1`)
**Image Gen:** PromptDee (`https://www.promptdee.net/api`) — free, no key needed

---

## ✅ What's DONE

### Phase 1: Bug Fixes (Initial Request)
- [x] Diagnosed 500 Internal Server Error on all API endpoints
- [x] Root cause: Prisma DB not initialized + DATABASE_URL path mismatch
- [x] Fixed `DATABASE_URL` path in `.bat` → `file:./packages/db/prisma/dev.db`
- [x] Ran `prisma generate` + `prisma db push` to sync schema

### Phase 2: Feature — Auto Image Generation
- [x] **API `/generate`** — Auto-generates image after creating post (single + batch)
- [x] **API `/generate/batch`** — Same for batch generation
- [x] **Frontend Dashboard** — Shows generated image in "Last Review" panel
- [x] **Frontend Posts** — Image thumbnails display in post cards
- [x] **Frontend Tasks** — Images show for today/upcoming/overdue tasks
- [x] Removed manual "🎨 Image" button (now automatic)

### Phase 3: Feature — Platform Credentials UI
- [x] **Prisma schema** — Added `PlatformCredential` model (userId, platform, credentials JSON, isActive)
- [x] **API endpoints:**
  - `GET /platforms/credentials` — List credentials (masked for security)
  - `POST /platforms/credentials` — Save/update credentials
  - `DELETE /platforms/credentials/:platform` — Remove credentials
  - `POST /platforms/credentials/:platform/test` — Test connection
- [x] **Frontend Config page** — "🔗 Platform Connections" section with:
  - Twitter: API Key, API Secret, Access Token, Access Token Secret
  - Facebook: Page ID, Page Access Token
  - LinkedIn: Access Token, Person URN
  - Instagram: Instagram User ID, Access Token
  - Edit / Test / Delete buttons per platform
  - Connection status badges (✅ Connected / ⚪ Not set)

### Phase 4: Feature — Real Social Media Integration
- [x] **packages/social/src/index.js** — Real API calls (not just stubs):
  - Twitter: OAuth 1.0a + API v2
  - Facebook: Graph API v19.0
  - LinkedIn: UGC Posts API v2
  - Instagram: Facebook Graph API (media container → publish)
  - Falls back to stub mode when no credentials stored
- [x] **API publish endpoint** — Uses stored credentials from DB

### Phase 5: Feature — Professional Image Quality
- [x] **packages/promptdee/src/index.js** — Upgraded prompts:
  - Camera/lens specs (Hasselblad H6D, Phase One IQ4, Sony A1)
  - Lighting techniques (Rembrandt, chiaroscuro, rim light)
  - Professional references (Vogue, Bloomberg, National Geographic, Apple)
  - 8K resolution, DaVinci Resolve color grading
  - Per-category specialized prompts (tech, food, fitness, travel, finance, fashion, education, nature, luxury)

---

## ❌ What's NOT Done / Known Issues

### Not Implemented
- [ ] **Seed data** — `packages/db/src/seed.js` exists but may need updating for new schema
- [ ] **Worker auto-image** — `apps/worker/src/index.js` still generates posts WITHOUT auto-images (only API does)
- [ ] **Image in post preview** — `/posts/:id/preview` endpoint doesn't include image display
- [ ] **Delete old images** — No cleanup when regenerating images
- [ ] **Image upload** — Can't upload custom images, only AI-generated

### Known Issues
- [ ] **Express 5 compatibility** — Using `express@^5.1.0`, some edge cases may exist
- [ ] **Prisma EPERM on Windows** — `prisma generate` fails if files are locked by running process. Workaround: stop dev server first, delete `node_modules/.prisma/client/`, then regenerate
- [ ] **DATABASE_URL path** — Relative path `file:./dev.db` resolves differently depending on CWD. Current fix: `.bat` sets absolute-ish path. May need `file:./packages/db/prisma/dev.db` in `.env` too
- [ ] **`/posts/search` route order** — Defined AFTER `/posts/:id`, so "search" gets matched as `:id`. Should be moved before `/posts/:id`
- [ ] **PromptDee rate limits** — Image gen has 2s delay between batch requests. May hit limits on large batches
- [ ] **OAuth 1.0a for Twitter** — Uses `require("crypto")` in ESM module (should be `import`)

### Security Notes
- [ ] **`.bat` file has API key** — Should be in `.gitignore`, use `.env` instead
- [ ] **Credentials stored as plain JSON** — Should encrypt at rest
- [ ] **GitHub token in chat** — User shared PAT in conversation, consider rotating

---

## 🔧 How to Run (Windows)

```bat
# 1. Clone
git clone https://github.com/dmz2001TH/ai-content-system.git
cd ai-content-system

# 2. Install
npm install

# 3. Setup DB
cd packages\db
npx prisma generate
npx prisma db push
cd ..\..

# 4. Create .env (copy from .env.example)
# Set DATABASE_URL=file:./packages/db/prisma/dev.db

# 5. Run
npm run dev
```

**Access:** http://localhost:3000

---

## 🗺️ Architecture Flow

```
User opens http://localhost:3000
    ↓
Next.js (web) serves React dashboard
    ↓
Frontend calls /api/* endpoints
    ↓
Next.js rewrites /api/* → http://localhost:3001/*
    ↓
Express API (port 3001)
    ├── GET/POST /config → Prisma (SQLite)
    ├── POST /generate → DeepSeek AI (content) + PromptDee (image) + Prisma (save)
    ├── GET /posts → Prisma
    ├── POST /post/:id → Social module (with stored credentials)
    ├── GET/POST /platforms/credentials → Prisma
    └── ... other endpoints
    ↓
Worker (cron) runs independently
    ├── Every 4h: Generate posts (no auto-image)
    ├── Every 6h: Auto-post approved content
    └── Monday 9AM: Weekly report
```

---

## 📝 Next Agent TODO (Priority Order)

1. **Fix `/posts/search` route order** — Move before `/posts/:id` in API
2. **Add auto-image to Worker** — Worker should also generate images
3. **Encrypt platform credentials** — Don't store API tokens as plain JSON
4. **Add `.env.example` to repo, `.bat` to `.gitignore`**
5. **Fix Twitter OAuth** — Change `require("crypto")` to `import`
6. **Test all platform integrations** — Verify real API calls work
7. **Add image regeneration** — Allow re-generating images for existing posts
8. **Add custom image upload** — Let users upload their own images

---

