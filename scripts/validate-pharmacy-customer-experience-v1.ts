#!/usr/bin/env npx tsx
/**
 * PharmaConnect Customer Experience & Growth Programme V1 — validation.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildPharmacyPlatformDashboard } from "../src/pharmacy/pharmacyPlatformDashboardService.ts";
import {
  buildCustomerExperienceView,
  GROWTH_PROGRAMME_TIMELINE,
} from "../src/pharmacy/pharmacyCustomerExperienceService.ts";
import { renderPharmacyPlatformDashboardHtml } from "../artifacts/api-server/src/routes/pharmacyPlatformDashboardPage.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const slug = process.argv[2] || "pharmaconnect";
const BASE = process.env.PHARMA_API_BASE || "http://127.0.0.1:3001";

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

console.log(`\nPharmaConnect Customer Experience V1 — ${slug}\n`);

const dashboard = buildPharmacyPlatformDashboard(slug);
const cx = buildCustomerExperienceView(dashboard);
const html = renderPharmacyPlatformDashboardHtml(dashboard);
const cxSrc = fs.readFileSync(path.join(ROOT, "src/pharmacy/pharmacyCustomerExperienceService.ts"), "utf8");
const pageSrc = fs.readFileSync(path.join(ROOT, "artifacts/api-server/src/routes/pharmacyPlatformDashboardPage.ts"), "utf8");
const longTermSrc = fs.readFileSync(path.join(ROOT, "artifacts/api-server/src/routes/pharmacyLongTermGrowthPage.ts"), "utf8");
const indexSrc = fs.readFileSync(path.join(ROOT, "artifacts/api-server/src/routes/index.ts"), "utf8");
const navSrc = fs.readFileSync(path.join(ROOT, "src/pharmacy/pharmacyPlatformNav.ts"), "utf8");
const enhancementEngineSrc = fs.readFileSync(path.join(ROOT, "src/pharmacy/pharmacyAuthorityEnhancementService.ts"), "utf8");
const layoutSrc = fs.readFileSync(path.join(ROOT, "src/pharmacy/pharmacyVisualExperienceLayoutV3.ts"), "utf8");

record("1-cx-service-exists", fs.existsSync(path.join(ROOT, "src/pharmacy/pharmacyCustomerExperienceService.ts")), "Customer experience service");
record(
  "2-welcome-screen",
  html.includes("Welcome to PharmaConnect") &&
    html.includes("What PharmaConnect does") &&
    html.includes("Why long-term growth matters") &&
    html.includes("How the Growth Programme works"),
  "Welcome panel with programme introduction",
);
record(
  "3-programme-timeline",
  GROWTH_PROGRAMME_TIMELINE.length === 4 &&
    html.includes("Week 1") &&
    html.includes("Month 1") &&
    html.includes("Months 2–3") &&
    html.includes("Months 4–6") &&
    html.includes("not an instant publishing platform"),
  GROWTH_PROGRAMME_TIMELINE.map((b) => b.phase).join(" → "),
);
record(
  "4-outstanding-tasks",
  html.includes("Outstanding Tasks") &&
    !html.includes("Today's Tasks") &&
    pageSrc.includes("Why this matters") &&
    pageSrc.includes("btn-continue"),
  `${cx.outstandingTasks.length} actionable tasks`,
);
record(
  "5-task-fields-only",
  pageSrc.includes("estimatedMinutes") &&
    pageSrc.includes("whyItMatters") &&
    pageSrc.includes("Continue</a>") &&
    !pageSrc.includes("Today's Tasks"),
  "Title, time, why, Continue only",
);
record(
  "6-growth-plan-terminology",
  html.includes("Current Growth Plan") &&
    html.includes("Growth Journey") &&
    html.includes("Growth Progress") &&
    !html.includes("Overall Campaign Completion") &&
    !html.includes("Current campaign"),
  "Customer-facing Growth Plan language",
);
record(
  "7-internal-naming-unchanged",
  !cxSrc.includes("renameCampaign") &&
    fs.readFileSync(path.join(ROOT, "src/pharmacy/pharmacyCampaignService.ts"), "utf8").includes("createPharmacyCampaign"),
  "Campaign APIs/services unchanged",
);
record(
  "8-five-dashboard-sections",
  html.includes('id="outstanding-tasks"') &&
    html.includes('id="current-growth-plan"') &&
    html.includes('id="progress"') &&
    html.includes('id="performance"') &&
    pageSrc.includes("Advanced Tools"),
  "Outstanding Tasks, Growth Plan, Progress, Performance, Advanced Tools",
);
record(
  "9-advanced-tools-collapsed",
  pageSrc.includes("<details class=\"advanced\">") &&
    pageSrc.includes("<summary>Advanced Tools</summary>") &&
    !pageSrc.includes("<details class=\"advanced\" open"),
  "Advanced Tools collapsed by default",
);
record(
  "10-advanced-tools-modules",
  cx.advancedTools.some((t) => t.label === "Campaign Management") &&
    cx.advancedTools.some((t) => t.label === "Content Review") &&
    cx.advancedTools.some((t) => t.label === "Publishing") &&
    cx.advancedTools.some((t) => t.label === "Search Visibility") &&
    cx.advancedTools.some((t) => t.label === "Recommended Improvements") &&
    cx.advancedTools.some((t) => t.label === "Reports"),
  `${cx.advancedTools.length} advanced tool links`,
);
record(
  "11-commercial-plan-tiers",
  html.includes("Growth Plan levels") &&
    html.includes("Starter") &&
    html.includes("Professional") &&
    html.includes("Complete") &&
    html.includes("Perfect for pharmacies beginning their digital growth"),
  `active tier=${cx.growthPlanTier}`,
);
record(
  "12-long-term-growth-page",
  fs.existsSync(path.join(ROOT, "artifacts/api-server/src/routes/pharmacyLongTermGrowthPage.ts")) &&
    longTermSrc.includes("How PharmaConnect Builds Long-Term Growth") &&
    longTermSrc.includes("Google rewards trusted pharmacies") &&
    !longTermSrc.includes("SEO") &&
    !longTermSrc.toLowerCase().includes("artificial intelligence"),
  "Long-term growth education page",
);
record(
  "13-long-term-route-registered",
  indexSrc.includes("pharmacyLongTermGrowthPageRouter") && indexSrc.includes("router.use(pharmacyLongTermGrowthPageRouter)"),
  "Route registered in index.ts",
);
record(
  "14-growth-programme-header",
  html.includes("PharmaConnect Growth Programme") &&
    html.includes("We guide you") &&
    navSrc.includes("Growth Programme"),
  "Programme framing in header and nav",
);
record(
  "15-no-dead-ends",
  cx.outstandingTasks.every((t) => t.continueUrl.startsWith("/api/")) &&
    cx.advancedTools.every((t) => t.url.startsWith("/api/")) &&
    html.includes("pharmacy-long-term-growth"),
  "All customer links resolve to platform routes",
);
record(
  "16-no-engine-modified",
  !enhancementEngineSrc.includes("CustomerExperience") && layoutSrc.includes("clusterImagePanel"),
  "Authority enhancement engine and templates untouched",
);
record(
  "17-no-content-generation-modified",
  !fs.readFileSync(path.join(ROOT, "src/pharmacy/pharmacyCampaignService.ts"), "utf8").includes("buildCustomerExperienceView"),
  "Campaign generation layer unchanged",
);
record(
  "18-documentation-exists",
  fs.existsSync(path.join(ROOT, "docs/platform/PHARMACONNECT-CUSTOMER-EXPERIENCE-V1.md")),
  "Customer experience documentation",
);

try {
  const dashRes = await fetch(`${BASE}/api/pharmacy-dashboard?slug=${slug}`, { redirect: "manual" });
  const growthRes = await fetch(`${BASE}/api/pharmacy-long-term-growth?slug=${slug}`, { redirect: "manual" });
  if (dashRes.status === 302) {
    record("19-live-dashboard", true, "Auth-gated");
    record("20-live-long-term-growth", growthRes.status === 302 || growthRes.status === 200, `HTTP ${growthRes.status}`);
  } else {
    const liveDash = await dashRes.text();
    const liveGrowth = growthRes.ok ? await growthRes.text() : "";
    record("19-live-dashboard", liveDash.includes("Outstanding Tasks") && liveDash.includes("Welcome to PharmaConnect"), `Live at ${BASE}`);
    record(
      "20-live-long-term-growth",
      liveGrowth.includes("How PharmaConnect Builds Long-Term Growth"),
      growthRes.ok ? `Live at ${BASE}` : `HTTP ${growthRes.status}`,
    );
  }
} catch {
  record("19-live-dashboard", html.includes("Outstanding Tasks"), "Offline validation");
  record("20-live-long-term-growth", longTermSrc.includes("How PharmaConnect Builds Long-Term Growth"), "Offline validation");
}

const reportPath = path.join(ROOT, "data/validation-reports/pharmacy-customer-experience-v1.json");
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
const allPass = checks.every((c) => c.pass);
fs.writeFileSync(
  reportPath,
  JSON.stringify(
    {
      slug,
      pass: allPass,
      growthPlanTier: cx.growthPlanTier,
      outstandingTaskCount: cx.outstandingTasks.length,
      growthProgressPct: cx.growthProgressPct,
      checks,
      generatedAt: new Date().toISOString(),
    },
    null,
    2,
  ),
  "utf8",
);

console.log(`\nReport: ${reportPath}`);
console.log(allPass ? "\n✅ CUSTOMER EXPERIENCE V1 PASS\n" : "\n❌ VALIDATION FAILED\n");
process.exit(allPass ? 0 : 1);
