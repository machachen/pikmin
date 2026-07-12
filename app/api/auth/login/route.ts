import { NextResponse } from "next/server";

import { SESSION_COOKIE_NAME, isEditingProtected, sessionToken, verifyPassword } from "@/src/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isEditingProtected()) {
    return NextResponse.json({ ok: true, protected: false });
  }

  let password = "";
  try {
    const body = (await request.json()) as { password?: unknown };
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    password = "";
  }

  if (!verifyPassword(password)) {
    // Small delay to slow down brute-force attempts.
    await new Promise((resolve) => setTimeout(resolve, 400));
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, sessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });
  return response;
}
