#!/usr/bin/env npx tsx
/**
 * Provider-free regression for restoring locality-page strategy variants
 * into Campaign Builder generation. Does not call Places, DataForSEO or OpenAI.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { renderCampaignBuilderPage } from "../src/pharmacy/growthEngineCampaignBuilderPage.ts";
import {
  confirmLocalPageVariationRestoreCampaign,
  LOCAL_PAGE_VARIATION_RESTORE_CAMPAIGN_KIND,
  LOCAL_PAGE_VARIATION_RESTORE_HARD_MAX_TOTAL_USD,
  planLocalPageVariationRestoreCampaign,
  preservedV2CopyPath,
  snapshotPreservedV2LocalPages,
} from "../src/pharmacy/growthEngineLocalPageVariationRestoreRunService.ts";
import { snapshotRejectedV1LocalPages, countDistinctVerifiedLocalEvidence } from "../src/pharmacy/growthEngineLocalPageImprovementRunService.ts";
import { distinctVerifiedLocalReferenceLabelsFromFacts, MIN_DISTINCT_VERIFIED_LOCAL_REFERENCES_V2 } from "../src/pharmacy/contentEngine/pharmacyAiLocalCopyQualityV1.ts";
import type { EditorialFactV3 } from "../src/pharmacy/contentEngine/pharmacyLocalEditorialEvidenceContractV3.ts";
import { BROOK_DERBY_DEMO_SLUG } from "../src/pharmacy/contentEngine/pharmacyAiLocalPageCandidatePaths.ts";
import {
  assignLocalityVariationStrategiesV1,
  beginLocalityVariationSessionV1,
  endLocalityVariationSessionV1,
  getLocalityVariationSessionV1,
  sessionRestoresStrategyVariants,
  setSessionRestoreStrategyVariants,
} from "../src/pharmacy/contentEngine/pharmacyLocalityVariationSessionV1.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";

const SERVICE = "pharmacy-first";
const YORKSHIRE = "yorkshire-pharmacy-and-health-clinic";

interface Check {
  id: string;
  pass: boolean;
  detail: string;
}
const checks: Check[] = [];
function record(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

function sha256(file: string): string {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

const assemblerSrc = fs.readFileSync(
  path.join(PHARMACY_WORKSPACE_ROOT, "src/pharmacy/pharmacyAiLocalPagePilotAssemblerV3.ts"),
  "utf8",
);
const composeSrc = fs.readFileSync(
  path.join(PHARMACY_WORKSPACE_ROOT, "src/pharmacy/pharmacyLocalClusterContentEngine.ts"),
  "utf8",
);
const narrativeSrc = fs.readFileSync(
  path.join(PHARMACY_WORKSPACE_ROOT, "src/pharmacy/pharmacyFirstLocalNarrative.ts"),
  "utf8",
);
const strategySrc = fs.readFileSync(
  path.join(PHARMACY_WORKSPACE_ROOT, "src/pharmacy/contentEngine/pharmacyLocalityPageStrategyV1.ts"),
  "utf8",
);

record(
  "recovered-implementation-is-existing-strategy-system",
  strategySrc.includes("resolveLocalityPageStrategyV1") &&
    narrativeSrc.includes("buildHero(") &&
    narrativeSrc.includes("buildFaqs(") &&
    narrativeSrc.includes("buildConsultation(") &&
    assemblerSrc.includes("setSessionRestoreStrategyVariants(true)") &&
    assemblerSrc.includes("assignLocalityVariationStrategiesV1"),
  "Campaign Builder assembler restores pharmacyLocalityPageStrategyV1 + pharmacyFirstLocalNarrative",
);

record(
  "compose-does-not-force-journey-when-restore-enabled",
  composeSrc.includes('restoreVariants ? sessionStrategy : sessionStrategy || "patient-journey-led"'),
  "patient-journey-led remains the default lock unless restoreStrategyVariants is on",
);

record(
  "restore-uses-strategy-hero-and-faqs",
  narrativeSrc.includes("restoreVariants") &&
    narrativeSrc.includes("buildHero(plan") &&
    narrativeSrc.includes("const baseFaqs = buildFaqs(plan"),
  "strategy builders own hero supporting copy and FAQs when restored",
);

const html = renderCampaignBuilderPage(BROOK_DERBY_DEMO_SLUG, "areas", { area: "allestree" });
record(
  "campaign-builder-has-one-variation-restore-action",
  html.includes('data-restore-local-page-variation="true"') &&
    html.includes("restore-local-page-variation") &&
    html.includes("Regenerate local pages"),
  "one authenticated Campaign Builder action, not ten area controls",
);

beginLocalityVariationSessionV1([
  "allestree",
  "mickleover",
  "littleover",
  "chellaston",
  "duffield",
  "alvaston",
  "mackworth",
  "chaddesden",
  "spondon",
  "borrowash",
]);
setSessionRestoreStrategyVariants(true);
const assigned = assignLocalityVariationStrategiesV1({
  areas: [
    { areaName: "Allestree", areaSlug: "allestree" },
    { areaName: "Mickleover", areaSlug: "mickleover" },
    { areaName: "Littleover", areaSlug: "littleover" },
    { areaName: "Chellaston", areaSlug: "chellaston" },
    { areaName: "Duffield", areaSlug: "duffield" },
    { areaName: "Alvaston", areaSlug: "alvaston" },
    { areaName: "Mackworth", areaSlug: "mackworth" },
    { areaName: "Chaddesden", areaSlug: "chaddesden" },
    { areaName: "Spondon", areaSlug: "spondon" },
    { areaName: "Borrowash", areaSlug: "borrowash" },
  ],
  pharmacyName: "Brook Pharmacy Demo Derby",
  serviceName: "Pharmacy First",
});
const uniqueFirstFive = new Set([...assigned.values()].slice(0, 5));
record(
  "reload-safe-strategy-assignment-is-unique-then-wraps",
  assigned.size === 10 &&
    uniqueFirstFive.size === 5 &&
    sessionRestoresStrategyVariants() === true &&
    getLocalityVariationSessionV1()?.forceStrategyBySlug.get("allestree") === assigned.get("allestree"),
  `assigned ${[...assigned.entries()].map(([slug, strategy]) => `${slug}:${strategy}`).join(", ")}`,
);
endLocalityVariationSessionV1();

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "variation-restore-"));
const v1Dir = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-ai-local-copy-rejected-v1", BROOK_DERBY_DEMO_SLUG, SERVICE);
const v1Before = {
  allestree: sha256(path.join(v1Dir, "allestree.json")),
  mickleover: sha256(path.join(v1Dir, "mickleover.json")),
};

const liveCopy = path.join(
  PHARMACY_WORKSPACE_ROOT,
  "data/pharmacy-ai-local-copy-pilots",
  BROOK_DERBY_DEMO_SLUG,
  SERVICE,
  "v3",
  "allestree.json",
);
const snap = snapshotPreservedV2LocalPages(
  BROOK_DERBY_DEMO_SLUG,
  SERVICE,
  [{ areaSlug: "allestree" }, { areaSlug: "mickleover" }],
  tmp,
);
record(
  "v2-snapshot-copy-if-missing",
  Boolean(snap.copyHashes.allestree) &&
    snap.copyHashes.allestree === sha256(liveCopy) &&
    fs.existsSync(preservedV2CopyPath(BROOK_DERBY_DEMO_SLUG, SERVICE, "allestree", tmp)),
  "V2 live copy snapshotted without rewriting V1",
);
snapshotRejectedV1LocalPages(BROOK_DERBY_DEMO_SLUG, SERVICE, [{ areaSlug: "allestree" }, { areaSlug: "mickleover" }]);
record(
  "v1-rejected-snapshots-unchanged",
  sha256(path.join(v1Dir, "allestree.json")) === v1Before.allestree &&
    sha256(path.join(v1Dir, "mickleover.json")) === v1Before.mickleover,
  "rejected V1 candidates remain byte-identical",
);

const plan = planLocalPageVariationRestoreCampaign(BROOK_DERBY_DEMO_SLUG, SERVICE);
record(
  "variation-restore-plan-is-campaign-level",
  plan.areas.length === 10 &&
    plan.maxGenerationCalls === 10 &&
    plan.maxTotalCostUsd <= LOCAL_PAGE_VARIATION_RESTORE_HARD_MAX_TOTAL_USD &&
    !plan.exceedsHardMaximum,
  `${plan.areas.length} areas, ${plan.maxGenerationCalls} OpenAI calls, max ${plan.maxTotalCostLabel}`,
);

const processed: string[] = [];
const confirm = await confirmLocalPageVariationRestoreCampaign({
  slug: BROOK_DERBY_DEMO_SLUG,
  serviceId: SERVICE,
  confirmAuthorise: true,
  authorisedBy: "validation",
  processInline: true,
  deps: {
    runRoot: tmp,
    snapshotRoot: tmp,
    processArea: async (area) => {
      processed.push(area.areaSlug);
      return {
        ok: true,
        stage: "save",
        previewUrl: `/preview/${area.areaSlug}`,
        reviewUrl: "/review",
        localReferences: [`${area.areaName} Park`, `${area.areaName} Library`, `${area.areaName} Medical Centre`],
      };
    },
    assembleAll: () => undefined,
  },
});
record(
  "confirm-starts-durable-v3-run-without-provider-calls",
  confirm.ok === true &&
    confirm.run.kind === LOCAL_PAGE_VARIATION_RESTORE_CAMPAIGN_KIND &&
    confirm.run.status === "completed" &&
    processed.join(",") === plan.areas.map((row) => row.areaSlug).join(",") &&
    confirm.run.recoveredImplementation.includes("pharmacyLocalityPageStrategyV1"),
  confirm.ok ? `${confirm.run.runId} ${confirm.run.status}` : String("error" in confirm ? confirm.error : ""),
);

const duplicate = await confirmLocalPageVariationRestoreCampaign({
  slug: BROOK_DERBY_DEMO_SLUG,
  serviceId: SERVICE,
  confirmAuthorise: true,
  authorisedBy: "validation",
  processInline: true,
  deps: {
    runRoot: tmp,
    snapshotRoot: tmp,
    processArea: async () => {
      throw new Error("must-not-restart-completed-run");
    },
    assembleAll: () => undefined,
  },
});
record(
  "completed-run-is-not-restarted",
  duplicate.ok === true && duplicate.duplicate === true && duplicate.run.status === "completed",
  duplicate.ok ? `duplicate=${duplicate.duplicate} status=${duplicate.run.status}` : "failed",
);

const yorkshirePreview = path.join(
  PHARMACY_WORKSPACE_ROOT,
  "output/pharmacy-ai-local-page-pilots",
  YORKSHIRE,
  SERVICE,
  "v3",
  "local",
  "wombwell",
  "index.html",
);
record(
  "yorkshire-file-based-accepted-preview-untouched-by-this-script",
  fs.existsSync(yorkshirePreview) &&
    fs.readFileSync(yorkshirePreview, "utf8").includes("Why Wombwell patients start with the pharmacist"),
  "accepted Yorkshire file-based Preview remains patient-journey-led",
);

const namedOnly = distinctVerifiedLocalReferenceLabelsFromFacts([
  {
    factId: "x:healthcare:gp",
    area: "Mickleover",
    areaSlug: "mickleover",
    category: "healthcare",
    normalizedStatement: "NHS general practice services in Mickleover are provided from Mickleover Medical Centre.",
    sourceTitle: "NHS",
    sourceUrl: "https://www.nhs.uk/",
    publisher: "NHS",
    retrievedAt: "2026-09-04T00:00:00.000Z",
    sourceClass: "primary",
    corroboratingSource: null,
    confidence: "high",
    usefulnessToPharmacyFirstReader: "n",
    permittedCopyRole: "healthcare-context",
    prohibitedInference: "n",
    validationStatus: "accepted",
  },
  {
    factId: "x:area-identity:ward",
    area: "Mickleover",
    areaSlug: "mickleover",
    category: "area-identity",
    normalizedStatement: "Mickleover is a neighbourhood ward in Derby.",
    sourceTitle: "Council",
    sourceUrl: "https://www.derby.gov.uk/",
    publisher: "derby.gov.uk",
    retrievedAt: "2026-09-04T00:00:00.000Z",
    sourceClass: "primary",
    corroboratingSource: null,
    confidence: "high",
    usefulnessToPharmacyFirstReader: "n",
    permittedCopyRole: "area-introduction",
    prohibitedInference: "n",
    validationStatus: "accepted",
  },
  {
    factId: "x:community:board",
    area: "Mickleover",
    areaSlug: "mickleover",
    category: "community",
    normalizedStatement:
      "Mickleover has a Neighbourhood Board of local councillors, residents and representatives from community organisations and public services.",
    sourceTitle: "Council",
    sourceUrl: "https://www.derby.gov.uk/",
    publisher: "derby.gov.uk",
    retrievedAt: "2026-09-04T00:00:00.000Z",
    sourceClass: "primary",
    corroboratingSource: null,
    confidence: "high",
    usefulnessToPharmacyFirstReader: "n",
    permittedCopyRole: "neutral-community-context",
    prohibitedInference: "n",
    validationStatus: "accepted",
  },
] as EditorialFactV3[]);
record(
  "named-local-references-exclude-ward-identity",
  namedOnly.length === 2 &&
    namedOnly.some((row) => /Medical Centre/i.test(row)) &&
    namedOnly.some((row) => /Neighbourhood Board/i.test(row)) &&
    !namedOnly.some((row) => /neighbourhood ward/i.test(row)),
  namedOnly.join(" | "),
);

const workflowSrc = fs.readFileSync(
  path.join(PHARMACY_WORKSPACE_ROOT, "src/pharmacy/growthEngineLocalPageImprovementRunService.ts"),
  "utf8",
);
const workflowFn = workflowSrc.slice(workflowSrc.indexOf("export async function executeLocalPageImprovementAreaWorkflow"));
const namedCheckIdx = workflowFn.indexOf("countDistinctVerifiedLocalEvidence");
const reprocessIdx = workflowFn.indexOf("reprocessLocalPageEvidenceRun");
const generateIdx = workflowFn.indexOf("generateOneLocalPageCandidate");
record(
  "generation-requires-three-named-refs-after-enrichment",
  namedCheckIdx >= 0 &&
    reprocessIdx >= 0 &&
    generateIdx > reprocessIdx &&
    generateIdx > namedCheckIdx &&
    workflowFn.includes("Facts were not invented.") &&
    MIN_DISTINCT_VERIFIED_LOCAL_REFERENCES_V2 === 3,
  "shared run sequence reprocesses stored evidence and blocks OpenAI until three named local references exist",
);

const mickleoverNamed = countDistinctVerifiedLocalEvidence(BROOK_DERBY_DEMO_SLUG, SERVICE, "mickleover");
record(
  "thin-saved-pack-does-not-satisfy-pre-generation-gate",
  mickleoverNamed.length < MIN_DISTINCT_VERIFIED_LOCAL_REFERENCES_V2,
  `mickleover named refs before enrichment=${mickleoverNamed.length}`,
);

fs.rmSync(tmp, { recursive: true, force: true });

const failed = checks.filter((row) => !row.pass);
if (failed.length) {
  console.error(`\n${failed.length} check(s) failed`);
  process.exit(1);
}
console.log(`\n${checks.length} checks passed`);
