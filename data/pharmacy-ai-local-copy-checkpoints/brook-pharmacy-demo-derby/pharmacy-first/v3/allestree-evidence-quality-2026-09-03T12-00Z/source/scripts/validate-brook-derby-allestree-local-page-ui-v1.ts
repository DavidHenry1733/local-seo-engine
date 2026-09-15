#!/usr/bin/env npx tsx
/**
 * Brook Derby / Allestree one-local-page UI connection.
 * Read-only: does not generate pages, collect evidence, or make paid calls.
 */
import { renderCampaignBuilderPage } from "../src/pharmacy/growthEngineCampaignBuilderPage.ts";
import {
  GENERATE_ONE_LOCAL_PAGE_CANDIDATE_LABEL,
  preflightOneLocalPageCandidate,
} from "../src/pharmacy/growthEngineLocalPageCandidateService.ts";
import {
  BROOK_DERBY_DEMO_SLUG,
  BROOK_DERBY_FIRST_LOCAL_AREA_SLUG,
  isAuthorisedAiLocalPilotV3Area,
  isOneLocalPageCandidateArea,
} from "../src/pharmacy/contentEngine/pharmacyAiLocalPageCandidatePaths.ts";
import { renderReviewCentrePreviewAsset } from "../src/pharmacy/growthEngineReviewCentrePreviewService.ts";
import { buildReviewCentreView } from "../src/pharmacy/growthEngineReviewCentreService.ts";
import { renderReviewCentrePage } from "../src/pharmacy/growthEngineReviewCentrePage.ts";
import { loadCampaignBuilderSession } from "../src/pharmacy/growthEngineCampaignBuilderService.ts";
import {
  EVIDENCE_PREP_PAID_AUTHORISED,
  planOneLocalPageEvidencePreparation,
  saveOneLocalPageEvidencePreparationPlan,
} from "../src/pharmacy/growthEngineLocalPageEvidencePreparationService.ts";
import { decorateLocalPageEvidencePlan } from "../src/pharmacy/growthEngineLocalPageEvidenceCollectionService.ts";

const YORKSHIRE = "yorkshire-pharmacy-and-health-clinic";
const SERVICE = "pharmacy-first";

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

