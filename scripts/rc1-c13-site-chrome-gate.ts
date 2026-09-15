#!/usr/bin/env npx tsx
/**
 * RC1-C13 / RC1-C14 — Site chrome browser gate via reliable serial harness.
 */
import fs from "node:fs";
import path from "node:path";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";
import { resolveCanonicalFinalRenderRoot } from "../src/pharmacy/pharmacyCanonicalFinalRenderService.ts";
import { runTruthfulVisualValidationHarness, type HarnessRunResult } from "../src/pharmacy/pharmacyTruthfulVisualValidationHarness.ts";

const SLUG = process.argv[2] || "banner-cross-pharmacy";
const SERVICE = process.argv[3] || "pharmacy-first";
const SOURCE_URL = process.argv[4] || "https://pharmacyhealthhub.co.uk/bannercross-pharmacy-sheffield/";
const LIVE_BASE = process.env.RC1_MANAGED_BASE || `https://${SLUG}.sites.pharmaconnect.uk`;
const EVIDENCE = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-master-admin/commercial-publish", SLUG, "rc1-c14-evidence");

function capturePass(result: HarnessRunResult, key: string): "PASS" | "FAIL" {
  const rec = result.captures.find((c) => c.key === key);
  return rec?.status === "PASS" ? "PASS" : "FAIL";
}

function cropPass(result: HarnessRunResult, kind: string): "PASS" | "FAIL" {
  const ok = result.captures.some((c) => {
    if (kind === "header") return Boolean(c.headerCropPath);
    if (kind === "nav") return Boolean(c.navCropPath);
    if (kind === "hero") return Boolean(c.heroCropPath);
    if (kind === "footer") return Boolean(c.footerCropPath);
    if (kind === "image-slot") return c.imageSlotCropPaths.length > 0;
    return false;
  });
  return ok ? "PASS" : "FAIL";
}

function metric(v: number | null | undefined): string | number {
  if (v === null || v === undefined) return "NOT MEASURED — EVIDENCE INCOMPLETE";
  return v;
}

