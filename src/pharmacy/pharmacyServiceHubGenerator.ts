/**
 * Pharmacy Service Hub Generator V1
 * Hubs sit between master service pages and area pages.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadPharmacyContentBlueprint,
  loadPharmacyProfile,
} from "./pharmacyContentBlueprintService.ts";
import { loadPharmacyServiceLibrary, normalizeServiceId } from "./pharmacyServiceLibraryService.ts";
import {
  loadAllGeneratedServicePages,
  loadGeneratedServicePage,
  type GeneratedServicePage,
  type ServicePageCta,
  type ServicePageFaq,
  type ServicePageSection,
} from "./pharmacyServicePageGenerator.ts";
import { loadAllGeneratedServiceAreaPages } from "./pharmacyServiceAreaPageGenerator.ts";
import { applyHubFramework, usesHubPublishFramework } from "./pharmacyHubFramework.ts";
import {
  ensureCompleteSentence,
  publishMetaDescription,
  splitIntoCompleteSentences,
  stripInternalBlueprintLabels,
} from "./pharmacySafeText.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveWorkspaceRoot(): string {
  const candidates = [
    process.env.WORKSPACE_ROOT,
    path.resolve(__dirname, "../.."),
    path.resolve(__dirname, "../../.."),
    process.cwd(),
  ].filter(Boolean) as string[];
  for (const root of candidates) {
    if (fs.existsSync(path.join(root, "config/pharmacy/service-library.json"))) return root;
  }
  return path.resolve(__dirname, "../..");
}

export const WORKSPACE_ROOT = resolveWorkspaceRoot();
export const HUB_STORAGE_ROOT = path.join(WORKSPACE_ROOT, "data/pharmacy-service-hubs");

export interface ServiceHubCoverageArea {
  area: string;
  areaSlug: string;
  pageSlug: string;
  title: string;
}

export interface ServiceHubRelatedHub {
  serviceId: string;
  serviceName: string;
  pageSlug: string;
  title: string;
}

export interface ServiceHubQualitySignals {
  wordCount: number;
  sectionCount: number;
  faqCount: number;
  coverageAreaCount: number;
  relatedHubCount: number;
  duplicateRiskScore: number;
  meetsWordTarget: boolean;
  usesEnrichedBlueprint?: boolean;
  faqSourceEnrichedBlueprint?: boolean;
  mythSourceEnrichedBlueprint?: boolean;
  authoritySourceEnrichedBlueprint?: boolean;
  patientQuestionsSourceEnrichedBlueprint?: boolean;
  usesConversionLayer?: boolean;
  conversionReassuranceCount?: number;
}

export interface GeneratedServiceHub {
  serviceId: string;
  serviceName: string;
  slug: string;
  pageSlug: string;
  generatedAt: string;
  metaTitle: string;
  metaDescription: string;
  h1: string;
  intro: string;
  sections: ServicePageSection[];
  faqs: ServicePageFaq[];
  cta: ServicePageCta;
  coverageAreas: ServiceHubCoverageArea[];
  relatedHubs: ServiceHubRelatedHub[];
  schema: Record<string, unknown>;
  qualitySignals: ServiceHubQualitySignals;
}

export interface ServiceHubsIndex {
  slug: string;
  generatedAt: string;
  hubCount: number;
  hubs: Array<{
    serviceId: string;
    serviceName: string;
    pageSlug: string;
    wordCount: number;
    coverageAreaCount: number;
    generatedAt: string;
  }>;
}

export function serviceHubPageSlug(serviceId: string): string {
  return `${normalizeServiceId(serviceId)}-hub`;
}

function countWords(text: string): number {
  return String(text || "").split(/\s+/).filter(Boolean).length;
}

function slugifyArea(area: string): string {
  return String(area || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function pickSection(sections: ServicePageSection[], type: string): ServicePageSection | undefined {
  return sections.find((s) => s.type === type);
}

function expandHubBody(base: string, extra: string[]): string {
  return [base, ...extra.filter(Boolean)].join(" ").trim();
}

function areaHubBlurbs(
  serviceAreas: Array<{ area: string; intro?: string; serviceName: string }>,
  serviceName: string,
  pharmacyName: string,
): string {
  if (!serviceAreas.length) return "";
  return serviceAreas
    .map(
      (p) =>
        `${serviceName} for ${p.area} patients: ${String(p.intro || "").trim()} ` +
        `${pharmacyName} supports bookings and enquiries from ${p.area} with the same clinical pathway as our main ${serviceName.toLowerCase()} service.`,
    )
    .join(" ");
}

function adaptSection(
  section: ServicePageSection | undefined,
  type: string,
  fallbackHeading: string,
  hubPrefix: string,
): ServicePageSection {
  if (!section) {
    return { type, heading: fallbackHeading, body: hubPrefix, bullets: [] };
  }
  const body = section.body
    ? `${hubPrefix} ${section.body}`.trim()
    : hubPrefix;
  return {
    type,
    heading: section.heading || fallbackHeading,
    body,
    bullets: section.bullets?.slice() || [],
  };
}

function hubDuplicateRisk(servicePage: GeneratedServicePage, hub: GeneratedServiceHub): number {
  const masterBodies = new Set(
    (servicePage.sections || []).map((s) => String(s.body || "").trim()).filter(Boolean),
  );
  const hubBodies = [
    hub.intro,
    ...(hub.sections || []).map((s) => String(s.body || "").trim()),
    hub.cta?.phonePrompt,
    hub.cta?.bookingPrompt,
  ].filter(Boolean) as string[];
  if (!hubBodies.length) return 0;
  const repeated = hubBodies.filter((b) => masterBodies.has(b)).length;
  return Math.round((repeated / hubBodies.length) * 100);
}

function buildHubSchema(
  hub: Omit<GeneratedServiceHub, "schema" | "qualitySignals">,
  pharmacyName: string,
  town: string,
  baseUrl: string,
): Record<string, unknown> {
  const url = `${baseUrl.replace(/\/$/, "")}/${hub.pageSlug}/`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name: hub.h1,
        description: hub.metaDescription,
        url,
        isPartOf: { "@type": "WebSite", name: pharmacyName },
      },
      {
        "@type": "Service",
        name: hub.serviceName,
        provider: {
          "@type": "Pharmacy",
          name: pharmacyName,
          address: { "@type": "PostalAddress", addressLocality: town },
        },
        areaServed: hub.coverageAreas.map((a) => a.area),
      },
      {
        "@type": "FAQPage",
        mainEntity: hub.faqs.slice(0, 10).map((f) => ({
          "@type": "Question",
          name: f.question,
          acceptedAnswer: { "@type": "Answer", text: f.answer },
        })),
      },
    ],
  };
}

function selectedServiceIds(slug: string): Array<{ serviceId: string; serviceName: string }> {
  try {
    const lib = loadPharmacyServiceLibrary(slug);
    return lib.services
      .filter((s) => s.selected)
      .map((s) => ({ serviceId: normalizeServiceId(s.id), serviceName: s.serviceName }));
  } catch {
    const blueprint = loadPharmacyContentBlueprint(slug);
    return (blueprint?.serviceOpportunities || [])
      .filter((s) => s.priority !== false)
      .map((s) => ({ serviceId: normalizeServiceId(s.serviceKey), serviceName: s.serviceName }));
  }
}

export function generateServiceHub(
  slug: string,
  serviceId: string,
  baseUrl?: string,
): GeneratedServiceHub | null {
  const servicePage = loadGeneratedServicePage(slug, serviceId);
  if (!servicePage) return null;

  const profile = loadPharmacyProfile(slug);
  const blueprint = loadPharmacyContentBlueprint(slug);
  const pharmacyName = String(
    profile.data?.pharmacyName || profile.data?.tradingName || blueprint?.pharmacyName || "Your Pharmacy",
  ).trim();
  const town = String(profile.data?.townCity || blueprint?.primaryLocation || "your area").trim();

  const { pages: areaPages } = loadAllGeneratedServiceAreaPages(slug);
  const serviceAreas = areaPages.filter((p) => normalizeServiceId(p.serviceId) === normalizeServiceId(serviceId));

  const areaNames = serviceAreas.map((p) => p.area);

  const coverageAreas: ServiceHubCoverageArea[] = serviceAreas.map((p) => ({
    area: p.area,
    areaSlug: p.areaSlug,
    pageSlug: p.pageSlug,
    title: `${p.serviceName} ${p.area}`,
  }));

  const relatedHubs: ServiceHubRelatedHub[] = selectedServiceIds(slug)
    .filter((s) => normalizeServiceId(s.serviceId) !== normalizeServiceId(serviceId))
    .map((s) => ({
      serviceId: s.serviceId,
      serviceName: s.serviceName,
      pageSlug: serviceHubPageSlug(s.serviceId),
      title: `${s.serviceName} Hub`,
    }));

  let sections: ServicePageSection[];
  let faqs: ServicePageFaq[];
  let intro: string;
  let metaDescription: string;
  if (usesHubPublishFramework(serviceId)) {
    const framed = applyHubFramework({
      serviceId: normalizeServiceId(serviceId),
      serviceName: servicePage.serviceName,
      pharmacyName,
      town,
      servicePage,
      areaNames,
    });
    intro = framed.intro;
    metaDescription = framed.metaDescription;
    sections = [
      ...framed.sections,
      {
        type: "relatedServices",
        heading: "Other Pharmacy Service Hubs",
        body: ensureCompleteSentence(
          `Explore other service hubs from ${pharmacyName} to find clinical support, travel health and dispensing services across ${town}.`,
        ),
        bullets: relatedHubs.map((h) => h.serviceName),
      },
    ];
    faqs = framed.faqs;
  } else {
    throw new Error(`Hub publish framework required for ${serviceId}`);
  }

  const usesEnrichedBlueprint = false;
  const faqSourceEnrichedBlueprint = false;
  const mythSourceEnrichedBlueprint = false;
  const authoritySourceEnrichedBlueprint = false;
  const patientQuestionsSourceEnrichedBlueprint = false;
  const usesConversionLayer = false;
  const conversionReassuranceCount = 0;

  const cta = {
    primary: servicePage.cta.primary,
    secondary: servicePage.cta.secondary,
    phonePrompt:
      servicePage.cta.phonePrompt ||
      `Call ${pharmacyName} in ${town} about ${servicePage.serviceName.toLowerCase()} or choose your local area page above.`,
    bookingPrompt:
      servicePage.cta.bookingPrompt ||
      `Book or enquire about ${servicePage.serviceName.toLowerCase()} — our team will confirm availability and eligibility.`,
    emailPrompt: servicePage.cta.emailPrompt,
    bookingUrl: servicePage.cta.bookingUrl,
    businessEmail: servicePage.cta.businessEmail,
  };

  const pageSlug = serviceHubPageSlug(serviceId);
  const h1 = `${servicePage.serviceName} Hub — ${pharmacyName}`;

  const draft: Omit<GeneratedServiceHub, "schema" | "qualitySignals"> = {
    serviceId: normalizeServiceId(serviceId),
    serviceName: servicePage.serviceName,
    slug,
    pageSlug,
    generatedAt: new Date().toISOString(),
    metaTitle: `${servicePage.serviceName} Hub ${town} | ${pharmacyName}`,
    metaDescription,
    h1,
    intro,
    sections,
    faqs,
    cta,
    coverageAreas,
    relatedHubs,
  };

  const resolvedBase =
    baseUrl ||
    String(profile.data?.website || "").replace(/\/$/, "") ||
    `https://${slug}.example.com`;

  const allText = JSON.stringify(draft);
  const wordCount = countWords(allText);
  const hub: GeneratedServiceHub = {
    ...draft,
    schema: buildHubSchema(draft, pharmacyName, town, resolvedBase),
    qualitySignals: {
      wordCount,
      sectionCount: sections.length,
      faqCount: faqs.length,
      coverageAreaCount: coverageAreas.length,
      relatedHubCount: relatedHubs.length,
      duplicateRiskScore: 0,
      meetsWordTarget: wordCount >= 1500,
      usesEnrichedBlueprint,
      faqSourceEnrichedBlueprint,
      mythSourceEnrichedBlueprint,
      authoritySourceEnrichedBlueprint,
      patientQuestionsSourceEnrichedBlueprint,
      usesConversionLayer,
      conversionReassuranceCount,
    },
  };
  hub.qualitySignals.duplicateRiskScore = hubDuplicateRisk(servicePage, hub);
  hub.qualitySignals.meetsWordTarget = countWords(
    [hub.intro, ...hub.sections.map((s) => `${s.heading} ${s.body} ${s.bullets.join(" ")}`), ...hub.faqs.map((f) => `${f.question} ${f.answer}`)].join(" "),
  ) >= 600;

  return hub;
}

export function hubStoragePath(slug: string, serviceId: string): string {
  return path.join(HUB_STORAGE_ROOT, slug, `${normalizeServiceId(serviceId)}.json`);
}

export function saveGeneratedServiceHub(hub: GeneratedServiceHub): string {
  const file = hubStoragePath(hub.slug, hub.serviceId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(hub, null, 2));
  return file;
}

export function loadGeneratedServiceHub(slug: string, serviceId: string): GeneratedServiceHub | null {
  const file = hubStoragePath(slug, serviceId);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8")) as GeneratedServiceHub;
}

export function loadAllGeneratedServiceHubs(slug: string): {
  index: ServiceHubsIndex | null;
  pages: GeneratedServiceHub[];
} {
  const dir = path.join(HUB_STORAGE_ROOT, slug);
  const indexPath = path.join(dir, "_index.json");
  const index = fs.existsSync(indexPath)
    ? (JSON.parse(fs.readFileSync(indexPath, "utf8")) as ServiceHubsIndex)
    : null;

  if (!fs.existsSync(dir)) return { index, pages: [] };

  const pages = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json") && f !== "_index.json")
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as GeneratedServiceHub)
    .sort((a, b) => a.pageSlug.localeCompare(b.pageSlug));

  return { index, pages };
}

export function generateAllServiceHubs(slug: string, baseUrl?: string): {
  hubs: GeneratedServiceHub[];
  index: ServiceHubsIndex;
} {
  const { pages: servicePages } = loadAllGeneratedServicePages(slug);
  const hubs: GeneratedServiceHub[] = [];

  for (const service of servicePages) {
    const hub = generateServiceHub(slug, service.serviceId, baseUrl);
    if (hub) {
      saveGeneratedServiceHub(hub);
      hubs.push(hub);
    }
  }

  const index: ServiceHubsIndex = {
    slug,
    generatedAt: new Date().toISOString(),
    hubCount: hubs.length,
    hubs: hubs.map((h) => ({
      serviceId: h.serviceId,
      serviceName: h.serviceName,
      pageSlug: h.pageSlug,
      wordCount: h.qualitySignals.wordCount,
      coverageAreaCount: h.qualitySignals.coverageAreaCount,
      generatedAt: h.generatedAt,
    })),
  };

  const indexPath = path.join(HUB_STORAGE_ROOT, slug, "_index.json");
  fs.mkdirSync(path.dirname(indexPath), { recursive: true });
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));

  return { hubs, index };
}
