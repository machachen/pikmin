#!/usr/bin/env node
/**
 * Load a backup (from scripts/backup.mjs) into the LOCAL SQLite dev database,
 * so `npm run dev` shows your real postcards instead of the few local test rows.
 *
 * Usage:
 *   npm run backup                              # 1. pull live data into ./backups
 *   npm run import-backup                       # 2. load the NEWEST backup locally
 *   node scripts/import-backup.mjs ./backups/<stamp>   # load a specific backup
 *
 * This REPLACES the local postcards table (your local test data) with the
 * backup, and copies the images into data/uploads. Stop `npm run dev` first.
 */

import { readFile, readdir, mkdir, copyFile, access } from "node:fs/promises";
import path from "node:path";
import Database from "better-sqlite3";

const CWD = process.cwd();
const DATA_DIR = path.join(CWD, "data");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
const DB_PATH = path.join(DATA_DIR, "postcards.sqlite");

async function resolveBackupDir() {
  const explicit = process.argv[2];
  if (explicit) return path.resolve(explicit);

  const backupsRoot = path.join(CWD, "backups");
  const entries = await readdir(backupsRoot, { withFileTypes: true }).catch(() => []);
  const dirs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  if (dirs.length === 0) {
    throw new Error("No backups found in ./backups — run `npm run backup` first.");
  }
  return path.join(backupsRoot, dirs[dirs.length - 1]);
}

function fileNameFromImageUrl(imageUrl) {
  try {
    const pathname = imageUrl.startsWith("http") ? new URL(imageUrl).pathname : imageUrl;
    return path.basename(pathname);
  } catch {
    return null;
  }
}

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const backupDir = await resolveBackupDir();
  const jsonPath = path.join(backupDir, "postcards.json");
  const imagesDir = path.join(backupDir, "images");
  console.log(`Importing from ${backupDir}`);

  const raw = JSON.parse(await readFile(jsonPath, "utf8"));
  const postcards = Array.isArray(raw) ? raw : (raw.postcards ?? []);
  console.log(`Found ${postcards.length} postcards in backup`);

  await mkdir(UPLOADS_DIR, { recursive: true });

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS postcards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      place_type TEXT NOT NULL DEFAULT 'flower',
      image_url TEXT NOT NULL,
      country TEXT,
      region TEXT,
      city TEXT,
      location_label TEXT,
      created_at TEXT NOT NULL
    )
  `);

  const insert = db.prepare(`
    INSERT OR REPLACE INTO postcards
      (id, title, description, latitude, longitude, place_type, image_url,
       country, region, city, location_label, created_at)
    VALUES
      (@id, @title, @description, @latitude, @longitude, @place_type, @image_url,
       @country, @region, @city, @location_label, @created_at)
  `);

  const replaceAll = db.transaction((rows) => {
    db.exec("DELETE FROM postcards");
    for (const postcard of rows) {
      insert.run({
        id: postcard.id,
        title: postcard.title ?? "",
        description: postcard.description ?? "",
        latitude: postcard.latitude,
        longitude: postcard.longitude,
        place_type: postcard.placeType ?? "flower",
        image_url: postcard.imageUrl ?? "",
        country: postcard.country ?? null,
        region: postcard.region ?? null,
        city: postcard.city ?? null,
        location_label: postcard.locationLabel ?? null,
        created_at: postcard.createdAt ?? new Date().toISOString()
      });
    }
  });

  replaceAll(postcards);
  console.log(`Inserted ${postcards.length} rows into ${DB_PATH}`);

  let copied = 0;
  let missing = 0;
  for (const postcard of postcards) {
    const fileName = postcard.imageUrl ? fileNameFromImageUrl(postcard.imageUrl) : null;
    if (!fileName) continue;

    const from = path.join(imagesDir, fileName);
    if (await exists(from)) {
      await copyFile(from, path.join(UPLOADS_DIR, fileName));
      copied += 1;
    } else {
      missing += 1;
    }
  }
  console.log(`Images: ${copied} copied, ${missing} missing`);

  db.close();
  console.log("\nDone. Restart `npm run dev` (or refresh) to see them.");
}

main().catch((error) => {
  console.error("Import failed:", error.message);
  process.exit(1);
});
