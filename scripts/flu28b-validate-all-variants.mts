#!/usr/bin/env npx tsx
/**
 * FLU-APPROVED-BANK-COMMERCIAL-CONTENT-28B — validate EVERY Flu bank variant for commercial content rules.
 */
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import {
  pickServiceVariantFaqs,
  type ServiceVariantPack,
  type SectionVariant,
} from "../src/pharmacy/pharmacyServiceVariantLibrary.ts";
import {
  buildApprovedBankServicePageContract,
  SERVICE_PAGE_BANK_SEED,
} from "../src/pharmacy/pharmacyApprovedBankCorePageContract.ts";
import { composeCommercialClusterNarrativeV1 } from "../src/pharmacy/pharmacyLocalClusterContentEngine.ts";
import type { ContentGenerationContext } from "../src/pharmacy/contentEngine/contentGenerationContextTypes.ts";
import {
  beginLocalityVariationSessionV1,
  endLocalityVariationSessionV1,
} from "../src/pharmacy/contentEngine/pharmacyLocalityVariationSessionV1.ts";

const BANK_PATH = process.argv[2];
const OUT = "/tmp/flu28b-variant-validation.json";
const SERVICE_ID = "flu-vaccinations";
const SERVICE_NAME = "Flu Vaccinations";

const PROHIBITED = [
  { re: /\bover[- ]?65\b/i, label: "age threshold (over-65)" },
  { re: /\bunder[- ]?\d+\b/i, label: "age threshold" },
  { re: /\bage[- ]specific\b/i, label: "age-specific limits" },
  { re: /\bpaediatric\b|\bfor my child\b|\bchild(?:ren)?\b/i, label: "paediatric content" },
  { re: /\bpregnan(?:t|cy)\b/i, label: "pregnancy eligibility" },
  { re: /\bcarer(?:s)?\b|\bhousehold contacts?\b/i, label: "carer/risk-group eligibility" },
  { re: /\bhigher[- ]risk\b|\beligibility groups?\b|\brisk groups?\b/i, label: "risk-group eligibility" },
  { re: /\bGPhC\b|\bgphc[- ]regulated\b|\btrained (?:pharmacist|clinician)s?\b/i, label: "regulation/staff claim" },
  { re: /\bconsultation room\b|\bconfidential consultation\b|\bprivate consultation room\b/i, label: "consultation-room claim" },
  { re: /\b15[\u2013-]30\s*minutes?\b|\b\d+[\u2013-]\d+\s*minutes?\b/i, label: "consultation duration" },
  { re: /\bappointment\b|\bwalk[- ]?in\b|\bbook(?:ing)? online\b/i, label: "booking/walk-in assumption" },
  { re: /\bnhs[- ]funded\b|\bnhs\s+flu\b|\bfree\b|\bcommission(?:ing|ed)?\b|\bprivate\s+service\b/i, label: "NHS/private/commissioning" },
  { re: /\bprofessional seasonal flu vaccination\b/i, label: "repeated marketing phrase" },
  { re: /\bGP (?:details|surgery|referral document)\b|\breferral document\b|\btravel (?:dates|itinerary|document)\b/i, label: "irrelevant documents" },
  { re: /\bGP referral\b|\bwithout GP referral\b|\bmany pharmacy services are accessible without\b/i, label: "GP-referral promise" },
  { re: /\bprovides treatment\b|\btreatment or advice\b|\bsupply involved\b|\bsymptom timeline\b/i, label: "treatment/other-service content" },
  { re: /\bFor [A-Za-z]+ residents:/i, label: "locality-prefixed FAQ in bank" },
  { re: /\bpharmacy access —/i, label: "locality-prefixed FAQ in bank" },
  { re: /\bLocal guidance for [A-Za-z]+:/i, label: "locality-prefixed FAQ in bank" },
  { re: /\bblood\s*pressure\b|\bpharmacy\s+first\b|\btravel\s+vaccin/i, label: "cross-service content" },
  { re: /\bsame[- ]day\b/i, label: "operating assumption (same-day)" },
  { re: /\bregulated premises\b|\baudit[- ]ready\b/i, label: "pharmacy trust fact in bank" },
];

