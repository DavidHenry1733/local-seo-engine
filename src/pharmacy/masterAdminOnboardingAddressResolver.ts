/**
 * Onboarding Address Line 1 — generic resolver (operator > website > Google > record).
 */
import type { PharmacyProfileData } from "./pharmacyProfileSchema.ts";
import {
  buildGoogleDraftValues,
  buildWebsiteDraftValues,
} from "./growthEngineCustomerSetupImportSplitService.ts";

export interface ResolvedOnboardingAddressLine1 {
  value: string;
  source: string;
  confirmedByOperator: boolean;
}

function firstLine(value: string): string {
  return String(value || "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)[0] || "";
}

export function resolveOnboardingAddressLine1(data: PharmacyProfileData): ResolvedOnboardingAddressLine1 {
  const stored = String(data.addressLine1 || "").trim();
  const operatorConfirmed = Boolean(data.onboardingIntakeCompletedAt && stored);
  if (operatorConfirmed) {
    return { value: stored, source: "operator-onboarding", confirmedByOperator: true };
  }
  if (stored) {
    return { value: stored, source: "customer-record", confirmedByOperator: false };
  }

  const website = buildWebsiteDraftValues(data);
  const websiteAddress = firstLine(website.address);
  if (websiteAddress) {
    return { value: websiteAddress, source: "website-import", confirmedByOperator: false };
  }

  const google = buildGoogleDraftValues(data);
  const googleAddress = firstLine(google.address);
  if (googleAddress) {
    return { value: googleAddress, source: "google-import", confirmedByOperator: false };
  }

  const display = firstLine(String(data.displayAddress || ""));
  if (display) {
    return { value: display, source: "display-address", confirmedByOperator: false };
  }

  return { value: "", source: "none", confirmedByOperator: false };
}
