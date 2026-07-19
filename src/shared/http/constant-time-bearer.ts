import { createHash, timingSafeEqual } from "node:crypto";

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

export function verifyBearerCredential(header: string | null, expected: string): boolean {
  if (header === null || !header.startsWith("Bearer ")) {
    return false;
  }
  const candidate = header.slice("Bearer ".length);
  return candidate.length > 0 && timingSafeEqual(digest(candidate), digest(expected));
}
