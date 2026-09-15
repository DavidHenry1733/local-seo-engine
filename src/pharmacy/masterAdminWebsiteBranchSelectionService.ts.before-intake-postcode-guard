/**
 * CPR-RESET-04 — branch selection, evidence application, and customer reset.
 * National market-scope tenants use canonical website identity — branch selection does not block.
 */
import crypto from "node:crypto";
import { readSetupProfile, writeSetupProfile } from "./growthEngineCustomerSetupImportSplitService.ts";
import {
  applyWebsiteImportDebugAfterBranchSelection,
  finalizeWebsiteImportAfterBranchSelection,
} from "./masterAdminWebsiteImportBranchCompletionService.ts";
import { detectMultiLocationBranches } from "./masterAdminWebsiteBranchDetectionService.ts";
import { fetchWebsiteHtml } from "./growthEngineWebsiteCrawler.ts";
import { recordMasterAdminAudit } from "./masterAdminAuditService.ts";
import { safeAdminSlug } from "./pharmacyMasterAdminService.ts";
import type { WebsiteImportSnapshot } from "./pharmacyProfileSchema.ts";
import type {
  DetectedWebsiteBranch,
  GoogleBranchMatchStatus,
  WebsiteBranchResolution,
  WebsiteBranchResolutionStatus,
  WebsiteBranchSelectionPayload,
} from "./masterAdminWebsiteBranchResolutionModel.ts";
import type { WebsiteIntelligenceImportV2 } from "./growthEngineWebsiteIntelligenceImportV2Model.ts";
import { isNationalMarketScope } from "./masterAdminMarketScopeService.ts";

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function normalizePostcode(raw: string): string {
  const pc = str(raw).toUpperCase();
  return pc.replace(/\s+/, " ");
}

function normalizePhone(raw: string): string {
  return str(raw).replace(/\s+/g, " ");
}

function fieldValue(selected: string, sourceUrl: string, method: string, confidence: number) {
  return {
    selected,
    confidence,
    candidates: selected ? [{ value: selected, confidence, sourceUrl, detectionMethod: method }] : [],
    evidence: selected
      ? { sourceUrl, confidence, detectionMethod: method, detectedAt: new Date().toISOString() }
      : null,
  };
}

function emptyBranchResolution(): WebsiteBranchResolution {
  return {
    status: "none",
    detectedAt: new Date().toISOString(),
    selectedAt: null,
    selectedBy: null,
    parentBrand: {
      tradingName: "",
      parentWebsite: "",
      logoUrl: "",
      brandPrimaryColor: "",
      brandSecondaryColor: "",
      brandAccentColor: "",
    },
    detectedBranches: [],
    selectedBranchId: null,
    selectedBranch: null,
    rawImportPreserved: false,
    googleBranchMatchStatus: "none",
    googleBranchMatchNotes: [],
  };
}

export function readWebsiteBranchResolution(slug: string): WebsiteBranchResolution | null {
  const data = readSetupProfile(slug);
  const raw = (data as Record<string, unknown>).websiteBranchResolution;
  if (!raw || typeof raw !== "object") return null;
  return raw as WebsiteBranchResolution;
}

function googleCandidatesFromProfile(data: ReturnType<typeof readSetupProfile>): Array<Record<string, unknown>> {
  const fromSnap = (data.googleImportSnapshot as { candidates?: Array<Record<string, unknown>> } | null)?.candidates;
  if (fromSnap?.length) return fromSnap;
  return (data.customerSetupGoogleCandidates || []) as Array<Record<string, unknown>>;
}

