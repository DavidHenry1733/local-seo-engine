/**
 * Select a renderer-owned service notice from existing serviceDeliveryProfiles facts.
 * Unknown funding, nation, delivery or unconfirmed supply never become availability,
 * free pricing, or clinical claims.
 */
import type { ProfileServiceDeliveryProfile } from "./pharmacyProfileV2Fields.ts";
import {
  loadServiceNoticeCatalog,
  type ServiceNoticeRecord,
} from "./pharmacyServiceNoticeCatalog.ts";

export type ServiceNoticeSelectionMode = "profile-matched" | "none" | "presentation-draft";

export interface ServiceNoticeSelection {
  mode: ServiceNoticeSelectionMode;
  notice: ServiceNoticeRecord | null;
  reasons: string[];
}

function unknownish(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "boolean") return false;
  const raw = String(value).trim().toLowerCase();
  return raw === "" || raw === "unknown";
}

export function profileFactsBlockLiveNotice(facts: ProfileServiceDeliveryProfile | null | undefined): string[] {
  const reasons: string[] = [];
  if (!facts) {
    reasons.push("missing-service-facts");
    return reasons;
  }
  if (unknownish(facts.fundingModel)) reasons.push("funding-unknown");
  if (unknownish(facts.ukNation)) reasons.push("uk-nation-unknown");
  if (unknownish(facts.deliveryMode)) reasons.push("delivery-unknown");
  if (facts.prescribingSupplyConfirmed !== true) reasons.push("supply-not-confirmed");
  if (unknownish(facts.prescribingSupplyStatus) || facts.prescribingSupplyStatus === "none") {
    reasons.push("supply-unknown-or-none");
  }
  if (facts.consultationFee?.kind === "unknown" || facts.treatmentFee?.kind === "unknown") {
    reasons.push("fee-unknown-not-free");
  }
  if (facts.walkInAvailable == null) reasons.push("walk-in-unknown-not-available");
  return reasons;
}

export function selectServiceNoticeFromFacts(
  serviceId: string,
  facts: ProfileServiceDeliveryProfile | null | undefined,
): ServiceNoticeSelection {
  const blocked = profileFactsBlockLiveNotice(facts);
  if (!facts || blocked.includes("missing-service-facts") || blocked.includes("funding-unknown") || blocked.includes("uk-nation-unknown") || blocked.includes("delivery-unknown") || blocked.includes("supply-not-confirmed") || blocked.includes("supply-unknown-or-none")) {
    return { mode: "none", notice: null, reasons: blocked.length ? blocked : ["no-match"] };
  }

  const match = loadServiceNoticeCatalog().find((notice) => {
    if (notice.serviceId !== serviceId) return false;
    if (notice.ukNation !== facts.ukNation) return false;
    if (!notice.allowedFunding.includes(facts.fundingModel)) return false;
    if (!notice.allowedDeliveryModes.includes(facts.deliveryMode)) return false;
    if (notice.requiresPrescribingSupplyConfirmed && facts.prescribingSupplyConfirmed !== true) return false;
    if (!notice.allowedPrescribingSupply.includes(facts.prescribingSupplyStatus)) return false;
    return true;
  });

  if (!match) {
    return { mode: "none", notice: null, reasons: [...blocked, "catalog-no-match"] };
  }
  return { mode: "profile-matched", notice: match, reasons: blocked.filter((r) => r.startsWith("fee-") || r.startsWith("walk-in-")) };
}
