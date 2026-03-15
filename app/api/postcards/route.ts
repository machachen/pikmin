import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { reverseGeocode } from "@/src/lib/geocode";
import { createPostcard, getAllPostcards } from "@/src/lib/postcards";
import { buildUploadUrl, getUploadsDirectory } from "@/src/lib/uploads";

export const runtime = "nodejs";

const postcardSchema = z.object({
  title: z.string().trim().min(1, "Add a title.").max(80, "Keep the title under 80 characters."),
  description: z
    .string()
    .trim()
    .min(1, "Add a short description.")
    .max(800, "Keep the description under 800 characters."),
  latitude: z.coerce.number().min(-90, "Latitude must be between -90 and 90.").max(90),
  longitude: z.coerce.number().min(-180, "Longitude must be between -180 and 180.").max(180),
  placeType: z.enum(["mushroom", "flower"], {
    errorMap: () => ({ message: "Choose whether this spot is Mushroom or Flower." })
  })
});

const extensionByMimeType: Record<string, string> = {
  "image/avif": "avif",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

function getImageExtension(file: File) {
  const explicitExtension = extensionByMimeType[file.type];
  if (explicitExtension) {
    return explicitExtension;
  }

  const originalExtension = file.name.split(".").pop()?.toLowerCase();
  if (originalExtension && /^[a-z0-9]+$/.test(originalExtension)) {
    return originalExtension;
  }

  return "jpg";
}

export async function GET() {
  return NextResponse.json({ postcards: getAllPostcards() });
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const image = formData.get("image");

  if (!(image instanceof File) || image.size === 0 || !image.type.startsWith("image/")) {
    return NextResponse.json(
      { error: "Upload a postcard image before saving." },
      { status: 400 }
    );
  }

  const parsed = postcardSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    latitude: formData.get("latitude"),
    longitude: formData.get("longitude"),
    placeType: formData.get("placeType")
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "The postcard details are invalid." },
      { status: 400 }
    );
  }

  await mkdir(getUploadsDirectory(), { recursive: true });

  const imageExtension = getImageExtension(image);
  const fileName = `${Date.now()}-${randomUUID()}.${imageExtension}`;
  const relativeImagePath = buildUploadUrl(fileName);
  const imagePath = path.join(getUploadsDirectory(), fileName);
  const imageBuffer = Buffer.from(await image.arrayBuffer());

  await writeFile(imagePath, imageBuffer);

  let location: Awaited<ReturnType<typeof reverseGeocode>> = {
    city: null,
    country: null,
    locationLabel: null,
    region: null
  };

  try {
    location = await reverseGeocode(parsed.data.latitude, parsed.data.longitude);
  } catch {
    // Reverse geocoding is best-effort, so saving the postcard still succeeds.
  }

  const postcard = createPostcard({
    title: parsed.data.title,
    description: parsed.data.description,
    latitude: parsed.data.latitude,
    longitude: parsed.data.longitude,
    placeType: parsed.data.placeType,
    imageUrl: relativeImagePath,
    city: location.city,
    country: location.country,
    region: location.region,
    locationLabel: location.locationLabel
  });

  return NextResponse.json({ postcard }, { status: 201 });
}
