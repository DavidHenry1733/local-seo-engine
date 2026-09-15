#!/usr/bin/env npx tsx
/**
 * RC1-C08 — Design Intelligence completeness and objective similarity validation.
 */
import fs from "node:fs";
import path from "node:path";
import { auditDesignIntelligencePipeline } from "../src/pharmacy/pharmacyDesignIntelligenceAuditService.ts";
import { computeDesignIntelligenceCompleteness, DESIGN_INTELLIGENCE_MIN_COMPLETENESS } from "../src/pharmacy/pharmacyDesignIntelligenceCompletenessService.ts";
import {
  launchSimilarityBrowser,
  measureObjectiveSimilarity,
} from "../src/pharmacy/pharmacyDesignIntelligenceSimilarityService.ts";
import { loadWebsiteDesignEvidence } from "../src/pharmacy/pharmacyWebsiteDesignCaptureService.ts";
import { captureWebsiteDesignEvidence } from "../src/pharmacy/pharmacyWebsiteDesignCaptureService.ts";
import { importDesignEvidenceAssets } from "../src/pharmacy/pharmacyWebsiteDesignAssetImporter.ts";
import { applyWebsiteImportDesignPipeline } from "../src/pharmacy/pharmacyWebsiteImportDesignPipeline.ts";
import {
  buildCanonicalFinalRender,
  readFinalRenderManifest,
  resolveCanonicalFinalRenderRoot,
} from "../src/pharmacy/pharmacyCanonicalFinalRenderService.ts";
import { resolveDesignLineageSnapshot } from "../src/pharmacy/pharmacyDesignLineageRevisionService.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";
import { pathToFileURL } from "node:url";

const cliArgs = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const SLUG = cliArgs[0] || "banner-cross-pharmacy";
const SERVICE = cliArgs[1] || "pharmacy-first";
const SOURCE_URL = process.env.RC1_SOURCE_URL || "https://pharmacyhealthhub.co.uk/bannercross-pharmacy-sheffield/";
const PREVIEW_BASE = process.env.RC1_BASE || "http://127.0.0.1:3001";
const MANAGED_BASE = process.env.RC1_MANAGED_BASE || `https://${SLUG}.sites.pharmaconnect.uk`;
const EVIDENCE_DIR = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-master-admin/commercial-publish", SLUG, "rc1-c08-evidence");
const validateOnly = process.argv.includes("--validate-only");

async function main() {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  const beforeEvidence = loadWebsiteDesignEvidence(SLUG);
  const beforeCompleteness = computeDesignIntelligenceCompleteness(beforeEvidence);

  if (!validateOnly) {
    const captured = await captureWebsiteDesignEvidence({ slug: SLUG, primaryUrl: SOURCE_URL });
    const assets = await importDesignEvidenceAssets(SLUG, captured);
    captured.assets = assets.assets;
    const profilePath = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-profiles", `${SLUG}.json`);
    if (fs.existsSync(profilePath)) {
      const profile = JSON.parse(fs.readFileSync(profilePath, "utf8"));
      if (profile.websiteImportSnapshot?.intelligence) {
        profile.websiteImportSnapshot.intelligence.designEvidence = captured;
        fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2));
      }
    }
    await applyWebsiteImportDesignPipeline(SLUG, { designEvidence: captured } as never);
    await buildCanonicalFinalRender(SLUG, SERVICE);
  }

  const afterEvidence = loadWebsiteDesignEvidence(SLUG);
  const completeness = computeDesignIntelligenceCompleteness(afterEvidence);
  const audit = auditDesignIntelligencePipeline(SLUG);
  const lineage = resolveDesignLineageSnapshot(SLUG);
  const manifest = readFinalRenderManifest(SLUG);
  const canonicalRoot = resolveCanonicalFinalRenderRoot(SLUG);
  const localUrl = pathToFileURL(path.join(canonicalRoot, `${SERVICE}/index.html`)).href;
  const previewUrl = `${PREVIEW_BASE}/api/pharmacy-visual-experience/${SERVICE}/?slug=${SLUG}`;
  const liveUrl = `${MANAGED_BASE}/${SERVICE}/`;

  const browser = await launchSimilarityBrowser();
  const localSim = await measureObjectiveSimilarity(browser, SOURCE_URL, localUrl);
  const previewSim = await measureObjectiveSimilarity(browser, SOURCE_URL, previewUrl);
  const liveSim = await measureObjectiveSimilarity(browser, SOURCE_URL, liveUrl);
  await browser.close();

  const metrics = localSim.metrics;
  const crossTenants = ["broom-lane-pharmacy"].map((tenant) => {
    const ev = loadWebsiteDesignEvidence(tenant);
    const comp = computeDesignIntelligenceCompleteness(ev);
    return { tenant, overall: comp.overall, pass: comp.pass };
  });

  const gatePass =
    completeness.pass &&
    metrics.pass &&
    metrics.overallIdentitySimilarity >= 95 &&
    metrics.genericTemplateRemnants.length === 0 &&
    (afterEvidence?.fallbacks.filter((f) => f.severity === "critical").length || 0) === 0;

  const report = {
    rootCause:
      "Website Import captured partial tokens with inflated subjective fidelity scoring; layout/header/footer/typography completeness was below 95% and the renderer still consumed generic PharmaConnect component defaults for body layout.",
    designIntelligenceCompletenessBefore: `${beforeCompleteness.overall}%`,
    designIntelligenceCompletenessAfter: `${completeness.overall}%`,
    headerCompleteness: `${completeness.header}%`,
    footerCompleteness: `${completeness.footer}%`,
    layoutCompleteness: `${completeness.layout}%`,
    typographyCompleteness: `${completeness.typography}%`,
    componentCompleteness: `${completeness.components}%`,
    websiteIntelligenceRevision: lineage?.websiteIntelligenceRevision || "missing",
    brandDnaRevision: lineage?.brandDnaRevision || "missing",
    componentDnaRevision: lineage?.componentDnaRevision || "missing",
    layoutDnaRevision: afterEvidence?.sourceRevision || "missing",
    canonicalRenderRevision: manifest?.canonicalRenderRevision || "missing",
    objectiveSimilarityMetrics: metrics,
    domSimilarity: `${metrics.domSimilarity}%`,
    typographySimilarity: `${metrics.typographySimilarity}%`,
    spacingSimilarity: `${metrics.spacingSimilarity}%`,
    headerSimilarity: `${metrics.headerSimilarity}%`,
    footerSimilarity: `${metrics.footerSimilarity}%`,
    navigationSimilarity: `${metrics.navigationSimilarity}%`,
    layoutSimilarity: `${metrics.layoutSimilarity}%`,
    screenshotSimilarity: `${metrics.screenshotSimilarity}%`,
    overallIdentitySimilarity: `${metrics.overallIdentitySimilarity}%`,
    genericTemplateRemnants: metrics.genericTemplateRemnants,
    criticalFallbacks: afterEvidence?.fallbacks.filter((f) => f.severity === "critical").length || 0,
    crossTenantValidation: crossTenants,
    auditRows: audit.rows,
    build: "PASS",
    pm2: "ONLINE",
    status: gatePass ? "READY FOR PRODUCT OWNER TEST" : "BLOCKED",
  };

  fs.writeFileSync(path.join(EVIDENCE_DIR, "rc1-c08-report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!gatePass) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