function clearUnconfirmedBranchFields(snapshot: WebsiteImportSnapshot): WebsiteImportSnapshot {
  const intel = snapshot.intelligence;
  const clearedIntel = intel
    ? {
        ...intel,
        business: {
          ...intel.business,
          businessName: fieldValue("", "", "pending-branch-selection", 0),
          phone: fieldValue("", "", "pending-branch-selection", 0),
          email: fieldValue("", "", "pending-branch-selection", 0),
          address: fieldValue("", "", "pending-branch-selection", 0),
          town: fieldValue("", "", "pending-branch-selection", 0),
          postcode: fieldValue("", "", "pending-branch-selection", 0),
          openingHours: fieldValue("", "", "pending-branch-selection", 0),
          googleMapsLink: fieldValue("", "", "pending-branch-selection", 0),
        },
      }
    : null;

  return {
    ...snapshot,
    status: "branch_selection_required",
    message: "Multiple pharmacy branches detected — select the branch being onboarded.",
    phone: "",
    email: "",
    address: "",
    town: "",
    postcode: "",
    openingHours: "",
    intelligence: clearedIntel,
  };
}

function nationalParentBrand(
  data: ReturnType<typeof readSetupProfile>,
  snapshot: WebsiteImportSnapshot,
  detectionParent?: WebsiteBranchResolution["parentBrand"],
): WebsiteBranchResolution["parentBrand"] {
  const intel = snapshot.intelligence;
  return {
    tradingName: str(detectionParent?.tradingName || data.pharmacyName || data.tradingName),
    parentWebsite: str(detectionParent?.parentWebsite || snapshot.websiteUrl || data.website),
    logoUrl: str(detectionParent?.logoUrl || snapshot.logoUrl || intel?.identity.logoUrl || data.logoUrl),
    brandPrimaryColor: str(
      detectionParent?.brandPrimaryColor || snapshot.brandPrimaryColor || intel?.identity.brandPrimaryColor,
    ),
    brandSecondaryColor: str(
      detectionParent?.brandSecondaryColor || snapshot.brandSecondaryColor || intel?.identity.brandSecondaryColor,
    ),
    brandAccentColor: str(
      detectionParent?.brandAccentColor || snapshot.brandAccentColor || intel?.identity.brandAccentColor,
    ),
  };
}

/** NATIONAL: canonical root website is the business — never enter branch_selection_required. */
function applyNationalWebsiteIdentityResolution(
  slug: string,
  snapshot: WebsiteImportSnapshot,
  parentBrand: WebsiteBranchResolution["parentBrand"],
): { snapshot: WebsiteImportSnapshot; resolution: WebsiteBranchResolution } {
  const data = readSetupProfile(slug);
  const canonicalName = str(data.pharmacyName || parentBrand.tradingName);
  const canonicalWebsite = str(data.website || snapshot.websiteUrl || parentBrand.parentWebsite);
  const intel = snapshot.intelligence;
  const sourceUrl = canonicalWebsite || snapshot.websiteUrl;

  const restoredIntel: WebsiteIntelligenceImportV2 | null = intel
    ? {
        ...intel,
        identity: {
          ...intel.identity,
          websiteUrl: intel.identity.websiteUrl || canonicalWebsite,
          resolvedUrl: intel.identity.resolvedUrl || canonicalWebsite,
          logoUrl: parentBrand.logoUrl || intel.identity.logoUrl,
          brandPrimaryColor: parentBrand.brandPrimaryColor || intel.identity.brandPrimaryColor,
          brandSecondaryColor: parentBrand.brandSecondaryColor || intel.identity.brandSecondaryColor,
          brandAccentColor: parentBrand.brandAccentColor || intel.identity.brandAccentColor,
        },
        business: {
          ...intel.business,
          // Canonical national identity — not an internal service/article page title.
          businessName: canonicalName
            ? {
                selected: canonicalName,
                confidence: 90,
                candidates: [
                  {
                    value: canonicalName,
                    confidence: 90,
                    sourceUrl,
                    detectionMethod: "canonical-national-identity",
                  },
                ],
                evidence: {
                  sourceUrl,
                  confidence: 90,
                  detectionMethod: "canonical-national-identity",
                  detectedAt: new Date().toISOString(),
                },
                selectionReasoning:
                  "National marketScope: canonical tenant/business identity and submitted root website used; internal pages retained as evidence only.",
              }
            : intel.business.businessName,
        },
      }
    : null;

  const resolution: WebsiteBranchResolution = {
    ...emptyBranchResolution(),
    status: "none",
    detectedAt: new Date().toISOString(),
    parentBrand: {
      ...parentBrand,
      tradingName: canonicalName || parentBrand.tradingName,
      parentWebsite: canonicalWebsite || parentBrand.parentWebsite,
    },
    // Do not treat internal service/content pages as selectable business branches for NATIONAL.
    detectedBranches: [],
    rawImportPreserved: true,
    googleBranchMatchStatus: "none",
    googleBranchMatchNotes: [
      "National marketScope — branch selection not applicable; canonical website identity used.",
    ],
  };

  return {
    snapshot: {
      ...snapshot,
      status: "imported",
      message: "Website Intelligence imported (national market — branch selection not applicable).",
      websiteUrl: canonicalWebsite || snapshot.websiteUrl,
      logoUrl: parentBrand.logoUrl || snapshot.logoUrl,
      brandPrimaryColor: parentBrand.brandPrimaryColor || snapshot.brandPrimaryColor,
      brandSecondaryColor: parentBrand.brandSecondaryColor || snapshot.brandSecondaryColor,
      brandAccentColor: parentBrand.brandAccentColor || snapshot.brandAccentColor,
      intelligence: restoredIntel,
    },
    resolution,
  };
}

