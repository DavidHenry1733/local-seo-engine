#!/usr/bin/env npx tsx
/**
 * LOCALITY-REGENERATION-LINK-MAP-TRANSACTION-38D
 * No-write fixtures. Does not regenerate live pages, publish, index, or commit.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { applyCampaignRunStampToJson, createCampaignRunStamp } from "../src/pharmacy/pharmacyCurrentRunCampaignHandoff.ts";
import {
  assertCurrentRunLocalitySidecarContents,
  assertReturnedCurrentRunLocalitySidecars,
  isCurrentCampaignLocalitySidecarPath,
  listByteProtectedIntegrityPaths,
  listCurrentRunLocalitySidecarPaths,
  listLocalityTransactionSnapshotLivePaths,
  resolveProductOwnerRegenerateImprovementsPlan,
  restoreLocalityLivePages,
  type CurrentRunLocalitySidecarContext,
} from "../src/pharmacy/pharmacyProductOwnerRegenerateImprovementsWorkflow.ts";

const ROOT = "/home/inboxingproweb/pharmaconnect-growth-engine";
const SLUG = "yorkshire-pharmacy-and-health-clinic";
const BP = "blood-pressure-checks";
const PF = "pharmacy-first";
const FLU = "flu-vaccinations";
const TRAVEL = "travel-vaccinations";
const BP_BANK = "523230c01178b219e9ac0ff84cfa7bfa8737029c6610f8f58e19c489792c859c";
const RUN_ID = "38d-fixture-run-aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee";

const eco = (serviceId: string, ...parts: string[]) =>
  path.join(ROOT, "output/pharmacy-content-ecosystem", SLUG, serviceId, ...parts);
const vis = (serviceId: string) =>
  path.join(ROOT, "output/pharmacy-visual-experience", SLUG, serviceId, "index.html");
const pkg = (serviceId: string) =>
  path.join(ROOT, "data/pharmacy-content-packages", SLUG, `${serviceId}.json`);

const FILES_TO_HASH = [
  path.join(ROOT, "data/growth-engine", `${SLUG}-campaign-builder.json`),
  path.join(ROOT, "data/growth-engine", `${SLUG}-review-centre.json`),
  vis(BP),
  vis(PF),
  vis(FLU),
  vis(TRAVEL),
  pkg(BP),
  pkg(PF),
  pkg(FLU),
  pkg(TRAVEL),
  path.join(ROOT, "data/pharmacy-image-assignments", `${SLUG}.json`),
  path.join(ROOT, "data/pharmacy-approved-service-banks/registry.json"),
  path.join(ROOT, "data/pharmacy-approved-service-banks/banks", BP, `${BP_BANK}.json`),
  eco(BP, "_internal-link-map.json"),
  eco(BP, "_ecosystem-index.json"),
  eco(BP, "local", "darfield", "index.html"),
  eco(BP, "packs", "gbp-posts.json"),
  eco(PF, "_internal-link-map.json"),
  eco(PF, "_ecosystem-index.json"),
  eco(FLU, "_internal-link-map.json"),
  eco(FLU, "_ecosystem-index.json"),
  eco(TRAVEL, "_internal-link-map.json"),
  eco(TRAVEL, "_ecosystem-index.json"),
  eco(BP, "revisions", "8c8b0712-c8d4-4a26-b95d-3095c21a5e18", "_internal-link-map.json"),
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

function listed(paths: string[], file: string): boolean {
  const resolved = path.resolve(file);
  return paths.some((entry) => path.resolve(entry) === resolved);
}

function stampRaw(file: string, runId = RUN_ID): string {
  const stamp = createCampaignRunStamp(SLUG, BP, "2026-08-28T00:00:00.000Z", runId, BP_BANK);
  return applyCampaignRunStampToJson(fs.readFileSync(file, "utf8"), stamp);
}

function sidecarCtx(planLocalityNames: string[], planLocalitySlugs: string[]): CurrentRunLocalitySidecarContext {
  return {
    tenantSlug: SLUG,
    serviceId: BP,
    runId: RUN_ID,
    storedLocalityNames: planLocalityNames,
    storedLocalitySlugs: planLocalitySlugs,
  };
}

function main(): void {
  const hashesBefore = new Map(FILES_TO_HASH.map((file) => [file, shaFile(file)]));

  const planResult = resolveProductOwnerRegenerateImprovementsPlan(SLUG);
  record(
    "plan-resolves-blood-pressure",
    planResult.ok && planResult.plan.serviceId === BP && planResult.plan.localityCount === 8,
    planResult.ok
      ? `service=${planResult.plan.serviceId} count=${planResult.plan.localityCount}`
      : planResult.error,
  );
  if (!planResult.ok) {
    console.log("\n0 fixtures ran after plan failure");
    process.exitCode = 1;
    return;
  }
  const plan = planResult.plan;
  const ctx = sidecarCtx(plan.localityNames, plan.localitySlugs);
  const protectedPaths = listByteProtectedIntegrityPaths(SLUG, BP);
  const snapshotPaths = listLocalityTransactionSnapshotLivePaths(SLUG, BP, plan.localitySlugs);
  const sidecarPaths = listCurrentRunLocalitySidecarPaths(SLUG, BP);

  const localityPages = plan.localitySlugs.map((slug) => eco(BP, "local", slug, "index.html"));
  const bpLinkMap = eco(BP, "_internal-link-map.json");
  const bpIndex = eco(BP, "_ecosystem-index.json");
  const bpPackage = pkg(BP);
  const transactional = [...localityPages, bpLinkMap, bpIndex, bpPackage];

  record(
    "current-run-sidecars-classified",
    isCurrentCampaignLocalitySidecarPath(bpLinkMap, SLUG, BP) &&
      isCurrentCampaignLocalitySidecarPath(bpIndex, SLUG, BP) &&
      isCurrentCampaignLocalitySidecarPath(bpPackage, SLUG, BP) &&
      sidecarPaths.includes(bpLinkMap) &&
      sidecarPaths.includes(bpIndex) &&
      sidecarPaths.includes(bpPackage) &&
      !isCurrentCampaignLocalitySidecarPath(eco(PF, "_internal-link-map.json"), SLUG, BP) &&
      !isCurrentCampaignLocalitySidecarPath(eco(FLU, "_internal-link-map.json"), SLUG, BP) &&
      !isCurrentCampaignLocalitySidecarPath(
        eco(BP, "revisions", "8c8b0712-c8d4-4a26-b95d-3095c21a5e18", "_internal-link-map.json"),
        SLUG,
        BP,
      ),
    `sidecars=${sidecarPaths.map((file) => path.basename(file)).join(",")}`,
  );

  const acceptedPages = localityPages.every((file) => listed(snapshotPaths, file) && !listed(protectedPaths, file));
  const acceptedSidecars =
    listed(snapshotPaths, bpLinkMap) &&
    listed(snapshotPaths, bpIndex) &&
    listed(snapshotPaths, bpPackage) &&
    !listed(protectedPaths, bpLinkMap) &&
    !listed(protectedPaths, bpIndex) &&
    !listed(protectedPaths, bpPackage);
  const stampedLink = assertCurrentRunLocalitySidecarContents(bpLinkMap, stampRaw(bpLinkMap), ctx);
  const stampedIndex = assertCurrentRunLocalitySidecarContents(bpIndex, stampRaw(bpIndex), ctx);
  const stampedPackage = assertCurrentRunLocalitySidecarContents(bpPackage, stampRaw(bpPackage), ctx);
  record(
    "eight-locality-transaction-accepted",
    acceptedPages &&
      acceptedSidecars &&
      localityPages.length === 8 &&
      transactional.every((file) => fs.existsSync(file)) &&
      stampedLink.ok &&
      stampedIndex.ok &&
      stampedPackage.ok,
    `pages=${localityPages.length} snapshot=${snapshotPaths.length} link=${stampedLink.ok} index=${stampedIndex.ok} package=${stampedPackage.ok}`,
  );

  record(
    "service-image-protection",
    listed(protectedPaths, vis(BP)) &&
      listed(protectedPaths, path.join(ROOT, "data/pharmacy-image-assignments", `${SLUG}.json`)) &&
      listed(protectedPaths, eco(BP, "packs", "gbp-posts.json")) &&
      listed(protectedPaths, path.join(ROOT, "data/pharmacy-approved-service-banks/banks", BP, `${BP_BANK}.json`)) &&
      !listed(protectedPaths, vis(BP)) === false,
    listed(protectedPaths, vis(BP)) &&
      listed(protectedPaths, path.join(ROOT, "data/pharmacy-image-assignments", `${SLUG}.json`))
      ? "service page, images, gbp pack, approved bank listed"
      : "missing service/image protection",
  );

  record(
    "other-service-protection",
    listed(protectedPaths, vis(PF)) &&
      listed(protectedPaths, vis(FLU)) &&
      listed(protectedPaths, vis(TRAVEL)) &&
      listed(protectedPaths, pkg(PF)) &&
      listed(protectedPaths, pkg(FLU)) &&
      listed(protectedPaths, pkg(TRAVEL)) &&
      listed(protectedPaths, eco(PF, "_internal-link-map.json")) &&
      listed(protectedPaths, eco(FLU, "_internal-link-map.json")) &&
      listed(protectedPaths, eco(TRAVEL, "_internal-link-map.json")) &&
      listed(protectedPaths, eco(PF, "_ecosystem-index.json")) &&
      listed(protectedPaths, eco(FLU, "_ecosystem-index.json")) &&
      listed(protectedPaths, eco(TRAVEL, "_ecosystem-index.json")) &&
      listed(
        protectedPaths,
        eco(BP, "revisions", "8c8b0712-c8d4-4a26-b95d-3095c21a5e18", "_internal-link-map.json"),
      ),
    "Flu/Travel/Pharmacy First sidecars, packages, service pages, and historical revisions listed",
  );

  const crossService = assertCurrentRunLocalitySidecarContents(
    eco(PF, "_internal-link-map.json"),
    stampRaw(bpLinkMap),
    ctx,
  );
  const otherServiceId = assertCurrentRunLocalitySidecarContents(
    bpLinkMap,
    stampRaw(bpLinkMap).replaceAll(`"serviceId": "${BP}"`, `"serviceId": "${PF}"`),
    ctx,
  );
  const unstored = assertCurrentRunLocalitySidecarContents(
    bpLinkMap,
    stampRaw(bpLinkMap).replaceAll('"Cudworth"', '"Leeds"').replaceAll('"cudworth"', '"leeds"'),
    ctx,
  );
  const mismatchedRun = assertCurrentRunLocalitySidecarContents(
    bpLinkMap,
    stampRaw(bpLinkMap, "00000000-0000-4000-8000-000000000000"),
    ctx,
  );
  const outsideRoot = assertReturnedCurrentRunLocalitySidecars([eco(FLU, "_internal-link-map.json")], ctx);
  record(
    "mismatched-cross-service-sidecars-fail",
    crossService.ok === false &&
      /outside the current campaign output root/.test(crossService.error || "") &&
      otherServiceId.ok === false &&
      /another serviceId/.test(otherServiceId.error || "") &&
      unstored.ok === false &&
      /unstored locality/.test(unstored.error || "") &&
      mismatchedRun.ok === false &&
      /runId does not match/.test(mismatchedRun.error || "") &&
      outsideRoot.ok === false &&
      /outside the current campaign output root/.test(outsideRoot.error || ""),
    [
      crossService.error,
      otherServiceId.error,
      unstored.error,
      mismatchedRun.error,
      outsideRoot.error,
    ].join(" | "),
  );

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rc-regen-38d-"));
  const liveDir = path.join(tmp, "live");
  const revDir = path.join(tmp, "rev");
  fs.mkdirSync(path.join(liveDir, "local", "darfield"), { recursive: true });
  fs.mkdirSync(revDir, { recursive: true });
  const originals = {
    page: "<html>thin-locality</html>",
    linkMap: '{"serviceId":"blood-pressure-checks"}',
    index: '{"serviceId":"blood-pressure-checks"}',
    packageJson: '{"serviceId":"blood-pressure-checks","currentRunInventory":null}',
    review: '{"campaigns":{"blood-pressure-checks":{"improvements":{"local-area-pages":"stamped"}}}}',
    servicePage: "<html>bp-service</html>",
    otherSidecar: '{"serviceId":"pharmacy-first"}',
  };
  const live = {
    page: path.join(liveDir, "local", "darfield", "index.html"),
    linkMap: path.join(liveDir, "_internal-link-map.json"),
    index: path.join(liveDir, "_ecosystem-index.json"),
    packageJson: path.join(liveDir, "blood-pressure-checks.json"),
    review: path.join(liveDir, "review-centre.json"),
    servicePage: path.join(liveDir, "service.html"),
    otherSidecar: path.join(liveDir, "pharmacy-first-link-map.json"),
  };
  const revision = {
    page: path.join(revDir, "local-darfield.html"),
    linkMap: path.join(revDir, "_internal-link-map.json"),
    index: path.join(revDir, "_ecosystem-index.json"),
    packageJson: path.join(revDir, "blood-pressure-checks.package.json"),
  };
  for (const [key, file] of Object.entries(live)) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, originals[key as keyof typeof originals], "utf8");
  }
  for (const [key, file] of Object.entries(revision)) {
    fs.copyFileSync(live[key as keyof typeof revision], file);
  }
  const protectedSnapshot = [
    { filePath: live.servicePage, bytes: fs.readFileSync(live.servicePage) },
    { filePath: live.otherSidecar, bytes: fs.readFileSync(live.otherSidecar) },
  ];
  const reviewBytes = fs.readFileSync(live.review);
  fs.writeFileSync(live.page, "<html>partial-locality</html>", "utf8");
  fs.writeFileSync(live.linkMap, '{"serviceId":"partial"}', "utf8");
  fs.writeFileSync(live.index, '{"serviceId":"partial"}', "utf8");
  fs.writeFileSync(live.packageJson, '{"serviceId":"partial"}', "utf8");
  fs.writeFileSync(live.review, '{"campaigns":{}}', "utf8");
  fs.writeFileSync(live.servicePage, "<html>mutated-service</html>", "utf8");
  fs.writeFileSync(live.otherSidecar, '{"serviceId":"mutated"}', "utf8");
  restoreLocalityLivePages({
    stamp: "fixture",
    files: [
      { livePath: live.page, revisionPath: revision.page },
      { livePath: live.linkMap, revisionPath: revision.linkMap },
      { livePath: live.index, revisionPath: revision.index },
      { livePath: live.packageJson, revisionPath: revision.packageJson },
    ],
  });
  for (const file of protectedSnapshot) {
    fs.mkdirSync(path.dirname(file.filePath), { recursive: true });
    fs.writeFileSync(file.filePath, file.bytes);
  }
  fs.writeFileSync(live.review, reviewBytes);
  record(
    "rollback-atomicity",
    fs.readFileSync(live.page, "utf8") === originals.page &&
      fs.readFileSync(live.linkMap, "utf8") === originals.linkMap &&
      fs.readFileSync(live.index, "utf8") === originals.index &&
      fs.readFileSync(live.packageJson, "utf8") === originals.packageJson &&
      fs.readFileSync(live.review, "utf8") === originals.review &&
      fs.readFileSync(live.servicePage, "utf8") === originals.servicePage &&
      fs.readFileSync(live.otherSidecar, "utf8") === originals.otherSidecar,
    "locality pages, sidecars, package, Review Centre, service page, and other-service sidecar restored",
  );

  const hashesAfter = new Map(FILES_TO_HASH.map((file) => [file, shaFile(file)]));
  const mutated = FILES_TO_HASH.filter((file) => hashesBefore.get(file) !== hashesAfter.get(file)).map((file) =>
    path.relative(ROOT, file),
  );
  record(
    "no-write-live-state",
    mutated.length === 0,
    mutated.length ? `mutated=${mutated.join(",")}` : "live tenant files unchanged",
  );

  const failed = checks.filter((check) => !check.pass);
  console.log(`\n${checks.filter((check) => !check.pass).length === 0 ? checks.length : checks.filter((c) => c.pass).length}/${checks.length} passed`);
  if (failed.length) process.exitCode = 1;
}

main();
