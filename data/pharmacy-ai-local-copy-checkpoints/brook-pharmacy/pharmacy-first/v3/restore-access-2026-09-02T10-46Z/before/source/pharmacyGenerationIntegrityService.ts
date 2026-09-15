/**
 * Generation integrity — service source lock, validation, and generation reports.
 */
import fs from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";
import { validateMapInHtml } from "./pharmacyMapResolver.ts";
import { getServicePublishMeta } from "./pharmacyMasterPublishConfig.ts";
import { writeCanonicalMasterPublishPage, writeMasterPublishPage } from "./pharmacyMasterPublishRenderer.ts";
import { buildPharmacyServicePageProfile } from "./pharmacyServicePageProfileContext.ts";
import { resolveTenantProfileSlug } from "./pharmacyTenantSlug.ts";
import { PHARMACY_WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";
import { validatePharmacyServicePageHtml } from "./pharmacyVisualExperienceLayoutV3.ts";
import { VISUAL_EXPERIENCE_BENCHMARK_SERVICES, type VisualExperienceServiceId } from "./pharmacyVisualExperienceConfig.ts";
import { loadPharmacyProfile } from "./pharmacyContentBlueprintService.ts";
import { readPharmacyCampaignStore } from "./pharmacyCampaignService.ts";
import {
  validateLocalClusterQuality,
  type LocalClusterQualityValidation,
} from "./pharmacyLocalClusterQualityValidation.ts";
import {
  validateLongFormQuality,
  type LongFormQualityValidation,
} from "./contentEngine/pharmacyLongFormQualityValidation.ts";
import { buildContentGenerationContext } from "./contentEngine/buildContentGenerationContext.ts";
import type { ContentGenerationContext } from "./contentEngine/contentGenerationContextTypes.ts";
import { countLegacyClusterReferencesInHtml, isAuthorisedOutputArchiveDir } from "./pharmacyClusterPageUrlResolver.ts";

export const GENERATION_INTEGRITY_VERSION = "long-form-supporting-content-lockdown-v1";

export const PHARMACY_FIRST_BODY_PHRASES = [
  "Pharmacy First is an NHS advanced service",
  "seven common conditions",
  "impetigo",
  "infected insect bites",
  "uncomplicated urinary tract infections",
  "What Pharmacy First is",
  "FeverPAIN",
  "Group A Streptococcus",
] as const;

export interface ServiceContentValidation {
  ok: boolean;
  foreignServiceContentDetected: string[];
  errors: string[];
}

export interface SectionCompletenessValidation {
  ok: boolean;
  sectionsExpected: string[];
  sectionsFound: string[];
  sectionsMissing: string[];
  emptySections: string[];
}

export interface EcosystemTenantValidation {
  ok: boolean;
  detail: string;
  foreignTenantAssetsDetected: string[];
  foreignTenantAssetPaths: string[];
  fallbackToDefaultSlugDetected: boolean;
}

export interface LocalClusterValidation {
  ok: boolean;
  detail: string;
  selectedAreasExpected: number;
  localClusterPagesGenerated: number;
}

export interface InternalLinkValidation {
  ok: boolean;
  detail: string;
  legacyClusterReferences?: number;
  brokenLinks?: number;
}

export interface ManifestAccuracyValidation {
  ok: boolean;
  detail: string;
}

export interface MapValidationResult {
  ok: boolean;
  detail: string;
}

export interface DesignMapValidation {
  ok: boolean;
  detail: string;
  servicePageMapValidation: MapValidationResult;
  localPageMapValidation: MapValidationResult;
  localPageDesignValidation: MapValidationResult;
  headerFooterParity: MapValidationResult;
  brandParity: MapValidationResult;
  nearbyAreaLinksCount: number;
  mapValidation: MapValidationResult;
  moneyLinksCount: number;
  internalLinksCount: number;
}

export interface GenerationReport {
  slug: string;
  resolvedSlug: string;
  serviceId: string;
  serviceName: string;
  generatedAt: string;
  generatorVersion: string;
  selectedAreas: string[];
  profileLoaded: boolean;
  profileName: string;
  campaignLoaded: boolean;
  campaignServiceId: string | null;
  brandLoaded: boolean;
  imageAssignmentsLoaded: boolean;
  selectedServiceConfigPath: string | null;
  serviceMasterPath: string | null;
  masterPublishPath: string | null;
  clinicalReferencePath: string | null;
  visualOutputPath: string | null;
  contentEcosystemPath: string | null;
  localClusterOutputPaths: string[];
  assetsGenerated: string[];
  sectionsExpected: string[];
  sectionsFound: string[];
  sectionsMissing: string[];
  foreignServiceContentDetected: string[];
  tenantValidation: { ok: boolean; detail: string };
  serviceValidation: { ok: boolean; detail: string };
  packageValidation: { ok: boolean; detail: string };
  ecosystemTenantValidation: EcosystemTenantValidation;
  localClusterValidation: LocalClusterValidation;
  selectedAreasExpected: number;
  localClusterPagesGenerated: number;
  foreignTenantAssetsDetected: string[];
  foreignTenantAssetPaths: string[];
  fallbackToDefaultSlugDetected: boolean;
  internalLinkValidation: InternalLinkValidation;
  manifestAccuracyValidation: ManifestAccuracyValidation;
  designMapValidation: DesignMapValidation;
  localClusterQualityValidation: LocalClusterQualityValidation;
  longFormQualityValidation: LongFormQualityValidation;
  errors: string[];
  warnings: string[];
}

const REQUIRED_VISUAL_SECTIONS = [
  "hero",
  "service-definition",
  "process",
  "safety",
  "faq",
  "professional-review",
  "local-access",
  "cta",
] as const;

function reportPath(slug: string, serviceId: string): string {
  const key = resolveTenantProfileSlug(slug) || slug;
  return path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-generation-reports", key, `${serviceId}.json`);
}

export function loadGenerationReport(slug: string, serviceId: string): GenerationReport | null {
  const file = reportPath(slug, serviceId);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as GenerationReport;
  } catch {
    return null;
  }
}

