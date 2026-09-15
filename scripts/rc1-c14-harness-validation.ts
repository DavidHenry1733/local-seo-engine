#!/usr/bin/env npx tsx
/**
 * RC1-C14 — Harness reliability trace (diagnostic).
 */
import fs from "node:fs";
import path from "node:path";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";
import { resolveCanonicalFinalRenderRoot } from "../src/pharmacy/pharmacyCanonicalFinalRenderService.ts";
import { runTruthfulVisualValidationHarness } from "../src/pharmacy/pharmacyTruthfulVisualValidationHarness.ts";

const SLUG = process.argv[2] || "banner-cross-pharmacy";
const SERVICE = process.argv[3] || "pharmacy-first";
const EVIDENCE = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-master-admin/commercial-publish", SLUG, "rc1-c14-evidence");

async function main() {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  const result = await runTruthfulVisualValidationHarness({
    slug: SLUG,
    service: SERVICE,
    sourceUrl: "https://pharmacyhealthhub.co.uk/bannercross-pharmacy-sheffield/",
    liveBase: `https://${SLUG}.sites.pharmaconnect.uk`,
    evidenceDir: EVIDENCE,
    renderRoot: resolveCanonicalFinalRenderRoot(SLUG),
    workspaceRoot: PHARMACY_WORKSPACE_ROOT,
    skipPixel: true,
  });
  fs.writeFileSync(path.join(EVIDENCE, "rc1-c14-harness-trace.json"), JSON.stringify(result, null, 2));
  console.log("serialValidation", result.serialValidation);
  console.log("evidenceComplete", result.evidenceComplete);
  console.log("gateStatus", result.gateStatus);
  console.log("captures", result.captures.map((c) => `${c.key}:${c.status}`).join(", "));
}

main().catch(console.error);
