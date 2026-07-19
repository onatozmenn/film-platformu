import { execFile } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { extname } from "node:path";
import { promisify } from "node:util";

import { scanTrackedText, type TrackedSecretFinding } from "@/shared/release/tracked-secret-policy";

const executeFile = promisify(execFile);
const textExtensions = new Set([
  ".css",
  ".example",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".prisma",
  ".sql",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);
const maximumTextFileBytes = 2 * 1_024 * 1_024;

async function trackedFiles(): Promise<readonly string[]> {
  const { stdout } = await executeFile("git", ["ls-files", "-z"], {
    encoding: "utf8",
    maxBuffer: 10 * 1_024 * 1_024,
  });
  return stdout.split("\0").filter((path) => path.length > 0);
}

async function scan(path: string): Promise<readonly TrackedSecretFinding[]> {
  if (!textExtensions.has(extname(path).toLowerCase())) return [];
  const file = await stat(path);
  if (!file.isFile() || file.size > maximumTextFileBytes) return [];
  return scanTrackedText(path.replaceAll("\\", "/"), await readFile(path, "utf8"));
}

async function main(): Promise<void> {
  const findings = (await Promise.all((await trackedFiles()).map(scan)))
    .flat()
    .sort((left, right) =>
      `${left.path}:${left.rule}`.localeCompare(`${right.path}:${right.rule}`, "en"),
    );

  if (findings.length === 0) {
    process.stdout.write("Tracked-file secret scan passed.\n");
  } else {
    for (const finding of findings) {
      process.stderr.write(`${finding.path}: ${finding.rule}\n`);
    }
    process.exitCode = 1;
  }
}

void main();
