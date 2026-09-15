#!/usr/bin/env npx tsx
/**
 * COMMERCIAL-BLUE-UI-BASELINE-LOCK-42
 * No-write route/render fixtures. Does not regenerate, republish, or mutate sources.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { renderMasterAdminPlatformShell } from "../artifacts/api-server/src/routes/masterAdminPlatformPage.ts";
import { renderGrowthPlanV1Page } from "../src/pharmacy/growthEngineGrowthPlanPage.ts";
import { loadCompetitorSnapshot } from "../src/pharmacy/growthEngineLocalMarketService.ts";
import { renderBusinessIntelligencePage, renderLocalMarketPage } from "../src/pharmacy/growthEnginePageRenderers.ts";
import { renderPremiumCustomerDashboardPage } from "../src/pharmacy/growthEnginePremiumCustomerDashboardPage.ts";
import { renderReviewCentrePage } from "../src/pharmacy/growthEngineReviewCentrePage.ts";
import {
  COMMERCIAL_BLUE_UI_BASELINE_ID,
  COMMERCIAL_BLUE_UI_TOKENS,
  customerFacingBlackThemeLeakage,
  isIsolatedInternalAdminBlackTheme,
  usesCommercialBlueBaseline,
  usesGeneratedPageBlueContract,
} from "../src/pharmacy/pharmacyCommercialBlueUiBaseline.ts";
import {
  renderApprovedLocalityPreviewHtml,
  renderBenchmarkPagePreviewHtml,
} from "../src/pharmacy/pharmacyContentEcosystemPreviewRoute.ts";
import {
  packageLockedCampaignStagingRelease,
  resolveLockedCampaignStagingInventory,
} from "../src/pharmacy/pharmacyLockedCampaignStagingPublishService.ts";
import { renderProfileWizardHtml } from "../src/pharmacy/pharmacyProfileWizardPage.ts";
import { normalizeProfileDoc } from "../src/pharmacy/pharmacyProfileSchema.ts";

const ROOT = "/home/inboxingproweb/pharmaconnect-growth-engine";
const SLUG = "yorkshire-pharmacy-and-health-clinic";
const FLU = "flu-vaccinations";
const CAMPAIGNS = ["flu-vaccinations", "travel-vaccinations", "pharmacy-first", "blood-pressure-checks"] as const;

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

function shaDir(dir: string): string | null {
  if (!fs.existsSync(dir)) return null;
  const files: string[] = [];
  const walk = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else files.push(full);
    }
  };
  walk(dir);
  const hash = crypto.createHash("sha256");
  for (const file of files.sort()) {
    hash.update(path.relative(dir, file));
    hash.update(fs.readFileSync(file));
  }
  return hash.digest("hex");
}

function snapshotIntegrity(): Record<string, string | null> {
  const out: Record<string, string | null> = {
    active: shaFile(path.join(ROOT, "data/pharmacy-master-admin/active-service-campaign", `${SLUG}.json`)),
    assembler: shaFile(path.join(ROOT, "src/pharmacy/pharmacyPublishPackageAssembler.ts")),
    stagingCurrent: shaDir(path.join("/var/www/pharmaconnect-sites", SLUG, "current")),
    stagingReleases: shaDir(path.join("/var/www/pharmaconnect-sites", SLUG, "releases")),
  };
  for (const campaign of CAMPAIGNS) {
    out[`approval:${campaign}`] = shaFile(
      path.join(ROOT, "data/pharmacy-master-admin/campaign-approvals", SLUG, `${campaign}.json`),
    );
    out[`service:${campaign}`] = shaFile(
      path.join(ROOT, "output/pharmacy-visual-experience", SLUG, campaign, "index.html"),
    );
    out[`local:${campaign}`] = shaDir(
      path.join(ROOT, "output/pharmacy-content-ecosystem", SLUG, campaign),
    );
    out[`bank:${campaign}`] = shaDir(
      path.join(ROOT, "data/pharmacy-approved-service-banks/banks", campaign),
    );
  }
  out["bank-registry"] = shaFile(path.join(ROOT, "data/pharmacy-approved-service-banks/registry.json"));
  return out;
}

function hasResponsiveCss(html: string): boolean {
  return /@media\s*\(\s*max-width:\s*(720|820|960)px\s*\)/.test(html);
}

function productFixtureOk(html: string): { ok: boolean; detail: string } {
  const leak = customerFacingBlackThemeLeakage(html);
  const baseline = usesCommercialBlueBaseline(html);
  const responsive = hasResponsiveCss(html);
  const primary = html.toLowerCase().includes(COMMERCIAL_BLUE_UI_TOKENS.primary);
  const ok = baseline && leak.length === 0 && responsive && primary;
  return {
    ok,
    detail: `baseline=${baseline} leak=${leak.join(",") || "none"} responsive=${responsive} primary=${primary}`,
  };
}

function generatedFixtureOk(html: string): { ok: boolean; detail: string } {
  const leak = customerFacingBlackThemeLeakage(html);
  const contract = usesGeneratedPageBlueContract(html);
  const responsive = hasResponsiveCss(html);
  const noAdmin = !/data-internal-admin-theme=["']black["']/.test(html);
  const ok = contract && leak.length === 0 && responsive && noAdmin;
  return {
    ok,
    detail: `contract=${contract} leak=${leak.join(",") || "none"} responsive=${responsive} admin=${!noAdmin}`,
  };
}

function loadProfile() {
  const file = path.join(ROOT, "data/pharmacy-profiles", `${SLUG}.json`);
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  return normalizeProfileDoc(SLUG, raw).data;
}

async function main(): Promise<void> {
  const before = snapshotIntegrity();
  const profile = loadProfile();

  const fixtures: Array<{ id: string; html: string; kind: "product" | "generated" }> = [
    { id: "business-profile-import", html: renderBusinessIntelligencePage(SLUG, profile), kind: "product" },
    { id: "business-profile-wizard", html: renderProfileWizardHtml(SLUG, profile, { initialStep: 1 }), kind: "product" },
    { id: "local-market", html: renderLocalMarketPage(SLUG, loadCompetitorSnapshot(SLUG)), kind: "product" },
    { id: "growth-plan", html: renderGrowthPlanV1Page(SLUG), kind: "product" },
    { id: "dashboard", html: renderPremiumCustomerDashboardPage(SLUG), kind: "product" },
    { id: "review-centre", html: renderReviewCentrePage(SLUG, FLU), kind: "product" },
    {
      id: "service-preview",
      html: renderBenchmarkPagePreviewHtml(
        path.join(ROOT, "output/pharmacy-visual-experience", SLUG, FLU, "index.html"),
        FLU,
        SLUG,
        "service-page",
      ),
      kind: "generated",
    },
    {
      id: "locality-preview",
      html: renderApprovedLocalityPreviewHtml(
        fs.readFileSync(
          path.join(ROOT, "output/pharmacy-content-ecosystem", SLUG, FLU, "local/darfield/index.html"),
          "utf8",
        ),
        { slug: SLUG, serviceId: FLU, localitySlug: "darfield" },
      ),
      kind: "generated",
    },
  ];

  const inventory = resolveLockedCampaignStagingInventory(SLUG, FLU);
  const packed = packageLockedCampaignStagingRelease(inventory);
  if (!packed.ok) throw new Error(packed.blockers.join("; "));
  const stagingService = packed.pkg.files.find((f) => f.relativePath === `${FLU}/index.html`)?.contents.toString("utf8") || "";
  const stagingLocality =
    packed.pkg.files.find((f) => f.relativePath === `${FLU}/local/darfield/index.html`)?.contents.toString("utf8") || "";
  fixtures.push({ id: "staging-service", html: stagingService, kind: "generated" });
  fixtures.push({ id: "staging-locality", html: stagingLocality, kind: "generated" });

  const productFails: string[] = [];
  const generatedFails: string[] = [];
  const responsiveFails: string[] = [];
  for (const fixture of fixtures) {
    const result = fixture.kind === "product" ? productFixtureOk(fixture.html) : generatedFixtureOk(fixture.html);
    record(fixture.id, result.ok, result.detail);
    if (!result.ok) {
      if (fixture.kind === "product") productFails.push(fixture.id);
      else generatedFails.push(fixture.id);
    }
    if (!hasResponsiveCss(fixture.html)) responsiveFails.push(fixture.id);
  }

  record(
    "customer-route-blue-baseline",
    productFails.length === 0 && generatedFails.length === 0 && fixtures.every((f) => f.html.includes("#005eb8") || /--brand-primary/.test(f.html)),
    `productFails=${productFails.join(",") || "none"} generatedFails=${generatedFails.join(",") || "none"} id=${COMMERCIAL_BLUE_UI_BASELINE_ID}`,
  );

  const admin = renderMasterAdminPlatformShell();
  const customerLeak = fixtures.flatMap((f) => customerFacingBlackThemeLeakage(f.html).map((r) => `${f.id}:${r}`));
  record(
    "black-theme-isolation",
    isIsolatedInternalAdminBlackTheme(admin) && customerLeak.length === 0,
    `adminIsolated=${isIsolatedInternalAdminBlackTheme(admin)} customerLeak=${customerLeak.join(",") || "none"}`,
  );

  record(
    "responsive-consistency",
    responsiveFails.length === 0,
    responsiveFails.length ? `missingMedia=${responsiveFails.join(",")}` : "desktop/mobile CSS present on all fixtures",
  );

  const sourceService = fs.readFileSync(
    path.join(ROOT, "output/pharmacy-visual-experience", SLUG, FLU, "index.html"),
    "utf8",
  );
  const sourceLocality = fs.readFileSync(
    path.join(ROOT, "output/pharmacy-content-ecosystem", SLUG, FLU, "local/darfield/index.html"),
    "utf8",
  );
  const previewService = fixtures.find((f) => f.id === "service-preview")!.html;
  const previewLocality = fixtures.find((f) => f.id === "locality-preview")!.html;
  record(
    "content-schema-integrity",
    shaFile(path.join(ROOT, "output/pharmacy-visual-experience", SLUG, FLU, "index.html")) === before["service:flu-vaccinations"] &&
      shaDir(path.join(ROOT, "output/pharmacy-content-ecosystem", SLUG, FLU)) === before["local:flu-vaccinations"] &&
      sourceService.includes("<script type=\"application/ld+json\">") &&
      previewService.includes("<script type=\"application/ld+json\">") &&
      previewLocality.includes("<script type=\"application/ld+json\">") &&
      stagingService.includes("noindex, nofollow") &&
      stagingLocality.includes("noindex, nofollow"),
    "source JSON-LD/canonical unchanged; preview/staging still carry schema; staging noindex kept",
  );

  const after = snapshotIntegrity();
  const mutated = Object.keys(before).filter((key) => before[key] !== after[key]);
  record(
    "four-campaign-staging-integrity",
    mutated.length === 0 && CAMPAIGNS.every((c) => before[`approval:${c}`]),
    mutated.length ? `mutated=${mutated.join(",")}` : "four locked campaigns and Flu staging files unchanged",
  );

  const failedIds = checks.filter((c) => !c.pass).map((c) => c.id);
  if (failedIds.length) {
    console.error(`FAIL ${failedIds.join(", ")}`);
    process.exit(1);
  }
  console.log("PASS commercial-blue-ui-baseline-lock-42");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
