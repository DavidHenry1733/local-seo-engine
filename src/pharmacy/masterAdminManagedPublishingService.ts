/**
 * Sprint 8C.2 — Per-tenant managed publishing (PharmaConnect infrastructure).
 */
import fs from "node:fs";
import path from "node:path";
import dns from "node:dns/promises";
import { WORKSPACE_ROOT, PHARMACY_WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";
import { recordMasterAdminAudit } from "./masterAdminAuditService.ts";
import { resolveTenantProfileSlug } from "./pharmacyTenantSlug.ts";
import {
  isPlatformInfrastructureReady,
  readPlatformPublishingInfrastructure,
  resolveManagedHostname,
  resolveTenantPublishDirectory,
} from "./masterAdminPlatformPublishingInfrastructureService.ts";
import {
  buildCanonicalEcosystemHostname,
  resolveCustomerRootDomain,
} from "./customerRootDomainResolver.ts";
import {
  resolveActivePublishBaseUrl,
  resolveCustomerEcosystemUrlState,
  syncCustomerHostMappingForProfile,
  validateCustomerEcosystemHostname,
  rewritePublishedReleaseBaseUrls,
} from "./customerEcosystemUrlService.ts";
import type {
  ManagedDnsStatus,
  ManagedPublishingProfile,
  ManagedPublishingRelease,
  ManagedPublishingReviewPayload,
  ManagedPublishingStorage,
  ManagedPublishingSubdomainInput,
  ManagedPublishingDomainConfirmInput,
  ManagedPublishingSubdomainLabelInput,
  ManagedPublishingValidationReport,
  ManagedPublishStatus,
  ManagedSslStatus,
} from "./masterAdminManagedPublishingModel.ts";

const MANAGED_DIR = path.join(WORKSPACE_ROOT, "data/pharmacy-master-admin/managed-publishing");
const LEGACY_DEPLOYMENT_DIR = path.join(WORKSPACE_ROOT, "data/pharmacy-master-admin/deployment-profiles");
const RELEASE_RETENTION = Number(process.env.PLATFORM_RELEASE_RETENTION || 3);

function profilePath(slug: string): string {
  return path.join(MANAGED_DIR, `${slug}.json`);
}

function writeJsonAtomic(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, filePath);
}

function readJson<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

function dirSizeBytes(dir: string): number {
  if (!fs.existsSync(dir)) return 0;
  let total = 0;
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop()!;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else {
        try {
          total += fs.statSync(full).size;
        } catch {
          /* skip */
        }
      }
    }
  }
  return total;
}

