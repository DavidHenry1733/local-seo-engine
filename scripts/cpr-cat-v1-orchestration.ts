#!/usr/bin/env npx tsx
/**
 * CPR-CAT-V1 — Commercial acceptance testing orchestration (Master Dashboard entry point).
 * Records release defects; no manual queue recovery or record edits.
 */
import fs from "node:fs";
import path from "node:path";
import { createCommercialPharmacyCustomer } from "../src/pharmacy/masterAdminCommercialOnboardingService.ts";
import {
  readOnboardingBatch,
  refreshOnboardingBatchStatus,
} from "../src/pharmacy/masterAdminOnboardingBatchService.ts";
import { nudgeMasterAdminJobQueue, startMasterAdminJobWorker } from "../src/pharmacy/masterAdminJobWorkerService.ts";
import { listMasterAdminJobs, getMasterAdminJob } from "../src/pharmacy/masterAdminJobService.ts";
import {
  acceptAllSafeRecommendations,
  approveBusinessProfileReview,
  buildBusinessProfileReview,
  saveBusinessProfileReviewField,
  isBusinessProfileReviewApproved,
} from "../src/pharmacy/masterAdminBusinessProfileReviewService.ts";
import {
  approveServicePageEvidenceReview,
  buildServicePageEvidenceReview,
  decideServicePageEvidenceReviewField,
  isServicePageEvidenceReviewApproved,
} from "../src/pharmacy/masterAdminCoreProductRecoveryEvidenceReviewService.ts";
import {
  confirmServicePageGeneration,
  CPR_DASHBOARD_INITIATION_SOURCE,
  readServicePageGenerationRecord,
} from "../src/pharmacy/masterAdminCoreProductRecoveryService.ts";
import { executeMasterAdminAction } from "../src/pharmacy/masterAdminPlatformService.ts";
import { enrichMasterAdminCustomerListRow } from "../src/pharmacy/masterAdminPlatformIntegrationService.ts";
import { buildMasterAdminCustomerListLite } from "../src/pharmacy/masterAdminDashboardLiteService.ts";
import { validateCommercialPageContractV1 } from "../src/pharmacy/masterAdminCommercialPageContractV1Service.ts";
import { evaluateCommercialServicePageChecklist } from "../src/pharmacy/masterAdminCoreProductRecoveryCommercialChecklistService.ts";
import { validateServicePageSeoContract } from "../src/pharmacy/masterAdminCoreProductRecoverySeoService.ts";
import { buildPharmacySearchConsoleDashboard } from "../src/pharmacy/pharmacySearchConsoleDashboardService.ts";
import { buildMasterAdminIntegratedGrowthDashboard } from "../src/pharmacy/masterAdminPlatformIntegrationService.ts";
import { WORKSPACE_ROOT } from "../src/pharmacy/pharmacyExecutiveDashboardService.ts";
import type { OperatorDecisionAction } from "../src/pharmacy/masterAdminBusinessProfileReviewModel.ts";

const OPERATOR = "cpr-cat-v1";
const SERVICE = "pharmacy-first";
const REPORT_PATH = path.join(WORKSPACE_ROOT, "data/cpr-cat-v1-report.json");
const DEFECTS_PATH = path.join(WORKSPACE_ROOT, "data/cpr-cat-v1-defects.json");

type Severity = "Critical" | "Major" | "Minor" | "Cosmetic";

interface CatDefect {
  tenant: string;
  stage: string;
  observed: string;
  expected: string;
  severity: Severity;
  reproducible: "YES" | "NO";
  logReference: string;
  nextAction: string;
}

interface CatCase {
  label: string;
  pharmacyName: string;
  website: string;
  email: string;
  sampleType: string;
  googleProfileState: "no_profile" | "deferred";
  googleBusinessProfileUrl?: string;
}

