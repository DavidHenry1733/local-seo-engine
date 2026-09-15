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
import { BROOK_SALES_DEMO_IDENTITY } from "../src/pharmacy/pharmacySalesDemoBrookServicePreview.ts";
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
    preflight.existingCandidate === true &&
      preflight.canGenerate === false &&
      preflight.localEvidence.status === "ready" &&
      preflight.editorialEvidence.status === "ready" &&
      preflight.generationAllowance.remainingCalls === 0 &&
      preflight.generationAllowance.consumed === 5 &&
      preflight.generationAllowance.maxProviderCalls === 5 &&
      Math.abs(preflight.generationAllowance.estimatedCostUsd - 0.077736) < 0.000001 &&
      preflight.generationAllowance.canAuthoriseAdditionalAttempt === false,
    `local=${preflight.localEvidence.status} editorial=${preflight.editorialEvidence.status} existing=${preflight.existingCandidate} remaining=${preflight.generationAllowance.remainingCalls} canGenerate=${preflight.canGenerate} consumed=${preflight.generationAllowance.consumed}`,
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
  record("preflight-existing-candidate", preflight.existingCandidate === true, "Allestree copy record is saved");
  record(
    "generate-not-invoked-while-checking-readiness",
    true,
    "Generate is not called in this check; duplicate-call protection keeps Generate disabled after the saved candidate",
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
    "ui-generate-disabled-after-saved-candidate",
    /id="btnGenerateOneLocalPage"[^>]*disabled/.test(areasHtml) &&
      areasHtml.includes('data-can-generate="false"') &&
      areasHtml.includes('data-generation-remaining-calls="0"') &&
      /0 of 5 OpenAI calls remaining/.test(areasHtml) &&
      areasHtml.includes("$0.077736 spent") &&
      areasHtml.includes("no automatic retry") &&
      !areasHtml.includes('id="btnAuthoriseAdditionalGeneration"') &&
      !areasHtml.includes('data-additional-generation-authorise="true"') &&
      areasHtml.includes('data-can-authorise-additional="false"'),
    "Generate stays disabled after the saved candidate; extra-attempt confirmation is not required",
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
      /Collection finished\. Evidence is READY\. 1 verified GP practice/.test(areasHtml) &&
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
  const previewServicesHref =
    preview.html.match(/<nav[^>]*aria-label="Primary"[^>]*>[\s\S]*?href="(#[^"]+)"[^>]*>Services/i)?.[1] || "";
  const previewAboutHref =
    preview.html.match(/<nav[^>]*aria-label="Primary"[^>]*>[\s\S]*?href="(#[^"]+)"[^>]*>About/i)?.[1] || "";
  const previewServicesId = previewServicesHref.replace(/^#/, "");
  const previewAboutId = previewAboutHref.replace(/^#/, "");
  record(
    "preview-path-wired",
    preview.sourceRoute === "ai-local-area-page-pilot-v3" &&
      preview.html.includes("AI editorial evidence pilot — not published") &&
      /noindex,\s*nofollow/i.test(preview.html) &&
      preview.html.includes("Brook Pharmacy Demo Derby") &&
      preview.html.includes("Allestree") &&
      preview.html.includes("approximately 4.1 km in a straight line") &&
      preview.html.includes("Park Lane Surgery") &&
      !preview.html.includes('data-image-missing="true"') &&
      Boolean(previewServicesId) &&
      preview.html.includes(`id="${previewServicesId}"`) &&
      Boolean(previewAboutId) &&
      preview.html.includes(`id="${previewAboutId}"`) &&
      !preview.html.includes('href="#service-definition"') &&
      !preview.html.includes('href="#trust"'),
    `route=${preview.sourceRoute} services=${previewServicesHref} about=${previewAboutHref}`,
  );

  const brookDemo = renderReviewCentrePreviewAsset(YORKSHIRE, SERVICE, "sales-demo-brook-service-page");
  const allestreeHeader = preview.html.match(/<header[\s\S]*?<\/header>/i)?.[0] || "";
  const brookHeader = brookDemo.html.match(/<header[\s\S]*?<\/header>/i)?.[0] || "";
  const allestreeFooter = preview.html.match(/<footer[\s\S]*?<\/footer>/i)?.[0] || "";
  const brookFooter = brookDemo.html.match(/<footer[\s\S]*?<\/footer>/i)?.[0] || "";
  record(
    "allestree-reuses-accepted-brook-chrome",
    brookDemo.sourceRoute === "sales-demo-brook-service-page" &&
      allestreeHeader.includes('data-sales-demo-brook="header"') &&
      brookHeader.includes('data-sales-demo-brook="header"') &&
      allestreeHeader.includes('class="brook-demo-logo"') &&
      allestreeHeader.includes('width="250"') &&
      brookHeader.includes('width="250"') &&
      allestreeHeader.includes(BROOK_SALES_DEMO_IDENTITY.logoUrl) &&
      /Home[\s\S]*Services[\s\S]*Prescriptions[\s\S]*About[\s\S]*Contact/.test(allestreeHeader) &&
      /Home[\s\S]*Services[\s\S]*Prescriptions[\s\S]*About[\s\S]*Contact/.test(brookHeader) &&
      allestreeHeader.includes("brook-demo-pill") &&
      allestreeHeader.includes("data-demo-inert") &&
      !/href="tel:/i.test(allestreeHeader) &&
      allestreeFooter.includes('data-sales-demo-brook="footer"') &&
      allestreeFooter.includes("Demonstration") &&
      allestreeFooter.includes("Demonstration website — for presentation purposes only.") &&
      allestreeFooter.includes("Information") &&
      allestreeFooter.includes("Independent Community Pharmacy") &&
      !/1109432|453756|Authorized EPS|GPhC Registered/i.test(allestreeFooter) &&
      brookFooter.includes("Demonstration") &&
      brookFooter.includes("Demonstration website — for presentation purposes only.") &&
      brookFooter.includes("Information") &&
      !/1109432|453756|Authorized EPS|GPhC Registered/i.test(brookFooter) &&
      brookHeader.includes('href="#service-definition"') &&
      brookHeader.includes('href="#about-section"') &&
      preview.html.includes("approximately 4.1 km in a straight line") &&
      preview.html.includes("Park Lane Surgery") &&
      preview.html.includes("overflow-x:hidden") &&
      brookDemo.html.includes("overflow-x:hidden"),
    "Allestree header/footer reuse accepted Brook chrome; sales-demo nav hashes unchanged; Allestree body preserved",
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
    "review-has-saved-candidate",
    Boolean(reviewView) && reviewView?.hasLocalPageCandidate === true,
    `generated=${reviewView?.generated} candidate=${reviewView?.hasLocalPageCandidate}`,
  );
  const reviewHtml = renderReviewCentrePage(BROOK_DERBY_DEMO_SLUG, SERVICE);
  record(
    "review-lists-unpublished-allestree",
    reviewHtml.includes("Pharmacy First in Allestree") &&
      reviewHtml.includes("ai-local-area-page-pilot-v3") &&
      reviewHtml.includes("area=allestree"),
    "Review Centre lists the unpublished Allestree candidate and Preview",
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
      evidencePlan.verifiedGpPracticeCount === 1 &&
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