export function saveGenerationReport(report: GenerationReport): string {
  const file = reportPath(report.resolvedSlug, report.serviceId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(report, null, 2));
  return file;
}

/** Strict service master resolution — never falls back to pharmacy-first or another service. */
export function resolveStrictServiceMasterLibraryPath(serviceId: string): string | null {
  const meta = getServicePublishMeta(serviceId);
  if (!meta) return null;
  const root = PHARMACY_WORKSPACE_ROOT;
  const candidates = [
    path.join("docs/pharmacy-master-library", meta.masterFile),
    path.join("docs/pharmacy-master-library/research", `${serviceId}-research-v1.md`),
    path.join("docs/pharmacy-service-intelligence", `${serviceId}-master-v1.md`),
  ];
  for (const rel of candidates) {
    const abs = path.join(root, rel);
    if (fs.existsSync(abs)) return rel;
  }
  return null;
}

function extractMainBodyText(html: string): string {
  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch) return mainMatch[1] || "";
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return bodyMatch?.[1] || html;
}

export function validateServiceBodyContent(html: string, serviceId: string): ServiceContentValidation {
  const errors: string[] = [];
  const foreign: string[] = [];
  const main = extractMainBodyText(html).toLowerCase();
  const meta = getServicePublishMeta(serviceId);
  const serviceName = (meta?.serviceName || serviceId.replace(/-/g, " ")).toLowerCase();

  if (serviceId !== "pharmacy-first") {
    for (const phrase of PHARMACY_FIRST_BODY_PHRASES) {
      if (main.includes(phrase.toLowerCase())) {
        foreign.push(phrase);
      }
    }
  }

  if (serviceId === "blood-pressure-checks") {
    if (!main.includes("blood pressure")) {
      errors.push("Missing blood pressure body content");
    }
  } else if (serviceId === "pharmacy-first") {
    if (!main.includes("pharmacy first")) {
      errors.push("Missing Pharmacy First body content");
    }
  } else if (serviceName.length > 4 && !main.includes(serviceName.split(" ")[0] || serviceName)) {
    const token = serviceName.split(" ")[0];
    if (token && token.length > 3 && !main.includes(token)) {
      errors.push(`Missing expected service token: ${token}`);
    }
  }

  return {
    ok: foreign.length === 0 && errors.length === 0,
    foreignServiceContentDetected: foreign,
    errors,
  };
}

