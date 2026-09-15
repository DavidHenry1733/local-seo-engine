#!/usr/bin/env npx tsx
/**
 * CONTROLLED-LOCKED-CAMPAIGN-STAGING-PUBLISH-41A
 * Dry-run / local destination fixture. Does not publish live, index, or commit.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { renderReviewCentrePage } from "../src/pharmacy/growthEngineReviewCentrePage.ts";
import { readActiveServiceCampaignSelection } from "../src/pharmacy/masterAdminActiveServiceCampaignStore.ts";
import {
  createFilesystemStagingDestination,
  packageLockedCampaignStagingRelease,
  parseLockedCampaignStagingPublishRequest,
  resolveLockedCampaignStagingInventory,
  rollbackLockedCampaignStagingRelease,
  runLockedCampaignStagingPublish,
  STAGING_ROBOTS_TXT,
} from "../src/pharmacy/pharmacyLockedCampaignStagingPublishService.ts";

const ROOT = "/home/inboxingproweb/pharmaconnect-growth-engine";
const SLUG = "yorkshire-pharmacy-and-health-clinic";
const FLU = "flu-vaccinations";
const BANK = "eb79f51391b6b6e5cd0b4ac02d6cbe235306159a8847aa704eb5d64f7f4d1ce3";
const STAGING = "https://yorkshire-pharmacy-and-health-clinic.sites.pharmaconnect.uk";
const AREAS = [
  "darfield",
  "wombwell",
  "thurnscoe",
  "grimethorpe",
  "goldthorpe",
  "worsbrough",
  "hoyland",
  "cudworth",
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

function snapshotProtected(): Record<string, string | null> {
  return {
    activeCampaign: shaFile(path.join(ROOT, "data/pharmacy-master-admin/active-service-campaign", `${SLUG}.json`)),
    fluSource: shaFile(path.join(ROOT, "output/pharmacy-visual-experience", SLUG, FLU, "index.html")),
    fluDarfield: shaFile(
      path.join(ROOT, "output/pharmacy-content-ecosystem", SLUG, FLU, "local/darfield/index.html"),
    ),
    bpSource: shaFile(path.join(ROOT, "output/pharmacy-visual-experience", SLUG, "blood-pressure-checks", "index.html")),
    fluPublish: shaFile(path.join(ROOT, "output/pharmacy-publish", SLUG, FLU, "index.html")),
    bpPublish: shaFile(path.join(ROOT, "output/pharmacy-publish", SLUG, "blood-pressure-checks", "index.html")),
    assembler: shaFile(path.join(ROOT, "src/pharmacy/pharmacyPublishPackageAssembler.ts")),
    livePublish: shaFile(path.join(ROOT, "src/pharmacy/pharmacyLivePublishService.ts")),
  };
}

async function main(): Promise<void> {
  const before = snapshotProtected();
  const activeBefore = readActiveServiceCampaignSelection(SLUG);

  const extraRejected = parseLockedCampaignStagingPublishRequest(SLUG, {
    tenantSlug: SLUG,
    campaignId: FLU,
    selectedServiceId: "blood-pressure-checks",
  });
  record(
    "request-tenant-campaign-only",
    extraRejected.ok === false,
    extraRejected.ok ? "accepted extra keys" : extraRejected.unmetCondition,
  );
  const parsed = parseLockedCampaignStagingPublishRequest(SLUG, { tenantSlug: SLUG, campaignId: FLU });
  record("request-valid", parsed.ok === true && parsed.ok && parsed.campaignId === FLU, JSON.stringify(parsed));

  const inventory = resolveLockedCampaignStagingInventory(SLUG, FLU);
  const localitySlugs = inventory.pages.filter((p) => p.pageType === "locality").map((p) => p.areaSlug);
  record(
    "locked-inventory",
    inventory.ok &&
      inventory.lockedBankHash === BANK &&
      inventory.pages.length === 9 &&
      inventory.pages[0]?.pageType === "service" &&
      localitySlugs.join(",") === AREAS.join(","),
    inventory.ok
      ? `pages=${inventory.pages.length} bank=${inventory.lockedBankHash}`
      : inventory.blockers.join("; "),
  );

  const packed = packageLockedCampaignStagingRelease(inventory);
  record("package-ok", packed.ok === true, packed.ok ? `files=${packed.pkg.files.length}` : packed.blockers.join("; "));
  if (!packed.ok) {
    throw new Error("package failed; remaining checks skipped");
  }
  const pkg = packed.pkg;
  const htmlFiles = pkg.files.filter((f) => f.relativePath.endsWith("index.html"));
  const expectedRels = [
    `${FLU}/index.html`,
    ...AREAS.map((area) => `${FLU}/local/${area}/index.html`),
  ];
  record(
    "nine-page-isolation",
    htmlFiles.length === 9 &&
      expectedRels.every((rel) => pkg.files.some((f) => f.relativePath === rel)) &&
      !htmlFiles.some((f) => /blood-pressure-checks|travel-vaccinations/.test(f.relativePath)) &&
      htmlFiles.every((f) => f.relativePath.startsWith(`${FLU}/`)) &&
      !pkg.files.some((f) => f.relativePath === "sitemap.xml") &&
      pkg.pagePublicPaths.length === 9,
    `html=${htmlFiles.length} public=${pkg.pagePublicPaths.join(" ")}`,
  );

  const serviceHtml = pkg.files.find((f) => f.relativePath === `${FLU}/index.html`)!.contents.toString("utf8");
  const darfieldHtml = pkg.files.find((f) => f.relativePath === `${FLU}/local/darfield/index.html`)!.contents.toString("utf8");
  const urlOk =
    pkg.pagePublicPaths.includes(`/${FLU}/`) &&
    AREAS.every((area) => pkg.pagePublicPaths.includes(`/${FLU}/local/${area}/`)) &&
    serviceHtml.includes(`href="/${FLU}/local/darfield/"`) &&
    darfieldHtml.includes(`href="/${FLU}/"`) &&
    darfieldHtml.includes(`href="/${FLU}/local/cudworth/"`) &&
    !serviceHtml.includes("/api/pharmacy-content-ecosystem-preview/") &&
    !darfieldHtml.includes('href="/locations/"') &&
    !darfieldHtml.includes('href="/local/cudworth/"');
  record("url-link-mapping", urlOk, urlOk ? "service and locality paths rewritten" : "link rewrite incomplete");

  const canonicalOk =
    serviceHtml.includes(`<link rel="canonical" href="${STAGING}/${FLU}/"/>`) &&
    darfieldHtml.includes(`<link rel="canonical" href="${STAGING}/${FLU}/local/darfield/"/>`) &&
    !/https?:\/\/(?:www\.)?yorkshirepharmacyhealthclinic\.co\.uk/i.test(serviceHtml) &&
    !/https?:\/\/(?:www\.)?yorkshirepharmacyhealthclinic\.co\.uk/i.test(darfieldHtml);
  let jsonLdOk = false;
  try {
    const serviceLd = JSON.parse(serviceHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1]);
    const darfieldLd = JSON.parse(darfieldHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1]);
    const serviceBlob = JSON.stringify(serviceLd);
    const darfieldBlob = JSON.stringify(darfieldLd);
    jsonLdOk =
      serviceBlob.includes(`${STAGING}/${FLU}/`) &&
      darfieldBlob.includes(`${STAGING}/${FLU}/local/darfield/`) &&
      !serviceBlob.includes("yorkshirepharmacyhealthclinic.co.uk") &&
      !darfieldBlob.includes("yorkshirepharmacyhealthclinic.co.uk");
  } catch {
    jsonLdOk = false;
  }
  record("staging-canonical-jsonld", canonicalOk && jsonLdOk, canonicalOk && jsonLdOk ? "staging identity applied" : "identity rewrite failed");

  const robotsFile = pkg.files.find((f) => f.relativePath === "robots.txt")?.contents.toString("utf8") || "";
  const noindexOk =
    /name="robots"\s+content="noindex, nofollow"/.test(serviceHtml) &&
    /name="robots"\s+content="noindex, nofollow"/.test(darfieldHtml) &&
    robotsFile === STAGING_ROBOTS_TXT &&
    !/Sitemap:/i.test(robotsFile);
  const assemblerSrc = fs.readFileSync(path.join(ROOT, "src/pharmacy/pharmacyPublishPackageAssembler.ts"), "utf8");
  record(
    "noindex-protection",
    noindexOk && assemblerSrc.includes("User-agent: *\\nAllow: /\\nSitemap: sitemap.xml\\n"),
    noindexOk ? "staging Disallow; production Allow unchanged" : "index protection failed",
  );

  const html = renderReviewCentrePage(SLUG, FLU);
  record(
    "review-centre-button",
    html.includes(">Publish to staging</button>") &&
      html.includes(`data-tenant="${SLUG}"`) &&
      html.includes(`data-campaign="${FLU}"`) &&
      html.includes("/publish-to-staging") &&
      html.includes("JSON.stringify({tenantSlug:tenantSlug,campaignId:campaignId})") &&
      html.includes("Publish campaign"),
    "Publish to staging posts tenantSlug+campaignId only",
  );

  const firstRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pc-staging-41a-first-"));
  const firstDest = createFilesystemStagingDestination(firstRoot, STAGING);
  const first = await runLockedCampaignStagingPublish(
    { tenantSlug: SLUG, campaignId: FLU },
    { destination: firstDest, dryRun: true },
  );
  const firstFlu = await firstDest.readCurrent(`${FLU}/index.html`);
  record(
    "first-release-publish",
    first.ok &&
      first.dryRun &&
      first.published === false &&
      first.indexed === false &&
      first.sitemapUploaded === false &&
      Boolean(first.rollbackTarget) &&
      Boolean(firstFlu) &&
      first.health.every((h) => h.ok) &&
      first.pages.length === 9,
    first.ok ? `rollbackTarget=${first.rollbackTarget}` : `${first.error || "first publish failed"} :: ${(first.health||[]).filter(h=>!h.ok).map(h=>h.detail).join(" | ")}`,
  );
  await rollbackLockedCampaignStagingRelease(firstDest, String(first.rollbackTarget));
  const afterRollback = await firstDest.readCurrent(`${FLU}/index.html`);
  const afterList = await firstDest.listCurrent();
  record(
    "first-release-rollback",
    !afterRollback && afterList.every((rel) => !rel.startsWith(`${FLU}/`)),
    `remaining=${afterList.join(",") || "(empty)"}`,
  );

  const isoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pc-staging-41a-iso-"));
  const isoDest = createFilesystemStagingDestination(isoRoot, STAGING);
  fs.mkdirSync(path.join(isoRoot, "current/blood-pressure-checks"), { recursive: true });
  fs.mkdirSync(path.join(isoRoot, "current/travel-vaccinations"), { recursive: true });
  fs.mkdirSync(path.join(isoRoot, "current/pharmacy-first"), { recursive: true });
  fs.writeFileSync(path.join(isoRoot, "current/blood-pressure-checks/index.html"), "BP-PROTECTED");
  fs.writeFileSync(path.join(isoRoot, "current/travel-vaccinations/index.html"), "TRAVEL-PROTECTED");
  fs.writeFileSync(path.join(isoRoot, "current/pharmacy-first/index.html"), "PF-PROTECTED");
  const isolated = await runLockedCampaignStagingPublish(
    { tenantSlug: SLUG, campaignId: FLU },
    { destination: isoDest, dryRun: true },
  );
  const bpKept = (await isoDest.readCurrent("blood-pressure-checks/index.html"))?.toString("utf8") === "BP-PROTECTED";
  const travelKept = (await isoDest.readCurrent("travel-vaccinations/index.html"))?.toString("utf8") === "TRAVEL-PROTECTED";
  const pfKept = (await isoDest.readCurrent("pharmacy-first/index.html"))?.toString("utf8") === "PF-PROTECTED";
  const fluPresent = Boolean(await isoDest.readCurrent(`${FLU}/index.html`));
  const listed = await isoDest.listCurrent();
  record(
    "other-campaign-protection",
    isolated.ok && bpKept && travelKept && pfKept && fluPresent && listed.includes("blood-pressure-checks/index.html"),
    `bp=${bpKept} travel=${travelKept} pf=${pfKept} flu=${fluPresent}`,
  );

  const failRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pc-staging-41a-fail-"));
  const failDest = createFilesystemStagingDestination(failRoot, STAGING);
  fs.mkdirSync(path.join(failRoot, "current/blood-pressure-checks"), { recursive: true });
  fs.writeFileSync(path.join(failRoot, "current/blood-pressure-checks/index.html"), "BP-PROTECTED");
  const failed = await runLockedCampaignStagingPublish(
    { tenantSlug: SLUG, campaignId: FLU },
    { destination: failDest, dryRun: true, failHealthCheck: true },
  );
  const failBp = (await failDest.readCurrent("blood-pressure-checks/index.html"))?.toString("utf8") === "BP-PROTECTED";
  const failFlu = await failDest.readCurrent(`${FLU}/index.html`);
  record(
    "failure-atomicity",
    failed.ok === false && Boolean(failed.rollbackTarget) && failBp && !failFlu,
    failed.ok ? "forced failure still published" : `restored bp=${failBp} fluGone=${!failFlu}`,
  );

  const after = snapshotProtected();
  const activeAfter = readActiveServiceCampaignSelection(SLUG);
  const mutated = Object.keys(before).filter((key) => before[key] !== after[key]);
  record(
    "no-live-mutation",
    mutated.length === 0 &&
      activeAfter?.campaignId === activeBefore?.campaignId &&
      activeAfter?.serviceId === "blood-pressure-checks",
    mutated.length ? `mutated=${mutated.join(",")}` : `active=${activeAfter?.serviceId || "none"}`,
  );

  const failedIds = checks.filter((c) => !c.pass).map((c) => c.id);
  if (failedIds.length) {
    console.error(`FAIL ${failedIds.join(", ")}`);
    process.exit(1);
  }
  console.log("PASS controlled-locked-campaign-staging-publish-41a");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