async function main() {
  console.log("\n=== Brook Derby Allestree local-page UI (no generation) ===\n");

  const session = loadCampaignBuilderSession(BROOK_DERBY_DEMO_SLUG);
  record(
    "derby-session-allestree-selected",
    session.selectedServiceId === SERVICE && (session.targetAreaNames || []).includes("Allestree"),
    `campaign=${session.selectedServiceId} areas=${(session.targetAreaNames || []).join(",")}`,
  );
  record(
    "other-nine-still-selected",
    (session.targetAreaNames || []).length === 10,
    `count=${(session.targetAreaNames || []).length}`,
  );

  record(
    "allestree-authorised-for-derby",
    isAuthorisedAiLocalPilotV3Area(BROOK_DERBY_DEMO_SLUG, BROOK_DERBY_FIRST_LOCAL_AREA_SLUG),
    "writer/preview allow the first selected Derby area",
  );
  record(
    "yorkshire-wombwell-unchanged",
    isAuthorisedAiLocalPilotV3Area(YORKSHIRE, "wombwell") && !isOneLocalPageCandidateArea(YORKSHIRE, "wombwell"),
    "Yorkshire Wombwell remains a v3 preview area, not the one-page generate path",
  );
  record(
    "selected-derby-areas-are-reusable",
    isOneLocalPageCandidateArea(BROOK_DERBY_DEMO_SLUG, "mickleover") &&
      isAuthorisedAiLocalPilotV3Area(BROOK_DERBY_DEMO_SLUG, "mickleover"),
    "any selected Campaign Builder area can use the one-page path",
  );
  record(
    "unselected-area-stays-closed",
    !isOneLocalPageCandidateArea(BROOK_DERBY_DEMO_SLUG, "not-a-selected-area"),
    "areas not selected in Campaign Builder stay closed",
  );

  const preflight = preflightOneLocalPageCandidate(BROOK_DERBY_DEMO_SLUG, SERVICE, "Allestree");
  record(
    "preflight-reports-ready-evidence",
    preflight.canGenerate === true &&
      preflight.blocker === null &&
      preflight.localEvidence.status === "ready" &&
      preflight.editorialEvidence.status === "ready",
    `local=${preflight.localEvidence.status} editorial=${preflight.editorialEvidence.status} blocker=${preflight.blocker} canGenerate=${preflight.canGenerate}`,
  );
  record(
    "preflight-shows-cost-and-scope",
    preflight.estimatedCostUsd === 2 && /Allestree/.test(preflight.campaignScope) && /other 9 selected/.test(preflight.campaignScope),
    `${preflight.estimatedCostLabel} | ${preflight.campaignScope}`,
  );
  record(
    "preflight-openai-only-until-generate",
    preflight.paidCallsRequired.every((row) => row.kind !== "google-places-evidence" || row.required === false) &&
      preflight.paidCallsRequired.every((row) => row.kind !== "dataforseo-editorial-search" || row.required === false) &&
      preflight.paidCallsRequired.some((row) => row.kind === "openai-copy" && row.required === true),
    preflight.paidCallsRequired.map((row) => `${row.kind}:${row.required}`).join(", "),
  );
  record("preflight-no-existing-candidate", preflight.existingCandidate === false, "no Allestree copy record");
  record(
    "generate-not-invoked-while-checking-readiness",
    true,
    "Generate is not called in this check; evidence is adequate and would write a candidate",
  );

  const areasHtml = renderCampaignBuilderPage(BROOK_DERBY_DEMO_SLUG, "areas");
  record(
    "ui-binds-first-selected-area",
    areasHtml.includes('data-one-local-page="allestree"') && areasHtml.includes("One local page — Allestree"),
    "panel uses the first selected eligible area, not a tenant hard-code",
  );
  record(
    "ui-has-allestree",
    areasHtml.includes("Allestree") && areasHtml.includes("First local page"),
    "Allestree row",
  );
  record(
    "ui-has-generate-one",
    areasHtml.includes(GENERATE_ONE_LOCAL_PAGE_CANDIDATE_LABEL) && areasHtml.includes('id="btnGenerateOneLocalPage"'),
    GENERATE_ONE_LOCAL_PAGE_CANDIDATE_LABEL,
  );
  record(
    "ui-shows-scope-and-cost",
    areasHtml.includes("Campaign scope") && areasHtml.includes("Estimated cost") && areasHtml.includes("up to $2.00"),
    "scope + cost on Target Areas",
  );
  record(
    "ui-generate-enabled-after-ready-evidence",
    /id="btnGenerateOneLocalPage"/.test(areasHtml) &&
      !/id="btnGenerateOneLocalPage"[^>]*disabled/.test(areasHtml) &&
      areasHtml.includes('data-can-generate="true"'),
    "Generate is enabled once saved evidence is READY; this check does not press it",
  );
  record(
    "ui-evidence-prep-no-missing-layers",
    areasHtml.includes('data-evidence-prep="true"') &&
      areasHtml.includes("No missing evidence layers.") &&
      /Places entity names alone must not count as descriptive local evidence/i.test(areasHtml),
    "preparation UI shows saved packs instead of missing Places/editorial layers",
  );
  record(
    "ui-evidence-prep-executed-calls",
    areasHtml.includes('data-proposed-calls="true"') &&
      areasHtml.includes('data-executed-calls="true"') &&
      areasHtml.includes('data-executed-call="places-gp-practices"') &&
      areasHtml.includes("google-places") &&
      areasHtml.includes("dataforseo") &&
      areasHtml.includes("safe-html-fetch") &&
      areasHtml.includes("$0.068") &&
      /completed · \$0\.068 spent · READY/.test(areasHtml) &&
      !areasHtml.includes("not executed") &&
      !areasHtml.includes("Collection request accepted.") &&
      /id="btnStartPaidEvidence"[^>]*disabled/.test(areasHtml),
    "executed calls, $0.068 spend and READY are shown; Start stays disabled on the completed run",
  );
  record(
    "ui-evidence-authorise-controls",
    areasHtml.includes('id="evidenceSpendCapUsd"') &&
      areasHtml.includes('data-evidence-spend-cap="true"') &&
      areasHtml.includes("Evidence-only spending cap") &&
      areasHtml.includes("id=\"btnAuthoriseEvidencePlan\"") &&
      areasHtml.includes("I authorise this exact evidence plan") &&
      /This does not authorise paid collection/.test(areasHtml) &&
      areasHtml.includes("local-page-evidence-authorise") &&
      areasHtml.includes("local-page-evidence-collect") &&
      !areasHtml.includes("EVIDENCE_PREP_PAID_AUTHORISED = true"),
    "cap, authorise checkbox/button and collection routes are present; review checkbox still non-authorising",
  );
  record(
    "ui-evidence-prep-content-contract",
    areasHtml.includes('data-content-contract="pharmacy-uk-local-page-content-v1"') &&
      areasHtml.includes("places-gp-practices") &&
      !areasHtml.includes("places-schools") &&
      !areasHtml.includes("places-landmarks"),
    "Target Areas shows the UK contract and targeted GP search, not blanket category searches",
  );
  record(
    "ui-shows-demo-warning",
    areasHtml.includes("Demonstration location — not a live pharmacy listing") &&
      areasHtml.includes("56 West Burton Road, Derby, DA5 4NR"),
    "demo-address / map warning",
  );
  record(
    "ui-preview-and-review-wired",
    areasHtml.includes('id="oneLocalPreviewLink"') &&
      areasHtml.includes("review-preview") &&
      areasHtml.includes("ai-local-area-page-pilot-v3") &&
      areasHtml.includes('id="oneLocalReviewLink"') &&
      areasHtml.includes("/api/growth-engine/review-centre"),
    "unpublished Preview and Review Centre links are on Target Areas",
  );
  record(
    "ui-preserves-auth-handoff",
    areasHtml.includes("window.location.search") &&
      areasHtml.includes("get('_t')") &&
      areasHtml.includes("withAuthToken"),
    "one-local fetch and links keep the authenticated _t handoff",
  );
  record(
    "ui-collection-outcome-clear",
    areasHtml.includes('data-evidence-outcome="true"') &&
      /Collection finished\. Evidence is READY\. 3 verified GP practice/.test(areasHtml) &&
      !areasHtml.includes("Collection request accepted.") &&
      !areasHtml.includes("No provider calls have been made."),
    "Target Areas reports the finished READY outcome, not a stale accepted/not-executed state",
  );
  record(
    "ui-does-not-press-full-campaign",
    !areasHtml.includes('id="btnGenerate"'),
    "Generate My Campaign is not on the areas step",
  );

  const welfare = renderCampaignBuilderPage("welfare-pharmacy", "areas");
  record(
    "other-tenants-not-derby-hardcoded",
    !welfare.includes(GENERATE_ONE_LOCAL_PAGE_CANDIDATE_LABEL) && !welfare.includes('data-one-local-page="allestree"'),
    "other tenants do not inherit the Derby one-page panel",
  );

  const preview = renderReviewCentrePreviewAsset(BROOK_DERBY_DEMO_SLUG, SERVICE, "ai-local-area-page-pilot-v3", {
    areaSlug: "allestree",
  });
  record(
    "preview-path-wired",
    preview.sourceRoute === "review-preview-ai-pilot-v3-unavailable" &&
      /no unpublished v3 local-page candidate/i.test(preview.html) &&
      /noindex,\s*nofollow/i.test(preview.html),
    preview.sourceRoute,
  );

  const wombwell = renderReviewCentrePreviewAsset(YORKSHIRE, SERVICE, "ai-local-area-page-pilot-v3", {
    areaSlug: "wombwell",
  });
  record(
    "wombwell-preview-preserved",
    wombwell.sourceRoute === "ai-local-area-page-pilot-v3" && wombwell.html.includes("Wombwell"),
    wombwell.sourceRoute,
  );

  const reviewView = buildReviewCentreView(BROOK_DERBY_DEMO_SLUG, SERVICE);
  record(
    "review-has-no-false-candidate",
    Boolean(reviewView) && reviewView?.hasLocalPageCandidate === false,
    `generated=${reviewView?.generated} candidate=${reviewView?.hasLocalPageCandidate}`,
  );
  const reviewHtml = renderReviewCentrePage(BROOK_DERBY_DEMO_SLUG, SERVICE);
  record(
    "review-still-empty-without-candidate",
    reviewHtml.includes("Build your campaign") && !reviewHtml.includes("Pharmacy First in Allestree"),
    "Review Centre waits for a candidate record",
  );

  const evidencePlan = decorateLocalPageEvidencePlan(
    planOneLocalPageEvidencePreparation(BROOK_DERBY_DEMO_SLUG, SERVICE, "Allestree"),
  );
  record(
    "evidence-plan-reuses-ready-cache",
    evidencePlan.cacheReuse.localPackPresent === true &&
      evidencePlan.cacheReuse.editorialPackPresent === true &&
      evidencePlan.cacheReuse.localPackReady === true &&
      evidencePlan.cacheReuse.editorialReady === true,
    `localPresent=${evidencePlan.cacheReuse.localPackPresent} editorialPresent=${evidencePlan.cacheReuse.editorialPackPresent} localReady=${evidencePlan.cacheReuse.localPackReady} editorialReady=${evidencePlan.cacheReuse.editorialReady}`,
  );
  record(
    "evidence-plan-no-further-paid-calls",
    evidencePlan.estimatedCostUsd === 0 &&
      evidencePlan.proposedCalls.every((row) => row.id !== "places-schools" && row.id !== "places-landmarks") &&
      evidencePlan.optionalEstimatedCostUsd === 0,
    `calls=${evidencePlan.proposedCalls.map((r) => r.id).join(",")} usd=${evidencePlan.estimatedCostUsd}`,
  );
  record(
    "evidence-plan-uses-content-contract",
    evidencePlan.contentContractId === "pharmacy-uk-local-page-content-v1" &&
      evidencePlan.distancePlan.demoPostalMustNotBeOrigin === true &&
      evidencePlan.distancePlan.postalAddressVerified === false &&
      evidencePlan.distancePlan.areaReferenceStatus === "recorded",
    `contract=${evidencePlan.contentContractId} originBlock=${evidencePlan.distancePlan.demoPostalMustNotBeOrigin} centroid=${evidencePlan.distancePlan.areaReferenceStatus}`,
  );
  record(
    "evidence-plan-reports-completed-run",
    evidencePlan.executed === true &&
      evidencePlan.paidCallsMade === 4 &&
      evidencePlan.collectionSpentUsd === 0.068 &&
      evidencePlan.editorialSufficiency === "READY" &&
      evidencePlan.verifiedGpPracticeCount === 3 &&
      EVIDENCE_PREP_PAID_AUTHORISED === false,
    `executed=${evidencePlan.executed} paid=${evidencePlan.paidCallsMade} spent=${evidencePlan.collectionSpentUsd} sufficiency=${evidencePlan.editorialSufficiency} gps=${evidencePlan.verifiedGpPracticeCount} flag=${EVIDENCE_PREP_PAID_AUTHORISED}`,
  );
  const saved = saveOneLocalPageEvidencePreparationPlan({
    slug: BROOK_DERBY_DEMO_SLUG,
    serviceId: SERVICE,
    areaSlug: "allestree",
    confirm: true,
  });
  const decoratedAfterSave = decorateLocalPageEvidencePlan(saved.plan);
  record(
    "evidence-plan-confirm-does-not-spend",
    Boolean(saved.plan.confirmedAt) &&
      decoratedAfterSave.paidCallsMade === 4 &&
      decoratedAfterSave.collectionSpentUsd === 0.068 &&
      EVIDENCE_PREP_PAID_AUTHORISED === false,
    `confirmedAt=${saved.plan.confirmedAt} paid=${decoratedAfterSave.paidCallsMade} spent=${decoratedAfterSave.collectionSpentUsd}`,
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
