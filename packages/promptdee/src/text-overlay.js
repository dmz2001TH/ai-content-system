// ═══════════════════════════════════════════════════════════════
// TEXT OVERLAY MODULE
// Renders clean text on AI-generated images
// Supports Thai + English with professional typography
// ═══════════════════════════════════════════════════════════════

import { createCanvas, loadImage, registerFont } from "canvas";
import sharp from "sharp";
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FONTS_DIR = join(__dirname, "..", "fonts");

// Register Thai fonts
const regularFont = join(FONTS_DIR, "NotoSansThai-Regular.ttf");
const boldFont = join(FONTS_DIR, "NotoSansThai-Bold.ttf");

if (existsSync(regularFont)) registerFont(regularFont, { family: "Noto Sans Thai", weight: "normal" });
if (existsSync(boldFont)) registerFont(boldFont, { family: "Noto Sans Thai", weight: "bold" });

// ═══════════════════════════════════════════════════════════════
// STYLE PRESETS
// ═══════════════════════════════════════════════════════════════

const STYLES = {
  modern: {
    overlay: "gradient",
    gradientColors: ["rgba(0,0,0,0.7)", "rgba(0,0,0,0.3)", "rgba(0,0,0,0.0)"],
    textColor: "#ffffff",
    accentColor: "#6366f1",
    fontFamily: '"Noto Sans Thai", "Noto Sans", Arial, sans-serif',
    titleSize: 42,
    bodySize: 24,
    padding: 60,
    textAlign: "left",
    shadowColor: "rgba(0,0,0,0.5)",
    shadowBlur: 8,
    badge: true,
  },
  minimal: {
    overlay: "solid",
    overlayColor: "rgba(0,0,0,0.55)",
    textColor: "#ffffff",
    accentColor: "#10b981",
    fontFamily: '"Noto Sans Thai", "Noto Sans", Arial, sans-serif',
    titleSize: 38,
    bodySize: 22,
    padding: 50,
    textAlign: "center",
    shadowColor: "rgba(0,0,0,0.6)",
    shadowBlur: 6,
    badge: false,
  },
  bold: {
    overlay: "gradient",
    gradientColors: ["rgba(99,102,241,0.85)", "rgba(139,92,246,0.6)", "rgba(0,0,0,0.0)"],
    textColor: "#ffffff",
    accentColor: "#fbbf24",
    fontFamily: '"Noto Sans Thai", "Noto Sans", Arial, sans-serif',
    titleSize: 46,
    bodySize: 26,
    padding: 55,
    textAlign: "left",
    shadowColor: "rgba(0,0,0,0.4)",
    shadowBlur: 10,
    badge: true,
  },
  elegant: {
    overlay: "gradient",
    gradientColors: ["rgba(0,0,0,0.8)", "rgba(0,0,0,0.4)", "rgba(0,0,0,0.0)"],
    textColor: "#f5f5f5",
    accentColor: "#d4a574",
    fontFamily: '"Noto Sans Thai", "Noto Sans", Arial, sans-serif',
    titleSize: 40,
    bodySize: 22,
    padding: 60,
    textAlign: "left",
    shadowColor: "rgba(0,0,0,0.5)",
    shadowBlur: 12,
    badge: true,
  },
  tech: {
    overlay: "gradient",
    gradientColors: ["rgba(15,23,42,0.9)", "rgba(30,41,59,0.5)", "rgba(0,0,0,0.0)"],
    textColor: "#e2e8f0",
    accentColor: "#22d3ee",
    fontFamily: '"Noto Sans Thai", "Noto Sans", Arial, sans-serif',
    titleSize: 40,
    bodySize: 22,
    padding: 55,
    textAlign: "left",
    shadowColor: "rgba(0,0,0,0.6)",
    shadowBlur: 8,
    badge: true,
  },
};

// ═══════════════════════════════════════════════════════════════
// HELPER: Load image from URL (handles WebP via sharp)
// ═══════════════════════════════════════════════════════════════

async function loadImageFromUrl(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());

  // Convert to PNG using sharp (handles WebP, AVIF, etc.)
  const pngBuffer = await sharp(buffer).png().toBuffer();
  return loadImage(pngBuffer);
}

// ═══════════════════════════════════════════════════════════════
// TEXT WRAPPING
// ═══════════════════════════════════════════════════════════════

