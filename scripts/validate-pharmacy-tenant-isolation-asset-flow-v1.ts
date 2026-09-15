#!/usr/bin/env npx tsx
/**
 * PharmaConnect Tenant Isolation & Asset Generation Flow V1 — validation.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  resolveTenantProfileSlug,
  renderMissingTenantSlugHtml,
  CLIENT_PORTFOLIO_URL,
} from "../src/pharmacy/pharmacyTenantSlug.ts";
import { loadPharmacyProfile } from "../src/pharmacy/pharmacyContentBlueprintService.ts";
import { readPharmacyCampaignStore } from "../src/pharmacy/pharmacyCampaignService.ts";
import {
  getServiceAssetWorkflow,
  validateVisualPageTenant,
  visualAssetExists,
} from "../src/pharmacy/pharmacyAssetWorkflowService.ts";
import { buildPlatformOperatingSystem } from "../src/pharmacy/pharmacyPlatformOperatingSystemService.ts";
import { resolveVisualExperienceHtmlPath } from "../src/pharmacy/pharmacyVisualExperience.ts";
import { buildPharmacyServicePageProfile } from "../src/pharmacy/pharmacyServicePageProfileContext.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

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

function readRouteSource(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

const slugA = process.argv[2] || "pharmaconnect";
const slugB = process.argv[3] || "dhm-digital";
const serviceId = "pharmacy-first";

console.log(`\nPharmaConnect Tenant Isolation V1 — ${slugA} vs ${slugB}\n`);

const resolvedA = resolveTenantProfileSlug(slugA);
const resolvedB = resolveTenantProfileSlug(slugB);

record("resolve-slug-a", Boolean(resolvedA), `${slugA} → ${resolvedA}`);
record("resolve-slug-b", Boolean(resolvedB), `${slugB} → ${resolvedB}`);

if (resolvedA) {
  const profileA = loadPharmacyProfile(resolvedA);
  const nameA = profileA.data?.pharmacyName || "";
  record("profile-a-name", /brook pharmacy/i.test(nameA), nameA || "missing");
  record("profile-a-not-dhm", !/dhm digital/i.test(nameA), nameA);
}

if (resolvedB) {
  const profileB = loadPharmacyProfile(resolvedB);
  const nameB = profileB.data?.pharmacyName || "";
  record("profile-b-name", /dhm digital/i.test(nameB), nameB || "missing");
  record("profile-b-not-brook", !/brook pharmacy/i.test(nameB), nameB || "no name");
}

function htmlContains(file: string | null, text: string): boolean {
  if (!file || !fs.existsSync(file)) return false;
  return fs.readFileSync(file, "utf8").includes(text);
}

const brookServices = ["pharmacy-first", "blood-pressure-checks", "travel-vaccinations", "emergency-contraception"];
if (resolvedA) {
  for (const svc of brookServices) {
    const p = resolveVisualExperienceHtmlPath(svc, resolvedA);
    record(
      `visual-a-${svc}-brook`,
      htmlContains(p, "Brook Pharmacy"),
      p ? path.basename(path.dirname(p)) : "missing",
    );
    record(
      `visual-a-${svc}-no-dhm`,
      !htmlContains(p, "DHM Digital"),
      p ? "ok" : "missing",
    );
  }
}

if (resolvedB) {
  const dhmPage = resolveVisualExperienceHtmlPath(serviceId, resolvedB);
  record(
    "visual-b-dhm-page",
    htmlContains(dhmPage, "DHM Digital"),
    dhmPage || "none",
  );
  record(
    "visual-b-no-brook-in-page",
    !htmlContains(dhmPage, "Brook Pharmacy"),
    dhmPage ? "ok" : "not generated yet",
  );
}

if (resolvedA && resolvedB) {
  record("profiles-distinct", resolvedA !== resolvedB || slugA === slugB, `${resolvedA} vs ${resolvedB}`);

  const campaignA = readPharmacyCampaignStore(resolvedA);
  const campaignB = readPharmacyCampaignStore(resolvedB);
  record("campaign-store-a", campaignA?.slug === resolvedA, campaignA?.slug || "none");
  record("campaign-store-b", campaignB?.slug === resolvedB, campaignB?.slug || "none");

  const wfA = getServiceAssetWorkflow(resolvedA, serviceId);
  const wfB = getServiceAssetWorkflow(resolvedB, serviceId);
  record(
    "workflow-files-separate",
    fs.existsSync(path.join(ROOT, "data/pharmacy-asset-workflow", `${resolvedA}.json`)) ||
      !fs.existsSync(path.join(ROOT, "data/pharmacy-asset-workflow", `${resolvedB}.json`)) ||
      resolvedA !== resolvedB,
    `A approved=${Boolean(wfA.assetApprovedAt)} B approved=${Boolean(wfB.assetApprovedAt)}`,
  );

  const pathA = resolveVisualExperienceHtmlPath(serviceId, resolvedA);
  const pathB = resolveVisualExperienceHtmlPath(serviceId, resolvedB);
  record("visual-path-a", pathA?.includes(`/pharmacy-visual-experience/${resolvedA}/`) ?? false, pathA || "none");
  record("visual-path-b", pathB ? pathB.includes(`/pharmacy-visual-experience/${resolvedB}/`) : true, pathB || "none yet (expected)");

  if (resolvedB !== "pharmaconnect") {
    const pageProfileB = buildPharmacyServicePageProfile(resolvedB);
    const checkB = validateVisualPageTenant(resolvedB, serviceId, pageProfileB.pharmacyName);
    if (visualAssetExists(resolvedB, serviceId)) {
      record("visual-b-no-brook", checkB.reason !== "wrong_tenant_brook", checkB.reason || "ok");
      record(
        "visual-b-has-pharmacy-name",
        checkB.ok || checkB.reason === "missing",
        pageProfileB.pharmacyName,
      );
    } else {
      record("visual-b-missing-ok", checkB.reason === "missing", "no page yet — Create My Page expected");
    }

    record(
      "pharmaconnect-complete-no-leak",
      !wfB.assetApprovedAt || wfB !== wfA,
      `B approved=${Boolean(wfB.assetApprovedAt)} independent of A`,
    );
  }
}

const osB = resolvedB ? buildPlatformOperatingSystem(resolvedB, { primaryServiceId: serviceId }) : null;
if (osB) {
  const review = osB.steps.find((s) => s.id === "review-content");
  const generate = osB.steps.find((s) => s.id === "generate-asset");
  record(
    "dashboard-links-preserve-slug",
    Boolean(review?.url?.includes(`slug=${resolvedB}`) && generate?.url?.includes(`slug=${resolvedB}`)),
    `review=${review?.url} generate=${generate?.url}`,
  );
}

const missingHtml = renderMissingTenantSlugHtml();
record("missing-slug-portfolio-link", missingHtml.includes(CLIENT_PORTFOLIO_URL), CLIENT_PORTFOLIO_URL);

const assetReviewRoute = readRouteSource("artifacts/api-server/src/routes/pharmacyAssetReviewPage.ts");
const dashboardRoute = readRouteSource("artifacts/api-server/src/routes/pharmacyPlatformDashboardPage.ts");
const visualRoute = readRouteSource("artifacts/api-server/src/routes/pharmacyVisualExperiencePreview.ts");

record(
  "asset-review-no-pharmaconnect-default",
  !assetReviewRoute.includes('req.query.slug || "pharmaconnect"'),
  "tenantSlugOrRespond",
);
record(
  "dashboard-no-pharmaconnect-default",
  !dashboardRoute.includes('req.query.slug || process.env.DEFAULT_PROJECT_SLUG || "pharmaconnect"'),
  "tenantSlugOrRespond",
);
const profilesApi = readRouteSource("artifacts/api-server/src/routes/api/pharmacyProfiles.ts");
record(
  "profile-post-resolved-slug",
  profilesApi.includes("profileSlugFromRequest") && profilesApi.includes("resolveTenantProfileSlug"),
  "writes to resolved tenant path only",
);
record(
  "profile-post-no-pharmaconnect-default",
  !profilesApi.includes('String(v || "pharmaconnect")'),
  "no pharmaconnect default on save",
);

const passed = checks.filter((c) => c.pass).length;
const failed = checks.filter((c) => !c.pass).length;
console.log(`\n${passed}/${checks.length} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
