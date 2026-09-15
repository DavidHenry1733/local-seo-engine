/**
 * Design lineage revision chain — Website Import → WI → Brand DNA → Component DNA → Canonical Render.
 */
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import type { WebsiteIntelligenceImportV2 } from "./growthEngineWebsiteIntelligenceImportV2Model.ts";
import type { PharmacyProfileData } from "./pharmacyProfileSchema.ts";
import { loadWebsiteImportSources } from "./pharmacyBrandDnaWebsiteImportSources.ts";
import { getPharmacyComponentDnaPath, hasCanonicalComponentDna } from "./masterAdminComponentDnaPersistenceService.ts";
import { loadBrandDnaV1File, getPharmacyBrandDnaPath } from "./pharmacyBrandDnaStore.ts";
import { loadWebsiteDesignEvidence } from "./pharmacyWebsiteDesignCaptureService.ts";
import { computeDesignIntelligenceCompleteness, DESIGN_INTELLIGENCE_MIN_COMPLETENESS } from "./pharmacyDesignIntelligenceCompletenessService.ts";
import { assessDesignImportFallbacks } from "./pharmacyWebsiteImportDesignFallbackPolicy.ts";
import { resolveTenantProfileSlug } from "./pharmacyTenantSlug.ts";
import type { BrandDnaV1 } from "./pharmacyBrandDnaTypes.ts";
import type { ComponentDna } from "./pharmacyComponentDnaTypes.ts";

export class DesignLineageBlockedError extends Error {
  readonly code = "DESIGN_LINEAGE_BLOCKED";
  readonly slug: string;
  readonly reasons: string[];

  constructor(slug: string, reasons: string[]) {
    super(`Design lineage blocked for ${slug}: ${reasons.join("; ")}`);
    this.name = "DesignLineageBlockedError";
    this.slug = slug;
    this.reasons = reasons;
  }
}

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function fileRevision(file: string): string | null {
  if (!fs.existsSync(file)) return null;
  try {
    const stat = fs.statSync(file);
    const content = fs.readFileSync(file, "utf8");
    return sha256(`${stat.mtimeMs}:${content.length}:${content.slice(0, 512)}`);
  } catch {
    return null;
  }
}

export interface WebsiteImportLineage {
  slug: string;
  canonicalWebsiteUrl: string;
  latestImportJobId: string | null;
  importStartedAt: string | null;
  importCompletedAt: string | null;
  importedSourceUrl: string;
  websiteIntelligencePath: string;
  websiteIntelligenceSchemaVersion: number | null;
  websiteIntelligenceModifiedAt: string | null;
  importEvidenceRevision: string;
  importedPageCount: number;
  importedAssetCount: number;
}

export interface DesignLineageSnapshot {
  websiteImportRevision: string;
  websiteIntelligenceRevision: string;
  brandDnaRevision: string;
  componentDnaRevision: string;
  brandDnaStale: boolean;
  componentDnaStale: boolean;
  brandDnaPath: string;
  componentDnaPath: string;
  websiteImport: WebsiteImportLineage;
  fallbackFlags: string[];
  verifiedDesignEvidence: boolean;
  revisionChainComplete: boolean;
}

function readLatestWebsiteImportJobId(slug: string): string | null {
  const jobsFile = path.join(process.cwd(), "data/pharmacy-master-admin/jobs.json");
  if (!fs.existsSync(jobsFile)) return null;
  try {
    const jobs = JSON.parse(fs.readFileSync(jobsFile, "utf8")) as {
      jobs?: Array<{ id?: string; slug?: string; action?: string; status?: string; startedAt?: string; completedAt?: string }>;
    };
    const matches = (jobs.jobs || [])
      .filter((j) => j.slug === slug && j.action === "import_website" && j.status === "completed")
      .sort((a, b) => String(b.completedAt || "").localeCompare(String(a.completedAt || "")));
    return matches[0]?.id || null;
  } catch {
    return null;
  }
}

