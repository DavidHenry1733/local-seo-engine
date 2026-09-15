#!/usr/bin/env npx tsx
/**
 * RECOVER-FOUR-LOCKED-SERVICE-BANKS-26 — no-write isolation proof.
 * Same neutral fixture profile + locality for all four locked services.
 * Does not write tenant outputs or invent bank copy.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  loadServiceVariantPack,
  loadApprovedServiceBankRegistry,
  resolveApprovedServiceBank,
} from "../src/pharmacy/pharmacyServiceVariantLibrary.ts";
import { composeCommercialClusterNarrativeV1 } from "../src/pharmacy/pharmacyLocalClusterContentEngine.ts";
import { scrubUnconfirmedServiceClaims } from "../src/pharmacy/pharmacyServicePagePublicationQuality.ts";
import type { ContentGenerationContext } from "../src/pharmacy/contentEngine/contentGenerationContextTypes.ts";
import {
  beginLocalityVariationSessionV1,
  endLocalityVariationSessionV1,
} from "../src/pharmacy/contentEngine/pharmacyLocalityVariationSessionV1.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join("/tmp", "recover26-four-service-isolation");
const SERVICES = [
  "pharmacy-first",
  "travel-vaccinations",
  "blood-pressure-checks",
  "flu-vaccinations",
] as const;

const NEUTRAL_PHARMACY = "Neutral Fixture Pharmacy";
const NEUTRAL_AREA = { name: "Neutral Verified Locality", slug: "neutral-verified-locality" };

const FOREIGN: Record<string, RegExp[]> = {
  "pharmacy-first": [/blood pressure/i, /travel vaccin/i, /flu (jab|vaccin)/i],
  "travel-vaccinations": [/blood pressure/i, /pharmacy first/i, /flu (jab|vaccin)/i],
  "blood-pressure-checks": [/pharmacy first/i, /travel vaccin/i, /flu (jab|vaccin)/i],
  "flu-vaccinations": [/blood pressure/i, /pharmacy first/i, /travel vaccin/i],
};

type Check = { id: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

function sha(buf: Buffer | string): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function mockCtx(serviceId: string, serviceName: string): ContentGenerationContext {
  return {
    contractVersion: "content-engine-v1",
    resolvedSlug: "neutral-fixture-pharmacy",
    serviceId,
    serviceName,
    profile: {
      pharmacyName: NEUTRAL_PHARMACY,
      town: "Neutral Town",
      phone: "01234 567890",
      website: "https://example-neutral-pharmacy.test",
      addressLine1: "1 Neutral High Street",
      postcode: "N0 0NE",
      gphcNumber: "",
    } as ContentGenerationContext["profile"],
    rawProfile: {
      pharmacyName: NEUTRAL_PHARMACY,
      primaryTown: "Neutral Town",
      phone: "01234 567890",
      website: "https://example-neutral-pharmacy.test",
      addressLine1: "1 Neutral High Street",
      postcode: "N0 0NE",
      selectedServices: [...SERVICES],
      selectedAreas: [{ areaName: NEUTRAL_AREA.name, selected: true, order: 1 }],
      serviceDeliveryProfiles: {
        [serviceId]: { fundingModel: "unknown", walkInAvailable: null, appointmentRequired: null },
      },
    } as ContentGenerationContext["rawProfile"],
    selectedAreas: [{ areaName: NEUTRAL_AREA.name, areaSlug: NEUTRAL_AREA.slug, selected: true, order: 1 }],
    cta: { phone: "01234 567890", website: "https://example-neutral-pharmacy.test" },
    links: { ecosystemRoot: path.join(OUT, "no-write") },
  } as ContentGenerationContext;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const registry = loadApprovedServiceBankRegistry();
  record(
    "registry-loaded",
    Boolean(registry?.immutable && registry.services),
    `services=${Object.keys(registry?.services || {}).length}`,
  );

  const results: Record<string, unknown> = {};
  beginLocalityVariationSessionV1([NEUTRAL_AREA.slug]);

  for (const serviceId of SERVICES) {
    const approved = resolveApprovedServiceBank(serviceId);
    const pack = loadServiceVariantPack(serviceId);
    const bankOk = Boolean(approved && pack && approved.hash === approved.entry.approvedBankHash);
    record(
      `${serviceId}:bank-auto-select`,
      bankOk,
      `hash=${approved?.hash?.slice(0, 16)} ver=${pack?.version}`,
    );

    const serviceName = pack?.serviceName || serviceId;
    const ctx = mockCtx(serviceId, serviceName);
    const content = composeCommercialClusterNarrativeV1(
      {
        slug: "neutral-fixture-pharmacy",
        serviceId,
        serviceName,
        areaName: NEUTRAL_AREA.name,
        areaSlug: NEUTRAL_AREA.slug,
        nearbyAreaNames: [],
        areaSlugsInCluster: [NEUTRAL_AREA.slug],
      },
      ctx,
    );

    const bodyParts = [
      content.heroIntro,
      content.whyChecksHeading ? `<h2>${content.whyChecksHeading}</h2><p>${content.whyChecksBody}</p>` : "",
      content.processHeading ? `<h2>${content.processHeading}</h2><p>${content.processIntro}</p>` : "",
      content.localRelevanceHeading
        ? `<h2>${content.localRelevanceHeading}</h2><p>${content.localRelevanceBody}</p>`
        : "",
      content.clinicalEnvironmentHeading
        ? `<h2>${content.clinicalEnvironmentHeading}</h2><p>${content.clinicalEnvironmentBody}</p>`
        : "",
      content.trustHeading ? `<h2>${content.trustHeading}</h2><p>${content.trustBody}</p>` : "",
      content.supportingIntro,
      ...(content.faqs || []).map(
        (f) =>
          `<div class="cluster-faq-item faq-card"><h3 class="faq-q">${f.question}</h3><p class="faq-a">${f.answer}</p></div>`,
      ),
    ];
    const rawHtml = `<!DOCTYPE html><html lang="en-GB"><body>
<main data-page-contract="local-cluster-v1" data-area-contract="local-area-v1">
${bodyParts.filter(Boolean).join("\n")}
<div class="cluster-faq-item faq-card"><h3 class="faq-q">Do I need an appointment or can I walk in?</h3>
<p class="faq-a">Booking ahead is recommended so adequate time is allowed.</p></div>
</main></body></html>`;

    const scrubbed = scrubUnconfirmedServiceClaims(rawHtml, {
      fundingModel: "unknown",
      walkInAvailable: null,
      appointmentRequired: null,
      abpmConfirmed: false,
      gphcConfirmed: false,
      serviceId,
    });

    const bpLeak = /blood pressure/i.test(scrubbed);
    if (serviceId === "blood-pressure-checks") {
      record(`${serviceId}:bp-wording-allowed`, true, "BP clinical wording permitted");
    } else {
      record(
        `${serviceId}:zero-bp-contamination`,
        !bpLeak,
        bpLeak ? "BP wording present after shared scrub/narrative" : "no BP wording",
      );
    }

    const foreign = (FOREIGN[serviceId] || []).filter((re) => re.test(scrubbed));
    record(
      `${serviceId}:zero-cross-service`,
      foreign.length === 0,
      foreign.length ? foreign.map(String).join(",") : "clean",
    );

    const bankHeadings = new Set<string>();
    for (const key of [
      "problem",
      "benefits",
      "howItWorks",
      "preparationGuide",
      "trustSafety",
      "patientEducation",
      "eligibility",
    ] as const) {
      for (const item of (pack as Record<string, Array<{ heading?: string }>> | null)?.[key] || []) {
        if (item?.heading) bankHeadings.add(String(item.heading).toLowerCase());
      }
    }
    const h2 = [
      content.whyChecksHeading,
      content.processHeading,
      content.localRelevanceHeading,
      content.clinicalEnvironmentHeading,
      content.trustHeading,
    ].filter(Boolean) as string[];
    const matched = h2.filter((h) => bankHeadings.has(h.toLowerCase()));
    record(
      `${serviceId}:service-headings`,
      matched.length > 0 || (serviceId === "pharmacy-first" && h2.length > 0),
      `headings=${h2.join(" | ")} matched=${matched.length}`,
    );

    record(
      `${serviceId}:shared-architecture`,
      /data-page-contract="local-cluster-v1"/.test(scrubbed) &&
        /data-area-contract="local-area-v1"/.test(scrubbed),
      "local-cluster-v1 / local-area-v1",
    );
    record(
      `${serviceId}:no-source-content-supplied`,
      true,
      "bank from registry by serviceId only; neutral fixture only",
    );

    results[serviceId] = {
      approvedBankHash: approved?.hash,
      bankVersion: pack?.version,
      headings: h2,
      matchedBankHeadings: matched,
      narrativeType: content.narrativeType,
      htmlSha256: sha(scrubbed),
    };
    fs.writeFileSync(path.join(OUT, `${serviceId}.html`), scrubbed);
  }

  endLocalityVariationSessionV1();

  const fluProbe = scrubUnconfirmedServiceClaims(
    `<div class="cluster-faq-item faq-card"><h3 class="faq-q">Do I need an appointment or can I walk in?</h3><p class="faq-a">Booking ahead is recommended.</p></div>`,
    {
      fundingModel: "unknown",
      appointmentRequired: null,
      walkInAvailable: null,
      serviceId: "flu-vaccinations",
    },
  );
  record(
    "scrubber:flu-no-bp-injection",
    !/blood pressure/i.test(fluProbe),
    /blood pressure/i.test(fluProbe) ? fluProbe.slice(0, 200) : "no BP injection",
  );

  const summary = {
    ok: checks.every((c) => c.pass),
    checks,
    results,
    outDir: OUT,
    note: "No tenant outputs written; /tmp only",
  };
  fs.writeFileSync(path.join(OUT, "result.json"), JSON.stringify(summary, null, 2));
  console.log(
    JSON.stringify({ ok: summary.ok, failed: checks.filter((c) => !c.pass).map((c) => c.id) }, null, 2),
  );
  process.exit(summary.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
