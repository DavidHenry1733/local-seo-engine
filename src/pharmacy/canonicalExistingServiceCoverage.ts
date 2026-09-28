/**
 * One read-only answer for whether an approved service already exists
 * on an imported pharmacy website.
 * Title, H1 and URL are matched through the shared service catalogue.
 * Body text, nav leakage and slug equality alone do not create a service page.
 */
import { CLINICAL_PHARMACY_SERVICE_PATTERNS, serviceDisplayName, servicePatternById } from "./growthEngineWebsiteServiceDetection.ts";
import { NATIONALLY_COMMISSIONED_NHS_COMMUNITY_PHARMACY_SERVICES } from "./serviceSearchDemandNhsEligibility.ts";

export type ServiceCoverageState = "PRESENT" | "NOT_FOUND" | "UNCERTAIN";

export interface ImportedCoveragePage {
  url?: string;
  path?: string;
  title?: string;
  h1?: string;
  category?: string;
  detectedServiceIds?: string[];
}

export interface CanonicalServiceCoverageEvidence {
  source: string;
  url: string;
  title: string;
  h1: string;
  method: string;
  confidence: number;
  sourceRevision: string;
}

export interface CanonicalServiceCoverage {
  serviceId: string;
  canonicalServiceName: string;
  servicePresence: ServiceCoverageState;
  dedicatedServicePage: ServiceCoverageState;
  servicePageUrl: string;
  servicePageTitle: string;
  supportingContent: Array<{ url: string; title: string; type: string }>;
  evidence: CanonicalServiceCoverageEvidence[];
  sourceRevision: string;
}

function str(value: unknown): string {
  return String(value ?? "").trim();
}

function decode(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&#038;/g, "&")
    .replace(/&#8211;/g, "-")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pathname(page: ImportedCoveragePage): string {
  const raw = str(page.path) || str(page.url);
  try {
    return new URL(raw, "https://example.test").pathname.toLowerCase();
  } catch {
    return raw.toLowerCase();
  }
}

function labelPattern(label: string): RegExp | null {
  const core = label.replace(/^nhs\s+/i, "").trim();
  if (core.length < 8) return null;
  const flexible = core.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\?[-/]/g, "[-\\s]").replace(/\s+/g, "\\s+");
  return new RegExp(flexible, "i");
}

function textIdentifies(serviceId: string, text: string): boolean {
  const value = decode(text);
  if (!value) return false;
  const pattern = servicePatternById(serviceId);
  if (pattern?.htmlPatterns.some((re) => re.test(value))) return true;
  const label = NATIONALLY_COMMISSIONED_NHS_COMMUNITY_PHARMACY_SERVICES[serviceId]?.commissioningLabel || "";
  const re = label ? labelPattern(label) : null;
  return Boolean(re && re.test(value));
}

function pathIdentifies(serviceId: string, page: ImportedCoveragePage): boolean {
  const path = pathname(page);
  const pattern = servicePatternById(serviceId);
  return Boolean(pattern?.urlPatterns.some((re) => re.test(path)));
}

function otherServiceIdentifiedByText(serviceId: string, text: string): boolean {
  const value = decode(text);
  if (!value) return false;
  return CLINICAL_PHARMACY_SERVICE_PATTERNS.some((pattern) => pattern.id !== serviceId && pattern.htmlPatterns.some((re) => re.test(value)));
}

function otherServiceIdentifiedByPath(serviceId: string, page: ImportedCoveragePage): boolean {
  const path = pathname(page);
  return CLINICAL_PHARMACY_SERVICE_PATTERNS.some((pattern) => pattern.id !== serviceId && pattern.urlPatterns.some((re) => re.test(path)));
}

function isListing(page: ImportedCoveragePage): boolean {
  if (str(page.category) === "services") return true;
  const path = pathname(page);
  return /\/(services|nhs-services|private-services|our-services)\/?$/.test(path);
}

function isSupport(page: ImportedCoveragePage): boolean {
  const category = str(page.category);
  return category === "blog" || category === "guide" || category === "news";
}

function isDedicatedCategory(page: ImportedCoveragePage): boolean {
  return str(page.category) === "service-page";
}

export function resolveCanonicalServiceCoverage(input: {
  serviceIds: string[];
  pages: ImportedCoveragePage[];
  sourceRevision: string;
}): CanonicalServiceCoverage[] {
  const revision = str(input.sourceRevision);
  const pages = input.pages || [];
  return [...new Set(input.serviceIds.map((id) => str(id)).filter(Boolean))].map((serviceId) => {
    const evidence: CanonicalServiceCoverageEvidence[] = [];
    const supporting: Array<{ url: string; title: string; type: string }> = [];
    let dedicated: { url: string; title: string; confidence: number; method: string } | null = null;
    let listing: { url: string; title: string; confidence: number; method: string } | null = null;
    let uncertain = false;

    for (const page of pages) {
      const title = decode(str(page.title));
      const h1 = decode(str(page.h1));
      const identity = `${title} ${h1}`.trim();
      const pathHit = pathIdentifies(serviceId, page);
      const textHit = textIdentifies(serviceId, title) || textIdentifies(serviceId, h1);
      const contradicted = (pathHit && otherServiceIdentifiedByText(serviceId, identity) && !textHit)
        || (textHit && !pathHit && otherServiceIdentifiedByPath(serviceId, page) && isDedicatedCategory(page));
      if (!pathHit && !textHit) continue;
      if (str(page.category) === "homepage" || str(page.category) === "about" || str(page.category) === "contact") continue;

      const row = {
        source: "website-import",
        url: str(page.url),
        title,
        h1,
        method: pathHit && textHit ? "url-and-title" : pathHit ? "url-pattern" : "title-h1-alias",
        confidence: contradicted ? 40 : pathHit && textHit ? 90 : 75,
        sourceRevision: revision,
      };

      if (contradicted) {
        uncertain = true;
        evidence.push({ ...row, method: "conflicting-url-and-title" });
        continue;
      }

      if (isSupport(page)) {
        supporting.push({ url: str(page.url), title: title || h1, type: str(page.category) || "supporting" });
        evidence.push({ ...row, method: `${row.method}-supporting` });
        continue;
      }

      if (isDedicatedCategory(page) && (textHit || (pathHit && !identity))) {
        const candidate = { url: str(page.url), title: title || h1, confidence: row.confidence, method: row.method };
        if (!dedicated || candidate.confidence > dedicated.confidence) dedicated = candidate;
        evidence.push(row);
        continue;
      }

      if (isDedicatedCategory(page) && pathHit && identity && !textHit) {
        uncertain = true;
        evidence.push({ ...row, method: "url-without-title-confirmation", confidence: 40 });
        continue;
      }

      if (isListing(page) && textHit) {
        listing = { url: str(page.url), title: title || h1, confidence: 70, method: "services-listing-title" };
        evidence.push({ ...row, method: "services-listing-title", confidence: 70 });
      }
    }

    const dedicatedState: ServiceCoverageState = uncertain && !dedicated ? "UNCERTAIN" : dedicated ? "PRESENT" : "NOT_FOUND";
    const presenceState: ServiceCoverageState = dedicated
      ? "PRESENT"
      : uncertain
        ? "UNCERTAIN"
        : listing
          ? "PRESENT"
          : "NOT_FOUND";

    return {
      serviceId,
      canonicalServiceName: serviceDisplayName(serviceId),
      servicePresence: presenceState,
      dedicatedServicePage: dedicatedState,
      servicePageUrl: dedicated?.url || "",
      servicePageTitle: dedicated?.title || "",
      supportingContent: supporting,
      evidence,
      sourceRevision: revision,
    };
  });
}
