import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

import { getSafeUploadFileName, getUploadFileCandidates } from "@/src/lib/uploads";

export const runtime = "nodejs";

const contentTypeByExtension: Record<string, string> = {
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp"
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ filename: string }> }
) {
  const { filename } = await context.params;
  const safeFileName = getSafeUploadFileName(filename);

  if (!safeFileName) {
    return NextResponse.json({ error: "Invalid upload path." }, { status: 400 });
  }

  for (const candidatePath of getUploadFileCandidates(safeFileName)) {
    try {
      const fileBuffer = await readFile(candidatePath);
      const extension = path.extname(safeFileName).toLowerCase();
      const contentType = contentTypeByExtension[extension] ?? "application/octet-stream";

      return new NextResponse(fileBuffer, {
        headers: {
          "Cache-Control": "private, max-age=31536000, immutable",
          "Content-Type": contentType
        }
      });
    } catch {
      // Try the next possible storage location.
    }
  }

  return NextResponse.json({ error: "Image not found." }, { status: 404 });
}