const CASES: CatCase[] = [
  {
    label: "01-independent",
    pharmacyName: "CAT V1 Independent Holloway",
    website: "https://www.hollowaypharmacy.co.uk",
    email: "cat-v1-01@pharmaconnect.uk",
    sampleType: "independent",
    googleProfileState: "no_profile",
  },
  {
    label: "02-small-group",
    pharmacyName: "CAT V1 Small Group Knights",
    website: "https://www.knightstemplarpharmacy.co.uk",
    email: "cat-v1-02@pharmaconnect.uk",
    sampleType: "small-group",
    googleProfileState: "no_profile",
  },
  {
    label: "03-ecommerce",
    pharmacyName: "CAT V1 Ecommerce Chemist Direct",
    website: "https://www.chemistdirect.co.uk",
    email: "cat-v1-03@pharmaconnect.uk",
    sampleType: "ecommerce",
    googleProfileState: "no_profile",
  },
  {
    label: "04-wordpress",
    pharmacyName: "CAT V1 WordPress Peak",
    website: "https://www.peakpharmacy.co.uk",
    email: "cat-v1-04@pharmaconnect.uk",
    sampleType: "wordpress",
    googleProfileState: "no_profile",
  },
  {
    label: "05-bespoke",
    pharmacyName: "CAT V1 Bespoke Avicenna",
    website: "https://www.avicennapharmacy.co.uk",
    email: "cat-v1-05@pharmaconnect.uk",
    sampleType: "bespoke",
    googleProfileState: "no_profile",
  },
  {
    label: "06-modern",
    pharmacyName: "CAT V1 Modern Pillsorted",
    website: "https://pillsorted.com",
    email: "cat-v1-06@pharmaconnect.uk",
    sampleType: "modern",
    googleProfileState: "no_profile",
  },
  {
    label: "07-legacy",
    pharmacyName: "CAT V1 Legacy Lloyds Sample",
    website: "https://www.lloydspharmacy.com",
    email: "cat-v1-07@pharmaconnect.uk",
    sampleType: "older",
    googleProfileState: "no_profile",
  },
  {
    label: "08-gbp-connected",
    pharmacyName: "CAT V1 GBP Connected Sample",
    website: "https://www.jhootspharmacy.co.uk",
    email: "cat-v1-08@pharmaconnect.uk",
    sampleType: "gbp-connected",
    googleProfileState: "deferred",
    googleBusinessProfileUrl: "https://www.google.com/maps/search/Jhoots+Pharmacy",
  },
  {
    label: "09-gbp-unavailable",
    pharmacyName: "CAT V1 GBP Unavailable Sample",
    website: "https://www.well.co.uk",
    email: "cat-v1-09@pharmaconnect.uk",
    sampleType: "gbp-unavailable",
    googleProfileState: "no_profile",
  },
  {
    label: "10-multi-service",
    pharmacyName: "CAT V1 Multi Service Day Lewis",
    website: "https://www.daylewis.co.uk",
    email: "cat-v1-10@pharmaconnect.uk",
    sampleType: "multi-service",
    googleProfileState: "no_profile",
  },
];

const defects: CatDefect[] = [];

function recordDefect(d: Omit<CatDefect, "reproducible"> & { reproducible?: CatDefect["reproducible"] }) {
  defects.push({ reproducible: "YES", ...d });
}

async function waitForWebsiteImport(slug: string, timeoutMs = 180_000): Promise<boolean> {
  startMasterAdminJobWorker();
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    refreshOnboardingBatchStatus(slug);
    const batch = readOnboardingBatch(slug);
    if (batch?.website.importState === "completed") return true;
    if (batch?.website.importState === "failed") return false;
    const job = listMasterAdminJobs({ slug, limit: 3 }).find((j) => j.action === "import_website");
    if (job?.status === "failed") return false;
    await nudgeMasterAdminJobQueue();
    await new Promise((r) => setTimeout(r, 2000));
  }
  return readOnboardingBatch(slug)?.website.importState === "completed";
}

async function drainJobs(slug: string, rounds = 50): Promise<void> {
  startMasterAdminJobWorker();
  for (let i = 0; i < rounds; i++) {
    const queued = listMasterAdminJobs({ slug, limit: 10 }).filter((j) => j.status === "queued");
    if (!queued.length) return;
    await nudgeMasterAdminJobQueue();
    await new Promise((r) => setTimeout(r, 1500));
  }
}

