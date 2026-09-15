/**
 * PharmaConnect Growth Engine — Content Blueprint (planning layer only).
 * Consumes Pharmacy Profile, Business Intelligence and Local Intelligence.
 * Does NOT generate page content.
 */
import fs from "node:fs";
import path from "node:path";
import {
  getMaxAreas,
  loadPharmacyServiceLibrary,
  normalizeServiceId,
  type PharmacyServiceEntry,
} from "./pharmacyServiceLibraryService.ts";
import {
  getLocalIntelligence,
  resolveBlueprintAreas,
  getAreaSelectionStatus,
  type PharmacyLocalIntelligenceDoc as AreaSelectionLocalDoc,
} from "./pharmacyAreaSelectionService.ts";
import {
  getPharmacyProfilePath,
  PHARMACY_WORKSPACE_ROOT,
  resolvePharmacyWorkspaceRoot,
  safePharmacySlug,
} from "./pharmacyWorkspacePaths.ts";
import { resolveTenantProfileSlug } from "./pharmacyTenantSlug.ts";

export const WORKSPACE_ROOT = PHARMACY_WORKSPACE_ROOT;
export { resolvePharmacyWorkspaceRoot };

const ROOT = PHARMACY_WORKSPACE_ROOT;

export const DATA_PATHS = {
  profiles: path.join(ROOT, "data/pharmacy-profiles"),
  businessIntelligence: path.join(ROOT, "data/pharmacy-intelligence"),
  localIntelligence: path.join(ROOT, "data/pharmacy-local-intelligence"),
  contentBlueprints: path.join(ROOT, "data/pharmacy-content-blueprints"),
  serviceLibrary: path.join(ROOT, "data/pharmacy-service-library"),
  serviceLibraryCatalog: path.join(ROOT, "config/pharmacy/service-library.json"),
  growthServiceLibrary: path.join(ROOT, "config/pharmacy/service-library.json"),
  industryServiceLibrary: path.join(ROOT, "output/pharmacy-blueprint/service-intelligence.json"),
};

export interface ServiceOpportunity {
  serviceKey: string;
  serviceName: string;
  priority: boolean;
  source: "selected" | "priority" | "goal";
}

export interface AreaOpportunity {
  area: string;
  source: "localAreas" | "localCommunities" | "nearbyLocations";
}

export interface ServiceAreaPageOpportunity {
  title: string;
  serviceKey: string;
  serviceName: string;
  area: string;
  pageSlug: string;
  keyword: string;
}

export interface FaqOpportunity {
  question: string;
  serviceKey?: string;
  serviceName?: string;
  area?: string;
  source: "service-local" | "patient-question" | "service-library" | "intelligence";
}

export interface BlogOpportunity {
  title: string;
  serviceKey?: string;
  serviceName?: string;
  source: "service-library" | "local-healthcare" | "community" | "service-template" | "intelligence";
}

export interface PharmacyContentBlueprint {
  generatedAt: string;
  slug: string;
  pharmacyName?: string;
  primaryLocation?: string;
  maxAreas?: number;
  serviceOpportunities: ServiceOpportunity[];
  areaOpportunities: AreaOpportunity[];
  serviceAreaPages: ServiceAreaPageOpportunity[];
  faqOpportunities: FaqOpportunity[];
  blogOpportunities: BlogOpportunity[];
}

interface GrowthServiceEntry {
  id: string;
  label: string;
  priority?: string;
  contentAngles?: string[];
  faqs?: string[];
}

interface GrowthProfileDoc {
  slug: string;
  data?: Record<string, unknown>;
  updatedAt?: string;
}

interface GrowthIntelligenceDoc {
  slug: string;
  generatedAt?: string;
  pharmacy?: { name?: string };
  location?: { townCity?: string; localAuthority?: string };
  services?: {
    selectedServices?: GrowthServiceEntry[];
    priorityServices?: string[];
    serviceFaqs?: Array<{ serviceId: string; serviceLabel: string; question: string }>;
    serviceContentAngles?: string[];
  };
  growthSeo?: {
    primaryGrowthGoal?: string;
    rankingAreas?: string[];
  };
  contentIntelligence?: {
    patientQuestions?: string[];
    authoritySignals?: string[];
  };
}

interface GrowthLocalIntelligenceDoc extends AreaSelectionLocalDoc {
  localCommunityLocations?: string[];
}

