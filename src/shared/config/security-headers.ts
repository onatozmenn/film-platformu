type SecurityHeader = Readonly<{ key: string; value: string }>;

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "connect-src 'self' https://stream.mux.com https://pubads.g.doubleclick.net https://googleads.g.doubleclick.net https://pagead2.googlesyndication.com",
  "font-src 'self' data:",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "frame-src https://imasdk.googleapis.com https://googleads.g.doubleclick.net https://tpc.googlesyndication.com",
  "img-src 'self' data: blob: https://image.mux.com https://googleads.g.doubleclick.net https://pagead2.googlesyndication.com https://tpc.googlesyndication.com",
  "media-src 'self' blob: https://stream.mux.com https://googleads.g.doubleclick.net",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' https://imasdk.googleapis.com",
  "style-src 'self' 'unsafe-inline'",
  "worker-src 'self' blob:",
].join("; ");

export function buildSecurityHeaders(
  input: Readonly<{ cspEnforced: boolean; hstsEnabled: boolean; releaseId: string }>,
): SecurityHeader[] {
  return [
    {
      key: input.cspEnforced ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only",
      value: contentSecurityPolicy,
    },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Release-Id", value: input.releaseId },
    {
      key: "Permissions-Policy",
      value: "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
    },
    ...(input.hstsEnabled
      ? [
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ]
      : []),
  ];
}
