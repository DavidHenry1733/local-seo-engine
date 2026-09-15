#!/usr/bin/env node
/**
 * Phase 6B — Re-render Pharmacy First previews and produce refinement report.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REFINEMENT_REPORT = join(ROOT, "output/pharmacy-blueprint/pharmacy-first-template-refinement-report.json");
const QA_BEFORE = join(ROOT, "output/pharmacy-blueprint/pharmacy-first-preview-qa-report.json");

function loadJson(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

function run(cmd, args) {
  return spawnSync(cmd, args, { cwd: ROOT, encoding: "utf8", timeout: 120000 });
}

function main() {
  const qaBefore = loadJson(QA_BEFORE);

  const render = run("pnpm", ["exec", "tsx", "scripts/render-pharmacy-first-preview.mjs"]);
  if (render.status !== 0) {
    console.error(render.stderr || render.stdout);
    process.exit(1);
  }

  const qaRun = run("pnpm", ["exec", "tsx", "scripts/pharmacy-first-preview-qa.mjs"]);
  const qaAfter = loadJson(QA_BEFORE);

  const pass = qaAfter?.meetsRefinementTargets === true;
  const report = {
    schemaVersion: "1.0",
    phase: "pharmacy-first-template-refinement",
    generatedAt: new Date().toISOString(),
    verdict: pass ? "PASS" : "FAIL",
    message: pass
      ? "PASS: Pharmacy First Template Refinement Complete"
      : "FAIL: Pharmacy First Template Still Requires Revision",
    deployed: false,
    registryModified: false,
    sitemapModified: false,
    filesChanged: [
      "src/pharmacy/templates/renderClinicalNhsService.ts",
      "scripts/pharmacy-first-preview-qa.mjs",
    ],
    refinementsApplied: [
      "Patient-facing FAQ answer expansion helper (expandPatientFacingFaqAnswer)",
      "Service schema name deduplication (schemaServiceName)",
      "Cluster footer CTA buttons (Call / Ask about / Check availability)",
      "Varied contextual link sentence patterns",
      "Benefit-led card headings (benefitToHeading)",
      "Why-choose trust/differentiation points (buildWhyChoosePoints)",
      "Contextual links limited to section-head and step paragraphs",
    ],
    previewPagesRerendered: [
      "output/pharmacy-preview/pharmacy-first-rotherham/index.html",
      "output/pharmacy-preview/pharmacy-first-aston/index.html",
      "output/pharmacy-preview/pharmacy-first-bramley/index.html",
      "output/pharmacy-preview/pharmacy-first-rawmarsh/index.html",
      "output/pharmacy-preview/pharmacy-first-wickersley/index.html",
    ],
    qaBefore: qaBefore
      ? {
          verdict: qaBefore.verdict,
          aggregateScores: qaBefore.aggregateScores,
          readinessGrade: qaBefore.readinessGrade,
          blockingIssueCount: qaBefore.blockingIssues?.length ?? 0,
        }
      : null,
    qaAfter: qaAfter
      ? {
          verdict: qaAfter.verdict,
          aggregateScores: qaAfter.aggregateScores,
          readinessGrade: qaAfter.readinessGrade,
          blockingIssues: qaAfter.blockingIssues ?? [],
          pageScores: qaAfter.pageScores,
        }
      : null,
    validationTargets: {
      aggregateOverallMin: 7.5,
      complianceMin: 8,
      seoMin: 7,
      conversionMin: 7,
      met: qaAfter?.meetsRefinementTargets ?? false,
    },
    remainingIssues: [
      ...(qaAfter?.blockingIssues ?? []),
      ...(qaAfter?.designValidation?.issues ?? []),
      ...(qaAfter?.faqValidation?.issues ?? []),
      ...(qaAfter?.conversionValidation?.issues ?? []),
    ].filter((v, i, a) => a.indexOf(v) === i),
    readinessGrade: qaAfter?.readinessGrade ?? "Ready for template refinement",
    readyForLiveCampaignWiring: pass,
    recommendedNextAction: pass
      ? "Proceed to live campaign wiring: connect renderer to campaign generation with real pharmacy tokens, hero/trust/conversion images, and full cluster set."
      : "Address remaining QA issues in renderer and re-run scripts/pharmacy-first-template-refinement.mjs.",
  };

  mkdirSync(dirname(REFINEMENT_REPORT), { recursive: true });
  writeFileSync(REFINEMENT_REPORT, JSON.stringify(report, null, 2), "utf8");

  console.log(report.message);
  console.log(`Readiness: ${report.readinessGrade}`);
  console.log(`Live wiring ready: ${report.readyForLiveCampaignWiring ? "yes" : "no"}`);
  if (qaBefore && qaAfter) {
    console.log(`Overall score: ${qaBefore.aggregateScores?.overall ?? "?"} → ${qaAfter.aggregateScores?.overall ?? "?"}`);
  }
  console.log(`Report: ${REFINEMENT_REPORT.replace(ROOT + "/", "")}`);
  process.exit(pass ? 0 : 1);
}

main();