function safeSlugSegment(slug: string): string {
  const cleaned = String(slug || "").trim().replace(/[^a-z0-9-]/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (!cleaned || cleaned.includes("..")) throw new Error("Invalid tenant slug");
  return cleaned.toLowerCase();
}

function buildPaths(slug: string, tenantRoot: string): ManagedPublishingProfile["paths"] {
  const releaseDirectory = path.join(tenantRoot, "releases");
  return {
    tenantPublishDirectory: tenantRoot,
    releaseDirectory,
    currentReleasePointer: path.join(tenantRoot, "current"),
    previousReleasePointer: path.join(tenantRoot, "previous"),
    manifestPath: path.join(tenantRoot, "current", "manifest.json"),
    registryPath: path.join(tenantRoot, "current", "registry.json"),
    sitemapPath: path.join(tenantRoot, "current", "sitemap.xml"),
    assetPath: path.join(tenantRoot, "current", "assets"),
    imagePath: path.join(tenantRoot, "current", "images"),
    logPath: path.join(tenantRoot, "logs"),
  };
}

function computeStorage(slug: string, tenantRoot: string, serviceId: string): ManagedPublishingStorage {
  const releasesDir = path.join(tenantRoot, "releases");
  let releaseCount = 0;
  let totalRetained = 0;
  let currentReleaseSize = 0;
  if (fs.existsSync(releasesDir)) {
    for (const entry of fs.readdirSync(releasesDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      releaseCount += 1;
      const size = dirSizeBytes(path.join(releasesDir, entry.name));
      totalRetained += size;
    }
  }
  const currentDir = path.join(tenantRoot, "current");
  if (fs.existsSync(currentDir)) currentReleaseSize = dirSizeBytes(currentDir);
  const assetPath = path.join(currentDir, "assets");
  const imagePath = path.join(currentDir, "images");
  return {
    currentReleaseSizeBytes: currentReleaseSize,
    totalRetainedReleaseSizeBytes: totalRetained,
    assetSizeBytes: fs.existsSync(assetPath) ? dirSizeBytes(assetPath) : 0,
    imageSizeBytes: fs.existsSync(imagePath) ? dirSizeBytes(imagePath) : 0,
    releaseCount,
    lastCleanupAt: null,
    retentionPolicy: RELEASE_RETENTION,
  };
}

function markLegacyExternalDeploymentProfile(slug: string): string | null {
  const legacyFile = path.join(LEGACY_DEPLOYMENT_DIR, `${slug}.json`);
  if (!fs.existsSync(legacyFile)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(legacyFile, "utf8")) as Record<string, unknown>;
    if (raw.profileKind === "LEGACY_EXTERNAL_DEPLOYMENT") return legacyFile;
    raw.profileKind = "LEGACY_EXTERNAL_DEPLOYMENT";
    raw.legacyRetiredAt = new Date().toISOString();
    raw.legacyNote = "Retained for audit — does not block PharmaConnect managed publishing";
    writeJsonAtomic(legacyFile, raw);
    return legacyFile;
  } catch {
    return legacyFile;
  }
}

function normaliseManagedProfile(profile: ManagedPublishingProfile): ManagedPublishingProfile {
  const resolution = resolveCustomerRootDomain(profile.slug, profile.customerRootDomainConfirmed ? profile.customerRootDomain || undefined : undefined);
  const subdomainLabel = String(profile.subdomainLabel || "local").trim() || "local";
  const rootDomain = profile.customerRootDomain || resolution.confirmedRootDomain || resolution.proposedRootDomain;
  const hostname =
    profile.canonicalEcosystemHostname ||
    (rootDomain && profile.customerRootDomainConfirmed ? buildCanonicalEcosystemHostname(rootDomain, subdomainLabel) : null);
  return {
    ...profile,
    customerRootDomain: profile.customerRootDomain ?? rootDomain ?? null,
    customerRootDomainConfirmed: Boolean(profile.customerRootDomainConfirmed),
    customerRootDomainEvidenceSource:
      profile.customerRootDomainEvidenceSource || resolution.evidenceSource,
    customerRootDomainEvidenceUrl: profile.customerRootDomainEvidenceUrl || resolution.evidenceUrl,
    subdomainLabel,
    canonicalEcosystemHostname: hostname,
    canonicalEcosystemBaseUrl:
      profile.canonicalEcosystemBaseUrl ||
      (hostname && profile.dnsStatus === "verified" && profile.sslStatus === "active" ? `https://${hostname}/` : null),
    internalFallbackUrl: profile.internalFallbackUrl || profile.managedUrl,
    canonicalUrlStatus:
      profile.canonicalUrlStatus ||
      (profile.customerRootDomainConfirmed
        ? profile.dnsStatus === "verified" && profile.sslStatus === "active"
          ? "active"
          : profile.dnsStatus === "verified"
            ? "pending_ssl"
            : "pending_dns"
        : "pending_domain_confirmation"),
    liveVerificationStatus: profile.liveVerificationStatus || null,
    sslIssuer: profile.sslIssuer || null,
    sslIssuedAt: profile.sslIssuedAt || null,
    customerSubdomain:
      profile.customerSubdomain ||
      (hostname && profile.customerRootDomainConfirmed ? hostname : null),
    requiredCnameHost: profile.requiredCnameHost || subdomainLabel,
    requiredCnameTarget: profile.requiredCnameTarget || profile.managedHostname,
  };
}

function computePublishingReadiness(
  profile: ManagedPublishingProfile,
  blockers: string[],
): ManagedPublishingProfile["publishingReadiness"] {
  if (blockers.length > 0) return "BLOCKED";
  if (!isPlatformInfrastructureReady() || !profile.paths.tenantPublishDirectory) return profile.publishingReadiness;
  if (profile.customerRootDomainConfirmed && profile.dnsStatus === "verified" && profile.sslStatus === "active") {
    return "READY FOR CUSTOMER SUBDOMAIN";
  }
  if (profile.currentRelease) return "READY FOR INTERNAL PUBLISH";
  return "READY TO PUBLISH";
}

function ensureTenantDirectories(paths: ManagedPublishingProfile["paths"]): void {
  fs.mkdirSync(paths.releaseDirectory, { recursive: true });
  fs.mkdirSync(paths.logPath, { recursive: true });
}

export function listManagedPublishingProfiles(): ManagedPublishingProfile[] {
  if (!fs.existsSync(MANAGED_DIR)) return [];
  return fs
    .readdirSync(MANAGED_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => readJson<ManagedPublishingProfile>(path.join(MANAGED_DIR, f)))
    .filter((p): p is ManagedPublishingProfile => Boolean(p));
}

export function readManagedPublishingProfile(slug: string): ManagedPublishingProfile | null {
  const raw = readJson<ManagedPublishingProfile>(profilePath(slug));
  return raw ? normaliseManagedProfile(raw) : null;
}

export function ensureManagedPublishingTenant(slug: string, serviceId = "pharmacy-first"): ManagedPublishingProfile {
  const safe = safeSlugSegment(slug);
  const existing = readManagedPublishingProfile(safe);
  if (existing) return existing;

  const infra = readPlatformPublishingInfrastructure();
  const tenantRoot = resolveTenantPublishDirectory(safe);
  const managedHostname = resolveManagedHostname(safe);
  const managedUrl = `https://${managedHostname}/`;
  const legacyRef = markLegacyExternalDeploymentProfile(safe);
  const now = new Date().toISOString();
  const paths = buildPaths(safe, tenantRoot);

  const profile: ManagedPublishingProfile = normaliseManagedProfile({
    version: 1,
    slug: safe,
    tenantPublishDirectory: tenantRoot,
    managedHostname,
    managedUrl,
    customerSubdomain: null,
    customerRootDomain: null,
    customerRootDomainConfirmed: false,
    customerRootDomainEvidenceSource: null,
    customerRootDomainEvidenceUrl: null,
    subdomainLabel: "local",
    canonicalEcosystemHostname: null,
    canonicalEcosystemBaseUrl: null,
    internalFallbackUrl: managedUrl,
    canonicalUrlStatus: "pending_domain_confirmation",
    liveVerificationStatus: null,
    requiredCnameHost: "local",
    requiredCnameTarget: managedHostname,
    requiredCnameTtl: "Automatic/default",
    dnsStatus: "not_configured",
    dnsLastCheckedAt: null,
    dnsVerificationEvidence: null,
    sslStatus: "managed_preview_active",
    sslExpiry: null,
    sslRenewalStatus: "Managed preview domain uses platform SSL",
    sslLastCheckedAt: now,
    sslIssuer: null,
    sslIssuedAt: null,
    publishedVersion: 0,
    publishStatus: "not_published",
    liveUrl: null,
    currentRelease: null,
    previousRelease: null,
    paths,
    storage: computeStorage(safe, tenantRoot, serviceId),
    publishingReadiness: infra.credentialsConfigured && infra.serverHost ? "READY FOR VALIDATION" : "CONFIGURATION REQUIRED",
    legacyExternalProfileRef: legacyRef,
    migratedAt: now,
    updatedAt: now,
    createdAt: now,
  });

  ensureTenantDirectories(paths);
  writeJsonAtomic(profilePath(safe), profile);

  recordMasterAdminAudit({
    user: "system",
    slug: safe,
    action: "migrate_managed_publishing",
    status: "success",
    evidence: `Managed publishing allocated — ${managedHostname}`,
  });

  return profile;
}

function buildReleases(profile: ManagedPublishingProfile): ManagedPublishingRelease[] {
  const releasesDir = profile.paths.releaseDirectory;
  if (!fs.existsSync(releasesDir)) return [];
  return fs
    .readdirSync(releasesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const directory = path.join(releasesDir, d.name);
      const version = Number(d.name.replace(/^v?/, "")) || 0;
      return {
        releaseId: d.name,
        version,
        directory,
        sizeBytes: dirSizeBytes(directory),
        publishedAt: null,
        publishedBy: null,
        verified: true,
        current: profile.currentRelease === d.name,
        previous: profile.previousRelease === d.name,
      };
    })
    .sort((a, b) => b.version - a.version);
}

