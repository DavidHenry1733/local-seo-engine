/**
 * NT-E2E-12 — Commercial Intelligence evidence integrity validation.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildCommercialIntelligenceDashboard } from "../src/pharmacy/masterAdminCommercialIntelligenceDashboardService.ts";
import { resolveTenantLocality } from "../src/pharmacy/masterAdminPrimaryLocalityService.ts";
import { readSetupProfile } from "../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts";
import { loadCompetitorIntelligence } from "../src/pharmacy/pharmacyCompetitorIntelligence.ts";
import { readPharmacyVisibilityReport } from "../src/pharmacy/pharmacyVisibilityBridgeService.ts";

const TENANTS = ["reliable-direct-pharmacy", "banner-cross-pharmacy", "broom-lane-pharmacy"] as const;

type Step = { name: string; passed: boolean; detail?: string };
function step(name: string, passed: boolean, detail?: string): Step {
  return { name, passed, detail };
}

function countRotherhamInText(text: string): number {
  return (text.match(/rotherham/gi) || []).length;
}

function main() {
  const steps: Step[] = [];
  const page = readFileSync(
    resolve("artifacts/api-server/src/routes/masterAdminPlatformPage.ts"),
    "utf8",
  );
  const visibilityBridge = readFileSync(
    resolve("src/pharmacy/pharmacyVisibilityBridgeService.ts"),
    "utf8",
  );
  const dashboardSrc = readFileSync(
    resolve("src/pharmacy/masterAdminCommercialIntelligenceDashboardService.ts"),
    "utf8",
  );

  steps.push(
    step(
      "No Rotherham hard-coded fallback in visibility resolver",
      !visibilityBridge.includes('"Rotherham"'),
    ),
  );
  steps.push(
    step(
      "Dashboard removes fabricated competitor fallback",
      !dashboardSrc.includes("Leading pharmacies near") &&
        dashboardSrc.includes("generated: false"),
    ),
  );
  steps.push(step("Tenant locality contract present", dashboardSrc.includes("resolveTenantLocality")));

  for (const slug of TENANTS) {
    const profile = readSetupProfile(slug);
    const locality = resolveTenantLocality(profile);
    const d = buildCommercialIntelligenceDashboard(slug);
    const dashJson = JSON.stringify(d);
    const rotherhamInDash = countRotherhamInText(dashJson);
    const expectsRotherham = locality.value?.toLowerCase() === "rotherham";
    steps.push(
      step(
        `${slug}: locality resolved`,
        locality.available && Boolean(locality.value),
        locality.provenanceLabel,
      ),
    );
    steps.push(
      step(
        `${slug}: no foreign Rotherham in dashboard`,
        expectsRotherham ? true : rotherhamInDash === 0,
        expectsRotherham ? "Rotherham tenant — allowed" : `count=${rotherhamInDash}`,
      ),
    );
  }

  const rd = buildCommercialIntelligenceDashboard("reliable-direct-pharmacy");
  const rdVis = readPharmacyVisibilityReport("reliable-direct-pharmacy");
  const rdIntel = loadCompetitorIntelligence("reliable-direct-pharmacy");
  const rdVisJson = JSON.stringify(rdVis || {});
  steps.push(step("Reliable Direct locality is Sheffield", rd.locality.value === "Sheffield", rd.locality.value || ""));
  steps.push(
    step(
      "Reliable Direct visibility uses Sheffield",
      countRotherhamInText(rdVisJson) === 0,
      `Rotherham refs=${countRotherhamInText(rdVisJson)}`,
    ),
  );
  steps.push(
    step(
      "Reliable Direct traffic opportunity Sheffield-based",
      /sheffield/i.test(rd.executiveSummary.estimatedTrafficOpportunity) ||
        rd.executiveSummary.estimatedTrafficOpportunity.includes("Service-led searches around Sheffield"),
      rd.executiveSummary.estimatedTrafficOpportunity,
    ),
  );
  steps.push(
    step(
      "Reliable Direct competitor evidence present",
      (rdIntel?.competitors.length || 0) > 0 || rd.competitorAnalysis.competitors.length > 0,
      `count=${rdIntel?.competitors.length ?? rd.competitorAnalysis.competitors.length}`,
    ),
  );
  steps.push(step("Reliable Direct competitor section generated flag", rd.competitorAnalysis.generated === true));
  steps.push(
    step(
      "Reliable Direct approval blocked until evidence complete",
      !rd.canApprove || rd.competitorAnalysis.generated,
    ),
  );
  steps.push(step("UI shows competitor missing action", page.includes("Generate Competitor Analysis")));

  const failed = steps.filter((s) => !s.passed);
  for (const s of steps) {
    console.log(`${s.passed ? "PASS" : "FAIL"} — ${s.name}${s.detail ? ` (${s.detail})` : ""}`);
  }
  console.log(failed.length ? `\nNT-E2E-12 validation: FAIL (${failed.length})` : "\nNT-E2E-12 validation: PASS");
  process.exit(failed.length ? 1 : 0);
}

main();
