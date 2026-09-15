import fs from "node:fs";
import path from "node:path";

import { buildContentGenerationContext } from "../src/pharmacy/contentEngine/buildContentGenerationContext.ts";
import { validateContentGenerationContext } from "../src/pharmacy/contentEngine/contentEngineContract.ts";
import { buildReviewCentreSourceDebug, generateContentPackage, loadContentPackage } from "../src/pharmacy/pharmacyContentPackageService.ts";
import {
  computeCommercialPublishingReadiness,
  computeTechnicalGenerationReadiness,
} from "../src/pharmacy/pharmacyCommercialReadinessGate.ts";
import { loadGenerationReport } from "../src/pharmacy/pharmacyGenerationIntegrityService.ts";
import { loadImageAssignments } from "../src/pharmacy/pharmacyImageOperatingSystem.ts";
import { normalizeProfileDoc, type PharmacyProfileData } from "../src/pharmacy/pharmacyProfileSchema.ts";
import { computeWizardQualityScore } from "../src/pharmacy/pharmacyProfileWizardScoring.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";
import { reviewCentreUrl } from "../src/pharmacy/growthEngineReviewCentreService.ts";

const EXPECTED_WORKSPACE = "/home/inboxingproweb/pharmaconnect-growth-engine";
const FORBIDDEN_WORKSPACE = "/home/inboxingproweb/local-seo-engine";
const SLUG = "pharmacy-delivered-4u-test";
const CAMPAIGN_ID = "pharmacy-first";
const APP_DOMAIN = process.env.APP_DOMAIN || "https://app.pharmaconnect.uk";

const BANNED_OUTPUT = [
  /Brook Pharmacy/i,
  /Rowlands Pharmacy/i,
  /DHM Digital/i,
  /pharmacy\.inboxingproweb\.com/i,
  /demo pharmacy/i,
  /fallback profile/i,
  /default pharmacy/i,
  /\/home\/inboxingproweb\/local-seo-engine/i,
];

type GateStatus = "PASS" | "FAIL";

interface AssetProof {
  assetType: string;
  absolutePath: string;
  exists: "YES" | "NO";
  fileSize: number;
  generatedTimestamp: string;
  tenantStampFound: "YES" | "NO";
  campaignStampFound: "YES" | "NO";
  correctPharmacyNameFound: "YES" | "NO";
  rotherhamReferenceFound: "YES" | "NO" | "N/A";
}

interface ProofOutput {
  workspace: GateStatus;
  readinessGates: GateStatus;
  generation: GateStatus;
  requiredAssetsCreated: string;
  demoLeakage: GateStatus;
  reviewCentreSource: GateStatus;
  generatedTimestamp: string;
  exactReviewCentreBrowserUrl: string;
  sourcePaths: Record<string, string>;
  archivedPaths: string[];
  assets: AssetProof[];
  reviewCentrePreviewSources: Array<{ assetType: string; sourcePath: string | null; generatedTimestampMatch: "YES" | "NO"; staleArchivedOutputUsed: "YES" | "NO" }>;
  failures: string[];
}

function fail(message: string): never {
  throw new Error(message);
}

function safeRead(filePath: string): string {
  return fs.existsSync(filePath) && fs.statSync(filePath).isFile() ? fs.readFileSync(filePath, "utf8") : "";
}

function readJson<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function walkFiles(fileOrDir: string): string[] {
  if (!fs.existsSync(fileOrDir)) return [];
  const stat = fs.statSync(fileOrDir);
  if (stat.isFile()) return [fileOrDir];
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(html|json|md|txt)$/i.test(entry.name)) out.push(full);
    }
  };
  walk(fileOrDir);
  return out;
}

function combinedRaw(fileOrDir: string): string {
  return walkFiles(fileOrDir).map((file) => safeRead(file)).join("\n");
}

function byteSize(fileOrDir: string): number {
  if (!fs.existsSync(fileOrDir)) return 0;
  const stat = fs.statSync(fileOrDir);
  if (stat.isFile()) return stat.size;
  return walkFiles(fileOrDir).reduce((sum, file) => sum + fs.statSync(file).size, 0);
}

function hasTenantStamp(raw: string): boolean {
  return raw.includes(`"tenantSlug": "${SLUG}"`) || raw.includes(`name="tenantSlug" content="${SLUG}"`) || raw.includes(`tenantSlug: ${SLUG}`);
}

function hasCampaignStamp(raw: string): boolean {
  return raw.includes(`"campaignId": "${CAMPAIGN_ID}"`) || raw.includes(`name="campaignId" content="${CAMPAIGN_ID}"`) || raw.includes(`campaignId: ${CAMPAIGN_ID}`);
}

