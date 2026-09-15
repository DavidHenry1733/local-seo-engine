#!/usr/bin/env npx tsx
/**
 * REVIEW-CENTRE-NEEDS-IMPROVEMENT-CAMPAIGN-RESOLUTION-38B
 * No-write fixtures. Does not regenerate live pages, publish, index, or commit.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { renderReviewCentrePage } from "../src/pharmacy/growthEngineReviewCentrePage.ts";
import { buildReviewCentreView, loadReviewCentreSession } from "../src/pharmacy/growthEngineReviewCentreService.ts";
import {
  REVIEW_CENTRE_REGENERATE_IMPROVEMENTS_INTENT,
  REVIEW_CENTRE_VERSION,
  type ReviewCentreSession,
} from "../src/pharmacy/growthEngineReviewCentreModel.ts";
import { loadCampaignBuilderSession } from "../src/pharmacy/growthEngineCampaignBuilderService.ts";
import { runProductOwnerNextCampaignWorkflow } from "../src/pharmacy/pharmacyProductOwnerNextCampaignWorkflow.ts";
import {
  listByteProtectedIntegrityPaths,
  listReviewCentreLocalityNeedsImprovementCampaigns,
  rejectProductOwnerManualFields,
  resolveProductOwnerRegenerateImprovementsPlan,
  restoreLocalityLivePages,
} from "../src/pharmacy/pharmacyProductOwnerRegenerateImprovementsWorkflow.ts";
import { resolveApprovedServiceBank } from "../src/pharmacy/pharmacyServiceVariantLibrary.ts";

const ROOT = "/home/inboxingproweb/pharmaconnect-growth-engine";
const SLUG = "yorkshire-pharmacy-and-health-clinic";
const BP = "blood-pressure-checks";
const PF = "pharmacy-first";
const BP_BANK = "523230c01178b219e9ac0ff84cfa7bfa8737029c6610f8f58e19c489792c859c";
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

const FILES_TO_HASH = [
  path.join(ROOT, "data/growth-engine", `${SLUG}-campaign-builder.json`),
  path.join(ROOT, "data/growth-engine", `${SLUG}-review-centre.json`),
  path.join(ROOT, "output/pharmacy-visual-experience", SLUG, BP, "index.html"),
  path.join(ROOT, "output/pharmacy-visual-experience", SLUG, PF, "index.html"),
  path.join(ROOT, "output/pharmacy-visual-experience", SLUG, "flu-vaccinations", "index.html"),
  path.join(ROOT, "output/pharmacy-visual-experience", SLUG, "travel-vaccinations", "index.html"),
  path.join(ROOT, "data/pharmacy-content-packages", SLUG, `${BP}.json`),
  path.join(ROOT, "data/pharmacy-content-packages", SLUG, `${PF}.json`),
  path.join(ROOT, "data/pharmacy-content-packages", SLUG, "flu-vaccinations.json"),
  path.join(ROOT, "data/pharmacy-content-packages", SLUG, "travel-vaccinations.json"),
  path.join(ROOT, "output/pharmacy-content-ecosystem", SLUG, BP, "local", "darfield", "index.html"),
  path.join(ROOT, "output/pharmacy-content-ecosystem", SLUG, BP, "local", "cudworth", "index.html"),
];

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

function fixtureSession(campaigns: ReviewCentreSession["campaigns"]): ReviewCentreSession {
  return {
    version: REVIEW_CENTRE_VERSION,
    slug: SLUG,
    updatedAt: "2026-08-27T00:00:00.000Z",
    campaigns,
  };
}

function mainSyncHashes(): Map<string, string | null> {
  return new Map(FILES_TO_HASH.map((file) => [file, shaFile(file)]));
}

async function main(): Promise<void> {
  const hashesBefore = mainSyncHashes();

  const builder = loadCampaignBuilderSession(SLUG);
  record(
    "campaign-builder-still-pharmacy-first",
    builder.selectedServiceId === PF,
    `selectedServiceId=${builder.selectedServiceId}`,
  );

  const liveSession = loadReviewCentreSession(SLUG);
  const bpNi = Boolean(liveSession.campaigns[BP]?.improvements["local-area-pages"]);
  const pfNi = Object.keys(liveSession.campaigns[PF]?.improvements || {}).length > 0;
  record(
    "review-centre-bp-localities-needs-improvement",
    bpNi && !pfNi,
    `bpLocalNi=${bpNi} pfHasNi=${pfNi}`,
  );

  const listed = listReviewCentreLocalityNeedsImprovementCampaigns(liveSession);
  record(
    "exactly-one-eligible-live-campaign",
    listed.eligible.length === 1 && listed.eligible[0] === BP,
    `eligible=${listed.eligible.join(",") || "none"}`,
  );

  const plan = resolveProductOwnerRegenerateImprovementsPlan(SLUG);
  record("authoritative-campaign-resolution", Boolean(plan.ok && plan.plan.serviceId === BP), plan.ok ? plan.plan.serviceId : plan.error);
  const names = plan.ok ? plan.plan.localityNames.slice().sort() : [];
  const expected = AREAS.slice().sort();
  record(
    "bp-bank-resolution",
    plan.ok &&
      plan.plan.approvedBankHash === BP_BANK &&
      resolveApprovedServiceBank(BP)?.hash === BP_BANK,
    plan.ok ? `bank=${plan.plan.approvedBankHash}` : plan.error,
  );
  record(
    "eight-locality-only-scope",
    plan.ok &&
      plan.plan.assetKey === "local-area-pages" &&
      plan.plan.localityCount === 8 &&
      plan.plan.localitySlugs.length === 8 &&
      names.join(",") === expected.join(",") &&
      plan.plan.niAssetKeys.includes("local-area-pages") &&
      !plan.plan.niAssetKeys.includes("service-page") &&
      !plan.plan.niAssetKeys.includes("images"),
    plan.ok
      ? `count=${plan.plan.localityCount} asset=${plan.plan.assetKey} areas=${plan.plan.localityNames.join("|")}`
      : plan.error,
  );

  const view = buildReviewCentreView(SLUG, BP);
  const html = renderReviewCentrePage(SLUG, BP);
  const regenFetch = html.match(
    /getElementById\('rcRegenerateImprovements'\)[\s\S]*?body:\s*JSON\.stringify\(\s*\{([\s\S]*?)\}\s*\)/,
  );
  const regenKeys = (regenFetch?.[1] || "")
    .split(",")
    .map((part) => part.replace(/:[\s\S]*$/, "").replace(/['"]/g, "").trim())
    .filter(Boolean);
  record(
    "tenant-intent-only-request",
    Boolean(view?.regenerateImprovementsVisible) &&
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
    campaignId: BP,
    serviceId: BP,
    localities: AREAS.join(","),
    bank: BP_BANK,
  });
  record(
    "reject-browser-manual-fields",
    Boolean(extra && /campaignId|serviceId|localities|bank/.test(extra)),
    extra || "not rejected",
  );

  const rejected = await runProductOwnerNextCampaignWorkflow(
    { tenantSlug: SLUG, intent: REVIEW_CENTRE_REGENERATE_IMPROVEMENTS_INTENT },
    {
      tenantSlug: SLUG,
      intent: REVIEW_CENTRE_REGENERATE_IMPROVEMENTS_INTENT,
      campaignId: BP,
    },
  );
  record(
    "workflow-rejects-campaignId-without-mutation",
    rejected.ok === false && /Manual fields are not accepted/.test(rejected.error || ""),
    rejected.error || "unexpected success",
  );

  const zero = resolveProductOwnerRegenerateImprovementsPlan(
    SLUG,
    fixtureSession({
      [PF]: { improvements: {} },
      [BP]: { improvements: {} },
    }),
  );
  record(
    "zero-eligible-fails",
    zero.ok === false && /No locality pages are marked as needing improvement/.test(zero.error || ""),
    zero.ok ? "unexpected success" : zero.error,
  );

  const multiple = resolveProductOwnerRegenerateImprovementsPlan(
    SLUG,
    fixtureSession({
      [PF]: { improvements: { "local-area-pages": "2026-08-27T00:00:00.000Z" } },
      [BP]: { improvements: { "local-area-pages": "2026-08-27T00:00:00.000Z" } },
    }),
  );
  record(
    "multiple-eligible-fails",
    multiple.ok === false && /Multiple campaigns have locality pages marked as needing improvement/.test(multiple.error || ""),
    multiple.ok ? "unexpected success" : multiple.error,
  );

  const fluOnly = resolveProductOwnerRegenerateImprovementsPlan(
    SLUG,
    fixtureSession({
      "flu-vaccinations": { improvements: { "local-area-pages": "2026-08-27T00:00:00.000Z" } },
    }),
  );
  record(
    "flu-travel-remain-protected",
    fluOnly.ok === false && /Refusing to regenerate Flu or Travel/.test(fluOnly.error || ""),
    fluOnly.ok ? "unexpected success" : fluOnly.error,
  );

  const servicePageOnly = resolveProductOwnerRegenerateImprovementsPlan(
    SLUG,
    fixtureSession({
      [BP]: { improvements: { "service-page": "2026-08-27T00:00:00.000Z" } },
    }),
  );
  record(
    "bp-service-page-not-regenerable",
    servicePageOnly.ok === false && /No locality pages are marked as needing improvement/.test(servicePageOnly.error || ""),
    servicePageOnly.ok ? `unexpected service=${servicePageOnly.plan.serviceId}` : servicePageOnly.error,
  );

  const localityPlusService = resolveProductOwnerRegenerateImprovementsPlan(
    SLUG,
    fixtureSession({
      [BP]: {
        improvements: {
          "local-area-pages": "2026-08-27T00:00:00.000Z",
          "service-page": "2026-08-27T00:00:00.000Z",
        },
      },
    }),
  );
  record(
    "bp-locality-allowed-service-page-excluded",
    localityPlusService.ok === true &&
      localityPlusService.plan.serviceId === BP &&
      localityPlusService.plan.assetKey === "local-area-pages" &&
      localityPlusService.plan.localityCount === 8,
    localityPlusService.ok
      ? `asset=${localityPlusService.plan.assetKey} count=${localityPlusService.plan.localityCount}`
      : localityPlusService.error,
  );

  const protectedPaths = plan.ok ? listByteProtectedIntegrityPaths(SLUG, plan.plan.serviceId) : [];
  const bpServicePage = path.join(ROOT, "output/pharmacy-visual-experience", SLUG, BP, "index.html");
  record(
    "service-page-in-byte-protection-set",
    protectedPaths.includes(bpServicePage),
    protectedPaths.includes(bpServicePage) ? "BP service page listed" : "BP service page missing from protection set",
  );

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rc-regen-38b-"));
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

  const hashesAfter = mainSyncHashes();
  const mutated = FILES_TO_HASH.filter((file) => hashesBefore.get(file) !== hashesAfter.get(file)).map((file) =>
    path.relative(ROOT, file),
  );
  record(
    "service-page-byte-protection",
    hashesBefore.get(bpServicePage) === hashesAfter.get(bpServicePage) && Boolean(hashesBefore.get(bpServicePage)),
    hashesBefore.get(bpServicePage) === hashesAfter.get(bpServicePage)
      ? "Blood Pressure service page unchanged"
      : "CHANGED",
  );
  record(
    "other-service-protection",
    mutated.length === 0,
    mutated.length ? `mutated=${mutated.join(",")}` : "campaign-builder, review centre, Flu/Travel/PF/BP files unchanged",
  );

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${checks.filter((c) => c.pass).length}/${checks.length} passed`);
  if (failed.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
