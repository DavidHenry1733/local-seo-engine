import fs from "node:fs";
import path from "node:path";
import { scoreAreaContentDiversity } from "./areaContentDiversity.ts";
import { rewriteAreaContent, injectLocalIntoSections } from "./pharmacyAreaRewriteEngine.ts";
import { computePageLocalReferences } from "./pharmacyLocalNarrativeEngine.ts";
import { measureLocalWeaving } from "./pharmacyLocalWeavingV2.ts";
import { entityDisplayName, type ScoredLocalEntity } from "./localRelevanceScoring.ts";
import { buildLocalContextSection } from "./pharmacyLocalContextSection.ts";
import { loadPharmacyLocalRelevancePack } from "./pharmacyLocalRelevancePackService.ts";
import { loadPharmacyServiceLibrary, normalizeServiceId } from "./pharmacyServiceLibraryService.ts";
import {
  assembleAreaSections,
  selectLayoutTemplate,
} from "./pharmacyLayoutTemplateLibrary.ts";
import {
  loadServiceVariantPack,
  localizeFaqQuestion,
  selectAreaVariants,
  sectionVariantToBlock,
} from "./pharmacyServiceVariantLibrary.ts";
import { weaveFAQOpenings } from "./pharmacyLocalWeavingV2.ts";
import {
  buildAreaConversionCta,
  conversionProfileFromData,
} from "./pharmacyConversionLayer.ts";
import {
  buildAreaPageBlueprintSections,
  getEnrichedBlueprint,
  mergeBlueprintFaqs,
  selectBlueprintFaqs,
  selectBlueprintMyths,
} from "./pharmacyServiceBlueprintContentService.ts";
import { applyAreaFramework, usesAreaPublishFramework } from "./pharmacyAreaPageFramework.ts";
import { injectAreaNarrativeIntelligence } from "./pharmacyAreaNarrativeIntelligence.ts";
import { resetEntityNarrativeClusterTracker } from "./pharmacyLocalEntityNarrativeEngine.ts";
import {
  injectLocalEntitySectionVariants,
  resetLocalEntitySectionClusterTracker,
} from "./pharmacyLocalEntitySectionEngine.ts";

const PROCESS_TYPES = new Set([
  "howItWorks",
  "treatmentProcess",
  "eligibility",
  "timeline",
  "preparationGuide",
]);

function sortByMasterOrder(sections: any[], masterPool: any[]): any[] {
  const order = new Map(masterPool.map((s, i) => [`${s.type}:${s.heading}`, i]));
  return [...sections].sort((a, b) => {
    const ai = order.get(`${a.type}:${a.heading}`) ?? 999;
    const bi = order.get(`${b.type}:${b.heading}`) ?? 999;
    return ai - bi;
  });
}

function pickRelevanceEntityName(entities: ScoredLocalEntity[] | undefined, area: string): string | undefined {
  if (!entities?.length) return undefined;
  const areaLower = area.toLowerCase();
  const match = entities.find((e) => String(e.name || "").toLowerCase().includes(areaLower));
  const entity = match || entities[0];
  const name = entityDisplayName(entity);
  return name || undefined;
}

function insertLocalAreaSections(
  localServiceIntro: { type: string; heading: string; body: string; bullets: string[] },
  clinicalSections: any[],
  localNarrative: { type: string; heading: string; body: string; bullets: string[] },
  localContext: { type: string; heading: string; body: string; bullets?: string[] },
  tailSections: any[],
): any[] {
  const benefitsIdx = clinicalSections.findIndex((s) => s.type === "benefits");
  if (benefitsIdx >= 0) {
    return [
      localServiceIntro,
      ...clinicalSections.slice(0, benefitsIdx + 1),
      localNarrative,
      localContext,
      ...clinicalSections.slice(benefitsIdx + 1),
      ...tailSections,
    ];
  }

  const processIdx = clinicalSections.findIndex((s) => PROCESS_TYPES.has(s.type));
  if (processIdx > 0) {
    return [
      localServiceIntro,
      ...clinicalSections.slice(0, processIdx),
      localNarrative,
      localContext,
      ...clinicalSections.slice(processIdx),
      ...tailSections,
    ];
  }

  return [localServiceIntro, localNarrative, localContext, ...clinicalSections, ...tailSections];
}