export function validateSectionCompleteness(html: string, serviceId?: string): SectionCompletenessValidation {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const body = bodyMatch?.[1] || html;
  const mainMatch = body.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  const main = mainMatch?.[1] || body;

  const found: string[] = [];
  const missing: string[] = [];
  const empty: string[] = [];

  const expectsFaq =
    /faq-accordion|data-template-block="faq"|Common Patient Questions|service-faq|id="faq-section"/i.test(main) ||
    isHeadingOnlySection(main, /Common Patient Questions|Common Questions|Frequently Asked/i);

  const sectionIds = REQUIRED_VISUAL_SECTIONS.filter((s) => s !== "faq" || expectsFaq);

  const checks: Record<string, () => boolean> = {
    hero: () => /hero-grid|class="hero"/.test(main) && /<h1[^>]*>[\s\S]+?<\/h1>/i.test(main),
    "service-definition": () => {
      const prose = stripTags(main);
      if (serviceId === "blood-pressure-checks") {
        return /What Blood Pressure|blood pressure checks/i.test(main) && prose.toLowerCase().includes("blood pressure");
      }
      return (
        /data-template-block="service-definition"|What .+ Are|What .+ Is/i.test(main) &&
        stripTags(main.match(/data-template-block="service-definition"[\s\S]*?(?=data-template-block|$)/i)?.[0] || main).length > 80
      );
    },
    process: () =>
      (/data-template-block="process"|APPOINTMENT PROCESS|process-grid|process-timeline|What Happens During/i.test(main) &&
        !isHeadingOnlySection(main, /APPOINTMENT PROCESS|process-grid|What Happens During/i)) ||
      (/process-step/.test(main) && stripTags(main).length > 200),
    safety: () => {
      const safetyBlock =
        main.match(/data-template-block="safety"[\s\S]*?<\/section>/i)?.[0] ||
        main.match(/Trust And Safety[\s\S]{0,3000}/i)?.[0] ||
        "";
      return (
        /data-template-block="safety"|Clinical environment|safety-prose|Trust And Safety|content-card--safety/i.test(main) &&
        stripTags(safetyBlock || main).length > 40
      );
    },
    faq: () =>
      (/faq-accordion|data-component="faq-accordion"|data-template-block="faq"|class="faq"|Common Patient Questions|service-faq|Common Questions/i.test(main) &&
        (/faq-a|faq-answer|cluster-faq-item/.test(main) || /faq-item/.test(main)) &&
        !isHeadingOnlySection(main, /faq|Common Patient Questions|Common Questions/i)) ||
      (/faq-item/.test(main) && /<div class="faq-answer">[\s\S]+?<\/div>/i.test(main)),
    "professional-review": () => /pharmacy-professional-review-panel|profile-review-bio|professional-review/i.test(main),
    "local-access": () =>
      /data-component="pharmacy-local-map"|data-template-block="local"|For Patients In|local access|id="local-access"/i.test(main),
    cta: () => /cta-band|Book .+ at|Call .+ on/i.test(main),
  };

  for (const section of sectionIds) {
    const ok = checks[section]?.() ?? false;
    if (ok) found.push(section);
    else missing.push(section);
  }

  for (const label of ["APPOINTMENT PROCESS", "Clinical environment", "Common Patient Questions"]) {
    if (isHeadingOnlySection(main, new RegExp(label, "i"))) empty.push(label);
  }

  return {
    ok: missing.length === 0 && empty.length === 0,
    sectionsExpected: [...sectionIds],
    sectionsFound: found,
    sectionsMissing: missing,
    emptySections: empty,
  };
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function isHeadingOnlySection(main: string, pattern: RegExp): boolean {
  const $ = cheerio.load(`<div id="root">${main}</div>`);
  const head = $("*")
    .filter((_, el) => pattern.test($(el).text()))
    .first();
  if (!head.length) return false;
  const section = head.closest("section, .panel, .section-head").parent();
  const text = stripTags(section.length ? section.html() || "" : head.parent().html() || "");
  const heading = stripTags(head.text());
  return text.length > 0 && text.replace(heading, "").trim().length < 40;
}

export function masterPublishPath(slug: string, serviceId: string): string {
  const key = resolveTenantProfileSlug(slug) || slug;
  return path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-master-publish", key, serviceId, "index.html");
}

export function visualOutputPath(slug: string, serviceId: string): string {
  const key = resolveTenantProfileSlug(slug) || slug;
  return path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-visual-experience", key, serviceId, "index.html");
}

function validatedClinicalReferencePath(serviceId: string): string | null {
  const refPath = masterPublishPath("pharmaconnect", serviceId);
  if (!fs.existsSync(refPath)) return null;
  const html = fs.readFileSync(refPath, "utf8");
  const check = validateServiceBodyContent(html, serviceId);
  return check.ok ? refPath : null;
}

export function ensureServiceMasterPublish(
  slug: string,
  selectedServiceId: string,
  localArea: string,
  report: GenerationReport,
  forceRebuild = true,
  options: { skipCanonicalPublishCopy?: boolean; contentContext?: ContentGenerationContext } = {},
): string {
  const key = resolveTenantProfileSlug(slug) || slug;
  const tenantPath = masterPublishPath(key, selectedServiceId);

  if (fs.existsSync(tenantPath)) {
    const existing = fs.readFileSync(tenantPath, "utf8");
    const check = validateServiceBodyContent(existing, selectedServiceId);
    if (!check.ok && forceRebuild) {
      fs.unlinkSync(tenantPath);
      report.warnings.push(`Removed invalid master publish: ${check.foreignServiceContentDetected.join(", ")}`);
    } else if (check.ok && !forceRebuild) {
      report.masterPublishPath = tenantPath;
      return tenantPath;
    }
  }

  const masterRel = resolveStrictServiceMasterLibraryPath(selectedServiceId);
  if (masterRel) {
    const meta = getServicePublishMeta(selectedServiceId)!;
    const publishInput = {
      slug: key,
      serviceId: selectedServiceId,
      serviceName: meta.serviceName,
      masterRelativePath: masterRel,
      localArea,
      urlPath: meta.urlPath,
      contentContext: options.contentContext,
    };
    const result = options.skipCanonicalPublishCopy
      ? writeMasterPublishPage(publishInput, selectedServiceId)
      : writeCanonicalMasterPublishPage(publishInput);
    report.serviceMasterPath = masterRel;
    report.masterPublishPath = result.outputPath;
    const check = validateServiceBodyContent(fs.readFileSync(result.outputPath, "utf8"), selectedServiceId);
    if (!check.ok) {
      throw new Error(`Master publish failed service validation: ${check.foreignServiceContentDetected.join(", ")}`);
    }
    return result.outputPath;
  }

  const refPath = validatedClinicalReferencePath(selectedServiceId);
  if (refPath && key !== "pharmaconnect") {
    report.clinicalReferencePath = refPath;
    report.warnings.push("Markdown master missing — using validated clinical reference for visual generation");
    fs.mkdirSync(path.dirname(tenantPath), { recursive: true });
    fs.copyFileSync(refPath, tenantPath);
    report.masterPublishPath = tenantPath;
    return tenantPath;
  }

  if (refPath && key === "pharmaconnect") {
    report.masterPublishPath = refPath;
    return refPath;
  }

  throw new Error(
    "We could not create this content package because the selected service content is missing.",
  );
}

export function createGenerationReportBase(slug: string, selectedServiceId: string): GenerationReport {
  const key = resolveTenantProfileSlug(slug) || slug;
  const meta = getServicePublishMeta(selectedServiceId);
  let profileName = "";
  let profileLoaded = false;
  let selectedAreas: string[] = [];
  try {
    const profileDoc = loadPharmacyProfile(key);
    profileLoaded = true;
    profileName = profileDoc.data?.pharmacyName || "";
    selectedAreas = (profileDoc.data?.selectedAreas || [])
      .filter((a) => a.selected !== false)
      .map((a) => a.areaName);
  } catch {
    profileLoaded = false;
  }

  const campaign = readPharmacyCampaignStore(key);

  return {
    slug,
    resolvedSlug: key,
    serviceId: selectedServiceId,
    serviceName: meta?.serviceName || selectedServiceId.replace(/-/g, " "),
    generatedAt: new Date().toISOString(),
    generatorVersion: GENERATION_INTEGRITY_VERSION,
    selectedAreas,
    profileLoaded,
    profileName,
    campaignLoaded: Boolean(campaign),
    campaignServiceId: campaign?.campaigns?.find((c) => c.status === "active")?.serviceId || null,
    brandLoaded: profileLoaded,
    imageAssignmentsLoaded: fs.existsSync(
      path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-image-assignments", `${key}.json`),
    ),
    selectedServiceConfigPath: meta ? `pharmacyMasterPublishConfig:${selectedServiceId}` : null,
    serviceMasterPath: null,
    masterPublishPath: null,
    clinicalReferencePath: null,
    visualOutputPath: null,
    contentEcosystemPath: null,
    localClusterOutputPaths: [],
    assetsGenerated: [],
    sectionsExpected: [...REQUIRED_VISUAL_SECTIONS],
    sectionsFound: [],
    sectionsMissing: [],
    foreignServiceContentDetected: [],
    tenantValidation: { ok: true, detail: "pending" },
    serviceValidation: { ok: true, detail: "pending" },
    packageValidation: { ok: true, detail: "pending" },
    ecosystemTenantValidation: {
      ok: true,
      detail: "pending",
      foreignTenantAssetsDetected: [],
      foreignTenantAssetPaths: [],
      fallbackToDefaultSlugDetected: false,
    },
    localClusterValidation: {
      ok: true,
      detail: "pending",
      selectedAreasExpected: selectedAreas.length,
      localClusterPagesGenerated: 0,
    },
    selectedAreasExpected: selectedAreas.length,
    localClusterPagesGenerated: 0,
    foreignTenantAssetsDetected: [],
    foreignTenantAssetPaths: [],
    fallbackToDefaultSlugDetected: false,
    internalLinkValidation: { ok: true, detail: "pending" },
    manifestAccuracyValidation: { ok: true, detail: "pending" },
    designMapValidation: {
      ok: true,
      detail: "pending",
      servicePageMapValidation: { ok: true, detail: "pending" },
      localPageMapValidation: { ok: true, detail: "pending" },
      localPageDesignValidation: { ok: true, detail: "pending" },
      headerFooterParity: { ok: true, detail: "pending" },
      brandParity: { ok: true, detail: "pending" },
      nearbyAreaLinksCount: 0,
      mapValidation: { ok: true, detail: "pending" },
      moneyLinksCount: 0,
      internalLinksCount: 0,
    },
    localClusterQualityValidation: {
      ok: true,
      detail: "pending",
      localPagesExpected: 0,
      localPagesGenerated: 0,
      localPagesWithImages: 0,
      localPagesWithBusinessMap: 0,
      localPagesWithAreaSpecificCopy: 0,
      localPagesWithInternalLinks: 0,
      localPagesWithMoneyLinks: 0,
      duplicateCopyWarnings: [],
      emptySectionsDetected: [],
      localIntelligenceUsed: 0,
      failedLocalPages: [],
      servicePageLinksAllLocalAreas: true,
      localCopyDepthValidation: { ok: true, detail: "pending", minWordCount: 350, pagesBelowMin: [] },
      localSimilarityScores: [],
      areaPrefixDetected: [],
      mapUsesBusinessLocation: true,
      servicePageLocalLinksCount: 0,
      localNearbyLinksCount: 0,
      irrelevantSectionsDetected: [],
      localPageWordCounts: {},
      localPageImageCounts: {},
      failedLocalQualityReasons: [],
    },
    longFormQualityValidation: {
      ok: true,
      detail: "pending",
      longFormTenantDepthValidation: { ok: true, detail: "pending" },
      forbiddenHedgingDetected: [],
      tenantMentionsBySection: {},
      serviceMentionsBySection: {},
      ctaPlacementValidation: { ok: true, detail: "pending" },
      reviewerPlacementValidation: { ok: true, detail: "pending" },
      genericLongFormWarnings: [],
      failedLongFormAssets: [],
      supportingTemplateValidation: { ok: true, detail: "pending", failedPages: [] },
    },
    errors: [],
    warnings: [],
  };
}

function ecosystemRootPath(slug: string, serviceId: string): string {
  const key = resolveTenantProfileSlug(slug) || slug;
  return path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-content-ecosystem", key, serviceId);
}

function listEcosystemHtmlFiles(ecoRoot: string): string[] {
  if (!fs.existsSync(ecoRoot)) return [];
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".html")) out.push(full);
    }
  };
  for (const sub of ["pages", "local"]) {
    const dir = path.join(ecoRoot, sub);
    if (fs.existsSync(dir)) walk(dir);
  }
  return out;
}