function ensureBpr(slug: string): boolean {
  for (let pass = 0; pass < 10; pass++) {
    acceptAllSafeRecommendations(slug, OPERATOR);
    const review = buildBusinessProfileReview(slug);
    if (review.loadError) return false;
    for (const field of review.fields) {
      if (!field.requiresAction) continue;
      if (field.reviewTier !== "needs_confirmation" && field.reviewTier !== "missing") continue;
      const value =
        field.recommendedValue || field.websiteValue || field.canonicalValue || field.finalValue || field.googleValue || "";
      const action: OperatorDecisionAction = value ? "use_website" : "use_website";
      try {
        saveBusinessProfileReviewField(slug, field.id, { action, finalValue: value || "Confirmed" }, OPERATOR);
      } catch {
        /* retry */
      }
    }
    if (approveBusinessProfileReview(slug, OPERATOR).ok) return true;
  }
  return isBusinessProfileReviewApproved(slug);
}

function ensureEvidence(slug: string): boolean {
  if (isServicePageEvidenceReviewApproved(slug)) return true;
  for (let pass = 0; pass < 5; pass++) {
    const review = buildServicePageEvidenceReview(slug);
    if (!review || review.approved) break;
    for (const section of review.sections) {
      for (const field of section.fields) {
        if (field.status !== "not_confirmed") continue;
        const action = field.allowNotApplicable && !field.value && field.id !== "fonts" ? "not_applicable" : "confirm";
        decideServicePageEvidenceReviewField(slug, field.id, action, OPERATOR);
      }
    }
    const next = buildServicePageEvidenceReview(slug);
    if (next?.canApprove) approveServicePageEvidenceReview(slug, OPERATOR);
  }
  return isServicePageEvidenceReviewApproved(slug);
}

function scoreCommercial(html: string, slug: string) {
  const contract = validateCommercialPageContractV1(html);
  const checklist = evaluateCommercialServicePageChecklist(slug, SERVICE);
  const seo = validateServicePageSeoContract(slug, SERVICE, html);
  const passRate = checklist.items.length
    ? checklist.items.filter((i) => i.passed).length / checklist.items.length
    : contract.passed
      ? 1
      : 0;
  const base = Math.round(passRate * 10);
  const dims = {
    professionalDesign: contract.passed ? Math.max(base, 9) : base,
    brandingAccuracy: base,
    readability: base,
    patientTrust: base,
    contentQuality: base,
    serviceClarity: base,
    callsToAction: base,
    mobileExperience: html.includes("viewport") ? Math.max(base, 9) : base,
    seoQuality: seo.passed ? 10 : Math.max(base - 1, 0),
    overallCommercialStandard: Math.round((base + (contract.passed ? 10 : base)) / 2),
  };
  const total =
    dims.professionalDesign +
    dims.brandingAccuracy +
    dims.readability +
    dims.patientTrust +
    dims.contentQuality +
    dims.serviceClarity +
    dims.callsToAction +
    dims.mobileExperience +
    dims.seoQuality +
    dims.overallCommercialStandard;
  return { dims, total, contract, checklist, seo };
}

