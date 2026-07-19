import { isPublicHttpsOrigin } from "./public-https-origin";

export function parseStagingOrigin(value: string | undefined): string {
  if (value === undefined || !isPublicHttpsOrigin(value)) {
    throw new Error("STAGING_ORIGIN must be a public HTTPS origin");
  }
  return value.replace(/\/$/u, "");
}

export function parseStagingReleaseId(value: string | undefined): string {
  if (value === undefined || !/^[A-Za-z0-9][A-Za-z0-9._-]{6,63}$/u.test(value)) {
    throw new Error("STAGING_EXPECTED_RELEASE_ID must be an immutable release identifier");
  }
  return value;
}
