/**
 * LEGACY — quarantined by CPR-PLATFORM-RECOVERY-02.
 * Production area narrative uses composeCommercialClusterNarrativeV1.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertLegacyContentEngineAllowed } from "./contentEngine/pharmacyLegacyContentEngineQuarantine.ts";
import {
  buildAreaNarrativeProfile,
  CANONICAL_NARRATIVE_AREAS,
  type AreaNarrativeProfile,
  slugifyArea,
} from "./pharmacyAreaNarrativeProfiles.ts";
import {
  fillPattern,
  NARRATIVE_LIBRARY,
  pickPattern,
  type NarrativeType,
} from "./pharmacyAreaNarrativeLibrary.ts";
import { getLocalIntelligence, LOCAL_INTEL_DIR } from "./pharmacyAreaSelectionService.ts";
import type { GeneratedServiceAreaPage } from "./pharmacyServiceAreaPageGenerator.ts";

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
export const NARRATIVES_DIR = path.join(WORKSPACE_ROOT, "data/pharmacy-area-narratives");

export interface NarrativeContentBundle {
  profile: AreaNarrativeProfile;
  intro: string;
  patientJourney: string;
  healthcareContext: string;
  localLifestyle: string;
  ctaSupplement: string;
  bridgeParagraph: string;
  benefitsOpening: string;
  suitabilityOpening: string;
  preparationOpening: string;
  narrativeSection: {
    type: string;
    heading: string;
    body: string;
    bullets: string[];
  };
  faqOpenerPrefix: string;
  patternIndices: {
    intro: number;
    journey: number;
    healthcare: number;
    lifestyle: number;
    cta: number;
    faq: number;
    bridge: number;
  };
}

function readJson<T>(file: string, fallback: T | null = null): T | null {
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function writeJson(file: string, data: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function hashSeed(...parts: string[]): number {
  return parts.join("|").split("").reduce((n, c) => n + c.charCodeAt(0), 0);
}

function narrativeVars(
  profile: AreaNarrativeProfile,
  ctx: { serviceName: string; pharmacyName: string; town: string },
): Record<string, string> {
  return {
    areaName: profile.areaName,
    areaSlug: profile.areaSlug,
    town: ctx.town,
    pharmacyName: ctx.pharmacyName,
    serviceName: ctx.serviceName,
    populationType: profile.populationType,
    healthcareFocus: profile.healthcareFocus,
    patientBehaviour: profile.patientBehaviour,
    narrativeStyle: profile.narrativeStyle,
    narrativeType: profile.narrativeType,
  };
}

function patternIndex(seed: number, length: number): number {
  return ((seed % length) + length) % length;
}

export function generateNarrativeContent(
  profile: AreaNarrativeProfile,
  ctx: { serviceId: string; serviceName: string; pharmacyName: string; town: string },
): NarrativeContentBundle {
  const library = NARRATIVE_LIBRARY[profile.narrativeType];
  const vars = narrativeVars(profile, ctx);
  const baseSeed = hashSeed(profile.areaSlug, ctx.serviceId, profile.narrativeType);

  const introIdx = patternIndex(baseSeed, library.intro.length);
  const journeyIdx = patternIndex(baseSeed + 3, library.patientJourney.length);
  const hcIdx = patternIndex(baseSeed + 7, library.healthcareContext.length);
  const lifeIdx = patternIndex(baseSeed + 11, library.localLifestyle.length);
  const ctaIdx = patternIndex(baseSeed + 13, library.cta.length);
  const faqIdx = patternIndex(baseSeed + 17, library.faqOpener.length);
  const bridgeIdx = patternIndex(baseSeed + 19, library.bridge.length);

  const intro = fillPattern(library.intro[introIdx], vars);
  const patientJourney = fillPattern(library.patientJourney[journeyIdx], vars);
  const healthcareContext = fillPattern(library.healthcareContext[hcIdx], vars);
  const localLifestyle = fillPattern(library.localLifestyle[lifeIdx], vars);
  const ctaSupplement = fillPattern(library.cta[ctaIdx], vars);
  const bridgeParagraph = fillPattern(library.bridge[bridgeIdx], vars);
  const faqOpenerTemplate = library.faqOpener[faqIdx];

  const benefitsOpening = fillPattern(
    pickPattern(library.bridge, baseSeed + 21),
    vars,
  );
  const suitabilityOpening = fillPattern(
    pickPattern(library.healthcareContext, baseSeed + 23),
    vars,
  );
  const preparationOpening = fillPattern(
    pickPattern(library.patientJourney, baseSeed + 25),
    vars,
  );

  const sectionHeadings: Record<NarrativeType, string> = {
    health_management: `Health management journey for {{areaName}} patients`,
    working_professionals: `Working-life access to {{serviceName}} in {{areaName}}`,
    young_families: `Family healthcare journey in {{areaName}}`,
    community_health: `Community healthcare understanding in {{areaName}}`,
    preventative_health: `Preventative health planning in {{areaName}}`,
    travel_preparation: `Travel health preparation from {{areaName}}`,
    medication_support: `Medicine support journey in {{areaName}}`,
    wellbeing_focus: `Wellbeing-focused access in {{areaName}}`,
    retirement_health: `Retirement health continuity in {{areaName}}`,
    convenience_access: `Convenient access patterns in {{areaName}}`,
  };

  const narrativeSection = {
    type: "areaNarrativeIntelligence",
    heading: fillPattern(sectionHeadings[profile.narrativeType], vars),
    body: [intro, patientJourney, healthcareContext, localLifestyle, bridgeParagraph].join(" "),
    bullets: [
      profile.healthcareFocus,
      profile.patientBehaviour,
      profile.localLifestylePattern,
      profile.ctaIntent,
      profile.differentiationNotes,
    ],
  };

  return {
    profile,
    intro,
    patientJourney,
    healthcareContext,
    localLifestyle,
    ctaSupplement,
    bridgeParagraph,
    benefitsOpening,
    suitabilityOpening,
    preparationOpening,
    narrativeSection,
    faqOpenerPrefix: faqOpenerTemplate.replace("{{questionStub}}", "").trim(),
    patternIndices: {
      intro: introIdx,
      journey: journeyIdx,
      healthcare: hcIdx,
      lifestyle: lifeIdx,
      cta: ctaIdx,
      faq: faqIdx,
      bridge: bridgeIdx,
    },
  };
}

function prependOpening(body: string, opening: string): string {
  const b = String(body || "").trim();
  const o = String(opening || "").trim();
  if (!o) return b;
  if (b.toLowerCase().startsWith(o.slice(0, 40).toLowerCase())) return b;
  return `${o} ${b}`.trim();
}

function applyFaqNarrativeOpeners(
  faqs: Array<{ question: string; answer: string }>,
  bundle: NarrativeContentBundle,
  ctx: { serviceName: string; areaName: string },
): Array<{ question: string; answer: string }> {
  const library = NARRATIVE_LIBRARY[bundle.profile.narrativeType];
  return faqs.map((faq, i) => {
    const opener = fillPattern(
      pickPattern(library.faqOpener, hashSeed(bundle.profile.areaSlug, ctx.serviceName, String(i))),
      {
        areaName: ctx.areaName,
        serviceName: ctx.serviceName,
        pharmacyName: "",
        town: "",
        questionStub: "",
      },
    ).trim();
    const q = faq.question.trim();
    if (opener && !q.toLowerCase().startsWith(opener.slice(0, 12).toLowerCase())) {
      const merged = `${opener}${q.charAt(0).toLowerCase()}${q.slice(1)}`;
      return { ...faq, question: merged.endsWith("?") ? merged : `${merged}?` };
    }
    return faq;
  });
}

export function injectAreaNarrativeIntelligence(input: {
  slug: string;
  area: string;
  areaSlug: string;
  serviceId: string;
  serviceName: string;
  pharmacyName: string;
  town: string;
  intro: string;
  sections: Array<{ type: string; heading: string; body: string; bullets?: string[] }>;
  faqs: Array<{ question: string; answer: string }>;
  cta: GeneratedServiceAreaPage["cta"] & { emailPrompt?: string; bookingUrl?: string; businessEmail?: string };
}): {
  intro: string;
  sections: Array<{ type: string; heading: string; body: string; bullets?: string[] }>;
  faqs: Array<{ question: string; answer: string }>;
  cta: typeof input.cta;
  narrative: NarrativeContentBundle;
} {
  assertLegacyContentEngineAllowed("pharmacyAreaNarrativeIntelligence", "injectAreaNarrativeIntelligence");
  const profile =
    loadAreaNarrativeProfile(input.slug, input.areaSlug) || buildAreaNarrativeProfile(input.area);
  const narrative = generateNarrativeContent(profile, {
    serviceId: input.serviceId,
    serviceName: input.serviceName,
    pharmacyName: input.pharmacyName,
    town: input.town,
  });

  let intro = `${narrative.intro} ${input.intro}`.replace(/\s+/g, " ").trim();
  if (!intro.toLowerCase().includes(input.area.toLowerCase())) {
    intro = `${intro} This guidance applies to patients in ${input.area}.`;
  }

  const sections = input.sections
    .filter((s) => s.type !== "areaNarrativeIntelligence")
    .map((s) => {
      if (s.type === "benefits") {
        return { ...s, body: prependOpening(s.body, narrative.benefitsOpening) };
      }
      if (s.type === "eligibility" || s.type === "areaSuitability") {
        return { ...s, body: prependOpening(s.body, narrative.suitabilityOpening) };
      }
      if (s.type === "preparationGuide") {
        return { ...s, body: prependOpening(s.body, narrative.preparationOpening) };
      }
      if (s.type === "localNarrative") {
        return {
          ...s,
          body: prependOpening(s.body, `${narrative.patientJourney} ${narrative.healthcareContext}`),
        };
      }
      if (s.type === "localContext") {
        return { ...s, body: prependOpening(s.body, narrative.localLifestyle) };
      }
      if (s.type === "problem") {
        return { ...s, body: prependOpening(s.body, narrative.bridgeParagraph) };
      }
      return s;
    });

  const nearbyIdx = sections.findIndex((s) => s.type === "nearbyAreas");
  if (nearbyIdx >= 0) {
    sections.splice(nearbyIdx, 0, narrative.narrativeSection);
  } else {
    sections.push(narrative.narrativeSection);
  }

  const faqs = applyFaqNarrativeOpeners(input.faqs, narrative, {
    serviceName: input.serviceName,
    areaName: input.area,
  });

  const cta = {
    ...input.cta,
    bookingPrompt: [narrative.ctaSupplement, input.cta.bookingPrompt].filter(Boolean).join(" "),
    phonePrompt: input.cta.phonePrompt || narrative.ctaSupplement,
  };

  return { intro, sections, faqs, cta, narrative };
}

function loadProfileRankingAreas(slug: string): string[] {
  const profile = readJson<{ data?: { rankingAreas?: string[] } }>(
    path.join(WORKSPACE_ROOT, "data/pharmacy-profiles", `${slug}.json`),
  );
  return (profile?.data?.rankingAreas || []).filter(Boolean);
}

/**
 * Resolve areas for narrative profile generation.
 * Falls back to profile rankingAreas, then canonical pharmaconnect list.
 */
