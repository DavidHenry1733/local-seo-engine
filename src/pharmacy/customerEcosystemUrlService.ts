/**
 * Customer ecosystem URL model — canonical local subdomain vs internal managed fallback.
 */
import fs from "node:fs";
import path from "node:path";
import { PHARMACY_WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";
import {
  assertRootDomainPublishingBlocked,
  buildCanonicalEcosystemHostname,
  resolveCustomerRootDomain,
} from "./customerRootDomainResolver.ts";
import type { ManagedPublishingProfile } from "./masterAdminManagedPublishingModel.ts";

export type CanonicalUrlStatus =
  | "pending_domain_confirmation"
  | "pending_dns"
  | "pending_ssl"
  | "active";

export interface CustomerEcosystemUrlState {
  customerRootDomain: string | null;
  subdomainLabel: string;
  canonicalEcosystemHostname: string | null;
  canonicalEcosystemBaseUrl: string | null;
  internalFallbackUrl: string;
  managedCnameTarget: string;
  requiredCnameHost: string;
  requiredCnameRecordType: "CNAME";
  requiredCnameTtl: string;
  fullExpectedHostname: string | null;
  canonicalUrlStatus: CanonicalUrlStatus;
  domainConfirmationRequired: boolean;
  domainEvidenceSource: string | null;
  domainEvidenceUrl: string | null;
  domainConfirmationReason: string | null;
}

const HOST_MAPPING_REGISTRY = path.join(
  PHARMACY_WORKSPACE_ROOT,
  "data/pharmacy-master-admin/customer-host-mappings.json",
);

const DEFAULT_SUBDOMAIN_LABEL = "local";

function str(v: unknown): string {
  return String(v ?? "").trim();
}

export function defaultSubdomainLabel(): string {
  return DEFAULT_SUBDOMAIN_LABEL;
}

export function resolveCustomerEcosystemUrlState(profile: ManagedPublishingProfile): CustomerEcosystemUrlState {
  const resolution = resolveCustomerRootDomain(profile.slug, profile.customerRootDomainConfirmed || undefined);
  const rootDomain = profile.customerRootDomain || resolution.confirmedRootDomain || resolution.proposedRootDomain;
  const label = str(profile.subdomainLabel) || DEFAULT_SUBDOMAIN_LABEL;
  const hostname = rootDomain && !resolution.confirmationRequired && profile.customerRootDomainConfirmed
    ? buildCanonicalEcosystemHostname(rootDomain, label)
    : profile.canonicalEcosystemHostname;
  const canonicalBase = hostname ? `https://${hostname}/` : null;

  let canonicalUrlStatus: CanonicalUrlStatus = "pending_domain_confirmation";
  if (profile.customerRootDomainConfirmed && rootDomain) {
    if (profile.dnsStatus === "verified" && profile.sslStatus === "active") canonicalUrlStatus = "active";
    else if (profile.dnsStatus === "verified") canonicalUrlStatus = "pending_ssl";
    else canonicalUrlStatus = "pending_dns";
  } else if (resolution.confirmationRequired) {
    canonicalUrlStatus = "pending_domain_confirmation";
  }

  return {
    customerRootDomain: rootDomain,
    subdomainLabel: label,
    canonicalEcosystemHostname: hostname,
    canonicalEcosystemBaseUrl: profile.dnsStatus === "verified" && profile.sslStatus === "active" ? canonicalBase : null,
    internalFallbackUrl: profile.managedUrl,
    managedCnameTarget: profile.managedHostname,
    requiredCnameHost: label,
    requiredCnameRecordType: "CNAME",
    requiredCnameTtl: profile.requiredCnameTtl,
    fullExpectedHostname: rootDomain ? buildCanonicalEcosystemHostname(rootDomain, label) : null,
    canonicalUrlStatus,
    domainConfirmationRequired: resolution.confirmationRequired && !profile.customerRootDomainConfirmed,
    domainEvidenceSource: resolution.evidenceSource,
    domainEvidenceUrl: resolution.evidenceUrl,
    domainConfirmationReason: resolution.confirmationReason,
  };
}

export function resolveActivePublishBaseUrl(profile: ManagedPublishingProfile | null, slug: string): {
  baseUrl: string;
  mode: "customer_canonical" | "internal_managed";
} {
  if (!profile) {
    return { baseUrl: `https://${slug}.sites.pharmaconnect.uk`.replace(/\/$/, ""), mode: "internal_managed" };
  }
  const state = resolveCustomerEcosystemUrlState(profile);
  if (state.canonicalEcosystemBaseUrl && profile.dnsStatus === "verified" && profile.sslStatus === "active") {
    return { baseUrl: state.canonicalEcosystemBaseUrl.replace(/\/$/, ""), mode: "customer_canonical" };
  }
  return { baseUrl: profile.managedUrl.replace(/\/$/, ""), mode: "internal_managed" };
}

export function validateCustomerEcosystemHostname(hostname: string): void {
  assertRootDomainPublishingBlocked(hostname);
}

export interface CustomerHostMappingEntry {
  hostname: string;
  tenantSlug: string;
  verifiedAt: string;
  dnsStatus: string;
  sslStatus: string;
}

export interface CustomerHostMappingRegistry {
  version: 1;
  generatedAt: string;
  mappings: CustomerHostMappingEntry[];
}

export function readCustomerHostMappingRegistry(): CustomerHostMappingRegistry {
  if (!fs.existsSync(HOST_MAPPING_REGISTRY)) {
    return { version: 1, generatedAt: new Date().toISOString(), mappings: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(HOST_MAPPING_REGISTRY, "utf8")) as CustomerHostMappingRegistry;
  } catch {
    return { version: 1, generatedAt: new Date().toISOString(), mappings: [] };
  }
}

export function writeCustomerHostMappingRegistry(entries: CustomerHostMappingEntry[]): CustomerHostMappingRegistry {
  const registry: CustomerHostMappingRegistry = {
    version: 1,
    generatedAt: new Date().toISOString(),
    mappings: entries.sort((a, b) => a.hostname.localeCompare(b.hostname)),
  };
  fs.mkdirSync(path.dirname(HOST_MAPPING_REGISTRY), { recursive: true });
  fs.writeFileSync(HOST_MAPPING_REGISTRY, JSON.stringify(registry, null, 2));
  return registry;
}

export function syncCustomerHostMappingForProfile(profile: ManagedPublishingProfile): CustomerHostMappingRegistry {
  const state = resolveCustomerEcosystemUrlState(profile);
  const existing = readCustomerHostMappingRegistry().mappings.filter((m) => m.tenantSlug !== profile.slug);
  if (
    state.canonicalEcosystemHostname &&
    profile.customerRootDomainConfirmed &&
    profile.dnsStatus === "verified"
  ) {
    existing.push({
      hostname: state.canonicalEcosystemHostname,
      tenantSlug: profile.slug,
      verifiedAt: profile.dnsLastCheckedAt || new Date().toISOString(),
      dnsStatus: profile.dnsStatus,
      sslStatus: profile.sslStatus,
    });
  }
  return writeCustomerHostMappingRegistry(existing);
}

export function generateNginxCustomerHostMapConf(): string {
  const registry = readCustomerHostMappingRegistry();
  const lines = registry.mappings.map((m) => `    ${m.hostname} ${m.tenantSlug};`);
  return `# Generated customer hostname → tenant mappings\nmap $http_host $customer_tenant_slug {\n    default "";\n${lines.join("\n")}\n}\n`;
}

export function rewriteHtmlBaseUrls(html: string, fromBase: string, toBase: string): string {
  const from = fromBase.replace(/\/$/, "");
  const to = toBase.replace(/\/$/, "");
  if (!from || from === to) return html;
  const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.replace(new RegExp(escaped, "gi"), to);
}

export function rewritePublishedReleaseBaseUrls(
  tenantRoot: string,
  fromBase: string,
  toBase: string,
): { filesRewritten: number } {
  const currentDir = path.join(tenantRoot, "current");
  if (!fs.existsSync(currentDir)) return { filesRewritten: 0 };
  let filesRewritten = 0;
  const stack = [currentDir];
  while (stack.length) {
    const dir = stack.pop()!;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (!/\.(html|xml|json|txt)$/i.test(entry.name)) continue;
      const original = fs.readFileSync(full, "utf8");
      const rewritten = rewriteHtmlBaseUrls(original, fromBase, toBase);
      if (rewritten !== original) {
        fs.writeFileSync(full, rewritten, "utf8");
        filesRewritten += 1;
      }
    }
  }
  return { filesRewritten };
}
