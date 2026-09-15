#!/usr/bin/env npx tsx
/**
 * PRODUCT-OWNER-IMAGE-LIBRARY-UI-CONNECTION-43C
 * No-write validation of the customer-facing Image Library route.
 * Does not upload, regenerate, republish, or mutate locked campaigns.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { renderImageLibraryDashboardHtml } from "../artifacts/api-server/src/routes/pharmacyImageLibraryPage.ts";
import { renderProductOwnerImageLibraryPage } from "../src/pharmacy/growthEngineProductOwnerImageLibraryPage.ts";
import { renderPremiumCustomerDashboardPage } from "../src/pharmacy/growthEnginePremiumCustomerDashboardPage.ts";
import { renderReviewCentrePage } from "../src/pharmacy/growthEngineReviewCentrePage.ts";
import {
  COMMERCIAL_BLUE_UI_BASELINE_ID,
  usesCommercialBlueBaseline,
} from "../src/pharmacy/pharmacyCommercialBlueUiBaseline.ts";
import { loadImageAssignments } from "../src/pharmacy/pharmacyImageOperatingSystem.ts";
import {
  packageLockedCampaignStagingRelease,
  resolveLockedCampaignStagingInventory,
} from "../src/pharmacy/pharmacyLockedCampaignStagingPublishService.ts";
import { buildImageOperatingSystemDashboard } from "../src/pharmacy/pharmacyImageOperatingSystem.ts";

const ROOT = "/home/inboxingproweb/pharmaconnect-growth-engine";
const SLUG = "yorkshire-pharmacy-and-health-clinic";
const CAMPAIGNS = ["flu-vaccinations", "travel-vaccinations", "pharmacy-first", "blood-pressure-checks"] as const;
const FLU_BANK = "eb79f51391b6b6e5cd0b4ac02d6cbe235306159a8847aa704eb5d64f7f4d1ce3";

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
    fluBankFile: shaFile(
      path.join(ROOT, "data/pharmacy-approved-service-banks/banks/flu-vaccinations", `${FLU_BANK}.json`),
    ),
    assignments: shaFile(path.join(ROOT, "data/pharmacy-image-assignments", `${SLUG}.json`)),
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
    out[`local:${campaign}`] = shaDir(path.join(ROOT, "output/pharmacy-content-ecosystem", SLUG, campaign));
    out[`bank:${campaign}`] = shaDir(path.join(ROOT, "data/pharmacy-approved-service-banks/banks", campaign));
    out[`package:${campaign}`] = shaFile(
      path.join(ROOT, "data/pharmacy-content-packages", SLUG, `${campaign}.json`),
    );
  }
  return out;
}

function main(): void {
  const before = snapshotIntegrity();
  const html = renderProductOwnerImageLibraryPage(SLUG);
  const dashboard = renderPremiumCustomerDashboardPage(SLUG);
  const review = renderReviewCentrePage(SLUG, "flu-vaccinations");
  const admin = renderImageLibraryDashboardHtml(buildImageOperatingSystemDashboard(SLUG, {}), "hero");
  const assignments = loadImageAssignments(SLUG);

  record(
    "customer-image-library-route",
    html.includes("<h1>Your Image Library</h1>") &&
      html.includes(
        "Add photographs for your pharmacy website. PharmaConnect will automatically choose suitable images for each service and local page.",
      ) &&
      html.includes('id="returnDashboardLink"') &&
      html.includes(`/api/growth-engine/dashboard?slug=${encodeURIComponent(SLUG)}`),
    "customer page heading, explanation and dashboard return",
  );

  record(
    "twenty-count-multi-upload",
    /\d+ of 20/.test(html) &&
      /<input[^>]*id="tenantLibraryFiles"[^>]*multiple/.test(html.replace(/\n/g, " ")) &&
      html.includes('id="tenantLibraryFiles"') &&
      html.includes("multiple"),
    "count out of 20 and multiple file upload",
  );

  record(
    "approved-stock-selection",
    html.includes("Add approved stock images") && html.includes("includeStockBtn") && /approved stock/i.test(html),
    "approved stock choices are offered",
  );

  record(
    "automatic-placement-messaging",
    html.includes("automatically choose suitable images") && html.includes("Placement is automatic"),
    "automatic placement is explained",
  );

  record(
    "legacy-slot-ui-removed-from-customer-route",
    !html.includes("slot-grid") &&
      !html.includes("id=\"matrix\"") &&
      !html.includes("Assign to slot") &&
      !html.includes("Assign to selected slot") &&
      !html.includes("imageLibraryServiceSelect") &&
      !html.includes("Master Stock Images") &&
      !html.includes("Image types (comma-separated)") &&
      !html.includes("Subjects (comma-separated)") &&
      !html.includes("hero,support,trust,conversion") &&
      !html.includes("Auto-fill this service") &&
      !html.includes("btn-slot-upload") &&
      !html.includes("Required campaign images"),
    "customer route has no slot grid, matrix, assignment or comma-separated fields",
  );

  record(
    "misleading-ai-action-removed",
    !html.includes("Generate With AI") &&
      !html.includes("id=\"aiBtn\"") &&
      html.includes("AI image generation is coming soon") &&
      !html.includes("id=\"aiPrompt\""),
    "no Generate With AI action; coming-soon copy only",
  );

  record(
    "master-admin-compatibility",
    Boolean(assignments?.assignments) &&
      admin.includes("slot-grid") &&
      admin.includes("id=\"matrix\"") &&
      admin.includes("Assign to slot") &&
      admin.includes("Generate With AI") &&
      admin.includes("Master Stock Images"),
    "legacy assignments readable and internal diagnostics UI retained",
  );

  record(
    "blue-ui-integrity",
    usesCommercialBlueBaseline(html) &&
      usesCommercialBlueBaseline(dashboard) &&
      usesCommercialBlueBaseline(review) &&
      html.includes(COMMERCIAL_BLUE_UI_BASELINE_ID) &&
      html.includes("#005eb8"),
    "Product Owner chrome remains commercial blue",
  );

  for (const campaign of CAMPAIGNS) {
    const inventory = resolveLockedCampaignStagingInventory(SLUG, campaign);
    const packed = packageLockedCampaignStagingRelease(inventory);
    if (!packed.ok) record(`staging-pack-${campaign}`, false, packed.blockers.join("; "));
  }

  const after = snapshotIntegrity();
  const mutated = Object.keys(before).filter((key) => before[key] !== after[key]);
  record(
    "four-campaign-staging-integrity",
    mutated.length === 0 &&
      fs.existsSync(path.join(ROOT, "data/pharmacy-approved-service-banks/banks/flu-vaccinations", `${FLU_BANK}.json`)),
    mutated.length ? `mutated=${mutated.join(",")}` : "four locked campaigns, assignments, Flu bank and staging bytes unchanged",
  );

  const failedIds = checks.filter((c) => !c.pass).map((c) => c.id);
  if (failedIds.length) {
    console.error(`FAIL ${failedIds.join(", ")}`);
    process.exit(1);
  }
  console.log("PASS product-owner-image-library-ui-connection-43c");
}

main();