function wrapText(ctx, text, maxWidth) {
  const words = text.split("");
  const lines = [];
  let currentLine = "";

  for (const char of words) {
    if (char === "\n") {
      lines.push(currentLine);
      currentLine = "";
      continue;
    }
    const testLine = currentLine + char;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = char;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

// ═══════════════════════════════════════════════════════════════
// MAIN OVERLAY FUNCTION
// ═══════════════════════════════════════════════════════════════

export async function overlayText(imageUrl, options = {}) {
  const {
    hook = "",
    content = "",
    hashtags = [],
    platform = "twitter",
    style = "modern",
  } = options;

  const preset = STYLES[style] || STYLES.modern;

  // Load background image (handles WebP via sharp)
  const image = await loadImageFromUrl(imageUrl);

  // Canvas dimensions based on platform
  const dimensions = {
    twitter: { width: 1200, height: 675 },
    facebook: { width: 1200, height: 630 },
    instagram: { width: 1080, height: 1080 },
    linkedin: { width: 1200, height: 627 },
    tiktok: { width: 1080, height: 1920 },
  };

  const { width, height } = dimensions[platform] || dimensions.twitter;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // ── Draw background image (cover) ──
  const imgRatio = image.width / image.height;
  const canvasRatio = width / height;
  let sx = 0, sy = 0, sw = image.width, sh = image.height;

  if (imgRatio > canvasRatio) {
    sw = image.height * canvasRatio;
    sx = (image.width - sw) / 2;
  } else {
    sh = image.width / canvasRatio;
    sy = (image.height - sh) / 2;
  }

  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, width, height);

  // ── Draw overlay ──
  if (preset.overlay === "gradient") {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    const colors = preset.gradientColors;
    colors.forEach((color, i) => {
      gradient.addColorStop(i / (colors.length - 1), color);
    });
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  } else if (preset.overlay === "solid") {
    ctx.fillStyle = preset.overlayColor;
    ctx.fillRect(0, 0, width, height);
  }

  // ── Draw accent line ──
  const p = preset.padding;
  ctx.fillStyle = preset.accentColor;
  ctx.fillRect(p, p, 4, height - p * 2);

  // ── Draw hook (title) ──
  ctx.save();
  ctx.shadowColor = preset.shadowColor;
  ctx.shadowBlur = preset.shadowBlur;
  ctx.fillStyle = preset.textColor;
  ctx.font = `bold ${preset.titleSize}px ${preset.fontFamily}`;
  ctx.textAlign = preset.textAlign;

  const textX = preset.textAlign === "center" ? width / 2 : p + 24;
  const maxTextWidth = width - p * 2 - 40;
  const hookLines = wrapText(ctx, hook, maxTextWidth);
  const hookLineHeight = preset.titleSize * 1.3;

  let yOffset = p + preset.titleSize + 10;
  for (const line of hookLines.slice(0, 3)) {
    ctx.fillText(line, textX, yOffset);
    yOffset += hookLineHeight;
  }

  // ── Draw content (body) ──
  if (content && content !== hook) {
    ctx.font = `${preset.bodySize}px ${preset.fontFamily}`;
    ctx.fillStyle = `${preset.textColor}cc`;
    const bodyLines = wrapText(ctx, content, maxTextWidth);
    const bodyLineHeight = preset.bodySize * 1.5;

    yOffset += 10;
    for (const line of bodyLines.slice(0, 4)) {
      ctx.fillText(line, textX, yOffset);
      yOffset += bodyLineHeight;
    }
  }

  // ── Draw hashtags ──
  if (hashtags.length > 0) {
    ctx.font = `bold ${preset.bodySize - 4}px ${preset.fontFamily}`;
    ctx.fillStyle = preset.accentColor;
    const hashtagText = hashtags.slice(0, 5).join("  ");
    yOffset += 15;
    ctx.fillText(hashtagText, textX, yOffset);
  }

  // ── Draw badge ──
  if (preset.badge) {
    const badgeText = platform.toUpperCase();
    ctx.font = `bold 14px ${preset.fontFamily}`;
    const badgeWidth = ctx.measureText(badgeText).width + 24;
    const badgeX = width - badgeWidth - 20;
    const badgeY = 20;

    ctx.fillStyle = preset.accentColor;
    roundRect(ctx, badgeX, badgeY, badgeWidth, 28, 14);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.fillText(badgeText, badgeX + badgeWidth / 2, badgeY + 19);
  }

  ctx.restore();

  // Return as buffer
  return canvas.toBuffer("image/png");
}

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

export default { overlayText, STYLES };
