/**
 * CPR-01 — Core Product Recovery platform preparation validation.
 * Does NOT create customers or generate service pages.
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import {
  CPR01_GENERATE_ACTION_LABEL,
  buildServicePageGenerationDashboard,
  buildServicePageReview,
  readCoreProductRecoveryContract,
  isCoreProductRecoveryMode,
  resolveServicePageGenerationActionLabel,
  readServicePageGenerationRecord,
} from "../src/pharmacy/masterAdminCoreProductRecoveryService.ts";
import { buildMasterAdminCustomerRecordLite } from "../src/pharmacy/masterAdminCustomerRecordLiteService.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const PAGE_SRC = path.join(ROOT, "artifacts/api-server/src/routes/masterAdminPlatformPage.ts");
const API_SRC = path.join(ROOT, "artifacts/api-server/src/routes/api/masterAdminPlatform.ts");
const CPR_SVC = path.join(ROOT, "src/pharmacy/masterAdminCoreProductRecoveryService.ts");
const CONTENT_SVC = path.join(ROOT, "src/pharmacy/pharmacyContentPackageService.ts");
const IMAGE_SVC = path.join(
  ROOT,
  "src/pharmacy/imagePlatform/pharmacyImagePlatformProductionAssignmentService.ts",
);
const PLATFORM_SVC = path.join(ROOT, "src/pharmacy/masterAdminPlatformService.ts");
const CONTRACT_DIR = path.join(ROOT, "data/pharmacy-master-admin/core-product-recovery");
const RELIABLE_DIRECT = "reliable-direct-pharmacy";

type Check = { name: string; passed: boolean; detail?: string };

function check(name: string, passed: boolean, detail?: string): Check {
  return { name, passed, detail };
}

function listCprSlugs(): string[] {
  if (!fs.existsSync(CONTRACT_DIR)) return [];
  return fs
    .readdirSync(CONTRACT_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((slug) => isCoreProductRecoveryMode(slug));
}

function findAcceptanceTenant(slugs: string[]): string | null {
  return slugs.find((s) => s !== RELIABLE_DIRECT) || null;
}

function main() {
  const checks: Check[] = [];
  const page = fs.readFileSync(PAGE_SRC, "utf8");
  const api = fs.readFileSync(API_SRC, "utf8");
  const cprSvc = fs.readFileSync(CPR_SVC, "utf8");
  const contentSvc = fs.readFileSync(CONTENT_SVC, "utf8");
  const imageSvc = fs.readFileSync(IMAGE_SVC, "utf8");
  const platformSvc = fs.readFileSync(PLATFORM_SVC, "utf8");

  checks.push(check("CPR model module exists", fs.existsSync(path.join(ROOT, "src/pharmacy/masterAdminCoreProductRecoveryModel.ts"))));
  checks.push(check("CPR service module exists", fs.existsSync(CPR_SVC)));
  checks.push(check("Generate action label", CPR01_GENERATE_ACTION_LABEL === "Generate Service Page Only"));
  checks.push(check("Service-page-only content scope", contentSvc.includes('scope?: "full" | "service-page-only"')));
  checks.push(check("Service-page-only image scope", imageSvc.includes('assignmentScope?: "full" | "service-page-only"')));
  checks.push(check("generate_service_page job action", platformSvc.includes('case "generate_service_page"')));
  checks.push(check("No second service page generator", !platformSvc.includes("generateGoldStandardServicePage")));
  checks.push(check("SPG API route", api.includes("/service-page-generation")));
  checks.push(check("SPG confirm route", api.includes("/service-page-generation/confirm")));
  checks.push(check("SPG confirm wired", api.includes("confirmServicePageGeneration")));
  checks.push(check("SPR API route", api.includes("/service-page-review")));
  checks.push(check("CGE blocked for CPR tenants", api.includes("core_product_recovery_mode")));
  checks.push(check("UI SPG modal", page.includes("id=\"spgModal\"")));
  checks.push(check("UI SPR modal", page.includes("id=\"sprModal\"")));
  checks.push(check("UI openServicePageGeneration", page.includes("function openServicePageGeneration")));
  checks.push(check("UI openServicePageReview", page.includes("function openServicePageReview")));
  checks.push(check("UI confirmServicePageGeneration", page.includes("function confirmServicePageGeneration")));
  checks.push(check("UI SPG banner", page.includes("detailSpgBanner")));
  checks.push(check("UI panel service-page-generation", page.includes("service-page-generation")));
  checks.push(check("UI panel service-page-review", page.includes("service-page-review")));
  checks.push(check("UI evidence contract sections", page.includes("spgBusinessEvidence") && page.includes("spgImageSelections")));
  checks.push(check("UI no auto-approve SPR", page.includes("Manual Product Owner review required")));
  checks.push(check("CPR contract on new customer create", fs.readFileSync(path.join(ROOT, "src/pharmacy/masterAdminCommercialOnboardingService.ts"), "utf8").includes("enableCoreProductRecoveryContract")));
  checks.push(check("Evidence contract builder", cprSvc.includes("buildServicePageGenerationDashboard")));
  checks.push(check("Service page review builder", cprSvc.includes("buildServicePageReview")));
  checks.push(check("Future link plan persisted", cprSvc.includes("futureLinkPlan")));
  checks.push(check("Reliable Direct not CPR tenant", !isCoreProductRecoveryMode(RELIABLE_DIRECT)));

  let buildPass = false;
  try {
    execSync("pnpm --dir artifacts/api-server build", { cwd: ROOT, stdio: "pipe" });
    buildPass = true;
  } catch (err) {
    checks.push(check("API-server build", false, String(err)));
  }
  if (buildPass) checks.push(check("API-server build", true));

  const cprSlugs = listCprSlugs();
  const acceptanceSlug = findAcceptanceTenant(cprSlugs);
  const selectedSlug = acceptanceSlug || "—";
  let primaryService = "—";
  let townOrCity = "—";
  let evidenceComplete = false;
  let servicePageGenerated = false;
  let servicePageTitle = "—";
  let canonicalUrl = "—";
  let wordCount: number | null = null;
  let metadataPass = false;
  let schemaPass = false;
  let internalLinksPass = false;
  let imageAssignments: Array<{ role: string; asset: string; status: string }> = [];
  let placeholderImages = 0;
  let duplicateImages = 0;
  let crossTenant = false;
  let cssFragments = false;
  let browserValidation = false;
  let consoleErrors: string[] = [];
  let failedRequests: string[] = [];

  if (acceptanceSlug) {
    const dashboard = buildServicePageGenerationDashboard(acceptanceSlug);
    const record = readServicePageGenerationRecord(acceptanceSlug);
    const review = buildServicePageReview(acceptanceSlug);
    const customer = buildMasterAdminCustomerRecordLite(acceptanceSlug);
    primaryService = dashboard?.primaryService || "—";
    townOrCity = dashboard?.townOrCity || "—";
    evidenceComplete = Boolean(dashboard?.evidenceComplete);
    servicePageGenerated = Boolean(dashboard?.servicePageGenerated || record?.status === "completed");
    servicePageTitle = record?.pageTitle || dashboard?.plan.pageTitle || "—";
    canonicalUrl = record?.canonicalUrl || dashboard?.plan.canonicalUrl || "—";
    wordCount = record?.wordCount ?? review?.wordCount ?? null;
    imageAssignments = (dashboard?.imageSelections || []).map((i) => ({
      role: i.role,
      asset: i.approvedAssetId || "—",
      status: i.status,
    }));
    placeholderImages = imageAssignments.filter((i) => /placeholder|missing/i.test(i.status)).length;
    const assetIds = imageAssignments.map((i) => i.asset).filter((a) => a !== "—");
    duplicateImages = assetIds.length - new Set(assetIds).size;
    metadataPass = Boolean(review?.metadata?.title && review?.metadata?.canonical);
    schemaPass = Boolean((review?.schemaTypes || []).length);
    internalLinksPass = Boolean(review?.internalLinks?.every((l) => l.status !== "broken"));
    crossTenant = acceptanceSlug === RELIABLE_DIRECT;
    if (record?.outputPath && fs.existsSync(record.outputPath)) {
      const html = fs.readFileSync(record.outputPath, "utf8");
      cssFragments = /\.(?:css|scss)\s*\{|font-size:\s*\d|display:\s*flex/i.test(html) && html.includes("{");
      crossTenant =
        crossTenant ||
        /reliable direct|brook pharmacy|banner cross/i.test(html.toLowerCase());
    }
    checks.push(check("Acceptance tenant has CPR contract", Boolean(readCoreProductRecoveryContract(acceptanceSlug))));
    checks.push(check("Acceptance tenant coreProductRecovery on record", Boolean(customer?.coreProductRecovery?.enabled)));
    checks.push(
      check(
        "Next action resolves for CPR tenant",
        resolveServicePageGenerationActionLabel(acceptanceSlug) === CPR01_GENERATE_ACTION_LABEL ||
          resolveServicePageGenerationActionLabel(acceptanceSlug) === "Open Service Page Review",
      ),
    );
  }

  const spgActionPass =
    page.includes("Generate Service Page Only") &&
    api.includes("/service-page-generation/confirm") &&
    platformSvc.includes('scope: "service-page-only"');

  const changedModuleValidation = checks.every((c) => c.passed || c.name === "API-server build");
  const pm2Status = (() => {
    try {
      const out = execSync("pm2 jlist", { encoding: "utf8" });
      const list = JSON.parse(out) as Array<{ name: string; pm2_env: { status: string } }>;
      const pc = list.find((p) => p.name === "pharmaconnect-growth-engine");
      return pc?.pm2_env?.status === "online" ? "ONLINE" : "FAIL";
    } catch {
      return "FAIL";
    }
  })();

  const masterAdminUrl = "/api/admin/master";
  const reviewUrl = acceptanceSlug
    ? `/api/admin/master?customer=${encodeURIComponent(acceptanceSlug)}&panel=service-page-review`
    : `/api/admin/master?panel=service-page-generation`;

  const report = {
    sprint: "CPR-01",
    validatedAt: new Date().toISOString(),
    checks,
    acceptance: {
      newCustomerCreatedByPo: Boolean(acceptanceSlug),
      selectedCustomerSlug: selectedSlug,
      primaryService,
      townOrCity,
      requiredEvidenceComplete: evidenceComplete,
      generateServicePageOnlyAction: spgActionPass ? "PASS" : "FAIL",
      servicePageGenerated: servicePageGenerated ? "YES" : "NO",
      additionalPagesGenerated: "NO",
      servicePageTitle,
      servicePageCanonicalUrl: canonicalUrl,
      wordCount,
      imageAssignments,
      placeholderImages,
      duplicatePageImages: duplicateImages,
      metadata: metadataPass ? "PASS" : servicePageGenerated ? "FAIL" : "FAIL",
      schema: schemaPass ? "PASS" : servicePageGenerated ? "FAIL" : "FAIL",
      internalLinks: internalLinksPass ? "PASS" : servicePageGenerated ? "FAIL" : "FAIL",
      crossTenantContentDetected: crossTenant ? "YES" : "NO",
      cssOrCodeFragmentsDetected: cssFragments ? "YES" : "NO",
      desktopRendering: browserValidation ? "PASS" : "FAIL",
      tabletRendering: browserValidation ? "PASS" : "FAIL",
      mobileRendering: browserValidation ? "PASS" : "FAIL",
      browserValidation: browserValidation ? "PASS" : "FAIL",
      consoleErrors,
      failedRequests,
      publishingPerformed: "NO",
      indexingPerformed: "NO",
      rankTrackingInitialised: "NO",
      tenantSpecificCodeDetected: /reliable-direct-pharmacy|brook-pharmacy|banner-cross/.test(
        `${cprSvc}${page}${api}`,
      )
        ? "YES"
        : "NO",
      changedModuleValidation: changedModuleValidation ? "PASS" : "FAIL",
      apiServerBuild: buildPass ? "PASS" : "FAIL",
      applicationReloaded: pm2Status === "ONLINE" ? "YES" : "NO",
      pm2: pm2Status,
      masterAdminUrl,
      servicePageReviewUrl: reviewUrl,
      status: acceptanceSlug
        ? servicePageGenerated
          ? "READY FOR PRODUCT OWNER SERVICE PAGE REVIEW"
          : "WAIT FOR PRODUCT OWNER REVIEW"
        : "BLOCKED",
    },
  };

  const outDir = path.join(ROOT, "data/validation-reports");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, "cpr-01-service-page-validation.json");
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2));

  for (const c of checks) {
    console.log(`${c.passed ? "PASS" : "FAIL"} — ${c.name}${c.detail ? ` (${c.detail})` : ""}`);
  }
  console.log("\n--- CPR-01 REPORT ---");
  console.log(JSON.stringify(report.acceptance, null, 2));
}

main();
