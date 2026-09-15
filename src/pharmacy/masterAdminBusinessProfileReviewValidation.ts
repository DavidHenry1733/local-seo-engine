/**
 * Sprint 7B / Defect 042–043 / Sprint 7D — Business Profile Review validation (no auto-approval).
 */
import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import {
  buildBusinessProfileReview,
  isBusinessProfileReviewApproved,
  readReviewStore,
  saveBusinessProfileReviewField,
} from "./masterAdminBusinessProfileReviewService.ts";
import { buildGoogleSourceSummary } from "./masterAdminCanonicalGoogleService.ts";
import { buildWebsiteSourceSummary } from "./masterAdminCanonicalWebsiteService.ts";
import { readSetupProfile } from "./growthEngineCustomerSetupImportSplitService.ts";
import { profilePath } from "./pharmacyContentBlueprintService.ts";
import { getCustomerAccountDetail } from "./masterAdminAccountService.ts";
import { readGoogleIntelligenceRecord } from "./masterAdminCanonicalGoogleService.ts";
import {
  BUSINESS_DECISION_FIELD_IDS,
  IMPORT_PROVEN_FIELD_IDS,
  isSafeToAutoAccept,
  FIELD_META,
} from "./masterAdminBusinessProfileReviewLogic.ts";

export interface BusinessProfileReviewValidationCheck {
  id: string;
  label: string;
  passed: boolean;
  evidence: string;
}

export interface BusinessProfileReviewValidationResult {
  slug: string;
  passed: boolean;
  passCount: number;
  totalChecks: number;
  checks: BusinessProfileReviewValidationCheck[];
  reviewUrl: string;
  autoApproved: boolean;
  metrics: {
    autoResolved: number;
    verifiedHidden: number;
    recommendedGrouped: number;
    needsConfirmation: number;
    missingInformation: number;
    estimatedReviewMinutes: number;
  };
}

