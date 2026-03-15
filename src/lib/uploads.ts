import path from "node:path";

const uploadRoutePrefix = "/api/uploads/";
const legacyUploadPrefix = "/uploads/";

export function getUploadsDirectory() {
  return path.join(process.cwd(), "data", "uploads");
}

export function getLegacyUploadsDirectory() {
  return path.join(process.cwd(), "public", "uploads");
}

export function buildUploadUrl(fileName: string) {
  return `${uploadRoutePrefix}${fileName}`;
}

export function getSafeUploadFileName(fileName: string) {
  const decodedFileName = decodeURIComponent(fileName);
  const normalizedFileName = path.basename(decodedFileName);

  if (
    !decodedFileName ||
    decodedFileName !== normalizedFileName ||
    !/^[A-Za-z0-9._-]+$/.test(normalizedFileName)
  ) {
    return null;
  }

  return normalizedFileName;
}

export function getUploadFileNameFromUrl(imageUrl: string) {
  if (imageUrl.startsWith(uploadRoutePrefix)) {
    return getSafeUploadFileName(imageUrl.slice(uploadRoutePrefix.length));
  }

  if (imageUrl.startsWith(legacyUploadPrefix)) {
    return getSafeUploadFileName(imageUrl.slice(legacyUploadPrefix.length));
  }

  return null;
}

export function getUploadFileCandidates(fileName: string) {
  return [
    path.join(getUploadsDirectory(), fileName),
    path.join(getLegacyUploadsDirectory(), fileName)
  ];
}