function mockCtx(pack: ServiceVariantPack): ContentGenerationContext {
  return {
    contractVersion: "content-engine-v1",
    resolvedSlug: "neutral-fixture-pharmacy",
    serviceId: SERVICE_ID,
    serviceName: SERVICE_NAME,
    profile: {
      pharmacyName: "Neutral Fixture Pharmacy",
      town: "Neutral Town",
      phone: "01234 567890",
      website: "https://example-neutral-pharmacy.test",
      addressLine1: "1 Neutral High Street",
      postcode: "N0 0NE",
      gphcNumber: "",
    } as ContentGenerationContext["profile"],
    rawProfile: {
      pharmacyName: "Neutral Fixture Pharmacy",
      primaryTown: "Neutral Town",
      selectedServices: [SERVICE_ID],
      selectedAreas: [{ areaName: "Neutral Verified Locality", selected: true, order: 1 }],
      serviceDeliveryProfiles: {
        [SERVICE_ID]: { fundingModel: "unknown", walkInAvailable: null, appointmentRequired: null },
      },
    } as ContentGenerationContext["rawProfile"],
    selectedAreas: [
      { areaName: "Neutral Verified Locality", areaSlug: "neutral-verified-locality", selected: true, order: 1 },
    ],
    cta: { phone: "01234 567890", website: "https://example-neutral-pharmacy.test" },
    links: { ecosystemRoot: path.join("/tmp", "flu28b-no-write") },
    variantPack: pack,
  } as ContentGenerationContext;
}

function scanCommercial(label: string, text: string, failures: string[]) {
  const cleaned = text.replace(/\bNHS\s*111\b/gi, "URGENT_CARE_REF");
  for (const rule of PROHIBITED) {
    const m = cleaned.match(rule.re);
    if (m) failures.push(`${label}: prohibited ${rule.label} (${m[0]})`);
  }
  if (/\bsuitability,\s*suitability\b/i.test(cleaned)) {
    failures.push(`${label}: duplicated phrase suitability, suitability`);
  }
}

function renderForced(
  pack: ServiceVariantPack,
  override: Partial<Record<string, SectionVariant | { body: string } | unknown>>,
  areaSlug: string,
): string {
  const forced = JSON.parse(JSON.stringify(pack)) as ServiceVariantPack;
  for (const [slot, item] of Object.entries(override)) {
    (forced as Record<string, unknown>)[slot] = [item];
  }
  const ctx = mockCtx(forced);
  const content = composeCommercialClusterNarrativeV1(
    {
      slug: "neutral-fixture-pharmacy",
      serviceId: SERVICE_ID,
      serviceName: SERVICE_NAME,
      areaName: "Neutral Verified Locality",
      areaSlug,
      nearbyAreaNames: [],
      areaSlugsInCluster: [areaSlug],
    },
    ctx,
  );
  return [
    content.heroIntro,
    content.whyChecksHeading,
    content.whyChecksBody,
    ...(content.whyChecksBullets || []),
    content.processHeading,
    content.processIntro,
    ...(content.processSteps || []).flatMap((s) => [s.title, s.body]),
    content.localRelevanceHeading,
    content.localRelevanceBody,
    content.clinicalEnvironmentHeading,
    content.clinicalEnvironmentBody,
    content.trustHeading,
    content.trustBody,
  ]
    .filter(Boolean)
    .join("\n");
}

