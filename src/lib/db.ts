import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

let database: Database.Database | null = null;

function initializeDatabase() {
  const dataDirectory = path.join(process.cwd(), "data");
  const databasePath = path.join(dataDirectory, "postcards.sqlite");

  fs.mkdirSync(dataDirectory, { recursive: true });

  const db = new Database(databasePath);
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

  const columns = db
    .prepare("PRAGMA table_info(postcards)")
    .all() as Array<{ name: string }>;

  if (!columns.some((column) => column.name === "place_type")) {
    db.exec("ALTER TABLE postcards ADD COLUMN place_type TEXT NOT NULL DEFAULT 'flower'");
  }

  return db;
}

export function getDb() {
  if (!database) {
    database = initializeDatabase();
  }

  return database;
}
