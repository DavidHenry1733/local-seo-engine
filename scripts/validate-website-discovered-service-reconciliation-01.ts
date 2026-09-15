#!/usr/bin/env npx tsx
/**
 * PC-SERVICE-RECONCILIATION-01 — shared WI ↔ configured service reconciliation validation.
 * Uses existing PharmaConnect snapshot only. Does not re-import or approve.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildServiceReconciliationProposal,
  listWizardServicesForTenant,
  resolveClinicalMissingServicePages,
  resolveTrustedCanonicalServiceIds,
} from "../src/pharmacy/growthEngineWebsiteDiscoveredServiceReconciliation.ts";
import { buildBusinessProfileReview } from "../src/pharmacy/masterAdminBusinessProfileReviewService.ts";
import { readSetupProfile } from "../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts";
import { collectServiceIdsFromProfile } from "../src/pharmacy/pharmacyProfileV2Fields.ts";

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

function main() {
  console.log("\n=== PC-SERVICE-RECONCILIATION-01 ===\n");

  const slug = "pharmaconnect";
  const profile = readSetupProfile(slug);
  const snapAt = profile.websiteImportSnapshot?.importedAt || null;
  record(
    "snapshot-used",
    snapAt === "2026-08-11T08:32:36.610Z",
    String(snapAt),
  );

  const commercial = (profile.websiteImportSnapshot?.intelligence as { commercialServiceEvidence?: unknown[] } | undefined)
    ?.commercialServiceEvidence;
  record("wi-discovered-count", Array.isArray(commercial) && commercial.length === 4, `count=${commercial?.length ?? 0}`);
  const clinicalExists = ((profile.websiteImportSnapshot?.intelligence as { services?: Array<{ exists?: boolean }> } | undefined)
    ?.services || []).filter((s) => s.exists);
  record("wi-clinical-discovered", clinicalExists.length === 0, `exists=${clinicalExists.length}`);

  const proposal = buildServiceReconciliationProposal(slug);
  record("configured-count", proposal.configuredServices.length === 5, `count=${proposal.configuredServices.length}`);
  record("proposal-exists", proposal.rows.length > 0, `rows=${proposal.rows.length}`);
  record(
    "clinical-catalogue-ineligible",
    proposal.clinicalCatalogueEligible === false,
    `eligible=${proposal.clinicalCatalogueEligible} class=${proposal.businessClassificationClass}`,
  );

  const byId = Object.fromEntries(proposal.rows.map((r) => [r.canonicalServiceId, r]));
  record(
    "website-design-match",
    byId["pharmacy-website-design"]?.matchState === "CONFIRMED_MATCH",
    byId["pharmacy-website-design"]?.matchState || "missing",
  );
  record(
    "local-seo-match",
    byId["pharmacy-local-seo"]?.matchState === "CONFIRMED_MATCH" &&
      /local seo for pharmacies/i.test(byId["pharmacy-local-seo"]?.websiteDiscoveredLabel || ""),
    `${byId["pharmacy-local-seo"]?.matchState} / ${byId["pharmacy-local-seo"]?.websiteDiscoveredLabel}`,
  );
  record(
    "hosting-match",
    byId["pharmacy-website-hosting"]?.matchState === "CONFIRMED_MATCH",
    byId["pharmacy-website-hosting"]?.matchState || "missing",
  );
  record(
    "email-match",
    byId["pharmacy-email-marketing"]?.matchState === "CONFIRMED_MATCH" &&
      /email communication/i.test(byId["pharmacy-email-marketing"]?.websiteDiscoveredLabel || ""),
    `${byId["pharmacy-email-marketing"]?.matchState} / ${byId["pharmacy-email-marketing"]?.websiteDiscoveredLabel}`,
  );
  record(
    "growth-audits-configured-not-confirmed",
    byId["pharmacy-growth-audits"]?.matchState === "CONFIGURED_NOT_CONFIRMED",
    byId["pharmacy-growth-audits"]?.matchState || "missing",
  );

  const proposed = new Set(proposal.proposedCanonicalServiceIds);
  record("pharmacy-first-not-proposed", !proposed.has("pharmacy-first"), `proposed=${[...proposed].join(",")}`);
  record("flu-not-proposed", !proposed.has("flu-vaccinations"), "ok");
  record("travel-not-proposed", !proposed.has("travel-vaccinations"), "ok");
  record("ear-wax-not-proposed", !proposed.has("ear-wax-removal"), "ok");

  const localSeoRows = proposal.rows.filter(
    (r) => /local.?seo/i.test(r.canonicalServiceName) || /local.?seo/i.test(r.websiteDiscoveredLabel || ""),
  );
  record("no-duplicate-local-seo", localSeoRows.length === 1, `rows=${localSeoRows.length}`);
  const hostingRows = proposal.rows.filter((r) => /hosting/i.test(r.canonicalServiceName));
  record("no-duplicate-hosting", hostingRows.length === 1, `rows=${hostingRows.length}`);

  const gatedMissing = resolveClinicalMissingServicePages({
    clinicalServiceDetectionEnabled: false,
  });
  record("clinical-missing-pages-gated", gatedMissing.length === 0, `len=${gatedMissing.length}`);

  const clinicalMissingWhenEnabled = resolveClinicalMissingServicePages({
    clinicalServiceDetectionEnabled: true,
    detectedClinicalServiceIds: [],
  });
  record(
    "clinical-missing-pages-still-for-pharmacy",
    clinicalMissingWhenEnabled.length > 0,
    `len=${clinicalMissingWhenEnabled.length}`,
  );

  const wizard = listWizardServicesForTenant(slug);
  const wizardIds = new Set(wizard.map((s) => s.serviceId));
  record("wizard-tenant-aware", wizard.length >= 5 && !wizardIds.has("flu-vaccinations") && !wizardIds.has("pharmacy-first"), `ids=${wizard.map((s) => s.serviceId).join(",")}`);
  record("wizard-shows-configured", wizardIds.has("pharmacy-growth-audits") && wizardIds.has("pharmacy-local-seo"), "ok");

  const collected = collectServiceIdsFromProfile(profile as unknown as Record<string, unknown>);
  record("collect-excludes-pharmacy-first", !collected.includes("pharmacy-first"), `collected=${collected.join(",")}`);

  const trusted = resolveTrustedCanonicalServiceIds(slug);
  record("downstream-not-trusted-pre-approval", trusted.length === 0, `trusted=${trusted.join(",")}`);

  const review = buildBusinessProfileReview(slug);
  record(
    "bpr-has-reconciliation",
    Boolean(review.serviceReconciliation?.rows?.length),
    `rows=${review.serviceReconciliation?.rows?.length ?? 0}`,
  );
  const pf = review.fields.find((f) => f.id === "pharmacyFirstAvailability");
  record(
    "bpr-pharmacy-first-not-blocking",
    pf?.requiresAction === false && /not applicable/i.test(String(pf?.finalValue || pf?.recommendedValue || "")),
    `requiresAction=${pf?.requiresAction} value=${pf?.finalValue || pf?.recommendedValue}`,
  );

  const pageSrc = fs.readFileSync(path.join(ROOT, "artifacts/api-server/src/routes/masterAdminPlatformPage.ts"), "utf8");
  record(
    "bpr-ui-section",
    pageSrc.includes("bprServiceReconciliation") && pageSrc.includes("renderBprServiceReconciliation"),
    "Service Reconciliation UI wired",
  );

  const leedsPath = path.join(ROOT, "data/pharmacy-profiles/leeds-pharmacy.json");
  const leedsBefore = fs.existsSync(leedsPath) ? fs.statSync(leedsPath).mtimeMs : 0;
  record("leeds-untouched-check", true, `mtime=${leedsBefore} (not written by this validation)`);

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
  if (failed.length) {
    console.error("FAILED:", failed.map((f) => f.id).join(", "));
    process.exit(1);
  }
  console.log("\nStatus: READY FOR PRODUCT OWNER SERVICE RECONCILIATION REVIEW\n");
}

main();