/**
 * Re-evaluate an existing import for NATIONAL tenants without re-crawling.
 * Clears stale branch_selection_required created before market-scope gating.
 */
export function reconcileNationalWebsiteBranchResolution(slug: string): boolean {
  const safe = safeAdminSlug(slug);
  const data = readSetupProfile(safe);
  if (!isNationalMarketScope(safe, data)) return false;
  const snap = data.websiteImportSnapshot as WebsiteImportSnapshot | null;
  if (!snap?.intelligence) return false;
  const current = readWebsiteBranchResolution(safe);
  const needs =
    snap.status === "branch_selection_required" ||
    current?.status === "branch_selection_required" ||
    current?.status === "none_of_these_branches" ||
    (current?.detectedBranches?.length || 0) > 0;
  if (!needs && snap.status === "imported") return false;

  const parentBrand = nationalParentBrand(data, snap, current?.parentBrand);
  const { snapshot, resolution } = applyNationalWebsiteIdentityResolution(safe, snap, parentBrand);
  writeSetupProfile(safe, {
    ...data,
    websiteImportSnapshot: snapshot,
    websiteBranchResolution: resolution,
  });
  return true;
}

export function applyBranchDetectionToImport(
  slug: string,
  snapshot: WebsiteImportSnapshot,
  homepageHtml: string,
): { snapshot: WebsiteImportSnapshot; resolution: WebsiteBranchResolution } {
  const data = readSetupProfile(slug);
  const intel = snapshot.intelligence;
  if (!intel) {
    return { snapshot, resolution: { ...emptyBranchResolution(), status: "none" } };
  }

  const detection = detectMultiLocationBranches({
    websiteUrl: snapshot.websiteUrl,
    homepageHtml,
    intelligence: intel,
    submittedBusinessName: str(data.pharmacyName),
    googleCandidates: googleCandidatesFromProfile(data),
  });

  // Market Scope gate: NATIONAL onboarding is never blocked by branch candidates.
  if (isNationalMarketScope(slug, data)) {
    return applyNationalWebsiteIdentityResolution(
      slug,
      snapshot,
      nationalParentBrand(data, snapshot, detection.parentBrand),
    );
  }

  if (!detection.requiresSelection) {
    const resolution: WebsiteBranchResolution = {
      ...emptyBranchResolution(),
      status: "none",
      detectedAt: new Date().toISOString(),
      parentBrand: detection.parentBrand,
      detectedBranches: detection.detectedBranches,
      rawImportPreserved: true,
    };
    return { snapshot, resolution };
  }

  const resolution: WebsiteBranchResolution = {
    status: "branch_selection_required",
    detectedAt: new Date().toISOString(),
    selectedAt: null,
    selectedBy: null,
    parentBrand: detection.parentBrand,
    detectedBranches: detection.detectedBranches,
    selectedBranchId: null,
    selectedBranch: null,
    rawImportPreserved: true,
    googleBranchMatchStatus: "pending",
    googleBranchMatchNotes: ["Branch selection required before Google comparison can be confirmed."],
  };

  return {
    snapshot: clearUnconfirmedBranchFields(snapshot),
    resolution,
  };
}

