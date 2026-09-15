#!/usr/bin/env npx tsx
/**
 * PC-BUSINESS-PROFILE-APPLICABILITY-01
 * Context-aware BPR required-field applicability. Read-only against live PharmaConnect
 * profile/snapshot. Clinical behaviour validated via shared eligibility helper (no Leeds mutation).
 */
import {
  buildServiceReconciliationProposal,
  isClinicalCatalogueEligible,
} from "../src/pharmacy/growthEngineWebsiteDiscoveredServiceReconciliation.ts";
import {
  resolveBprFieldApplicability,
  type BprApplicabilityContext,
} from "../src/pharmacy/masterAdminBusinessProfileReviewApplicability.ts";
import { buildBusinessProfileReview } from "../src/pharmacy/masterAdminBusinessProfileReviewService.ts";
import { readSetupProfile } from "../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts";

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
  console.log("\n=== PC-BUSINESS-PROFILE-APPLICABILITY-01 ===\n");

  const slug = "pharmaconnect";
  const profile = readSetupProfile(slug);
  const proposal = buildServiceReconciliationProposal(slug);
  const review = buildBusinessProfileReview(slug);
  const byId = Object.fromEntries(review.fields.map((f) => [f.id, f]));

  record(
    "snapshot-untouched",
    (profile.websiteImportSnapshot?.importedAt || null) === "2026-08-11T08:32:36.610Z",
    String(profile.websiteImportSnapshot?.importedAt || null),
  );
  record(
    "clinical-ineligible",
    proposal.clinicalCatalogueEligible === false,
    `eligible=${proposal.clinicalCatalogueEligible} class=${proposal.businessClassificationClass}`,
  );
  record(
    "market-scope-national",
    String(profile.marketScope || "").toLowerCase() === "national",
    String(profile.marketScope),
  );

  const consultation = byId.consultationRoom;
  const appointment = byId.appointmentMethod;
  const hours = byId.openingHoursSummary;
  const cta = byId.primaryCtaDestination;
  const pharmacyFirst = byId.pharmacyFirstAvailability;

  record(
    "consultation-na",
    consultation?.applicability === "not_applicable" && consultation.requiresAction === false,
    `applicability=${consultation?.applicability} requiresAction=${consultation?.requiresAction}`,
  );
  record(
    "appointment-na",
    appointment?.applicability === "not_applicable" && appointment.requiresAction === false,
    `applicability=${appointment?.applicability} requiresAction=${appointment?.requiresAction}`,
  );
  record(
    "hours-optional",
    hours?.applicability === "optional" && hours.requiresAction === false && hours.blocking === false,
    `applicability=${hours?.applicability} requiresAction=${hours?.requiresAction} blocking=${hours?.blocking}`,
  );
  record(
    "cta-required-reviewable",
    cta?.applicability === "required" && (cta.requiresAction === true || Boolean(cta.finalValue)),
    `applicability=${cta?.applicability} requiresAction=${cta?.requiresAction} final=${cta?.finalValue || "null"}`,
  );
  record(
    "pharmacy-first-na",
    pharmacyFirst?.applicability === "not_applicable" || /not applicable|incompatible/i.test(pharmacyFirst?.displayStatus || ""),
    `applicability=${pharmacyFirst?.applicability} status=${pharmacyFirst?.displayStatus}`,
  );

  const blockers = review.summary.blockingFields || [];
  const blockerText = blockers.join(" | ").toLowerCase();
  record(
    "consultation-not-blocker",
    !/consultation/i.test(blockerText),
    blockers.join("; ") || "NONE",
  );
  record(
    "appointment-not-blocker",
    !/appointment|walk-in/i.test(blockerText),
    blockers.join("; ") || "NONE",
  );
  record(
    "hours-not-blocker",
    !/opening hours/i.test(blockerText),
    blockers.join("; ") || "NONE",
  );
  record(
    "na-not-in-action-required",
    !(review.needsConfirmation || []).some((f) => f.applicability === "not_applicable") &&
      !(review.missingInformation || []).some((f) => f.applicability === "not_applicable"),
    `confirm=${(review.needsConfirmation || []).length} missing=${(review.missingInformation || []).length}`,
  );
  record(
    "service-reconciliation-present",
    Boolean(review.serviceReconciliation?.rows?.length),
    `rows=${review.serviceReconciliation?.rows?.length || 0}`,
  );
  const pfRow = (review.serviceReconciliation?.rows || []).find((r) => r.canonicalServiceId === "pharmacy-first");
  record(
    "pharmacy-first-excluded",
    pfRow?.proposedForCanonical === false || /incompatible|excluded/i.test(pfRow?.matchStateLabel || pfRow?.matchState || ""),
    `${pfRow?.matchState} proposed=${pfRow?.proposedForCanonical}`,
  );
  record(
    "google-deferred-nonblocking",
    /defer|not connected|optional/i.test(String(review.summary.googleSectionStatus || review.summary.googleImportStatus || "")) ||
      !/missing/i.test(String(review.summary.googleImportStatus || "")),
    `status=${review.summary.googleSectionStatus} import=${review.summary.googleImportStatus}`,
  );
  record(
    "profile-not-approved",
    review.summary.approvalStatus !== "approved",
    String(review.summary.approvalStatus),
  );
  record(
    "no-fake-consultation",
    !profile.consultationRoomAvailable && consultation?.finalValue === "Not applicable",
    `profile.consultationRoomAvailable=${profile.consultationRoomAvailable} field=${consultation?.finalValue}`,
  );
  record(
    "no-fake-hours",
    !String(profile.openingHours || "").trim() || hours?.applicability === "optional",
    `openingHours=${profile.openingHours || "(empty)"}`,
  );

  // Clinical fixture — shared helper only (no Leeds data mutation)
  const clinicalCtx: BprApplicabilityContext = {
    clinicalCatalogueEligible: true,
    businessClassificationClass: "community_pharmacy",
    clinicalServiceDetectionEnabled: true,
    marketScope: "local",
  };
  record(
    "clinical-eligibility-helper",
    isClinicalCatalogueEligible({
      clinicalServiceDetectionEnabled: true,
      businessClassificationClass: "community_pharmacy",
      configuredServiceIds: ["pharmacy-first", "blood-pressure"],
    }) === true,
    "community_pharmacy + clinical detection => eligible",
  );
  record(
    "clinical-consultation-required",
    resolveBprFieldApplicability("consultationRoom", clinicalCtx) === "required",
    String(resolveBprFieldApplicability("consultationRoom", clinicalCtx)),
  );
  record(
    "clinical-appointment-required",
    resolveBprFieldApplicability("appointmentMethod", clinicalCtx) === "required",
    String(resolveBprFieldApplicability("appointmentMethod", clinicalCtx)),
  );
  record(
    "clinical-hours-required",
    resolveBprFieldApplicability("openingHoursSummary", clinicalCtx) === "required",
    String(resolveBprFieldApplicability("openingHoursSummary", clinicalCtx)),
  );
  record(
    "clinical-cta-required",
    resolveBprFieldApplicability("primaryCtaDestination", clinicalCtx) === "required",
    String(resolveBprFieldApplicability("primaryCtaDestination", clinicalCtx)),
  );
  record(
    "national-alone-not-hours-na",
    resolveBprFieldApplicability("openingHoursSummary", {
      clinicalCatalogueEligible: true,
      businessClassificationClass: "community_pharmacy",
      marketScope: "national",
    }) === "required",
    "NATIONAL + clinical still requires hours",
  );

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${failed.length ? "FAIL" : "PASS"} — ${checks.length - failed.length}/${checks.length} checks\n`);
  if (failed.length) {
    for (const f of failed) console.log(`  FAIL ${f.id}: ${f.detail}`);
    process.exit(1);
  }
}

main();