export function validateEcosystemTenant(
  slug: string,
  serviceId: string,
  pharmacyName: string,
): EcosystemTenantValidation {
  const key = resolveTenantProfileSlug(slug) || slug;
  const ecoRoot = ecosystemRootPath(key, serviceId);
  const foreignTenantAssetsDetected: string[] = [];
  const foreignTenantAssetPaths: string[] = [];
  let fallbackToDefaultSlugDetected = false;

  if (!fs.existsSync(ecoRoot)) {
    return {
      ok: false,
      detail: "Ecosystem output missing",
      foreignTenantAssetsDetected,
      foreignTenantAssetPaths,
      fallbackToDefaultSlugDetected: false,
    };
  }

  const indexPath = path.join(ecoRoot, "_ecosystem-index.json");
  if (fs.existsSync(indexPath)) {
    const indexRaw = fs.readFileSync(indexPath, "utf8");
    if (indexRaw.includes("/pharmacy-content-ecosystem/pharmaconnect/") && key !== "pharmaconnect") {
      fallbackToDefaultSlugDetected = true;
    }
    try {
      const index = JSON.parse(indexRaw) as { slug?: string };
      if (index.slug && index.slug !== key) fallbackToDefaultSlugDetected = true;
    } catch {
      /* ignore */
    }
  }

  for (const file of listEcosystemHtmlFiles(ecoRoot)) {
    const html = fs.readFileSync(file, "utf8");
    if (key !== "pharmaconnect" && /Brook Pharmacy/i.test(html)) {
      foreignTenantAssetsDetected.push(path.basename(path.dirname(file)) || path.basename(file));
      foreignTenantAssetPaths.push(file);
    }
    if (html.includes("/pharmacy-content-ecosystem/pharmaconnect/") && key !== "pharmaconnect") {
      fallbackToDefaultSlugDetected = true;
      foreignTenantAssetPaths.push(file);
    }
  }

  for (const pack of ["social-posts.json", "gbp-posts.json", "email-sequence.json"]) {
    const packPath = path.join(ecoRoot, "packs", pack);
    if (!fs.existsSync(packPath)) continue;
    const raw = fs.readFileSync(packPath, "utf8");
    if (key !== "pharmaconnect" && /Brook Pharmacy/i.test(raw)) {
      foreignTenantAssetsDetected.push(pack);
      foreignTenantAssetPaths.push(packPath);
    }
  }

  const ok =
    foreignTenantAssetsDetected.length === 0 &&
    !fallbackToDefaultSlugDetected &&
    (key === "pharmaconnect" || Boolean(pharmacyName));

  return {
    ok,
    detail: ok
      ? "ecosystem tenant ok"
      : [
          foreignTenantAssetsDetected.length ? `foreign assets: ${foreignTenantAssetsDetected.join(", ")}` : "",
          fallbackToDefaultSlugDetected ? "pharmaconnect fallback detected" : "",
        ]
          .filter(Boolean)
          .join("; ") || "ecosystem tenant validation failed",
    foreignTenantAssetsDetected,
    foreignTenantAssetPaths,
    fallbackToDefaultSlugDetected,
  };
}

