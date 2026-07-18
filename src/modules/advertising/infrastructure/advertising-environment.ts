import { z } from "zod";

import type { AdvertisingFixtureScenario } from "../domain/preroll-policy";

const fixtureScenarioSchema = z.enum(["blocked", "completed", "empty", "error", "timeout"]);

const advertisingEnvironmentSchema = z
  .object({
    ADVERTISING_PROVIDER: z.enum(["disabled", "fake"]).default("disabled"),
    ADVERTISING_TEST_SCENARIO: z.preprocess(
      (value) => (value === "" ? undefined : value),
      fixtureScenarioSchema.optional(),
    ),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.NODE_ENV === "production" && value.ADVERTISING_PROVIDER !== "disabled") {
      context.addIssue({
        code: "custom",
        message: "Production advertising is blocked until the consent ADR is accepted",
        path: ["ADVERTISING_PROVIDER"],
      });
    }
    if (value.ADVERTISING_PROVIDER !== "fake" && value.ADVERTISING_TEST_SCENARIO !== undefined) {
      context.addIssue({
        code: "custom",
        message: "ADVERTISING_TEST_SCENARIO requires ADVERTISING_PROVIDER=fake",
        path: ["ADVERTISING_TEST_SCENARIO"],
      });
    }
  });

export type AdvertisingEnvironment = Readonly<{
  nodeEnvironment: "development" | "test" | "production";
  provider:
    | Readonly<{ kind: "disabled" }>
    | Readonly<{ fixtureScenario: AdvertisingFixtureScenario; kind: "fake" }>;
}>;

export function parseAdvertisingEnvironment(source: {
  ADVERTISING_PROVIDER?: string | undefined;
  ADVERTISING_TEST_SCENARIO?: string | undefined;
  NODE_ENV?: string | undefined;
}): AdvertisingEnvironment {
  const parsed = advertisingEnvironmentSchema.parse(source);
  const provider: AdvertisingEnvironment["provider"] =
    parsed.ADVERTISING_PROVIDER === "fake"
      ? {
          fixtureScenario: parsed.ADVERTISING_TEST_SCENARIO ?? "completed",
          kind: "fake",
        }
      : { kind: "disabled" };

  return Object.freeze({
    nodeEnvironment: parsed.NODE_ENV,
    provider: Object.freeze(provider),
  });
}
