/**
 * CPR-RESET-04 — tenant isolation with same-site sibling branch allowance.
 */
import fs from "node:fs";
import path from "node:path";
import { readSetupProfile } from "./growthEngineCustomerSetupImportSplitService.ts";
import { siblingBranchNamesForSlug } from "./masterAdminWebsiteBranchSelectionService.ts";
import { isNationalMarketScope } from "./masterAdminMarketScopeService.ts";
import { safeAdminSlug } from "./pharmacyMasterAdminService.ts";
import type { ImportTenantIsolationCheck, ImportTenantIsolationGate } from "./masterAdminImportedEvidenceReviewModel.ts";

export const FORBIDDEN_CROSS_TENANT_NAMES = [
  /\bBrook Pharmacy\b/i,
  /\bBroom Lane Pharmacy\b/i,
  /\bReliable Direct Pharmacy\b/i,
  /\bBanner Cross Pharmacy\b/i,
  /\bInboxingProWeb\b/i,
  /\bPharmacy Delivered\b/i,
  /\bRowlands Pharmacy\b/i,
];

export const FORBIDDEN_CROSS_TENANT_SLUGS = [
  "brook-pharmacy",
  "broom-lane-pharmacy",
  "cpa01r-clean-journey-pharmacy",
  "reliable-direct-pharmacy",
  "banner-cross-pharmacy",
];

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function hostFromUrl(raw: string): string {
  try {
    const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function isPlatformMetadataReference(text: string, match: string): boolean {
  const hay = text.toLowerCase();
  const token = match.toLowerCase();
  if (token !== "pharmaconnect") return false;
  return (
    /@pharmaconnect\.uk/i.test(hay) ||
    /pharmaconnect\.uk/i.test(hay) ||
    /"platformClientStatus"/i.test(hay) ||
    /master-admin/i.test(hay)
  );
}

function isSiblingBranchReference(text: string, match: string, siblingNames: string[]): boolean {
  const hay = text.toLowerCase();
  const needle = match.toLowerCase();
  return siblingNames.some((name) => {
    const n = name.toLowerCase();
    return n.length >= 4 && (hay.includes(n) || needle.includes(n));
  });
}

function scanText(
  label: string,
  text: string,
  checks: ImportTenantIsolationCheck[],
  siblingNames: string[],
): void {
  const hay = str(text);
  if (!hay) return;
  for (const pattern of FORBIDDEN_CROSS_TENANT_NAMES) {
    const match = hay.match(pattern)?.[0];
    if (pattern.test(hay)) {
      if (match && isSiblingBranchReference(hay, match, siblingNames)) {
        checks.push({
          id: `sibling-branch:${label}:${pattern.source}`,
          passed: true,
          detail: `Same-site sibling branch allowed in ${label}: ${match}`,
        });
        continue;
      }
      checks.push({
        id: `forbidden-name:${label}`,
        passed: false,
        detail: `Cross-tenant reference detected in ${label}: ${pattern.source}`,
      });
    }
  }
  for (const forbiddenSlug of FORBIDDEN_CROSS_TENANT_SLUGS) {
    if (hay.includes(forbiddenSlug)) {
      checks.push({
        id: `forbidden-slug:${label}:${forbiddenSlug}`,
        passed: false,
        detail: `Previous tenant slug "${forbiddenSlug}" found in ${label}`,
      });
    }
  }
  if (/\bpharmaconnect\b/i.test(hay) && !isPlatformMetadataReference(hay, "pharmaconnect")) {
    const siblingHit = siblingNames.some((n) => hay.includes(n.toLowerCase()));
    if (!siblingHit) {
      checks.push({
        id: `platform-word:${label}`,
        passed: true,
        detail: `Internal platform reference in ${label} — not treated as cross-tenant contamination`,
      });
    }
  }
}

function readJsonIfExists(filePath: string): unknown {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

export function validateImportTenantIsolationGate(slug: string): ImportTenantIsolationGate {
  const safe = safeAdminSlug(slug);
  const data = readSetupProfile(safe);
  const checks: ImportTenantIsolationCheck[] = [];
  const siblingNames = siblingBranchNamesForSlug(safe);

  const pharmacyName = str(data.pharmacyName);
  const websiteUrl = str(data.website || data.canonicalWebsite);
  const submittedHost = hostFromUrl(websiteUrl);

  checks.push({
    id: "business-name-present",
    passed: Boolean(pharmacyName),
    detail: pharmacyName ? `Business name: ${pharmacyName}` : "Business name missing from profile",
  });

  if (websiteUrl) {
    checks.push({
      id: "website-host-match",
      passed: Boolean(submittedHost),
      detail: submittedHost ? `Submitted website host: ${submittedHost}` : "Could not parse submitted website URL",
    });
  }

  const snap = data.websiteImportSnapshot as Record<string, unknown> | null | undefined;
  if (snap) {
    const importHost = hostFromUrl(str(snap.websiteUrl));
    if (submittedHost && importHost) {
      const hostMatch =
        importHost === submittedHost ||
        importHost.endsWith(`.${submittedHost}`) ||
        submittedHost.endsWith(`.${importHost}`);
      checks.push({
        id: "import-website-host",
        passed: hostMatch,
        detail: hostMatch
          ? `Import host ${importHost} matches submitted ${submittedHost}`
          : `Import host ${importHost} does not match submitted ${submittedHost}`,
      });
    }
    scanText("website-import-snapshot", JSON.stringify(snap), checks, siblingNames);
  }

  const resolution = data.websiteBranchResolution;
  if (resolution?.status === "branch_selection_required" && !isNationalMarketScope(safe, data)) {
    checks.push({
      id: "branch-selection-pending",
      passed: false,
      detail: "Website branch selection required — evidence not yet accepted",
    });
  }

  if (siblingNames.length > 1) {
    checks.push({
      id: "multi-location-detected",
      passed: true,
      detail: `Same-site sibling branches detected (${siblingNames.join(" · ")}) — not cross-tenant contamination`,
    });
  }

  const googleSnap = data.googleImportSnapshot as Record<string, unknown> | null | undefined;
  if (googleSnap) {
    scanText("google-import-snapshot", JSON.stringify(googleSnap), checks, siblingNames);
    const placeId = str(googleSnap.placeId || data.googlePlaceId);
    if (placeId && str(data.googlePlaceId) && placeId !== str(data.googlePlaceId)) {
      checks.push({
        id: "google-place-id-match",
        passed: false,
        detail: "Imported Google Place ID does not match confirmed Place ID",
      });
    } else if (placeId) {
      checks.push({
        id: "google-place-id-present",
        passed: true,
        detail: `Place ID: ${placeId}`,
      });
    }
  }

  const brandDnaPath = path.join(process.cwd(), "config/projects", safe, "brand-dna.json");
  const brandDna = readJsonIfExists(brandDnaPath);
  if (brandDna) scanText("brand-dna", JSON.stringify(brandDna), checks, siblingNames);

  scanText("profile", JSON.stringify(data), checks, siblingNames);

  const blockers = checks.filter((c) => !c.passed).map((c) => c.detail);
  return {
    passed: blockers.length === 0,
    blockers,
    checks,
  };
}

export function containsForbiddenCrossTenantValue(value: string, siblingNames: string[] = []): boolean {
  const hay = str(value);
  if (!hay) return false;
  for (const pattern of FORBIDDEN_CROSS_TENANT_NAMES) {
    if (pattern.test(hay)) {
      const match = hay.match(pattern)?.[0] || "";
      if (isSiblingBranchReference(hay, match, siblingNames)) continue;
      return true;
    }
  }
  if (FORBIDDEN_CROSS_TENANT_SLUGS.some((s) => hay.includes(s))) return true;
  return false;
}
