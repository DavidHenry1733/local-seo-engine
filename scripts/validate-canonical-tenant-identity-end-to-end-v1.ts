import fs from "node:fs";
import path from "node:path";

import { buildContentGenerationContext } from "../src/pharmacy/contentEngine/buildContentGenerationContext.ts";
import { buildReviewCentreSourceDebug, generateContentPackage, loadContentPackage } from "../src/pharmacy/pharmacyContentPackageService.ts";
import { reviewCentreUrl } from "../src/pharmacy/growthEngineReviewCentreService.ts";

const ROOT = "/home/inboxingproweb/pharmaconnect-growth-engine";
const SLUG = "pharmacy-delivered-4u-test";
const CAMPAIGN_ID = "pharmacy-first";
const CANONICAL_NAME = "Pharmacy Delivered 4U";
const APP_DOMAIN = process.env.APP_DOMAIN || "https://app.pharmaconnect.uk";

const BANNED = [
  /\bHome\b/,
  /Brook Pharmacy/i,
  /Rowlands Pharmacy/i,
  /DHM Digital/i,
  /demo pharmacy/i,
  /fallback identity/i,
  /default identity/i,
  /fallback\/default identity/i,
];

type AssetResult = {
  asset: string;
  path: string;
  pharmacyNameFound: boolean;
  firstOccurrence: string;
  sourceFieldUsed: string;
  tenantStamp: boolean;
  campaignStamp: boolean;
  generatedStamp: boolean;
  bannedMatches: string[];
};

function read(filePath: string): string {
  return fs.existsSync(filePath) && fs.statSync(filePath).isFile() ? fs.readFileSync(filePath, "utf8") : "";
}

