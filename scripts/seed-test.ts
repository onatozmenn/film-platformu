import "dotenv/config";

const localTestDatabaseUrl =
  "postgresql://film:film@127.0.0.1:54329/film_platform_test?schema=public";
const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? localTestDatabaseUrl;

if (!new URL(testDatabaseUrl).pathname.slice(1).endsWith("_test")) {
  throw new Error("Test seeding requires a database name ending in _test");
}

process.env.TEST_DATABASE_URL = testDatabaseUrl;

void import("../prisma/seed").catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown test seed failure";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
