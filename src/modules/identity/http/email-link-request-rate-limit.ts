export function isEmailLinkRequest(method: string, routeSegments: readonly string[]): boolean {
  return method === "POST" && routeSegments[0] === "signin" && routeSegments[1] === "email";
}

export function emailLinkRateLimitKey(headers: Headers, trustsRealIp: boolean): string {
  if (!trustsRealIp) {
    return "untrusted-deployment";
  }
  return headers.get("x-real-ip")?.trim() || "unresolved-visitor";
}
