/**
 * CPR-12 — Read-only tenant-context validation (synthetic profiles, no HTML generation).
 */
import {
  buildTenantContextBinding,
  planImageSlotBindings,
  resolveBrandResolutionAudit,
  SERVICE_PAGE_GENERATION_SCOPE,
} from "../src/pharmacy/pharmacyServicePageTenantContextService.ts";
import type { ServicePageEvidenceField } from "../src/pharmacy/masterAdminCoreProductRecoveryModel.ts";

interface SyntheticProfile {
  slug: string;
  pharmacyName: string;
  town: string;
  brandPrimary: string;
  font: string;
}

const SYNTHETIC_PROFILES: SyntheticProfile[] = [
  { slug: "synthetic-alpha-pharmacy", pharmacyName: "Alpha Community Pharmacy", town: "Leeds", brandPrimary: "#004281", font: "Rubik" },
  { slug: "synthetic-beta-pharmacy", pharmacyName: "Beta Health Pharmacy", town: "Sheffield", brandPrimary: "#1CA9C9", font: "Inter" },
  { slug: "synthetic-gamma-pharmacy", pharmacyName: "Gamma Local Pharmacy", town: "Doncaster", brandPrimary: "#327c86", font: "Roboto" },
];

function syntheticEvidenceFields(profile: SyntheticProfile): ServicePageEvidenceField[] {
  return [
    { id: "pharmacyName", group: "business", label: "Pharmacy name", value: profile.pharmacyName, status: "confirmed", required: true, productOwnerDecided: true },
    { id: "townCity", group: "business", label: "Town", value: profile.town, status: "confirmed", required: true, productOwnerDecided: true },
    { id: "accessMethod", group: "service", label: "Access", value: "Walk-in and telephone", status: "confirmed", required: true, productOwnerDecided: true },
    { id: "phone", group: "business", label: "Phone", value: "01111111111", status: "confirmed", required: true, productOwnerDecided: true },
  ] as ServicePageEvidenceField[];
}

function runSyntheticValidation(): { ok: boolean; details: string[] } {
  const details: string[] = [];
  const bundlesByProfile = SYNTHETIC_PROFILES.map((p) => {
    const fields = syntheticEvidenceFields(p);
    const bundles = SECTION_EVIDENCE_MAP.map((def) => ({
      sectionId: def.sectionId,
      facts: def.evidenceFieldIds.map((id) => fields.find((f) => f.id === id)?.value || "").filter(Boolean),
    }));
    return { slug: p.slug, bundles, brand: p.brandPrimary, fields };
  });

  const bundleTexts = bundlesByProfile.map((b) => JSON.stringify(b.bundles));
  const distinctBundles = new Set(bundleTexts).size === bundleTexts.length;
  details.push(`section-bundles-distinct: ${distinctBundles}`);
  if (!distinctBundles) return { ok: false, details };

  const brandsDistinct =
    new Set(SYNTHETIC_PROFILES.map((p) => p.brandPrimary)).size === SYNTHETIC_PROFILES.length;
  details.push(`brand-inputs-distinct: ${brandsDistinct}`);

  const neutralAudit = resolveBrandResolutionAudit("synthetic-no-brand-pharmacy");
  const neutralOk =
    neutralAudit.fallbackReason?.includes("neutral") ||
    neutralAudit.colourSource === "pharmaconnect-neutral-default";
  details.push(`neutral-fallback-not-brook: ${neutralOk}`);
  if (!neutralOk) return { ok: false, details };

  const slots = planImageSlotBindings("cpa01r-clean-journey-pharmacy", "pharmacy-first");
  const fourSlots = slots.length === 4 && slots.every((s) => s.renderedSlot);
  details.push(`four-image-slots-mapped: ${fourSlots}`);
  if (!fourSlots) return { ok: false, details };

  const binding = buildTenantContextBinding("cpa01r-clean-journey-pharmacy", "pharmacy-first", {
    scope: SERVICE_PAGE_GENERATION_SCOPE.SERVICE_PAGE_ONLY,
  });
  const noHardCode =
    binding.resolvedBusinessName !== "Brook Pharmacy" &&
    binding.resolvedSlug === "cpa01r-clean-journey-pharmacy";
  details.push(`tenant-binding-generic: ${noHardCode}`);
  if (!noHardCode) return { ok: false, details };

  return { ok: true, details };
}

const SECTION_EVIDENCE_MAP = [
  { sectionId: "hero", evidenceFieldIds: ["pharmacyName", "townCity", "accessMethod", "phone"] },
  { sectionId: "local", evidenceFieldIds: ["townCity"] },
  { sectionId: "cta", evidenceFieldIds: ["phone", "accessMethod"] },
];

const result = runSyntheticValidation();
console.log(JSON.stringify({ status: result.ok ? "PASS" : "FAIL", details: result.details }, null, 2));
process.exit(result.ok ? 0 : 1);