function main() {
  if (!BANK_PATH || !fs.existsSync(BANK_PATH)) {
    console.error("Usage: flu28b-validate-all-variants.mts <bank.json>");
    process.exit(1);
  }
  const pack = JSON.parse(fs.readFileSync(BANK_PATH, "utf8")) as ServiceVariantPack;
  const failures: string[] = [];
  const inventory: Array<{ kind: string; id: string }> = [];

  scanCommercial("bank.raw", JSON.stringify(pack), failures);
  for (const [i, f] of (pack.faqs || []).entries()) {
    scanCommercial(`bank.faq[${i}].q`, f.question, failures);
    scanCommercial(`bank.faq[${i}].a`, f.answer, failures);
    if (!f.question.trim().endsWith("?")) failures.push(`bank.faq[${i}].q: incomplete FAQ question`);
  }

  const contract = buildApprovedBankServicePageContract(pack);
  inventory.push({ kind: "service-page-contract", id: SERVICE_PAGE_BANK_SEED });
  for (const section of contract.sections) {
    scanCommercial(
      `servicePage.${section.num}`,
      `${section.title}\n${section.proseHtml.replace(/<[^>]+>/g, " ")}`,
      failures,
    );
  }
  for (const [i, f] of contract.faqs.entries()) {
    scanCommercial(`servicePage.faq[${i}].q`, f.question, failures);
    scanCommercial(`servicePage.faq[${i}].a`, f.answer, failures);
  }

  beginLocalityVariationSessionV1(["neutral-verified-locality"]);
  try {
    const slots = [
      "problem",
      "benefits",
      "eligibility",
      "howItWorks",
      "preparationGuide",
      "trustSafety",
      "patientEducation",
      "mythVsFact",
    ] as const;

    for (const slot of slots) {
      const pool = (pack[slot] as SectionVariant[] | undefined) || [];
      for (const [idx, item] of pool.entries()) {
        const id = `${slot}[${idx}]`;
        inventory.push({ kind: "forced-section-variant", id });
        scanCommercial(`pool.${id}`, `${item.heading}\n${item.body}\n${(item.bullets || []).join("\n")}`, failures);
        const rendered = renderForced(pack, { [slot]: item }, `seed-${slot}-${idx}`);
        scanCommercial(`rendered.${id}`, rendered, failures);
      }
    }

    for (const [idx, item] of (pack.intro || []).entries()) {
      inventory.push({ kind: "forced-intro", id: `intro[${idx}]` });
      const rendered = renderForced(pack, { intro: item }, `seed-intro-${idx}`);
      scanCommercial(`rendered.intro[${idx}]`, rendered, failures);
    }

    for (const [idx, item] of (pack.cta || []).entries()) {
      inventory.push({ kind: "forced-cta", id: `cta[${idx}]` });
      scanCommercial(`cta[${idx}]`, `${item.primary} ${item.secondary} ${item.phonePrompt} ${item.bookingPrompt}`, failures);
    }

    const areaSeeds = [
      "darfield",
      "wombwell",
      "thurnscoe",
      "grimethorpe",
      "goldthorpe",
      "worsbrough",
      "hoyland",
      "cudworth",
      ...Array.from({ length: 16 }, (_, i) => `variant-seed-${i}`),
    ];
    for (const area of areaSeeds) {
      inventory.push({ kind: "faq-window", id: area });
      const faqs = pickServiceVariantFaqs(pack.faqs, SERVICE_ID, area, 8, areaSeeds.slice(0, 8));
      for (const [i, f] of faqs.entries()) {
        scanCommercial(`faqWindow.${area}[${i}].bankQ`, f.question, failures);
        scanCommercial(`faqWindow.${area}[${i}].bankA`, f.answer, failures);
      }
    }
  } finally {
    endLocalityVariationSessionV1();
  }

  const hash = crypto.createHash("sha256").update(fs.readFileSync(BANK_PATH)).digest("hex");
  const result = {
    ok: failures.length === 0,
    task: "FLU-APPROVED-BANK-COMMERCIAL-CONTENT-28B",
    bankPath: BANK_PATH,
    bankHash: hash,
    failureCount: failures.length,
    failures,
    inventoryCount: inventory.length,
    inventory,
  };
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
  console.log(
    JSON.stringify(
      {
        ok: result.ok,
        failureCount: result.failureCount,
        bankHash: hash,
        inventoryCount: inventory.length,
        sampleFailures: failures.slice(0, 25),
      },
      null,
      2,
    ),
  );
  if (!result.ok) process.exit(1);
}

main();
