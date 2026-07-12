import { getDb } from "@/src/lib/db";
import type { CreatePostcardInput, Postcard, UpdatePostcardInput } from "@/src/lib/types";
import { buildUploadUrl, getUploadFileNameFromUrl } from "@/src/lib/uploads";

type PostcardRow = {
  id: number;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  place_type: "mushroom" | "flower";
  image_url: string;
  country: string | null;
  region: string | null;
  city: string | null;
  location_label: string | null;
  tags: string | null;
  created_at: string;
};

const POSTCARD_COLUMNS = `
  id,
  title,
  description,
  latitude,
  longitude,
  place_type,
  image_url,
  country,
  region,
  city,
  location_label,
  tags,
  created_at
`;

function parseTags(value: string | null): string[] | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return null;
    }

    const tags = parsed.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0);
    return tags.length > 0 ? tags : null;
  } catch {
    return null;
  }
}

function mapPostcardRow(row: PostcardRow): Postcard {
  const uploadFileName = getUploadFileNameFromUrl(row.image_url);

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    latitude: row.latitude,
    longitude: row.longitude,
    placeType: row.place_type,
    imageUrl: uploadFileName ? buildUploadUrl(uploadFileName) : row.image_url,
    country: row.country,
    region: row.region,
    city: row.city,
    locationLabel: row.location_label,
    tags: parseTags(row.tags),
    createdAt: row.created_at
  };
}

export function getAllPostcards() {
  const rows = getDb()
    .prepare(
      `SELECT ${POSTCARD_COLUMNS} FROM postcards ORDER BY datetime(created_at) DESC, id DESC`
    )
    .all() as PostcardRow[];

  return rows.map(mapPostcardRow);
}

export function getPostcardById(id: number) {
  const row = getDb()
    .prepare(`SELECT ${POSTCARD_COLUMNS} FROM postcards WHERE id = ?`)
    .get(id) as PostcardRow | undefined;

  return row ? mapPostcardRow(row) : null;
}

export function createPostcard(input: CreatePostcardInput) {
  const db = getDb();

  const result = db
    .prepare(
      `
        INSERT INTO postcards (
          title,
          description,
          latitude,
          longitude,
          place_type,
          image_url,
          country,
          region,
          city,
          location_label,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    )
    .run(
      input.title,
      input.description,
      input.latitude,
      input.longitude,
      input.placeType,
      input.imageUrl,
      input.country,
      input.region,
      input.city,
      input.locationLabel,
      new Date().toISOString()
    );

  const row = db
    .prepare(`SELECT ${POSTCARD_COLUMNS} FROM postcards WHERE id = ?`)
    .get(Number(result.lastInsertRowid)) as PostcardRow;

  return mapPostcardRow(row);
}

export function deletePostcard(id: number) {
  const db = getDb();
  const row = db
    .prepare(`SELECT ${POSTCARD_COLUMNS} FROM postcards WHERE id = ?`)
    .get(id) as PostcardRow | undefined;

  if (!row) {
    return null;
  }

  db.prepare("DELETE FROM postcards WHERE id = ?").run(id);

  return mapPostcardRow(row);
}

export function updatePostcard(id: number, input: UpdatePostcardInput) {
  const db = getDb();
  const result = db
    .prepare(
      `
        UPDATE postcards
        SET
          title = ?,
          description = ?,
          latitude = ?,
          longitude = ?,
          place_type = ?,
          image_url = ?,
          country = ?,
          region = ?,
          city = ?,
          location_label = ?
        WHERE id = ?
      `
    )
    .run(
      input.title,
      input.description,
      input.latitude,
      input.longitude,
      input.placeType,
      input.imageUrl,
      input.country,
      input.region,
      input.city,
      input.locationLabel,
      id
    );

  if (result.changes === 0) {
    return null;
  }

  const row = db
    .prepare(`SELECT ${POSTCARD_COLUMNS} FROM postcards WHERE id = ?`)
    .get(id) as PostcardRow;

  return mapPostcardRow(row);
}

export function setPostcardTags(id: number, tags: string[]) {
  const db = getDb();
  const result = db
    .prepare("UPDATE postcards SET tags = ? WHERE id = ?")
    .run(JSON.stringify(tags), id);

  return result.changes > 0;
}
