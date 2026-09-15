#!/usr/bin/env npx tsx
/**
 * UK local service-page campaign: style assignment, isolated briefs,
 * confirmation UI, snapshot preservation. No live OpenAI.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";

import {
  UK_LOCAL_INTRODUCTION_LISTING_LANGUAGE,
  UK_LOCAL_INTRODUCTION_STRUCTURES,
  assignUkLocalIntroductionStructures,
  countUkLocalIntroductionWords,
} from "../src/pharmacy/contentEngine/pharmacyUkLocalIntroductionStyleContractV1.ts";
import { parseUkLocalIntroductionProse } from "../src/pharmacy/contentEngine/pharmacyUkLocalIntroductionProseWriterV1.ts";
import { renderAiLocalPagePilotHtmlInMemoryV3 } from "../src/pharmacy/pharmacyAiLocalPagePilotAssemblerV3.ts";
import { assembleUkLocalEvidenceBrief } from "../src/pharmacy/contentEngine/pharmacyUkLocalEvidenceBriefV1.ts";
import { classifyContentField, FIELD_OWNERSHIP } from "../src/pharmacy/contentEngine/pharmacyContentGenerationFieldPolicyV1.ts";
import { evaluateAiLocalCopyQualityV3 } from "../src/pharmacy/contentEngine/pharmacyAiLocalCopyQualityV1.ts";
import {
  buildAiLocalNarrativeWritingBriefV3,
  appendRendererOwnedLocalHandoverClinicalSentence,
  RENDERER_OWNED_LOCAL_HANDOVER_CLINICAL_SENTENCE,
} from "../src/pharmacy/contentEngine/pharmacyAiLocalNarrativePromptContractV1.ts";
import {
  CREATE_TEN_LOCAL_SERVICE_PAGES_LABEL,
  planUkLocalServicePagesCampaign,
  snapshotLiveLocalServicePages,
  clearUkLocalServicePagesCampaignRuntimeForTests,
  confirmUkLocalServicePagesCampaign,
} from "../src/pharmacy/growthEngineLocalPageUkServicePagesCampaignRunService.ts";
import { renderCampaignBuilderPage } from "../src/pharmacy/growthEngineCampaignBuilderPage.ts";
import { BROOK_DERBY_DEMO_SLUG } from "../src/pharmacy/contentEngine/pharmacyAiLocalPageCandidatePaths.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";

const SERVICE = "pharmacy-first";
const AREAS = [
  "allestree",
  "mickleover",
  "littleover",
  "chellaston",
  "duffield",
  "alvaston",
  "mackworth",
  "chaddesden",
  "spondon",
  "borrowash",
];

let passed = 0;
let failed = 0;

function record(name: string, ok: boolean, detail = ""): void {
  if (ok) {
    passed += 1;
    console.log(`PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function sampleCopy(overrides: Record<string, unknown> = {}) {
  return {
    area: "Mickleover",
    heroHeading: "Pharmacy First in Mickleover",
    heroIntroduction: "Pharmacy First can help people in Mickleover with eligible common conditions.",
    localIntroduction: "",
    localContextHeading: "",
    localContextParagraphs: ["Mickleover Neighbourhood Board leads on behalf of the neighbourhood."],
    relationshipToPharmacy: "Consultations take place at Brook Pharmacy Demo Derby in Derby.",
    localAccessIntroduction: "",
    localFaqs: [],
    localCtaBridge: "",
    evidenceClaims: [],
    evidenceEntityIdsUsed: [],
    ...overrides,
  };
}

function sampleInput() {
  return {
    vertical: "pharmacy",
    business: {
      name: "Brook Pharmacy Demo Derby",
      address: "12 Duffield Road, Derby, DE1 3BB, United Kingdom",
      telephone: "01332 000000",
      website: "",
      marketTown: "Derby",
      coordinates: { latitude: 52.91, longitude: -1.48 },
    },
    offer: { serviceName: "Pharmacy First", serviceId: SERVICE, allowedCta: "Book" },
    locality: {
      areaName: "Mickleover",
      areaSlug: "mickleover",
      distanceKm: 5.1,
      distanceLabel: "approximately 5.1 km straight-line",
      pharmacyIsInArea: false,
      neighbouringSelectedAreas: ["Allestree", "Littleover"],
      acceptedEntities: [],
    },
  };
}

async function main() {
  console.log("\n=== UK local service pages campaign v1 ===\n");

  record(
    "ten-structures-defined",
    UK_LOCAL_INTRODUCTION_STRUCTURES.length === 10 && new Set(UK_LOCAL_INTRODUCTION_STRUCTURES.map((row) => row.id)).size === 10,
    String(UK_LOCAL_INTRODUCTION_STRUCTURES.length),
  );

  const first = assignUkLocalIntroductionStructures({ slug: BROOK_DERBY_DEMO_SLUG, serviceId: SERVICE, areaSlugs: AREAS });
  const second = assignUkLocalIntroductionStructures({ slug: BROOK_DERBY_DEMO_SLUG, serviceId: SERVICE, areaSlugs: AREAS });
  const ids = AREAS.map((area) => first.get(area)?.id);
  record(
    "assignment-unique-and-stable",
    ids.every(Boolean) && new Set(ids).size === 10 && AREAS.every((area) => first.get(area)?.id === second.get(area)?.id),
    ids.join(","),
  );
  const shuffled = assignUkLocalIntroductionStructures({
    slug: BROOK_DERBY_DEMO_SLUG,
    serviceId: SERVICE,
    areaSlugs: [...AREAS].reverse(),
  });
  record(
    "assignment-stable-across-input-order",
    AREAS.every((area) => shuffled.get(area)?.id === first.get(area)?.id),
    "reload order must not change the assigned structure",
  );
  const otherTenant = assignUkLocalIntroductionStructures({
    slug: "yorkshire-pharmacy-health-clinic",
    serviceId: SERVICE,
    areaSlugs: AREAS,
  });
  record(
    "assignment-not-area-hardcoded",
    otherTenant.get("mickleover")?.id !== first.get("mickleover")?.id ||
      otherTenant.get("allestree")?.id !== first.get("allestree")?.id,
    "structure ids are campaign-seeded, not area-name branches",
  );

  const mickleoverBrief = assembleUkLocalEvidenceBrief({
    slug: BROOK_DERBY_DEMO_SLUG,
    serviceId: SERVICE,
    areaName: "Mickleover",
    areaSlug: "mickleover",
    introductionStructureId: first.get("mickleover")?.id || null,
  });
  const allestreeBrief = assembleUkLocalEvidenceBrief({
    slug: BROOK_DERBY_DEMO_SLUG,
    serviceId: SERVICE,
    areaName: "Allestree",
    areaSlug: "allestree",
    introductionStructureId: first.get("allestree")?.id || null,
  });
  const mickleoverHay = JSON.stringify(mickleoverBrief);
  const allestreeHay = JSON.stringify(allestreeBrief);
  record(
    "briefs-are-area-isolated",
    mickleoverBrief.areaSlug === "mickleover" &&
      allestreeBrief.areaSlug === "allestree" &&
      !/allestree/i.test(mickleoverHay) &&
      !/mickleover/i.test(allestreeHay) &&
      mickleoverBrief.healthcare.length > 0 &&
      allestreeBrief.distance.km != null,
    `mickleoverHealthcare=${mickleoverBrief.healthcare.length} allestreeKm=${allestreeBrief.distance.km}`,
  );

  record(
    "local-introduction-is-evidence-bound",
    classifyContentField("local-area-page", "localIntroduction") === FIELD_OWNERSHIP.EVIDENCE_BOUND,
    String(classifyContentField("local-area-page", "localIntroduction")),
  );

  const brief = buildAiLocalNarrativeWritingBriefV3("Chellaston");
  record(
    "prompt-asks-for-polished-introduction",
    /150 to 250 words of fluent British English/i.test(brief) && /Follow the assigned introduction structure/i.test(brief),
    brief.slice(0, 180),
  );
  record(
    "prompt-bans-listing-language",
    /orient yourself/i.test(brief) && /named on the provider page/i.test(brief) && /recorded healthcare setting/i.test(brief),
    "banned phrases must appear as prohibitions",
  );

  const listing = evaluateAiLocalCopyQualityV3(
    sampleCopy({
      localIntroduction:
        "Mickleover sits on the western side of Derby as a neighbourhood ward. Orient yourself using the park. The medical centre is listed as a community facility. The library is recorded as a civic building named on the provider page beside a recorded healthcare setting. ".repeat(8),
      localContextParagraphs: [],
    }),
    sampleInput() as never,
  );
  record(
    "listing-language-fails-quality",
    listing.ok === false && listing.failures.some((row) => /evidence-listing-language|evidence-jargon|local-introduction-length/i.test(row)),
    listing.failures.join(" | "),
  );

  const words = "The ".repeat(180) + "end.";
  record("word-count-helper", countUkLocalIntroductionWords(words) === 181, String(countUkLocalIntroductionWords(words)));
  record("listing-language-regex", UK_LOCAL_INTRODUCTION_LISTING_LANGUAGE.test("The park is listed as a community facility in Mickleover."));

  const plan = planUkLocalServicePagesCampaign(BROOK_DERBY_DEMO_SLUG, SERVICE);
  record(
    "plan-covers-all-ten-including-allestree",
    plan.areas.length === 10 &&
      plan.areas.some((row) => row.areaSlug === "allestree") &&
      plan.serviceName.toLowerCase().includes("pharmacy first") &&
      Boolean(plan.primaryTown) &&
      Boolean(plan.destinationTenant),
    `areas=${plan.areas.map((row) => row.areaSlug).join(",")} town=${plan.primaryTown} tenant=${plan.destinationTenant}`,
  );

  const html = renderCampaignBuilderPage(BROOK_DERBY_DEMO_SLUG, "areas", { area: "allestree" });
  record(
    "campaign-builder-confirmation-panel",
    html.includes('data-uk-local-service-pages="true"') &&
      html.includes(CREATE_TEN_LOCAL_SERVICE_PAGES_LABEL) &&
      html.includes('id="confirmCreateTenLocalServicePages"') &&
      html.includes('id="btnCreateTenLocalServicePages"') &&
      html.includes("btn.disabled = !canConfirm || submitting || !(box && box.checked)") &&
      /data-uk-local-area="allestree"/.test(html) &&
      /Selected service/i.test(html) &&
      /Primary town\/city/i.test(html) &&
      /Destination tenant/i.test(html) &&
      /Evidence currently ready/i.test(html) &&
      !/demonstration-publish|publish demonstration/i.test(html),
    "confirmation checkbox starts controlling a disabled button",
  );

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "uk-local-pages-"));
  const liveCopy = path.join(
    PHARMACY_WORKSPACE_ROOT,
    "data/pharmacy-ai-local-copy-pilots",
    BROOK_DERBY_DEMO_SLUG,
    SERVICE,
    "v3",
    "allestree.json",
  );
  const beforeHash = fs.existsSync(liveCopy) ? createHash("sha256").update(fs.readFileSync(liveCopy)).digest("hex") : null;
  const snapshotDir = snapshotLiveLocalServicePages(BROOK_DERBY_DEMO_SLUG, SERVICE, [{ areaSlug: "allestree" }], "test-run", tmp);
  const snapCopy = path.join(snapshotDir, "copy", "allestree.json");
  record(
    "snapshot-preserves-live-candidate",
    fs.existsSync(snapCopy) &&
      beforeHash === createHash("sha256").update(fs.readFileSync(snapCopy)).digest("hex") &&
      snapshotDir.includes("uk-local-service-pages-"),
    snapshotDir.replace(`${PHARMACY_WORKSPACE_ROOT}/`, ""),
  );
  record(
    "snapshot-does-not-overwrite-live",
    beforeHash === (fs.existsSync(liveCopy) ? createHash("sha256").update(fs.readFileSync(liveCopy)).digest("hex") : null),
    "live Allestree candidate hash unchanged",
  );

  clearUkLocalServicePagesCampaignRuntimeForTests();
  const unconfirmed = await confirmUkLocalServicePagesCampaign({
    slug: BROOK_DERBY_DEMO_SLUG,
    serviceId: SERVICE,
    confirmAuthorise: false,
    processInline: true,
    deps: { runRoot: tmp },
  });
  record(
    "explicit-confirmation-required",
    unconfirmed.ok === false && unconfirmed.status === 403,
    unconfirmed.ok ? "started without confirmation" : unconfirmed.error,
  );

  const published = path.join(
    PHARMACY_WORKSPACE_ROOT,
    "data/pharmacy-demonstration-publications",
    BROOK_DERBY_DEMO_SLUG,
    SERVICE,
    "ai-local-area-page-pilot-v3",
    "allestree.json",
  );
  const publishedHash = fs.existsSync(published) ? createHash("sha256").update(fs.readFileSync(published)).digest("hex") : "missing";
  record(
    "no-allestree-republication-in-campaign-module",
    !fs.readFileSync("src/pharmacy/growthEngineLocalPageUkServicePagesCampaignRunService.ts", "utf8").includes("demonstration") &&
      publishedHash !== "missing",
    publishedHash.slice(0, 12),
  );

  const campaignSrc = fs.readFileSync(
    "src/pharmacy/growthEngineLocalPageUkServicePagesCampaignRunService.ts",
    "utf8",
  );
  record(
    "campaign-generation-has-no-automatic-retry",
    /maxAttempts:\s*1/.test(campaignSrc),
    "one prose call per area",
  );
  const writerSrc = fs.readFileSync("src/pharmacy/contentEngine/pharmacyUkLocalIntroductionProseWriterV1.ts", "utf8");
  record(
    "engine-uses-dedicated-prose-writer",
    fs
      .readFileSync("src/pharmacy/contentEngine/pharmacyAiLocalNarrativeEngineV3.ts", "utf8")
      .includes("requestUkLocalIntroductionProseV1"),
  );
  record(
    "prose-writer-uses-gemini-approved-prompt",
    writerSrc.includes("GEMINI_API_KEY") &&
      writerSrc.includes("UK_LOCAL_INTRODUCTION_APPROVED_PROMPT") &&
      writerSrc.includes("Use neutral factual British English") &&
      writerSrc.includes("without inventing an opinion about the area") &&
      writerSrc.includes("Do not reproduce a fixed clinical closing sentence") &&
      !writerSrc.includes("getOpenAiIntegrationClient"),
  );

  const fixtureHero =
    "Pharmacy First is available for people in Allestree through Brook Pharmacy. Eligible local patients from the neighbourhood can receive a pharmacist consultation for certain common conditions, with advice, treatment or referral depending on clinical assessment.";
  const fixtureLocal = [
    "Allestree is a neighbourhood ward in Derby, with a Neighbourhood Board of local councillors, residents and representatives from community organisations and public services. The area has a settled suburban character on the north side of the city, and its civic life is organised around named local institutions rather than a town-centre high street. Those arrangements give the neighbourhood a clear civic setting.",
    "Allestree Park is a large public park in the neighbourhood, and Allestree Library is a community facility used by local residents. Park Lane Surgery and Park Farm Medical Centre provide NHS general practice services in the area, sitting alongside the park, memorial hall and carnival as everyday local references for the community.",
    "For people living here, it still matters to have a pharmacist who can assess common health problems when they arise. Brook Pharmacy provides Pharmacy First consultations for eligible patients from the area. The pharmacist assesses symptoms, relevant medicines and medical history, and the outcome may include advice, suitable treatment or referral to another healthcare professional, depending on that clinical assessment.",
  ].join("\n\n");
  const fixtureWords = countUkLocalIntroductionWords(fixtureLocal);
  const heroWords = countUkLocalIntroductionWords(fixtureHero);
  record(
    "gemini-style-fixture-word-count",
    heroWords >= 35 && heroWords <= 55 && fixtureWords >= 170 && fixtureWords <= 230,
    `hero ${heroWords} local ${fixtureWords} words`,
  );
  const parsedFixture = parseUkLocalIntroductionProse(fixtureLocal);
  record(
    "prose-parser-preserves-fixture",
    parsedFixture === fixtureLocal,
    parsedFixture === fixtureLocal ? "" : "parser changed the fixture",
  );
  const assembledOnce = appendRendererOwnedLocalHandoverClinicalSentence(fixtureLocal);
  const assembledTwice = appendRendererOwnedLocalHandoverClinicalSentence(assembledOnce);
  record(
    "assembly-appends-clinical-sentence-once",
    assembledOnce.includes(RENDERER_OWNED_LOCAL_HANDOVER_CLINICAL_SENTENCE) &&
      assembledTwice === assembledOnce &&
      assembledOnce.split(RENDERER_OWNED_LOCAL_HANDOVER_CLINICAL_SENTENCE).length - 1 === 1 &&
      assembledOnce.split(/\n\s*\n/).filter((part) => part.trim()).length === 3,
    assembledOnce.slice(-120),
  );
  const assembledPreview = renderAiLocalPagePilotHtmlInMemoryV3({
    slug: BROOK_DERBY_DEMO_SLUG,
    serviceId: SERVICE,
    areaSlug: "allestree",
    overlay: {
      heroIntroduction: fixtureHero,
      localContextHeading: "Pharmacy First in Allestree",
      localIntroduction: fixtureLocal,
      localContextParagraphs: [],
      relationshipToPharmacy: "Consultations take place at Brook Pharmacy Demo Derby in Derby.",
      localAccessIntroduction: "",
      localFaqs: [],
      localCtaBridge: "",
    },
  });
  const previewHtml = assembledPreview.ok ? assembledPreview.html : "";
  const decoded = previewHtml.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
  const paragraphs = fixtureLocal.split("\n\n");
  record(
    "renderer-preserves-complete-prose-introduction",
    assembledPreview.ok &&
      decoded.includes("Pharmacy First in Allestree") &&
      decoded.includes(fixtureHero.slice(0, 60)) &&
      paragraphs.every((paragraph) => decoded.includes(paragraph.replace(/\s+/g, " ").slice(0, 80))) &&
      !/orient yourself|Orientating pharmacy care|local orientation|familiar points around/i.test(decoded),
    assembledPreview.ok ? `html ${previewHtml.length}` : assembledPreview.detail,
  );

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
}

void main();
