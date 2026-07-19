import { readFile } from "node:fs/promises";

import type { ProductionReadinessEvidence } from "@/shared/release/production-readiness";
import { parseProductionReadinessEvidence } from "@/shared/release/production-readiness-evidence";
import {
  createProductionReadinessReport,
  invalidProductionReadinessReport,
  type ProductionReadinessReport,
} from "@/shared/release/production-readiness-report";

async function report(): Promise<ProductionReadinessReport> {
  const evidenceFile = process.env.PRODUCTION_RELEASE_EVIDENCE_FILE;
  const evidenceJson = process.env.PRODUCTION_RELEASE_EVIDENCE_JSON;
  const hasFile = evidenceFile !== undefined && evidenceFile.trim().length > 0;
  const hasJson = evidenceJson !== undefined && evidenceJson.trim().length > 0;
  if (hasFile === hasJson) {
    return invalidProductionReadinessReport("EVIDENCE_INPUT_INVALID");
  }

  let evidence: ProductionReadinessEvidence;
  try {
    evidence = parseProductionReadinessEvidence(
      JSON.parse(hasFile ? await readFile(evidenceFile, "utf8") : (evidenceJson ?? "")) as unknown,
    );
  } catch {
    return invalidProductionReadinessReport("EVIDENCE_INPUT_INVALID");
  }
  return createProductionReadinessReport(process.env, evidence);
}

async function main(): Promise<void> {
  const result = await report();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ready) process.exitCode = 1;
}

void main();
