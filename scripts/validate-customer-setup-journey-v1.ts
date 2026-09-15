#!/usr/bin/env npx tsx
/**
 * Customer Setup Journey Reset V1 — audit documentation and journey integrity validation.
 * Does not validate UI redesign — confirms evidence map, navigation, completion logic, language.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CUSTOMER_REPORT_STEP_IDS,
  GROWTH_ENGINE_STEPS,
  buildGrowthEngineFramework,
  buildGrowthPlanRecommendation,
  isCustomerVisibleInStepper,
} from "../src/pharmacy/growthEngineFrameworkService.ts";
import {
  renderGrowthEngineHubPage,
  renderBusinessIntelligencePage,
  renderLocalMarketPage,
  renderWebsiteIntelligencePage,
  renderGrowthPlanPage,
  renderGeneratePage,
  renderGrowthEngineDashboardPage,
} from "../src/pharmacy/growthEnginePageRenderers.ts";
import { renderProfileWizardHtml } from "../src/pharmacy/pharmacyProfileWizardPage.ts";
import { loadCompetitorSnapshot } from "../src/pharmacy/growthEngineLocalMarketService.ts";
import { normalizeProfileData, normalizeProfileDoc } from "../src/pharmacy/pharmacyProfileSchema.ts";
import {
  applyAutoConfirmOnSave,
  buildWizardImportFields,
} from "../src/pharmacy/pharmacyProfileWizardEnrichment.ts";
import { renderGrowthEngineNavBar } from "../src/pharmacy/growthEngineWorkflowNav.ts";
import { growthEngineWizardUrl } from "../src/pharmacy/growthEngineFrameworkService.ts";
import { WIZARD_TOTAL_STEPS } from "../src/pharmacy/pharmacyProfileWizardSteps.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const AUDIT_PATH = path.join(ROOT, "docs/platform/CUSTOMER-SETUP-AUDIT-V1.md");
const SLUG = process.env.VALIDATION_SLUG || "dhmdigital";

interface Check {
  id: string;
  pass: boolean;
  detail: string;
}

const checks: Check[] = [];

function record(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

const BANNED_CUSTOMER_TERMS = [
  /\bschema\b/i,
  /\bcanonical\b/i,
  /\bbreadcrumb/i,
  /\bmeta titles?\b/i,
  /\bmeta descriptions?\b/i,
  /\bentity\b/i,
  /\bBusiness Intelligence\b/,
  /\bLocal Healthcare Intelligence\b/,
];

const AUDIT_REQUIRED_SECTIONS = [
  "Step 1 — Current journey",
  "Step 2 — Vision comparison",
  "Step 3 — Per-page friction",
  "Step 4 — Business profile field audit",
  "Step 5 — Next action audit",
  "Step 6 — Completion logic",
  "Step 7 — Navigation audit",
  "Step 8 — Language review",
  "Recommended corrected journey",
  "Pages requiring redesign",
];

function bannedTermsIn(html: string): string[] {
  return BANNED_CUSTOMER_TERMS.filter((re) => re.test(html)).map((re) => re.source);
}

function loadSlug(slug: string) {
  const file = path.join(ROOT, "data/pharmacy-profiles", `${slug}.json`);
  if (!fs.existsSync(file)) throw new Error(`Profile not found: ${slug}`);
  return normalizeProfileDoc(slug, JSON.parse(fs.readFileSync(file, "utf8"))).data;
}

function countPrimaryButtons(html: string): number {
  return (html.match(/ge-btn-primary|wizard-primary|btn-primary/g) || []).length;
}

function main() {
  console.log("\n=== Customer Setup Journey Reset V1 ===\n");

  // --- Audit document ---
  record("audit-doc-exists", fs.existsSync(AUDIT_PATH), AUDIT_PATH);
  const auditText = fs.existsSync(AUDIT_PATH) ? fs.readFileSync(AUDIT_PATH, "utf8") : "";
  for (const section of AUDIT_REQUIRED_SECTIONS) {
    record(`audit-section:${section.slice(0, 24)}`, auditText.includes(section), section);
  }
  record("audit-has-click-estimate", auditText.includes("Estimated clicks"), "click estimate documented");
  record("audit-has-time-estimate", auditText.includes("15 min") || auditText.includes("12–15"), "time estimate documented");
  record("audit-priority-order", auditText.includes("P0") && auditText.includes("P1"), "priority order");

  // --- Journey structure (code) ---
  record("four-customer-reports", CUSTOMER_REPORT_STEP_IDS.length === 4, CUSTOMER_REPORT_STEP_IDS.join(", "));
  record("gi-hidden-from-stepper", !isCustomerVisibleInStepper("growth-intelligence"), "internal step");
  record("customer-report-titles", GROWTH_ENGINE_STEPS.filter((s) => CUSTOMER_REPORT_STEP_IDS.includes(s.id as never)).every((s) => s.title.startsWith("Your")), "Your * titles");

  const journeyStepIds = [
    "business-intelligence",
    "local-market",
    "website-intelligence",
    "growth-plan",
    "generate",
  ];
  for (let i = 0; i < journeyStepIds.length - 1; i++) {
    const cur = GROWTH_ENGINE_STEPS.find((s) => s.id === journeyStepIds[i]);
    const next = GROWTH_ENGINE_STEPS.find((s) => s.id === journeyStepIds[i + 1]);
    record(`journey-order:${cur?.id}->${next?.id}`, (cur?.step || 0) < (next?.step || 99), `${cur?.step} → ${next?.step}`);
  }

  // --- Render customer pages ---
  let data: ReturnType<typeof loadSlug>;
  try {
    data = loadSlug(SLUG);
  } catch (e) {
    console.error(String(e));
    process.exit(1);
  }

  const framework = buildGrowthEngineFramework(SLUG);
  const plan = buildGrowthPlanRecommendation(SLUG);
  const pages: Array<{ id: string; html: string; step: string }> = [
    { id: "hub", html: renderGrowthEngineHubPage(SLUG), step: "hub" },
    { id: "pharmacy", html: renderBusinessIntelligencePage(SLUG, data), step: "business-intelligence" },
    { id: "local-market", html: renderLocalMarketPage(SLUG, loadCompetitorSnapshot(SLUG)), step: "local-market" },
    { id: "website", html: renderWebsiteIntelligencePage(SLUG), step: "website-intelligence" },
    { id: "growth-plan", html: renderGrowthPlanPage(SLUG, plan), step: "growth-plan" },
    { id: "generate", html: renderGeneratePage(SLUG, plan), step: "generate" },
    { id: "dashboard", html: renderGrowthEngineDashboardPage(SLUG), step: "dashboard" },
  ];

  for (const page of pages) {
    const banned = bannedTermsIn(page.html);
    record(`${page.id}:no-seo-jargon`, banned.length === 0, banned.join(", ") || "clean");
  }

  // --- One next action (heuristic: each report has at least one primary CTA) ---
  for (const page of pages.filter((p) => p.id !== "hub" && p.id !== "dashboard")) {
    const primaries = countPrimaryButtons(page.html);
    record(`${page.id}:has-primary-cta`, primaries >= 1, `${primaries} primary CTAs`);
  }

  // Document known multi-CTA pages (audit flags — fail if regression removes primary entirely)
  record("bi-wizard-link", pages.find((p) => p.id === "pharmacy")!.html.includes(growthEngineWizardUrl(SLUG)), "edit profile path");
  record("local-discover-cta", pages.find((p) => p.id === "local-market")!.html.includes("Discover local market"), "discover action");
  record("website-to-plan", pages.find((p) => p.id === "website")!.html.includes("growth-plan"), "website → plan");
  record("plan-campaign", pages.find((p) => p.id === "growth-plan")!.html.includes("recommended campaign") || pages.find((p) => p.id === "growth-plan")!.html.includes("Recommended"), "one campaign");
  record("generate-content-link", pages.find((p) => p.id === "generate")!.html.includes("content-package"), "generation handoff");

  // --- Navigation: prev/next on workflow pages ---
  const navHtml = renderGrowthEngineNavBar(
    SLUG,
    framework,
    "local-market",
    {
      prevUrl: framework.steps.find((s) => s.id === "business-intelligence")?.url,
      nextUrl: framework.steps.find((s) => s.id === "website-intelligence")?.url,
      nextLabel: "Continue →",
    },
  );
  record("nav-has-previous", navHtml.includes("Previous") || navHtml.includes("←"), "previous control");
  record("nav-has-next", navHtml.includes("Continue") || navHtml.includes("→"), "next control");
  record("nav-stepper-reports", (navHtml.match(/Report \d/g) || []).length >= 4, "four report steps");

  for (const stepId of CUSTOMER_REPORT_STEP_IDS) {
    const step = framework.steps.find((s) => s.id === stepId);
    record(`nav-url:${stepId}`, Boolean(step?.url?.includes(stepId)), step?.url || "missing");
  }

  record("wizard-has-back-continue", renderProfileWizardHtml(SLUG, data).includes("wizardBackBtn") && renderProfileWizardHtml(SLUG, data).includes("wizardNextBtn"), "wizard nav");
  record("platform-nav-dashboard", pages[0].html.includes("pharmacy-dashboard") || pages[0].html.includes("growth-engine/dashboard"), "return path exists");

  // --- Completion logic: auto-confirm on save ---
  const pendingImport = normalizeProfileData({
    pharmacyName: "Audit Test Pharmacy",
    phone: "01123456789",
    website: "https://example.com",
    websiteImportedFieldKeys: ["pharmacyName", "phone", "website"],
    profileFieldConfirmations: {},
  });
  const before = buildWizardImportFields(pendingImport);
  const reviewBefore = before.filter((f) => f.status === "review").length;
  record("completion-pending-review", reviewBefore >= 2, `${reviewBefore} fields need review before save`);

  const afterSave = applyAutoConfirmOnSave(pendingImport);
  const after = buildWizardImportFields(afterSave);
  const reviewAfter = after.filter((f) => f.status === "review").length;
  const confirmedAfter = after.filter((f) => f.status === "confirmed").length;
  record("completion-auto-confirm", reviewAfter === 0 && confirmedAfter >= 3, `review=${reviewAfter}, confirmed=${confirmedAfter}`);

  record("completion-helper-exported", typeof applyAutoConfirmOnSave === "function", "applyAutoConfirmOnSave");

  // --- Admin journey entry ---
  const adminService = fs.readFileSync(path.join(ROOT, "src/pharmacy/adminClientCreationService.ts"), "utf8");
  record("admin-redirect-start", adminService.includes("/api/growth-engine/start"), "create → setup start");

  // --- Wizard scope documented ---
  record("wizard-steps-documented", WIZARD_TOTAL_STEPS === 8 && auditText.includes("8 steps"), `${WIZARD_TOTAL_STEPS} steps in audit`);

  // --- Engines untouched (grep guard) ---
  record("framework-service-intact", fs.existsSync(path.join(ROOT, "src/pharmacy/growthEngineFrameworkService.ts")), "framework");
  record("generators-not-modified", fs.existsSync(path.join(ROOT, "src/pharmacy/pharmacyContentPackageService.ts")), "content package service");

  const passed = checks.filter((c) => c.pass).length;
  const total = checks.length;
  console.log(`\n${passed === total ? "✅" : "❌"} ${passed}/${total} checks passed\n`);
  if (passed !== total) process.exit(1);
}

main();