export function validateLocalClusterPages(
  slug: string,
  serviceId: string,
  selectedAreas: string[],
): LocalClusterValidation {
  const key = resolveTenantProfileSlug(slug) || slug;
  const ecoRoot = ecosystemRootPath(key, serviceId);
  const expected = selectedAreas.length;
  let generated = 0;

  if (fs.existsSync(path.join(ecoRoot, "_ecosystem-index.json"))) {
    try {
      const index = JSON.parse(fs.readFileSync(path.join(ecoRoot, "_ecosystem-index.json"), "utf8")) as {
        localClusterPagesGenerated?: number;
        assets?: Array<{ id: string; outputPath: string }>;
      };
      generated =
        index.localClusterPagesGenerated ??
        (index.assets || []).filter((a) => a.id.startsWith("local-cluster-")).length;
    } catch {
      generated = 0;
    }
  }

  if (generated === 0 && fs.existsSync(path.join(ecoRoot, "local"))) {
    generated = fs
      .readdirSync(path.join(ecoRoot, "local"), { withFileTypes: true })
      .filter((d) => d.isDirectory()).length;
  }

  const ok = expected === 0 ? generated >= 0 : generated === expected;
  return {
    ok,
    detail: ok
      ? `${generated}/${expected} local cluster pages`
      : `Expected ${expected} local cluster pages, generated ${generated}`,
    selectedAreasExpected: expected,
    localClusterPagesGenerated: generated,
  };
}

export function validateInternalLinkMap(slug: string, serviceId: string): InternalLinkValidation {
  const key = resolveTenantProfileSlug(slug) || slug;
  const ecoRoot = ecosystemRootPath(key, serviceId);
  const mapPath = path.join(ecoRoot, "_internal-link-map.json");
  if (!fs.existsSync(mapPath)) {
    return { ok: false, detail: "Internal link map missing", legacyClusterReferences: 0, brokenLinks: 0 };
  }
  try {
    const map = JSON.parse(fs.readFileSync(mapPath, "utf8")) as {
      slug?: string;
      localClusterPages?: unknown[];
    };
    if (map.slug !== key) return { ok: false, detail: `Link map slug mismatch: ${map.slug}`, legacyClusterReferences: 0, brokenLinks: 0 };
    const raw = fs.readFileSync(mapPath, "utf8");
    if (key !== "pharmaconnect" && /\/pharmacy-content-ecosystem\/pharmaconnect\//.test(raw)) {
      return { ok: false, detail: "Link map references pharmaconnect ecosystem paths", legacyClusterReferences: 0, brokenLinks: 0 };
    }

    let legacyClusterReferences = 0;
    const walkHtml = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (isAuthorisedOutputArchiveDir(entry.name)) continue;
          walkHtml(full);
        } else if (entry.name.endsWith(".html")) {
          legacyClusterReferences += countLegacyClusterReferencesInHtml(fs.readFileSync(full, "utf8"));
        }
      }
    };
    walkHtml(ecoRoot);
    const finalRenderRoot = path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-final-render", key);
    walkHtml(finalRenderRoot);

    if (legacyClusterReferences > 0) {
      return {
        ok: false,
        detail: `${legacyClusterReferences} legacy cluster-cluster reference(s) in output HTML`,
        legacyClusterReferences,
        brokenLinks: 0,
      };
    }

    return {
      ok: true,
      detail: `${map.localClusterPages?.length || 0} local pages mapped; legacy cluster references: 0`,
      legacyClusterReferences: 0,
      brokenLinks: 0,
    };
  } catch {
    return { ok: false, detail: "Invalid internal link map", legacyClusterReferences: 0, brokenLinks: 0 };
  }
}