export function buildManagedPublishingReview(slug: string): ManagedPublishingReviewPayload {
  const safe = safeSlugSegment(slug);
  const profile = normaliseManagedProfile(ensureManagedPublishingTenant(safe));
  const infra = readPlatformPublishingInfrastructure();
  const urlState = resolveCustomerEcosystemUrlState(profile);
  const warnings: string[] = [];
  const blockers: string[] = [];

  if (!infra.credentialsConfigured) blockers.push("Global platform credentials not configured");
  if (!infra.serverHost) blockers.push("Global platform host not configured");
  if (infra.platformStatus === "CONNECTION FAILED") warnings.push(infra.lastFailureReason || "Global connection test failed");
  if (urlState.domainConfirmationRequired) {
    warnings.push("Customer root domain requires Product Owner confirmation before customer subdomain DNS");
  }
  if (profile.customerRootDomainConfirmed && profile.dnsStatus === "pending") {
    warnings.push("Customer subdomain DNS not verified — internal managed hostname still available for testing");
  }
  if (profile.dnsStatus === "verified" && profile.sslStatus !== "active") {
    warnings.push("Customer subdomain SSL not active — do not index customer-facing URL yet");
  }

  const publishingReadiness = computePublishingReadiness(profile, blockers);

  const summary = {
    hostingLabel: "PharmaConnect Managed Infrastructure",
    managed: true,
    managedUrl: profile.managedUrl,
    internalFallbackUrl: profile.internalFallbackUrl,
    customerRootDomain: urlState.customerRootDomain,
    subdomainLabel: urlState.subdomainLabel,
    canonicalEcosystemUrl: urlState.fullExpectedHostname ? `https://${urlState.fullExpectedHostname}/` : null,
    canonicalUrlStatus: urlState.canonicalUrlStatus.replace(/_/g, " "),
    tenantPublishStatus: profile.publishStatus.replace(/_/g, " "),
    currentRelease: profile.currentRelease || "None",
    lastPublished: profile.publishedVersion > 0 ? `v${profile.publishedVersion}` : null,
    dnsConnectionStatus: profile.dnsStatus.replace(/_/g, " "),
    sslStatus: profile.sslStatus.replace(/_/g, " "),
    customerLiveUrl:
      profile.dnsStatus === "verified" && profile.sslStatus === "active" && urlState.fullExpectedHostname
        ? `https://${urlState.fullExpectedHostname}/`
        : null,
    requiredCname: profile.customerRootDomainConfirmed
      ? `${urlState.requiredCnameHost} CNAME ${urlState.managedCnameTarget}`
      : null,
    publishingReadiness,
    overallStatus: publishingReadiness,
    domainConfirmationRequired: urlState.domainConfirmationRequired,
    domainEvidenceSource: urlState.domainEvidenceSource,
  };

  return {
    version: 1,
    slug: safe,
    profile: { ...profile, publishingReadiness },
    summary,
    ecosystemUrl: {
      customerRootDomain: urlState.customerRootDomain,
      subdomainLabel: urlState.subdomainLabel,
      canonicalEcosystemHostname: urlState.fullExpectedHostname,
      canonicalEcosystemBaseUrl: urlState.canonicalEcosystemBaseUrl,
      internalFallbackUrl: urlState.internalFallbackUrl,
      managedCnameTarget: urlState.managedCnameTarget,
      domainConfirmationRequired: urlState.domainConfirmationRequired,
      domainEvidenceSource: urlState.domainEvidenceSource,
      domainEvidenceUrl: urlState.domainEvidenceUrl,
      domainConfirmationReason: urlState.domainConfirmationReason,
    },
    dnsInstructions: profile.customerRootDomainConfirmed
      ? {
          type: "CNAME",
          host: urlState.requiredCnameHost,
          target: urlState.managedCnameTarget,
          ttl: urlState.requiredCnameTtl,
          fullExpectedHostname: urlState.fullExpectedHostname,
        }
      : null,
    warnings,
    blockers,
    releases: buildReleases(profile),
    canVerifyDns: Boolean(profile.customerRootDomainConfirmed && urlState.fullExpectedHostname),
    canConfirmDomain: urlState.domainConfirmationRequired || !profile.customerRootDomainConfirmed,
    canChangeSubdomainLabel: Boolean(profile.customerRootDomainConfirmed),
    canAddSubdomain: false,
    canRemoveSubdomain: Boolean(profile.customerRootDomainConfirmed),
    canRollback: Boolean(profile.previousRelease),
  };
}

