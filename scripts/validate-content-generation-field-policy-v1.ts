#!/usr/bin/env npx tsx
/**
 * Provider-free content-generation field-policy matrix.
 * No OpenAI, evidence collection, Resume, allowances, publication or commit.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  assembleDeterministicHeroIntroduction,
  assembleDeterministicRelationshipToPharmacy,
  buildContentGenerationFieldPlan,
  classifyContentField,
  classifyEvidenceRichness,
  clinicalCopyIsLiveApproved,
  CONTENT_GENERATION_FIELD_CATALOG,
  CONTENT_GENERATION_FIELD_POLICY_ID,
  CONTENT_GENERATION_FIELD_POLICY_PATH,
  FIELD_OWNERSHIP,
  openaiMustNotReceiveField,
  schemaMarkupIsLivePublication,
  type ContentGenerationEvidenceInput,
} from "../src/pharmacy/contentEngine/pharmacyContentGenerationFieldPolicyV1.ts";
import {
  ALLOWED_PHARMACY_FIRST_AI_FIELD_SENTENCE_V3,
  applyRendererOwnedLocalCopyFieldsV3,
  buildAiLocalNarrativeUserPromptV3,
  fieldPlanForLocalNarrativeInputV3,
  premisesLocalityFromCanonicalAddress,
} from "../src/pharmacy/contentEngine/pharmacyAiLocalNarrativePromptContractV1.ts";
import { parseAiLocalCopyV3 } from "../src/pharmacy/contentEngine/pharmacyAiLocalCopySchemaV1.ts";
import {
  buildPharmacyAiLocalCopyInputV3,
  validateAiLocalCopyPilotV3,
} from "../src/pharmacy/contentEngine/pharmacyAiLocalNarrativeEngineV3.ts";
import { loadEditorialEvidencePack } from "../src/pharmacy/contentEngine/pharmacyLocalEditorialEvidenceCollectorV3.ts";
import { BROOK_DERBY_DEMO_SLUG } from "../src/pharmacy/contentEngine/pharmacyAiLocalPageCandidatePaths.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";
import { renderReviewCentrePreviewAsset } from "../src/pharmacy/growthEngineReviewCentrePreviewService.ts";
import { renderCampaignBuilderPage } from "../src/pharmacy/growthEngineCampaignBuilderPage.ts";
import { hasSavedValidLocalPageCandidate } from "../src/pharmacy/growthEngineLocalPageCampaignRunService.ts";
import { inspectOffPremisesAccessCopyV3 } from "../src/pharmacy/contentEngine/pharmacyAiLocalCopyQualityV1.ts";

const SERVICE = "pharmacy-first";
const YORKSHIRE = "yorkshire-pharmacy-and-health-clinic";
const GROUNDING = "src/pharmacy/contentEngine/pharmacyAiLocalCopyClaimGroundingV1.ts";
const QUALITY = "src/pharmacy/contentEngine/pharmacyAiLocalCopyQualityV1.ts";
const LIVE_RUN =
  "data/pharmacy-local-page-campaign-runs/brook-pharmacy-demo-derby/pharmacy-first/v1/remaining-local-pages.json";
const BUDGET =
  "data/pharmacy-ai-local-generation-budget/brook-pharmacy-demo-derby/pharmacy-first/v3/brook-pharmacy-demo-derby:pharmacy-first:v3:one-local-page:chellaston.json";
const CANDIDATES = {
  allestree: "data/pharmacy-ai-local-copy-pilots/brook-pharmacy-demo-derby/pharmacy-first/v3/allestree.json",
  mickleover: "data/pharmacy-ai-local-copy-pilots/brook-pharmacy-demo-derby/pharmacy-first/v3/mickleover.json",
  littleover: "data/pharmacy-ai-local-copy-pilots/brook-pharmacy-demo-derby/pharmacy-first/v3/littleover.json",
  chellaston: "data/pharmacy-ai-local-copy-pilots/brook-pharmacy-demo-derby/pharmacy-first/v3/chellaston.json",
} as const;
const REJECTED = [
  "data/pharmacy-ai-local-copy-attempt-logs/brook-pharmacy-demo-derby/pharmacy-first/v3/chellaston/2026-09-05T19-41-32-991Z-attempt-1.json",
  "data/pharmacy-ai-local-copy-attempt-logs/brook-pharmacy-demo-derby/pharmacy-first/v3/chellaston/2026-09-06T05-55-55-049Z-attempt-1.json",
] as const;
const LOCKED_CANDIDATE_HASHES: Record<string, { generatedAt: string; sha256: string }> = {
  allestree: { generatedAt: "2026-09-07T10:01:29.015Z", sha256: "842b87a9d50756a60ab33dd9bdc87cd8c31a3fc7be09fef202475472dcdd2248" },
  mickleover: { generatedAt: "2026-09-07T10:32:29.938Z", sha256: "85a61fd84e6ae0eb8384ece53545792a1bc9ca174ee5d2a6c2e0b15378127c6d" },
  littleover: { generatedAt: "2026-09-07T10:32:33.472Z", sha256: "9e6bde9ce095c6f83d5a4ac72ca63c847f574c27c9d4fd2d7d9ef0e2ac1bdeb9" },
};

const checks: Array<{ id: string; pass: boolean; detail: string }> = [];
const classifiedReviews: Array<{ id: string; reviews: string[] }> = [];

function record(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

function reportReviews(id: string, reviews: string[]) {
  classifiedReviews.push({ id, reviews });
  if (!reviews.length) {
    console.log(`NONE   ${id} — no current review warnings`);
    return;
  }
  console.log(`REVIEW ${id} — ${reviews.length} current review warning(s); not counted as a pass`);
  for (const row of reviews) console.log(`        ${row}`);
}

function fieldFromFailure(row: string): string {
  const match = /field=([^\s|]+)/.exec(row);
  return match ? match[1].replace(/\[.*$/, "").replace(/\..*$/, "") : "";
}

function isOptionalCustomerField(fieldId: string): boolean {
  return CONTENT_GENERATION_FIELD_CATALOG.some(
    (row) =>
      row.pageKind === "local-area-page" &&
      row.fieldId === fieldId &&
      row.ownership === FIELD_OWNERSHIP.OPTIONAL_EVIDENCE_BOUND,
  );
}

function omitOptionalFields(
  copy: Parameters<typeof validateAiLocalCopyPilotV3>[0],
  fieldIds: string[],
): Parameters<typeof validateAiLocalCopyPilotV3>[0] {
  const next = {
    ...copy,
    localContextParagraphs: [...copy.localContextParagraphs],
    localFaqs: copy.localFaqs.map((faq) => ({ ...faq })),
    evidenceClaims: [...(copy.evidenceClaims || [])],
  };
  for (const field of fieldIds) {
    if (field === "localContextParagraphs") next.localContextParagraphs = [];
    else if (field === "localFaqs") next.localFaqs = [];
    else if (field in next && typeof (next as Record<string, unknown>)[field] === "string") {
      (next as Record<string, string>)[field] = "";
    }
    next.evidenceClaims = next.evidenceClaims.filter(
      (claim) => claim.field !== field && !String(claim.field || "").startsWith(`${field}[`),
    );
  }
  return next;
}

function buildNormalizedContractFixture(
  copy: Parameters<typeof validateAiLocalCopyPilotV3>[0],
  input: Parameters<typeof applyRendererOwnedLocalCopyFieldsV3>[1],
  facts: Parameters<typeof validateAiLocalCopyPilotV3>[2],
) {
  let next = applyRendererOwnedLocalCopyFieldsV3(copy, input);
  let validation = validateAiLocalCopyPilotV3(next, input, facts);
  const omitted = [...new Set(validation.failures.map(fieldFromFailure).filter(isOptionalCustomerField))];
  if (omitted.length) {
    next = applyRendererOwnedLocalCopyFieldsV3(omitOptionalFields(next, omitted), input);
    validation = validateAiLocalCopyPilotV3(next, input, facts);
  }
  return { copy: next, validation, omitted };
}

function sha256Rel(rel: string): string {
  return createHash("sha256").update(fs.readFileSync(path.join(PHARMACY_WORKSPACE_ROOT, rel))).digest("hex");
}

function readJson(rel: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(PHARMACY_WORKSPACE_ROOT, rel), "utf8")) as Record<string, unknown>;
}

function areaNameConditional(source: string): boolean {
  return /if\s*\([^)]*\b(chellaston|allestree|mickleover|littleover|duffield|wombwell|darfield)\b/i.test(source);
}

function evidence(partial: Partial<ContentGenerationEvidenceInput>): ContentGenerationEvidenceInput {
  return {
    editorialFactCount: 0,
    hasDistanceKm: false,
    hasNonDistanceEditorialFact: false,
    deliveryFacts: "unknown",
    unpublished: true,
    schemaDisabled: false,
    clinicalApprovalVersion: null,
    clinicalApprovalInvalidated: false,
    ...partial,
  };
}

async function main() {
  console.log("\n=== Content-generation field-policy matrix (no provider) ===\n");
  const groundingBefore = sha256Rel(GROUNDING);
  const qualityBefore = sha256Rel(QUALITY);
  const candidateHashesBefore = Object.fromEntries(
    Object.entries(CANDIDATES).map(([name, rel]) => [name, sha256Rel(rel)]),
  );
  const rejectedHashesBefore = REJECTED.map((rel) => sha256Rel(rel));
  const budgetBefore = sha256Rel(BUDGET);
  const runBefore = sha256Rel(LIVE_RUN);

  const none = buildContentGenerationFieldPlan("local-area-page", evidence({}));
  const sparse = buildContentGenerationFieldPlan("local-area-page", evidence({ editorialFactCount: 1, hasNonDistanceEditorialFact: true }));
  const distanceOnly = buildContentGenerationFieldPlan("local-area-page", evidence({ editorialFactCount: 1, hasDistanceKm: true }));
  const normal = buildContentGenerationFieldPlan("local-area-page", evidence({ editorialFactCount: 3, hasDistanceKm: true, hasNonDistanceEditorialFact: true }));
  const rich = buildContentGenerationFieldPlan("local-area-page", evidence({ editorialFactCount: 6, hasDistanceKm: true, hasNonDistanceEditorialFact: true }));
  record("matrix-no-local-evidence", none.evidenceRichness === "none" && none.mayRequestOpenAI === false && none.openaiSchemaFields.every((field) => !["localIntroduction", "localContextParagraphs"].includes(field)), `richness=${none.evidenceRichness} openai=${none.openaiSchemaFields.join(",")}`);
  record("matrix-sparse-evidence", sparse.evidenceRichness === "sparse" && sparse.openaiSchemaFields.includes("localContextParagraphs") && !sparse.openaiRequiredFields.includes("localContextParagraphs"), `richness=${sparse.evidenceRichness}`);
  record("matrix-distance-only", distanceOnly.evidenceRichness === "distance-only" && distanceOnly.mayRequestOpenAI === false && distanceOnly.deterministicFields.includes("relationshipToPharmacy") && !distanceOnly.deterministicFields.includes("localIntroduction") && !distanceOnly.openaiSchemaFields.includes("localIntroduction"), `richness=${distanceOnly.evidenceRichness}`);
  record("matrix-normal-evidence", normal.evidenceRichness === "normal" && normal.mayRequestOpenAI === true && normal.openaiRequiredFields.length === 0, `required=${normal.openaiRequiredFields.join(",") || "none"}`);
  record("matrix-rich-evidence", rich.evidenceRichness === "rich" && rich.openaiSchemaFields.includes("localFaqs") && !rich.openaiRequiredFields.includes("localFaqs"), `richness=${rich.evidenceRichness}`);

  const unknownDelivery = buildContentGenerationFieldPlan("service-page", evidence({ deliveryFacts: "unknown" }));
  const confirmedDelivery = buildContentGenerationFieldPlan("service-page", evidence({ deliveryFacts: "confirmed", editorialFactCount: 2, hasNonDistanceEditorialFact: true }));
  record("matrix-unknown-delivery", unknownDelivery.deterministicFields.includes("confirmedDeliveryFacts") && classifyEvidenceRichness(evidence({ deliveryFacts: "unknown" })) === "none", "unknown delivery facts stay deterministic and are omitted rather than inferred");
  record("matrix-confirmed-delivery", confirmedDelivery.pageKind === "service-page" && confirmedDelivery.deterministicFields.includes("confirmedDeliveryFacts"), "confirmed delivery facts remain platform-owned");

  const serviceA = buildContentGenerationFieldPlan("service-page", evidence({ editorialFactCount: 2, hasNonDistanceEditorialFact: true }));
  const serviceB = buildContentGenerationFieldPlan("local-area-page", evidence({ editorialFactCount: 2, hasNonDistanceEditorialFact: true, hasDistanceKm: true }));
  record("matrix-multiple-services", serviceA.pageKind !== serviceB.pageKind && serviceA.policyId === serviceB.policyId && !areaNameConditional(JSON.stringify(serviceA) + JSON.stringify(serviceB)), "one policy, two page kinds");
  record("matrix-multiple-areas", classifyContentField("local-area-page", "heroIntroduction") === FIELD_OWNERSHIP.DETERMINISTIC && classifyContentField("local-area-page", "localContextParagraphs") === FIELD_OWNERSHIP.OPTIONAL_EVIDENCE_BOUND, "area pages share ownership classes");
  record("matrix-multiple-tenants", CONTENT_GENERATION_FIELD_CATALOG.every((row) => !areaNameConditional(row.fieldId + row.notes)), "catalog has no tenant or area names");

  record("matrix-unpublished-schema-disabled", schemaMarkupIsLivePublication({ unpublished: true, schemaDisabled: true }) === false && schemaMarkupIsLivePublication({ unpublished: false, schemaDisabled: false }) === true, "unpublished or disabled schema is not live publication");
  record("matrix-exact-version-clinical-approval", clinicalCopyIsLiveApproved({ clinicalApprovalVersion: "2026-09-05", clinicalApprovalInvalidated: false }) === true && clinicalCopyIsLiveApproved({ clinicalApprovalVersion: "2026-09-05", clinicalApprovalInvalidated: true }) === false, "invalidated clinical versions are not live-approved");

  const catalogOwnerOnce = CONTENT_GENERATION_FIELD_CATALOG.every((row) => Object.values(FIELD_OWNERSHIP).includes(row.ownership));
  const noOpenaiDeterministic = CONTENT_GENERATION_FIELD_CATALOG.filter((row) => openaiMustNotReceiveField(row.pageKind, row.fieldId)).every((row) => row.openaiRequested === false && row.schemaRequired === false);
  record("policy-one-class-per-field", catalogOwnerOnce && noOpenaiDeterministic, `${CONTENT_GENERATION_FIELD_CATALOG.length} fields classified`);
  record("schema-never-requires-omissible-fields", [...none.openaiRequiredFields, ...sparse.openaiRequiredFields, ...distanceOnly.openaiRequiredFields, ...normal.openaiRequiredFields].length === 0, "no omissible field is schema-required");

  const policySrc = fs.readFileSync(path.join(PHARMACY_WORKSPACE_ROOT, CONTENT_GENERATION_FIELD_POLICY_PATH), "utf8");
  const promptSrc = fs.readFileSync(path.join(PHARMACY_WORKSPACE_ROOT, "src/pharmacy/contentEngine/pharmacyAiLocalNarrativePromptContractV1.ts"), "utf8");
  const ukSrc = fs.readFileSync(path.join(PHARMACY_WORKSPACE_ROOT, "src/pharmacy/contentEngine/pharmacyUkLocalPageContentContractV1.ts"), "utf8");
  const schemaSrc = fs.readFileSync(path.join(PHARMACY_WORKSPACE_ROOT, "src/pharmacy/contentEngine/pharmacyAiLocalCopySchemaV1.ts"), "utf8");
  const engineSrc = fs.readFileSync(path.join(PHARMACY_WORKSPACE_ROOT, "src/pharmacy/contentEngine/pharmacyAiLocalNarrativeEngineV3.ts"), "utf8");
  record("no-area-name-conditionals", !areaNameConditional(policySrc) && !areaNameConditional(promptSrc) && !areaNameConditional(ukSrc) && !areaNameConditional(schemaSrc), "production contract has no area-name branches");
  record(
    "generation-consumes-field-plan",
    /fieldPlanForLocalNarrativeInputV3/.test(engineSrc) && /mayRequestOpenAI/.test(engineSrc) && /field-policy-omits-openai/.test(engineSrc),
    "generate path consumes the same field plan and skips OpenAI when the policy omits AI work",
  );

  const brookEditorial = loadEditorialEvidencePack(BROOK_DERBY_DEMO_SLUG, SERVICE, "chellaston");
  const input = brookEditorial
    ? buildPharmacyAiLocalCopyInputV3({
        slug: BROOK_DERBY_DEMO_SLUG,
        serviceId: SERVICE,
        areaName: "Chellaston",
        areaSlug: "chellaston",
        editorial: brookEditorial,
      })
    : null;
  if (!input || !brookEditorial) {
    record("chellaston-input", false, "missing Chellaston editorial pack");
  } else {
    const prompt = JSON.parse(buildAiLocalNarrativeUserPromptV3(input)) as {
      schemaFields: string[];
      deterministicFields: Record<string, string>;
      rendererOwnedFields: Record<string, string>;
      fieldPolicyId: string;
    };
    const plan = fieldPlanForLocalNarrativeInputV3(input);
    record(
      "prompts-request-only-permitted-ai-fields",
      prompt.fieldPolicyId === CONTENT_GENERATION_FIELD_POLICY_ID &&
        prompt.schemaFields.every((field) => plan.openaiSchemaFields.includes(field)) &&
        !prompt.schemaFields.includes("heroIntroduction") &&
        !prompt.schemaFields.includes("relationshipToPharmacy") &&
        prompt.schemaFields.includes("localIntroduction") &&
        !prompt.schemaFields.includes("area") &&
        !prompt.schemaFields.includes("heroHeading"),
      `schemaFields=${prompt.schemaFields.join(",")}`,
    );
    record("required-schemas-match-evidence", prompt.schemaFields.includes("localContextParagraphs") && (plan.evidenceRichness === "normal" || plan.evidenceRichness === "rich") && plan.openaiRequiredFields.length === 0, plan.evidenceRichness);

    const hero = assembleDeterministicHeroIntroduction({
      areaName: "Chellaston",
      lockedIntroductorySentence: ALLOWED_PHARMACY_FIRST_AI_FIELD_SENTENCE_V3,
    });
    const relationship = assembleDeterministicRelationshipToPharmacy({
      pharmacyName: "Brook Pharmacy Demo Derby",
      premisesLocality: premisesLocalityFromCanonicalAddress(String(input.business.address || "")),
      areaName: "Chellaston",
      distanceKm: 5.8,
      pharmacyIsInArea: false,
    });
    const access = inspectOffPremisesAccessCopyV3(
      {
        area: "Chellaston",
        heroHeading: "Pharmacy First in Chellaston",
        heroIntroduction: hero,
        localIntroduction: "",
        localContextHeading: "",
        localContextParagraphs: ["NHS general practice services in Chellaston are provided from Chellaston Medical Centre."],
        relationshipToPharmacy: relationship,
        localAccessIntroduction: "",
        localFaqs: [],
        localCtaBridge: "",
        evidenceClaims: [],
        evidenceEntityIdsUsed: [],
      },
      input,
    );
    record("deterministic-facts-render", hero.includes("Chellaston") && relationship.includes("5.8 km") && relationship.includes("straight line") && relationship.includes("Derby") && !access.failures.some((row) => /area-in-hero|premises-locality/.test(row)), `${hero} | ${relationship}`);
    record("unsupported-optional-omitted", parseAiLocalCopyV3({ localContextParagraphs: [], localFaqs: [] }).ok === true, "empty optional fields parse");

    const yorkshire = loadEditorialEvidencePack(YORKSHIRE, SERVICE, "wombwell");
    const yorkshireIds = (yorkshire?.facts || []).map((fact) => fact.factId).join(" ");
    const brookIds = brookEditorial.facts.map((fact) => fact.factId).join(" ");
    record("no-tenant-service-area-leakage", !yorkshireIds.includes("chellaston:") && !brookIds.includes("wombwell:") && !brookIds.includes("allestree:"), "fact IDs stay on the supplied tenant/area");
  }

  const contractFixtureHardFailures: boolean[] = [];
  for (const [name, rel] of Object.entries(CANDIDATES)) {
    const rec = readJson(rel);
    const copy = rec.outputCopy as Parameters<typeof validateAiLocalCopyPilotV3>[0];
    const editorial = loadEditorialEvidencePack(BROOK_DERBY_DEMO_SLUG, SERVICE, name);
    const areaInput = editorial
      ? buildPharmacyAiLocalCopyInputV3({
          slug: BROOK_DERBY_DEMO_SLUG,
          serviceId: SERVICE,
          areaName: String(rec.areaName || name),
          areaSlug: name,
          editorial,
        })
      : null;
    const savedCurrent = areaInput
      ? validateAiLocalCopyPilotV3(copy, areaInput, editorial!.facts)
      : { ok: false, failures: ["missing-input"], reviews: [] as string[] };
    const storedOk = (rec.validationResult as { ok?: boolean })?.ok === true;
    console.log(`REFERENCE  regression-${name}-stored-validationResult.ok=${storedOk} — regression reference only; not contract proof`);
    record(
      `regression-${name}-saved-copy-current-hard-failures`,
      savedCurrent.failures.length === 0,
      savedCurrent.failures.length
        ? savedCurrent.failures.join(" | ")
        : "current hard validators found no failures on the unchanged saved copy",
    );
    reportReviews(`regression-${name}-saved-copy-current-reviews`, savedCurrent.reviews);

    const normalized = areaInput
      ? buildNormalizedContractFixture(copy, areaInput, editorial!.facts)
      : null;
    const contractHardPass = Boolean(normalized && normalized.validation.failures.length === 0);
    contractFixtureHardFailures.push(contractHardPass);
    record(
      `contract-fixture-${name}-hard-failures`,
      contractHardPass,
      normalized
        ? normalized.validation.failures.length
          ? normalized.validation.failures.join(" | ")
          : `zero hard failures; omittedOptional=${normalized.omitted.join(",") || "none"}`
        : "missing-input",
    );
    reportReviews(`contract-fixture-${name}-current-reviews`, normalized?.validation.reviews || []);

    const preview = renderReviewCentrePreviewAsset(BROOK_DERBY_DEMO_SLUG, SERVICE, "ai-local-area-page-pilot-v3", { areaSlug: name });
    const previewText = preview.html.replace(/<[^>]+>/g, " ");
    record(
      `preview-${name}-unchanged-identity`,
      preview.sourceRoute === "ai-local-area-page-pilot-v3" &&
        previewText.includes(String(rec.areaName || name.replace(/^./, (ch) => ch.toUpperCase()))) &&
        !previewText.includes("editorialFactId") &&
        !/chellaston:[a-z]+:/i.test(preview.html),
      preview.sourceRoute,
    );
    if (name !== "chellaston") {
      const lock = LOCKED_CANDIDATE_HASHES[name];
      record(`hash-${name}`, sha256Rel(rel) === lock.sha256 && rec.generatedAt === lock.generatedAt, rec.generatedAt as string);
    }
  }

  const chellaston = readJson(CANDIDATES.chellaston);
  const chellastonCopy = chellaston.outputCopy as { heroIntroduction?: string; relationshipToPharmacy?: string; localContextParagraphs?: string[] };
  const chellastonEditorial = loadEditorialEvidencePack(BROOK_DERBY_DEMO_SLUG, SERVICE, "chellaston");
  const chellastonNormalized =
    input && chellastonEditorial
      ? buildNormalizedContractFixture(chellaston.outputCopy as Parameters<typeof validateAiLocalCopyPilotV3>[0], input, chellastonEditorial.facts)
      : null;
  record(
    "successful-chellaston-candidate",
    chellastonCopy.heroIntroduction === "Pharmacy First can help with eligible common conditions for people in Chellaston." &&
      /5\.8 km in a straight line from Chellaston/.test(String(chellastonCopy.relationshipToPharmacy || "")) &&
      Boolean(chellastonNormalized && chellastonNormalized.validation.failures.length === 0),
    `${String(chellaston.generatedAt)}; current hard failures=${chellastonNormalized?.validation.failures.length ?? "n/a"}; stored.ok=${(chellaston.validationResult as { ok?: boolean })?.ok} (reference only)`,
  );

  for (const rel of REJECTED) {
    const attempt = readJson(rel);
    const parsed = parseAiLocalCopyV3(attempt.rawResponse);
    record(`rejected-attempt-preserved-${path.basename(rel).slice(0, 19)}`, parsed.ok === true && attempt.candidateRecordWritten === false, path.basename(rel));
    if (!parsed.ok || !input || !brookEditorial) continue;
    const rawCurrent = validateAiLocalCopyPilotV3(parsed.copy, input, brookEditorial.facts);
    record(
      `regression-${path.basename(rel).slice(0, 19)}-raw-still-hard-fails`,
      rawCurrent.failures.length > 0 || rawCurrent.reviews.length > 0,
      rawCurrent.failures.join(" | ") || rawCurrent.reviews.join(" | ") || "raw copy unexpectedly has zero current hard failures or reviews",
    );
    reportReviews(`regression-${path.basename(rel).slice(0, 19)}-raw-current-reviews`, rawCurrent.reviews);
    const rejectedNormalized = buildNormalizedContractFixture(parsed.copy, input, brookEditorial.facts);
    contractFixtureHardFailures.push(rejectedNormalized.validation.failures.length === 0);
    record(
      `contract-fixture-${path.basename(rel).slice(0, 19)}-hard-failures`,
      rejectedNormalized.validation.failures.length === 0,
      rejectedNormalized.validation.failures.length
        ? rejectedNormalized.validation.failures.join(" | ")
        : `zero hard failures; omittedOptional=${rejectedNormalized.omitted.join(",") || "none"}`,
    );
    reportReviews(`contract-fixture-${path.basename(rel).slice(0, 19)}-current-reviews`, rejectedNormalized.validation.reviews);
  }
  const failedHero = parseAiLocalCopyV3((readJson(REJECTED[1]).rawResponse as string) || "{}");
  record(
    "rejected-chellaston-still-fails-without-overlay",
    failedHero.ok === true &&
      input != null &&
      inspectOffPremisesAccessCopyV3(failedHero.copy, input).failures.some((row) => /area-in-hero/.test(row)),
    "area-in-hero still fails on the saved rejected response",
  );

  const builder = renderCampaignBuilderPage(BROOK_DERBY_DEMO_SLUG, "areas", { area: "chellaston" });
  record(
    "campaign-builder-unchanged-state",
    /Saved candidate/.test(builder) &&
      /Chellaston/.test(builder) &&
      /Allestree/.test(builder) &&
      /Mickleover/.test(builder) &&
      /Littleover/.test(builder) &&
      hasSavedValidLocalPageCandidate(BROOK_DERBY_DEMO_SLUG, SERVICE, "allestree") &&
      hasSavedValidLocalPageCandidate(BROOK_DERBY_DEMO_SLUG, SERVICE, "chellaston"),
    "Campaign Builder still shows the four saved candidates",
  );

  const run = readJson(LIVE_RUN);
  const budget = readJson(BUDGET);
  record("duplicate-reload-safety", run.status === "completed" && run.runId === "e23b2020-b520-453c-a7a5-45d301316229", `${run.status} ${budget.consumed}/${budget.maxProviderCalls}`);
  const chellastonClaims = Array.isArray((chellaston.outputCopy as { evidenceClaims?: Array<{ field?: string; editorialFactId?: string }> }).evidenceClaims)
    ? (chellaston.outputCopy as { evidenceClaims: Array<{ field?: string; editorialFactId?: string }> }).evidenceClaims
    : [];
  record(
    "ai-sentences-evidence-bound",
    chellastonClaims.some((claim) => claim.field === "localContextParagraphs" && String(claim.editorialFactId || "").startsWith("chellaston:")) &&
      chellastonClaims.every((claim) => String(claim.editorialFactId || "").startsWith("chellaston:")),
    "saved Chellaston narrative carries internal claims from Chellaston facts only",
  );
  const overlayProof = input
    ? applyRendererOwnedLocalCopyFieldsV3(
        parseAiLocalCopyV3({
          localContextParagraphs: ["NHS general practice services in Chellaston are provided from Chellaston Medical Centre."],
        }).ok
          ? parseAiLocalCopyV3({
              localContextParagraphs: ["NHS general practice services in Chellaston are provided from Chellaston Medical Centre."],
              evidenceClaims: [
                {
                  field: "localContextParagraphs",
                  sentence: "NHS general practice services in Chellaston are provided from Chellaston Medical Centre.",
                  editorialFactId: "chellaston:healthcare:nhs-general-practice-services-in-chellaston-are-",
                },
              ],
              editorialFactIdsUsed: ["chellaston:healthcare:nhs-general-practice-services-in-chellaston-are-"],
            }).copy
          : (chellaston.outputCopy as never),
        input,
      )
    : null;
  record(
    "complete-candidate-validation-on-assembled-copy",
    Boolean(overlayProof && input && brookEditorial && validateAiLocalCopyPilotV3(overlayProof, input, brookEditorial.facts).failures.length === 0),
    overlayProof ? overlayProof.heroHeading : "no overlay",
  );
  if (overlayProof && input && brookEditorial) {
    const assembled = validateAiLocalCopyPilotV3(overlayProof, input, brookEditorial.facts);
    contractFixtureHardFailures.push(assembled.failures.length === 0);
    reportReviews("contract-fixture-assembled-chellaston-current-reviews", assembled.reviews);
  }

  record("validators-unchanged", groundingBefore === sha256Rel(GROUNDING) && qualityBefore === sha256Rel(QUALITY), "grounding and quality files unchanged");
  record(
    "saved-state-unchanged",
    Object.entries(CANDIDATES).every(([name, rel]) => sha256Rel(rel) === candidateHashesBefore[name]) &&
      REJECTED.every((rel, i) => sha256Rel(rel) === rejectedHashesBefore[i]) &&
      sha256Rel(BUDGET) === budgetBefore &&
      sha256Rel(LIVE_RUN) === runBefore &&
      run.status === "completed",
    "evidence, attempts, costs and candidates unchanged; run remains completed",
  );

  const newContractHardPass = contractFixtureHardFailures.length > 0 && contractFixtureHardFailures.every(Boolean);
  record(
    "new-contract-fixtures-zero-hard-failures",
    newContractHardPass,
    newContractHardPass
      ? `${contractFixtureHardFailures.length} new-contract fixtures have zero current hard failures`
      : "a new-contract fixture still has current hard failures; deploy is blocked",
  );

  const failed = checks.filter((row) => !row.pass);
  const reviewCount = classifiedReviews.reduce((sum, row) => sum + row.reviews.length, 0);
  console.log(`\n${failed.length ? "FAIL" : "PASS"}  ${checks.filter((row) => row.pass).length}/${checks.length} hard-failure checks`);
  console.log(`REVIEW  ${reviewCount} current review warning(s) classified separately and not converted to passes`);
  if (failed.length) {
    for (const row of failed) console.log(`  ${row.id}: ${row.detail}`);
    process.exit(1);
  }
  if (!newContractHardPass) process.exit(1);
}

await main();