export function validateDesignMapLockdown(
  slug: string,
  serviceId: string,
  visualHtml: string,
  localHtml: string | null,
): DesignMapValidation {
  const key = resolveTenantProfileSlug(slug) || slug;
  const serviceMap = validateMapInHtml(visualHtml);
  // Service-page-only regenerations have no local HTML in scope — do not fail the service page for that.
  const localMap = localHtml
    ? validateMapInHtml(localHtml)
    : { ok: true, detail: "local page not in scope", hasIframe: false, hasFallback: false };

  const serviceHeader =
    visualHtml.match(/data-component="pharmacy-page-header"[\s\S]*?<\/header>/i)?.[0] ||
    visualHtml.match(/data-pharmaconnect-component="platform-header-v1"[\s\S]*?<\/header>/i)?.[0] ||
    "";
  const localHeader =
    localHtml?.match(/data-component="pharmacy-page-header"[\s\S]*?<\/header>/i)?.[0] ||
    localHtml?.match(/data-pharmaconnect-component="platform-header-v1"[\s\S]*?<\/header>/i)?.[0] ||
    "";
  const serviceFooter =
    visualHtml.match(/data-component="pharmacy-page-footer"[\s\S]*?<\/footer>/i)?.[0] ||
    visualHtml.match(/data-pharmaconnect-component="platform-footer-v1"[\s\S]*?<\/footer>/i)?.[0] ||
    visualHtml.match(/<footer[\s\S]*?<\/footer>/i)?.[0] ||
    "";
  const localFooter =
    localHtml?.match(/data-component="pharmacy-page-footer"[\s\S]*?<\/footer>/i)?.[0] ||
    localHtml?.match(/data-pharmaconnect-component="platform-footer-v1"[\s\S]*?<\/footer>/i)?.[0] ||
    localHtml?.match(/<footer[\s\S]*?<\/footer>/i)?.[0] ||
    "";

  const extractLogo = (header: string) => header.match(/src="([^"]+)"/)?.[1] || header.match(/class="brand-text"[^>]*>([^<]+)/)?.[1] || "";
  const serviceLogo = extractLogo(serviceHeader);
  const localLogo = extractLogo(localHeader);
  const headerParity = localHtml
    ? Boolean(localHeader) &&
      Boolean(serviceHeader) &&
      (serviceLogo === localLogo || (serviceLogo && localHeader.includes(serviceLogo)))
    : Boolean(serviceHeader);
  const footerParity = localHtml
    ? Boolean(localFooter) && Boolean(serviceFooter) && localFooter.length > 100 && serviceFooter.length > 100
    : Boolean(serviceFooter) && serviceFooter.length > 100;

  const brandParity = localHtml
    ? Boolean(localHtml.includes("data-pharmacy-template=\"lockdown-v1\"")) &&
      Boolean(localHtml.includes("--brand-primary")) &&
      !/demo-banner|renderPreviewSiteHeader/.test(localHtml)
    : Boolean(visualHtml.includes("--brand-primary") || visualHtml.includes("data-pharmacy-template")) &&
      !/demo-banner|renderPreviewSiteHeader/.test(visualHtml);

  const nearbyAreaLinksCount = localHtml ? (localHtml.match(/nearby-area-card|id="nearby-areas"/g) || []).length : 0;
  const moneyLinksCount = localHtml
    ? (localHtml.match(/money-page-band|btn-white|nav-cta|tel:/g) || []).length
    : (visualHtml.match(/nav-cta|tel:/g) || []).length;
  const internalLinksCount = localHtml
    ? (localHtml.match(/href="[^"]*(?:pharmacy-visual-experience|pharmacy-content-ecosystem-preview|#contact|#local-access)/g) || [])
        .length
    : (visualHtml.match(/href="[^"]*(?:#contact|#local-access|tel:)/g) || []).length;

  const localDesignOk = localHtml
    ? Boolean(
        localHtml.includes("data-publish-source=\"local-area-v1\"") ||
          localHtml.includes("data-publish-source=\"local-cluster-v1\"") ||
          localHtml.includes("data-publish-source=\"local-cluster-design-system\""),
      ) &&
      Boolean(localHtml.includes("id=\"local-access\"")) &&
      Boolean(
        localHtml.includes("id=\"nearby-areas\"") ||
          localHtml.includes("id=\"child-areas\"") ||
          localHtml.includes("class=\"coverage-tag\"") ||
          nearbyAreaLinksCount === 0,
      )
    : true;

  const mapValidationOk = serviceMap.ok && localMap.ok;
  const ok =
    serviceMap.ok &&
    localMap.ok &&
    headerParity &&
    footerParity &&
    brandParity &&
    localDesignOk &&
    (nearbyAreaLinksCount > 0 || !localHtml) &&
    moneyLinksCount >= 2 &&
    internalLinksCount >= 3 &&
    (key === "pharmaconnect" || !localHtml?.includes("pharmaconnect"));

  return {
    ok,
    detail: ok ? "design and map lockdown ok" : "design/map validation failed",
    servicePageMapValidation: { ok: serviceMap.ok, detail: serviceMap.detail },
    localPageMapValidation: { ok: localMap.ok, detail: localMap.detail },
    localPageDesignValidation: { ok: localDesignOk, detail: localDesignOk ? "local design system" : "local page not using design system" },
    headerFooterParity: {
      ok: headerParity && footerParity,
      detail: headerParity && footerParity ? "header/footer parity" : "header/footer mismatch",
    },
    brandParity: { ok: brandParity, detail: brandParity ? "brand variables present" : "default blue/demo branding detected" },
    nearbyAreaLinksCount,
    mapValidation: { ok: mapValidationOk, detail: mapValidationOk ? "maps valid" : `${serviceMap.detail}; ${localMap.detail}` },
    moneyLinksCount,
    internalLinksCount,
  };
}

export function finalizeLocalClusterQualityValidation(
  report: GenerationReport,
  slug: string,
  visualHtml: string,
): void {
  const quality = validateLocalClusterQuality(slug, report.serviceId, report.selectedAreas, visualHtml);
  report.localClusterQualityValidation = quality;

  if (!quality.ok) {
    report.errors.push(`Local cluster quality: ${quality.detail}`);
    if (quality.duplicateCopyWarnings.length) {
      report.errors.push(`Duplicate copy: ${quality.duplicateCopyWarnings.join(", ")}`);
    }
    if (quality.emptySectionsDetected.length) {
      report.errors.push(`Empty sections: ${quality.emptySectionsDetected.join(", ")}`);
    }
    if (quality.failedLocalPages.length) {
      report.warnings.push(`Failed local pages: ${quality.failedLocalPages.slice(0, 10).join("; ")}`);
    }
  }
}

export function finalizeDesignMapValidation(
  report: GenerationReport,
  slug: string,
  visualHtml: string,
): void {
  const key = resolveTenantProfileSlug(slug) || slug;
  const localPath = report.localClusterOutputPaths[0];
  const localHtml = localPath && fs.existsSync(localPath) ? fs.readFileSync(localPath, "utf8") : null;
  const design = validateDesignMapLockdown(key, report.serviceId, visualHtml, localHtml);
  report.designMapValidation = design;

  if (!design.ok) {
    report.errors.push(`Design/map: ${design.detail}`);
    if (!design.servicePageMapValidation.ok) {
      report.errors.push(`Service map: ${design.servicePageMapValidation.detail}`);
    }
    if (!design.localPageMapValidation.ok) {
      report.errors.push(`Local map: ${design.localPageMapValidation.detail}`);
    }
    if (!design.headerFooterParity.ok) {
      report.errors.push(`Header/footer: ${design.headerFooterParity.detail}`);
    }
    if (!design.brandParity.ok) {
      report.errors.push(`Brand parity: ${design.brandParity.detail}`);
    }
  }
}

export function finalizeEcosystemValidation(report: GenerationReport, slug: string, pharmacyName: string): void {
  const ecoTenant = validateEcosystemTenant(slug, report.serviceId, pharmacyName);
  const localCluster = validateLocalClusterPages(slug, report.serviceId, report.selectedAreas);
  const internalLinks = validateInternalLinkMap(slug, report.serviceId);

  report.ecosystemTenantValidation = ecoTenant;
  report.localClusterValidation = localCluster;
  report.selectedAreasExpected = localCluster.selectedAreasExpected;
  report.localClusterPagesGenerated = localCluster.localClusterPagesGenerated;
  report.foreignTenantAssetsDetected = ecoTenant.foreignTenantAssetsDetected;
  report.foreignTenantAssetPaths = ecoTenant.foreignTenantAssetPaths;
  report.fallbackToDefaultSlugDetected = ecoTenant.fallbackToDefaultSlugDetected;
  report.internalLinkValidation = internalLinks;

  if (report.contentEcosystemPath && fs.existsSync(report.contentEcosystemPath)) {
    const localDir = path.join(report.contentEcosystemPath, "local");
    if (fs.existsSync(localDir)) {
      report.localClusterOutputPaths = fs
        .readdirSync(localDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => path.join(localDir, d.name, "index.html"))
        .filter((f) => fs.existsSync(f));
    }
  }

  if (!ecoTenant.ok) {
    report.errors.push(`Ecosystem tenant: ${ecoTenant.detail}`);
    if (ecoTenant.foreignTenantAssetPaths.length) {
      report.errors.push(`Failed assets: ${ecoTenant.foreignTenantAssetPaths.slice(0, 5).join(", ")}`);
    }
  }
  if (!localCluster.ok && localCluster.selectedAreasExpected > 0) {
    report.errors.push(`Local cluster: ${localCluster.detail}`);
  }
  if (!internalLinks.ok) {
    report.errors.push(`Internal links: ${internalLinks.detail}`);
  }
}

export function validateTenantForReport(slug: string, pharmacyName: string, html: string): { ok: boolean; detail: string } {
  if (slug === "pharmaconnect") return { ok: true, detail: "demo tenant" };
  if (/Brook Pharmacy/i.test(html)) return { ok: false, detail: "Brook Pharmacy detected" };
  if (pharmacyName) {
    const plain = pharmacyName.replace(/&/g, "&amp;");
    if (!html.includes(pharmacyName) && !html.includes(plain)) {
      return { ok: false, detail: "Pharmacy name missing from output" };
    }
  }
  return { ok: true, detail: "tenant ok" };
}

export function finalizePackageValidation(
  report: GenerationReport,
  visualHtml: string,
  slug: string,
): { ok: boolean; detail: string } {
  const serviceCheck = validateServiceBodyContent(visualHtml, report.serviceId);
  const sectionCheck = validateSectionCompleteness(visualHtml, report.serviceId);
  const layoutCheck = validatePharmacyServicePageHtml(visualHtml);
  const profile = buildPharmacyServicePageProfile(slug);
  const tenantCheck = validateTenantForReport(report.resolvedSlug, profile.pharmacyName, visualHtml);

  report.foreignServiceContentDetected = serviceCheck.foreignServiceContentDetected;
  report.sectionsFound = sectionCheck.sectionsFound;
  report.sectionsMissing = sectionCheck.sectionsMissing;
  report.serviceValidation = {
    ok: serviceCheck.ok,
    detail: serviceCheck.ok ? "service content ok" : serviceCheck.foreignServiceContentDetected.join(", ") || serviceCheck.errors.join(", "),
  };
  report.tenantValidation = tenantCheck;
  if (sectionCheck.emptySections.length) {
    report.errors.push(`Empty sections: ${sectionCheck.emptySections.join(", ")}`);
  }
  if (sectionCheck.sectionsMissing.length) {
    report.errors.push(`Missing sections: ${sectionCheck.sectionsMissing.join(", ")}`);
  }
  if (!layoutCheck.pass) report.warnings.push(`Layout checks: ${layoutCheck.failures.join(", ")}`);

  const ok = serviceCheck.ok && tenantCheck.ok && sectionCheck.ok;
  report.packageValidation = { ok, detail: ok ? "package valid" : report.errors.join("; ") || "validation failed" };
  return report.packageValidation;
}

export function finalizeLongFormQualityValidation(report: GenerationReport, slug: string): void {
  try {
    const ctx = buildContentGenerationContext(slug, report.serviceId);
    const quality = validateLongFormQuality(ctx);
    report.longFormQualityValidation = quality;

    if (!quality.ok) {
      report.errors.push(`Long-form quality: ${quality.detail}`);
      if (quality.forbiddenHedgingDetected.length) {
        report.errors.push(`Forbidden hedging: ${quality.forbiddenHedgingDetected.slice(0, 5).join("; ")}`);
      }
      if (quality.failedLongFormAssets.length) {
        report.warnings.push(`Long-form assets: ${quality.failedLongFormAssets.slice(0, 8).join("; ")}`);
      }
    }
  } catch (err) {
    report.longFormQualityValidation = {
      ok: false,
      detail: String(err),
      longFormTenantDepthValidation: { ok: false, detail: String(err) },
      forbiddenHedgingDetected: [],
      tenantMentionsBySection: {},
      serviceMentionsBySection: {},
      ctaPlacementValidation: { ok: false, detail: String(err) },
      reviewerPlacementValidation: { ok: false, detail: String(err) },
      genericLongFormWarnings: [String(err)],
      failedLongFormAssets: ["validation-error"],
      supportingTemplateValidation: { ok: false, detail: String(err), failedPages: ["validation-error"] },
    };
    report.errors.push(`Long-form validation error: ${String(err)}`);
  }
}

export function finalizeFullPackageValidation(
  report: GenerationReport,
  visualHtml: string,
  slug: string,
  pharmacyName: string,
): { ok: boolean; detail: string } {
  finalizePackageValidation(report, visualHtml, slug);
  finalizeEcosystemValidation(report, slug, pharmacyName);
  finalizeDesignMapValidation(report, slug, visualHtml);
  finalizeLocalClusterQualityValidation(report, slug, visualHtml);
  finalizeLongFormQualityValidation(report, slug);

  const ecosystemOk =
    report.ecosystemTenantValidation.ok &&
    report.localClusterValidation.ok &&
    report.designMapValidation.ok &&
    report.localClusterQualityValidation.ok &&
    report.longFormQualityValidation.ok;
  const allOk =
    report.packageValidation.ok &&
    ecosystemOk &&
    report.internalLinkValidation.ok &&
    report.designMapValidation.ok &&
    report.localClusterQualityValidation.ok &&
    report.longFormQualityValidation.ok;

  report.manifestAccuracyValidation = {
    ok: ecosystemOk,
    detail: ecosystemOk ? "manifest matches tenant ecosystem" : report.errors.join("; ") || "manifest mismatch",
  };

  if (!ecosystemOk) {
    report.packageValidation = {
      ok: false,
      detail: "This content package needs fixing before approval.",
    };
  } else if (!allOk) {
    report.packageValidation = { ok: false, detail: report.warnings.join("; ") || "validation incomplete" };
  }

  return report.packageValidation;
}

export function packageCanBeApproved(report: GenerationReport | null): { ok: boolean; message: string; failedPaths?: string[] } {
  if (!report) return { ok: false, message: "Content package has not been generated yet." };
  if (!report.packageValidation.ok) {
    return {
      ok: false,
      message: "This content package needs fixing before approval.",
      failedPaths: report.foreignTenantAssetPaths?.slice(0, 10),
    };
  }
  if (!report.serviceValidation.ok || !report.tenantValidation.ok) {
    return {
      ok: false,
      message: "This content package needs fixing before approval.",
      failedPaths: report.foreignTenantAssetPaths?.slice(0, 10),
    };
  }
  if (!report.ecosystemTenantValidation?.ok) {
    return {
      ok: false,
      message: "This content package needs fixing before approval.",
      failedPaths: report.foreignTenantAssetPaths?.slice(0, 10),
    };
  }
  if (!report.localClusterValidation?.ok && (report.selectedAreasExpected || 0) > 0) {
    return {
      ok: false,
      message: "This content package needs fixing before approval.",
      failedPaths: report.localClusterOutputPaths?.length
        ? [`expected ${report.selectedAreasExpected} local pages, got ${report.localClusterPagesGenerated}`]
        : undefined,
    };
  }
  if (report.fallbackToDefaultSlugDetected) {
    return {
      ok: false,
      message: "This content package needs fixing before approval.",
      failedPaths: report.foreignTenantAssetPaths?.slice(0, 10),
    };
  }
  if (!report.designMapValidation?.ok) {
    return {
      ok: false,
      message: "This content package needs fixing before approval.",
      failedPaths: [
        report.designMapValidation.servicePageMapValidation.detail,
        report.designMapValidation.localPageMapValidation.detail,
        report.designMapValidation.headerFooterParity.detail,
      ].filter(Boolean),
    };
  }
  if (!report.localClusterQualityValidation?.ok && (report.selectedAreasExpected || 0) > 0) {
    return {
      ok: false,
      message: "This content package needs fixing before approval.",
      failedPaths: report.localClusterQualityValidation.failedLocalPages?.slice(0, 10),
    };
  }
  if (!report.longFormQualityValidation?.ok) {
    return {
      ok: false,
      message: "Some supporting content needs improving before this package can be approved.",
      failedPaths: report.longFormQualityValidation.failedLongFormAssets?.slice(0, 10),
    };
  }
  return { ok: true, message: "ok" };
}

export function isBenchmarkVisualService(serviceId: string): serviceId is VisualExperienceServiceId {
  return (VISUAL_EXPERIENCE_BENCHMARK_SERVICES as readonly string[]).includes(serviceId);
}

export function generationReportFilePath(slug: string, serviceId: string): string {
  return reportPath(slug, serviceId);
}
