import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE_NAME = "pikmin_session";

function safeEqual(a: string, b: string) {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) {
    return false;
  }
  return timingSafeEqual(bufferA, bufferB);
}

/**
 * Editing is protected only when EDIT_PASSWORD is set. If it's unset the app
 * stays open (unchanged behaviour) so nothing breaks before the password is
 * configured — setting EDIT_PASSWORD in the environment is what turns the lock on.
 */
export function isEditingProtected() {
  return Boolean(process.env.EDIT_PASSWORD);
}

export function verifyPassword(candidate: string) {
  const password = process.env.EDIT_PASSWORD;
  if (!password) {
    return false;
  }
  return safeEqual(candidate, password);
}

/** Opaque session token derived from the password — can't be forged without it. */
export function sessionToken() {
  const password = process.env.EDIT_PASSWORD ?? "";
  return createHmac("sha256", password).update("pikmin-session-v1").digest("hex");
}

export function isValidSessionToken(token: string | undefined | null) {
  if (!token || !isEditingProtected()) {
    return false;
  }
  return safeEqual(token, sessionToken());
}

export async function hasValidSession() {
  const store = await cookies();
  return isValidSessionToken(store.get(SESSION_COOKIE_NAME)?.value);
}

/** True when the current request is allowed to add/edit/delete postcards. */
export async function canWrite() {
  return !isEditingProtected() || (await hasValidSession());
}
