/**
 * Resolve customer root domain from approved stored evidence only.
 * Does not scan live websites or guess silently.
 */
import fs from "node:fs";
import path from "node:path";
import { PHARMACY_WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";
import { resolveTenantProfileSlug } from "./pharmacyTenantSlug.ts";

export type CustomerDomainEvidenceSource =
  | "confirmed_customer_domain"
  | "canonical_branch_website"
  | "approved_business_profile_website"
  | "website_intelligence_canonical_url"
  | "none";

export interface CustomerRootDomainResolution {
  proposedRootDomain: string | null;
  evidenceSource: CustomerDomainEvidenceSource;
  evidenceUrl: string | null;
  confirmationRequired: boolean;
  confirmationReason: string | null;
  confirmedRootDomain: string | null;
  isParentOrGroupDomain: boolean;
}

const UK_SECOND_LEVEL = new Set(["co", "org", "ac", "gov", "ltd", "plc", "net", "sch", "nhs"]);

const BLOCKED_DOMAIN_SUFFIXES = [
  "sites.pharmaconnect.uk",
  "pharmaconnect.uk",
  "localhost",
  "127.0.0.1",
];

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function parseUrlParts(raw: string): { hostname: string; pathname: string } | null {
  const input = str(raw);
  if (!input) return null;
  try {
    const url = new URL(input.includes("://") ? input : `https://${input}`);
    return { hostname: url.hostname.toLowerCase().replace(/^www\./, ""), pathname: url.pathname || "/" };
  } catch {
    const cleaned = input.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0] || "";
    return cleaned ? { hostname: cleaned.toLowerCase(), pathname: "/" } : null;
  }
}

export function extractRegistrableDomain(hostname: string): string | null {
  const host = str(hostname).toLowerCase().replace(/^www\./, "");
  if (!host || host.includes("..")) return null;
  for (const blocked of BLOCKED_DOMAIN_SUFFIXES) {
    if (host === blocked || host.endsWith(`.${blocked}`)) return null;
  }
  const parts = host.split(".").filter(Boolean);
  if (parts.length >= 3 && UK_SECOND_LEVEL.has(parts[parts.length - 2] || "")) {
    return parts.slice(-3).join(".");
  }
  if (parts.length >= 2) return parts.slice(-2).join(".");
  return host || null;
}

