import { describe, expect, it } from "vitest";

import { scanTrackedText } from "./tracked-secret-policy";

describe("tracked secret policy", () => {
  it.each([
    ["AWS_ACCESS_KEY", `prefix AKIA${"A".repeat(16)} suffix`],
    ["GITHUB_TOKEN", `prefix ghp_${"a".repeat(36)} suffix`],
    ["GOOGLE_API_KEY", `prefix AIza${"A".repeat(35)} suffix`],
    ["PRIVATE_KEY", ["-----BEGIN", "PRIVATE KEY-----"].join(" ")],
    ["SLACK_TOKEN", `prefix xoxb-${"a".repeat(24)} suffix`],
    ["STRIPE_SECRET_KEY", `prefix sk_live_${"a".repeat(24)} suffix`],
  ] as const)("reports only the path and %s rule", (rule, text) => {
    expect(scanTrackedText("safe/example.txt", text)).toEqual([{ path: "safe/example.txt", rule }]);
  });

  it("ignores placeholders and ordinary test identifiers", () => {
    expect(
      scanTrackedText(
        ".env.example",
        'AUTH_SECRET=""\nMUX_SIGNING_PRIVATE_KEY=""\nproviderAssetId="fake-asset-test"',
      ),
    ).toEqual([]);
  });
});
