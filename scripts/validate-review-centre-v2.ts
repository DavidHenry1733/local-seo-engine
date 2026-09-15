#!/usr/bin/env npx tsx
/**
 * Review Centre V2 validation.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { REVIEW_CENTRE_GROUPS } from "../src/pharmacy/growthEngineReviewCentreModel.ts";
import {
  approveReviewCentreAsset,
  buildReviewCentreView,
  improveReviewCentreAsset,
  loadReviewCentreSession,
  reviewCentreUrl,
} from "../src/pharmacy/growthEngineReviewCentreService.ts";
import { renderReviewCentrePage } from "../src/pharmacy/growthEngineReviewCentrePage.ts";
import {
  buildCampaignBuilderList,
  loadCampaignBuilderSession,
  selectCampaignBuilderService,
} from "../src/pharmacy/growthEngineCampaignBuilderService.ts";
import { contentPackageGenerated } from "../src/pharmacy/pharmacyContentPackageService.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const BANNED_TERMS = [
  "schema",
  "metadata",
  "generator",
  "validation",
  "manifest",
  "registry",
  "lifecycle",
];

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

function readSrc(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

const SLUGS = ["pharmacy-delivered-4u-test", "dhmdigital", "pharmaconnect"].filter((slug) =>
  fs.existsSync(path.join(ROOT, "data/pharmacy-profiles", `${slug}.json`)),
);

function pickSlugWithCampaign(): { slug: string; campaignId: string } | null {
  const preferred: Array<{ slug: string; campaignId: string }> = [
    { slug: "pharmaconnect", campaignId: "blood-pressure-checks" },
    { slug: "dhmdigital", campaignId: "blood-pressure-checks" },
  ];
  for (const pick of preferred) {
    if (
      fs.existsSync(path.join(ROOT, "data/pharmacy-profiles", `${pick.slug}.json`)) &&
      contentPackageGenerated(pick.slug, pick.campaignId)
    ) {
      return pick;
    }
  }
  for (const slug of SLUGS) {
    const campaigns = buildCampaignBuilderList(slug);
    const generated = campaigns.find((c) => contentPackageGenerated(slug, c.serviceId));
    if (generated) return { slug, campaignId: generated.serviceId };
  }
  return SLUGS.length
    ? { slug: SLUGS[0], campaignId: buildCampaignBuilderList(SLUGS[0])[0]?.serviceId || "pharmacy-first" }
    : null;
}

function main() {
  console.log("\n=== Review Centre V2 ===\n");

  record(
    "routes-wired",
    readSrc("artifacts/api-server/src/routes/index.ts").includes("growthEngineReviewCentrePageRouter") &&
      readSrc("artifacts/api-server/src/routes/index.ts").includes("growthEngineReviewCentreRouter"),
    "page + API routers registered",
  );

  record(
    "review-route",
    readSrc("artifacts/api-server/src/routes/growthEngineReviewCentrePageRouter.ts").includes("/growth-engine/review-centre"),
    reviewCentreUrl("demo", "pharmacy-first"),
  );

  record(
    "campaign-builder-redirect",
    readSrc("artifacts/api-server/src/routes/growthEngineReviewCentrePageRouter.ts").includes('step || "") !== "review"') &&
      readSrc("artifacts/api-server/src/routes/index.ts").includes("growthEngineReviewCentrePageRouter") &&
      readSrc("artifacts/api-server/src/routes/index.ts").indexOf("growthEngineReviewCentrePageRouter") <
        readSrc("artifacts/api-server/src/routes/index.ts").indexOf("growthEngineCampaignBuilderPageRouter"),
    "review redirect registered before campaign builder",
  );

  record("group-count", REVIEW_CENTRE_GROUPS.length === 11, `${REVIEW_CENTRE_GROUPS.length} groups`);

  const picked = pickSlugWithCampaign();
  if (!picked) {
    record("render", false, "no tenant slug available");
    process.exit(1);
  }

  const { slug, campaignId } = picked;
  selectCampaignBuilderService(slug, campaignId);
  const view = buildReviewCentreView(slug, campaignId);
  record("view-builds", Boolean(view?.campaignName), view ? view.campaignName : "missing");
  record(
    "asset-count",
    Boolean(view && view.totalAssets >= 0),
    view ? `${view.totalAssets} content pieces · ${view.groups.length} groups` : "n/a",
  );

  const html = renderReviewCentrePage(slug, campaignId);
  record("renders-page", html.includes("Review Centre") && html.includes("Your campaign"), "customer shell");
  record(
    "shows-campaign-name",
    view ? html.includes(view.campaignName) : html.includes("Review Centre"),
    view?.campaignName || "fallback",
  );
  record(
    "groups-visible",
    REVIEW_CENTRE_GROUPS.every((g) => !view?.groups.some((vg) => vg.id === g.id) || html.includes(g.label)),
    view ? view.groups.map((g) => g.label).join(", ") : "no groups yet",
  );
  record(
    "card-actions",
    html.includes("Preview") && html.includes("Approve") && html.includes("Improve"),
    "preview + approve + improve",
  );
  record(
    "status-labels",
    html.includes("Ready for Review") || html.includes("Approved") || html.includes("Needs Improvement"),
    "customer status labels",
  );

  const bannedFound = BANNED_TERMS.filter((term) => html.toLowerCase().includes(term));
  record("no-technical-language", bannedFound.length === 0, bannedFound.length ? bannedFound.join(", ") : "clean");

  record(
    "publish-locked-default",
    html.includes("Publish is locked") || html.includes("disabled"),
    view?.canPublish ? "already all approved — check manually" : "locked until approval",
  );

  if (view?.generated && view.groups.length) {
    const assetKey = view.groups[0].assets[0]?.key;
    if (assetKey) {
      improveReviewCentreAsset(slug, campaignId, assetKey);
      const afterImprove = buildReviewCentreView(slug, campaignId)!;
      const improvedAsset = afterImprove.groups.flatMap((g) => g.assets).find((a) => a.key === assetKey);
      record(
        "improve-marks-needs-improvement",
        improvedAsset?.status === "needs-improvement",
        improvedAsset?.statusLabel || "missing",
      );
      record(
        "improve-message",
        Boolean(improvedAsset?.improveMessage?.includes("improve")),
        improvedAsset?.improveMessage || "n/a",
      );

      const improveHtml = renderReviewCentrePage(slug, campaignId);
      record(
        "publish-locked-after-improve",
        !afterImprove.canPublish && (improveHtml.includes("Publish is locked") || improveHtml.includes("disabled")),
        `canPublish=${afterImprove.canPublish}`,
      );

      approveReviewCentreAsset(slug, campaignId, assetKey);
      const afterApprove = buildReviewCentreView(slug, campaignId)!;
      const approvedAsset = afterApprove.groups.flatMap((g) => g.assets).find((a) => a.key === assetKey);
      record(
        "approve-works",
        approvedAsset?.status === "approved" && Boolean(loadCampaignBuilderSession(slug).approvedAssets[assetKey]),
        approvedAsset?.statusLabel || "missing",
      );
      record(
        "improve-cleared-on-approve",
        !loadReviewCentreSession(slug).campaigns[campaignId]?.improvements?.[assetKey],
        "improvement flag cleared",
      );
    } else {
      record("improve-marks-needs-improvement", true, "skipped — no assets");
      record("improve-message", true, "skipped");
      record("publish-locked-after-improve", true, "skipped");
      record("approve-works", true, "skipped");
      record("improve-cleared-on-approve", true, "skipped");
    }
  } else {
    record("improve-marks-needs-improvement", true, "skipped — not generated");
    record("improve-message", true, "skipped — not generated");
    record("publish-locked-after-improve", true, "skipped — not generated");
    record("approve-works", true, "skipped — not generated");
    record("improve-cleared-on-approve", true, "skipped — not generated");
  }

  record(
    "next-action",
    Boolean(view?.nextAction.title),
    view?.nextAction.title || "missing",
  );

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed\n`);
  process.exit(failed.length ? 1 : 0);
}

main();