interface IndustryServiceIndexEntry {
  serviceKey: string;
  serviceName: string;
}

function readJson<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function profilePath(slug: string): string {
  return getPharmacyProfilePath(slug);
}

export function businessIntelligencePath(slug: string): string {
  return path.join(DATA_PATHS.businessIntelligence, `${slug}.json`);
}

export function localIntelligencePath(slug: string): string {
  return path.join(DATA_PATHS.localIntelligence, `${slug}.json`);
}

export function contentBlueprintPath(slug: string): string {
  return path.join(DATA_PATHS.contentBlueprints, `${slug}.json`);
}

export function loadPharmacyProfile(slug: string): GrowthProfileDoc {
  const resolved = resolveTenantProfileSlug(slug) || normalizeTenantSlugForLoad(slug);
  const doc = readJson<GrowthProfileDoc>(profilePath(resolved));
  if (!doc) {
    throw new Error(`Pharmacy Profile not found for "${slug}". Complete Profile setup first.`);
  }
  return { ...doc, slug: doc.slug || resolved };
}

function normalizeTenantSlugForLoad(slug: string): string {
  return safePharmacySlug(slug);
}

export function loadPharmacyBusinessIntelligence(slug: string): GrowthIntelligenceDoc {
  const doc = readJson<GrowthIntelligenceDoc>(businessIntelligencePath(slug));
  if (!doc) {
    throw new Error(`Business Intelligence not found for "${slug}". Generate Business Intelligence first.`);
  }
  return { ...doc, slug: doc.slug || slug };
}

export function loadPharmacyLocalIntelligence(slug: string): GrowthLocalIntelligenceDoc {
  return getLocalIntelligence(slug) as GrowthLocalIntelligenceDoc;
}

export function loadPharmacyContentBlueprint(slug: string): PharmacyContentBlueprint | null {
  return readJson<PharmacyContentBlueprint>(contentBlueprintPath(slug));
}

export function savePharmacyContentBlueprint(blueprint: PharmacyContentBlueprint): PharmacyContentBlueprint {
  fs.mkdirSync(DATA_PATHS.contentBlueprints, { recursive: true });
  fs.writeFileSync(contentBlueprintPath(blueprint.slug), JSON.stringify(blueprint, null, 2) + "\n", "utf8");
  return blueprint;
}

function loadIndustryServiceIndex(): IndustryServiceIndexEntry[] {
  const doc = readJson<{ serviceIndex?: IndustryServiceIndexEntry[] }>(DATA_PATHS.industryServiceLibrary);
  return doc?.serviceIndex || [];
}

function resolveIndustryServiceName(serviceKey: string, fallback: string): string {
  const index = loadIndustryServiceIndex();
  const normalized = normalizeKey(serviceKey);
  const match = index.find((s) => normalizeKey(s.serviceKey) === normalized || normalizeKey(s.serviceName) === normalized);
  return match?.serviceName || fallback;
}

function buildServiceOpportunities(
  profile: GrowthProfileDoc,
  intelligence: GrowthIntelligenceDoc,
  libraryServices: PharmacyServiceEntry[],
): ServiceOpportunity[] {
  const selected = libraryServices.filter((s) => s.selected);
  if (!selected.length) {
    throw new Error("No services selected in Service Library. Analyse and select services first.");
  }

  const seen = new Set<string>();
  const out: ServiceOpportunity[] = [];
  const profileData = profile.data || {};

  const priorityIds = new Set(
    [
      ...(intelligence.services?.priorityServices || []),
      ...((profileData.priorityServices as string[]) || []),
    ].map((id) => normalizeServiceId(String(id))),
  );

  for (const service of selected) {
    const key = normalizeServiceId(service.id);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({
      serviceKey: key,
      serviceName: resolveIndustryServiceName(key, service.serviceName),
      priority: priorityIds.has(key) || service.recommended,
      source: service.recommended ? "priority" : "selected",
    });
  }

  return out;
}

function buildAreaOpportunities(
  local: GrowthLocalIntelligenceDoc,
  maxAreas: number,
): AreaOpportunity[] {
  const areas = resolveBlueprintAreas(local, maxAreas);
  return areas.map((area) => ({ area, source: "localAreas" as const }));
}

