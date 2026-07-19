import { describe, expect, it } from "vitest";

import { parseInternalJobsEnvironment } from "./internal-jobs-environment";

describe("internal jobs environment", () => {
  it("is disabled by default and enables only a bounded complete configuration", () => {
    expect(parseInternalJobsEnvironment({ NODE_ENV: "test" })).toEqual({
      kind: "disabled",
      nodeEnvironment: "test",
    });
    expect(
      parseInternalJobsEnvironment({
        CRON_SECRET: "c".repeat(32),
        NODE_ENV: "production",
        RETENTION_BATCH_LIMIT: "25",
      }),
    ).toEqual({
      batchLimit: 25,
      cronSecret: "c".repeat(32),
      kind: "enabled",
      nodeEnvironment: "production",
    });
  });

  it.each([
    { CRON_SECRET: "short" },
    { CRON_SECRET: "c".repeat(32), RETENTION_BATCH_LIMIT: "0" },
    { CRON_SECRET: "c".repeat(32), RETENTION_BATCH_LIMIT: "501" },
  ])("rejects unsafe internal-job configuration %#", (source) => {
    expect(() => parseInternalJobsEnvironment(source)).toThrow();
  });
});