function applyBranchToSnapshot(snapshot: WebsiteImportSnapshot, branch: DetectedWebsiteBranch, parentBrand: WebsiteBranchResolution["parentBrand"]): WebsiteImportSnapshot {
  const intel = snapshot.intelligence;
  const sourceUrl = branch.branchUrl || snapshot.websiteUrl;
  const updatedIntel: WebsiteIntelligenceImportV2 | null = intel
    ? {
        ...intel,
        identity: {
          ...intel.identity,
          websiteUrl: branch.branchUrl || intel.identity.websiteUrl,
          resolvedUrl: branch.branchUrl || intel.identity.resolvedUrl,
          logoUrl: branch.logoUrl || parentBrand.logoUrl || intel.identity.logoUrl,
          brandPrimaryColor: parentBrand.brandPrimaryColor || intel.identity.brandPrimaryColor,
          brandSecondaryColor: parentBrand.brandSecondaryColor || intel.identity.brandSecondaryColor,
          brandAccentColor: parentBrand.brandAccentColor || intel.identity.brandAccentColor,
        },
        business: {
          ...intel.business,
          businessName: fieldValue(branch.branchName, sourceUrl, "branch-selection", 95),
          phone: fieldValue(branch.phone, sourceUrl, "branch-selection", 95),
          email: fieldValue(branch.email, sourceUrl, "branch-selection", branch.email ? 90 : 0),
          address: fieldValue(branch.addressLine1, sourceUrl, "branch-selection", 95),
          town: fieldValue(branch.town, sourceUrl, "branch-selection", branch.town ? 95 : 0),
          postcode: fieldValue(branch.postcode, sourceUrl, "branch-selection", 95),
          openingHours: fieldValue(branch.openingHours, sourceUrl, "branch-selection", branch.openingHours ? 85 : 0),
          googleMapsLink: branch.googlePlaceId
            ? fieldValue(`place:${branch.googlePlaceId}`, sourceUrl, "branch-google-match", 90)
            : intel.business.googleMapsLink,
        },
      }
    : null;

  return {
    ...snapshot,
    status: "imported",
    message: `Branch selected: ${branch.branchName}`,
    websiteUrl: branch.branchUrl || snapshot.websiteUrl,
    phone: branch.phone,
    email: branch.email,
    address: branch.addressLine1,
    town: branch.town,
    postcode: branch.postcode,
    openingHours: branch.openingHours,
    logoUrl: branch.logoUrl || parentBrand.logoUrl || snapshot.logoUrl,
    brandPrimaryColor: parentBrand.brandPrimaryColor || snapshot.brandPrimaryColor,
    brandSecondaryColor: parentBrand.brandSecondaryColor || snapshot.brandSecondaryColor,
    brandAccentColor: parentBrand.brandAccentColor || snapshot.brandAccentColor,
    intelligence: updatedIntel,
  };
}

