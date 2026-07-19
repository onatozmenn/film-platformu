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
        PUBLISH_BATCH_LIMIT: "10",
        RETENTION_BATCH_LIMIT: "25",
      }),
    ).toEqual({
      batchLimit: 25,
      cronSecret: "c".repeat(32),
      kind: "enabled",
      nodeEnvironment: "production",
      publicationBatchLimit: 10,
    });
  });

  it.each([
    { CRON_SECRET: "short" },
    { CRON_SECRET: "c".repeat(32), RETENTION_BATCH_LIMIT: "0" },
    { CRON_SECRET: "c".repeat(32), RETENTION_BATCH_LIMIT: "501" },
    { CRON_SECRET: "c".repeat(32), PUBLISH_BATCH_LIMIT: "0" },
    { CRON_SECRET: "c".repeat(32), PUBLISH_BATCH_LIMIT: "101" },
  ])("rejects unsafe internal-job configuration %#", (source) => {
    expect(() => parseInternalJobsEnvironment(source)).toThrow();
  });
});