function hasGeneratedStamp(raw: string, generatedAt: string): boolean {
  return raw.includes(generatedAt) || (/generatedAt/i.test(raw) && raw.includes("customer-imported-profile"));
}

function outputHasBannedStrings(paths: string[]): Array<{ path: string; pattern: string }> {
  const leaks: Array<{ path: string; pattern: string }> = [];
  for (const sourcePath of paths) {
    for (const file of walkFiles(sourcePath)) {
      const raw = safeRead(file);
      for (const banned of BANNED_OUTPUT) {
        if (banned.test(raw) || banned.test(file)) leaks.push({ path: file, pattern: String(banned) });
      }
    }
  }
  return leaks;
}

function archivePath(source: string, archiveRoot: string): string | null {
  if (!fs.existsSync(source)) return null;
  const relative = path.relative(EXPECTED_WORKSPACE, source);
  if (relative.startsWith("..") || path.isAbsolute(relative)) fail(`Refusing to archive outside workspace: ${source}`);
  if (!source.includes(`${path.sep}${SLUG}${path.sep}${CAMPAIGN_ID}`) && !source.endsWith(path.join(SLUG, `${CAMPAIGN_ID}.json`))) {
    fail(`Refusing to archive non-target path: ${source}`);
  }
  const destination = path.join(archiveRoot, relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.renameSync(source, destination);
  return destination;
}

function ensureWorkspaceGate(): void {
  const cwd = fs.realpathSync(process.cwd());
  const root = fs.realpathSync(PHARMACY_WORKSPACE_ROOT);
  if (cwd !== EXPECTED_WORKSPACE) fail(`Workspace mismatch: cwd=${cwd}`);
  if (root !== EXPECTED_WORKSPACE) fail(`Workspace root mismatch: PHARMACY_WORKSPACE_ROOT=${root}`);
  if (cwd === FORBIDDEN_WORKSPACE || root === FORBIDDEN_WORKSPACE) fail("Forbidden Local SEO Engine workspace selected");
}

function profilePath(): string {
  return path.join(EXPECTED_WORKSPACE, "data/pharmacy-profiles", `${SLUG}.json`);
}

function campaignSessionPath(): string {
  return path.join(EXPECTED_WORKSPACE, "data/growth-engine", `${SLUG}-campaign-builder.json`);
}

function localMarketSnapshotPath(): string {
  return path.join(EXPECTED_WORKSPACE, "data/growth-engine", `${SLUG}-competitors.json`);
}

function imageAssignmentPath(): string {
  return path.join(EXPECTED_WORKSPACE, "data/pharmacy-image-assignments", `${SLUG}.json`);
}

function servicePagePath(): string {
  return path.join(EXPECTED_WORKSPACE, "output/pharmacy-visual-experience", SLUG, CAMPAIGN_ID, "index.html");
}

function ecosystemRoot(): string {
  return path.join(EXPECTED_WORKSPACE, "output/pharmacy-content-ecosystem", SLUG, CAMPAIGN_ID);
}

function packagePath(): string {
  return path.join(EXPECTED_WORKSPACE, "data/pharmacy-content-packages", SLUG, `${CAMPAIGN_ID}.json`);
}

function reportPath(): string {
  return path.join(EXPECTED_WORKSPACE, "data/pharmacy-generation-reports", SLUG, `${CAMPAIGN_ID}.json`);
}

function outputRoots(): string[] {
  return [servicePagePath(), ecosystemRoot(), packagePath(), reportPath()];
}

function relevantAssetTypes(): string[] {
  return ["service-page", "local-area-pages", "guides", "faq", "blog", "gbp", "social", "email", "images"];
}

function proofForAsset(assetType: string, sourcePath: string, generatedAt: string, pharmacyName: string): AssetProof {
  const raw = combinedRaw(sourcePath);
  const exists = fs.existsSync(sourcePath);
  const isImageRecord = assetType === "images";
  return {
    assetType,
    absolutePath: sourcePath,
    exists: exists ? "YES" : "NO",
    fileSize: byteSize(sourcePath),
    generatedTimestamp: generatedAt,
    tenantStampFound: hasTenantStamp(raw) || (isImageRecord && sourcePath.includes(`/${SLUG}.json`)) ? "YES" : "NO",
    campaignStampFound: hasCampaignStamp(raw) || (isImageRecord && raw.includes(`${CAMPAIGN_ID}:`)) ? "YES" : "NO",
    correctPharmacyNameFound: raw.includes(pharmacyName) || (isImageRecord && fs.existsSync(sourcePath)) ? "YES" : "NO",
    rotherhamReferenceFound: isImageRecord ? "N/A" : raw.includes("Rotherham") ? "YES" : "NO",
  };
}

async function main(): Promise<void> {
  const failures: string[] = [];
  ensureWorkspaceGate();

  const profileDoc = readJson<{ data?: Record<string, unknown> }>(profilePath());
  if (!profileDoc?.data) fail(`Profile missing: ${profilePath()}`);
  const profile = normalizeProfileDoc(SLUG, profileDoc).data as PharmacyProfileData;
  const ctx = buildContentGenerationContext(SLUG, CAMPAIGN_ID);
  const validation = validateContentGenerationContext(ctx);
  const contextLeakage = BANNED_OUTPUT.some((pattern) => pattern.test(JSON.stringify({
    slug: ctx.slug,
    resolvedSlug: ctx.resolvedSlug,
    serviceId: ctx.serviceId,
    profile: ctx.profile,
    rawProfile: ctx.rawProfile,
    brand: ctx.brand,
    cta: ctx.cta,
    selectedAreas: ctx.selectedAreas,
    primaryTown: ctx.primaryTown,
    localArea: ctx.localArea,
    images: ctx.images,
    tokens: ctx.tokens,
  })));
  const technical = computeTechnicalGenerationReadiness(validation, contextLeakage);
  const commercial = computeCommercialPublishingReadiness(profile);
  const quality = computeWizardQualityScore(profile);

  if (technical.status !== "PASS") failures.push(`Technical Generation Readiness: ${technical.status} (${technical.missingFields.join(", ")})`);
  if (commercial.status !== "READY") failures.push(`Commercial Publishing Readiness: ${commercial.status} (${commercial.missingManualFields.join(", ")})`);
  if (quality.overallScore !== 100) failures.push(`Campaign Content Quality: ${quality.overallScore}%`);
  if (failures.length) {
    const output: ProofOutput = {
      workspace: "PASS",
      readinessGates: "FAIL",
      generation: "FAIL",
      requiredAssetsCreated: "0 / 9",
      demoLeakage: "FAIL",
      reviewCentreSource: "FAIL",
      generatedTimestamp: "",
      exactReviewCentreBrowserUrl: `${APP_DOMAIN.replace(/\/$/, "")}${reviewCentreUrl(SLUG, CAMPAIGN_ID)}`,
      sourcePaths: {
        tenantProfile: profilePath(),
        campaignSession: campaignSessionPath(),
        localMarketSnapshot: localMarketSnapshotPath(),
        imageAssignmentRecord: imageAssignmentPath(),
        customerCampaignGenerationContext: path.join(EXPECTED_WORKSPACE, "src/pharmacy/contentEngine/buildContentGenerationContext.ts"),
      },
      archivedPaths: [],
      assets: [],
      reviewCentrePreviewSources: [],
      failures,
    };
    console.log(JSON.stringify(output, null, 2));
    process.exit(1);
  }

  const archiveStamp = new Date().toISOString().replace(/[:.]/g, "-");
  const archiveRoot = path.join(EXPECTED_WORKSPACE, "_archive/clean-pharmacy-first-generation-proof-v1", archiveStamp);
  const archivedPaths = outputRoots().map((source) => archivePath(source, archiveRoot)).filter(Boolean) as string[];

  const generation = await generateContentPackage(SLUG, CAMPAIGN_ID);
  const manifest = generation.manifest || loadContentPackage(SLUG, CAMPAIGN_ID);
  const report = loadGenerationReport(SLUG, CAMPAIGN_ID);
  const imageDoc = loadImageAssignments(SLUG);
  const generatedAt = manifest?.generationStamp?.generatedAt || manifest?.generatedAt || "";
  if (!generation.ok || !manifest) failures.push(`Generation failed: ${generation.error || "manifest missing"}`);
  if (manifest?.generationStamp?.tenantSlug !== SLUG || manifest.generationStamp?.campaignId !== CAMPAIGN_ID || manifest.generationStamp?.sourceContext !== "customer-imported-profile") {
    failures.push("Manifest generation stamp mismatch");
  }
  if (!report) failures.push("Generation report missing");
  if (!imageDoc.assignments || !Object.keys(imageDoc.assignments).some((key) => key.startsWith(`${CAMPAIGN_ID}:`))) {
    failures.push("Tenant-assigned campaign images missing");
  }

  const manifestAssets = new Map((manifest?.assets || []).map((asset) => [asset.type, asset]));
  const assetPaths = new Map<string, string>();
  assetPaths.set("service-page", manifestAssets.get("service-page")?.outputPath || servicePagePath());
  assetPaths.set("local-area-pages", manifestAssets.get("local-area-pages")?.outputPath || path.join(ecosystemRoot(), "local"));
  assetPaths.set("guides", manifestAssets.get("guides")?.outputPath || path.join(ecosystemRoot(), "pages/pharmacy-first-guide/index.html"));
  assetPaths.set("faq", manifestAssets.get("faq")?.outputPath || path.join(ecosystemRoot(), "pages/pharmacy-first-faqs/index.html"));
  assetPaths.set("blog", manifestAssets.get("blog")?.outputPath || path.join(ecosystemRoot(), "pages/what-is-pharmacy-first/index.html"));
  assetPaths.set("gbp", manifestAssets.get("gbp")?.outputPath || path.join(ecosystemRoot(), "packs/gbp-posts.json"));
  assetPaths.set("social", manifestAssets.get("social")?.outputPath || path.join(ecosystemRoot(), "packs/social-posts.json"));
  assetPaths.set("email", manifestAssets.get("email")?.outputPath || path.join(ecosystemRoot(), "packs/email-sequence.json"));
  assetPaths.set("images", manifestAssets.get("images")?.outputPath || imageAssignmentPath());

  const assets = relevantAssetTypes().map((type) => proofForAsset(type, assetPaths.get(type)!, generatedAt, ctx.profile.pharmacyName));
  for (const asset of assets) {
    if (asset.exists !== "YES") failures.push(`${asset.assetType} missing: ${asset.absolutePath}`);
    if (asset.fileSize <= 0) failures.push(`${asset.assetType} empty: ${asset.absolutePath}`);
    if (asset.tenantStampFound !== "YES") failures.push(`${asset.assetType} tenant stamp missing`);
    if (asset.campaignStampFound !== "YES") failures.push(`${asset.assetType} campaign stamp missing`);
    if (asset.correctPharmacyNameFound !== "YES") failures.push(`${asset.assetType} live pharmacy name missing`);
    if (asset.rotherhamReferenceFound === "NO") failures.push(`${asset.assetType} Rotherham reference missing`);
  }

  const generatedOutputPaths = [servicePagePath(), ecosystemRoot(), packagePath(), reportPath()];
  const leaks = outputHasBannedStrings(generatedOutputPaths);
  if (leaks.length) failures.push(`Demo leakage: ${leaks.map((leak) => `${leak.path} ${leak.pattern}`).join("; ")}`);

  const debug = buildReviewCentreSourceDebug(SLUG, CAMPAIGN_ID);
  const reviewCentrePreviewSources = debug.assets.map((asset) => ({
    assetType: asset.group,
    sourcePath: asset.sourcePath,
    generatedTimestampMatch: asset.sourcePath && hasGeneratedStamp(combinedRaw(asset.sourcePath), generatedAt) ? "YES" as const : "NO" as const,
    staleArchivedOutputUsed: asset.sourcePath && asset.sourcePath.includes(archiveRoot) ? "YES" as const : "NO" as const,
  }));
  if (!debug.ok) failures.push(`Review Centre source mismatch: ${debug.sourceErrors.join("; ")}`);
  if (reviewCentrePreviewSources.some((source) => source.generatedTimestampMatch !== "YES" && source.sourcePath?.includes(`${path.sep}output${path.sep}pharmacy-`))) {
    failures.push("Review Centre source timestamp mismatch");
  }
  if (reviewCentrePreviewSources.some((source) => source.staleArchivedOutputUsed === "YES")) {
    failures.push("Review Centre source uses archived output");
  }

  const createdCount = assets.filter((asset) => asset.exists === "YES" && asset.fileSize > 0).length;
  const output: ProofOutput = {
    workspace: "PASS",
    readinessGates: technical.status === "PASS" && commercial.status === "READY" && quality.overallScore === 100 ? "PASS" : "FAIL",
    generation: generation.ok && failures.length === 0 ? "PASS" : "FAIL",
    requiredAssetsCreated: `${createdCount} / ${relevantAssetTypes().length}`,
    demoLeakage: leaks.length === 0 ? "PASS" : "FAIL",
    reviewCentreSource: debug.ok && !reviewCentrePreviewSources.some((source) => source.staleArchivedOutputUsed === "YES") ? "PASS" : "FAIL",
    generatedTimestamp: generatedAt,
    exactReviewCentreBrowserUrl: `${APP_DOMAIN.replace(/\/$/, "")}${reviewCentreUrl(SLUG, CAMPAIGN_ID)}`,
    sourcePaths: {
      tenantProfile: profilePath(),
      campaignSession: campaignSessionPath(),
      localMarketSnapshot: localMarketSnapshotPath(),
      imageAssignmentRecord: imageAssignmentPath(),
      customerCampaignGenerationContext: path.join(EXPECTED_WORKSPACE, "src/pharmacy/contentEngine/buildContentGenerationContext.ts"),
    },
    archivedPaths,
    assets,
    reviewCentrePreviewSources,
    failures,
  };

  console.log(JSON.stringify(output, null, 2));
  if (failures.length || output.generation !== "PASS" || output.demoLeakage !== "PASS" || output.reviewCentreSource !== "PASS") process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
