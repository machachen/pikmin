#!/usr/bin/env node
/**
 * Off-Render backup for the Pikmin Postcard Atlas.
 *
 * Pulls every postcard (JSON) and its image from the live API into a local
 * timestamped folder under ./backups. Render already snapshots the disk daily
 * (7-day history); this is your own copy, kept off-platform.
 *
 * Usage:
 *   node scripts/backup.mjs
 *   BASE_URL=https://pikmin.onrender.com node scripts/backup.mjs
 *   node scripts/backup.mjs --no-images     # metadata only, much faster
 *
 * Requires Node 18+ (uses global fetch).
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE_URL = (process.env.BASE_URL ?? "https://pikmin.onrender.com").replace(/\/$/, "");
const SKIP_IMAGES = process.argv.includes("--no-images");
const CONCURRENCY = 6;

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.json();
}

async function downloadImage(imageUrl, destDir) {
  const url = imageUrl.startsWith("http") ? imageUrl : `${BASE_URL}${imageUrl}`;
  const fileName = path.basename(new URL(url).pathname);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await writeFile(path.join(destDir, fileName), buffer);
  return fileName;
}

async function runPool(items, worker, concurrency) {
  let index = 0;
  let done = 0;
  const results = { ok: 0, failed: 0 };
  async function next() {
    while (index < items.length) {
      const current = index++;
      try {
        await worker(items[current]);
        results.ok++;
      } catch {
        results.failed++;
      }
      done++;
      if (done % 50 === 0 || done === items.length) {
        process.stdout.write(`\r  images: ${done}/${items.length}`);
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, next));
  process.stdout.write("\n");
  return results;
}

async function main() {
  const stamp = timestamp();
  const outDir = path.join(process.cwd(), "backups", stamp);
  const imagesDir = path.join(outDir, "images");
  await mkdir(imagesDir, { recursive: true });

  console.log(`Backing up from ${BASE_URL}`);
  const data = await fetchJson(`${BASE_URL}/api/postcards`);
  const postcards = Array.isArray(data) ? data : data.postcards ?? [];
  console.log(`Fetched ${postcards.length} postcards`);

  const jsonPath = path.join(outDir, "postcards.json");
  await writeFile(jsonPath, JSON.stringify(postcards, null, 2));
  console.log(`Wrote ${jsonPath}`);

  if (!SKIP_IMAGES && postcards.length > 0) {
    const withImages = postcards.filter((p) => p.imageUrl);
    const result = await runPool(
      withImages,
      (p) => downloadImage(p.imageUrl, imagesDir),
      CONCURRENCY
    );
    console.log(`Images: ${result.ok} saved, ${result.failed} failed -> ${imagesDir}`);
  }

  console.log(`\nDone. Backup at backups/${stamp}`);
}

main().catch((err) => {
  console.error("Backup failed:", err.message);
  process.exit(1);
});
