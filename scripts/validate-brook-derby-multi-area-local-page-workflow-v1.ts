#!/usr/bin/env npx tsx
/**
 * Brook Derby multi-area Campaign Builder local-page workflow.
 * Read-only: does not generate pages, collect evidence, grant allowances, or change selections.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { renderCampaignBuilderPage } from "../src/pharmacy/growthEngineCampaignBuilderPage.ts";
import {
  GENERATE_ONE_LOCAL_PAGE_CANDIDATE_LABEL,
  generateOneLocalPageCandidate,
  listSelectedOneLocalPageCandidateAreas,
  preflightOneLocalPageCandidate,
  resolveOneLocalPageCandidateArea,
} from "../src/pharmacy/growthEngineLocalPageCandidateService.ts";
import {
  BROOK_DERBY_DEMO_SLUG,
  BROOK_DERBY_FIRST_LOCAL_AREA_SLUG,
  isAuthorisedAiLocalPilotV3Area,
  isOneLocalPageCandidateArea,
} from "../src/pharmacy/contentEngine/pharmacyAiLocalPageCandidatePaths.ts";
import { authorizedTaskBudgetPathV3, oneLocalPageAuthorizedTaskIdV3 } from "../src/pharmacy/contentEngine/pharmacyAiLocalNarrativeEngineV3.ts";
import { renderReviewCentrePreviewAsset } from "../src/pharmacy/growthEngineReviewCentrePreviewService.ts";
import { buildReviewCentreView } from "../src/pharmacy/growthEngineReviewCentreService.ts";
import { renderReviewCentrePage } from "../src/pharmacy/growthEngineReviewCentrePage.ts";
import { loadCampaignBuilderSession } from "../src/pharmacy/growthEngineCampaignBuilderService.ts";
import { decorateLocalPageEvidencePlan } from "../src/pharmacy/growthEngineLocalPageEvidenceCollectionService.ts";
import { planOneLocalPageEvidencePreparation } from "../src/pharmacy/growthEngineLocalPageEvidencePreparationService.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";

const YORKSHIRE = "yorkshire-pharmacy-and-health-clinic";
const SERVICE = "pharmacy-first";
const ALLESTREE_HTML =
  "output/pharmacy-ai-local-page-pilots/brook-pharmacy-demo-derby/pharmacy-first/v3/local/allestree/index.html";
const ALLESTREE_COPY = "data/pharmacy-ai-local-copy-pilots/brook-pharmacy-demo-derby/pharmacy-first/v3/allestree.json";
const ALLESTREE_SESSION = "data/growth-engine/brook-pharmacy-demo-derby-campaign-builder.json";
const ALLESTREE_BUDGET =
  "data/pharmacy-ai-local-generation-budget/brook-pharmacy-demo-derby/pharmacy-first/v3/brook-pharmacy-demo-derby:pharmacy-first:v3:one-local-page:allestree.json";
const ALLESTREE_PROTECTED = [ALLESTREE_HTML, ALLESTREE_COPY, ALLESTREE_BUDGET];

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

function sha256File(rel: string): string {
  const full = path.join(PHARMACY_WORKSPACE_ROOT, rel);
  return createHash("sha256").update(fs.readFileSync(full)).digest("hex");
}

function panelHtml(html: string, areaSlug: string): string {
  const start = html.indexOf(`data-one-local-page="${areaSlug}"`);
  if (start < 0) return "";
  const from = html.lastIndexOf("<div", start);
  const end = html.indexOf("</script>", from);
  return html.slice(from, end > from ? end : from + 8000);
}

async function main() {
  console.log("\n=== Brook Derby multi-area local-page workflow (no generation) ===\n");

  const sessionHashBefore = sha256File(ALLESTREE_SESSION);
  const protectedBefore = Object.fromEntries(ALLESTREE_PROTECTED.map((rel) => [rel, sha256File(rel)]));
  const session = loadCampaignBuilderSession(BROOK_DERBY_DEMO_SLUG);
  record(
    "selections-unchanged",
    session.selectedServiceId === SERVICE &&
      (session.targetAreaNames || []).length === 10 &&
      (session.targetAreaNames || [])[0] === "Allestree",
    `campaign=${session.selectedServiceId} count=${(session.targetAreaNames || []).length}`,
  );
  record(
    "allestree-protected-hashes",
    sha256File(ALLESTREE_HTML) === "ff61fa498953a9f9babdf6fb0106a900e8b97f3d40c56a41936c056af54c8337" &&
      sha256File(ALLESTREE_COPY) === "b0b802374239e0c3d6f8e4a20e4c5cb47bad7b3697e90052da131d4955234dbc" &&
      sha256File(ALLESTREE_BUDGET) === "eaa3da1e737fa1d99291b662452317d4960981e295d13eec16a2cca79d6eb480",
    "Allestree HTML, copy and generation budget hashes are unchanged",
  );

  const selected = listSelectedOneLocalPageCandidateAreas(BROOK_DERBY_DEMO_SLUG);
  record(
    "selected-areas-are-reusable",
    selected.length === 10 &&
      selected[0]?.areaSlug === "allestree" &&
      selected.some((row) => row.areaSlug === "mickleover") &&
      selected.some((row) => row.areaSlug === "littleover"),
    selected.map((row) => row.areaSlug).join(","),
  );
  record(
    "legacy-default-is-allestree",
    resolveOneLocalPageCandidateArea(BROOK_DERBY_DEMO_SLUG)?.areaSlug === BROOK_DERBY_FIRST_LOCAL_AREA_SLUG,
    resolveOneLocalPageCandidateArea(BROOK_DERBY_DEMO_SLUG)?.areaSlug || "none",
  );
  record(
    "requested-area-is-used",
    resolveOneLocalPageCandidateArea(BROOK_DERBY_DEMO_SLUG, "mickleover")?.areaSlug === "mickleover" &&
      resolveOneLocalPageCandidateArea(BROOK_DERBY_DEMO_SLUG, "Littleover")?.areaSlug === "littleover",
    "Mickleover and Littleover resolve from the selected set",
  );
  record(
    "unselected-area-does-not-fall-back-to-allestree",
    resolveOneLocalPageCandidateArea(BROOK_DERBY_DEMO_SLUG, "not-a-selected-area") === null,
    "invalid requested area stays closed",
  );

  const allestree = preflightOneLocalPageCandidate(BROOK_DERBY_DEMO_SLUG, SERVICE, "Allestree");
  const mickleover = preflightOneLocalPageCandidate(BROOK_DERBY_DEMO_SLUG, SERVICE, "Mickleover");
  const littleover = preflightOneLocalPageCandidate(BROOK_DERBY_DEMO_SLUG, SERVICE, "Littleover");
  record(
    "allestree-allowance-preserved",
    allestree.areaSlug === "allestree" &&
      allestree.existingCandidate === true &&
      allestree.canGenerate === false &&
      allestree.generationAllowance.budgetPresent === true &&
      allestree.generationAllowance.remainingCalls === 0 &&
      allestree.generationAllowance.consumed === 5 &&
      Math.abs(allestree.generationAllowance.estimatedCostUsd - 0.077736) < 0.000001 &&
      allestree.distanceKm != null &&
      /4\.1 km/.test(allestree.distanceLabel),
    `${allestree.generationAllowance.allowanceLabel} | ${allestree.distanceLabel}`,
  );
  record(
    "mickleover-does-not-reuse-allestree-allowance-or-candidate",
    mickleover.areaSlug === "mickleover" &&
      mickleover.existingCandidate === false &&
      mickleover.canGenerate === true &&
      mickleover.localEvidence.status === "ready" &&
      mickleover.editorialEvidence.status === "ready" &&
      mickleover.generationAllowance.budgetPresent === false &&
      mickleover.generationAllowance.estimatedCostUsd === 0 &&
      mickleover.generationAllowance.remainingCalls === 2 &&
      mickleover.distanceKm === 3.7 &&
      /approximately 3\.7 km straight-line/.test(mickleover.distanceLabel) &&
      !/allestree/i.test(mickleover.previewUrl) &&
      /area=mickleover/.test(mickleover.previewUrl),
    `${mickleover.generationAllowance.allowanceLabel} | ${mickleover.distanceLabel} | ${mickleover.localEvidence.status}/${mickleover.editorialEvidence.status} generate=${mickleover.canGenerate}`,
  );
  record(
    "littleover-is-isolated-from-allestree-and-mickleover",
    littleover.areaSlug === "littleover" &&
      littleover.existingCandidate === false &&
      littleover.canGenerate === false &&
      littleover.generationAllowance.budgetPresent === false &&
      littleover.distanceKm == null &&
      /area=littleover/.test(littleover.previewUrl),
    `${littleover.localEvidence.status}/${littleover.editorialEvidence.status} | ${littleover.distanceLabel}`,
  );

  const allestreePlan = decorateLocalPageEvidencePlan(
    planOneLocalPageEvidencePreparation(BROOK_DERBY_DEMO_SLUG, SERVICE, "allestree"),
  );
  const mickleoverPlan = decorateLocalPageEvidencePlan(
    planOneLocalPageEvidencePreparation(BROOK_DERBY_DEMO_SLUG, SERVICE, "mickleover"),
  );
  const littleoverPlan = decorateLocalPageEvidencePlan(
    planOneLocalPageEvidencePreparation(BROOK_DERBY_DEMO_SLUG, SERVICE, "littleover"),
  );
  record(
    "area-specific-evidence-plans",
    allestreePlan.areaSlug === "allestree" &&
      allestreePlan.editorialSufficiency === "READY" &&
      allestreePlan.collectionSpentUsd === 0.068 &&
      mickleoverPlan.areaSlug === "mickleover" &&
      mickleoverPlan.editorialSufficiency === "READY" &&
      mickleoverPlan.collectionSpentUsd === 0.1 &&
      /READY/.test(mickleoverPlan.collectionOutcomeSummary || "") &&
      !/Allestree/.test(mickleoverPlan.collectionOutcomeSummary || "") &&
      littleoverPlan.areaSlug === "littleover" &&
      littleoverPlan.executed !== true &&
      (littleoverPlan.collectionSpentUsd || 0) === 0,
    `allestree=${allestreePlan.editorialSufficiency} mickleover=${mickleoverPlan.editorialSufficiency} littleoverExecuted=${littleoverPlan.executed}`,
  );

  const defaultHtml = renderCampaignBuilderPage(BROOK_DERBY_DEMO_SLUG, "areas");
  const mickleoverHtml = renderCampaignBuilderPage(BROOK_DERBY_DEMO_SLUG, "areas", { area: "mickleover" });
  const littleoverHtml = renderCampaignBuilderPage(BROOK_DERBY_DEMO_SLUG, "areas", { area: "littleover" });
  const reloadedMickleoverHtml = renderCampaignBuilderPage(BROOK_DERBY_DEMO_SLUG, "areas", { area: "mickleover" });
  const allestreePanel = panelHtml(defaultHtml, "allestree");
  const mickleoverPanel = panelHtml(mickleoverHtml, "mickleover");
  const littleoverPanel = panelHtml(littleoverHtml, "littleover");

  record(
    "ui-legacy-allestree-default",
    defaultHtml.includes('data-one-local-page="allestree"') &&
      defaultHtml.includes("One local page — Allestree") &&
      defaultHtml.includes("First local page") &&
      defaultHtml.includes(GENERATE_ONE_LOCAL_PAGE_CANDIDATE_LABEL) &&
      /id="btnGenerateOneLocalPage"[^>]*disabled/.test(defaultHtml) &&
      defaultHtml.includes("$0.077736 spent") &&
      /approximately 4\.1 km straight-line/.test(allestreePanel) &&
      allestreePanel.includes("Unpublished candidate saved"),
    "default Target Areas still opens Allestree",
  );
  record(
    "ui-switch-to-mickleover",
    mickleoverHtml.includes('data-one-local-page="mickleover"') &&
      mickleoverHtml.includes("One local page — Mickleover") &&
      mickleoverHtml.includes('data-focused-area="mickleover"') &&
      /approximately 3\.7 km straight-line/.test(mickleoverPanel) &&
      mickleoverPanel.includes("No saved candidate for this area") &&
      /data-local-evidence-status="true">ready</.test(mickleoverPanel) &&
      !mickleoverPanel.includes("$0.077736") &&
      !mickleoverPanel.includes("0 of 5 OpenAI") &&
      !mickleoverPanel.includes("Park Lane") &&
      !/approximately 4\.1 km/.test(mickleoverPanel) &&
      /id="btnGenerateOneLocalPage"/.test(mickleoverPanel) &&
      !/id="btnGenerateOneLocalPage"[^>]*disabled/.test(mickleoverPanel) &&
      mickleoverPanel.includes("area=mickleover"),
    "Mickleover panel uses Mickleover evidence, distance and allowance",
  );
  record(
    "ui-switch-to-littleover",
    littleoverHtml.includes('data-one-local-page="littleover"') &&
      littleoverHtml.includes("One local page — Littleover") &&
      littleoverPanel.includes("Distance unavailable") &&
      littleoverPanel.includes("No saved candidate for this area") &&
      !littleoverPanel.includes("$0.077736") &&
      !littleoverPanel.includes("Mickleover") &&
      !littleoverPanel.includes("Park Lane") &&
      /id="btnGenerateOneLocalPage"[^>]*disabled/.test(littleoverPanel),
    "Littleover panel is not Allestree or Mickleover",
  );
  record(
    "ui-focus-controls-do-not-change-selection-copy",
    defaultHtml.includes('data-focus-area="mickleover"') &&
      defaultHtml.includes('data-focus-area="littleover"') &&
      defaultHtml.includes("Work on Mickleover") &&
      /10 of 10 recommended areas selected/.test(defaultHtml) &&
      /10 of 10 recommended areas selected/.test(mickleoverHtml),
    "focus links exist; selection copy stays 10 of 10",
  );
  record(
    "reload-safety",
    reloadedMickleoverHtml.includes('data-one-local-page="mickleover"') &&
      reloadedMickleoverHtml.includes("One local page — Mickleover") &&
      !panelHtml(reloadedMickleoverHtml, "mickleover").includes("$0.077736"),
    "re-render with area=mickleover stays on Mickleover",
  );

  const welfare = renderCampaignBuilderPage("welfare-pharmacy", "areas");
  record(
    "tenant-isolation-welfare",
    !welfare.includes(GENERATE_ONE_LOCAL_PAGE_CANDIDATE_LABEL) &&
      !welfare.includes('data-one-local-page="allestree"') &&
      !welfare.includes("One local page — Allestree") &&
      !welfare.includes("$0.077736"),
    "Welfare does not inherit the Brook Allestree local-page panel",
  );
  record(
    "campaign-isolation-yorkshire-wombwell",
    isAuthorisedAiLocalPilotV3Area(YORKSHIRE, "wombwell") &&
      !isOneLocalPageCandidateArea(YORKSHIRE, "wombwell") &&
      resolveOneLocalPageCandidateArea(YORKSHIRE, "allestree") === null,
    "Yorkshire Wombwell stays off the Brook one-page path",
  );

  const allestreePreview = renderReviewCentrePreviewAsset(BROOK_DERBY_DEMO_SLUG, SERVICE, "ai-local-area-page-pilot-v3", {
    areaSlug: "allestree",
  });
  const mickleoverPreview = renderReviewCentrePreviewAsset(BROOK_DERBY_DEMO_SLUG, SERVICE, "ai-local-area-page-pilot-v3", {
    areaSlug: "mickleover",
  });
  const littleoverPreview = renderReviewCentrePreviewAsset(BROOK_DERBY_DEMO_SLUG, SERVICE, "ai-local-area-page-pilot-v3", {
    areaSlug: "littleover",
  });
  record(
    "preview-allestree-preserved",
    allestreePreview.sourceRoute === "ai-local-area-page-pilot-v3" &&
      allestreePreview.html.includes("Allestree") &&
      allestreePreview.html.includes("approximately 4.1 km in a straight line") &&
      allestreePreview.html.includes("Park Lane Surgery"),
    allestreePreview.sourceRoute,
  );
  record(
    "preview-ungenerated-areas-do-not-show-allestree",
    mickleoverPreview.sourceRoute === "review-preview-ai-pilot-v3-unavailable" &&
      littleoverPreview.sourceRoute === "review-preview-ai-pilot-v3-unavailable" &&
      !mickleoverPreview.html.includes("Park Lane Surgery") &&
      !littleoverPreview.html.includes("Allestree") &&
      mickleoverPreview.html.includes("mickleover"),
    `${mickleoverPreview.sourceRoute} / ${littleoverPreview.sourceRoute}`,
  );

  const reviewView = buildReviewCentreView(BROOK_DERBY_DEMO_SLUG, SERVICE);
  const reviewHtml = renderReviewCentrePage(BROOK_DERBY_DEMO_SLUG, SERVICE);
  record(
    "review-centre-routes-saved-allestree-only",
    Boolean(reviewView?.hasLocalPageCandidate) &&
      reviewHtml.includes("Pharmacy First in Allestree") &&
      reviewHtml.includes("area=allestree") &&
      !reviewHtml.includes("Pharmacy First in Mickleover") &&
      !reviewHtml.includes("Pharmacy First in Littleover"),
    `candidate=${reviewView?.hasLocalPageCandidate}`,
  );

  const generateWithoutArea = await generateOneLocalPageCandidate({
    slug: BROOK_DERBY_DEMO_SLUG,
    serviceId: SERVICE,
  });
  record(
    "generate-requires-explicit-area",
    generateWithoutArea.ok === false && /Select which area/.test(generateWithoutArea.error),
    generateWithoutArea.ok ? "generated" : generateWithoutArea.error,
  );
  const generateAllestree = await generateOneLocalPageCandidate({
    slug: BROOK_DERBY_DEMO_SLUG,
    serviceId: SERVICE,
    areaSlug: "allestree",
  });
  const generateAgain = await generateOneLocalPageCandidate({
    slug: BROOK_DERBY_DEMO_SLUG,
    serviceId: SERVICE,
    areaSlug: "allestree",
  });
  record(
    "duplicate-allestree-generate-blocked-without-calling-mickleover",
    generateAllestree.ok === false &&
      generateAgain.ok === false &&
      mickleover.canGenerate === true &&
      mickleover.existingCandidate === false &&
      defaultHtml.includes("data-submitting") &&
      /no automatic retry/.test(defaultHtml),
    `allestree=${generateAllestree.ok ? "ok" : generateAllestree.error} mickleoverGenerateAvailable=${mickleover.canGenerate}`,
  );

  const mickleoverBudget = authorizedTaskBudgetPathV3({
    slug: BROOK_DERBY_DEMO_SLUG,
    serviceId: SERVICE,
    taskId: oneLocalPageAuthorizedTaskIdV3(BROOK_DERBY_DEMO_SLUG, SERVICE, "mickleover"),
  });
  record(
    "generate-blocked-without-creating-other-area-budgets",
    !fs.existsSync(mickleoverBudget) &&
      !fs.existsSync(
        path.join(
          PHARMACY_WORKSPACE_ROOT,
          "data/pharmacy-ai-local-copy-pilots/brook-pharmacy-demo-derby/pharmacy-first/v3/mickleover.json",
        ),
      ),
    "Mickleover still has no generation budget or copy record",
  );

  for (const rel of ALLESTREE_PROTECTED) {
    record(`preserve-${path.basename(rel)}`, sha256File(rel) === protectedBefore[rel], rel);
  }
  record(
    "preserve-campaign-builder-session",
    sha256File(ALLESTREE_SESSION) === sessionHashBefore &&
      (loadCampaignBuilderSession(BROOK_DERBY_DEMO_SLUG).targetAreaNames || []).length === 10,
    "Target Areas selection and session file were not rewritten",
  );

  const failed = checks.filter((row) => !row.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
  if (failed.length) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