function readProfile(slug: string): Record<string, unknown> | null {
  const safe = resolveTenantProfileSlug(slug) || slug;
  const file = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-profiles", `${safe}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as { data?: Record<string, unknown> };
    return (raw.data || raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function isParentGroupEvidence(hostname: string, pathname: string, profile: Record<string, unknown>): boolean {
  const pathSegments = pathname.split("/").filter(Boolean);
  if (pathSegments.length > 0) return true;
  const national = Boolean(profile.customerSetupNationalWebsiteDetected);
  const parentWebsite = str((profile.customerSetupImportSnapshot as Record<string, unknown> | undefined)?.website);
  if (national && parentWebsite) {
    const parentHost = parseUrlParts(parentWebsite)?.hostname;
    if (parentHost && parentHost === hostname) return true;
  }
  return false;
}

export function resolveCustomerRootDomain(slug: string, confirmedOverride?: string | null): CustomerRootDomainResolution {
  const confirmed = str(confirmedOverride);
  if (confirmed) {
    const domain = extractRegistrableDomain(confirmed);
    if (!domain) {
      return {
        proposedRootDomain: null,
        evidenceSource: "none",
        evidenceUrl: null,
        confirmationRequired: true,
        confirmationReason: "Confirmed domain is invalid",
        confirmedRootDomain: null,
        isParentOrGroupDomain: false,
      };
    }
    return {
      proposedRootDomain: domain,
      evidenceSource: "confirmed_customer_domain",
      evidenceUrl: confirmed,
      confirmationRequired: false,
      confirmationReason: null,
      confirmedRootDomain: domain,
      isParentOrGroupDomain: false,
    };
  }

  const profile = readProfile(slug);
  if (!profile) {
    return {
      proposedRootDomain: null,
      evidenceSource: "none",
      evidenceUrl: null,
      confirmationRequired: true,
      confirmationReason: "No approved profile evidence found",
      confirmedRootDomain: null,
      isParentOrGroupDomain: false,
    };
  }

  const candidates: Array<{ url: string; source: CustomerDomainEvidenceSource }> = [];
  const explicitConfirmed = str(profile.confirmedCustomerRootDomain);
  if (explicitConfirmed) candidates.push({ url: explicitConfirmed, source: "confirmed_customer_domain" });

  const branchWebsite = str(profile.website);
  if (branchWebsite) candidates.push({ url: branchWebsite, source: "canonical_branch_website" });

  const profileWebsite = str((profile as Record<string, unknown>).approvedBusinessProfileWebsite || profile.website);
  if (profileWebsite && profileWebsite !== branchWebsite) {
    candidates.push({ url: profileWebsite, source: "approved_business_profile_website" });
  }

  const websiteImport = profile.websiteImportSnapshot as Record<string, unknown> | undefined;
  const importUrl = str(websiteImport?.websiteUrl || websiteImport?.canonicalUrl || websiteImport?.resolvedUrl);
  if (importUrl && importUrl !== branchWebsite && importUrl !== profileWebsite) {
    candidates.push({ url: importUrl, source: "website_intelligence_canonical_url" });
  }

  for (const candidate of candidates) {
    const parsed = parseUrlParts(candidate.url);
    if (!parsed) continue;
    const domain = extractRegistrableDomain(parsed.hostname);
    if (!domain) continue;
    const parentGroup = isParentGroupEvidence(parsed.hostname, parsed.pathname, profile);
    if (candidate.source === "confirmed_customer_domain") {
      return {
        proposedRootDomain: domain,
        evidenceSource: candidate.source,
        evidenceUrl: candidate.url,
        confirmationRequired: false,
        confirmationReason: null,
        confirmedRootDomain: domain,
        isParentOrGroupDomain: false,
      };
    }
    return {
      proposedRootDomain: domain,
      evidenceSource: candidate.source,
      evidenceUrl: candidate.url,
      confirmationRequired: parentGroup,
      confirmationReason: parentGroup
        ? `Evidence URL ${candidate.url} appears to be a branch page on parent/group domain ${domain}, not a confirmed pharmacy-owned root domain`
        : null,
      confirmedRootDomain: null,
      isParentOrGroupDomain: parentGroup,
    };
  }

  return {
    proposedRootDomain: null,
    evidenceSource: "none",
    evidenceUrl: null,
    confirmationRequired: true,
    confirmationReason: "No customer root domain found in approved evidence",
    confirmedRootDomain: null,
    isParentOrGroupDomain: false,
  };
}

export function buildCanonicalEcosystemHostname(rootDomain: string, subdomainLabel = "local"): string {
  const label = str(subdomainLabel).toLowerCase().replace(/[^a-z0-9-]/g, "") || "local";
  const root = str(rootDomain).toLowerCase().replace(/^\.+|\.+$/g, "");
  return `${label}.${root}`;
}

export function assertRootDomainPublishingBlocked(hostname: string): void {
  const parsed = parseUrlParts(hostname);
  if (!parsed) throw new Error("Invalid hostname");
  const root = extractRegistrableDomain(parsed.hostname);
  if (!root) throw new Error("Invalid customer domain");
  const normalised = parsed.hostname.toLowerCase();
  if (normalised === root || normalised === `www.${root}`) {
    throw new Error(
      "Root-domain publication is blocked. Only an approved customer subdomain such as local.<customer-domain> may be used.",
    );
  }
  const label = normalised.replace(`.${root}`, "");
  if (!label || label.includes(".") === false && normalised === root) {
    throw new Error("Root-domain publication is blocked for the current product mode.");
  }
}
