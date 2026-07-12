#!/usr/bin/env node
/**
 * Auto-tag postcard images with Traditional Chinese search tags using Claude vision.
 *
 * Reads each image from ./data/uploads and writes 3-10 Traditional Chinese tags
 * into the `tags` column of ./data/postcards.sqlite. The tags power search only
 * (the UI shows the top 2-3 as chips); they don't need to be visible to be useful.
 *
 * Run it in an SSH session on Render to tag your live 1,040, or locally for a
 * local copy. It's resumable — only untagged postcards are processed, so if the
 * session drops just reconnect and run it again.
 *
 * Usage:
 *   npm run tag                            # tag all untagged postcards
 *   node scripts/tag-images.mjs --limit 10 # test on a few first
 *   node scripts/tag-images.mjs --retag    # re-tag everything
 *
 * Environment:
 *   ANTHROPIC_API_KEY   required
 *   TAG_MODEL           optional (default: claude-haiku-4-5-20251001)
 *
 * Requires Node 18+.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import Database from "better-sqlite3";

const DB_PATH = path.join(process.cwd(), "data", "postcards.sqlite");
const UPLOAD_DIRS = [
  path.join(process.cwd(), "data", "uploads"),
  path.join(process.cwd(), "public", "uploads")
];

const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.TAG_MODEL ?? "claude-haiku-4-5-20251001";
const RETAG = process.argv.includes("--retag");
const limitFlag = process.argv.indexOf("--limit");
const LIMIT = limitFlag !== -1 ? Number(process.argv[limitFlag + 1]) : Infinity;
const CONCURRENCY = 4;

const MEDIA_TYPES = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  heic: "image/heic",
  heif: "image/heif"
};

const PROMPT = `你是一個圖片標籤助手。請仔細觀察這張明信片圖片，產生 3 到 10 個「繁體中文」搜尋標籤，描述主要主題、物件、場景、地標與氛圍（例如：教堂、海邊、日落、城堡、櫻花、夜景、雪山、街景）。只回傳一個 JSON 字串陣列，例如 ["教堂","海邊","日落"]，不要加入任何其他文字、說明或程式碼區塊標記。請依重要性排序，最相關的放最前面。`;

function fileNameFromImageUrl(imageUrl) {
  try {
    const pathname = imageUrl.startsWith("http") ? new URL(imageUrl).pathname : imageUrl;
    return path.basename(pathname);
  } catch {
    return null;
  }
}

async function readImage(fileName) {
  for (const dir of UPLOAD_DIRS) {
    try {
      const buffer = await readFile(path.join(dir, fileName));
      const ext = fileName.split(".").pop()?.toLowerCase() ?? "jpg";
      return { base64: buffer.toString("base64"), mediaType: MEDIA_TYPES[ext] ?? "image/jpeg" };
    } catch {
      // try the next directory
    }
  }
  return null;
}

function parseTags(text) {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed)) return null;
    const tags = parsed
      .filter((tag) => typeof tag === "string" && tag.trim().length > 0)
      .map((tag) => tag.trim());
    return tags.length > 0 ? tags.slice(0, 10) : null;
  } catch {
    return null;
  }
}

async function generateTags(base64, mediaType) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            { type: "text", text: PROMPT }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`API ${response.status}: ${body.slice(0, 160)}`);
  }

  const payload = await response.json();
  const text = payload?.content?.[0]?.text ?? "";
  return parseTags(text);
}

async function main() {
  if (!API_KEY) {
    console.error("Missing ANTHROPIC_API_KEY — set it in the environment and retry.");
    process.exit(1);
  }

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");

  const columns = db.prepare("PRAGMA table_info(postcards)").all();
  if (!columns.some((column) => column.name === "tags")) {
    db.exec("ALTER TABLE postcards ADD COLUMN tags TEXT");
  }

  const where = RETAG ? "" : "WHERE tags IS NULL";
  const rows = db.prepare(`SELECT id, image_url FROM postcards ${where} ORDER BY id`).all();
  const targets = Number.isFinite(LIMIT) ? rows.slice(0, LIMIT) : rows;

  console.log(`Model: ${MODEL}`);
  console.log(
    `${rows.length} postcard(s) ${RETAG ? "(retag all)" : "untagged"}; processing ${targets.length}`
  );

  const update = db.prepare("UPDATE postcards SET tags = ? WHERE id = ?");

  let tagged = 0;
  let skipped = 0;
  let failed = 0;
  let done = 0;
  let index = 0;

  async function worker() {
    while (index < targets.length) {
      const row = targets[index++];
      try {
        const fileName = fileNameFromImageUrl(row.image_url);
        const image = fileName ? await readImage(fileName) : null;
        if (!image) {
          skipped += 1;
        } else {
          const tags = await generateTags(image.base64, image.mediaType);
          if (tags) {
            update.run(JSON.stringify(tags), row.id);
            tagged += 1;
          } else {
            failed += 1;
          }
        }
      } catch {
        failed += 1;
      }

      done += 1;
      if (done % 10 === 0 || done === targets.length) {
        process.stdout.write(
          `\r  ${done}/${targets.length}  (tagged ${tagged}, skipped ${skipped}, failed ${failed})`
        );
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  process.stdout.write("\n");
  db.close();
  console.log(`Done. Tagged ${tagged}, skipped ${skipped} (no image), failed ${failed}.`);
}

main().catch((error) => {
  console.error("Tagging failed:", error.message);
  process.exit(1);
});