export function resolveAreasForNarrativeProfiles(slug: string): string[] {
  const localIntel = getLocalIntelligence(slug);
  const fromSelection = (localIntel.selectedAreas || []).filter(Boolean);
  if (fromSelection.length) return fromSelection;

  const fromProfile = loadProfileRankingAreas(slug);
  if (fromProfile.length) return fromProfile;

  if (slug === "pharmaconnect") return [...CANONICAL_NARRATIVE_AREAS];

  return [...CANONICAL_NARRATIVE_AREAS];
}

export function buildAreaNarrativeProfiles(slug: string): AreaNarrativeProfile[] {
  const areas = resolveAreasForNarrativeProfiles(slug);
  const outDir = path.join(NARRATIVES_DIR, slug);
  const profiles: AreaNarrativeProfile[] = [];

  for (const area of areas) {
    const profile = buildAreaNarrativeProfile(area);
    writeJson(path.join(outDir, `${profile.areaSlug}.json`), profile);
    profiles.push(profile);
  }

  writeJson(path.join(outDir, "_index.json"), {
    slug,
    version: "v1",
    generatedAt: new Date().toISOString(),
    profileCount: profiles.length,
    profiles: profiles.map((p) => ({
      areaSlug: p.areaSlug,
      areaName: p.areaName,
      narrativeType: p.narrativeType,
    })),
  });

  // Restore selectedAreas when local intelligence doc was wiped by entity generation
  const intelPath = path.join(LOCAL_INTEL_DIR, `${slug}.json`);
  const doc = readJson<Record<string, unknown>>(intelPath, {}) || {};
  if (!(doc.selectedAreas as string[] | undefined)?.length && areas.length) {
    writeJson(intelPath, {
      ...doc,
      slug,
      selectedAreas: areas,
      areaCandidates: areas.map((area) => ({
        area,
        score: 80,
        grade: "A",
        reason: "Restored from profile ranking areas for narrative intelligence",
        selected: true,
      })),
      areaScoredAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  return profiles;
}

export function loadAreaNarrativeProfile(slug: string, areaSlug: string): AreaNarrativeProfile | null {
  return readJson<AreaNarrativeProfile>(path.join(NARRATIVES_DIR, slug, `${areaSlug}.json`));
}

export function loadAllAreaNarrativeProfiles(slug: string): AreaNarrativeProfile[] {
  const dir = path.join(NARRATIVES_DIR, slug);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json") && !f.startsWith("_"))
    .map((f) => readJson<AreaNarrativeProfile>(path.join(dir, f)))
    .filter(Boolean) as AreaNarrativeProfile[];
}

export interface NarrativeDiversityScores {
  introDiversity: number;
  journeyDiversity: number;
  ctaDiversity: number;
  narrativeDiversity: number;
}

function uniqueRatio(values: string[]): number {
  const norm = values.map((v) => v.toLowerCase().replace(/\s+/g, " ").trim()).filter(Boolean);
  if (!norm.length) return 0;
  return Math.round((new Set(norm).size / norm.length) * 1000) / 10;
}

export function scoreNarrativeDiversity(
  pages: GeneratedServiceAreaPage[],
): NarrativeDiversityScores {
  const intros = pages.map((p) => p.intro || "");
  const journeys = pages.map(
    (p) => p.sections?.find((s) => s.type === "areaNarrativeIntelligence")?.body || "",
  );
  const ctas = pages.map((p) => p.cta?.bookingPrompt || "");
  const areaNarrativeTypes = new Map<string, string>();
  for (const p of pages) {
    const type =
      (p.qualitySignals as { narrativeType?: string })?.narrativeType ||
      p.sections?.find((s) => s.type === "areaNarrativeIntelligence")?.heading ||
      "";
    if (p.areaSlug && type) areaNarrativeTypes.set(p.areaSlug, type);
  }
  const narrativeTypeValues = [...areaNarrativeTypes.values()];
  return {
    introDiversity: uniqueRatio(intros),
    journeyDiversity: uniqueRatio(journeys),
    ctaDiversity: uniqueRatio(ctas),
    narrativeDiversity: uniqueRatio(narrativeTypeValues),
  };
}
