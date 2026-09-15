/**
 * Sprint 8A / Defect 048 — Component DNA persistence via existing locked builder.
 * Writes canonical tenant file only; does not modify brand-dna.json.
 */
import fs from "node:fs";
import path from "node:path";
import { resolveComponentsFromWebsiteEvidence } from "./pharmacyBrandDnaComponentResolver.ts";
import { resolveComponentDna } from "./pharmacyComponentDnaResolver.ts";
import { normalizeComponentDna } from "./pharmacyComponentDnaNormalize.ts";
import { getPharmacyBrandDnaPath, loadBrandDnaV1File } from "./pharmacyBrandDnaStore.ts";
import type { ComponentDna } from "./pharmacyComponentDnaTypes.ts";
import type { BrandDnaV1 } from "./pharmacyBrandDnaTypes.ts";
import { safePharmacySlug, WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";
import { computeWebsiteImportRevision, computeBrandDnaRevision } from "./pharmacyDesignLineageRevisionService.ts";
import { loadWebsiteImportSources } from "./pharmacyBrandDnaWebsiteImportSources.ts";
import { loadWebsiteDesignEvidence } from "./pharmacyWebsiteDesignCaptureService.ts";
import { applyDesignEvidenceToComponentDna } from "./pharmacyDesignEvidenceApplication.ts";

const REQUIRED_COVERAGE_KEYS: Array<keyof ComponentDna> = [
  "header",
  "footer",
  "hero",
  "splitSection",
  "image",
  "map",
  "card",
  "cta",
  "contact",
  "faq",
  "process",
  "trust",
];

export function getPharmacyComponentDnaPath(slug: string): string {
  return path.join(WORKSPACE_ROOT, "data", "pharmacy-component-dna", `${safePharmacySlug(slug)}.json`);
}

export function getPharmacyBrandDnaExtractionEvidencePath(slug: string): string {
  return path.join(path.dirname(getPharmacyBrandDnaPath(slug)), "brand-dna-extraction-evidence.json");
}

export function componentDnaCoveragePass(dna: ComponentDna): boolean {
  for (const key of REQUIRED_COVERAGE_KEYS) {
    const section = dna[key];
    if (!section || typeof section !== "object" || !Object.keys(section as object).length) return false;
  }
  const header = dna.header;
  if (!header.navigationVariant || !header.desktopBreakpoint || !header.mobileBreakpoint) return false;
  return true;
}

export interface ComponentDnaPersistenceResult {
  ok: boolean;
  slug: string;
  path: string;
  persisted: boolean;
  builderUsed: boolean;
  coveragePass: boolean;
  candidateFound: boolean;
  evidencePath: string;
  evidenceLoaded: boolean;
  brandDnaPath: string;
  error?: string;
}

function loadWebsiteExtractionEvidence(slug: string): Record<string, { value?: unknown; confidence?: number; extractionMethod?: string; source?: string }> {
  const evidencePath = getPharmacyBrandDnaExtractionEvidencePath(slug);
  if (!fs.existsSync(evidencePath)) return {};
  try {
    const raw = JSON.parse(fs.readFileSync(evidencePath, "utf8")) as {
      fields?: Record<string, { confidence?: number; extractionMethod?: string; source?: string; value?: unknown }>;
    };
    return raw.fields || {};
  } catch {
    return {};
  }
}

/** Resolve Component DNA using the existing locked builder chain (no model changes). */
export function buildComponentDnaFromBrandEvidence(slug: string): {
  ok: boolean;
  componentDna?: ComponentDna;
  brand?: BrandDnaV1;
  evidencePath: string;
  evidenceLoaded: boolean;
  candidateFound: boolean;
  error?: string;
} {
  const safe = safePharmacySlug(slug);
  const brand = loadBrandDnaV1File(safe);
  if (!brand) {
    return { ok: false, evidencePath: getPharmacyBrandDnaExtractionEvidencePath(safe), evidenceLoaded: false, candidateFound: false, error: "brand-dna.json missing" };
  }

  const evidencePath = getPharmacyBrandDnaExtractionEvidencePath(safe);
  const evidence = loadWebsiteExtractionEvidence(safe);
  const evidenceLoaded = Object.keys(evidence).length > 0;
  const candidateFound = evidenceLoaded || Boolean(brand.layout && brand.surfaces);

  const resolved = resolveComponentsFromWebsiteEvidence(safe, evidence, brand);
  const withComponents: BrandDnaV1 = {
    ...brand,
    components: resolved.components,
    componentEvidence: resolved.componentEvidence,
  };
  let componentDna = normalizeComponentDna(resolveComponentDna(withComponents));

  const designEvidence =
    loadWebsiteImportSources(safe)?.intelligence?.designEvidence || loadWebsiteDesignEvidence(safe);
  if (designEvidence) {
    componentDna = applyDesignEvidenceToComponentDna(brand, designEvidence);
  }

  return {
    ok: true,
    componentDna,
    brand,
    evidencePath,
    evidenceLoaded,
    candidateFound,
  };
}

export function persistComponentDnaFromBrandEvidence(slug: string, options?: { force?: boolean }): ComponentDnaPersistenceResult {
  const safe = safePharmacySlug(slug);
  const targetPath = getPharmacyComponentDnaPath(safe);
  const brandDnaPath = getPharmacyBrandDnaPath(safe);

  if (fs.existsSync(targetPath) && !options?.force) {
    try {
      const existing = JSON.parse(fs.readFileSync(targetPath, "utf8")) as ComponentDna;
      if (Object.keys(existing).length > 0) {
        return {
          ok: true,
          slug: safe,
          path: targetPath,
          persisted: true,
          builderUsed: false,
          coveragePass: componentDnaCoveragePass(existing),
          candidateFound: true,
          evidencePath: getPharmacyBrandDnaExtractionEvidencePath(safe),
          evidenceLoaded: fs.existsSync(getPharmacyBrandDnaExtractionEvidencePath(safe)),
          brandDnaPath,
        };
      }
    } catch {
      /* rebuild below */
    }
  }

  const built = buildComponentDnaFromBrandEvidence(safe);
  if (!built.ok || !built.componentDna) {
    return {
      ok: false,
      slug: safe,
      path: targetPath,
      persisted: false,
      builderUsed: true,
      coveragePass: false,
      candidateFound: built.candidateFound,
      evidencePath: built.evidencePath,
      evidenceLoaded: built.evidenceLoaded,
      brandDnaPath,
      error: built.error || "Component DNA build failed",
    };
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const sources = loadWebsiteImportSources(safe);
  const sourceImportRevision = sources
    ? computeWebsiteImportRevision(sources.profile, sources.intelligence)
    : (built.brand as BrandDnaV1 & { sourceImportRevision?: string }).sourceImportRevision;
  const brandRevision = computeBrandDnaRevision(built.brand || null);
  const payload = {
    ...built.componentDna,
    version: "component-dna-v1",
    sourceBrandRevision: brandRevision,
    sourceImportRevision,
    generatedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(targetPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  return {
    ok: true,
    slug: safe,
    path: targetPath,
    persisted: true,
    builderUsed: true,
    coveragePass: componentDnaCoveragePass(built.componentDna),
    candidateFound: built.candidateFound,
    evidencePath: built.evidencePath,
    evidenceLoaded: built.evidenceLoaded,
    brandDnaPath,
  };
}

export function ensureComponentDnaPersisted(slug: string): ComponentDnaPersistenceResult {
  return persistComponentDnaFromBrandEvidence(slug);
}

export function hasCanonicalComponentDna(slug: string): boolean {
  const file = getPharmacyComponentDnaPath(slug);
  if (!fs.existsSync(file)) return false;
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
    return Object.keys(raw).length > 0;
  } catch {
    return false;
  }
}
