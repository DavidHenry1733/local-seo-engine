#!/usr/bin/env npx tsx
/**
 * Review Centre customer publication-panel checks.
 * Does not publish, approve, regenerate, rewrite, or submit for indexing.
 */
import { ACCEPTED_PHARMACY_FIRST_LOCAL_AREAS } from "../src/pharmacy/pharmacyAcceptedPageRouteResolverV1.ts";
import { buildReviewCentreView } from "../src/pharmacy/growthEngineReviewCentreService.ts";
import { renderReviewCentrePage } from "../src/pharmacy/growthEngineReviewCentrePage.ts";
import {
  ACCEPTED_SERVICE_PAGE_PUBLICATION_AREA,
  describeAcceptedCandidatePublication,
} from "../src/pharmacy/pharmacyAcceptedCandidateDemonstrationPublishService.ts";
import { renderAcceptedCandidatePublicationPanel } from "../src/pharmacy/pharmacyAcceptedCandidateDemonstrationPublishControl.ts";

const SLUG = "brook-pharmacy-demo-derby";
const CAMPAIGN = "pharmacy-first";
const ALLESTREE_URL =
  "https://brook-pharmacy-demo-derby.sites.pharmaconnect.uk/pharmacy-first/local/allestree/";
const BROOK_HOST = "brook-pharmacy-demo-derby.sites.pharmaconnect.uk";

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

const view = buildReviewCentreView(SLUG, CAMPAIGN);
if (!view) {
  console.error("Review Centre view is missing");
  process.exit(1);
}

const html = renderReviewCentrePage(SLUG, CAMPAIGN);
const panels = [...html.matchAll(/data-publication-panel="1"[^>]*>/g)];
const localAssets = (view.groups.find((group) => group.id === "local-pages")?.assets || []).filter(
  (asset) => asset.candidateOnly,
);
const serviceAssets = (view.groups.find((group) => group.id === "service-page")?.assets || []).filter(
  (asset) => asset.candidateOnly,
);

record("eleven-candidates", localAssets.length === 10 && serviceAssets.length === 1, `locals=${localAssets.length} service=${serviceAssets.length}`);
record("eleven-panels", panels.length === 11, `panels=${panels.length}`);

const allestree = localAssets.find((asset) => asset.key.endsWith(":allestree"))?.demonstrationPublish;
record(
  "allestree-status",
  allestree?.publicationStatusLabel === "Published demonstration" && allestree.primaryAction === "view-published",
  `${allestree?.publicationStatusLabel || "missing"} / ${allestree?.primaryAction || "missing"}`,
);
record(
  "allestree-url",
  allestree?.publishedUrl === ALLESTREE_URL && allestree.destinationUrl === ALLESTREE_URL,
  allestree?.publishedUrl || "missing",
);
record(
  "allestree-view-control",
  Boolean(html.includes(`data-area="allestree"`) && html.includes("View published page") && html.includes(ALLESTREE_URL)),
  "Allestree View published page + destination present",
);
const allestreeHtml = html.slice(
  html.indexOf('data-area="allestree"'),
  html.indexOf('data-area="allestree"') + 2500,
);
record(
  "allestree-no-publish-button",
  allestreeHtml.includes("View published page") && !allestreeHtml.includes("data-publication-open-confirm"),
  "Allestree uses view action",
);

const unpublishedLocals = ACCEPTED_PHARMACY_FIRST_LOCAL_AREAS.filter((row) => row.slug !== "allestree");
for (const area of unpublishedLocals) {
  const panel = localAssets.find((asset) => asset.key.endsWith(`:${area.slug}`))?.demonstrationPublish;
  record(
    `local-${area.slug}-publish`,
    panel?.primaryAction === "publish-demonstration" && panel.primaryActionLabel === "Publish demonstration page",
    `${panel?.primaryActionLabel || "missing"}`,
  );
}

const servicePanel = serviceAssets[0]?.demonstrationPublish;
record(
  "service-publish",
  servicePanel?.primaryAction === "publish-demonstration" && servicePanel.primaryActionLabel === "Publish demonstration page",
  servicePanel?.primaryActionLabel || "missing",
);
record(
  "demonstration-notice",
  html.split("Demonstration publication — not clinically approved and not submitted for indexing.").length === 12,
  "notice on all 11 panels",
);

const confirmBlocks = [...html.matchAll(/data-publication-confirm="1"/g)];
record("confirm-panels", confirmBlocks.length === 10, `confirm dialogs=${confirmBlocks.length}`);
record(
  "confirm-checkbox-unticked",
  !/<input type="checkbox"[^>]*checked/i.test(html) && html.includes('data-publication-confirm-check="1"'),
  "checkbox present and not pre-ticked",
);
record(
  "confirm-submit-disabled",
  /data-publication-confirm-submit="1"[^>]*disabled/.test(html) &&
    !/data-publication-confirm-submit="1"(?![^>]*disabled)/.test(html.replace(/disabled=""/g, "disabled")),
  "final Publish starts disabled",
);

const sampleConfirm = renderAcceptedCandidatePublicationPanel(servicePanel!);
record(
  "confirm-fields",
  ["Pharmacy", "Campaign / service", "Page type and area", "Candidate version", "Destination URL", "Demonstration / indexing"].every(
    (label) => sampleConfirm.includes(label),
  ) && sampleConfirm.includes("Brook Pharmacy") && sampleConfirm.includes("Publish demonstration page"),
  "confirmation fields present",
);

const genuine = describeAcceptedCandidatePublication({
  tenantSlug: "pharmaconnect",
  campaignId: CAMPAIGN,
  campaignName: "Pharmacy First",
  asset: "ai-local-area-page-pilot-v3",
  area: "allestree",
});
record(
  "genuine-no-brook-dest",
  Boolean(genuine && genuine.kind === "genuine" && !String(genuine.destinationUrl).includes(BROOK_HOST)),
  genuine?.destinationUrl || "missing",
);
record(
  "genuine-publish-locked",
  genuine?.primaryAction === "locked" && Boolean(genuine.lockReason?.includes("genuine clinical approval")),
  genuine?.lockReason || "missing",
);

const genuineHtml = genuine ? renderAcceptedCandidatePublicationPanel(genuine) : "";
record(
  "genuine-no-demo-publish-control",
  !genuineHtml.includes("Publish demonstration page") && !genuineHtml.includes(BROOK_HOST),
  "genuine panel does not reuse Brook demonstration publish",
);

record(
  "responsive-css",
  html.includes("@media(max-width:720px)") && html.includes("overflow-wrap:anywhere"),
  "stacked publication controls and wrapping URLs",
);

const failed = checks.filter((row) => !row.pass);
console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
if (failed.length) process.exit(1);
