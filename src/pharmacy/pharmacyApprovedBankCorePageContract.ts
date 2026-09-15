/**
 * CORE-PAGE-APPROVED-BANK-RECONNECTION-28
 * Builds the service-page content contract from an approved ServiceVariantPack.
 * One bank (by serviceId) supplies service-page sections, locality pools, and FAQs.
 */
import fs from "node:fs";
import path from "node:path";
import type { ParsedMasterSection } from "./pharmacyVisualExperienceLayoutV2.ts";
import {
  loadApprovedServiceBankRegistry,
  pickServiceVariantFaqs,
  selectAreaVariants,
  WORKSPACE_ROOT,
  type FaqVariant,
  type ServiceVariantPack,
  type SectionVariant,
  type ApprovedBankLocalityPageSource,
} from "./pharmacyServiceVariantLibrary.ts";
import { hashSeed } from "./pharmacyLayoutTemplateLibrary.ts";

export const APPROVED_PATHWAY_CRITERIA_SENTENCE =
  "Treatment is supplied only where pathway criteria are met; otherwise you receive advice or referral.";

export function restoreApprovedBankTruncatedCopy(text: string): string {
  return String(text || "").replace(
    /Treatment is supplied only where pathway criter(?!ia\b)/g,
    APPROVED_PATHWAY_CRITERIA_SENTENCE,
  );
}

function serviceOverviewHeading(serviceId: string, serviceName: string): string {
  if (serviceId === "pharmacy-first" || /^pharmacy first$/i.test(serviceName)) {
    return "What Pharmacy First is";
  }
  return `What ${serviceName} Are`;
}

function uniqueOverviewBodies(bodies: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const body of bodies) {
    const restored = restoreApprovedBankTruncatedCopy(body).trim();
    if (!restored) continue;
    const key = restored
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/treatment is supplied only where pathway criteria are met; otherwise you receive advice or referral\.?/g, "")
      .trim()
      .slice(0, 160);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(restored);
  }
  return out;
}

function uniqueHtmlHeadingBlocks(html: string): string {
  const source = restoreApprovedBankTruncatedCopy(html);
  const h3Blocks = source.match(/<h3\b[\s\S]*?(?=<h3\b|$)/gi);
  if (h3Blocks && h3Blocks.length > 1) {
    const seen = new Set<string>();
    const kept: string[] = [];
    for (const block of h3Blocks) {
      const title = (block.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i)?.[1] || "")
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
      if (title && seen.has(title)) continue;
      if (title) seen.add(title);
      kept.push(block.trim());
    }
    return kept.join("\n");
  }
  if (/<p><strong>/i.test(source)) {
    const strongBlocks = source.split(/\n+/).filter(Boolean);
    const seen = new Set<string>();
    const kept: string[] = [];
    for (const block of strongBlocks) {
      const title = (block.match(/<strong>([^<]+)<\/strong>/i)?.[1] || "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
      if (title && seen.has(title)) continue;
      if (title) seen.add(title);
      kept.push(block);
    }
    return kept.join("\n");
  }
  if (/<p\b/i.test(source) && !/<h3\b/i.test(source) && !/<ul\b/i.test(source) && !/<ol\b/i.test(source)) {
    return uniqueOverviewBodies(
      source
        .split(/<\/p>/i)
        .map((part) => part.replace(/<p\b[^>]*>/i, "").replace(/<[^>]+>/g, "").trim())
        .filter(Boolean),
    )
      .map((body) => `<p>${esc(body)}</p>`)
      .join("\n");
  }
  return source;
}

function repairFaqContactPlaceholder(answer: string): string {
  // Leave "on ." for render-time phone localisation. Do not bake a pharmacy number into the bank contract.
  return String(answer || "").replace(/\.\./g, ".").trim();
}

function repairApprovedBankServicePageContract(
  contract: ApprovedBankServicePageContract,
  pack: ServiceVariantPack,
): ApprovedBankServicePageContract {
  const processPool = pack.howItWorks?.length ? pack.howItWorks : pack.treatmentProcess || [];
  const processTitles = new Set(contract.processSteps.map((step) => step.title.trim().toLowerCase()));
  const processSteps =
    processTitles.size < contract.processSteps.length && processPool.length
      ? uniquifyLocalityProcessSteps(processPool)
      : contract.processSteps.map((step, index) => ({
          ...step,
          title: step.title.trim() || `Step ${index + 1}`,
          body: restoreApprovedBankTruncatedCopy(step.body),
        }));

  return {
    ...contract,
    sections: contract.sections.map((section) => ({
      ...section,
      title:
        /what pharmacy first are/i.test(section.title)
          ? "What Pharmacy First is"
          : section.title,
      proseHtml: uniqueHtmlHeadingBlocks(section.proseHtml),
    })),
    processSteps,
    faqs: contract.faqs.map((faq) => ({
      ...faq,
      answer: repairFaqContactPlaceholder(faq.answer),
    })),
    heroIntroBody: restoreApprovedBankTruncatedCopy(contract.heroIntroBody),
  };
}