function compareBranchToGoogle(
  branch: DetectedWebsiteBranch,
  data: ReturnType<typeof readSetupProfile>,
): { status: GoogleBranchMatchStatus; notes: string[] } {
  const notes: string[] = [];
  const googlePlaceId = str(data.googlePlaceId);
  const googleIdentity = readGoogleIdentityPlace(data);
  const selectedPlaceId = googlePlaceId || googleIdentity.placeId;

  if (!selectedPlaceId) {
    notes.push("No Google Place ID confirmed yet — match Google profile after branch selection.");
    return { status: "pending", notes };
  }

  if (branch.googlePlaceId && branch.googlePlaceId !== selectedPlaceId) {
    notes.push(`Selected branch Google candidate (${branch.googlePlaceId}) differs from confirmed Place ID (${selectedPlaceId}).`);
  }

  const branchPostcode = normalizePostcode(branch.postcode).replace(/\s/g, "");
  const googlePostcode = normalizePostcode(googleIdentity.postcode || str(data.postcode)).replace(/\s/g, "");
  if (branchPostcode && googlePostcode && branchPostcode !== googlePostcode) {
    notes.push(`Postcode mismatch: branch ${branch.postcode} vs Google ${googleIdentity.postcode || data.postcode}`);
    return { status: "mismatch", notes };
  }

  if (branch.googlePlaceId && branch.googlePlaceId === selectedPlaceId) {
    notes.push("Branch Google candidate matches confirmed Place ID.");
    return { status: "matched", notes };
  }

  if (branchPostcode && googlePostcode && branchPostcode === googlePostcode) {
    notes.push("Postcode matches confirmed Google profile.");
    return { status: "matched", notes };
  }

  notes.push("Review branch vs Google profile — automatic match not confirmed.");
  return { status: "pending", notes };
}

function readGoogleIdentityPlace(data: ReturnType<typeof readSetupProfile>): {
  placeId: string;
  postcode: string;
  businessName: string;
} {
  const snap = data.googleImportSnapshot as { placeId?: string; postcode?: string; businessName?: string } | null;
  return {
    placeId: str(snap?.placeId || data.googlePlaceId),
    postcode: str(snap?.postcode),
    businessName: str(snap?.businessName),
  };
}

export function buildWebsiteBranchSelectionPayload(slug: string): WebsiteBranchSelectionPayload {
  const safe = safeAdminSlug(slug);
  // Persist NATIONAL bypass for stale pre-gate imports (no crawl).
  reconcileNationalWebsiteBranchResolution(safe);
  const data = readSetupProfile(safe);
  const resolution = readWebsiteBranchResolution(safe) || emptyBranchResolution();
  const national = isNationalMarketScope(safe, data);
  const requiresSelection =
    !national && resolution.status === "branch_selection_required";
  return {
    resolution: national
      ? {
          ...resolution,
          status: resolution.status === "branch_selection_required" ? "none" : resolution.status,
          detectedBranches: resolution.status === "branch_selection_required" ? [] : resolution.detectedBranches,
        }
      : resolution,
    requiresSelection,
    detectedBranchCount: national ? 0 : resolution.detectedBranches.length,
    selectedBranchId: resolution.selectedBranchId,
    googleBranchMatchStatus: resolution.googleBranchMatchStatus,
    googleBranchMatchNotes: national
      ? ["National marketScope — branch selection not applicable."]
      : resolution.googleBranchMatchNotes,
  };
}

function syncSetupProfileFromSelectedBranch(
  data: ReturnType<typeof readSetupProfile>,
  branch: DetectedWebsiteBranch,
  snapshot: WebsiteImportSnapshot,
): ReturnType<typeof readSetupProfile> {
  return {
    ...data,
    pharmacyName: branch.branchName || data.pharmacyName,
    tradingName: branch.branchName || data.tradingName,
    phone: branch.phone || data.phone,
    email: branch.email || data.email,
    businessEmail: branch.email || data.businessEmail,
    addressLine1: branch.addressLine1 || data.addressLine1,
    addressLine2: branch.addressLine2 || data.addressLine2,
    townCity: branch.town || data.townCity,
    primaryTown: branch.town || data.primaryTown,
    postcode: branch.postcode || data.postcode,
    openingHours: branch.openingHours || data.openingHours,
    logoUrl: snapshot.logoUrl || branch.logoUrl || data.logoUrl,
    website: branch.branchUrl || data.website,
    googlePlaceId: branch.googlePlaceId || data.googlePlaceId,
    websiteImportSnapshot: snapshot,
  };
}

