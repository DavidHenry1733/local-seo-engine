#!/usr/bin/env npx tsx
/**
 * FLU-APPROVED-BANK-COPY-QUALITY-28A — validate EVERY Flu bank variant.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
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
const OUT = "/tmp/flu28a-variant-validation.json";
const SERVICE_ID = "flu-vaccinations";
const SERVICE_NAME = "Flu Vaccinations";

const DUP_WORD = /\b([A-Za-z][A-Za-z\-]*)\s+\1\b/i;
const BAD_AN = /\ban\s+(consultation|pharmacy|flu|structured|confidential|visit)\b/i;
const BAD_A = /\ba\s+(assessment|individual)\b/i;
const FORBIDDEN_OPS =
  /\b(appointment|walk-?in|commission(?:ing|ed)?|nhs-funded|nhs\s+flu|book\s+online|free\s+on\s+the\s+nhs|\bin stock\b)\b/i;
const CROSS_SERVICE =
  /\b(blood\s*pressure|pharmacy\s+first|travel\s+vaccin|earwax|contraception)\b/i;

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
    links: { ecosystemRoot: path.join("/tmp", "flu28a-no-write") },
    variantPack: pack,
  } as ContentGenerationContext;
}

function scanText(label: string, text: string, failures: string[]) {
  const cleaned = text.replace(/\bNHS\s*111\b/gi, "URGENT_CARE_REF");
  // Consecutive duplicates only within a single line / sentence fragment — not across joined fields.
  for (const line of cleaned.split(/\n+/)) {
    const t = line.trim();
    if (!t) continue;
    if (DUP_WORD.test(t)) failures.push(`${label}: consecutive duplicate words (${t.match(DUP_WORD)?.[0]})`);
  }
  if (BAD_AN.test(cleaned)) failures.push(`${label}: incorrect article an (${cleaned.match(BAD_AN)?.[0]})`);
  if (BAD_A.test(cleaned)) failures.push(`${label}: incorrect article a (${cleaned.match(BAD_A)?.[0]})`);
  if (FORBIDDEN_OPS.test(cleaned)) {
    failures.push(`${label}: unsupported operational claim (${cleaned.match(FORBIDDEN_OPS)?.[0]})`);
  }
  if (CROSS_SERVICE.test(cleaned)) {
    failures.push(`${label}: cross-service wording (${cleaned.match(CROSS_SERVICE)?.[0]})`);
  }
  if (/\bsuitability,\s*suitability\b/i.test(cleaned)) {
    failures.push(`${label}: duplicated phrase suitability, suitability`);
  }
  if (/\bflu vaccinations involves\b/i.test(cleaned)) {
    failures.push(`${label}: singular/plural mismatch (involves)`);
  }
  if (/\bvaccinations\b[^.?!]*\boffers\b/i.test(cleaned)) {
    failures.push(`${label}: singular/plural verb mismatch (vaccinations offers)`);
  }
  if (/\bBefore You contact the pharmacy about\b/.test(cleaned)) {
    failures.push(`${label}: incomplete heading fragment`);
  }
  if (/\barranging a visit Flu\b/i.test(cleaned) || /\bvisit Flu Vaccinations\b/i.test(cleaned)) {
    failures.push(`${label}: malformed visit/service phrasing`);
  }
}

function scanFaqQuestion(label: string, q: string, failures: string[]) {
  scanText(label, q, failures);
  const t = q.trim();
  if (!t.endsWith("?")) failures.push(`${label}: incomplete FAQ question (missing ?)`);
  if (/^Any questions\b/i.test(t) || t.length < 12) {
    failures.push(`${label}: incomplete FAQ question fragment`);
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
    ...(content.faqs || []).flatMap((f) => [f.question, f.answer]),
  ]
    .filter(Boolean)
    .join("\n");
}

function main() {
  if (!BANK_PATH || !fs.existsSync(BANK_PATH)) {
    console.error("Usage: flu28a-validate-all-variants.mts <bank.json>");
    process.exit(1);
  }
  const pack = JSON.parse(fs.readFileSync(BANK_PATH, "utf8")) as ServiceVariantPack;
  const failures: string[] = [];
  const inventory: Array<{ kind: string; id: string }> = [];

  // Raw bank scan
  const raw = JSON.stringify(pack);
  scanText("bank.raw", raw, failures);
  for (const [i, f] of (pack.faqs || []).entries()) {
    scanFaqQuestion(`bank.faq[${i}].q`, f.question, failures);
    scanText(`bank.faq[${i}].a`, f.answer, failures);
  }

  // Service-page contract
  const contract = buildApprovedBankServicePageContract(pack);
  inventory.push({ kind: "service-page-contract", id: SERVICE_PAGE_BANK_SEED });
  for (const section of contract.sections) {
    scanText(`servicePage.${section.num}`, `${section.title}\n${section.proseHtml.replace(/<[^>]+>/g, " ")}`, failures);
  }
  for (const [i, f] of contract.faqs.entries()) {
    scanFaqQuestion(`servicePage.faq[${i}].q`, f.question, failures);
    scanText(`servicePage.faq[${i}].a`, f.answer, failures);
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
        scanText(`pool.${id}`, `${item.heading}\n${item.body}\n${(item.bullets || []).join("\n")}`, failures);
        const rendered = renderForced(pack, { [slot]: item }, `seed-${slot}-${idx}`);
        scanText(`rendered.${id}`, rendered, failures);
      }
    }

    for (const [idx, item] of (pack.intro || []).entries()) {
      inventory.push({ kind: "forced-intro", id: `intro[${idx}]` });
      const rendered = renderForced(pack, { intro: item }, `seed-intro-${idx}`);
      scanText(`rendered.intro[${idx}]`, rendered, failures);
    }

    for (const [idx, item] of (pack.cta || []).entries()) {
      inventory.push({ kind: "forced-cta", id: `cta[${idx}]` });
      scanText(`cta[${idx}]`, `${item.primary} ${item.secondary} ${item.phonePrompt} ${item.bookingPrompt}`, failures);
    }

    // FAQ windows across area seeds
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
        scanFaqQuestion(`faqWindow.${area}[${i}].q`, f.question, failures);
        scanText(`faqWindow.${area}[${i}].a`, f.answer, failures);
      }
    }
  } finally {
    endLocalityVariationSessionV1();
  }

  const hash = crypto.createHash("sha256").update(fs.readFileSync(BANK_PATH)).digest("hex");
  const result = {
    ok: failures.length === 0,
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
        sampleFailures: failures.slice(0, 20),
      },
      null,
      2,
    ),
  );
  if (!result.ok) process.exit(1);
}

main();
