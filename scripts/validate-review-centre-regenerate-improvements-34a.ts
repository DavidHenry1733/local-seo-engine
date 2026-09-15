#!/usr/bin/env npx tsx
/**
 * REVIEW-CENTRE-REGENERATE-IMPROVEMENTS-34A
 * No-write fixtures. Does not regenerate live pages, publish, index, or commit.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { renderReviewCentrePage } from "../src/pharmacy/growthEngineReviewCentrePage.ts";
import { buildReviewCentreView } from "../src/pharmacy/growthEngineReviewCentreService.ts";
import { REVIEW_CENTRE_REGENERATE_IMPROVEMENTS_INTENT } from "../src/pharmacy/growthEngineReviewCentreModel.ts";
import { runProductOwnerNextCampaignWorkflow } from "../src/pharmacy/pharmacyProductOwnerNextCampaignWorkflow.ts";
import {
  rejectProductOwnerManualFields,
  resolveProductOwnerRegenerateImprovementsPlan,
  restoreLocalityLivePages,
  snapshotLocalityLivePages,
} from "../src/pharmacy/pharmacyProductOwnerRegenerateImprovementsWorkflow.ts";

const ROOT = "/home/inboxingproweb/pharmaconnect-growth-engine";
const SLUG = "yorkshire-pharmacy-and-health-clinic";
const AREAS = [
  "Darfield",
  "Wombwell",
  "Thurnscoe",
  "Grimethorpe",
  "Goldthorpe",
  "Worsbrough",
  "Hoyland",
  "Cudworth",
];

const SERVICE_PAGE = path.join(
  ROOT,
  "output/pharmacy-visual-experience",
  SLUG,
  "pharmacy-first",
  "index.html",
);
const FLU_PAGE = path.join(ROOT, "output/pharmacy-visual-experience", SLUG, "flu-vaccinations", "index.html");
const TRAVEL_PAGE = path.join(ROOT, "output/pharmacy-visual-experience", SLUG, "travel-vaccinations", "index.html");
const BP_PAGE = path.join(ROOT, "output/pharmacy-visual-experience", SLUG, "blood-pressure-checks", "index.html");

interface Check {
  id: string;
  pass: boolean;
  detail: string;
}
const checks: Check[] = [];

function record(id: string, pass: boolean, detail: string): void {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${id} — ${detail}`);
}

function shaFile(file: string): string | null {
  if (!fs.existsSync(file)) return null;
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

async function main(): Promise<void> {
  const hashesBefore = {
    pf: shaFile(SERVICE_PAGE),
    flu: shaFile(FLU_PAGE),
    travel: shaFile(TRAVEL_PAGE),
    bp: shaFile(BP_PAGE),
  };

  const view = buildReviewCentreView(SLUG, "blood-pressure-checks");
  const html = renderReviewCentrePage(SLUG, "blood-pressure-checks");
  record(
    "button-visibility",
    Boolean(view?.regenerateImprovementsVisible) &&
      html.includes('id="rcRegenerateImprovements"') &&
      html.includes(">Regenerate Improvements<"),
    view?.regenerateImprovementsVisible ? "button rendered for Needs Improvement campaign" : "button missing",
  );
  record(
    "publish-locked",
    view?.canPublish === false && /Publish is locked|disabled">Publish campaign</i.test(html),
    `canPublish=${view?.canPublish}`,
  );

  const regenFetch = html.match(
    /getElementById\('rcRegenerateImprovements'\)[\s\S]*?body:\s*JSON\.stringify\(\s*\{([\s\S]*?)\}\s*\)/,
  );
  const regenKeys = (regenFetch?.[1] || "")
    .split(",")
    .map((part) => part.replace(/:[\s\S]*$/, "").replace(/['"]/g, "").trim())
    .filter(Boolean);
  record(
    "tenant-intent-only-request",
    Boolean(regenFetch) &&
      html.includes(`data-intent="${REVIEW_CENTRE_REGENERATE_IMPROVEMENTS_INTENT}"`) &&
      html.includes(`data-tenant="${SLUG}"`) &&
      regenKeys.length === 2 &&
      regenKeys.includes("tenantSlug") &&
      regenKeys.includes("intent"),
    regenKeys.length ? `keys=${regenKeys.join(",")}` : "regen fetch body not found",
  );

  const extra = rejectProductOwnerManualFields({
    tenantSlug: SLUG,
    intent: REVIEW_CENTRE_REGENERATE_IMPROVEMENTS_INTENT,
    serviceId: "pharmacy-first",
    localities: AREAS.join(","),
    bank: "pharmacy-first",
    images: "/x.png",
  });
  record("reject-browser-manual-fields", Boolean(extra && /serviceId|localities|bank|images/.test(extra)), extra || "not rejected");

  const rejected = await runProductOwnerNextCampaignWorkflow(
    { tenantSlug: SLUG, intent: REVIEW_CENTRE_REGENERATE_IMPROVEMENTS_INTENT },
    { tenantSlug: SLUG, intent: REVIEW_CENTRE_REGENERATE_IMPROVEMENTS_INTENT, serviceId: "pharmacy-first" },
  );
  record(
    "workflow-rejects-serviceId",
    rejected.ok === false && /Manual fields are not accepted/.test(rejected.error || ""),
    rejected.error || "unexpected success",
  );

  const plan = resolveProductOwnerRegenerateImprovementsPlan(SLUG);
  record("plan-ok", plan.ok, plan.ok ? `service=${plan.plan.serviceId}` : plan.error);
  if (plan.ok) {
    const names = plan.plan.localityNames.slice().sort();
    const expected = AREAS.slice().sort();
    record(
      "eight-locality-only-scope",
      plan.plan.serviceId === "blood-pressure-checks" &&
        plan.plan.assetKey === "local-area-pages" &&
        plan.plan.localityCount === 8 &&
        names.join(",") === expected.join(",") &&
        !["flu-vaccinations", "travel-vaccinations"].includes(plan.plan.serviceId),
      `service=${plan.plan.serviceId} count=${plan.plan.localityCount} asset=${plan.plan.assetKey}`,
    );
  } else {
    record("eight-locality-only-scope", false, plan.error);
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rc-regen-34a-"));
  const live = path.join(tmp, "live.html");
  const original = "<html>thin-locality</html>";
  fs.writeFileSync(live, original, "utf8");
  const rev = path.join(tmp, "rev.html");
  fs.copyFileSync(live, rev);
  fs.writeFileSync(live, "<html>partial-write</html>", "utf8");
  restoreLocalityLivePages({ stamp: "fixture", files: [{ livePath: live, revisionPath: rev }] });
  record(
    "failure-atomicity",
    fs.readFileSync(live, "utf8") === original,
    fs.readFileSync(live, "utf8") === original ? "restore recovered prior version" : "restore failed",
  );
  record(
    "snapshot-helper-exported",
    typeof snapshotLocalityLivePages === "function",
    "snapshot helper available",
  );

  const hashesAfter = {
    pf: shaFile(SERVICE_PAGE),
    flu: shaFile(FLU_PAGE),
    travel: shaFile(TRAVEL_PAGE),
    bp: shaFile(BP_PAGE),
  };
  record(
    "service-page-byte-protection",
    hashesBefore.pf === hashesAfter.pf && Boolean(hashesBefore.pf),
    hashesBefore.pf === hashesAfter.pf ? "Pharmacy First service page unchanged" : "CHANGED",
  );
  record(
    "other-services-untouched",
    hashesBefore.flu === hashesAfter.flu &&
      hashesBefore.travel === hashesAfter.travel &&
      hashesBefore.bp === hashesAfter.bp,
    "Flu/Travel/BP outputs unchanged",
  );
  record(
    "review-centre-ready",
    Boolean(view?.generated) &&
      Boolean(view?.regenerateImprovementsVisible) &&
      view?.canPublish === false &&
      html.includes("Regenerate Improvements"),
    "Review Centre shows regenerate action and keeps publish locked",
  );

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${checks.filter((c) => c.pass).length}/${checks.length} passed`);
  if (failed.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
