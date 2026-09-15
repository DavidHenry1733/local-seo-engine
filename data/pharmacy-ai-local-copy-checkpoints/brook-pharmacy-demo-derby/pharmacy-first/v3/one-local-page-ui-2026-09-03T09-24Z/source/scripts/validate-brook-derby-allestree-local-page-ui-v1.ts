#!/usr/bin/env npx tsx
/**
 * Brook Derby / Allestree one-local-page UI connection.
 * Read-only: does not generate pages, collect evidence, or make paid calls.
 */
import { renderCampaignBuilderPage } from "../src/pharmacy/growthEngineCampaignBuilderPage.ts";
import {
  GENERATE_ONE_LOCAL_PAGE_CANDIDATE_LABEL,
  generateOneLocalPageCandidate,
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
    "preflight-reports-missing-evidence",
    preflight.canGenerate === false && Boolean(preflight.blocker) && preflight.localEvidence.status !== "ready",
    `local=${preflight.localEvidence.status} editorial=${preflight.editorialEvidence.status} blocker=${preflight.blocker}`,
  );
  record(
    "preflight-shows-cost-and-scope",
    preflight.estimatedCostUsd === 2 && /Allestree/.test(preflight.campaignScope) && /other 9 selected/.test(preflight.campaignScope),
    `${preflight.estimatedCostLabel} | ${preflight.campaignScope}`,
  );
  record(
    "preflight-lists-paid-calls-without-running-them",
    preflight.paidCallsRequired.some((row) => row.kind === "google-places-evidence" && row.required) &&
      preflight.paidCallsRequired.some((row) => row.kind === "dataforseo-editorial-search" && row.required) &&
      preflight.paidCallsRequired.some((row) => row.kind === "openai-copy" && row.required === false),
    preflight.paidCallsRequired.map((row) => `${row.kind}:${row.required}`).join(", "),
  );
  record("preflight-no-existing-candidate", preflight.existingCandidate === false, "no Allestree copy record");

  const generated = await generateOneLocalPageCandidate({
    slug: BROOK_DERBY_DEMO_SLUG,
    serviceId: SERVICE,
    areaSlug: BROOK_DERBY_FIRST_LOCAL_AREA_SLUG,
  });
  record(
    "generate-refuses-without-evidence",
    generated.ok === false && /evidence/i.test(generated.error),
    generated.ok ? "unexpected ok" : generated.error,
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
    "ui-shows-demo-warning",
    areasHtml.includes("Demonstration location — not a live pharmacy listing") &&
      areasHtml.includes("56 West Burton Road, Derby, DA5 4NR"),
    "demo-address / map warning",
  );
  record(
    "ui-generate-disabled",
    /id="btnGenerateOneLocalPage"[^>]*disabled/.test(areasHtml),
    "button stays disabled while evidence is missing",
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