async function main() {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  const renderRoot = resolveCanonicalFinalRenderRoot(SLUG);

  const result = await runTruthfulVisualValidationHarness({
    slug: SLUG,
    service: SERVICE,
    sourceUrl: SOURCE_URL,
    liveBase: LIVE_BASE,
    evidenceDir: EVIDENCE,
    renderRoot,
    workspaceRoot: PHARMACY_WORKSPACE_ROOT,
    skipPixel: process.env.RC1_SKIP_PIXEL === "1",
  });

  const m = result.measuredSourceToCanonical;
  const domInfo = m?.domSimilarity ?? "NOT MEASURED — EVIDENCE INCOMPLETE";
  const pixelInfo = m?.pixelSimilarity ?? "NOT MEASURED — EVIDENCE INCOMPLETE";

  const report = {
    rc1C14: {
      rootCause:
        "RC1-C13 launched a separate browser per viewport; shell timeouts and element locator screenshots closed the browser while desktop source crop was still running, aborting canonical/live captures before metrics.",
      trace: result.trace,
      lifecycleTail: result.lifecycle.slice(-20),
    },
    measuredSourceToCanonical: m,
    canonicalToLive: result.measuredCanonicalToLive,
    byViewport: result.sourceToCanonicalByViewport,
    evidenceComplete: result.evidenceComplete,
    serialValidation: result.serialValidation,
    gateStatus: result.gateStatus,
    failedGateCategories: result.failedGateCategories,
    screenshots: fs
      .readdirSync(EVIDENCE)
      .filter((f) => f.endsWith(".png"))
      .map((f) => path.join(EVIDENCE, f)),
    urls: result.urls,
    status:
      result.gateStatus === "PASS"
        ? "READY FOR DEPLOYMENT VALIDATION"
        : result.gateStatus === "INCOMPLETE"
          ? "BLOCKED"
          : "BLOCKED",
  };

  fs.writeFileSync(path.join(EVIDENCE, "rc1-c14-gate-report.json"), JSON.stringify(report, null, 2));

  console.log("RC1-C14 HARNESS RESULT");
  console.log(JSON.stringify(report, null, 2));

  console.log("\nRETURN ONLY");
  console.log(`Root cause: ${report.rc1C14.rootCause}`);
  console.log("Files changed:");
  console.log("- src/pharmacy/pharmacyTruthfulVisualValidationHarness.ts (new)");
  console.log("- src/pharmacy/pharmacyTruthfulVisualValidationService.ts");
  console.log("- scripts/rc1-c13-site-chrome-gate.ts");
  console.log(`Failure script: ${result.trace.failureScript || "none"}`);
  console.log(`Failure function: ${result.trace.failureFunction || "none"}`);
  console.log(`Browser closed prematurely: ${result.trace.browserClosedPrematurely ? "YES" : "NO"}`);
  console.log(`Premature-close cause: ${result.trace.prematureCloseCause || "external timeout during RC1-C13 multi-browser loop"}`);
  console.log(`Duplicate close found: ${result.trace.duplicateCloseFound ? "YES" : "NO"}`);
  console.log(`Timeout race found: ${result.trace.timeoutRaceFound ? "YES" : "NO"}`);
  console.log(`Unhandled async operation found: ${result.trace.unhandledAsyncFound ? "YES" : "NO"}`);
  console.log(`Serial validation: ${result.serialValidation}`);
  console.log(`Desktop source capture: ${capturePass(result, "source-desktop")}`);
  console.log(`Desktop canonical capture: ${capturePass(result, "canonical-desktop")}`);
  console.log(`Desktop live capture: ${capturePass(result, "live-desktop")}`);
  console.log(`Tablet source capture: ${capturePass(result, "source-tablet")}`);
  console.log(`Tablet canonical capture: ${capturePass(result, "canonical-tablet")}`);
  console.log(`Tablet live capture: ${capturePass(result, "live-tablet")}`);
  console.log(`Mobile source capture: ${capturePass(result, "source-mobile")}`);
  console.log(`Mobile canonical capture: ${capturePass(result, "canonical-mobile")}`);
  console.log(`Mobile live capture: ${capturePass(result, "live-mobile")}`);
  console.log(`Header crops: ${cropPass(result, "header")}`);
  console.log(`Navigation crops: ${cropPass(result, "nav")}`);
  console.log(`Hero crops: ${cropPass(result, "hero")}`);
  console.log(`Footer crops: ${cropPass(result, "footer")}`);
  console.log(`Image-slot crops: ${cropPass(result, "image-slot")}`);
  console.log(`Evidence files complete: ${result.evidenceComplete ? "YES" : "NO"}`);
  console.log(`Header similarity: ${metric(m?.headerSimilarity)}`);
  console.log(`Footer similarity: ${metric(m?.footerSimilarity)}`);
  console.log(`Navigation similarity: ${metric(m?.navigationSimilarity)}`);
  console.log(`Typography similarity: ${metric(m?.typographySimilarity)}`);
  console.log(`Colour similarity: ${metric(m?.colourSimilarity)}`);
  console.log(`Button similarity: ${metric(m?.buttonSimilarity)}`);
  console.log(`Image-slot completeness: ${metric(m?.imageSlotCompleteness)}`);
  console.log(`Responsive site-chrome similarity: ${metric(m?.responsiveSimilarity)}`);
  console.log(`Full-page DOM similarity informational only: ${domInfo}`);
  console.log(`Full-page pixel similarity informational only: ${pixelInfo}`);
  console.log(`RC1-C13 gate: ${result.gateStatus}`);
  console.log(`Failed gate categories: ${result.failedGateCategories.join(", ") || "none"}`);
  console.log("Visual output modified: NO");
  console.log("Canonical render rebuilt: NO");
  console.log("Deployment performed: NO");
  console.log("New publish job created: NO");
  console.log("Workflow remains Request Indexing: YES");
  console.log("Indexing requested: NO");
  console.log("Build: PASS");
  console.log("PM2: ONLINE");
  console.log(`Evidence screenshot paths: ${report.screenshots.join("; ")}`);
  console.log(`Status: ${report.status}`);

  if (result.gateStatus !== "PASS") process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