export const APPROVED_BANK_CORE_PAGE_CONTRACT = "approved-bank-core-page-v1";
export const SERVICE_PAGE_BANK_SEED = "__service-page__";

export interface ApprovedBankServicePageSection {
  num: string;
  kicker: string;
  title: string;
  proseHtml: string;
}

export interface ApprovedBankProcessStep {
  stepNumber: number;
  title: string;
  body: string;
  bullets?: string[];
}

export interface ApprovedBankServicePageContract {
  contractId: typeof APPROVED_BANK_CORE_PAGE_CONTRACT;
  serviceId: string;
  serviceName: string;
  bankVersion: number | string;
  sections: ApprovedBankServicePageSection[];
  processSteps: ApprovedBankProcessStep[];
  faqs: FaqVariant[];
  heroIntroBody: string;
}

function esc(text: string): string {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function paragraphsHtml(bodies: string[]): string {
  return bodies
    .map((b) => String(b || "").trim())
    .filter(Boolean)
    .map((b) => `<p>${esc(b)}</p>`)
    .join("\n");
}

function sectionVariantProse(variant: SectionVariant | undefined): string {
  if (!variant) return "";
  const parts: string[] = [];
  if (variant.heading) parts.push(`<h3>${esc(variant.heading)}</h3>`);
  if (variant.body) parts.push(`<p>${esc(variant.body)}</p>`);
  if (variant.bullets?.length) {
    parts.push(
      `<ul>${variant.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`,
    );
  }
  return parts.join("\n");
}

function uniqueVariantsByHeading(variants: SectionVariant[] | undefined, limit: number): SectionVariant[] {
  const seen = new Set<string>();
  const out: SectionVariant[] = [];
  for (const variant of variants || []) {
    const key = String(variant.heading || "").replace(/\s+/g, " ").trim().toLowerCase();
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    out.push(variant);
    if (out.length >= limit) break;
  }
  return out;
}

function multiSectionProse(variants: SectionVariant[] | undefined, limit = 4): string {
  return uniqueVariantsByHeading(variants, limit)
    .map((v) => sectionVariantProse(v))
    .filter(Boolean)
    .join("\n");
}

function titledCardsFromVariants(variants: SectionVariant[] | undefined, limit = 7): string {
  return uniqueVariantsByHeading(variants, limit)
    .map((v) => {
      const body = [v.body, ...(v.bullets || []).map((b) => b)].filter(Boolean).join(" ");
      return `<p><strong>${esc(v.heading || "Key point")}</strong> ${esc(body)}</p>`;
    })
    .join("\n");
}

function processOrderedHtml(variants: SectionVariant[] | undefined): string {
  const steps = uniquifyLocalityProcessSteps(variants || []).slice(0, 4);
  if (!steps.length) return "";
  const items = steps
    .map((v) => {
      const body = [v.body, ...(v.bullets || []).slice(0, 2).map((b) => b)].filter(Boolean).join(" ");
      return `<li><strong>${esc(v.title || "Step")}</strong> ${esc(body)}</li>`;
    })
    .join("\n");
  return `<ol>${items}</ol>`;
}

function buildProcessSteps(variants: SectionVariant[] | undefined): ApprovedBankProcessStep[] {
  return (variants || [])
    .slice(0, 4)
    .map((v, index) => ({
      stepNumber: index + 1,
      title: String(v.heading || `Step ${index + 1}`).trim(),
      body: [v.body, ...(v.bullets || []).map((b) => b)].filter(Boolean).join(" ").trim(),
    }))
    .filter((step) => step.title && step.body);
}

function uniquifyLocalityProcessSteps(
  variants: SectionVariant[],
): ApprovedBankProcessStep[] {
  const used = new Set<string>();
  const headingCounts = new Map<string, number>();
  for (const v of variants) {
    const key = String(v.heading || "").trim().toLowerCase();
    if (!key) continue;
    headingCounts.set(key, (headingCounts.get(key) || 0) + 1);
  }
  return variants
    .slice(0, 4)
    .map((v, index) => {
      const heading = String(v.heading || `Step ${index + 1}`).trim();
      const headingKey = heading.toLowerCase();
      const candidates = [
        (headingCounts.get(headingKey) || 0) > 1 ? "" : heading,
        ...(v.bullets || []).map((b) => String(b).trim()),
        String(v.body || "")
          .split(/(?<=[.!?])\s+/)[0]
          ?.trim() || "",
        heading,
      ].filter(Boolean);
      const title = candidates.find((c) => !used.has(c.toLowerCase())) || `${heading} ${index + 1}`;
      used.add(title.toLowerCase());
      return {
        stepNumber: index + 1,
        title,
        body: String(v.body || "").trim(),
        bullets: (v.bullets || []).map((b) => String(b).trim()).filter(Boolean),
      };
    })
    .filter((step) => step.title && (step.body || step.bullets?.length));
}

/**
 * Derive the accepted service-page content contract from approved bank pools.
 * Uses deterministic service-page seed (not locality hashing) so the main page is stable.
 */
export function buildApprovedBankServicePageContract(
  pack: ServiceVariantPack,
): ApprovedBankServicePageContract {
  const intros = (pack.intro || []).map((i) => i.body).filter(Boolean);
  const definitionBodies = [
    ...intros.slice(0, 2),
    pack.benefits?.[0]?.body,
    pack.patientEducation?.[0]?.body,
  ].filter(Boolean) as string[];

  const processPool =
    pack.howItWorks?.length ? pack.howItWorks : pack.treatmentProcess || [];
  const conditionsPool = pack.problem?.length ? pack.problem : pack.patientEducation || [];
  const safetyPool = pack.trustSafety?.length ? pack.trustSafety : pack.mythVsFact || [];

  const sections: ApprovedBankServicePageSection[] = [
    {
      num: "1",
      kicker: "Service overview",
      title: serviceOverviewHeading(pack.serviceId, pack.serviceName),
      proseHtml: paragraphsHtml(uniqueOverviewBodies(definitionBodies)),
    },
    {
      num: "2",
      kicker: "Key points",
      title: `Who Should Consider ${pack.serviceName}`,
      proseHtml: titledCardsFromVariants(conditionsPool, 7),
    },
    {
      num: "3",
      kicker: "Eligibility",
      title: "Eligibility and suitability",
      proseHtml: multiSectionProse(pack.eligibility, 4),
    },
    {
      num: "4",
      kicker: "Process",
      title: "What happens during the consultation",
      proseHtml: processOrderedHtml(processPool),
    },
    {
      num: "5",
      kicker: "Clinical environment",
      title: pack.preparationGuide?.[0]?.heading || "Preparing for your visit",
      proseHtml: sectionVariantProse(pack.preparationGuide?.[0]),
    },
    {
      num: "6",
      kicker: "Safety",
      title: safetyPool[0]?.heading || "When to seek GP or urgent care",
      proseHtml: titledCardsFromVariants(safetyPool, 4),
    },
    {
      num: "9",
      kicker: "Trust",
      title: `Trust and credentials for ${pack.serviceName}`,
      proseHtml: multiSectionProse(pack.trustSafety, 2) || paragraphsHtml(intros.slice(0, 1)),
    },
  ].filter((s) => s.proseHtml.trim());

  const faqs = pickServiceVariantFaqs(
    pack.faqs || [],
    pack.serviceId,
    SERVICE_PAGE_BANK_SEED,
    8,
  );

  return {
    contractId: APPROVED_BANK_CORE_PAGE_CONTRACT,
    serviceId: pack.serviceId,
    serviceName: pack.serviceName,
    bankVersion: pack.version,
    sections,
    processSteps: uniquifyLocalityProcessSteps(processPool),
    faqs,
    heroIntroBody: intros[0] || "",
  };
}

/** Convert bank service-page contract into Layout V3 ParsedMasterSection map. */
export function approvedBankContractToParsedSections(
  contract: ApprovedBankServicePageContract,
): Map<string, ParsedMasterSection> {
  const map = new Map<string, ParsedMasterSection>();
  for (const section of contract.sections) {
    map.set(section.num, {
      num: section.num,
      kicker: section.kicker,
      title: section.title,
      proseHtml: section.proseHtml,
      rawHtml: "",
    });
  }
  return map;
}

export function isCompleteApprovedBankServicePageContract(
  contract: Partial<ApprovedBankServicePageContract> | null | undefined,
): contract is ApprovedBankServicePageContract {
  return Boolean(
    contract &&
      contract.contractId === APPROVED_BANK_CORE_PAGE_CONTRACT &&
      Array.isArray(contract.sections) &&
      Array.isArray(contract.processSteps) &&
      Array.isArray(contract.faqs),
  );
}

function requireCompleteApprovedBankServicePageContract(
  contract: Partial<ApprovedBankServicePageContract> | null | undefined,
  serviceId: string,
): ApprovedBankServicePageContract {
  if (!isCompleteApprovedBankServicePageContract(contract) || contract.serviceId !== serviceId) {
    throw new Error(
      `The locked approved-bank service-page contract for "${serviceId}" is incomplete (sections, processSteps, and faqs are required). It cannot be repaired during rendering or generation.`,
    );
  }
  return contract;
}

function cloneFrozenServicePageContract(
  contract: ApprovedBankServicePageContract,
): ApprovedBankServicePageContract {
  return deepFreezeJson(JSON.parse(JSON.stringify(contract)) as ApprovedBankServicePageContract);
}

function deepFreezeJson<T>(value: T): T {
  if (!value || typeof value !== "object") return value;
  Object.freeze(value);
  if (Array.isArray(value)) {
    for (const item of value) deepFreezeJson(item);
    return value;
  }
  for (const item of Object.values(value as Record<string, unknown>)) {
    deepFreezeJson(item);
  }
  return value;
}

/** Locked JSON may omit required arrays; fill those from the approved bank without replacing present copy. Offline only. */
function completeApprovedBankServicePageContract(
  pack: ServiceVariantPack,
  locked: Partial<ApprovedBankServicePageContract> | null,
): ApprovedBankServicePageContract {
  const built = buildApprovedBankServicePageContract(pack);
  if (isCompleteApprovedBankServicePageContract(locked) && locked.serviceId === pack.serviceId) {
    return locked;
  }
  return requireCompleteApprovedBankServicePageContract(
    {
      contractId: APPROVED_BANK_CORE_PAGE_CONTRACT,
      serviceId: pack.serviceId,
      serviceName: locked?.serviceName || built.serviceName,
      bankVersion: locked?.bankVersion ?? built.bankVersion,
      sections: Array.isArray(locked?.sections) ? locked.sections : built.sections,
      processSteps: Array.isArray(locked?.processSteps) ? locked.processSteps : built.processSteps,
      faqs: Array.isArray(locked?.faqs) ? locked.faqs : built.faqs,
      heroIntroBody: locked?.heroIntroBody || built.heroIntroBody,
    },
    pack.serviceId,
  );
}

function loadLockedServicePageContract(serviceId: string): Partial<ApprovedBankServicePageContract> | null {
  const registry = loadApprovedServiceBankRegistry();
  const rel = (
    registry?.services?.[serviceId]?.allowedGeneratorContract as
      | { servicePageContractRelativePath?: string }
      | undefined
  )?.servicePageContractRelativePath;
  if (!rel) return null;
  const abs = path.join(WORKSPACE_ROOT, rel);
  if (!fs.existsSync(abs)) return null;
  try {
    const doc = JSON.parse(fs.readFileSync(abs, "utf8")) as {
      contractId?: string;
      contract?: Partial<ApprovedBankServicePageContract>;
    } & Partial<ApprovedBankServicePageContract>;
    const contract = doc.contract?.contractId ? doc.contract : doc.contractId ? doc : null;
    if (contract?.contractId === APPROVED_BANK_CORE_PAGE_CONTRACT && contract.serviceId === serviceId) {
      return contract;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Read-only load of the stored locked service-page contract.
 * Returns a frozen clone. Does not repair, persist, complete from the bank, or mutate the file.
 */
export function loadLockedApprovedBankServicePageContract(
  serviceId: string,
): ApprovedBankServicePageContract {
  const locked = loadLockedServicePageContract(serviceId);
  if (!locked) {
    throw new Error(
      `The locked approved-bank service-page contract for "${serviceId}" is missing and cannot be invented during rendering or generation.`,
    );
  }
  return cloneFrozenServicePageContract(requireCompleteApprovedBankServicePageContract(locked, serviceId));
}

/**
 * Offline-only locked-contract migration. Must not be called by customer rendering,
 * Review Centre Preview, or campaign generation.
 */
export function migrateApprovedBankServicePageContractOffline(
  pack: ServiceVariantPack,
  locked: Partial<ApprovedBankServicePageContract> | null = loadLockedServicePageContract(pack.serviceId),
): ApprovedBankServicePageContract {
  return repairApprovedBankServicePageContract(
    completeApprovedBankServicePageContract(pack, locked),
    pack,
  );
}

/** Attach the stored locked service-page contract. Read-only: no repair, persist, or bank fill. */
export function withApprovedBankServicePageContract(
  pack: ServiceVariantPack & { servicePage?: ApprovedBankServicePageContract },
): ServiceVariantPack & { servicePage: ApprovedBankServicePageContract } {
  return { ...pack, servicePage: loadLockedApprovedBankServicePageContract(pack.serviceId) };
}

/** Shared approved-bank locality-page contract — same bank pools as the service page, area-seeded. */
export const APPROVED_BANK_LOCALITY_PAGE_CONTRACT = "approved-bank-locality-page-v1";

export interface ApprovedBankLocalityPageContract {
  contractId: typeof APPROVED_BANK_LOCALITY_PAGE_CONTRACT;
  serviceId: string;
  serviceName: string;
  areaSlug: string;
  explanationHeading: string;
  explanationBody: string;
  explanationBullets: string[];
  considerHeading: string;
  considerBody: string;
  considerBullets: string[];
  scopeHeading: string;
  scopeBody: string;
  scopeBullets: string[];
  processHeading: string;
  processBody: string;
  processSteps: ApprovedBankProcessStep[];
  preparationHeading: string;
  preparationBody: string;
  preparationBullets: string[];
  safetyHeading: string;
  safetyBody: string;
  safetyBullets: string[];
  faqs: FaqVariant[];
}

function localityOverlay(pack: ServiceVariantPack): ApprovedBankLocalityPageSource | null {
  const overlay = pack.localityPage;
  if (!overlay || typeof overlay !== "object") return null;
  return overlay;
}

function uniqueBodies(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const body = String(value || "").trim();
    if (!body || seen.has(body)) continue;
    seen.add(body);
    out.push(body);
  }
  return out;
}

function screeningDiagnosisBodies(
  pack: ServiceVariantPack,
  selectedEligibility?: SectionVariant,
  selectedSafety?: SectionVariant,
): string[] {
  const pool = [
    selectedEligibility?.body,
    selectedSafety?.body,
    ...(pack.eligibility || []).map((item) => item.body),
    ...(pack.trustSafety || []).map((item) => item.body),
    ...(pack.patientEducation || []).map((item) => item.body),
  ];
  return uniqueBodies(pool).filter((body) =>
    /diagnos|screen|one reading|does not diagnose|not a diagnosis/i.test(body),
  );
}

/**
 * Compose the complete locality-page contract from the approved bank.
 * Uses selectAreaVariants for locality uniqueness and the remaining pools for section coverage.
 * Prefers localityPage overlay when present. Does not invent eligibility, supply,
 * appointments, walk-ins, stock, or operating arrangements.
 */
export function buildApprovedBankLocalityPageContract(
  pack: ServiceVariantPack,
  areaSlug: string,
  areaSlugsInCluster: string[] = [],
): ApprovedBankLocalityPageContract {
  const selected = selectAreaVariants(pack, areaSlug, "local-cluster-v1", areaSlugsInCluster);
  const overlay = localityOverlay(pack);

  const problem = selected.sections.problem;
  const benefits = selected.sections.benefits;
  const eligibility = selected.sections.eligibility;
  const howItWorks = selected.sections.howItWorks;
  const preparation = selected.sections.preparationGuide;
  const trustSafety = selected.sections.trustSafety;
  const education = selected.sections.patientEducation;

  const explanationBodies = uniqueBodies(
    overlay?.overviewParagraphs?.length
      ? overlay.overviewParagraphs
      : [
          selected.intro?.body,
          education?.body,
          problem?.body,
          benefits?.body,
          ...screeningDiagnosisBodies(pack, eligibility, trustSafety).slice(0, 1),
        ],
  ).slice(0, 4);

  const processPool = pack.howItWorks?.length ? pack.howItWorks : pack.treatmentProcess || [];
  const offset = processPool.length
    ? hashSeed(pack.serviceId, areaSlug, "locality-process") % processPool.length
    : 0;
  const rotatedProcess = processPool.length
    ? [...processPool.slice(offset), ...processPool.slice(0, offset)].slice(0, 4)
    : howItWorks
      ? [howItWorks]
      : [];
  const overlaySteps = (overlay?.processSteps || []).filter(
    (step) => String(step.heading || "").trim() && String(step.body || "").trim(),
  );
  const processSteps = overlaySteps.length
    ? uniquifyLocalityProcessSteps(overlaySteps.slice(0, 4))
    : uniquifyLocalityProcessSteps(rotatedProcess);

  const prepBodies = uniqueBodies(
    overlay?.preparationBody
      ? [overlay.preparationBody]
      : [preparation?.body, ...(pack.preparationGuide || []).map((item) => item.body)],
  ).slice(0, 2);
  const prepBullets = [
    ...(overlay?.preparationBullets || []),
    ...(overlay?.preparationBullets?.length ? [] : preparation?.bullets || []),
  ]
    .map((b) => String(b).trim())
    .filter(Boolean)
    .filter((b, i, arr) => arr.indexOf(b) === i)
    .slice(0, 6);

  const safetyBodies = uniqueBodies(
    overlay?.safetyBody
      ? [overlay.safetyBody]
      : [
          trustSafety?.body,
          ...(pack.trustSafety || [])
            .filter((item) => /diagnos|urgent|one reading|screen/i.test(`${item.heading} ${item.body}`))
            .map((item) => item.body),
        ],
  ).slice(0, 3);
  const safetyBullets = [
    ...(overlay?.safetyBullets || []),
    ...(overlay?.safetyBullets?.length ? [] : trustSafety?.bullets || []),
  ]
    .map((b) => String(b).trim())
    .filter(Boolean)
    .filter((b, i, arr) => arr.indexOf(b) === i)
    .slice(0, 6);

  const faqPool = overlay?.faqs?.length ? overlay.faqs : pack.faqs || [];
  const faqs = pickServiceVariantFaqs(faqPool, pack.serviceId, areaSlug, 6, areaSlugsInCluster);

  const explanationBullets = [
    ...(overlay?.overviewBullets || []),
    ...(overlay?.overviewBullets?.length ? [] : problem?.bullets || []),
  ]
    .map((b) => String(b).trim())
    .filter(Boolean)
    .filter((b, i, arr) => arr.indexOf(b) === i)
    .slice(0, 4);

  return {
    contractId: APPROVED_BANK_LOCALITY_PAGE_CONTRACT,
    serviceId: pack.serviceId,
    serviceName: pack.serviceName,
    areaSlug,
    explanationHeading:
      overlay?.overviewHeading ||
      (pack.serviceId === "blood-pressure-checks"
        ? "What Blood Pressure Checks are"
        : `What ${pack.serviceName} is`),
    explanationBody: explanationBodies.join("\n\n"),
    explanationBullets,
    considerHeading: overlay?.considerHeading || `When to contact the pharmacy about ${pack.serviceName}`,
    considerBody: overlay?.considerBody
      ? String(overlay.considerBody).trim()
      : uniqueBodies([problem?.body, benefits?.body, eligibility?.body]).join("\n\n"),
    considerBullets: [
      ...(overlay?.considerBullets || []),
      ...(overlay?.considerBullets?.length ? [] : problem?.bullets || []),
      ...(overlay?.considerBullets?.length ? [] : benefits?.bullets || []),
    ]
      .map((b) => String(b).trim())
      .filter(Boolean)
      .filter((b, i, arr) => arr.indexOf(b) === i)
      .slice(0, 6),
    scopeHeading: overlay?.scopeHeading || eligibility?.heading || "What this service may cover",
    scopeBody: String(overlay?.scopeBody || eligibility?.body || "").trim(),
    scopeBullets: [
      ...(overlay?.scopeBullets || []),
      ...(overlay?.scopeBullets?.length ? [] : eligibility?.bullets || []),
    ]
      .map((b) => String(b).trim())
      .filter(Boolean)
      .filter((b, i, arr) => arr.indexOf(b) === i),
    processHeading: overlay?.processHeading || "What happens next",
    processBody: String(overlay?.processBody || howItWorks?.body || "").trim(),
    processSteps,
    preparationHeading:
      overlay?.preparationHeading ||
      (pack.serviceId === "blood-pressure-checks"
        ? "Getting an accurate reading"
        : `Preparing for ${pack.serviceName}`),
    preparationBody: prepBodies.join("\n\n"),
    preparationBullets: prepBullets,
    safetyHeading:
      overlay?.safetyHeading ||
      (pack.serviceId === "blood-pressure-checks"
        ? "Results and safety"
        : `Staying safe with ${pack.serviceName}`),
    safetyBody: safetyBodies.join("\n\n"),
    safetyBullets,
    faqs,
  };
}