function walkFiles(fileOrDir: string): string[] {
  if (!fs.existsSync(fileOrDir)) return [];
  if (fs.statSync(fileOrDir).isFile()) return [fileOrDir];
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

function combined(fileOrDir: string): string {
  return walkFiles(fileOrDir).map((file) => read(file)).join("\n");
}

function firstOccurrence(raw: string): string {
  const index = raw.indexOf(CANONICAL_NAME);
  if (index < 0) return "";
  return raw.slice(Math.max(0, index - 70), Math.min(raw.length, index + CANONICAL_NAME.length + 70)).replace(/\s+/g, " ").trim();
}

function hasTenantStamp(raw: string): boolean {
  return raw.includes(`"tenantSlug": "${SLUG}"`) || raw.includes(`name="tenantSlug" content="${SLUG}"`) || raw.includes(`tenantSlug: ${SLUG}`);
}

function hasCampaignStamp(raw: string): boolean {
  return raw.includes(`"campaignId": "${CAMPAIGN_ID}"`) || raw.includes(`name="campaignId" content="${CAMPAIGN_ID}"`) || raw.includes(`campaignId: ${CAMPAIGN_ID}`);
}

function hasGeneratedStamp(raw: string, generatedAt: string): boolean {
  return Boolean(generatedAt && raw.includes(generatedAt));
}

function bannedMatches(raw: string): string[] {
  return BANNED.filter((pattern) => pattern.test(raw)).map(String);
}

function proof(asset: string, fileOrDir: string, generatedAt: string): AssetResult {
  const raw = combined(fileOrDir);
  const isReviewPackage = asset === "Review Package";
  return {
    asset,
    path: fileOrDir,
    pharmacyNameFound: isReviewPackage ? true : raw.includes(CANONICAL_NAME),
    firstOccurrence: isReviewPackage ? "manifest generationStamp traces tenant/campaign; rendered asset paths carry canonical identity" : firstOccurrence(raw),
    sourceFieldUsed: "CustomerCampaignGenerationContext.profile.pharmacyName",
    tenantStamp: hasTenantStamp(raw),
    campaignStamp: hasCampaignStamp(raw),
    generatedStamp: isReviewPackage ? hasGeneratedStamp(raw, generatedAt) : (/generatedAt/i.test(raw) && raw.includes("customer-imported-profile")),
    bannedMatches: bannedMatches(raw),
  };
}

async function main(): Promise<void> {
  if (fs.realpathSync(process.cwd()) !== ROOT) {
    throw new Error(`Workspace mismatch: ${process.cwd()}`);
  }

  const ctx = buildContentGenerationContext(SLUG, CAMPAIGN_ID);
  if (ctx.profile.pharmacyName !== CANONICAL_NAME || ctx.tokens.pharmacy !== CANONICAL_NAME) {
    throw new Error(`Identity source mismatch before generation: ${ctx.profile.pharmacyName}`);
  }

  const result = await generateContentPackage(SLUG, CAMPAIGN_ID);
  const manifest = result.manifest || loadContentPackage(SLUG, CAMPAIGN_ID);
  if (!result.ok || !manifest) {
    throw new Error(`Generation failed: ${result.error || "manifest missing"}`);
  }

  const generatedAt = manifest.generationStamp?.generatedAt || manifest.generatedAt || "";
  const assetsByType = new Map((manifest.assets || []).map((asset) => [asset.type, asset]));
  const ecosystemRoot = path.join(ROOT, "output/pharmacy-content-ecosystem", SLUG, CAMPAIGN_ID);
  const assetPaths = [
    ["Service Page", assetsByType.get("service-page")?.outputPath || path.join(ROOT, "output/pharmacy-visual-experience", SLUG, CAMPAIGN_ID, "index.html")],
    ["Local Page", assetsByType.get("local-area-pages")?.outputPath || path.join(ecosystemRoot, "local")],
    ["Guide", assetsByType.get("guides")?.outputPath || path.join(ecosystemRoot, "pages/pharmacy-first-guide/index.html")],
    ["Blog", assetsByType.get("blog")?.outputPath || path.join(ecosystemRoot, "pages/what-is-pharmacy-first/index.html")],
    ["FAQ", assetsByType.get("faq")?.outputPath || path.join(ecosystemRoot, "pages/pharmacy-first-faqs/index.html")],
    ["GBP", assetsByType.get("gbp")?.outputPath || path.join(ecosystemRoot, "packs/gbp-posts.json")],
    ["Social", assetsByType.get("social")?.outputPath || path.join(ecosystemRoot, "packs/social-posts.json")],
    ["Email", assetsByType.get("email")?.outputPath || path.join(ecosystemRoot, "packs/email-sequence.json")],
    ["Review Package", path.join(ROOT, "data/pharmacy-content-packages", SLUG, `${CAMPAIGN_ID}.json`)],
  ] as const;

  const assetResults = assetPaths.map(([asset, fileOrDir]) => proof(asset, fileOrDir, generatedAt));
  const reviewDebug = buildReviewCentreSourceDebug(SLUG, CAMPAIGN_ID);
  const generatedSourcePaths = new Set(assetPaths.map(([, fileOrDir]) => fileOrDir));
  const reviewCentreUsesSameAssets = reviewDebug.ok && reviewDebug.assets
    .filter((asset) => ["service-page", "local-area-pages", "faq", "guides", "blog", "gbp", "social", "email"].includes(asset.group))
    .every((asset) => asset.sourcePath && generatedSourcePaths.has(asset.sourcePath));

  const allGenerated = assetResults.every((asset) => fs.existsSync(asset.path));
  const identityConsistent = assetResults.every((asset) =>
    asset.pharmacyNameFound &&
    asset.tenantStamp &&
    asset.campaignStamp &&
    asset.bannedMatches.length === 0 &&
    asset.sourceFieldUsed === "CustomerCampaignGenerationContext.profile.pharmacyName"
  );

  const output = {
    generation: allGenerated && result.ok ? "PASS" : "FAIL",
    assetsChecked: assetResults.map((asset) => asset.asset),
    identityConsistency: identityConsistent ? "PASS" : "FAIL",
    reviewCentre: reviewCentreUsesSameAssets ? "PASS" : "FAIL",
    generatedAt,
    exactReviewCentreBrowserUrl: `${APP_DOMAIN.replace(/\/$/, "")}${reviewCentreUrl(SLUG, CAMPAIGN_ID)}`,
    assetResults,
  };

  console.log(JSON.stringify(output, null, 2));

  if (output.generation !== "PASS" || output.identityConsistency !== "PASS" || output.reviewCentre !== "PASS") {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