export function computeBrandDnaRevision(brand: BrandDnaV1 | null): string {
  if (!brand) return "missing";
  return sha256(
    `${brand.frozenAt}:${brand.sourceUrl}:${brand.logoUrl}:${brand.sourceImportRevision || ""}:${brand.colours?.primary || ""}`,
  );
}

export function computeComponentDnaRevision(filePath: string): string {
  return fileRevision(filePath) || "missing";
}

export function computeWebsiteImportRevision(
  profile: PharmacyProfileData,
  intelligence: WebsiteIntelligenceImportV2 | null,
): string {
  const snapshot = profile.websiteImportSnapshot as { importedAt?: string; websiteUrl?: string } | undefined;
  const importedAt = String(snapshot?.importedAt || intelligence?.importedAt || "").trim();
  const websiteUrl = String(snapshot?.websiteUrl || intelligence?.identity?.websiteUrl || profile.website || "").trim();
  return sha256(`wi:${websiteUrl}:${importedAt}:${intelligence?.version ?? 0}`);
}

export function traceWebsiteImportLineage(rawSlug: string): WebsiteImportLineage | null {
  const slug = resolveTenantProfileSlug(rawSlug) || rawSlug;
  const sources = loadWebsiteImportSources(slug);
  if (!sources) return null;

  const snapshot = sources.profile.websiteImportSnapshot as
    | { importedAt?: string; websiteUrl?: string }
    | undefined;
  const intelligence = sources.intelligence;
  const profilePath = path.join(process.cwd(), "data/pharmacy-profiles", `${slug}.json`);

  return {
    slug,
    canonicalWebsiteUrl: String(sources.profile.website || snapshot?.websiteUrl || sources.sourceUrl).trim(),
    latestImportJobId: readLatestWebsiteImportJobId(slug),
    importStartedAt: readLatestWebsiteImportJobId(slug)
      ? (() => {
          try {
            const jobs = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data/pharmacy-master-admin/jobs.json"), "utf8")) as {
              jobs?: Array<{ id?: string; startedAt?: string }>;
            };
            return jobs.jobs?.find((j) => j.id === readLatestWebsiteImportJobId(slug))?.startedAt || null;
          } catch {
            return null;
          }
        })()
      : null,
    importCompletedAt: String(snapshot?.importedAt || sources.importedAt || "").trim() || null,
    importedSourceUrl: sources.sourceUrl,
    websiteIntelligencePath: profilePath,
    websiteIntelligenceSchemaVersion: intelligence?.version ?? null,
    websiteIntelligenceModifiedAt: String(intelligence?.importedAt || snapshot?.importedAt || "").trim() || null,
    importEvidenceRevision: computeWebsiteImportRevision(sources.profile, intelligence),
    importedPageCount: intelligence?.structure?.pages?.length ?? 0,
    importedAssetCount:
      intelligence?.designEvidence?.assets?.filter((a) => a.importStatus === "imported").length ??
      intelligence?.assets?.items?.length ??
      0,
  };
}

