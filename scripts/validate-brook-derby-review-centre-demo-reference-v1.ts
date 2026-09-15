#!/usr/bin/env npx tsx
/**
 * Brook Derby dashboard → Pharmacy First Review Centre connection
 * and unpublished Yorkshire-hosted service-page demo reference.
 * Does not generate, publish, approve, or edit accepted pages.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderPremiumCustomerDashboardPage } from "../src/pharmacy/growthEnginePremiumCustomerDashboardPage.ts";
import { buildPremiumCustomerDashboardView } from "../src/pharmacy/growthEnginePremiumCustomerDashboard.ts";
import { usesCommercialBlueBaseline } from "../src/pharmacy/pharmacyCommercialBlueUiBaseline.ts";
import {
  approveReviewCentreAsset,
  buildReviewCentreView,
  improveReviewCentreAsset,
  readableReviewSourceFinding,
  SERVICE_PAGE_DEMO_REFERENCE_KEY,
  SERVICE_PAGE_DEMO_REFERENCE_TITLE,
} from "../src/pharmacy/growthEngineReviewCentreService.ts";
import { renderReviewCentrePage } from "../src/pharmacy/growthEngineReviewCentrePage.ts";
import { renderReviewCentrePreviewAsset } from "../src/pharmacy/growthEngineReviewCentrePreviewService.ts";
import { SALES_DEMO_BROOK_SERVICE_PAGE_ASSET } from "../src/pharmacy/pharmacySalesDemoBrookServicePreview.ts";
import { loadCampaignBuilderSession } from "../src/pharmacy/growthEngineCampaignBuilderService.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BROOK = "brook-pharmacy-demo-derby";
const YORKSHIRE = "yorkshire-pharmacy-and-health-clinic";
const PHARMACONNECT = "pharmaconnect";
const PF = "pharmacy-first";
const FLU = "flu-vaccinations";
const YORKSHIRE_DEMO_PREVIEW = `/api/growth-engine/${YORKSHIRE}/review-preview?campaign=${PF}&asset=${SALES_DEMO_BROOK_SERVICE_PAGE_ASSET}`;
const ALLESTREE_PREVIEW = `/api/growth-engine/${BROOK}/review-preview?campaign=${PF}&asset=ai-local-area-page-pilot-v3&area=allestree`;

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

function sha(file: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function main() {
  console.log("\n=== Brook Derby Review Centre demo reference ===\n");

  const builderFile = path.join(ROOT, "data/growth-engine/brook-pharmacy-demo-derby-campaign-builder.json");
  const fluPkg = path.join(ROOT, "data/pharmacy-content-packages", YORKSHIRE, "flu-vaccinations.json");
  const allestreeHtml = path.join(
    ROOT,
    "output/pharmacy-ai-local-page-pilots/brook-pharmacy-demo-derby/pharmacy-first/v3/local/allestree/index.html",
  );
  const yorkshireVisual = path.join(
    ROOT,
    "output/pharmacy-visual-experience/yorkshire-pharmacy-and-health-clinic/pharmacy-first/index.html",
  );
  const builderBefore = sha(builderFile);
  const fluBefore = fs.existsSync(fluPkg) ? sha(fluPkg) : "";
  const allestreeBefore = sha(allestreeHtml);
  const visualBefore = sha(yorkshireVisual);
  const rcSessionExistsBefore = fs.existsSync(path.join(ROOT, "data/growth-engine/brook-pharmacy-demo-derby-review-centre.json"));

  const saved = loadCampaignBuilderSession(BROOK);
  record("saved-campaign-context-pharmacy-first", saved.selectedServiceId === PF, saved.selectedServiceId);

  const brookDash = buildPremiumCustomerDashboardView(BROOK);
  const brookDashHtml = renderPremiumCustomerDashboardPage(BROOK);
  const rcCard = brookDash.featureJourney.find((card) => card.id === "review-centre");
  record(
    "brook-dashboard-opens-pharmacy-first",
    Boolean(rcCard?.href.includes(`campaign=${PF}`)) && !rcCard?.href.includes(`campaign=${FLU}`),
    rcCard?.href || "missing",
  );
  record(
    "brook-dashboard-html-pharmacy-first",
    /review-centre\?slug=brook-pharmacy-demo-derby&amp;campaign=pharmacy-first/.test(brookDashHtml) &&
      !/review-centre\?slug=brook-pharmacy-demo-derby&amp;campaign=flu-vaccinations/.test(brookDashHtml),
    "dashboard Review Centre action",
  );
  record("brook-dashboard-no-tokens", !brookDashHtml.includes("_t="), "no login token in HTML");
  const publishing = brookDash.featureJourney.find((card) => card.id === "managed-publishing");
  record(
    "brook-publishing-flu-preserved",
    Boolean(publishing?.href.includes(`service=${FLU}`)),
    publishing?.href || "missing",
  );

  const yorkDash = buildPremiumCustomerDashboardView(YORKSHIRE);
  const yorkRc = yorkDash.featureJourney.find((card) => card.id === "review-centre");
  record(
    "yorkshire-dashboard-flu-preserved",
    Boolean(yorkRc?.href.includes(`campaign=${FLU}`)),
    yorkRc?.href || "missing",
  );

  const fluView = buildReviewCentreView(BROOK, FLU);
  record(
    "brook-flu-review-unchanged-empty",
    Boolean(fluView) && fluView?.generated === false && fluView?.hasLocalPageCandidate === false && !fluView?.groups.length,
    `generated=${fluView?.generated} groups=${fluView?.groups.length}`,
  );
  const fluHtml = renderReviewCentrePage(BROOK, FLU);
  record(
    "brook-flu-no-demo-reference",
    !fluHtml.includes(SERVICE_PAGE_DEMO_REFERENCE_TITLE) && fluHtml.includes("Build your campaign first"),
    "flu Review Centre empty",
  );

  const pfView = buildReviewCentreView(BROOK, PF);
  const keys = pfView?.groups.flatMap((group) => group.assets.map((asset) => asset.key)) || [];
  const demo = pfView?.groups.flatMap((group) => group.assets).find((asset) => asset.key === SERVICE_PAGE_DEMO_REFERENCE_KEY);
  const allestree = pfView?.groups.flatMap((group) => group.assets).find((asset) => asset.key === "ai-local-area-page-pilot-v3:allestree");
  record("brook-pf-generated-false", pfView?.generated === false, String(pfView?.generated));
  record("brook-pf-has-allestree", Boolean(allestree), allestree?.title || "missing");
  record(
    "brook-pf-has-demo-reference",
    demo?.title === SERVICE_PAGE_DEMO_REFERENCE_TITLE &&
      demo.candidateOnly === true &&
      demo.required === false &&
      demo.previewUrl === YORKSHIRE_DEMO_PREVIEW &&
      demo.statusLabel === "Unpublished reference",
    demo?.previewUrl || "missing",
  );
  record(
    "brook-pf-demo-not-counted-generated",
    pfView?.packageContentGenerated === 0 && !demo?.items?.length,
    `generatedItems=${pfView?.packageContentGenerated}`,
  );
  record("brook-pf-cannot-publish", pfView?.canPublish === false && pfView?.campaignLockReady === false, `canPublish=${pfView?.canPublish}`);
  record("brook-pf-required-group-count-excludes-reference", pfView?.requiredGroupCount === 0, String(pfView?.requiredGroupCount));
  record(
    "brook-pf-counts-split",
    pfView?.campaignAssetCount === 0 &&
      pfView?.localCandidateCount === 1 &&
      pfView?.demoReferenceCount === 1 &&
      pfView?.packageContentGenerated === 0,
    `campaign=${pfView?.campaignAssetCount} local=${pfView?.localCandidateCount} demo=${pfView?.demoReferenceCount}`,
  );
  record(
    "allestree-findings-readable",
    Boolean(allestree?.sourceFindings?.length) &&
      allestree!.sourceFindings!.every(
        (finding) =>
          !finding.includes("allestree:") &&
          !/^Editorial fact /i.test(finding) &&
          !/^Local evidence allestree:/i.test(finding),
      ) &&
      allestree!.sourceFindings!.some((finding) => /Park Lane Surgery/.test(finding)) &&
      allestree!.sourceFindings!.some((finding) => /neighbourhood ward in Derby/.test(finding)),
    (allestree?.sourceFindings || []).join(" | ") || "missing",
  );
  const distanceFinding = (allestree?.sourceFindings || []).find((finding) => /straight line/.test(finding)) || "";
  record(
    "allestree-distance-source-readable",
    /Brook Pharmacy Demo Derby is approximately 4\.1 km in a straight line from Allestree\.?$/.test(
      distanceFinding.replace(/^Saved source — Pharmacy relationship:\s*/, ""),
    ) &&
      !/places-area-reference/i.test(distanceFinding) &&
      !/profile:coordinates/i.test(distanceFinding) &&
      !/\b52\.95295\b/.test(distanceFinding) &&
      !/\b-1\.49257\b/.test(distanceFinding),
    distanceFinding || "missing distance source",
  );
  record(
    "readable-finding-helper-strips-ids",
    readableReviewSourceFinding("Editorial fact allestree:area-identity:allestree-is-a-neighbourhood-ward-in-derby").includes(
      "Area identity",
    ) &&
      !readableReviewSourceFinding("Editorial fact allestree:area-identity:allestree-is-a-neighbourhood-ward-in-derby").includes(
        "allestree:",
      ),
    readableReviewSourceFinding("Editorial fact allestree:area-identity:allestree-is-a-neighbourhood-ward-in-derby"),
  );

  const pfHtml = renderReviewCentrePage(BROOK, PF);
  record(
    "brook-pf-html-allestree-and-demo",
    pfHtml.includes("Pharmacy First in Allestree") &&
      pfHtml.includes("ai-local-area-page-pilot-v3") &&
      pfHtml.includes("area=allestree") &&
      pfHtml.includes(SERVICE_PAGE_DEMO_REFERENCE_TITLE) &&
      pfHtml.includes(`asset=${SALES_DEMO_BROOK_SERVICE_PAGE_ASSET}`) &&
      pfHtml.includes(YORKSHIRE) &&
      pfHtml.includes('data-demo-reference="unpublished-service-page"') &&
      pfHtml.includes("Unpublished reference"),
    "both review cards",
  );
  const demoCard = pfHtml.match(/data-demo-reference="unpublished-service-page"[\s\S]*?<\/article>/)?.[0] || "";
  record(
    "brook-pf-demo-not-pending-generation",
    !/Service-page demo reference[\s\S]{0,80}still needs to be created/.test(pfHtml),
    "reference is not listed as needing creation",
  );
  record(
    "brook-pf-demo-no-approve-or-publish",
    demoCard.includes("Preview") &&
      !demoCard.includes("rc-btn-approve") &&
      !demoCard.includes("Approve") &&
      !pfHtml.includes("Publish campaign") &&
      !demoCard.includes("rc-btn-improve"),
    "reference cannot be approved or published",
  );
  record("brook-pf-html-no-tokens", !pfHtml.includes("_t="), "no login token in Review Centre HTML");
  record(
    "brook-pf-uses-dashboard-design-system",
    usesCommercialBlueBaseline(pfHtml) &&
      pfHtml.includes("pcd-shell") &&
      pfHtml.includes("pcd-header") &&
      pfHtml.includes("pcd-btn-step") &&
      pfHtml.includes("Inter") &&
      pfHtml.includes("#005eb8") &&
      /@media\s*\(\s*max-width:\s*720px\s*\)/.test(pfHtml),
    "dashboard tokens, shell, header, primary button, responsive",
  );
  record(
    "brook-pf-preview-is-primary",
    /class="rc-btn rc-btn-primary pcd-btn-step"[^>]*area=allestree/.test(pfHtml) &&
      /class="rc-btn rc-btn-primary pcd-btn-step"[^>]*sales-demo-brook-service-page/.test(pfHtml),
    "Preview uses primary dashboard button",
  );
  record(
    "brook-pf-no-false-completion",
    !/0 of 43 campaign content items are ready for review/.test(pfHtml) &&
      pfHtml.includes("Campaign pages have not been generated yet") &&
      pfHtml.includes("Planned campaign content") &&
      pfHtml.includes("reviewable candidate") &&
      pfHtml.includes("unpublished reference") &&
      pfHtml.includes("data-count-split"),
    "counts and planned copy do not imply completion",
  );
  record(
    "brook-pf-sources-expandable-no-raw-ids",
    pfHtml.includes("Sources and checks") &&
      pfHtml.includes("<details class=\"rc-sources\">") &&
      !pfHtml.includes("Editorial fact allestree:") &&
      !pfHtml.includes("Local evidence allestree:") &&
      !pfHtml.includes("allestree:area-identity:") &&
      !pfHtml.includes("allestree:community:") &&
      !pfHtml.includes("allestree:healthcare:") &&
      !pfHtml.includes("allestree:pharmacy-relationship:") &&
      !pfHtml.includes("places-area-reference") &&
      !pfHtml.includes("profile:coordinates") &&
      !pfHtml.includes("52.95295") &&
      !pfHtml.includes("-1.49257") &&
      /Brook Pharmacy Demo Derby is approximately 4\.1 km in a straight line from Allestree/.test(pfHtml),
    "readable sources only",
  );
  const allestreeCard = pfHtml.match(/data-asset-key="ai-local-area-page-pilot-v3:allestree"[\s\S]*?<\/article>/)?.[0] || "";
  record(
    "brook-pf-allestree-preview-only-action",
    allestreeCard.includes("Preview") &&
      !allestreeCard.includes("rc-btn-approve") &&
      !allestreeCard.includes("Approve") &&
      !allestreeCard.includes("rc-btn-improve"),
    "Allestree stays a reviewable candidate",
  );

  const brookDemoOnBrook = renderReviewCentrePreviewAsset(BROOK, PF, SALES_DEMO_BROOK_SERVICE_PAGE_ASSET);
  record(
    "tenant-access-brook-cannot-host-demo",
    brookDemoOnBrook.sourceRoute === "sales-demo-brook-service-page-unavailable",
    brookDemoOnBrook.sourceRoute,
  );
  const yorkshireDemo = renderReviewCentrePreviewAsset(YORKSHIRE, PF, SALES_DEMO_BROOK_SERVICE_PAGE_ASSET);
  record(
    "tenant-access-yorkshire-hosts-demo",
    yorkshireDemo.sourceRoute === "sales-demo-brook-service-page" && yorkshireDemo.html.includes("Brook Pharmacy"),
    yorkshireDemo.sourceRoute,
  );
  const allestreePreview = renderReviewCentrePreviewAsset(BROOK, PF, "ai-local-area-page-pilot-v3", { areaSlug: "allestree" });
  record(
    "allestree-preview-unchanged-route",
    allestreePreview.sourceRoute === "ai-local-area-page-pilot-v3" && allestreePreview.html.includes("Allestree"),
    allestreePreview.sourceRoute,
  );

  const isolatedHtml = renderReviewCentrePage(PHARMACONNECT, PF);
  record(
    "tenant-isolation-pharmaconnect-no-demo",
    !isolatedHtml.includes(SERVICE_PAGE_DEMO_REFERENCE_TITLE) && !isolatedHtml.includes(YORKSHIRE_DEMO_PREVIEW),
    "pharmaconnect has no Brook demo reference",
  );

  let approveBlocked = false;
  try {
    approveReviewCentreAsset(BROOK, PF, SERVICE_PAGE_DEMO_REFERENCE_KEY);
  } catch (err) {
    approveBlocked = /cannot be approved or published/i.test(err instanceof Error ? err.message : String(err));
  }
  const improve = improveReviewCentreAsset(BROOK, PF, SERVICE_PAGE_DEMO_REFERENCE_KEY);
  record("approve-blocked", approveBlocked, "approve throws");
  record("improve-blocked", improve.improved === false, improve.message);
  record("campaign-builder-unmutated", sha(builderFile) === builderBefore, builderBefore.slice(0, 12));
  record(
    "review-centre-session-not-created",
    fs.existsSync(path.join(ROOT, "data/growth-engine/brook-pharmacy-demo-derby-review-centre.json")) === rcSessionExistsBefore,
    "no fabricated review session",
  );
  record("accepted-allestree-unchanged", sha(allestreeHtml) === allestreeBefore, allestreeBefore.slice(0, 12));
  record("accepted-yorkshire-visual-unchanged", sha(yorkshireVisual) === visualBefore, visualBefore.slice(0, 12));
  record("yorkshire-flu-package-unchanged", !fluBefore || sha(fluPkg) === fluBefore, fluBefore.slice(0, 12) || "missing");
  record("keys-include-both", keys.includes(SERVICE_PAGE_DEMO_REFERENCE_KEY) && keys.includes("ai-local-area-page-pilot-v3:allestree"), keys.join(","));

  const failed = checks.filter((row) => !row.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
  if (failed.length) process.exitCode = 1;
}

main();
