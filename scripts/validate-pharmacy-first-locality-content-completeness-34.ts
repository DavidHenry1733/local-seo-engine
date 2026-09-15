#!/usr/bin/env npx tsx
/**
 * PHARMACY-FIRST-LOCALITY-CONTENT-COMPLETENESS-34
 * No-write fixtures: does not touch live tenant output, Flu, Travel, BP, or approved banks.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildContentGenerationContext } from "../src/pharmacy/contentEngine/buildContentGenerationContext.ts";
import { polishCommercialClusterPublicHtml } from "../src/pharmacy/contentEngine/pharmacyCommercialNarrativePolishV1.ts";
import {
  evaluateLocalityPatientCopyQualityGate,
  localityIntroductionsAreDistinct,
} from "../src/pharmacy/contentEngine/pharmacyLocalityPatientCopyQualityGateV1.ts";
import {
  beginLocalityVariationSessionV1,
  endLocalityVariationSessionV1,
} from "../src/pharmacy/contentEngine/pharmacyLocalityVariationSessionV1.ts";
import { scrubPublicLocalEngineHtml } from "../src/pharmacy/pharmacyLocalClusterCompositionDedupe.ts";
import { resolveLocalLocationHierarchy } from "../src/pharmacy/pharmacyLocalAreaResolver.ts";
import { buildApprovedBankLocalityPageContract } from "../src/pharmacy/pharmacyApprovedBankCorePageContract.ts";
import { renderLocalClusterLocationPageHtml } from "../src/pharmacy/pharmacyLocalClusterLocationPageRenderer.ts";
import { scrubUnconfirmedServiceClaims } from "../src/pharmacy/pharmacyServicePagePublicationQuality.ts";
import {
  loadServiceVariantPack,
  resolveApprovedServiceBank,
} from "../src/pharmacy/pharmacyServiceVariantLibrary.ts";
import { parseFirstJsonLdScript } from "../src/pharmacy/pharmacyVisualExperienceSchemaEnrichment.ts";

const ROOT = "/home/inboxingproweb/pharmaconnect-growth-engine";
const SLUG = "yorkshire-pharmacy-and-health-clinic";
const SERVICE_ID = "pharmacy-first";
const AREAS = [
  "Darfield",
  "Wombwell",
  "Thurnscoe",
  "Grimethorpe",
  "Goldthorpe",
  "Worsbrough",
  "Hoyland",
  "Cudworth",
] as const;

const SERVICE_PAGE = path.join(
  ROOT,
  "output/pharmacy-visual-experience",
  SLUG,
  SERVICE_ID,
  "index.html",
);
const BANK_PATH = path.join(
  ROOT,
  "data/pharmacy-approved-service-banks/banks/pharmacy-first/3e7ee7f5724e48b5e5d6b76ecb14d50008d0f55746d467b3e243713576e3795e.json",
);
const EXPECTED_BANK_HASH = "3e7ee7f5724e48b5e5d6b76ecb14d50008d0f55746d467b3e243713576e3795e";

interface Check {
  id: string;
  pass: boolean;
  detail: string;
}

const checks: Check[] = [];

function record(id: string, pass: boolean, detail: string): void {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${id} — ${detail}`);
}

function shaFile(file: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function strip(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countPhrase(text: string, phrase: string): number {
  const re = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
  return (text.match(re) || []).length;
}

function hasLocalityJsonLd(html: string, areaName: string): boolean {
  const doc = parseFirstJsonLdScript(html);
  if (!doc) return false;
  const raw = JSON.stringify(doc);
  return (
    /"@type":"Service"/.test(raw) &&
    /"@type":"WebPage"/.test(raw) &&
    new RegExp(areaName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(raw)
  );
}

function unsupportedClaims(html: string): string[] {
  const text = strip(html);
  const hits: string[] = [];
  const rules: Array<{ id: string; re: RegExp }> = [
    { id: "walk-ins-welcome", re: /\bwalk-?ins?\s+welcome\b/i },
    { id: "guaranteed", re: /\bguaranteed\b/i },
    { id: "appointments-available", re: /\bappointments available\b/i },
    { id: "free-nhs", re: /\bfree NHS\b/i },
    { id: "book-an-appointment", re: /\bbook an appointment\b/i },
    { id: "in-stock", re: /\bin stock\b/i },
    { id: "flu-leak", re: /\bflu vaccination/i },
    { id: "travel-leak", re: /\btravel vaccination/i },
    { id: "bp-leak", re: /\bblood[- ]pressure check/i },
  ];
  for (const rule of rules) {
    if (rule.re.test(text)) hits.push(rule.id);
  }
  return hits;
}

function applyGenerationScrubs(html: string, serviceName: string): string {
  return html
    .replace(/Welcome to\s+/gi, "")
    .replace(/\bProfessional Insight\b/gi, "Pharmacy guidance")
    .replace(/reduced unnecessary A&amp;E visits/gi, "timely pharmacy advice")
    .replace(/reduced unnecessary A&E visits/gi, "timely pharmacy advice")
    .replace(/\bservice experience\b/gi, "pharmacy support")
    .replace(/<span class="tag">pharmacy support<\/span>/gi, "")
    .replace(/>pharmacy support</gi, "><")
    .replace(/>Book or call about [^<]*</gi, ">Contact the pharmacy<")
    .replace(/>Book, call or get directions</gi, ">Contact the pharmacy<")
    .replace(
      /call ahead if you want parking or opening-hour guidance[^.]*\./gi,
      "Contact the pharmacy to ask how this service is arranged.",
    )
    .replace(
      /Ask about parking, opening hours and consultation availability[^.]*\./gi,
      `Contact the pharmacy to ask how ${serviceName.toLowerCase()} are arranged.`,
    )
    .replace(
      /call [^.]*before leaving [^.]*to confirm availability\./gi,
      `Contact the pharmacy to ask how ${serviceName.toLowerCase()} are arranged.`,
    )
    .replace(/Private checks may incur a fee — confirm at booking\./gi, "Private checks may be available for a fee — ask what applies locally.")
    .replace(/confirm at booking\./gi, "ask what applies locally.")
    .replace(/\bavailable in ([A-Z][A-Za-z' -]+)\b/gi, "for patients travelling from $1")
    .replace(/\bOther approved ([A-Za-z][\w' -]{1,60}) locality pages?\b/gi, "Guidance for patients travelling from $1")
    .replace(/\blocal guides under service hub for [^.]+/gi, "")
    .replace(/\blocal guidance for patients around [A-Za-z][\w' -]{0,40}\.?/gi, "")
    .replace(/\bunder service hub for [A-Za-z][\w' -]{0,40}/gi, "")
    .replace(/\bservice hub for [A-Za-z][\w' -]{0,40}/gi, "")
    .replace(/Call (\d[\d\s]+) to check availability\./gi, `Call $1 to ask how ${serviceName.toLowerCase()} are arranged.`)
    .replace(/\bprofile\.(?:source|areaType|confidence|tier):[a-z0-9._:-]+/gi, "")
    .replace(/\bprofile\.[a-z0-9._:-]+/gi, "")
    .replace(/<li>Call to ask how [^<]*<\/li>/gi, "")
    .replace(/Call to ask how [^.]+\./gi, "")
    .replace(
      /<strong>Opening hours:<\/strong>\s*Contact the pharmacy to confirm current opening hours\./gi,
      "<strong>Opening hours:</strong> Confirm when you get in touch.",
    )
    .replace(
      /<strong>Opening hours:<\/strong>\s*Hours can vary — confirm when you get in touch\./gi,
      "<strong>Opening hours:</strong> Confirm when you get in touch.",
    )
    .replace(/\s{2,}/g, " ")
    .replace(/\.\s*\./g, ".");
}

function main(): void {
  const servicePageHashBefore = shaFile(SERVICE_PAGE);
  const bankHashBefore = shaFile(BANK_PATH);
  const registry = resolveApprovedServiceBank(SERVICE_ID);
  record(
    "bank-hash-locked",
    bankHashBefore === EXPECTED_BANK_HASH && registry?.hash === EXPECTED_BANK_HASH,
    `disk=${bankHashBefore.slice(0, 12)} registry=${registry?.hash.slice(0, 12)}`,
  );

  const pack = loadServiceVariantPack(SERVICE_ID);
  if (!pack) throw new Error("Pharmacy First pack missing");
  const contract = buildApprovedBankLocalityPageContract(pack, "darfield", [
    "darfield",
    "wombwell",
    "thurnscoe",
    "grimethorpe",
    "goldthorpe",
    "worsbrough",
    "hoyland",
    "cudworth",
  ]);
  record(
    "locality-contract-complete",
    Boolean(
      contract.explanationBody &&
        contract.considerBody &&
        contract.scopeBody &&
        contract.processBody &&
        contract.processSteps.length >= 2 &&
        contract.preparationBody &&
        contract.safetyBody &&
        contract.faqs.length >= 4,
    ),
    `steps=${contract.processSteps.length} faqs=${contract.faqs.length}`,
  );

  const ctx = buildContentGenerationContext(SLUG, SERVICE_ID);
  const hierarchy = resolveLocalLocationHierarchy(SLUG, SERVICE_ID, ctx.rawProfile);
  record("hierarchy-ok", hierarchy.ok && hierarchy.clusters.length >= 8, `clusters=${hierarchy.clusters.length}`);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pf-locality-completeness-34-"));
  const slugs = AREAS.map((name) => name.toLowerCase());
  beginLocalityVariationSessionV1(slugs);

  const htmlBySlug = new Map<string, string>();

  try {
    for (const areaName of AREAS) {
      const cluster = hierarchy.clusters.find((c) => c.name.toLowerCase() === areaName.toLowerCase());
      if (!cluster) {
        record(`page-${areaName.toLowerCase()}`, false, "cluster missing from hierarchy");
        continue;
      }
      const siblings = hierarchy.clusters.filter((c) => c.slug !== cluster.slug).map((c) => c.name);
      let html = renderLocalClusterLocationPageHtml(ctx, hierarchy, cluster);
      html = polishCommercialClusterPublicHtml(scrubPublicLocalEngineHtml(html), {
        areaName: cluster.name,
        pharmacyName: ctx.profile.pharmacyName,
        serviceName: ctx.serviceName,
        nearbyAreaNames: siblings,
        generationRevision: "fixture-34",
      });
      html = applyGenerationScrubs(
        scrubUnconfirmedServiceClaims(html, {
          fundingModel: "unknown",
          walkInAvailable: null,
          appointmentRequired: null,
          abpmConfirmed: false,
          gphcConfirmed: Boolean(ctx.profile.gphcNumber?.trim()),
          serviceId: SERVICE_ID,
        }),
        ctx.serviceName,
      );
      fs.writeFileSync(path.join(tmp, `${cluster.slug}.html`), html, "utf8");
      htmlBySlug.set(cluster.slug, html);

      const text = strip(html);
      const main = strip(html.match(/<main[\s\S]*?<\/main>/i)?.[0] || html);
      const areaCount = countPhrase(main, cluster.name);
      const faqPrefix = new RegExp(`${cluster.name} patients\\s+—`, "i").test(html);
      const claims = unsupportedClaims(html);
      const gate = evaluateLocalityPatientCopyQualityGate({
        html,
        areaName: cluster.name,
        pharmacyName: ctx.profile.pharmacyName,
        distanceLabel: cluster.distanceLabel || "",
      });
      const sections = {
        explanation: /Pharmacy First is|community pharmacy pathway/i.test(text),
        consider: /consider|Why Patients Start|approachable conversations/i.test(text),
        scope: /may cover|pathway conditions|pharmacist confirms/i.test(text),
        next: /consultation|What happens|What Happens During|approved-bank-process/i.test(html + text),
        prep: /medicines list|What To Bring|Preparing|How to prepare|approved-bank-preparation/i.test(html + text),
        safety: /NHS 111|urgent medical|emergency symptoms/i.test(text),
        faqs: (html.match(/class="faq-q"/g) || []).length >= 4,
        locality: new RegExp(cluster.name, "i").test(html),
        pharmacy: html.includes(ctx.profile.pharmacyName),
        address: /Snape Hill|S73/i.test(html),
        phone: /\b0\d{3,4}\s?\d{3}\s?\d{3,4}\b/.test(html) || /Phone:/i.test(html),
        distance: /\b\d+(?:\.\d+)?\s*km\b|approximately|from /i.test(text),
        cta: /Contact the pharmacy|Get directions/i.test(html),
        map: /maps\.google|google\.com\/maps|map-placeholder|pharmacy-local-map/i.test(html),
        links: /data-template-block="parent-child-links"|pharmacy-first/i.test(html),
        jsonld: hasLocalityJsonLd(html, cluster.name),
      };
      const sectionFail = Object.entries(sections)
        .filter(([, ok]) => !ok)
        .map(([k]) => k);
      record(
        `completeness-${cluster.slug}`,
        sectionFail.length === 0 &&
          Boolean(html.includes('data-locality-evidence="approved-bank-process"')) &&
          Boolean(html.includes('data-locality-evidence="approved-bank-preparation"')),
        sectionFail.length
          ? `missing ${sectionFail.join(",")}`
          : `sections present; process=${html.includes('data-locality-evidence="approved-bank-process"')} prep=${html.includes('data-locality-evidence="approved-bank-preparation"')}`,
      );
      record(
        `local-context-${cluster.slug}`,
        sections.locality &&
          sections.pharmacy &&
          sections.address &&
          sections.phone &&
          sections.distance &&
          sections.cta &&
          sections.map &&
          sections.links &&
          areaCount <= 16,
        `nameHits=${areaCount} address=${sections.address} map=${sections.map} phone=${sections.phone}`,
      );
      record(
        `jsonld-claims-${cluster.slug}`,
        sections.jsonld && claims.length === 0 && !faqPrefix && gate.ok,
        !gate.ok
          ? `copy-gate ${gate.failures.join("; ")}`
          : claims.length || faqPrefix
            ? `claims=${claims.join(",") || "faq-prefix"}`
            : "json-ld valid, no unsupported claims",
      );
    }

    const rendered = AREAS.map((name) => hierarchy.clusters.find((c) => c.name.toLowerCase() === name.toLowerCase()))
      .filter((c): c is NonNullable<typeof c> => Boolean(c));
    let distinct = true;
    for (let i = 0; i < rendered.length; i++) {
      for (let j = i + 1; j < rendered.length; j++) {
        const a = rendered[i]!;
        const b = rendered[j]!;
        if (
          !localityIntroductionsAreDistinct(
            htmlBySlug.get(a.slug) || "",
            htmlBySlug.get(b.slug) || "",
            a.name,
            b.name,
          )
        ) {
          distinct = false;
          record(`distinct-${a.slug}-${b.slug}`, false, "duplicate intro or access");
        }
      }
    }
    if (distinct && rendered.length === 8) {
      record("natural-non-repetitive-copy", true, "hero/access unique across eight localities");
    }
  } finally {
    endLocalityVariationSessionV1();
  }

  const servicePageHashAfter = shaFile(SERVICE_PAGE);
  const bankHashAfter = shaFile(BANK_PATH);
  record(
    "service-page-byte-integrity",
    servicePageHashBefore === servicePageHashAfter,
    servicePageHashBefore === servicePageHashAfter ? "unchanged" : "CHANGED",
  );
  record("bank-unedited", bankHashBefore === bankHashAfter && bankHashAfter === EXPECTED_BANK_HASH, "approved bank hash unchanged");

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${tmp}`);
  console.log(`${checks.filter((c) => c.pass).length}/${checks.length} passed`);
  if (failed.length) {
    process.exitCode = 1;
  }
}

main();
