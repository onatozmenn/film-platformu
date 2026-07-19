export type TrackedSecretRuleId =
  | "AWS_ACCESS_KEY"
  | "GITHUB_TOKEN"
  | "GOOGLE_API_KEY"
  | "PRIVATE_KEY"
  | "SLACK_TOKEN"
  | "STRIPE_SECRET_KEY";

export type TrackedSecretFinding = Readonly<{
  path: string;
  rule: TrackedSecretRuleId;
}>;

const rules = [
  ["AWS_ACCESS_KEY", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/u],
  ["GITHUB_TOKEN", /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{80,})\b/u],
  ["GOOGLE_API_KEY", /\bAIza[0-9A-Za-z_-]{35}\b/u],
  ["PRIVATE_KEY", /-----BEGIN (?:DSA |EC |OPENSSH |RSA )?PRIVATE KEY-----/u],
  ["SLACK_TOKEN", /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/u],
  ["STRIPE_SECRET_KEY", /\bsk_(?:live|test)_[0-9A-Za-z]{20,}\b/u],
] as const satisfies readonly (readonly [TrackedSecretRuleId, RegExp])[];

export function scanTrackedText(path: string, text: string): readonly TrackedSecretFinding[] {
  return rules.flatMap(([rule, pattern]) => (pattern.test(text) ? [{ path, rule }] : []));
}
