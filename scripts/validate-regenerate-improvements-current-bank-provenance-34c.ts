#!/usr/bin/env npx tsx
/**
 * REGENERATE-IMPROVEMENTS-CURRENT-BANK-PROVENANCE-34C
 * No-write fixtures. Does not regenerate, publish, index, or mutate live state.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  assertImprovementRunBankAlignment,
  bindCurrentRegisteredApprovedBank,
  currentRunPreviewQuery,
  previewCacheHeaders,
  resolveCurrentRunLocalityHtmlPath,
  resolvePreviewSourceFromPackage,
  selectRegisteredApprovedBank,
  withCurrentRunPreviewParams,
} from "../src/pharmacy/pharmacyApprovedBankRunProvenance.ts";
import { loadFrozenCustomerCampaignGenerationContext } from "../src/pharmacy/contentEngine/customerCampaignGenerationContext.ts";
import {
  isHistoricalOutputPath,
  type CampaignRunStamp,
  type CurrentRunCampaignInventory,
} from "../src/pharmacy/pharmacyCurrentRunCampaignHandoff.ts";
import {
  loadContentPackage,
  replaceLocalityReviewInventory,
  type ContentPackageManifest,
} from "../src/pharmacy/pharmacyContentPackageService.ts";
import { buildReviewCentreView } from "../src/pharmacy/growthEngineReviewCentreService.ts";
import { resolveApprovedServiceBank } from "../src/pharmacy/pharmacyServiceVariantLibrary.ts";

const ROOT = "/home/inboxingproweb/pharmaconnect-growth-engine";
const SLUG = "yorkshire-pharmacy-and-health-clinic";
const SERVICE_ID = "pharmacy-first";
const OLD_HASH = "3e7ee7f5724e48b5e5d6b76ecb14d50008d0f55746d467b3e243713576e3795e";
const NEW_HASH = "46de67243945c2bc572cba35aa9ac0fdd5806fb8813fbf89506bdfabdd517cdb";

const SERVICE_PAGE = path.join(ROOT, "output/pharmacy-visual-experience", SLUG, SERVICE_ID, "index.html");
const CONTRACT_FILE = path.join(
  ROOT,
  "data/pharmacy-approved-service-banks/banks/pharmacy-first/service-page-contract-v1.json",
);
const FROZEN_CONTEXT = path.join(
  ROOT,
  "data/growth-engine",
  `${SLUG}-campaign-generation-context-${SERVICE_ID}.json`,
);
const PACKAGE_FILE = path.join(ROOT, "data/pharmacy-content-packages", SLUG, `${SERVICE_ID}.json`);
const OLD_BANK = path.join(ROOT, "data/pharmacy-approved-service-banks/banks/pharmacy-first", `${OLD_HASH}.json`);
const NEW_BANK = path.join(ROOT, "data/pharmacy-approved-service-banks/banks/pharmacy-first", `${NEW_HASH}.json`);
const LOCAL_ROOT = path.join(ROOT, "output/pharmacy-content-ecosystem", SLUG, SERVICE_ID, "local");
const OTHER_SERVICES = ["flu-vaccinations", "travel-vaccinations", "blood-pressure-checks"] as const;

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

function shaFile(file: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function listRevisionFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listRevisionFiles(full));
    else if (entry.isFile()) out.push(full);
  }
  return out.sort();
}

function snapshotOtherServiceBytes(): Map<string, string> {
  const map = new Map<string, string>();
  for (const serviceId of OTHER_SERVICES) {
    for (const file of [
      path.join(ROOT, "data/pharmacy-content-packages", SLUG, `${serviceId}.json`),
      path.join(ROOT, "output/pharmacy-visual-experience", SLUG, serviceId, "index.html"),
    ]) {
      if (fs.existsSync(file)) map.set(file, shaFile(file));
    }
  }
  return map;
}

function main(): void {
  const servicePageBefore = shaFile(SERVICE_PAGE);
  const contractBefore = shaFile(CONTRACT_FILE);
  const frozenBefore = shaFile(FROZEN_CONTEXT);
  const packageBefore = shaFile(PACKAGE_FILE);
  const otherBefore = snapshotOtherServiceBytes();
  const revisionFiles = listRevisionFiles(path.join(LOCAL_ROOT, "cudworth", "revisions"));
  const revisionHashes = new Map(revisionFiles.map((file) => [file, shaFile(file)]));

  const oldBankExists = fs.existsSync(OLD_BANK) && shaFile(OLD_BANK) === OLD_HASH;
  const frozen = loadFrozenCustomerCampaignGenerationContext(SLUG, SERVICE_ID);
  const frozenPack = JSON.stringify(frozen?.generationContext?.variantPack || {});
  record(
    "old-frozen-bank-exists",
    oldBankExists && Boolean(frozen) && frozenPack.includes("Book or walk in"),
    oldBankExists
      ? `old bank file present; frozen pack contains Book or walk in=${frozenPack.includes("Book or walk in")}`
      : "old bank file missing",
  );

  const registry = resolveApprovedServiceBank(SERVICE_ID);
  const newBankExists = fs.existsSync(NEW_BANK) && shaFile(NEW_BANK) === NEW_HASH;
  record(
    "newer-registered-bank-exists",
    newBankExists && registry?.hash === NEW_HASH,
    `registry=${registry?.hash || "missing"} file=${newBankExists ? NEW_HASH : "missing"}`,
  );

  const frozenCtx = frozen?.generationContext;
  if (!frozenCtx) throw new Error("Frozen campaign context missing");
  const bound = bindCurrentRegisteredApprovedBank(frozenCtx);
  const selected = selectRegisteredApprovedBank(SERVICE_ID);
  const boundPack = JSON.stringify(bound.variantPack || {});
  record(
    "regeneration-selects-newer-registered-bank",
    selected.hash === NEW_HASH &&
      bound.approvedBankHash === NEW_HASH &&
      bound.approvedBankHash !== OLD_HASH &&
      boundPack.includes("Book or walk in") === false &&
      frozenPack.includes("Book or walk in") === true,
    `selected=${selected.hash} bound=${bound.approvedBankHash} frozen-old-phrase=${frozenPack.includes("Book or walk in")} bound-old-phrase=${boundPack.includes("Book or walk in")}`,
  );
  record(
    "frozen-context-unwritten",
    shaFile(FROZEN_CONTEXT) === frozenBefore,
    "frozen campaign context byte-unchanged",
  );

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "regen-improvements-34c-"));
  const freshRunId = "fresh-run-34c-fixture";
  const freshCudworth = path.join(tmp, "local", "cudworth", "index.html");
  fs.mkdirSync(path.dirname(freshCudworth), { recursive: true });
  fs.writeFileSync(freshCudworth, `<html><head></head><body>fresh ${NEW_HASH} ${freshRunId}</body></html>`);
  const oldRevision = revisionFiles.find((file) => file.includes("/cudworth/revisions/")) || path.join(
    LOCAL_ROOT,
    "cudworth/revisions/f9831f44-b004-4ec1-8f75-f633d1b5a8e5/index.html",
  );
  const livePkg = loadContentPackage(SLUG, SERVICE_ID);
  if (!livePkg) throw new Error("Content package missing");
  const mixedInventory: CurrentRunCampaignInventory = {
    runId: freshRunId,
    generationStamp: {
      tenantSlug: SLUG,
      campaignId: SERVICE_ID,
      generatedAt: new Date().toISOString(),
      sourceContext: "customer-imported-profile",
      runId: freshRunId,
      approvedBankHash: NEW_HASH,
    },
    servicePagePath: livePkg.currentRunInventory?.servicePagePath || SERVICE_PAGE,
    localityPagePaths: [freshCudworth, oldRevision],
    reviewRecordPaths: [],
    approvedBankHash: NEW_HASH,
  };
  const nextPkg: ContentPackageManifest = {
    ...livePkg,
    approvedBankHash: NEW_HASH,
    generationStamp: mixedInventory.generationStamp,
    currentRunInventory: mixedInventory,
  };
  const preview = resolvePreviewSourceFromPackage(nextPkg, "local-area-pages", "cudworth");
  const mixedResolved = resolveCurrentRunLocalityHtmlPath(mixedInventory, "cudworth");
  record(
    "fresh-run-review-pointer",
    preview.file === freshCudworth &&
      mixedResolved === freshCudworth &&
      Boolean(oldRevision) &&
      isHistoricalOutputPath(oldRevision) &&
      preview.runId === freshRunId &&
      preview.approvedBankHash === NEW_HASH &&
      (preview.file || "").includes("/revisions/") === false,
    `file=${preview.file} historical=${isHistoricalOutputPath(oldRevision)}`,
  );

  const remainingRevisions = revisionFiles.filter((file) => fs.existsSync(file) && shaFile(file) === revisionHashes.get(file));
  record(
    "old-revisions-preserved",
    revisionFiles.length > 0 && remainingRevisions.length === revisionFiles.length,
    `${remainingRevisions.length}/${revisionFiles.length} Cudworth revision files unchanged`,
  );

  const previewUrl = withCurrentRunPreviewParams(
    `/api/growth-engine/${SLUG}/review-preview?campaign=${SERVICE_ID}&asset=local-area-pages&area=cudworth`,
    freshRunId,
    NEW_HASH,
  );
  const headers = previewCacheHeaders(freshRunId, NEW_HASH);
  const view = buildReviewCentreView(SLUG, SERVICE_ID);
  const localityAsset = view?.groups.flatMap((g) => g.assets).find((a) => a.key === "local-area-pages");
  const liveRunId = livePkg.currentRunInventory?.runId || livePkg.generationStamp?.runId || "";
  record(
    "preview-cache-version-protection",
    previewUrl.includes(`run=${freshRunId}`) &&
      previewUrl.includes(`bank=${NEW_HASH}`) &&
      currentRunPreviewQuery(freshRunId, NEW_HASH).includes("run=") &&
      headers["Cache-Control"]?.includes("no-store") === true &&
      headers["X-Pharmacy-Run-Id"] === freshRunId &&
      headers["X-Approved-Bank-Hash"] === NEW_HASH &&
      Boolean(localityAsset?.previewUrl?.includes(`run=${liveRunId}`)),
    `url=${previewUrl} review=${localityAsset?.previewUrl || "missing"}`,
  );

  const aligned = assertImprovementRunBankAlignment({
    generatedBankHash: NEW_HASH,
    reviewBankHash: NEW_HASH,
    registryBankHash: NEW_HASH,
  });
  const mismatched = assertImprovementRunBankAlignment({
    generatedBankHash: OLD_HASH,
    reviewBankHash: NEW_HASH,
    registryBankHash: NEW_HASH,
  });
  const stamp: CampaignRunStamp = {
    tenantSlug: SLUG,
    campaignId: SERVICE_ID,
    generatedAt: livePkg.generationStamp?.generatedAt || new Date().toISOString(),
    sourceContext: "customer-imported-profile",
    runId: livePkg.currentRunInventory?.runId || livePkg.generationStamp?.runId || "mismatch-fixture",
    approvedBankHash: OLD_HASH,
  };
  const replaceAttempt = replaceLocalityReviewInventory(SLUG, SERVICE_ID, {
    localityPagePaths: livePkg.currentRunInventory?.localityPagePaths || [],
    generationStamp: stamp,
    approvedBankHash: NEW_HASH,
  });
  record(
    "atomic-mismatch-protection",
    aligned.ok === true &&
      mismatched.ok === false &&
      replaceAttempt.ok === false &&
      Boolean(replaceAttempt.error) &&
      shaFile(PACKAGE_FILE) === packageBefore &&
      shaFile(SERVICE_PAGE) === servicePageBefore,
    replaceAttempt.ok ? "replace mutated state" : replaceAttempt.error || "mismatch blocked",
  );

  record(
    "service-page-integrity",
    shaFile(SERVICE_PAGE) === servicePageBefore && shaFile(CONTRACT_FILE) === contractBefore,
    "approved service page and contract byte-for-byte unchanged",
  );

  const otherChanged: string[] = [];
  const otherAfter = snapshotOtherServiceBytes();
  for (const [file, hash] of otherBefore) {
    if (otherAfter.get(file) !== hash) otherChanged.push(path.relative(ROOT, file));
  }
  record(
    "other-service-integrity",
    otherChanged.length === 0,
    otherChanged.length ? otherChanged.join(",") : "flu/travel/bp unchanged",
  );

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${checks.filter((c) => c.pass).length}/${checks.length} passed`);
  if (failed.length) process.exitCode = 1;
}

main();