export function resolveDesignLineageSnapshot(rawSlug: string): DesignLineageSnapshot | null {
  const slug = resolveTenantProfileSlug(rawSlug) || rawSlug;
  const websiteImport = traceWebsiteImportLineage(slug);
  if (!websiteImport) return null;

  const brandDnaPath = getPharmacyBrandDnaPath(slug);
  const componentDnaPath = getPharmacyComponentDnaPath(slug);
  const brandFile = loadBrandDnaV1File(slug);
  const brandDnaRevision = computeBrandDnaRevision(brandFile);
  const componentDnaRevision = computeComponentDnaRevision(componentDnaPath);

  const brandSourceImportRevision = (brandFile as BrandDnaV1 & { sourceImportRevision?: string })?.sourceImportRevision;
  const brandDnaStale = Boolean(
    brandFile?.source === "website-import" &&
      (!brandSourceImportRevision || brandSourceImportRevision !== websiteImport.importEvidenceRevision),
  );

  let componentDnaStale = false;
  if (fs.existsSync(componentDnaPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(componentDnaPath, "utf8")) as ComponentDna & {
        sourceBrandRevision?: string;
        sourceImportRevision?: string;
      };
      componentDnaStale =
        !raw.sourceImportRevision ||
        raw.sourceImportRevision !== websiteImport.importEvidenceRevision ||
        (raw.sourceBrandRevision && raw.sourceBrandRevision !== brandDnaRevision);
    } catch {
      componentDnaStale = true;
    }
  } else if (brandFile?.source === "website-import") {
    componentDnaStale = true;
  }

  const verifiedDesignEvidence = Boolean(
    brandFile?.source === "website-import" &&
      (brandFile.logoUrl || brandFile.colours?.primary) &&
      (brandFile.navigationLinks?.length || brandFile.navigation?.confirmedItems?.length),
  );

  const fallbackFlags: string[] = [];
  if (!brandFile) fallbackFlags.push("brand-dna-missing");
  if (brandDnaStale) fallbackFlags.push("brand-dna-stale");
  if (!hasCanonicalComponentDna(slug)) fallbackFlags.push("component-dna-missing");
  if (componentDnaStale) fallbackFlags.push("component-dna-stale");
  if (brandFile && !brandFile.navigation?.confirmedItems?.length && !brandFile.navigationLinks?.length) {
    fallbackFlags.push("navigation-evidence-empty");
  }

  const revisionChainComplete =
    Boolean(websiteImport.importEvidenceRevision) &&
    Boolean(brandDnaRevision) &&
    Boolean(componentDnaRevision && componentDnaRevision !== "missing") &&
    !brandDnaStale &&
    !componentDnaStale;

  return {
    websiteImportRevision: websiteImport.importEvidenceRevision,
    websiteIntelligenceRevision: sha256(
      `${websiteImport.websiteIntelligenceModifiedAt}:${websiteImport.websiteIntelligenceSchemaVersion}`,
    ),
    brandDnaRevision,
    componentDnaRevision,
    brandDnaStale,
    componentDnaStale,
    brandDnaPath,
    componentDnaPath,
    websiteImport,
    fallbackFlags,
    verifiedDesignEvidence,
    revisionChainComplete,
  };
}

export function assertDesignLineageReadyForRender(rawSlug: string): DesignLineageSnapshot {
  const snapshot = resolveDesignLineageSnapshot(rawSlug);
  if (!snapshot) {
    throw new DesignLineageBlockedError(rawSlug, ["website-import-evidence-missing"]);
  }

  const blockers: string[] = [];
  if (snapshot.verifiedDesignEvidence) {
    if (!loadBrandDnaV1File(rawSlug)) blockers.push("brand-dna-missing-with-verified-import");
    if (!hasCanonicalComponentDna(rawSlug)) blockers.push("component-dna-missing-with-verified-import");
    if (snapshot.brandDnaStale) blockers.push("brand-dna-stale");
    if (snapshot.componentDnaStale) blockers.push("component-dna-stale");

    const designEvidence = loadWebsiteDesignEvidence(rawSlug);
    const completeness = computeDesignIntelligenceCompleteness(designEvidence);
    const fallback = assessDesignImportFallbacks(designEvidence);
    if (!designEvidence) blockers.push("design-evidence-missing");
    if (!completeness.pass) blockers.push(`design-intelligence-incomplete:${completeness.overall}%`);
    if (completeness.header < DESIGN_INTELLIGENCE_MIN_COMPLETENESS) blockers.push(`header-completeness:${completeness.header}%`);
    if (completeness.footer < DESIGN_INTELLIGENCE_MIN_COMPLETENESS) blockers.push(`footer-completeness:${completeness.footer}%`);
    if (completeness.layout < DESIGN_INTELLIGENCE_MIN_COMPLETENESS) blockers.push(`layout-completeness:${completeness.layout}%`);
    if (completeness.typography < DESIGN_INTELLIGENCE_MIN_COMPLETENESS) blockers.push(`typography-completeness:${completeness.typography}%`);
    if (fallback.blocked || fallback.genericTemplateFallback) blockers.push("design-fallback-threshold-exceeded");
  }

  if (blockers.length) {
    throw new DesignLineageBlockedError(snapshot.websiteImport.slug, blockers);
  }

  return snapshot;
}