const ROOT = process.env.WORKSPACE_ROOT ?? "/home/inboxingproweb/pharmaconnect-growth-engine";

export interface GeneratedServiceAreaPage {
  serviceId: string;
  serviceName: string;
  area: string;
  areaSlug: string;
  pageSlug: string;
  slug: string;
  generatedAt: string;
  metaTitle: string;
  metaDescription: string;
  h1: string;
  intro: string;
  sections: Array<{ type: string; heading: string; body: string; bullets?: string[] }>;
  faqs: Array<{ question: string; answer: string }>;
  cta: {
    primary: string;
    secondary: string;
    phonePrompt: string;
    bookingPrompt: string;
  };
  relatedServices: Array<{ serviceId: string; serviceName: string; pageSlug: string }>;
  nearbyAreas: string[];
  schema: Record<string, unknown>;
  aiSummary: string;
  localEntityVariantCategories?: string[];
  localEntityCount?: number;
  localEntitySectionCount?: number;
  qualitySignals: {
    wordCount: number;
    sectionCount: number;
    faqCount: number;
    localReferenceCount: number;
    localReferencesWithinTarget?: boolean;
    weavingAreaMentions?: number;
    weavingPharmacyMentions?: number;
    weavingMeetsTarget?: boolean;
    duplicateRiskScore: number;
    usesMasterServicePage: boolean;
    usesLocalArea: boolean;
    usesAuthorityLayer: boolean;
    diversityScore?: number;
    diversityMeetsTarget?: boolean;
    usesEnrichedBlueprint?: boolean;
    faqSourceEnrichedBlueprint?: boolean;
    mythSourceEnrichedBlueprint?: boolean;
    authoritySourceEnrichedBlueprint?: boolean;
    patientQuestionsSourceEnrichedBlueprint?: boolean;
    usesNarrativeIntelligence?: boolean;
    narrativeType?: string;
    usesEntityNarrative?: boolean;
    entityNarrativeEntityCount?: number;
    entityNarrativeBlockCount?: number;
    entityNarrativeWordCount?: number;
    entityNarrativeEntities?: string[];
    entityNarrativeBlockIds?: string[];
    entityNarrativeSectionVariantIds?: string[];
    localEntityVariantCategories?: string[];
    localEntityCount?: number;
    localEntitySectionCount?: number;
  };
}

function readJson(file: string, fallback: any = null) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file: string, data: any) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function slugify(v: string) {
  return String(v || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function words(v: string) {
  return String(v || "").split(/\s+/).filter(Boolean).length;
}

function escText(v: any) {
  return String(v || "").trim();
}

function hashSeed(...parts: string[]) {
  return parts.join("|").split("").reduce((n, c) => n + c.charCodeAt(0), 0);
}

function shuffleBySeed<T>(items: T[], seed: number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (seed + i * 17) % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickBySeed<T>(items: T[], seed: number, count: number): T[] {
  return shuffleBySeed(items, seed).slice(0, count);
}

function duplicateRisk(master: any, page: any) {
  const masterBodies = new Set((master.sections || []).map((s: any) => escText(s.body)).filter(Boolean));
  const localTypes = new Set(["localServiceIntro", "localNarrative", "localContext", "nearbyAreas"]);
  const checkBodies = [
    escText(page.intro),
    ...(page.sections || []).filter((s: any) => localTypes.has(s.type)).map((s: any) => escText(s.body)),
    escText(page.cta?.phonePrompt),
    escText(page.cta?.bookingPrompt),
  ].filter(Boolean);
  if (!checkBodies.length) return 0;
  const repeated = checkBodies.filter((b) => masterBodies.has(b)).length;
  return Math.round((repeated / checkBodies.length) * 100);
}

function selectNearbyAreas(allAreas: string[], current: string) {
  return allAreas.filter((a) => a && a !== current).slice(0, 4);
}

function selectRelatedServices(slug: string, serviceId: string, areaSlug: string, seed: number) {
  try {
    const lib = loadPharmacyServiceLibrary(slug);
    const selected = lib.services
      .filter((s) => s.selected && normalizeServiceId(s.id) !== normalizeServiceId(serviceId))
      .map((s) => ({
        serviceId: normalizeServiceId(s.id),
        serviceName: s.serviceName,
        pageSlug: `${normalizeServiceId(s.id)}-${areaSlug}`,
      }));
    return pickBySeed(selected, seed, 4);
  } catch {
    return [];
  }
}

function buildAreaSchema(page: any, pharmacy: any, town: string) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        name: `${page.serviceName} ${page.area}`,
        areaServed: page.area,
        provider: {
          "@type": "Pharmacy",
          name: page.pharmacyName || pharmacy.pharmacyName,
          address: {
            "@type": "PostalAddress",
            addressLocality: town,
            postalCode: pharmacy.postcode || "",
          },
        },
      },
      {
        "@type": "FAQPage",
        mainEntity: (page.faqs || []).slice(0, 8).map((f: any) => ({
          "@type": "Question",
          name: f.question,
          acceptedAnswer: { "@type": "Answer", text: f.answer },
        })),
      },
    ],
  };
}

