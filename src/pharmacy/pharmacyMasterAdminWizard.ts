/**
 * Master Admin onboarding wizard — testable state helpers for service selection flow.
 */
import { BENCHMARK_MASTER_SERVICE_IDS } from "./pharmacyMasterPublishConfig.ts";
import { getServicePublishMeta } from "./pharmacyMasterPublishConfig.ts";

export const WIZARD_SESSION_STORAGE_KEY = "pharmaconnect-master-admin-wizard-v1";

export interface MasterAdminWizardState {
  pharmacyName: string;
  website: string;
  contactEmail: string;
  telephone: string;
  growthPlanTier: "starter" | "professional" | "complete";
  primaryTown: string;
  coverageRadius: string;
  selectedAreas: unknown[];
  selectedServices: string[];
  isDemo: boolean;
  slug: string;
}

export function emptyWizardState(): MasterAdminWizardState {
  return {
    pharmacyName: "",
    website: "",
    contactEmail: "",
    telephone: "",
    growthPlanTier: "starter",
    primaryTown: "",
    coverageRadius: "5 miles",
    selectedAreas: [],
    selectedServices: [],
    isDemo: false,
    slug: "",
  };
}

/** Only merge service IDs when the Step 4 checkbox DOM is present. */
export function mergeSelectedServicesFromDom(
  state: MasterAdminWizardState,
  checkedServiceIds: string[],
  hasServiceCheckboxDom: boolean,
): MasterAdminWizardState {
  if (!hasServiceCheckboxDom) {
    return state;
  }
  return {
    ...state,
    selectedServices: [...checkedServiceIds],
  };
}

export function validateWizardStep(
  step: number,
  state: MasterAdminWizardState,
): string | null {
  if (step === 1) {
    if (!state.pharmacyName.trim()) return "Pharmacy name is required";
    if (!state.contactEmail.trim()) return "Contact email is required";
    if (!state.telephone.trim()) return "Telephone is required";
  }
  if (step === 3 && !state.primaryTown.trim()) {
    return "Primary town is required";
  }
  if (step === 4 && !state.selectedServices.length) {
    return "Select at least one service";
  }
  return null;
}

export function filterValidSelectedServices(serviceIds: string[]): string[] {
  return serviceIds.filter((id) =>
    BENCHMARK_MASTER_SERVICE_IDS.includes(id as (typeof BENCHMARK_MASTER_SERVICE_IDS)[number]),
  );
}

export function resolveSelectedServiceLabels(serviceIds: string[]): string[] {
  return filterValidSelectedServices(serviceIds).map((id) => {
    const meta = getServicePublishMeta(id);
    return meta?.serviceName || id;
  });
}

export function serializeWizardSession(step: number, state: MasterAdminWizardState): string {
  return JSON.stringify({ wizardStep: step, wizardData: state });
}

export function parseWizardSession(raw: string): { wizardStep: number; wizardData: MasterAdminWizardState } | null {
  try {
    const parsed = JSON.parse(raw) as {
      wizardStep?: number;
      wizardData?: Partial<MasterAdminWizardState>;
    };
    if (!parsed.wizardData || typeof parsed.wizardStep !== "number") return null;
    return {
      wizardStep: parsed.wizardStep,
      wizardData: { ...emptyWizardState(), ...parsed.wizardData },
    };
  } catch {
    return null;
  }
}

/**
 * Simulates wizard Next from Step 4 → 5 without the service-checkbox DOM.
 * Before fix: services were cleared. After fix: services must persist.
 */
export function simulateStepFourToFiveTransition(
  state: MasterAdminWizardState,
  checkedOnStepFour: string[],
): MasterAdminWizardState {
  const leavingStepFour = mergeSelectedServicesFromDom(state, checkedOnStepFour, true);
  const enteringStepFive = mergeSelectedServicesFromDom(leavingStepFour, [], false);
  return enteringStepFive;
}
