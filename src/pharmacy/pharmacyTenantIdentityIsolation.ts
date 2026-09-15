/**
 * Tenant-scoped identity isolation — compare page copy against the requested
 * tenant's canonical pharmacy name. Own identity is never treated as foreign.
 */
export interface KnownPharmacyIdentity {
  name: string;
  pattern: RegExp;
}

export interface ForeignPharmacyIdentityHit {
  name: string;
  inImageAlt: boolean;
}

/** Catalog of pharmacy identities used to detect cross-tenant contamination. */
export const KNOWN_PHARMACY_IDENTITIES: readonly KnownPharmacyIdentity[] = [
  { name: "Brook Pharmacy", pattern: /Brook Pharmacy/i },
  { name: "Broom Lane Pharmacy", pattern: /Broom Lane Pharmacy/i },
  { name: "Leeds Pharmacy", pattern: /Leeds Pharmacy/i },
  { name: "Yorkshire Pharmacy", pattern: /Yorkshire Pharmacy(?:\s+(?:&amp;|&|and)\s+Health Clinic)?/i },
  { name: "Rowlands Pharmacy", pattern: /Rowlands Pharmacy/i },
  { name: "DHM Digital", pattern: /DHM Digital/i },
  { name: "Banner Cross Pharmacy", pattern: /Banner Cross Pharmacy/i },
  { name: "Reliable Direct Pharmacy", pattern: /Reliable Direct Pharmacy/i },
  { name: "Welfare Pharmacy", pattern: /Welfare Pharmacy/i },
] as const;

function normName(value: string): string {
  return String(value || "")
    .toLowerCase()
    .replace(/&amp;/g, "&")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function requestedTenantIdentityNames(canonicalName: string, tradingName?: string): string[] {
  return [...new Set([canonicalName, tradingName].map((n) => String(n || "").trim()).filter(Boolean))];
}

export function isRequestedTenantIdentity(
  candidate: string,
  canonicalName: string,
  tradingName?: string,
): boolean {
  const candidateNorm = normName(candidate);
  if (!candidateNorm) return false;
  return requestedTenantIdentityNames(canonicalName, tradingName).some((name) => {
    const expected = normName(name);
    return expected.length > 0 && (candidateNorm === expected || candidateNorm.includes(expected) || expected.includes(candidateNorm));
  });
}

export function htmlMatchesRequestedTenantIdentity(
  html: string,
  canonicalName: string,
  tradingName?: string,
): boolean {
  const raw = String(html || "");
  return requestedTenantIdentityNames(canonicalName, tradingName).some((name) => {
    if (!name) return false;
    return raw.includes(name) || raw.includes(name.replace(/&/g, "&amp;"));
  });
}

function extractImageMarkup(html: string): string {
  return (String(html || "").match(/<img\b[^>]*>/gi) || []).join("\n");
}

function stripImageMarkup(html: string): string {
  return String(html || "").replace(/<img\b[^>]*>/gi, " ");
}

function hitsIn(html: string, canonicalName: string, tradingName: string | undefined, inImageAlt: boolean): ForeignPharmacyIdentityHit[] {
  const raw = String(html || "");
  if (!raw) return [];
  const hits: ForeignPharmacyIdentityHit[] = [];
  for (const identity of KNOWN_PHARMACY_IDENTITIES) {
    if (isRequestedTenantIdentity(identity.name, canonicalName, tradingName)) continue;
    if (!identity.pattern.test(raw)) continue;
    hits.push({ name: identity.name, inImageAlt });
  }
  return hits;
}

export function detectForeignPharmacyIdentities(
  html: string,
  canonicalName: string,
  options?: { tradingName?: string; includeImageAlts?: boolean },
): ForeignPharmacyIdentityHit[] {
  const tradingName = options?.tradingName;
  const includeImageAlts = options?.includeImageAlts === true;
  const brandHits = hitsIn(stripImageMarkup(html), canonicalName, tradingName, false);
  if (!includeImageAlts) return brandHits;
  const altHits = detectForeignPharmacyIdentitiesInImageAlts(html, canonicalName, tradingName);
  const seen = new Set(brandHits.map((h) => h.name));
  return [...brandHits, ...altHits.filter((h) => !seen.has(h.name))];
}

export function detectForeignPharmacyIdentitiesInImageAlts(
  html: string,
  canonicalName: string,
  tradingName?: string,
): ForeignPharmacyIdentityHit[] {
  return hitsIn(extractImageMarkup(html), canonicalName, tradingName, true);
}

export function foreignIdentityDetail(hits: ForeignPharmacyIdentityHit[]): string {
  const names = [...new Set(hits.map((h) => h.name))];
  if (!names.length) return "tenant ok";
  return `Foreign identity detected: ${names.join(", ")}`;
}