function buildServiceAreaPages(
  services: ServiceOpportunity[],
  areas: AreaOpportunity[],
): ServiceAreaPageOpportunity[] {
  const pages: ServiceAreaPageOpportunity[] = [];
  for (const service of services) {
    for (const area of areas) {
      const title = `${service.serviceName} ${area.area}`;
      pages.push({
        title,
        serviceKey: service.serviceKey,
        serviceName: service.serviceName,
        area: area.area,
        pageSlug: slugify(`${service.serviceKey}-${area.area}`),
        keyword: title,
      });
    }
  }
  return pages;
}

function buildFaqOpportunities(
  services: ServiceOpportunity[],
  areas: AreaOpportunity[],
  intelligence: GrowthIntelligenceDoc,
  profile: GrowthProfileDoc,
): FaqOpportunity[] {
  const seen = new Set<string>();
  const out: FaqOpportunity[] = [];
  const profileData = profile.data || {};

  const add = (faq: FaqOpportunity) => {
    const key = faq.question.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(faq);
  };

  for (const faq of intelligence.services?.serviceFaqs || []) {
    add({
      question: faq.question,
      serviceKey: normalizeKey(faq.serviceId),
      serviceName: faq.serviceLabel,
      source: "intelligence",
    });
  }

  for (const service of services.slice(0, 12)) {
    const intelService = (intelligence.services?.selectedServices || []).find(
      (s) => normalizeKey(s.id) === service.serviceKey,
    );
    for (const q of (intelService?.faqs || []).slice(0, 3)) {
      add({
        question: q,
        serviceKey: service.serviceKey,
        serviceName: service.serviceName,
        source: "intelligence",
      });
    }
  }

  for (const service of services.slice(0, 12)) {
    for (const area of areas.slice(0, 10)) {
      add({
        question: `Can patients in ${area.area} use ${service.serviceName}?`,
        serviceKey: service.serviceKey,
        serviceName: service.serviceName,
        area: area.area,
        source: "service-local",
      });
      if (service.serviceName.toLowerCase().includes("delivery")) {
        add({
          question: `Do you deliver prescriptions to ${area.area}?`,
          serviceKey: service.serviceKey,
          serviceName: service.serviceName,
          area: area.area,
          source: "service-local",
        });
      }
      if (service.serviceName.toLowerCase().includes("travel") || service.serviceName.toLowerCase().includes("vaccination")) {
        add({
          question: `Can I book a travel vaccination consultation in ${area.area}?`,
          serviceKey: service.serviceKey,
          serviceName: service.serviceName,
          area: area.area,
          source: "service-local",
        });
      }
    }
  }

  for (const q of [
    ...(intelligence.contentIntelligence?.patientQuestions || []),
    ...((profileData.patientQuestions as string[]) || []),
  ]) {
    if (typeof q === "string" && q.trim()) add({ question: q.trim(), source: "patient-question" });
  }

  return out;
}

function buildBlogOpportunities(
  services: ServiceOpportunity[],
  areas: AreaOpportunity[],
  intelligence: GrowthIntelligenceDoc,
  profile: GrowthProfileDoc,
  local: GrowthLocalIntelligenceDoc,
): BlogOpportunity[] {
  const seen = new Set<string>();
  const out: BlogOpportunity[] = [];
  const location =
    local.town ||
    intelligence.location?.townCity ||
    intelligence.location?.localAuthority ||
    String((profile.data || {}).townCity || "your area");

  const add = (blog: BlogOpportunity) => {
    const key = blog.title.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(blog);
  };

  for (const service of intelligence.services?.selectedServices || []) {
    for (const angle of (service.contentAngles || []).slice(0, 2)) {
      add({
        title: angle,
        serviceKey: normalizeKey(service.id),
        serviceName: service.label,
        source: "intelligence",
      });
    }
  }

  for (const angle of (intelligence.services?.serviceContentAngles || []).slice(0, 6)) {
    add({ title: angle, source: "intelligence" });
  }

  const templates: Array<{ match: RegExp; title: string }> = [
    { match: /pharmacy first/i, title: "When Should You Use Pharmacy First Instead Of A GP?" },
    { match: /travel|vaccination/i, title: `Travel Vaccination Advice For ${location} Residents` },
    { match: /repeat|prescription/i, title: "Managing Repeat Prescriptions More Effectively" },
    { match: /weight/i, title: `Weight Management Support Available At Your Local Pharmacy In ${location}` },
    { match: /blood pressure/i, title: "Why Regular Blood Pressure Checks Matter For Community Health" },
  ];

  for (const service of services) {
    for (const tpl of templates) {
      if (tpl.match.test(service.serviceName)) {
        add({
          title: tpl.title,
          serviceKey: service.serviceKey,
          serviceName: service.serviceName,
          source: "service-template",
        });
      }
    }
  }

  for (const note of intelligence.contentIntelligence?.authoritySignals || []) {
    if (note.trim()) add({ title: note.trim(), source: "local-healthcare" });
  }

  for (const loc of (local.localHealthcareLocations || []).slice(0, 4)) {
    add({
      title: `Local Healthcare Access And Pharmacy Services Near ${loc}`,
      source: "local-healthcare",
    });
  }

  for (const loc of (local.localCommunityLocations || []).slice(0, 4)) {
    add({
      title: `Community Pharmacy Support For Patients In ${loc}`,
      source: "community",
    });
  }

  if (areas.length) {
    add({
      title: `Pharmacy Services For Patients In ${areas[0].area} And Surrounding ${location} Areas`,
      source: "community",
    });
  }

  return out;
}