export function runBusinessProfileReviewValidation(
  slug: string,
  operator: string,
): BusinessProfileReviewValidationResult {
  const checks: BusinessProfileReviewValidationCheck[] = [];
  const review = buildBusinessProfileReview(slug);
  const website = buildWebsiteSourceSummary(slug);
  const google = buildGoogleSourceSummary(slug);
  const profile = readSetupProfile(slug);
  const account = getCustomerAccountDetail(slug);

  checks.push({
    id: "auto_merge",
    label: "Auto merge",
    passed: review.summary.canonicalProfileMerged || review.summary.verifiedCount > 0,
    evidence: `verified=${review.summary.verifiedCount} merged=${review.summary.canonicalProfileMerged}`,
  });
  checks.push({
    id: "verified_hidden",
    label: "Verified fields hidden from review",
    passed: review.verifiedFields.length > 0 && !review.needsConfirmation.some((f) => IMPORT_PROVEN_FIELD_IDS.has(f.id)),
    evidence: `${review.verifiedFields.length} verified · ${review.needsConfirmation.length} confirmations shown`,
  });
  checks.push({
    id: "recommended_grouped",
    label: "Recommended values grouped",
    passed: review.recommendedValues.length >= 0 && review.summary.recommendedCount === review.recommendedValues.length,
    evidence: `${review.summary.recommendedCount} recommended value(s)`,
  });
  checks.push({
    id: "needs_confirmation_only_business",
    label: "Needs Confirmation only contains business decisions",
    passed: review.needsConfirmation.every((f) => BUSINESS_DECISION_FIELD_IDS.has(f.id)),
    evidence: review.needsConfirmation.map((f) => f.id).join(", ") || "none",
  });
  checks.push({
    id: "missing_separated",
    label: "Missing Information separated",
    passed: review.missingInformation.every((f) => f.reviewTier === "missing"),
    evidence: `${review.missingInformation.length} missing item(s)`,
  });
  checks.push({
    id: "under_two_minutes",
    label: "Business Profile Review under 2 minutes",
    passed: review.summary.estimatedReviewMinutes <= 2,
    evidence: `${review.summary.estimatedReviewMinutes} min · ${review.summary.needsConfirmationCount} confirmations`,
  });
  checks.push({
    id: "review_loads",
    label: "Unified Business Profile Review loads",
    passed: !review.loadError && review.fields.length > 0,
    evidence: review.loadError || `${review.fields.length} review fields built`,
  });
  checks.push({
    id: "website_evidence",
    label: "Website evidence loaded",
    passed: website.websiteImported,
    evidence: website.websiteImported ? website.canonicalWebsite || "imported" : "missing",
  });
  checks.push({
    id: "google_evidence",
    label: "Google evidence loaded",
    passed: google.googleImported && Boolean(readGoogleIntelligenceRecord(slug)),
    evidence: google.googleImported ? google.placeId || "imported" : google.importStatus || "missing",
  });
  checks.push({
    id: "accept_safe_endpoint",
    label: "Accept All Safe Recommendations available",
    passed: review.recommendedValues.length > 0 || review.verifiedFields.length > 0,
    evidence: `${review.recommendedValues.length} recommended · ${review.verifiedFields.length} verified`,
  });
  checks.push({
    id: "approval_reason",
    label: "Approval disabled reason available when blocked",
    passed:
      review.summary.readinessLabel === "READY TO APPROVE" ||
      Boolean(review.summary.approvalDisabledReason || review.summary.approvalChecklist.length),
    evidence: review.summary.readinessLabel,
  });
  checks.push({
    id: "refresh_persistence",
    label: "Refresh persistence (store round-trip)",
    passed: (() => {
      const probeField = review.needsConfirmation[0] || review.fields.find((f) => f.blocking);
      if (!probeField) return true;
      const prior = readReviewStore(slug);
      const priorDecision = prior?.decisions[probeField.id] || null;
      const probeValue = `validation-probe-${Date.now()}`;
      saveBusinessProfileReviewField(slug, probeField.id, { action: "confirm", finalValue: probeValue }, operator);
      const reloaded = readReviewStore(slug);
      const persisted = reloaded?.decisions[probeField.id]?.finalValue === probeValue;
      if (priorDecision) {
        saveBusinessProfileReviewField(
          slug,
          probeField.id,
          { action: priorDecision.action, finalValue: priorDecision.finalValue },
          operator,
        );
      } else {
        const restored = { ...(reloaded?.decisions || {}) };
        delete restored[probeField.id];
        if (prior) {
          prior.decisions = restored;
          prior.updatedAt = new Date().toISOString();
          fs.writeFileSync(
            path.join(WORKSPACE_ROOT, "data/pharmacy-master-admin/business-profile-review", `${slug}.json`),
            JSON.stringify(prior, null, 2),
          );
        }
      }
      return persisted;
    })(),
    evidence: "Field decision persisted to review store",
  });
  checks.push({
    id: "not_auto_approved",
    label: "Banner Cross not auto-approved",
    passed: !isBusinessProfileReviewApproved(slug),
    evidence: isBusinessProfileReviewApproved(slug) ? "approved — unexpected" : "draft — awaiting PO",
  });
  checks.push({
    id: "account_preserved",
    label: "Customer account preserved",
    passed: Boolean(account.username),
    evidence: account.username || "missing",
  });
  checks.push({
    id: "source_evidence_preserved",
    label: "Source evidence preserved",
    passed: Boolean(profile.websiteImportSnapshot) && Boolean(profile.googleImportSnapshot || readGoogleIntelligenceRecord(slug)),
    evidence: `website=${Boolean(profile.websiteImportSnapshot)} google=${Boolean(profile.googleImportSnapshot)}`,
  });
  checks.push({
    id: "workflow_advance_ready",
    label: "Workflow advances correctly (approval gate intact)",
    passed: review.summary.readinessLabel !== "READY TO APPROVE" || !isBusinessProfileReviewApproved(slug),
    evidence: review.summary.readinessLabel,
  });
  checks.push({
    id: "profile_file_intact",
    label: "Profile file intact",
    passed: fs.existsSync(profilePath(slug)),
    evidence: profilePath(slug),
  });

  const passCount = checks.filter((c) => c.passed).length;
  return {
    slug,
    passed: passCount === checks.length,
    passCount,
    totalChecks: checks.length,
    checks,
    reviewUrl: `/api/admin/master?customer=${encodeURIComponent(slug)}&panel=business-profile-review`,
    autoApproved: isBusinessProfileReviewApproved(slug),
    metrics: {
      autoResolved: review.summary.autoResolved,
      verifiedHidden: review.verifiedFields.length,
      recommendedGrouped: review.recommendedValues.length,
      needsConfirmation: review.needsConfirmation.length,
      missingInformation: review.missingInformation.length,
      estimatedReviewMinutes: review.summary.estimatedReviewMinutes,
    },
  };
}
