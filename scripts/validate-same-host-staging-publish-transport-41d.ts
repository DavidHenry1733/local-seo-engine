#!/usr/bin/env npx tsx
/**
 * SAME-HOST-STAGING-PUBLISH-TRANSPORT-41D
 * Validates local-filesystem staging transport without publishing Flu.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { readActiveServiceCampaignSelection } from "../src/pharmacy/masterAdminActiveServiceCampaignStore.ts";
import { readManagedPublishingProfile } from "../src/pharmacy/masterAdminManagedPublishingService.ts";
import { readPlatformPublishingInfrastructure } from "../src/pharmacy/masterAdminPlatformPublishingInfrastructureService.ts";
import {
  APPROVED_STAGING_PUBLISH_ROOT,
  LOCAL_STAGING_TRANSPORT,
  REMOTE_STAGING_TRANSPORT,
  STAGING_TRANSPORT_FIXTURE_PREFIX,
  assertPathInsideApprovedRoot,
  collectApplicationHostAddresses,
  createLocalFilesystemStagingDestination,
  isSameHostAsApplication,
  resolveLockedCampaignStagingTransport,
} from "../src/pharmacy/pharmacyLockedCampaignStagingLocalTransport.ts";
import {
  packageLockedCampaignStagingRelease,
  resolveLockedCampaignStagingInventory,
  rollbackLockedCampaignStagingRelease,
  runLockedCampaignStagingPublish,
} from "../src/pharmacy/pharmacyLockedCampaignStagingPublishService.ts";

const ROOT = "/home/inboxingproweb/pharmaconnect-growth-engine";
const SLUG = "yorkshire-pharmacy-and-health-clinic";
const FLU = "flu-vaccinations";
const BANK = "eb79f51391b6b6e5cd0b4ac02d6cbe235306159a8847aa704eb5d64f7f4d1ce3";
const STAGING = "https://yorkshire-pharmacy-and-health-clinic.sites.pharmaconnect.uk";
const EXPECTED_HOST = "51.161.86.187";
const FIXTURE_SLUG = `${STAGING_TRANSPORT_FIXTURE_PREFIX}transport-fixture`;
const FIXTURE_ROOT = path.join(APPROVED_STAGING_PUBLISH_ROOT, FIXTURE_SLUG);
const YORKSHIRE_ROOT = path.join(APPROVED_STAGING_PUBLISH_ROOT, SLUG);
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

function listDir(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).sort();
}

function snapshotProtected(): Record<string, string | null> {
  return {
    activeCampaign: shaFile(path.join(ROOT, "data/pharmacy-master-admin/active-service-campaign", `${SLUG}.json`)),
    fluApproval: shaFile(
      path.join(ROOT, "data/pharmacy-master-admin/campaign-approvals", SLUG, `${FLU}.json`),
    ),
    fluSource: shaFile(path.join(ROOT, "output/pharmacy-visual-experience", SLUG, FLU, "index.html")),
    fluDarfield: shaFile(
      path.join(ROOT, "output/pharmacy-content-ecosystem", SLUG, FLU, "local/darfield/index.html"),
    ),
    bpSource: shaFile(path.join(ROOT, "output/pharmacy-visual-experience", SLUG, "blood-pressure-checks", "index.html")),
    fluBank: shaFile(path.join(ROOT, "data/pharmacy-approved-service-banks/banks", FLU, `${BANK}.json`)),
    assembler: shaFile(path.join(ROOT, "src/pharmacy/pharmacyPublishPackageAssembler.ts")),
    livePublish: shaFile(path.join(ROOT, "src/pharmacy/pharmacyLivePublishService.ts")),
    sftpDest: shaFile(path.join(ROOT, "src/pharmacy/pharmacyLockedCampaignStagingSftpDestination.ts")),
    managedPublishing: shaFile(path.join(ROOT, "data/pharmacy-master-admin/managed-publishing", `${SLUG}.json`)),
  };
}

function yorkshireState(): { entries: string[]; releases: string[]; currentExists: boolean } {
  return {
    entries: listDir(YORKSHIRE_ROOT),
    releases: listDir(path.join(YORKSHIRE_ROOT, "releases")),
    currentExists: fs.existsSync(path.join(YORKSHIRE_ROOT, "current")),
  };
}

async function main(): Promise<void> {
  const before = snapshotProtected();
  const activeBefore = readActiveServiceCampaignSelection(SLUG);
  const managedBefore = readManagedPublishingProfile(SLUG);
  const yorkshireBefore = yorkshireState();
  const dryRunTmp = path.join(os.tmpdir(), `pc-staging-dryrun-${SLUG}`);

  try {
    const infra = readPlatformPublishingInfrastructure();
    const appHosts = collectApplicationHostAddresses();
    const sameHost = isSameHostAsApplication(infra.serverHost);
    record(
      "same-host-detection",
      infra.serverHost === EXPECTED_HOST && sameHost && appHosts.includes(EXPECTED_HOST),
      `dest=${infra.serverHost} local=${sameHost} nics-include-expected=${appHosts.includes(EXPECTED_HOST)}`,
    );

    let rootWritable = false;
    try {
      fs.accessSync(APPROVED_STAGING_PUBLISH_ROOT, fs.constants.W_OK);
      rootWritable = true;
    } catch {
      rootWritable = false;
    }
    record(
      "approved-root-exists-writable",
      infra.globalPublishRoot === APPROVED_STAGING_PUBLISH_ROOT &&
        fs.existsSync(APPROVED_STAGING_PUBLISH_ROOT) &&
        fs.statSync(APPROVED_STAGING_PUBLISH_ROOT).isDirectory() &&
        rootWritable,
      `root=${infra.globalPublishRoot} writable=${rootWritable}`,
    );

    const resolved = resolveLockedCampaignStagingTransport(SLUG);
    record(
      "explicit-local-same-host-resolution",
      resolved.ok &&
        resolved.explicitlyLocal &&
        resolved.transport === LOCAL_STAGING_TRANSPORT &&
        resolved.sameHost &&
        resolved.tenantRoot === YORKSHIRE_ROOT &&
        infra.lockedCampaignStagingTransport === LOCAL_STAGING_TRANSPORT,
      resolved.ok ? `transport=${resolved.transport}` : resolved.blockers.join("; "),
    );

    let escapeFailed = false;
    try {
      assertPathInsideApprovedRoot("/tmp/pc-41d-escape");
    } catch {
      escapeFailed = true;
    }
    let traversalFailed = false;
    try {
      assertPathInsideApprovedRoot(path.join(APPROVED_STAGING_PUBLISH_ROOT, "..", "etc"));
    } catch {
      traversalFailed = true;
    }
    const unsafeSlug = resolveLockedCampaignStagingTransport("../etc");
    const emptySlug = resolveLockedCampaignStagingTransport("");
    const symlinkProbe = path.join(APPROVED_STAGING_PUBLISH_ROOT, `${STAGING_TRANSPORT_FIXTURE_PREFIX}symlink-probe`);
    let symlinkBlocked = false;
    fs.symlinkSync("/tmp", symlinkProbe);
    try {
      const symlinkResolved = resolveLockedCampaignStagingTransport(`${STAGING_TRANSPORT_FIXTURE_PREFIX}symlink-probe`, {
        fixture: true,
      });
      symlinkBlocked = !symlinkResolved.ok && symlinkResolved.blockers.some((b) => /symlink/i.test(b));
    } finally {
      fs.unlinkSync(symlinkProbe);
    }
    const remoteHostBlocked = isSameHostAsApplication("8.8.8.8") === false;
    record(
      "path-safety",
      escapeFailed &&
        traversalFailed &&
        unsafeSlug.ok === false &&
        emptySlug.ok === false &&
        symlinkBlocked &&
        remoteHostBlocked &&
        !fs.existsSync(symlinkProbe),
      `escape=${escapeFailed} traversal=${traversalFailed} unsafeSlug=${!unsafeSlug.ok} symlink=${symlinkBlocked} remoteHost=${remoteHostBlocked}`,
    );

    const inventory = resolveLockedCampaignStagingInventory(SLUG, FLU);
    const packed = packageLockedCampaignStagingRelease(inventory);
    const expectedRels = [`${FLU}/index.html`, ...AREAS.map((area) => `${FLU}/local/${area}/index.html`)];
    const htmlFiles = packed.ok ? packed.pkg.files.filter((f) => f.relativePath.endsWith("index.html")) : [];
    const foreign = packed.ok
      ? packed.pkg.files.filter((file) => {
          if (file.relativePath === "robots.txt" || file.relativePath.startsWith("assets/")) return false;
          return !file.relativePath.startsWith(`${FLU}/`);
        })
      : [{ relativePath: "missing" }];
    record(
      "locked-inventory-nine-flu-paths",
      inventory.ok &&
        packed.ok &&
        inventory.lockedBankHash === BANK &&
        inventory.pages.length === 9 &&
        packed.pkg.pagePublicPaths.length === 9 &&
        htmlFiles.length === 9 &&
        expectedRels.every((rel) => packed.pkg.files.some((f) => f.relativePath === rel)) &&
        foreign.length === 0 &&
        htmlFiles.every((f) => f.relativePath.startsWith(`${FLU}/`)) &&
        !htmlFiles.some((f) => /blood-pressure-checks|travel-vaccinations|pharmacy-first/.test(f.relativePath)),
      inventory.ok && packed.ok
        ? `pages=${inventory.pages.length} html=${htmlFiles.length} files=${packed.pkg.files.length} bank=${inventory.lockedBankHash} foreign=${foreign.length}`
        : [...inventory.blockers, ...(packed.ok ? [] : packed.blockers)].join("; "),
    );

    const dry = await runLockedCampaignStagingPublish({ tenantSlug: SLUG, campaignId: FLU }, { dryRun: true });
    record(
      "local-transport-dry-run",
      dry.ok &&
        dry.dryRun &&
        dry.published === false &&
        dry.indexed === false &&
        dry.sitemapUploaded === false &&
        dry.pages.length === 9 &&
        expectedRels.every((rel) => dry.pages.includes(`/${rel.replace(/\/index\.html$/, "/")}`)) &&
        yorkshireState().currentExists === yorkshireBefore.currentExists &&
        yorkshireState().releases.length === yorkshireBefore.releases.length,
      dry.ok ? `pages=${dry.pages.join(" ")}` : dry.error || dry.unmetCondition || "dry-run failed",
    );

    const dest = createLocalFilesystemStagingDestination({
      tenantSlug: FIXTURE_SLUG,
      stagingBaseUrl: STAGING,
      fixture: true,
    });
    record("fixture-dest-kind", dest.kind === "local", `kind=${dest.kind}`);
    const published = await runLockedCampaignStagingPublish(
      { tenantSlug: SLUG, campaignId: FLU },
      { destination: dest, dryRun: true },
    );
    const fluCurrent = await dest.readCurrent(`${FLU}/index.html`);
    const releaseDirs = listDir(path.join(FIXTURE_ROOT, "releases"));
    const currentIsDir =
      fs.existsSync(path.join(FIXTURE_ROOT, "current")) && fs.statSync(path.join(FIXTURE_ROOT, "current")).isDirectory();
    record(
      "atomic-release-fixture",
      published.ok &&
        dest.kind === "local" &&
        Boolean(published.releaseId) &&
        Boolean(published.rollbackTarget) &&
        Boolean(fluCurrent) &&
        currentIsDir &&
        releaseDirs.includes(String(published.releaseId)) &&
        published.pages.length === 9 &&
        published.health.every((h) => h.ok),
      published.ok
        ? `release=${published.releaseId} current=${currentIsDir} releases=${releaseDirs.join(",")}`
        : published.error || published.unmetCondition || "fixture publish failed",
    );

    await rollbackLockedCampaignStagingRelease(dest, String(published.rollbackTarget));
    const afterRollback = await dest.readCurrent(`${FLU}/index.html`);
    const listedAfterRollback = await dest.listCurrent();
    record(
      "atomic-rollback-fixture",
      !afterRollback && listedAfterRollback.every((rel) => !rel.startsWith(`${FLU}/`)),
      `remaining=${listedAfterRollback.join(",") || "(empty)"}`,
    );

    const failDest = createLocalFilesystemStagingDestination({
      tenantSlug: FIXTURE_SLUG,
      stagingBaseUrl: STAGING,
      fixture: true,
    });
    fs.mkdirSync(path.join(FIXTURE_ROOT, "current/blood-pressure-checks"), { recursive: true });
    fs.writeFileSync(path.join(FIXTURE_ROOT, "current/blood-pressure-checks/index.html"), "BP-PROTECTED");
    const failed = await runLockedCampaignStagingPublish(
      { tenantSlug: SLUG, campaignId: FLU },
      { destination: failDest, dryRun: true, failHealthCheck: true },
    );
    const failBp =
      (await failDest.readCurrent("blood-pressure-checks/index.html"))?.toString("utf8") === "BP-PROTECTED";
    const failFlu = await failDest.readCurrent(`${FLU}/index.html`);
    record(
      "fixture-failure-atomicity",
      failed.ok === false && Boolean(failed.rollbackTarget) && failBp && !failFlu,
      failed.ok ? "forced failure still published" : `restored bp=${failBp} fluGone=${!failFlu}`,
    );

    const sftpSource = fs.readFileSync(
      path.join(ROOT, "src/pharmacy/pharmacyLockedCampaignStagingSftpDestination.ts"),
      "utf8",
    );
    const serviceSource = fs.readFileSync(
      path.join(ROOT, "src/pharmacy/pharmacyLockedCampaignStagingPublishService.ts"),
      "utf8",
    );
    record(
      "sftp-remote-transport-preserved",
      infra.publishingMethod === "static_html_sftp" &&
        infra.port === 2126 &&
        infra.serverHost === EXPECTED_HOST &&
        infra.credentialsConfigured === true &&
        Boolean(infra.credentialReference) &&
        resolved.transport === LOCAL_STAGING_TRANSPORT &&
        REMOTE_STAGING_TRANSPORT === "static_html_sftp" &&
        /export async function createManagedSftpStagingDestination/.test(sftpSource) &&
        /createManagedSftpStagingDestination/.test(serviceSource) &&
        /kind: "sftp"/.test(sftpSource),
      `method=${infra.publishingMethod} port=${infra.port} localOverlay=${resolved.transport}`,
    );
  } finally {
    if (fs.existsSync(FIXTURE_ROOT)) {
      fs.rmSync(FIXTURE_ROOT, { recursive: true, force: true });
    }
    if (fs.existsSync(dryRunTmp)) {
      fs.rmSync(dryRunTmp, { recursive: true, force: true });
    }
    const leftoverProbe = path.join(APPROVED_STAGING_PUBLISH_ROOT, `${STAGING_TRANSPORT_FIXTURE_PREFIX}symlink-probe`);
    if (fs.existsSync(leftoverProbe)) fs.unlinkSync(leftoverProbe);
  }

  const after = snapshotProtected();
  const activeAfter = readActiveServiceCampaignSelection(SLUG);
  const managedAfter = readManagedPublishingProfile(SLUG);
  const yorkshireAfter = yorkshireState();
  const mutated = Object.keys(before).filter((key) => before[key] !== after[key]);
  record(
    "real-staging-state-unchanged",
    !fs.existsSync(FIXTURE_ROOT) &&
      yorkshireAfter.currentExists === false &&
      yorkshireAfter.releases.length === 0 &&
      yorkshireBefore.releases.length === 0 &&
      yorkshireBefore.currentExists === false &&
      yorkshireAfter.entries.join(",") === yorkshireBefore.entries.join(",") &&
      mutated.length === 0 &&
      activeAfter?.campaignId === activeBefore?.campaignId &&
      activeAfter?.serviceId === "blood-pressure-checks" &&
      managedAfter?.publishedVersion === 0 &&
      managedBefore?.publishedVersion === 0,
    `yorkshire=${yorkshireAfter.entries.join(",") || "(missing)"} releases=${yorkshireAfter.releases.length} current=${yorkshireAfter.currentExists} mutated=${mutated.join(",") || "none"} publishedVersion=${managedAfter?.publishedVersion}`,
  );

  const failedIds = checks.filter((c) => !c.pass).map((c) => c.id);
  if (failedIds.length) {
    console.error(`FAIL ${failedIds.join(", ")}`);
    process.exit(1);
  }
  console.log("PASS same-host-staging-publish-transport-41d");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