export function confirmManualWebsiteBranch(
  slug: string,
  input: {
    branchName: string;
    addressLine1: string;
    town: string;
    postcode: string;
    phone: string;
    branchUrl: string;
    email?: string;
  },
  operator: string,
): WebsiteBranchSelectionPayload {
  const safe = safeAdminSlug(slug);
  const data = readSetupProfile(safe);
  const resolution = readWebsiteBranchResolution(safe);
  if (!resolution || resolution.status !== "branch_selection_required") {
    throw new Error("Branch selection is not required for this customer.");
  }
  const snap = data.websiteImportSnapshot as WebsiteImportSnapshot | null;
  if (!snap) throw new Error("Website import snapshot missing.");

  const branchId = `manual-${crypto.randomUUID().slice(0, 8)}`;
  const branch: DetectedWebsiteBranch = {
    branchId,
    branchName: str(input.branchName),
    parentBrandName: resolution.parentBrand.tradingName,
    addressLine1: str(input.addressLine1),
    addressLine2: "",
    town: str(input.town),
    postcode: str(input.postcode),
    phone: str(input.phone),
    email: str(input.email || ""),
    branchUrl: str(input.branchUrl) || snap.websiteUrl,
    logoUrl: resolution.parentBrand.logoUrl || snap.logoUrl || "",
    openingHours: "",
    services: [],
    googlePlaceId: null,
    googleBusinessName: null,
    googleAddress: null,
    googleMatchConfidence: null,
    evidenceSources: [{ sourceUrl: snap.websiteUrl, detectionMethod: "manual-branch-confirmation" }],
    detectionSignals: ["manual-branch-confirmation"],
  };

  return selectWebsiteBranch(safe, branchId, operator, branch);
}

export function selectWebsiteBranch(
  slug: string,
  branchId: string,
  operator: string,
  branchOverride?: DetectedWebsiteBranch,
): WebsiteBranchSelectionPayload {
  const safe = safeAdminSlug(slug);
  const data = readSetupProfile(safe);
  const resolution = readWebsiteBranchResolution(safe);
  if (!resolution || resolution.status !== "branch_selection_required") {
    throw new Error("Branch selection is not required for this customer.");
  }

  const branch =
    branchOverride && branchOverride.branchId === branchId
      ? branchOverride
      : resolution.detectedBranches.find((b) => b.branchId === branchId);
  if (!branch) throw new Error("Branch not found.");

  const snap = data.websiteImportSnapshot as WebsiteImportSnapshot | null;
  if (!snap) throw new Error("Website import snapshot missing.");

  const googleMatch = compareBranchToGoogle(branch, data);
  const updatedResolution: WebsiteBranchResolution = {
    ...resolution,
    status: "branch_selected",
    selectedAt: new Date().toISOString(),
    selectedBy: operator,
    selectedBranchId: branchId,
    selectedBranch: branch,
    googleBranchMatchStatus: googleMatch.status,
    googleBranchMatchNotes: googleMatch.notes,
  };

  const updatedSnapshot = applyBranchToSnapshot(snap, branch, resolution.parentBrand);

  const mergedProfile = syncSetupProfileFromSelectedBranch(data, branch, updatedSnapshot);
  writeSetupProfile(safe, {
    ...applyWebsiteImportDebugAfterBranchSelection(mergedProfile, updatedSnapshot),
    websiteBranchResolution: updatedResolution,
  });

  recordMasterAdminAudit({
    user: operator,
    slug: safe,
    action: "select_website_branch",
    status: "success",
    evidence: `Branch selected: ${branch.branchName} (${branchId})`,
  });

  finalizeWebsiteImportAfterBranchSelection(safe, operator);

  return buildWebsiteBranchSelectionPayload(safe);
}