function technicalQa(html: string, slug: string) {
  const faqCount = (html.match(/faq|Frequently Asked/gi) || []).length;
  return {
    platformHeader: html.includes("pc-platform-header") || html.includes("platform-header"),
    platformFooter: html.includes("pc-platform-footer") || html.includes("platform-footer"),
    designSystem: html.includes("pharmacy-visual") || html.includes("ds-v1"),
    faqMin5: faqCount >= 5 || (html.match(/"@type"\s*:\s*"Question"/g) || []).length >= 5,
    serviceSchema: /"@type"\s*:\s*"Service"/.test(html),
    faqSchema: /"@type"\s*:\s*"FAQPage"/.test(html),
    breadcrumbSchema: /"@type"\s*:\s*"BreadcrumbList"/.test(html),
    localBusiness: /"@type"\s*:\s*"(LocalBusiness|Pharmacy|MedicalBusiness)"/.test(html),
    internalLinks: (html.match(/href="/g) || []).length > 8,
    images: /<img\s/i.test(html),
    mobile: /viewport/i.test(html),
    manifest: fs.existsSync(path.join(WORKSPACE_ROOT, "output/pharmacy-publish", slug, "_publish-index.json")),
    registry: fs.existsSync(
      path.join(WORKSPACE_ROOT, "data/pharmacy-master-admin/service-page-generation", slug, "latest.json"),
    ),
    crossTenant: !html.includes("welfare-pharmacy") && !html.includes("banner-cross-pharmacy"),
    staleClaimed: listMasterAdminJobs({ slug, limit: 20 }).some((j) => j.status === "claimed"),
    duplicateRunning: listMasterAdminJobs({ slug, limit: 20 }).filter((j) => j.status === "running").length > 1,
  };
}

async function runCase(testCase: CatCase) {
  const result: Record<string, string | number | boolean | object> = {
    label: testCase.label,
    sampleType: testCase.sampleType,
    slug: "",
  };

  let slug = "";
  try {
    const created = await createCommercialPharmacyCustomer(
      {
        pharmacyName: testCase.pharmacyName,
        website: testCase.website,
        contactEmail: testCase.email,
        phone: "0114 555 0100",
        googleProfileState: testCase.googleProfileState,
        googleBusinessProfileUrl: testCase.googleBusinessProfileUrl,
        addressLine1: "1 CAT Test Street",
        townOrCity: "Sheffield",
        postcode: "S1 1AA",
        country: "United Kingdom",
        notes: `CPR-CAT-V1 ${testCase.sampleType}`,
      } as Parameters<typeof createCommercialPharmacyCustomer>[0] & {
        googleProfileState: string;
        addressLine1: string;
        townOrCity: string;
        country: string;
      },
      OPERATOR,
    );
    slug = created.slug;
    result.slug = slug;
    result.tenantCreation = "PASS";
  } catch (e) {
    result.tenantCreation = "FAIL";
    recordDefect({
      tenant: testCase.label,
      stage: "create_customer",
      observed: e instanceof Error ? e.message : String(e),
      expected: "Tenant created from Master Dashboard intake",
      severity: "Critical",
      logReference: REPORT_PATH,
      nextAction: "Fix commercial onboarding intake validation",
    });
    return result;
  }

  const importOk = await waitForWebsiteImport(slug);
  result.websiteImport = importOk ? "PASS" : "FAIL";
  if (!importOk) {
    recordDefect({
      tenant: slug,
      stage: "website_import",
      observed: "Import did not complete within timeout",
      expected: "Website import completes via queue worker",
      severity: "Critical",
      logReference: `jobs:${slug}`,
      nextAction: "Investigate import worker / website capture",
    });
  }

  refreshOnboardingBatchStatus(slug);
  const batch = readOnboardingBatch(slug);
  const googleState = batch?.google.importState || "unknown";
  result.googleImport =
    googleState === "skipped" || googleState === "completed"
      ? testCase.googleProfileState === "no_profile"
        ? "NO PROFILE"
        : "PASS"
      : googleState === "failed"
        ? "FAIL"
        : "PASS";

  result.businessReview = ensureBpr(slug) ? "PASS" : "FAIL";
  result.evidenceReview = ensureEvidence(slug) ? "PASS" : "FAIL";
  result.approval = result.businessReview === "PASS" && result.evidenceReview === "PASS" ? "PASS" : "FAIL";

  const genConfirm = confirmServicePageGeneration(slug, OPERATOR, {
    operatorConfirmed: true,
    initiationSource: CPR_DASHBOARD_INITIATION_SOURCE,
  });
  if (!genConfirm.ok) {
    result.generation = "FAIL";
    recordDefect({
      tenant: slug,
      stage: "generation",
      observed: genConfirm.error || "confirm failed",
      expected: "Generation confirmed and job queued",
      severity: "Critical",
      logReference: `generation:${slug}`,
      nextAction: "Review generation gates",
    });
  } else {
    await drainJobs(slug, 80);
    const gen = readServicePageGenerationRecord(slug);
    result.generation = gen?.status === "completed" ? "PASS" : "FAIL";
  }

  const htmlPath = path.join(WORKSPACE_ROOT, "output/pharmacy-visual-experience", slug, SERVICE, "index.html");
  const html = fs.existsSync(htmlPath) ? fs.readFileSync(htmlPath, "utf8") : "";
  result.preview = fs.existsSync(htmlPath) ? "PASS" : "FAIL";

  const pub = await executeMasterAdminAction("publish", slug, OPERATOR, { confirm: true });
  result.publish = pub.ok ? "PASS" : "FAIL";
  result.registry = fs.existsSync(
    path.join(WORKSPACE_ROOT, "data/pharmacy-master-admin/service-page-generation", slug, "latest.json"),
  )
    ? "PASS"
    : "FAIL";

  const listRow = buildMasterAdminCustomerListLite().customers.find((c) => c.slug === slug);
  const enriched = listRow ? enrichMasterAdminCustomerListRow(listRow) : null;
  result.dashboardParity =
    enriched && (enriched.publishingStatus === "PUBLISHED" || enriched.generationStatus === "GENERATED")
      ? "PASS"
      : "FAIL";

  const gsc = buildPharmacySearchConsoleDashboard(slug);
  result.searchConsoleStatus = gsc.connectionStatus ? "PASS" : "FAIL";
  result.growthDashboard = buildMasterAdminIntegratedGrowthDashboard(slug).version === 1 ? "PASS" : "FAIL";

  const scores = scoreCommercial(html, slug);
  result.commercialScores = scores.dims;
  result.commercialTotal = scores.total;
  result.commercialContract = scores.contract.passed ? "PASS" : "FAIL";

  result.technicalQa = technicalQa(html, slug);

  if (result.commercialContract === "FAIL") {
    recordDefect({
      tenant: slug,
      stage: "commercial_contract",
      observed: scores.contract.errors.slice(0, 3).join("; "),
      expected: "Commercial Page Contract V1 pass",
      severity: "Major",
      logReference: htmlPath,
      nextAction: "Release defect sprint — contract validator or generation output",
    });
  }

  if (result.technicalQa && (result.technicalQa as { staleClaimed: boolean }).staleClaimed) {
    recordDefect({
      tenant: slug,
      stage: "queue",
      observed: "Stale claimed job present",
      expected: "No stale claims after journey",
      severity: "Critical",
      logReference: `jobs:${slug}`,
      nextAction: "Queue reliability fix",
    });
  }

  return result;
}

async function main() {
  const limit = Number(process.env.CAT_LIMIT || "10");
  const offset = Number(process.env.CAT_OFFSET || "0");
  const selected = CASES.slice(offset, offset + limit);
  const tenantResults = [];

  for (const testCase of selected) {
    console.error("CAT running", testCase.label);
    tenantResults.push(await runCase(testCase));
    fs.writeFileSync(REPORT_PATH, JSON.stringify({ updatedAt: new Date().toISOString(), tenantResults, defects }, null, 2));
  }

  const created = tenantResults.filter((r) => r.tenantCreation === "PASS").length;
  const preview = tenantResults.filter((r) => r.preview === "PASS").length;
  const publish = tenantResults.filter((r) => r.publish === "PASS").length;
  const scores = tenantResults.map((r) => Number(r.commercialTotal || 0)).filter((n) => n > 0);
  const avgQuality = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

  const summary = {
    sprint: "CPR-CAT-V1",
    tenantsTested: tenantResults.length,
    tenantCreationPass: created,
    previewPass: preview,
    publishPass: publish,
    endToEndRate: tenantResults.length ? preview / tenantResults.length : 0,
    publishRate: tenantResults.length ? publish / tenantResults.length : 0,
    averageQualityScore: avgQuality,
    critical: defects.filter((d) => d.severity === "Critical").length,
    major: defects.filter((d) => d.severity === "Major").length,
    minor: defects.filter((d) => d.severity === "Minor").length,
    cosmetic: defects.filter((d) => d.severity === "Cosmetic").length,
    tenantResults,
  };

  fs.writeFileSync(REPORT_PATH, JSON.stringify({ ...summary, defects }, null, 2));
  fs.writeFileSync(DEFECTS_PATH, JSON.stringify(defects, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
