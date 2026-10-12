// Settings protection. If ADMIN_PASSCODE is set, editing needs it; viewing is always public.
// After a correct passcode we store a hash of it in an httpOnly cookie (the browser's JavaScript can't read it).
import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "pulse_admin";

function tokenFor(passcode: string): string {
  return createHash("sha256").update(`developer-pulse-admin:${passcode}`).digest("hex");
}

export function passcodeRequired(): boolean {
  return Boolean(process.env.ADMIN_PASSCODE);
}

export async function canEdit(): Promise<boolean> {
  const passcode = process.env.ADMIN_PASSCODE;
  if (!passcode) return true;
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return false;
  const expected = Buffer.from(tokenFor(passcode));
  const given = Buffer.from(value);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** Returns true and sets the cookie when the passcode is right. */
export async function unlock(passcode: string): Promise<boolean> {
  const expected = process.env.ADMIN_PASSCODE;
  if (!expected) return true;
  const a = Buffer.from(tokenFor(passcode));
  const b = Buffer.from(tokenFor(expected));
  if (!timingSafeEqual(a, b)) return false;
  (await cookies()).set(COOKIE, tokenFor(expected), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return true;
}

export async function lock(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