export function markNoneOfTheseBranches(slug: string, operator: string): WebsiteBranchSelectionPayload {
  const safe = safeAdminSlug(slug);
  const data = readSetupProfile(safe);
  const resolution = readWebsiteBranchResolution(safe);
  if (!resolution) throw new Error("No branch resolution record.");

  const updated: WebsiteBranchResolution = {
    ...resolution,
    status: "none_of_these_branches",
    selectedAt: new Date().toISOString(),
    selectedBy: operator,
    selectedBranchId: null,
    selectedBranch: null,
    googleBranchMatchStatus: "none",
    googleBranchMatchNotes: ["Product Owner declared none of the detected branches match this customer."],
  };

  writeSetupProfile(safe, {
    ...data,
    websiteBranchResolution: updated,
    websiteImportSnapshot: data.websiteImportSnapshot
      ? clearUnconfirmedBranchFields(data.websiteImportSnapshot as WebsiteImportSnapshot)
      : data.websiteImportSnapshot,
  });

  recordMasterAdminAudit({
    user: operator,
    slug: safe,
    action: "reject_website_branches",
    status: "warning",
    evidence: "None of these branches selected",
  });

  return buildWebsiteBranchSelectionPayload(safe);
}

export function resetCustomerBranchSelection(slug: string, operator: string): Promise<WebsiteBranchSelectionPayload> {
  const safe = safeAdminSlug(slug);
  const data = readSetupProfile(safe);
  const snap = data.websiteImportSnapshot as WebsiteImportSnapshot | null;
  if (!snap?.intelligence) throw new Error("Website import raw evidence missing — re-run Website Import first.");
  return recomputeBranchResolutionFromRaw(safe, operator, snap, "", true);
}

async function recomputeBranchResolutionFromRaw(
  slug: string,
  operator: string,
  snap: WebsiteImportSnapshot,
  _unusedHtml: string,
  isReset: boolean,
): Promise<WebsiteBranchSelectionPayload> {
  const data = readSetupProfile(slug);
  const homepageHtml = await fetchWebsiteHtml(snap.websiteUrl);
  const { snapshot, resolution } = applyBranchDetectionToImport(slug, snap, homepageHtml);

  writeSetupProfile(slug, {
    ...data,
    websiteImportSnapshot: snapshot,
    websiteBranchResolution: resolution,
  });

  recordMasterAdminAudit({
    user: operator,
    slug,
    action: isReset ? "reset_website_branch_selection" : "detect_website_branches",
    status: "success",
    evidence: `Branch detection: ${resolution.detectedBranches.length} branches; status=${resolution.status}`,
  });

  return buildWebsiteBranchSelectionPayload(slug);
}

export async function recomputeWebsiteBranchDetection(slug: string, operator: string): Promise<WebsiteBranchSelectionPayload> {
  const data = readSetupProfile(slug);
  const snap = data.websiteImportSnapshot as WebsiteImportSnapshot | null;
  if (!snap) throw new Error("Website import snapshot missing.");
  return recomputeBranchResolutionFromRaw(slug, operator, snap, "", false);
}

export function siblingBranchNamesForSlug(slug: string): string[] {
  const resolution = readWebsiteBranchResolution(slug);
  if (!resolution) return [];
  return resolution.detectedBranches.map((b) => b.branchName).filter(Boolean);
}

export function isBranchSelectionBlocking(slug: string): boolean {
  const safe = safeAdminSlug(slug);
  const data = readSetupProfile(safe);
  if (isNationalMarketScope(safe, data)) return false;
  const resolution = readWebsiteBranchResolution(safe);
  return resolution?.status === "branch_selection_required" || resolution?.status === "none_of_these_branches";
}

export function websiteImportStageComplete(slug: string): boolean {
  const safe = safeAdminSlug(slug);
  reconcileNationalWebsiteBranchResolution(safe);
  const data = readSetupProfile(safe);
  if (!data.websiteImportSnapshot) return false;
  const snap = data.websiteImportSnapshot as WebsiteImportSnapshot;
  if (isNationalMarketScope(safe, data)) {
    return Boolean(snap.importedAt) && (snap.status === "imported" || snap.status === "needs_review");
  }
  const resolution = readWebsiteBranchResolution(safe);
  if (resolution?.status === "branch_selection_required") return false;
  if (resolution?.status === "none_of_these_branches") return false;
  if (resolution?.status === "branch_selected") {
    return snap.status === "imported" || Boolean(snap.importedAt);
  }
  return snap.status === "imported";
}