function buildClinicalSectionsFromVariants(
  serviceId: string,
  areaSlug: string,
  areaSlugsInCluster: string[],
  injectionContext: ReturnType<typeof rewriteAreaContent>["injectionContext"],
) {
  const pack = loadServiceVariantPack(serviceId);
  if (!pack) return null;

  const layout = selectLayoutTemplate(serviceId, areaSlug);
  const selected = selectAreaVariants(pack, areaSlug, layout.id, areaSlugsInCluster);
  const orderedSlots = layout.clinicalOrder.filter((slot) => selected.sections[slot]);
  const blocks = orderedSlots.map((slot) => sectionVariantToBlock(slot, selected.sections[slot]));
  const woven = injectLocalIntoSections(blocks, injectionContext);

  const sectionMap: Record<string, { type: string; heading: string; body: string; bullets?: string[] }> = {};
  orderedSlots.forEach((slot, i) => {
    sectionMap[slot] = woven[i];
  });

  return { layout, selected, sectionMap };
}

function buildAreaPage(ctx: any, item: any): GeneratedServiceAreaPage {
  const { slug, profile, blueprint, localIntel } = ctx;
  const serviceId = normalizeServiceId(item.serviceKey);
  const serviceName = item.serviceName;
  const area = item.area;
  const areaSlug = slugify(area);
  const pageSlug = item.pageSlug || `${serviceId}-${areaSlug}`;
  const seed = hashSeed(slug, serviceId, area);

  const masterFile = path.join(ROOT, "data/pharmacy-generated-service-pages", slug, `${serviceId}.json`);
  const master = readJson(masterFile);
  if (!master) throw new Error(`Missing master service page: ${serviceId}`);

  const pharmacy = profile?.data || profile || {};
  const pharmacyName = String(
    pharmacy.pharmacyName || pharmacy.tradingName || blueprint.pharmacyName || "your local pharmacy",
  ).trim();
  const town = String(pharmacy.townCity || blueprint.primaryLocation || localIntel.town || "your area").trim();
  const nearby = selectNearbyAreas((blueprint.areaOpportunities || []).map((a: any) => a.area), area);
  const relatedServices = selectRelatedServices(slug, serviceId, areaSlug, seed);

  if (usesAreaPublishFramework(serviceId)) {
    const framed = applyAreaFramework({
      ctx: { serviceId, serviceName, pharmacyName, town, area, areaSlug },
      master,
      nearbyAreas: nearby,
    });
    const cta = {
      primary: master.cta?.primary || "Book Consultation",
      secondary: master.cta?.secondary || "Speak To Our Team",
      phonePrompt:
        master.cta?.phonePrompt ||
        `Call ${pharmacyName} from ${area} to book or ask about ${serviceName.toLowerCase()}.`,
      bookingPrompt:
        master.cta?.bookingPrompt ||
        `${area} patients in ${town} — contact ${pharmacyName} for ${serviceName.toLowerCase()} guidance.`,
    };
    const page: GeneratedServiceAreaPage = {
      serviceId,
      serviceName,
      area,
      areaSlug,
      pageSlug,
      slug,
      generatedAt: new Date().toISOString(),
      metaTitle: `${serviceName} ${area} | ${pharmacyName}`,
      metaDescription: framed.metaDescription,
      h1: `${serviceName} ${area}`,
      intro: framed.intro,
      sections: framed.sections,
      faqs: framed.faqs,
      cta,
      relatedServices,
      nearbyAreas: nearby,
      schema: buildAreaSchema({ serviceName, area, faqs: framed.faqs, pharmacyName }, pharmacy, town),
      aiSummary: `${serviceName} area page for patients in ${area} using publish framework V1.`,
      qualitySignals: {
        wordCount: 0,
        sectionCount: framed.sections.length,
        faqCount: framed.faqs.length,
        localReferenceCount: 0,
        duplicateRiskScore: 0,
        usesMasterServicePage: true,
        usesLocalArea: true,
        usesAuthorityLayer: false,
        usesEnrichedBlueprint: false,
        faqSourceEnrichedBlueprint: false,
        mythSourceEnrichedBlueprint: false,
        authoritySourceEnrichedBlueprint: false,
        patientQuestionsSourceEnrichedBlueprint: false,
        usesNarrativeIntelligence: false,
        usesEntityNarrative: false,
        localEntitySectionCount: 0,
        localEntityCount: 0,
      },
    };
    const fullText = [
      page.intro,
      ...page.sections.map((s) => `${s.heading} ${s.body} ${(s.bullets || []).join(" ")}`),
      ...page.faqs.map((f) => `${f.question} ${f.answer}`),
      page.cta.phonePrompt,
    ].join(" ");
    page.qualitySignals.wordCount = words(fullText);
    page.qualitySignals.duplicateRiskScore = duplicateRisk(master, page);
    page.qualitySignals.localReferenceCount = (fullText.match(new RegExp(area.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi")) || []).length;
    page.qualitySignals.localReferencesWithinTarget = page.qualitySignals.localReferenceCount >= 3;
    page.qualitySignals.weavingMeetsTarget = true;
    return page;
  }

  const clusterAreaSlugs = (blueprint.serviceAreaPages || [])
    .filter((p: any) => normalizeServiceId(p.serviceKey) === serviceId)
    .map((p: any) => slugify(p.area));

  const relevancePack = loadPharmacyLocalRelevancePack(slug, area) || {
    area,
    areaSlug,
    town,
    topHealthcare: [],
    topCommunity: [],
    topLandmarks: [],
  };

  const rewritten = rewriteAreaContent(
    { pharmacyName, town, serviceId, serviceName, area, nearbyAreas: nearby },
    relevancePack,
    master,
  );

  const variantBuild = buildClinicalSectionsFromVariants(
    serviceId,
    areaSlug,
    clusterAreaSlugs,
    rewritten.injectionContext,
  );

  const nearbySection = {
    type: "nearbyAreas",
    heading: `Also serving patients near ${area}`,
    body: `${pharmacyName} in ${town} supports patients from ${nearby.slice(0, 3).join(", ")}${nearby.length > 2 ? "" : ""} as well as ${area}. Pages stay focused on ${area} without listing every nearby place.`,
    bullets: nearby.slice(0, 3),
  };

  const relatedSection = relatedServices.length
    ? {
        type: "relatedServices",
        heading: `Related services for ${area} patients`,
        body: `Patients in ${area} booking ${serviceName.toLowerCase()} often ask about complementary pharmacy services:`,
        bullets: relatedServices.map((s) => s.serviceName),
      }
    : null;

  const localContext = buildLocalContextSection({
    area,
    town,
    pharmacyName,
    serviceName,
    healthcare: pickRelevanceEntityName(relevancePack.topHealthcare || relevancePack.healthcare, area),
    community: pickRelevanceEntityName(relevancePack.topCommunity || relevancePack.community, area),
  });

  let sections: any[];
  let pageIntro = rewritten.intro;
  let pageFaqs = rewritten.faqs;
  let pageCta = {
    ...rewritten.cta,
    ...(master.cta?.primary ? { primary: master.cta.primary } : {}),
  };
  let usesVariantLibrary = false;
  const enrichedBlueprint = getEnrichedBlueprint(serviceId);
  let usesEnrichedBlueprint = false;
  let faqSourceEnrichedBlueprint = false;
  let mythSourceEnrichedBlueprint = false;
  let authoritySourceEnrichedBlueprint = false;
  let patientQuestionsSourceEnrichedBlueprint = false;

  const blueprintTailSections = enrichedBlueprint
    ? buildAreaPageBlueprintSections(enrichedBlueprint, area, town, pharmacyName, areaSlug)
        .filter((s) => s.type !== "mythVsFact")
        .map((s) => ({
          type: s.type,
          heading: s.heading,
          body: s.body,
          bullets: s.bullets,
        }))
    : [];
  if (enrichedBlueprint) {
    usesEnrichedBlueprint = true;
    mythSourceEnrichedBlueprint = blueprintTailSections.some((s) => s.type === "mythVsFact");
    authoritySourceEnrichedBlueprint = blueprintTailSections.some((s) => s.type === "areaSuitability");
    patientQuestionsSourceEnrichedBlueprint = enrichedBlueprint.eligibilityQuestions.length > 0;
  }

  if (variantBuild) {
    usesVariantLibrary = true;
    if (enrichedBlueprint && variantBuild.sectionMap.mythVsFact) {
      const myths = selectBlueprintMyths(enrichedBlueprint, "area", serviceId, 4, areaSlug);
      variantBuild.sectionMap.mythVsFact = {
        type: "mythVsFact",
        heading: "Local service facts",
        body: `Accurate information helps ${area} patients use ${serviceName.toLowerCase()} appropriately:`,
        bullets: myths.map((m) => `Myth: ${m.myth} Fact: ${m.fact}`),
      };
    }
    pageIntro = variantBuild.selected.intro.body;
    pageFaqs = weaveFAQOpenings(
      variantBuild.selected.faqs.map((f, i) => ({
        ...f,
        question: localizeFaqQuestion(f.question, area, areaSlug, i, serviceId),
      })),
      rewritten.injectionContext,
      5,
    );
    pageCta = {
      primary: variantBuild.selected.cta.primary,
      secondary: variantBuild.selected.cta.secondary,
      phonePrompt: rewritten.cta.phonePrompt,
      bookingPrompt: rewritten.cta.bookingPrompt,
    };

    sections = assembleAreaSections({
      layout: variantBuild.layout,
      localServiceIntro: {
        type: "localServiceIntro",
        heading: rewritten.localServiceIntro.heading,
        body: rewritten.localServiceIntro.body,
        bullets: rewritten.localServiceIntro.bullets,
      },
      sectionMap: variantBuild.sectionMap,
      localNarrative: rewritten.localNarrative,
      localContext,
      tail: [...blueprintTailSections, nearbySection, ...(relatedSection ? [relatedSection] : [])].filter(Boolean),
    });
  } else {
    const masterPool = (master.sections || []).filter(
      (s: any) => !["hero", "cta", "faqs", "relatedServices", "relatedTopics"].includes(s.type),
    );
    const clinicalCount = Math.min(masterPool.length, Math.max(9, 8 + (seed % 3)));
    let clinicalSections = pickBySeed(masterPool, seed, clinicalCount);
    clinicalSections = sortByMasterOrder(clinicalSections, masterPool);
    const mustInclude = ["benefits", "howItWorks", "eligibility", "preparationGuide"];
    for (const type of mustInclude) {
      if (clinicalSections.some((s) => s.type === type)) continue;
      const extra = masterPool.find((s: any) => s.type === type);
      if (extra) clinicalSections = sortByMasterOrder([...clinicalSections, extra], masterPool);
    }
    clinicalSections = injectLocalIntoSections(clinicalSections, rewritten.injectionContext);

    sections = insertLocalAreaSections(
      {
        type: "localServiceIntro",
        heading: rewritten.localServiceIntro.heading,
        body: rewritten.localServiceIntro.body,
        bullets: rewritten.localServiceIntro.bullets,
      },
      clinicalSections,
      rewritten.localNarrative,
      localContext,
      [blueprintTailSections, nearbySection, ...(relatedSection ? [relatedSection] : [])].flat().filter(Boolean),
    );

    const faqPool = master.faqs || [];
    const faqCount = Math.min(faqPool.length, 8);
    const selectedFaqs = pickBySeed(faqPool, seed + 3, faqCount);
    pageFaqs = rewriteAreaContent(
      { pharmacyName, town, serviceId, serviceName, area, nearbyAreas: nearby },
      relevancePack,
      { faqs: selectedFaqs },
    ).faqs;
  }

  if (enrichedBlueprint) {
    const blueprintFaqs = selectBlueprintFaqs(enrichedBlueprint, "area", serviceId, 10, areaSlug);
    faqSourceEnrichedBlueprint = blueprintFaqs.length >= 6;
    pageFaqs = mergeBlueprintFaqs(blueprintFaqs, pageFaqs, 12);
  }

  const areaConversionProfile = conversionProfileFromData({
    ...(pharmacy as Record<string, unknown>),
    pharmacyName,
    townCity: town,
  });
  const boostedAreaCta = buildAreaConversionCta(serviceId, serviceName, area, areaConversionProfile);
  pageCta = {
    ...boostedAreaCta,
    phonePrompt: pageCta.phonePrompt || boostedAreaCta.phonePrompt,
    bookingPrompt: [
      boostedAreaCta.bookingPrompt || pageCta.bookingPrompt,
      areaConversionProfile.county
        ? `${area} patients in ${town}, ${areaConversionProfile.county} — contact ${pharmacyName} for ${serviceName.toLowerCase()} guidance.`
        : `${area} patients in ${town} — contact ${pharmacyName} for ${serviceName.toLowerCase()} guidance.`,
    ]
      .filter(Boolean)
      .join(" "),
  };

  if (!pageIntro.toLowerCase().includes(area.toLowerCase())) {
    pageIntro = `${pageIntro} Serving patients in ${area}.`;
  }
  pageIntro = `${pageIntro} ${pharmacyName} supports ${serviceName.toLowerCase()} for ${area} and ${town}${areaConversionProfile.county ? `, ${areaConversionProfile.county}` : ""}.`;

  const narrativeApplied = injectAreaNarrativeIntelligence({
    slug,
    area,
    areaSlug,
    serviceId,
    serviceName,
    pharmacyName,
    town,
    intro: pageIntro,
    sections,
    faqs: pageFaqs,
    cta: pageCta,
  });
  pageIntro = narrativeApplied.intro;
  sections = narrativeApplied.sections;
  pageFaqs = narrativeApplied.faqs;
  pageCta = narrativeApplied.cta;

  let entityApplied = {
    sections,
    entitiesUsed: [] as string[],
    blockIds: [] as string[],
    sectionVariantIds: [] as string[],
    entityCount: 0,
    blockCount: 0,
    sectionVariantCount: 0,
    wordCount: 0,
    localEntityVariantCategories: [] as string[],
    localEntityCount: 0,
    localEntitySectionCount: 0,
  };
  if (process.env.SKIP_ENTITY_NARRATIVES !== "1") {
    entityApplied = injectLocalEntitySectionVariants({
      slug,
      area,
      areaSlug,
      serviceId,
      serviceName,
      pharmacyName,
      town,
      pageSlug,
      intro: pageIntro,
      sections,
      cta: pageCta,
      profileData: pharmacy as Record<string, unknown>,
    });
    sections = entityApplied.sections;
  }

  const faqs = pageFaqs;
  const cta = pageCta;

  const fullText = [
    `${serviceName} ${area}`,
    pageIntro,
    ...sections.map((s: any) => `${s.heading} ${s.body} ${(s.bullets || []).join(" ")}`),
    ...faqs.map((f: any) => `${f.question} ${f.answer}`),
    cta.phonePrompt,
    cta.bookingPrompt,
    cta.emailPrompt || "",
  ].join(" ");

  const page: GeneratedServiceAreaPage = {
    serviceId,
    serviceName,
    area,
    areaSlug,
    pageSlug,
    slug,
    generatedAt: new Date().toISOString(),
    metaTitle: `${serviceName} ${area} | ${pharmacyName}`,
    metaDescription: rewritten.metaDescription,
    h1: `${serviceName} ${area}`,
    intro: pageIntro,
    sections,
    faqs,
    cta,
    relatedServices,
    nearbyAreas: nearby,
    schema: buildAreaSchema(
      { serviceName, area, faqs, pharmacyName },
      pharmacy,
      town,
    ),
    aiSummary: `${serviceName} area page for patients in ${area} — ${narrativeApplied.narrative.profile.narrativeType} narrative with local entity section variants (${entityApplied.localEntitySectionCount} sections, ${entityApplied.localEntityCount} entities).`,
    localEntityVariantCategories: entityApplied.localEntityVariantCategories,
    localEntityCount: entityApplied.localEntityCount,
    localEntitySectionCount: entityApplied.localEntitySectionCount,
    qualitySignals: {
      wordCount: 0,
      sectionCount: sections.length,
      faqCount: faqs.length,
      localReferenceCount: rewritten.localReferenceCount,
      duplicateRiskScore: 0,
      usesMasterServicePage: !usesVariantLibrary,
      usesLocalArea: true,
      usesAuthorityLayer: !!master.qualitySignals?.usesAuthorityLayer,
      usesEnrichedBlueprint,
      faqSourceEnrichedBlueprint,
      mythSourceEnrichedBlueprint,
      authoritySourceEnrichedBlueprint,
      patientQuestionsSourceEnrichedBlueprint,
      usesNarrativeIntelligence: true,
      narrativeType: narrativeApplied.narrative.profile.narrativeType,
      usesEntityNarrative: entityApplied.localEntitySectionCount > 0,
      entityNarrativeEntityCount: entityApplied.entityCount,
      entityNarrativeBlockCount: entityApplied.blockCount,
      entityNarrativeWordCount: entityApplied.wordCount,
      entityNarrativeSectionVariantCount: entityApplied.sectionVariantCount,
      entityNarrativeEntities: entityApplied.entitiesUsed,
      entityNarrativeBlockIds: entityApplied.blockIds,
      entityNarrativeSectionVariantIds: entityApplied.sectionVariantIds,
      localEntityVariantCategories: entityApplied.localEntityVariantCategories,
      localEntityCount: entityApplied.localEntityCount,
      localEntitySectionCount: entityApplied.localEntitySectionCount,
    },
  };

  page.qualitySignals.wordCount = words(fullText);
  page.qualitySignals.duplicateRiskScore = duplicateRisk(master, page);

  const pageRefs = computePageLocalReferences(page, rewritten.injectionContext);
  page.qualitySignals.localReferenceCount = pageRefs.mentionCount;
  page.qualitySignals.localReferencesWithinTarget = pageRefs.withinTarget;

  const weaving = measureLocalWeaving(
    { sections: page.sections, faqs: page.faqs, cta: page.cta },
    rewritten.injectionContext,
  );
  page.qualitySignals.weavingAreaMentions = weaving.areaMentions;
  page.qualitySignals.weavingPharmacyMentions = weaving.pharmacyMentions;
  page.qualitySignals.weavingMeetsTarget = weaving.meetsWeavingTarget;

  return page;
}

export function loadAllGeneratedServiceAreaPages(slug: string): {
  index: any;
  pages: GeneratedServiceAreaPage[];
} {
  const dir = path.join(ROOT, "data/pharmacy-generated-service-area-pages", slug);
  const index = readJson(path.join(dir, "_index.json"), null);
  if (!index) return { index: null, pages: [] };

  const pages: GeneratedServiceAreaPage[] = [];
  for (const entry of index.pages || []) {
    const page = readJson(path.join(dir, `${entry.pageSlug}.json`));
    if (page) pages.push(page);
  }
  return { index, pages };
}

export function getServiceAreaPageStatus(slug: string) {
  const blueprint = readJson(path.join(ROOT, "data/pharmacy-content-blueprints", `${slug}.json`));
  const { index, pages } = loadAllGeneratedServiceAreaPages(slug);
  const expected = blueprint?.serviceAreaPages?.length || 0;

  return {
    slug,
    expectedPageCount: expected,
    generatedPageCount: pages.length,
    hasIndex: !!index,
    lastGeneratedAt: index?.generatedAt || null,
    pages: (index?.pages || []).map((p: any) => ({
      pageSlug: p.pageSlug,
      serviceId: p.serviceId,
      serviceName: p.serviceName,
      area: p.area,
      wordCount: p.wordCount,
      duplicateRiskScore: p.duplicateRiskScore,
    })),
  };
}

export async function generatePharmacyServiceAreaPages(slug: string) {
  const { assertLegacyContentEngineAllowed } = await import(
    "./contentEngine/pharmacyLegacyContentEngineQuarantine.ts"
  );
  assertLegacyContentEngineAllowed("pharmacyServiceAreaPageGenerator", "generatePharmacyServiceAreaPages");

  const profile = readJson(path.join(ROOT, "data/pharmacy-profiles", `${slug}.json`), {});
  const blueprint = readJson(path.join(ROOT, "data/pharmacy-content-blueprints", `${slug}.json`));
  const localIntel = readJson(path.join(ROOT, "data/pharmacy-local-intelligence", `${slug}.json`), {});

  if (!blueprint) throw new Error(`Content Blueprint not found for ${slug}`);

  resetEntityNarrativeClusterTracker();
  resetLocalEntitySectionClusterTracker();

  const outDir = path.join(ROOT, "data/pharmacy-generated-service-area-pages", slug);
  fs.mkdirSync(outDir, { recursive: true });

  const pages = [];
  const builtPages: GeneratedServiceAreaPage[] = [];

  for (const item of blueprint.serviceAreaPages || []) {
    const page = buildAreaPage({ slug, profile, blueprint, localIntel }, item);
    writeJson(path.join(outDir, `${page.pageSlug}.json`), page);
    builtPages.push(page);
    pages.push({
      pageSlug: page.pageSlug,
      serviceId: page.serviceId,
      serviceName: page.serviceName,
      area: page.area,
      wordCount: page.qualitySignals.wordCount,
      duplicateRiskScore: page.qualitySignals.duplicateRiskScore,
    });
  }

  const diversityByService = new Map<string, any>();
  for (const serviceId of uniqueServiceIds(builtPages)) {
    const group = builtPages.filter((p) => p.serviceId === serviceId);
    diversityByService.set(serviceId, scoreAreaContentDiversity(group));
  }

  for (const page of builtPages) {
    const diversity = diversityByService.get(page.serviceId);
    page.qualitySignals.diversityScore = diversity?.diversityScore ?? 100;
    page.qualitySignals.diversityMeetsTarget = diversity?.meetsTarget ?? true;
    writeJson(path.join(outDir, `${page.pageSlug}.json`), page);
  }

  const index = {
    slug,
    generatedAt: new Date().toISOString(),
    pageCount: pages.length,
    generator: "v1-service-variant-library",
    diversityByService: Object.fromEntries(diversityByService),
    pages: pages.map((p) => {
      const d = diversityByService.get(p.serviceId);
      return { ...p, diversityScore: d?.diversityScore, diversityMeetsTarget: d?.meetsTarget };
    }),
  };

  writeJson(path.join(outDir, "_index.json"), index);
  return index;
}

function uniqueServiceIds(pages: GeneratedServiceAreaPage[]) {
  return Array.from(new Set(pages.map((p) => p.serviceId)));
}
