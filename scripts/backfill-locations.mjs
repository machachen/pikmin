#!/usr/bin/env node
/**
 * Backfill missing location tags (country/region/city) for postcards that have
 * coordinates but no reverse-geocoded location — usually because OpenStreetMap
 * Nominatim rate-limited the original bulk import.
 *
 * Runs against the SQLite DB in ./data. Run it in Render's Shell to fix your
 * live 1,040, or locally for your local copy. Throttled to ~1 request/second
 * to respect Nominatim's usage policy.
 *
 * Usage:
 *   npm run backfill                                  # only postcards missing a country
 *   node scripts/backfill-locations.mjs --all         # re-geocode every postcard
 *   node scripts/backfill-locations.mjs --limit 20    # test on a handful first
 *
 * Requires Node 18+ (global fetch).
 */

import path from "node:path";
import Database from "better-sqlite3";

const DB_PATH = path.join(process.cwd(), "data", "postcards.sqlite");
const ALL = process.argv.includes("--all");
const limitFlag = process.argv.indexOf("--limit");
const LIMIT = limitFlag !== -1 ? Number(process.argv[limitFlag + 1]) : Infinity;
const DELAY_MS = 1100;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function reverseGeocode(latitude, longitude) {
  const params = new URLSearchParams({
    format: "jsonv2",
    lat: String(latitude),
    lon: String(longitude),
    zoom: "13",
    addressdetails: "1"
  });

  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?${params.toString()}`,
    {
      headers: {
        "Accept-Language": "en",
        "User-Agent": "pikimin-postcard-atlas/0.1 (location backfill)"
      }
    }
  );

  if (!response.ok) {
    throw new Error(`status ${response.status}`);
  }

  const payload = await response.json();
  const address = payload.address ?? {};

  return {
    country: address.country ?? null,
    region: address.state ?? address.region ?? address.county ?? null,
    city:
      address.city ??
      address.town ??
      address.village ??
      address.municipality ??
      address.hamlet ??
      address.suburb ??
      null,
    locationLabel: payload.display_name ?? null
  };
}

async function main() {
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");

  const where = ALL ? "" : "WHERE country IS NULL";
  const rows = db
    .prepare(`SELECT id, latitude, longitude FROM postcards ${where} ORDER BY id`)
    .all();
  const targets = Number.isFinite(LIMIT) ? rows.slice(0, LIMIT) : rows;

  console.log(
    `${rows.length} postcard(s) ${ALL ? "(all)" : "missing a country"}; processing ${targets.length}`
  );

  const update = db.prepare(`
    UPDATE postcards
    SET country = @country, region = @region, city = @city, location_label = @locationLabel
    WHERE id = @id
  `);

  let filled = 0;
  let noAddress = 0;
  let failed = 0;

  for (let index = 0; index < targets.length; index += 1) {
    const row = targets[index];
    try {
      const location = await reverseGeocode(row.latitude, row.longitude);
      update.run({ id: row.id, ...location });
      if (location.country || location.city || location.region) {
        filled += 1;
      } else {
        noAddress += 1;
      }
    } catch {
      failed += 1;
    }

    if ((index + 1) % 10 === 0 || index + 1 === targets.length) {
      process.stdout.write(
        `\r  ${index + 1}/${targets.length}  (filled ${filled}, no-address ${noAddress}, failed ${failed})`
      );
    }

    if (index + 1 < targets.length) {
      await sleep(DELAY_MS);
    }
  }

  process.stdout.write("\n");
  db.close();
  console.log(`Done. Filled ${filled}, no-address ${noAddress}, failed ${failed}.`);
}

main().catch((error) => {
  console.error("Backfill failed:", error.message);
  process.exit(1);
});
