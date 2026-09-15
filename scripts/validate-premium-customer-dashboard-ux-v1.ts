#!/usr/bin/env npx tsx
/**
 * Premium Customer Dashboard UX V1 — presentation validation.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderPremiumCustomerDashboardPage } from "../src/pharmacy/growthEnginePremiumCustomerDashboardPage.ts";
import { buildPremiumCustomerDashboardView, premiumDashboardUsesFramework } from "../src/pharmacy/growthEnginePremiumCustomerDashboard.ts";
import { renderGrowthEngineDashboardPage } from "../src/pharmacy/growthEnginePageRenderers.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
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

const FORBIDDEN_TERMS = [
  /\bschema\b/i,
  /\bmeta titles?\b/i,
  /\bmeta descriptions?\b/i,
  /\bcanonical\b/i,
  /\bbreadcrumb/i,
  /\bentity\b/i,
  /\bmanifest\b/i,
  /\bregistry\b/i,
  /\blifecycle\b/i,
  /\bgenerator\b/i,
  /\bpipeline\b/i,
  /\bAI answers\b/i,
  /\bstructured data\b/i,
  /\btechnical SEO\b/i,
];

const REQUIRED_CUSTOMER_LABELS = [
  "Welcome back",
  "Your pharmacy growth journey is ready",
  "Your growth journey",
  "Today's task",
  "Your Local Market",
  "Your Website Report",
  "Your Growth Plan",
  "Confirm pharmacy details",
  "Compare local market",
  "Publish and track",
];

const JOURNEY_STEP_TITLES = [
  "Confirm pharmacy details",
  "Compare local market",
  "Review website",
  "View growth plan",
  "Create content",
  "Review content",
  "Publish and track",
];

const INTERNAL_MODULES = [
  "Founder Partner",
  "Campaign OS",
  "Live Integration Proof",
  "Growth Timeline",
  "Operational gaps",
  "Content Package",
  "Indexing",
  "Authority Readiness",
  "pharmacy-growth-dashboard",
  "pharmacy-campaigns",
  "pharmacy-enhancement",
];

const STATUS_LABELS = ["Complete", "Ready", "Needs Review", "Locked"];

function forbiddenIn(html: string): string[] {
  return FORBIDDEN_TERMS.filter((re) => re.test(html)).map((re) => re.source);
}

function main() {
  console.log("\n=== Premium Customer Dashboard UX V1 ===\n");

  record("page-module-exists", fs.existsSync(path.join(ROOT, "src/pharmacy/growthEnginePremiumCustomerDashboardPage.ts")), "renderer");
  record("view-module-exists", fs.existsSync(path.join(ROOT, "src/pharmacy/growthEnginePremiumCustomerDashboard.ts")), "view model");

  const html = renderPremiumCustomerDashboardPage(SLUG);
  record("dashboard-renders", html.length > 500, `${html.length} chars`);

  const viaRouter = renderGrowthEngineDashboardPage(SLUG);
  record("page-renderers-wired", viaRouter.includes("premium-customer-v1"), "growth-engine dashboard route");

  for (const label of REQUIRED_CUSTOMER_LABELS) {
    record(`label:${label.slice(0, 28)}`, html.includes(label), label);
  }

  for (const title of JOURNEY_STEP_TITLES) {
    record(`journey:${title.slice(0, 24)}`, html.includes(title), title);
  }

  record("journey-seven-steps", (html.match(/class="pcd-step /g) || []).length === 7, "7 journey cards");

  for (const status of ["Complete", "Ready", "Locked"]) {
    record(`status:${status}`, html.includes(status), status);
  }

  const forbidden = forbiddenIn(html.replace(/<head[\s\S]*?<\/head>/i, ""));
  record("no-forbidden-terms", forbidden.length === 0, forbidden.join(", ") || "clean");

  record("status-needs-review-supported", fs.readFileSync(path.join(ROOT, "src/pharmacy/growthEnginePremiumCustomerDashboard.ts"), "utf8").includes("Needs Review"), "status label in view model");

  for (const mod of INTERNAL_MODULES) {
    record(`hidden:${mod.slice(0, 20)}`, !html.includes(mod), mod);
  }

  record("report-previews-three", (html.match(/class="pcd-report"/g) || []).length === 3, "3 report cards");
  record("report-ready-to-run", html.includes("Ready to run") || html.includes("Ready to create"), "empty state copy");
  record("one-primary-cta", (html.match(/class="pcd-cta-main"/g) || []).length === 1, "single primary button");
  record("welcome-pharmacy-name", html.includes("Welcome back,"), "personalised welcome");
  record("setup-progress", html.includes("Setup progress"), "progress card");
  record("premium-layout", html.includes("pcd-header") && html.includes("pcd-journey"), "premium CSS classes");

  const view = buildPremiumCustomerDashboardView(SLUG);
  record("view-primary-cta", Boolean(view.primaryCtaLabel && view.primaryCtaHref), view.primaryCtaLabel);
  record("view-single-task", Boolean(view.todaysTask), view.todaysTask);
  record("view-report-previews", view.reportPreviews.length === 3, `${view.reportPreviews.length} previews`);

  const framework = premiumDashboardUsesFramework(SLUG);
  record("framework-still-used", framework.steps.length >= 7, `${framework.steps.length} framework steps`);
  record("route-business-intelligence", html.includes("/api/growth-engine/business-intelligence"), "report routes");
  record("route-local-market", html.includes("/api/growth-engine/local-market"), "local market route");
  record("route-website", html.includes("/api/growth-engine/website-intelligence"), "website route");
  record("route-growth-plan", html.includes("/api/growth-engine/growth-plan"), "growth plan route");

  const passed = checks.filter((c) => c.pass).length;
  const total = checks.length;
  console.log(`\n${passed === total ? "✅" : "❌"} ${passed}/${total} checks passed\n`);
  if (passed !== total) process.exit(1);
}

main();