export function isManagedPublishingReady(slug: string): boolean {
  const review = buildManagedPublishingReview(slug);
  return (
    (review.summary.publishingReadiness === "READY TO PUBLISH" ||
      review.summary.publishingReadiness === "READY FOR INTERNAL PUBLISH") &&
    review.blockers.length === 0
  );
}

export function isTenantAllocationComplete(slug: string): boolean {
  const profile = ensureManagedPublishingTenant(slug);
  return Boolean(profile.managedHostname && profile.tenantPublishDirectory && profile.paths.releaseDirectory);
}

export function confirmCustomerDomain(
  slug: string,
  input: ManagedPublishingDomainConfirmInput,
  operator: string,
): ManagedPublishingReviewPayload {
  const profile = ensureManagedPublishingTenant(slug);
  const rootDomain = String(input.customerRootDomain || "").trim().toLowerCase().replace(/^https?:\/\//i, "").replace(/^www\./, "").split("/")[0];
  if (!rootDomain || rootDomain.includes("..")) throw new Error("Enter a valid customer root domain");
  validateCustomerEcosystemHostname(buildCanonicalEcosystemHostname(rootDomain, profile.subdomainLabel || "local"));
  const resolution = resolveCustomerRootDomain(slug, rootDomain);
  const hostname = buildCanonicalEcosystemHostname(rootDomain, profile.subdomainLabel || "local");
  const updated = normaliseManagedProfile({
    ...profile,
    customerRootDomain: rootDomain,
    customerRootDomainConfirmed: true,
    customerRootDomainEvidenceSource: resolution.evidenceSource,
    customerRootDomainEvidenceUrl: resolution.evidenceUrl,
    customerSubdomain: hostname,
    canonicalEcosystemHostname: hostname,
    canonicalEcosystemBaseUrl: null,
    canonicalUrlStatus: "pending_dns",
    requiredCnameHost: profile.subdomainLabel || "local",
    requiredCnameTarget: profile.managedHostname,
    dnsStatus: "pending",
    sslStatus: "pending",
    liveUrl: null,
    updatedAt: new Date().toISOString(),
  });
  writeJsonAtomic(profilePath(slug), updated);
  recordMasterAdminAudit({
    user: operator,
    slug,
    action: "confirm_customer_domain",
    status: "success",
    evidence: rootDomain,
  });
  return buildManagedPublishingReview(slug);
}

export function changeCustomerSubdomainLabel(
  slug: string,
  input: ManagedPublishingSubdomainLabelInput,
  operator: string,
): ManagedPublishingReviewPayload {
  const profile = ensureManagedPublishingTenant(slug);
  if (!profile.customerRootDomainConfirmed || !profile.customerRootDomain) {
    throw new Error("Confirm customer domain before changing subdomain label");
  }
  const label = String(input.subdomainLabel || "local").trim().toLowerCase().replace(/[^a-z0-9-]/g, "") || "local";
  const hostname = buildCanonicalEcosystemHostname(profile.customerRootDomain, label);
  validateCustomerEcosystemHostname(hostname);
  const updated = normaliseManagedProfile({
    ...profile,
    subdomainLabel: label,
    customerSubdomain: hostname,
    canonicalEcosystemHostname: hostname,
    requiredCnameHost: label,
    dnsStatus: "pending",
    sslStatus: "pending",
    canonicalUrlStatus: "pending_dns",
    canonicalEcosystemBaseUrl: null,
    liveUrl: null,
    updatedAt: new Date().toISOString(),
  });
  writeJsonAtomic(profilePath(slug), updated);
  recordMasterAdminAudit({
    user: operator,
    slug,
    action: "change_subdomain_label",
    status: "success",
    evidence: label,
  });
  return buildManagedPublishingReview(slug);
}

/** @deprecated use confirmCustomerDomain */
export function addCustomerSubdomain(slug: string, input: ManagedPublishingSubdomainInput, operator: string): ManagedPublishingReviewPayload {
  const fqdn = String(input.customerSubdomain || "").trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  const parts = fqdn.split(".").filter(Boolean);
  if (parts.length < 3) throw new Error("Use Confirm Domain with the customer root domain instead");
  const rootDomain = parts.slice(-2).join(".");
  return confirmCustomerDomain(slug, { customerRootDomain: rootDomain }, operator);
}

export function removeCustomerSubdomain(slug: string, operator: string): ManagedPublishingReviewPayload {
  const profile = ensureManagedPublishingTenant(slug);
  const updated = normaliseManagedProfile({
    ...profile,
    customerSubdomain: null,
    customerRootDomain: null,
    customerRootDomainConfirmed: false,
    canonicalEcosystemHostname: null,
    canonicalEcosystemBaseUrl: null,
    requiredCnameHost: profile.subdomainLabel || "local",
    liveUrl: profile.publishStatus === "live" ? profile.managedUrl : null,
    dnsStatus: "not_configured",
    dnsVerificationEvidence: null,
    sslStatus: "managed_preview_active",
    canonicalUrlStatus: "pending_domain_confirmation",
    updatedAt: new Date().toISOString(),
  });
  writeJsonAtomic(profilePath(slug), updated);
  syncCustomerHostMappingForProfile(updated);
  recordMasterAdminAudit({
    user: operator,
    slug,
    action: "remove_customer_domain_mapping",
    status: "success",
    evidence: "Customer domain mapping removed",
  });
  return buildManagedPublishingReview(slug);
}

export async function verifyCustomerDns(slug: string, operator: string): Promise<ManagedPublishingReviewPayload> {
  const profile = ensureManagedPublishingTenant(slug);
  const urlState = resolveCustomerEcosystemUrlState(profile);
  if (!profile.customerRootDomainConfirmed || !urlState.fullExpectedHostname) {
    throw new Error("Confirm customer domain before verifying DNS");
  }

  let dnsStatus: ManagedDnsStatus = "pending";
  let evidence = "CNAME not verified";
  const verifyHost = urlState.fullExpectedHostname;
  try {
    const records = await dns.resolveCname(verifyHost);
    const target = profile.requiredCnameTarget.replace(/\.$/, "").toLowerCase();
    const matched = records.some((r) => r.replace(/\.$/, "").toLowerCase() === target);
    if (matched) {
      dnsStatus = "verified";
      evidence = `CNAME ${verifyHost} resolves to ${target}`;
    } else {
      dnsStatus = "conflict";
      evidence = `CNAME points to ${records.join(", ")} — expected ${target}`;
    }
    try {
      await dns.resolve4(verifyHost);
      if (dnsStatus === "verified") {
        dnsStatus = "conflict";
        evidence = "Conflicting A record detected alongside CNAME";
      }
    } catch {
      /* no A record — good */
    }
  } catch (err) {
    evidence = err instanceof Error ? err.message : "DNS lookup failed";
    dnsStatus = "pending";
  }

  const sslStatus: ManagedSslStatus = dnsStatus === "verified" ? "provisioning" : profile.sslStatus;
  const updated = normaliseManagedProfile({
    ...profile,
    dnsStatus,
    dnsLastCheckedAt: new Date().toISOString(),
    dnsVerificationEvidence: evidence,
    sslStatus,
    sslRenewalStatus: dnsStatus === "verified" ? "Queued for managed SSL provisioning" : profile.sslRenewalStatus,
    sslLastCheckedAt: new Date().toISOString(),
    canonicalUrlStatus: dnsStatus === "verified" ? "pending_ssl" : "pending_dns",
    liveUrl: null,
    updatedAt: new Date().toISOString(),
  });
  writeJsonAtomic(profilePath(slug), updated);
  syncCustomerHostMappingForProfile(updated);
  recordMasterAdminAudit({
    user: operator,
    slug,
    action: "verify_customer_dns",
    status: dnsStatus === "verified" ? "success" : "warning",
    evidence,
  });
  if (dnsStatus === "verified") {
    return verifyCustomerSsl(slug, operator);
  }
  return buildManagedPublishingReview(slug);
}

export async function verifyCustomerSsl(slug: string, operator: string): Promise<ManagedPublishingReviewPayload> {
  const profile = ensureManagedPublishingTenant(slug);
  const urlState = resolveCustomerEcosystemUrlState(profile);
  if (!urlState.fullExpectedHostname || profile.dnsStatus !== "verified") {
    throw new Error("Verify customer DNS before checking SSL");
  }
  const testUrl = `https://${urlState.fullExpectedHostname}/`;
  let sslStatus: ManagedSslStatus = "provisioning";
  let evidence = "HTTPS not yet active";
  let liveVerificationStatus = "pending";
  try {
    const res = await fetch(testUrl, { redirect: "follow" });
    if (res.ok || res.status === 404) {
      sslStatus = "active";
      evidence = `HTTPS ${res.status} for ${testUrl}`;
      liveVerificationStatus = "verified";
    } else {
      sslStatus = "provisioning";
      evidence = `HTTPS returned ${res.status}`;
    }
  } catch (err) {
    evidence = err instanceof Error ? err.message : "SSL verification failed";
    sslStatus = "pending";
  }

  const updated = normaliseManagedProfile({
    ...profile,
    sslStatus,
    sslLastCheckedAt: new Date().toISOString(),
    sslRenewalStatus: sslStatus === "active" ? "Active" : "Pending real DNS and certificate provisioning",
    canonicalEcosystemBaseUrl: sslStatus === "active" ? testUrl : null,
    canonicalUrlStatus: sslStatus === "active" ? "active" : "pending_ssl",
    liveUrl: sslStatus === "active" ? testUrl : null,
    liveVerificationStatus,
    publishStatus: sslStatus === "active" ? "live" : profile.publishStatus,
    publishingReadiness: sslStatus === "active" ? "READY FOR CUSTOMER SUBDOMAIN" : profile.publishingReadiness,
    updatedAt: new Date().toISOString(),
  });
  writeJsonAtomic(profilePath(slug), updated);
  syncCustomerHostMappingForProfile(updated);
  if (sslStatus === "active" && profile.managedUrl && testUrl) {
    rewritePublishedReleaseBaseUrls(profile.tenantPublishDirectory, profile.managedUrl, testUrl);
  }
  recordMasterAdminAudit({
    user: operator,
    slug,
    action: "verify_customer_ssl",
    status: sslStatus === "active" ? "success" : "warning",
    evidence,
  });
  return buildManagedPublishingReview(slug);
}

export function rollbackTenantRelease(slug: string, releaseId: string, operator: string): ManagedPublishingReviewPayload {
  const profile = ensureManagedPublishingTenant(slug);
  const releaseDir = path.join(profile.paths.releaseDirectory, releaseId);
  if (!fs.existsSync(releaseDir)) throw new Error("Release not found");

  const previous = profile.currentRelease;
  fs.mkdirSync(path.dirname(profile.paths.currentReleasePointer), { recursive: true });
  try {
    if (fs.existsSync(profile.paths.currentReleasePointer)) fs.rmSync(profile.paths.currentReleasePointer, { recursive: true, force: true });
    fs.cpSync(releaseDir, profile.paths.currentReleasePointer, { recursive: true });
  } catch {
    throw new Error("Rollback failed — could not switch current release");
  }

  const updated: ManagedPublishingProfile = {
    ...profile,
    previousRelease: previous,
    currentRelease: releaseId,
    publishStatus: profile.publishStatus === "not_published" ? "preview_available" : profile.publishStatus,
    updatedAt: new Date().toISOString(),
  };
  writeJsonAtomic(profilePath(slug), updated);
  recordMasterAdminAudit({
    user: operator,
    slug,
    action: "rollback_managed_release",
    status: "success",
    evidence: `Rolled back to ${releaseId}`,
  });
  return buildManagedPublishingReview(slug);
}

export function recordManagedPublishRelease(
  slug: string,
  releaseId: string,
  operator: string,
  opts: { verified?: boolean } = {},
): ManagedPublishingProfile {
  const profile = ensureManagedPublishingTenant(slug);
  const version = profile.publishedVersion + 1;
  const updated: ManagedPublishingProfile = {
    ...profile,
    previousRelease: profile.currentRelease,
    currentRelease: releaseId,
    publishedVersion: version,
    publishStatus: profile.dnsStatus === "verified" && profile.sslStatus === "active" ? "live" : "preview_available",
    liveUrl:
      profile.dnsStatus === "verified" && profile.sslStatus === "active" && profile.canonicalEcosystemBaseUrl
        ? profile.canonicalEcosystemBaseUrl
        : profile.managedUrl,
    storage: computeStorage(slug, profile.tenantPublishDirectory, "pharmacy-first"),
    updatedAt: new Date().toISOString(),
  };
  writeJsonAtomic(profilePath(slug), updated);
  recordMasterAdminAudit({
    user: operator,
    slug,
    action: "record_managed_publish_release",
    status: "success",
    evidence: `${releaseId}${opts.verified ? " verified" : ""}`,
  });
  return updated;
}

export function runManagedPublishingValidation(slug: string): ManagedPublishingValidationReport {
  const safe = safeSlugSegment(slug);
  const checks: ManagedPublishingValidationReport["checks"] = [];
  const blockers: string[] = [];

  const profile = ensureManagedPublishingTenant(safe);
  checks.push({
    id: "tenant-allocation",
    label: "Tenant allocation exists",
    status: profile.managedHostname ? "PASS" : "FAIL",
    detail: profile.managedHostname || "Missing",
  });
  checks.push({
    id: "managed-hostname",
    label: "Managed hostname assigned",
    status: profile.managedUrl ? "PASS" : "FAIL",
    detail: profile.managedUrl,
  });
  checks.push({
    id: "tenant-directory",
    label: "Tenant directory allocated",
    status: profile.tenantPublishDirectory ? "PASS" : "FAIL",
    detail: profile.tenantPublishDirectory,
  });
  checks.push({
    id: "legacy-retained",
    label: "Legacy external deployment retained",
    status: "PASS",
    detail: profile.legacyExternalProfileRef || "No legacy profile",
  });
  checks.push({
    id: "no-customer-credentials",
    label: "Per-customer credentials not required",
    status: "PASS",
    detail: "Managed publishing uses global platform credentials",
  });

  const infra = readPlatformPublishingInfrastructure();
  checks.push({
    id: "global-infra",
    label: "Global infrastructure profile exists",
    status: infra.infrastructureId ? "PASS" : "FAIL",
    detail: infra.infrastructureId,
  });

  if (!profile.managedHostname) blockers.push("Managed hostname missing");
  if (!infra.infrastructureId) blockers.push("Global infrastructure missing");

  return { ok: blockers.length === 0, slug: safe, checks, blockers };
}

export function usesManagedPublishing(_slug?: string): boolean {
  return true;
}

export function customerNeedsLegacyDeploymentConfiguration(_slug: string): boolean {
  return false;
}

export function projectConfigPath(slug: string): string {
  const key = resolveTenantProfileSlug(slug) || slug;
  return path.join(PHARMACY_WORKSPACE_ROOT, "config/projects", `${key}.json`);
}

export { hydratePlatformPublishingForTenant as hydrateManagedPublishingForPublishing } from "./masterAdminPlatformPublishingInfrastructureService.ts";