export function generatePharmacyContentBlueprint(slug: string): PharmacyContentBlueprint {
  const profile = loadPharmacyProfile(slug);
  const intelligence = loadPharmacyBusinessIntelligence(slug);
  const local = loadPharmacyLocalIntelligence(slug);
  const serviceLibrary = loadPharmacyServiceLibrary(slug);
  const maxAreas = getMaxAreas(slug);

  const serviceOpportunities = buildServiceOpportunities(profile, intelligence, serviceLibrary.services);
  const areaOpportunities = buildAreaOpportunities(local, maxAreas);
  if (!areaOpportunities.length) {
    throw new Error("No area opportunities found. Generate Local Intelligence and set maximum areas first.");
  }

  const profileData = profile.data || {};

  const blueprint: PharmacyContentBlueprint = {
    generatedAt: new Date().toISOString(),
    slug,
    pharmacyName: intelligence.pharmacy?.name || String(profileData.pharmacyName || ""),
    primaryLocation: local.town || intelligence.location?.townCity || String(profileData.townCity || ""),
    maxAreas,
    serviceOpportunities,
    areaOpportunities,
    serviceAreaPages: buildServiceAreaPages(serviceOpportunities, areaOpportunities),
    faqOpportunities: buildFaqOpportunities(serviceOpportunities, areaOpportunities, intelligence, profile),
    blogOpportunities: buildBlogOpportunities(serviceOpportunities, areaOpportunities, intelligence, profile, local),
  };

  return savePharmacyContentBlueprint(blueprint);
}

export function getPharmacyContentBlueprintStatus(slug: string): {
  hasProfile: boolean;
  hasBusinessIntelligence: boolean;
  hasLocalIntelligence: boolean;
  hasAreaSelection: boolean;
  areaSelectionSelectedCount: number;
  hasServiceLibrary: boolean;
  serviceLibrarySelectedCount: number;
  maxAreas: number;
  hasBlueprint: boolean;
  blueprintGeneratedAt: string | null;
  dataRoot: string;
} {
  const blueprint = loadPharmacyContentBlueprint(slug);
  let serviceLibrarySelectedCount = 0;
  let maxAreas = 8;
  let hasServiceLibrary = false;
  let areaSelectionSelectedCount = 0;
  let hasAreaSelection = false;

  try {
    const lib = loadPharmacyServiceLibrary(slug);
    hasServiceLibrary = lib.selectedServices.length > 0;
    serviceLibrarySelectedCount = lib.selectedServices.length;
    maxAreas = lib.maxAreas;
  } catch {
    hasServiceLibrary = false;
  }

  const areaStatus = getAreaSelectionStatus(slug);
  areaSelectionSelectedCount = areaStatus.selectedCount;
  hasAreaSelection = areaStatus.selectedCount > 0;

  return {
    hasProfile: fs.existsSync(profilePath(slug)),
    hasBusinessIntelligence: fs.existsSync(businessIntelligencePath(slug)),
    hasLocalIntelligence: areaStatus.hasLocalIntelligence,
    hasAreaSelection,
    areaSelectionSelectedCount,
    hasServiceLibrary,
    serviceLibrarySelectedCount,
    maxAreas,
    hasBlueprint: !!blueprint,
    blueprintGeneratedAt: blueprint?.generatedAt ?? null,
    dataRoot: ROOT,
  };
}
