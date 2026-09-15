#!/usr/bin/env npx tsx
/**
 * FOUR-SERVICE-APPROVED-BANK-CONSOLIDATION-27 — validate EVERY variant in each bank.
 * Neutral fixture only. No production tenant writes.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  loadServiceVariantPack,
  loadApprovedServiceBankRegistry,
  resolveApprovedServiceBank,
  type ServiceVariantPack,
  type SectionVariant,
} from "../src/pharmacy/pharmacyServiceVariantLibrary.ts";
import { composeCommercialClusterNarrativeV1 } from "../src/pharmacy/pharmacyLocalClusterContentEngine.ts";
import { scrubUnconfirmedServiceClaims } from "../src/pharmacy/pharmacyServicePagePublicationQuality.ts";
import type { ContentGenerationContext } from "../src/pharmacy/contentEngine/contentGenerationContextTypes.ts";
import {
  beginLocalityVariationSessionV1,
  endLocalityVariationSessionV1,
} from "../src/pharmacy/contentEngine/pharmacyLocalityVariationSessionV1.ts";

const OUT = "/tmp/consolidate27-all-variant-validation";
const SERVICES = [
  "pharmacy-first",
  "travel-vaccinations",
  "blood-pressure-checks",
  "flu-vaccinations",
] as const;

const FORBIDDEN: Array<{ id: string; re: RegExp; except?: string[] }> = [
  { id: "fasting", re: /\bfasting\b/i },
  { id: "softening-drops", re: /softening drops/i },
  { id: "free", re: /\bfree\b/i },
  { id: "walk-in", re: /\bwalk-?ins?\b/i },
  { id: "appointment", re: /\bappointments?\b/i },
  { id: "booking-ahead", re: /booking ahead/i },
  { id: "book-online", re: /book online|book appointment|start booking/i },
  { id: "price", re: /£\d/ },
  { id: "stock", re: /\bstock\b/i },
  { id: "tenant", re: /leeds pharmacy|yorkshire pharmacy|barnsley/i },
  { id: "nhs-commission", re: /\bNHS\b(?!\s*111)/i },
  { id: "blood-pressure-leak", re: /blood pressure/i, except: ["blood-pressure-checks"] },
  { id: "pharmacy-first-leak", re: /pharmacy first/i, except: ["pharmacy-first"] },
  { id: "flu-leak", re: /\bflu (jab|vaccin)/i, except: ["flu-vaccinations"] },
  { id: "travel-leak", re: /travel vaccin/i, except: ["travel-vaccinations"] },
];

type Check = { id: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass, detail });
  if (!pass) console.log(`FAIL  ${id} — ${detail}`);
}

function mockCtx(serviceId: string, serviceName: string): ContentGenerationContext {
  return {
    contractVersion: "content-engine-v1",
    resolvedSlug: "neutral-fixture-pharmacy",
    serviceId,
    serviceName,
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
      selectedServices: [...SERVICES],
      selectedAreas: [{ areaName: "Neutral Verified Locality", selected: true, order: 1 }],
      serviceDeliveryProfiles: {
        [serviceId]: { fundingModel: "unknown", walkInAvailable: null, appointmentRequired: null },
      },
    } as ContentGenerationContext["rawProfile"],
    selectedAreas: [
      { areaName: "Neutral Verified Locality", areaSlug: "neutral-verified-locality", selected: true, order: 1 },
    ],
    cta: { phone: "01234 567890", website: "https://example-neutral-pharmacy.test" },
    links: { ecosystemRoot: path.join(OUT, "no-write") },
  } as ContentGenerationContext;
}

function scanText(serviceId: string, text: string): string[] {
  const hits: string[] = [];
  for (const rule of FORBIDDEN) {
    if (rule.except?.includes(serviceId)) continue;
    if (rule.re.test(text)) hits.push(rule.id);
  }
  return hits;
}

function renderVariant(
  serviceId: string,
  serviceName: string,
  pack: ServiceVariantPack,
  override: Partial<Record<string, SectionVariant>>,
  areaSlug: string,
): string {
  // Temporarily clone pack with single-item pools so every variant is exercised.
  const forced = JSON.parse(JSON.stringify(pack)) as ServiceVariantPack;
  for (const [slot, item] of Object.entries(override)) {
    (forced as any)[slot] = [item];
  }
  const ctx = mockCtx(serviceId, serviceName);
  (ctx as any).variantPack = forced;
  const content = composeCommercialClusterNarrativeV1(
    {
      slug: "neutral-fixture-pharmacy",
      serviceId,
      serviceName,
      areaName: "Neutral Verified Locality",
      areaSlug,
      nearbyAreaNames: [],
      areaSlugsInCluster: [areaSlug],
    },
    ctx,
  );
  const html = `<main data-page-contract="local-cluster-v1" data-area-contract="local-area-v1">
<h1>${serviceName}</h1>
<p>${content.heroIntro || ""}</p>
${content.whyChecksHeading ? `<h2>${content.whyChecksHeading}</h2><p>${content.whyChecksBody}</p>` : ""}
${content.processHeading ? `<h2>${content.processHeading}</h2><p>${content.processIntro}</p>` : ""}
${content.localRelevanceHeading ? `<h2>${content.localRelevanceHeading}</h2><p>${content.localRelevanceBody}</p>` : ""}
${content.clinicalEnvironmentHeading ? `<h2>${content.clinicalEnvironmentHeading}</h2><p>${content.clinicalEnvironmentBody}</p>` : ""}
${content.trustHeading ? `<h2>${content.trustHeading}</h2><p>${content.trustBody}</p>` : ""}
${(content.faqs || []).map((f) => `<h3>${f.question}</h3><p>${f.answer}</p>`).join("\n")}
</main>`;
  return scrubUnconfirmedServiceClaims(html, {
    fundingModel: "unknown",
    walkInAvailable: null,
    appointmentRequired: null,
    abpmConfirmed: false,
    gphcConfirmed: false,
    serviceId,
  });
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const registry = loadApprovedServiceBankRegistry();
  record("registry-v2", registry?.registryId === "pharmacy-approved-service-banks-v2", String(registry?.registryId));

  // PF separate-path removal proof
  const routerSrc = fs.readFileSync("src/pharmacy/pharmacyLocalClusterContentEngine.ts", "utf8");
  record(
    "pf-no-separate-generator",
    !/buildPharmacyFirstLocalNarrative\(/.test(routerSrc) &&
      /composeServiceVariantPackClusterDraft\(input, ctx\)/.test(routerSrc),
    "composeCommercialClusterNarrativeV1 uses shared draft only",
  );

  const summary: Record<string, unknown> = {};
  beginLocalityVariationSessionV1(["neutral-verified-locality"]);

  for (const serviceId of SERVICES) {
    const approved = resolveApprovedServiceBank(serviceId)!;
    const pack = loadServiceVariantPack(serviceId)!;
    record(`${serviceId}:registry-hash`, approved.hash === approved.entry.approvedBankHash, approved.hash.slice(0, 16));

    const bankHits = scanText(serviceId, JSON.stringify(pack));
    record(`${serviceId}:bank-scan`, bankHits.length === 0, bankHits.join(",") || "clean");

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

    let rendered = 0;
    let failed = 0;
    const failSamples: string[] = [];

    for (const slot of slots) {
      const pool = ((pack as any)[slot] || []) as SectionVariant[];
      for (let i = 0; i < pool.length; i++) {
        const html = renderVariant(serviceId, pack.serviceName, pack, { [slot]: pool[i] }, `neutral-v-${slot}-${i}`);
        const hits = scanText(serviceId, html);
        rendered++;
        if (hits.length) {
          failed++;
          failSamples.push(`${slot}[${i}]:${hits.join("+")}`);
        }
        // natural heading
        if (pool[i]?.heading && /undefined|null|\[object/i.test(pool[i].heading)) {
          failed++;
          failSamples.push(`${slot}[${i}]:bad-heading`);
        }
      }
    }
    // Also render each FAQ standalone via pack (included in compose)
    for (let i = 0; i < (pack.faqs || []).length; i++) {
      const html = renderVariant(serviceId, pack.serviceName, pack, {}, `neutral-faq-${i}`);
      const hits = scanText(serviceId, html);
      rendered++;
      if (hits.length) {
        failed++;
        failSamples.push(`faq-render[${i}]:${hits.join("+")}`);
      }
    }

    record(`${serviceId}:all-variants`, failed === 0, `rendered=${rendered} failed=${failed} ${failSamples.slice(0, 5).join("; ")}`);
    summary[serviceId] = {
      hash: approved.hash,
      version: pack.version,
      rendered,
      failed,
      failSamples: failSamples.slice(0, 20),
      bankHits,
    };
  }

  endLocalityVariationSessionV1();

  const out = { ok: checks.every((c) => c.pass), checks, summary };
  fs.writeFileSync(path.join(OUT, "result.json"), JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ ok: out.ok, failed: checks.filter((c) => !c.pass).map((c) => c.id), summary }, null, 2));
  process.exit(out.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
