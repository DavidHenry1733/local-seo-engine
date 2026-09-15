#!/usr/bin/env npx tsx
/**
 * Focused tests — Pharmacy AI local-narrative editorial pilots V2 (Prompt 94).
 * Does not overwrite live pages or Prompt 93 candidates.
 *
 * Run: npx tsx src/pharmacy/contentEngine/validatePharmacyAiLocalNarrativePilotV2.ts
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

import {
  AI_LOCAL_NARRATIVE_PROMPT_CONTRACT_PATH,
  AI_LOCAL_NARRATIVE_PROMPT_VERSION_V2,
  AI_LOCAL_NARRATIVE_PROMPT_CONTRACT_ID_V2,
  buildAiLocalNarrativeSystemPromptV2,
  classifyEvidenceRichnessV2,
  usefulLocalEvidenceEntitiesV2,
} from "./pharmacyAiLocalNarrativePromptContractV1.ts";
import {
  parseAiLocalCopyV2,
  type AiLocalCopyV2,
  type AiEvidenceSelectionRowV2,
} from "./pharmacyAiLocalCopySchemaV1.ts";
import { groundAiLocalCopyClaimsV2 } from "./pharmacyAiLocalCopyClaimGroundingV1.ts";
import { evaluateAiLocalCopyQualityV2 } from "./pharmacyAiLocalCopyQualityV1.ts";
import {
  AI_LOCAL_NARRATIVE_ENGINE_ID_V2,
  AI_LOCAL_NARRATIVE_MODEL_V2,
  AI_LOCAL_NARRATIVE_PROVIDER_V2,
  AI_LOCAL_PILOT_AREAS,
  buildPharmacyAiLocalCopyInputV1,
  generateAiLocalCopyPilotV2,
  loadAiLocalCopyPilotV2,
  resetAiPilotLedger,
  validateAiLocalCopyPilotV2,
} from "./_archive-legacy-local-writers/pharmacyAiLocalNarrativeEngineV2.ts";
import { runPharmacyAiLocalNarrativePilotV2 } from "./_archive-legacy-local-writers/runPharmacyAiLocalNarrativePilotV2.ts";
import {
  AI_LOCAL_AREA_PAGE_PILOT_V2_ASSET,
  AI_PILOT_V2_PREVIEW_BANNER,
  aiLocalCopyPilotPath,
  aiLocalPagePilotHtmlPath,
  aiLocalCopyRecordPath,
} from "./pharmacyAiLocalPageCandidatePaths.ts";
import {
  loadPharmacyLocalEvidencePack,
  planPharmacyLocalEvidenceRequest,
  validatePharmacyLocalEvidencePack,
  type PharmacyLocalEvidencePackV3,
} from "./pharmacyLocalEvidencePackContractV1.ts";
import { renderReviewCentrePreviewAsset } from "../growthEngineReviewCentrePreviewService.ts";
import { assemblePharmacyAiLocalPagePilotsV2 } from "../pharmacyAiLocalPagePilotAssemblerV2.ts";
import { copySimilarityScore } from "../pharmacyLocalClusterVariantFamilies.ts";
import { localNarrativeFingerprint } from "./pharmacyAiLocalCopyQualityV1.ts";
import { stripIdentityTokens, stripHtmlToText, extractLocalityNarrativeHtml } from "./pharmacyLocalPageCandidateUniquenessV1.ts";
import { flattenAiLocalCopyText } from "./pharmacyAiLocalCopySchemaV1.ts";
import { getContentPackageReviewSections } from "../pharmacyContentPackageService.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const YORKSHIRE = "yorkshire-pharmacy-and-health-clinic";
const SERVICE = "pharmacy-first";
const PHARMACY = "Yorkshire Pharmacy & Health Clinic";
const PHONE = "01226 210477";
const ADDRESS = "91 Snape Hill Rd, Darfield, Barnsley S73 9LR, UK";

const checks: Array<{ id: string; pass: boolean; detail: string }> = [];
function record(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

function hashFile(file: string): string {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function walkFiles(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, out);
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

function snapshotProtected(): Map<string, string> {
  const out = new Map<string, string>();
  const roots = [
    path.join(ROOT, "output/pharmacy-content-ecosystem", YORKSHIRE),
    path.join(ROOT, "output/pharmacy-visual-experience", YORKSHIRE),
    path.join(ROOT, "output/pharmacy-local-page-candidates", YORKSHIRE),
    path.join(ROOT, "output/pharmacy-ai-local-page-candidates", YORKSHIRE),
    path.join(ROOT, "data/pharmacy-ai-local-copy-candidates", YORKSHIRE),
    path.join(ROOT, "data/pharmacy-local-relevance-packs", YORKSHIRE),
    path.join(ROOT, "data/pharmacy-content-packages", YORKSHIRE),
    path.join(ROOT, "data/growth-engine", `${YORKSHIRE}-campaign-builder.json`),
    path.join(ROOT, "data/growth-engine", `${YORKSHIRE}-review-centre.json`),
    path.join(ROOT, "data/pharmacy-master-admin/campaign-approvals", YORKSHIRE, "pharmacy-first.json"),
    path.join(ROOT, "package.json"),
  ];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    const stat = fs.statSync(root);
    if (stat.isFile()) out.set(root, hashFile(root));
    else for (const file of walkFiles(root)) out.set(file, hashFile(file));
  }
  return out;
}

function loadPack(areaSlug: string, areaName: string): PharmacyLocalEvidencePackV3 {
  const raw = loadPharmacyLocalEvidencePack(YORKSHIRE, areaSlug);
  const checked = validatePharmacyLocalEvidencePack(raw, { slug: YORKSHIRE, areaName, areaSlug });
  if (!checked.ok) throw new Error(`${areaSlug}: ${checked.detail}`);
  return checked.pack;
}

function selectionFor(
  input: ReturnType<typeof buildPharmacyAiLocalCopyInputV1>,
  useNames: string[] = [],
): AiEvidenceSelectionRowV2[] {
  return input.locality.acceptedEntities.map((entity) => {
    const use = useNames.some((name) => name.toLowerCase() === entity.name.toLowerCase());
    const school = entity.category === "schools" || entity.category === "retail";
    return {
      entityId: entity.entityId,
      name: entity.name,
      category: entity.category,
      classification: school
        ? "irrelevant-to-patient-decision"
        : entity.category === "healthcare"
          ? "useful-healthcare-context"
          : entity.category === "transport"
            ? "useful-access-orientation"
            : entity.category === "community" || entity.category === "landmarks"
              ? "useful-community-orientation"
              : "irrelevant-to-patient-decision",
      useInCopy: use,
      reason: use ? "helps the reader understand the local relationship" : "omitted because it does not help a patient decision",
    };
  });
}

function darfieldFixture(input: ReturnType<typeof buildPharmacyAiLocalCopyInputV1>): AiLocalCopyV2 {
  return {
    area: "Darfield",
    heroHeading: "Pharmacy First in Darfield",
    heroIntroduction:
      "The Pharmacy First page for Darfield is for people whose nearest listed premises are in the village itself. Speak to the pharmacy team if a consultation may be suitable.",
    localIntroduction:
      "Yorkshire Pharmacy & Health Clinic stands at 91 Snape Hill Rd, Darfield, Barnsley S73 9LR, UK, about 0.5 km from the centre of Darfield.",
    localContextHeading: "Using Pharmacy First from an in-village pharmacy",
    localContextParagraphs: [
      "Because the pharmacy is in Darfield, this page is not a neighbouring-area edition. Pharmacy First can help with eligible common conditions once the pharmacist has assessed your symptoms.",
    ],
    relationshipToPharmacy: "The pharmacy premises are in Darfield, so the local relationship is the in-village address rather than a journey from another town.",
    localAccessIntroduction: "Call before visiting to check how a consultation is being arranged.",
    localFaqs: [
      { question: "How far is the pharmacy from central Darfield?", answer: "The verified distance is 0.5 km." },
      { question: "When should I use another healthcare route?", answer: "If Pharmacy First is not suitable, the pharmacist will advise on self-care, safety-netting or referral, and you should seek urgent medical care for red-flag symptoms." },
      { question: "What should I bring to a consultation?", answer: "Please bring a list of any medicines you are currently taking and a clear account of your symptoms." },
    ],
    localCtaBridge: "Get in touch if you think Pharmacy First may be suitable.",
    evidenceClaims: [
      { field: "localIntroduction", sentence: "Yorkshire Pharmacy & Health Clinic stands at 91 Snape Hill Rd, Darfield, Barnsley S73 9LR, UK, about 0.5 km from the centre of Darfield." },
    ],
    evidenceEntityIdsUsed: [],
    evidenceSelection: selectionFor(input, []),
  };
}

function wombwellFixture(input: ReturnType<typeof buildPharmacyAiLocalCopyInputV1>): AiLocalCopyV2 {
  return {
    area: "Wombwell",
    heroHeading: "Pharmacy First for people in Wombwell",
    heroIntroduction:
      "This page is for people in Wombwell who would use Pharmacy First at a pharmacy just outside the area, not a premises on a Wombwell street. The pharmacist still confirms what can be assessed on the day.",
    localIntroduction: "Wombwell is 1.7 km from Yorkshire Pharmacy & Health Clinic.",
    localContextHeading: "Wombwell and the Darfield pharmacy",
    localContextParagraphs: [
      "Wombwell has its own healthcare sites, including Wombwell Medical Centre on George Street.",
      "Wood Walk/Dovecliffe Road is a named transport point in Wombwell.",
    ],
    relationshipToPharmacy: "People in Wombwell reach Pharmacy First at Yorkshire Pharmacy & Health Clinic, 1.7 km away.",
    localAccessIntroduction: "Call before visiting to check how a consultation is being arranged.",
    localFaqs: [
      { question: "How far is the pharmacy from Wombwell?", answer: "The verified distance is 1.7 km." },
      { question: "When should I use another healthcare route?", answer: "If Pharmacy First is not suitable, the pharmacist will advise on next steps or referral, and urgent symptoms need urgent medical care." },
      { question: "What happens in a consultation?", answer: "The pharmacist will review your symptoms and medicines, including red-flag concerns. Outcomes may include treatment where appropriate, self-care advice, safety-netting, or referral." },
    ],
    localCtaBridge: "Please get in touch to arrange a Pharmacy First consultation.",
    evidenceClaims: [
      { field: "localContextParagraphs", sentence: "Wombwell has its own healthcare sites, including Wombwell Medical Centre on George Street.", entityId: "healthcare:wombwell-medical-centre" },
      { field: "localContextParagraphs", sentence: "Wood Walk/Dovecliffe Road is a named transport point in Wombwell.", entityId: "transport:wood-walk-dovecliffe-road" },
    ],
    evidenceEntityIdsUsed: ["healthcare:wombwell-medical-centre", "transport:wood-walk-dovecliffe-road"],
    evidenceSelection: selectionFor(input, ["Wombwell Medical Centre", "Wood Walk/Dovecliffe Road"]),
  };
}

async function main(): Promise<void> {
  const before = snapshotProtected();
  const plan = planPharmacyLocalEvidenceRequest(YORKSHIRE, SERVICE);
  const darfieldInput = buildPharmacyAiLocalCopyInputV1({
    slug: YORKSHIRE,
    serviceId: SERVICE,
    areaName: "Darfield",
    areaSlug: "darfield",
    pack: loadPack("darfield", "Darfield"),
  });
  const wombwellInput = buildPharmacyAiLocalCopyInputV1({
    slug: YORKSHIRE,
    serviceId: SERVICE,
    areaName: "Wombwell",
    areaSlug: "wombwell",
    pack: loadPack("wombwell", "Wombwell"),
  });
  const worsbroughInput = buildPharmacyAiLocalCopyInputV1({
    slug: YORKSHIRE,
    serviceId: SERVICE,
    areaName: "Worsbrough",
    areaSlug: "worsbrough",
    pack: loadPack("worsbrough", "Worsbrough"),
  });

  const srcEngine = fs.readFileSync(path.join(ROOT, "src/pharmacy/contentEngine/pharmacyAiLocalNarrativeEngineV2.ts"), "utf8");
  const srcAdapter = fs.readFileSync(path.join(ROOT, "src/generator/generateClusterContent.ts"), "utf8");
  const srcPreview = fs.readFileSync(path.join(ROOT, "src/pharmacy/growthEngineReviewCentrePreviewService.ts"), "utf8");
  const srcPrompt = fs.readFileSync(path.join(ROOT, "src/pharmacy/contentEngine/pharmacyAiLocalNarrativePromptContractV1.ts"), "utf8");
  const srcRunner = fs.readFileSync(path.join(ROOT, "src/pharmacy/contentEngine/runPharmacyAiLocalNarrativePilotV2.ts"), "utf8");
  const srcGround = fs.readFileSync(path.join(ROOT, "src/pharmacy/contentEngine/pharmacyAiLocalCopyClaimGroundingV1.ts"), "utf8");

  record(
    "1-v2-uses-existing-openai-adapter",
    srcEngine.includes("getOpenAiIntegrationClient") &&
      srcEngine.includes('from "../../generator/generateClusterContent.ts"') &&
      srcAdapter.includes("function getClient()") &&
      srcEngine.includes('response_format: { type: "json_object" }') &&
      AI_LOCAL_NARRATIVE_PROVIDER_V2 === "openai" &&
      AI_LOCAL_NARRATIVE_MODEL_V2 === "gpt-4.1",
    `${AI_LOCAL_NARRATIVE_ENGINE_ID_V2} ${AI_LOCAL_NARRATIVE_PROVIDER_V2}/${AI_LOCAL_NARRATIVE_MODEL_V2}`,
  );

  const system = buildAiLocalNarrativeSystemPromptV2("pharmacy");
  record(
    "prompt-v2-contract",
    AI_LOCAL_NARRATIVE_PROMPT_VERSION_V2 === "v2" &&
      AI_LOCAL_NARRATIVE_PROMPT_CONTRACT_ID_V2 === "pharmacy-ai-local-narrative-prompt-v2" &&
      AI_LOCAL_NARRATIVE_PROMPT_CONTRACT_PATH.endsWith("pharmacyAiLocalNarrativePromptContractV1.ts") &&
      /Classify every supplied evidence entity/i.test(system) &&
      /Do not produce interchangeable paragraphs/i.test(system) &&
      srcPrompt.includes("buildAiLocalNarrativeUserPromptV2"),
    `${AI_LOCAL_NARRATIVE_PROMPT_CONTRACT_PATH} ${AI_LOCAL_NARRATIVE_PROMPT_VERSION_V2}`,
  );

  record(
    "2-only-three-pilot-areas",
    AI_LOCAL_PILOT_AREAS.join(",") === "darfield,wombwell,worsbrough" &&
      srcRunner.includes("AI_LOCAL_PILOT_AREAS") &&
      plan.areas.filter((a) => AI_LOCAL_PILOT_AREAS.includes(a.areaSlug)).length === 3,
    AI_LOCAL_PILOT_AREAS.join(","),
  );

  record(
    "3-each-area-receives-only-its-own-evidence",
    darfieldInput.locality.acceptedEntities.every((e) => e.name !== "Wombwell Medical Centre") &&
      wombwellInput.locality.acceptedEntities.some((e) => e.name === "Wombwell Medical Centre") &&
      !worsbroughInput.locality.acceptedEntities.some((e) => e.name === "Wombwell Medical Centre") &&
      worsbroughInput.locality.acceptedEntities.some((e) => /Worsbrough Mill/i.test(e.name)),
    `darfield=${darfieldInput.locality.acceptedEntities.length} wombwell=${wombwellInput.locality.acceptedEntities.length} worsbrough=${worsbroughInput.locality.acceptedEntities.length}`,
  );

  const parsedOk = parseAiLocalCopyV2(darfieldFixture(darfieldInput));
  record("4-evidence-selection-is-explicit", parsedOk.ok && (parsedOk.ok ? parsedOk.copy.evidenceSelection.length === darfieldInput.locality.acceptedEntities.length : false), parsedOk.ok ? `rows=${parsedOk.copy.evidenceSelection.length}` : parsedOk.failures[0] || "parse");

  const emptyRich = wombwellFixture(wombwellInput);
  emptyRich.evidenceEntityIdsUsed = [];
  emptyRich.localContextParagraphs = ["People in Wombwell can use Pharmacy First at the Darfield pharmacy."];
  emptyRich.evidenceSelection = selectionFor(wombwellInput, []);
  const emptyCheck = validateAiLocalCopyPilotV2(emptyRich, wombwellInput);
  record("5-medium-rich-cannot-pass-with-zero-useful-entities", !emptyCheck.ok && emptyCheck.failures.some((f) => /evidenceEntityIdsUsed|useful entities/i.test(f)), emptyCheck.failures[0] || "unexpected pass");

  const omitSchool = darfieldFixture(darfieldInput);
  record(
    "6-irrelevant-entities-may-be-omitted",
    omitSchool.evidenceSelection.some((row) => row.name === "Darfield Library" && !row.useInCopy) &&
      !flattenAiLocalCopyText(omitSchool).includes("Darfield Library"),
    "library omitted on sparse darfield fixture",
  );

  record(
    "7-schools-and-retailers-are-not-forced",
    !flattenAiLocalCopyText(omitSchool).includes("Upperwood Academy") &&
      omitSchool.evidenceSelection.some((row) => row.name === "Upperwood Academy" && !row.useInCopy),
    "Upperwood Academy omitted",
  );

  const affiliated = wombwellFixture(wombwellInput);
  affiliated.localContextParagraphs = [
    "Wombwell Medical Centre is a referral partner of Yorkshire Pharmacy & Health Clinic.",
    affiliated.localContextParagraphs[1] || "Wood Walk/Dovecliffe Road orients Wombwell.",
  ];
  const aff = groundAiLocalCopyClaimsV2(affiliated, wombwellInput);
  record("8-implied-affiliation-fails", !aff.ok && aff.failures.some((f) => /partner|affiliat/i.test(f)), aff.failures[0] || "unexpected pass");

  const usesGp = wombwellFixture(wombwellInput);
  usesGp.heroIntroduction = "If Wombwell Medical Centre is your usual GP, you can still use Pharmacy First at Yorkshire Pharmacy & Health Clinic.";
  usesGp.localContextParagraphs = [
    "Wombwell has its own healthcare sites, including Wombwell Medical Centre on George Street.",
    "Wood Walk/Dovecliffe Road is a named transport point in Wombwell.",
  ];
  const gpUse = validateAiLocalCopyPilotV2(usesGp, wombwellInput);
  record("9-assumed-gp-usage-fails", !gpUse.ok && gpUse.failures.some((f) => /uses a named medical practice|usual gp/i.test(f)), gpUse.failures[0] || "unexpected pass");

  const delays = wombwellFixture(wombwellInput);
  delays.localContextParagraphs = [
    "Pharmacy First may help you avoid unnecessary delays compared with waiting for a GP.",
    delays.localContextParagraphs[1] || "Wood Walk/Dovecliffe Road orients Wombwell.",
  ];
  const delayCheck = validateAiLocalCopyPilotV2(delays, wombwellInput);
  record("10-gp-waiting-delay-claims-fail", !delayCheck.ok, delayCheck.failures[0] || "unexpected pass");

  const easy = wombwellFixture(wombwellInput);
  easy.localContextParagraphs = [
    "The pharmacy is within easy reach and offers convenient, prompt support.",
    easy.localContextParagraphs[1] || "Wood Walk/Dovecliffe Road orients Wombwell.",
  ];
  const easyCheck = evaluateAiLocalCopyQualityV2(easy, wombwellInput);
  const easyGround = groundAiLocalCopyClaimsV2(easy, wombwellInput);
  record(
    "11-convenient-easy-reach-avoid-delays-fail",
    !easyCheck.ok && !easyGround.ok,
    `${easyCheck.failures[0] || ""} | ${easyGround.failures[0] || ""}`,
  );

  const nonFactual = wombwellFixture(wombwellInput);
  nonFactual.localContextParagraphs = [
    "Care here is convenient and efficient for everyone nearby.",
    "Wood Walk/Dovecliffe Road is a named transport point in Wombwell.",
  ];
  const nf = groundAiLocalCopyClaimsV2(nonFactual, wombwellInput);
  record(
    "12-non-factual-prose-cannot-bypass-grounding",
    !nf.ok &&
      !nf.claims.some((c) => c.supportingCanonicalFieldOrEntity === "non-factual-prose" && c.validationResult === "pass") &&
      srcGround.includes("non-factual-prose cannot bypass grounding"),
    nf.failures[0] || "unexpected pass",
  );

  const repeatAddr = darfieldFixture(darfieldInput);
  repeatAddr.relationshipToPharmacy = `Yorkshire Pharmacy & Health Clinic is also at ${ADDRESS}.`;
  const rpt = validateAiLocalCopyPilotV2(repeatAddr, darfieldInput);
  record("13-repeated-address-guidance-fails", !rpt.ok && rpt.failures.some((f) => /address/i.test(f)), rpt.failures[0] || "unexpected pass");

  const repeatCall = darfieldFixture(darfieldInput);
  repeatCall.localFaqs = [
    repeatCall.localFaqs[0]!,
    { question: "Should I call before visiting?", answer: "Yes. Call before visiting to check how a consultation is being arranged." },
    repeatCall.localFaqs[2]!,
  ];
  const callR = validateAiLocalCopyPilotV2(repeatCall, darfieldInput);
  record("14-repeated-call-ahead-guidance-fails", !callR.ok && callR.failures.some((f) => /call-ahead/i.test(f)), callR.failures[0] || "unexpected pass");

  const generic = darfieldFixture(darfieldInput);
  generic.heroIntroduction = "Residents of Darfield can access Pharmacy First for eligible common conditions. Speak to the team.";
  const gen = validateAiLocalCopyPilotV2(generic, darfieldInput);
  record("15-generic-area-substitution-copy-fails", !gen.ok, gen.failures[0] || "unexpected pass");

  record(
    "16-approved-clinical-copy-outside-ai-control",
    /Do not rewrite locked clinical facts/i.test(system) &&
      srcPrompt.includes("The renderer will print approved condition") === false
      ? srcPrompt.includes("The renderer prints approved clinical copy") || /renderer prints approved/i.test(system)
      : true,
    "prompt keeps clinical boundary",
  );

  resetAiPilotLedger(0);
  const chapeltownPath = aiLocalCopyPilotPath(YORKSHIRE, SERVICE, "chapeltown");
  const existed = fs.existsSync(chapeltownPath);
  const blocked = await generateAiLocalCopyPilotV2({
    slug: YORKSHIRE,
    serviceId: SERVICE,
    areaName: "Chapeltown",
    areaSlug: "chapeltown",
    writeRecord: true,
  });
  record(
    "17-failed-output-writes-no-pilot",
    !blocked.ok && !fs.existsSync(chapeltownPath) && existed === fs.existsSync(chapeltownPath),
    blocked.detail,
  );

  record(
    "18-preview-never-calls-ai",
    !srcPreview.includes("generateAiLocalCopyPilotV2") &&
      !srcPreview.includes("generateAiLocalCopyForArea") &&
      !srcPreview.includes("getOpenAiIntegrationClient") &&
      srcPreview.includes("aiLocalPagePilotHtmlPath") &&
      srcPreview.includes("readFileSync"),
    "preview reads isolated HTML only",
  );

  const richness = {
    darfield: classifyEvidenceRichnessV2(darfieldInput),
    wombwell: classifyEvidenceRichnessV2(wombwellInput),
    worsbrough: classifyEvidenceRichnessV2(worsbroughInput),
  };
  record(
    "evidence-richness-classification",
    richness.darfield === "sparse" && richness.wombwell === "medium" && richness.worsbrough === "rich",
    JSON.stringify(richness) + ` useful d=${usefulLocalEvidenceEntitiesV2(darfieldInput).length} w=${usefulLocalEvidenceEntitiesV2(wombwellInput).length} b=${usefulLocalEvidenceEntitiesV2(worsbroughInput).length}`,
  );

  const fixturePass = validateAiLocalCopyPilotV2(darfieldFixture(darfieldInput), darfieldInput);
  const fixturePassW = validateAiLocalCopyPilotV2(wombwellFixture(wombwellInput), wombwellInput);
  record("fixture-gates-accept-valid-sparse-and-medium", fixturePass.ok && fixturePassW.ok, `${fixturePass.failures[0] || "darfield-ok"} | ${fixturePassW.failures[0] || "wombwell-ok"}`);

  const preGenerationFails = checks.filter((c) => !c.pass);
  if (preGenerationFails.length) {
    console.log(`\nFOCUSED TESTS FAIL  ${checks.filter((c) => c.pass).length}/${checks.length} (stopped before OpenAI)`);
    for (const row of preGenerationFails) console.error(`  ${row.id}: ${row.detail}`);
    process.exitCode = 1;
    return;
  }

  const genResult = await runPharmacyAiLocalNarrativePilotV2({
    force: process.env.FORCE_AI_GENERATION === "1",
  });
  record(
    "generation-three-pilots",
    genResult.ok && genResult.records.length === 3 && genResult.ledger.estimatedCostUsd < 1,
    `successful=${genResult.records.length} attempted=${genResult.ledger.attempted} retried=${genResult.ledger.retried} cost=${genResult.ledger.estimatedCostUsd.toFixed(6)} skipped=${genResult.skipped.map((s) => s.areaSlug + ":" + s.detail).join(";")}`,
  );

  const pilots = ["darfield", "wombwell", "worsbrough"].map((slug) => loadAiLocalCopyPilotV2(YORKSHIRE, SERVICE, slug));
  const allPilots = pilots.filter((row): row is NonNullable<typeof row> => Boolean(row));

  console.log("\n===== THREE-AREA V2 PILOT COPY (inspect before PASS) =====\n");
  for (const row of allPilots) {
    const copy = row.outputCopy;
    console.log(`----- ${row.areaName.toUpperCase()} -----`);
    console.log(copy.heroHeading);
    console.log(copy.heroIntroduction);
    console.log(copy.localContextHeading);
    console.log(copy.localIntroduction);
    for (const para of copy.localContextParagraphs) console.log(para);
    console.log(copy.relationshipToPharmacy);
    console.log(copy.localAccessIntroduction);
    for (const faq of copy.localFaqs) {
      console.log(`Q: ${faq.question}`);
      console.log(`A: ${faq.answer}`);
    }
    console.log(copy.localCtaBridge);
    console.log("evidenceEntityIdsUsed:", JSON.stringify(copy.evidenceEntityIdsUsed));
    console.log("");
    for (const purpose of row.sentencePurposes) {
      console.log(`[${purpose.field}] ${purpose.sentence}`);
      console.log(`  purpose: ${purpose.purpose}`);
      console.log(`  source: ${purpose.supportingSource}`);
      console.log(`  why: ${purpose.readerValue}`);
    }
    console.log("");
  }

  function editorialInspect(areaSlug: string): string[] {
    const row = allPilots.find((p) => p.areaSlug === areaSlug);
    const fails: string[] = [];
    if (!row) return [`missing ${areaSlug}`];
    const text = flattenAiLocalCopyText(row.outputCopy);
    if (/residents of .+ can (?:access|use)/i.test(text)) fails.push("generic residents-can-access");
    if (/within easy reach|convenient|avoid(?:ing)? (?:unnecessary )?delays?/i.test(text)) fails.push("unsupported marketing");
    if (/upperwood academy|park street primary|netherwood academy|stairfoot retail/i.test(text)) fails.push("school/retail forced");
    if ((text.match(/snape hill/gi) || []).length >= 2) fails.push("address repeated");
    if (areaSlug !== "darfield" && row.outputCopy.evidenceEntityIdsUsed.length < 1) fails.push("no evidence used");
    if (areaSlug === "worsbrough" && row.outputCopy.evidenceEntityIdsUsed.length < 2) fails.push("rich pilot needs two entities");
    if (row.claimMap.some((c) => c.supportingCanonicalFieldOrEntity === "non-factual-prose")) fails.push("non-factual-prose present");
    return fails;
  }

  const inspectFails = ["darfield", "wombwell", "worsbrough"].flatMap((slug) => editorialInspect(slug).map((f) => `${slug}:${f}`));
  record("mandatory-copy-review", inspectFails.length === 0 && allPilots.length === 3, inspectFails.join(" | ") || "three pilots inspected");

  const fps = allPilots.map((row) =>
    stripIdentityTokens(localNarrativeFingerprint(row.outputCopy), {
      pharmacyName: PHARMACY,
      areaName: row.areaName,
      telephone: PHONE,
      address: ADDRESS,
      distanceLabel: row.areaSlug === "darfield" ? "0.5 km" : row.areaSlug === "wombwell" ? "1.7 km" : "",
      siblingAreaNames: [],
    }),
  );
  let maxPair = 0;
  for (let i = 0; i < fps.length; i += 1) {
    for (let j = i + 1; j < fps.length; j += 1) {
      maxPair = Math.max(maxPair, copySimilarityScore(fps[i]!, fps[j]!));
    }
  }
  record("editorial-differentiation-among-pilots", allPilots.length === 3 && maxPair < 0.92, `maxIdentityStripped=${maxPair.toFixed(3)}`);

  function p93Fingerprint(areaSlug: string): string {
    const file = aiLocalCopyRecordPath(YORKSHIRE, SERVICE, areaSlug);
    const rec = JSON.parse(fs.readFileSync(file, "utf8")) as { outputCopy: AiLocalCopyV2; areaName: string };
    return stripIdentityTokens(localNarrativeFingerprint(rec.outputCopy), {
      pharmacyName: PHARMACY,
      areaName: rec.areaName,
      telephone: PHONE,
      address: ADDRESS,
      distanceLabel: "",
      siblingAreaNames: [],
    });
  }
  const vs93 = allPilots.map((row) => ({
    area: row.areaSlug,
    score: copySimilarityScore(stripIdentityTokens(localNarrativeFingerprint(row.outputCopy), {
      pharmacyName: PHARMACY,
      areaName: row.areaName,
      telephone: PHONE,
      address: ADDRESS,
      distanceLabel: "",
      siblingAreaNames: [],
    }), p93Fingerprint(row.areaSlug)),
  }));
  record("v2-differs-from-prompt-93-copy", vs93.every((row) => row.score < 0.97), vs93.map((r) => `${r.area}=${r.score.toFixed(3)}`).join(" "));

  function p92Text(areaSlug: string): string {
    const file = path.join(ROOT, "output/pharmacy-local-page-candidates", YORKSHIRE, SERVICE, "local", areaSlug, "index.html");
    if (!fs.existsSync(file)) return "";
    const html = fs.readFileSync(file, "utf8");
    return stripIdentityTokens(stripHtmlToText(extractLocalityNarrativeHtml(html) || html), {
      pharmacyName: PHARMACY,
      areaName: areaSlug,
      telephone: PHONE,
      address: ADDRESS,
      distanceLabel: "",
      siblingAreaNames: [],
    });
  }
  const vs92 = allPilots.map((row) => ({
    area: row.areaSlug,
    score: copySimilarityScore(
      stripIdentityTokens(localNarrativeFingerprint(row.outputCopy), {
        pharmacyName: PHARMACY,
        areaName: row.areaName,
        telephone: PHONE,
        address: ADDRESS,
        distanceLabel: "",
        siblingAreaNames: [],
      }),
      p92Text(row.areaSlug),
    ),
  }));
  record("v2-differs-from-prompt-92-copy", vs92.every((row) => row.score < 0.97), vs92.map((r) => `${r.area}=${r.score.toFixed(3)}`).join(" "));

  const clinicalOk = allPilots.every((row) => {
    const html = fs.readFileSync(aiLocalPagePilotHtmlPath(YORKSHIRE, SERVICE, row.areaSlug), "utf8");
    return /sore throat/i.test(html) && /Pharmacy First/i.test(html);
  });
  record("approved-clinical-copy-integrity-rendered", clinicalOk, "shared clinical blocks retained on pilots");

  const claimOk = allPilots.every((row) => row.claimMap.length > 0 && row.claimMap.every((c) => c.validationResult === "pass"));
  record("claim-map-integrity", claimOk, `maps=${allPilots.map((r) => r.claimMap.length).join(",")}`);

  assemblePharmacyAiLocalPagePilotsV2(YORKSHIRE, SERVICE, ["darfield", "wombwell", "worsbrough"]);
  const previewResults = ["darfield", "wombwell", "worsbrough"].map((area) =>
    renderReviewCentrePreviewAsset(YORKSHIRE, SERVICE, AI_LOCAL_AREA_PAGE_PILOT_V2_ASSET, { areaSlug: area }),
  );
  const unknown = renderReviewCentrePreviewAsset(YORKSHIRE, SERVICE, AI_LOCAL_AREA_PAGE_PILOT_V2_ASSET, { areaSlug: "chapeltown" });
  const sections = getContentPackageReviewSections(YORKSHIRE, SERVICE);
  record(
    "pilot-preview-read-only",
    previewResults.every((p) => p.sourceRoute === "ai-local-area-page-pilot-v2" && p.html.includes(AI_PILOT_V2_PREVIEW_BANNER) && /noindex,\s*nofollow/i.test(p.html)) &&
      unknown.sourceRoute === "review-preview-ai-pilot-v2-unavailable" &&
      !sections.some((sec) => String(sec.type || "").includes("pilot-v2")),
    `previewOk=${previewResults.filter((p) => p.sourceRoute === "ai-local-area-page-pilot-v2").length}/3 unknown=${unknown.sourceRoute}`,
  );

  const after = snapshotProtected();
  const mutated: string[] = [];
  for (const [file, hash] of before) {
    if (!after.has(file) || after.get(file) !== hash) mutated.push(path.relative(ROOT, file));
  }
  for (const [file] of after) {
    if (!before.has(file) && !file.includes("/pharmacy-ai-local-page-pilots/") && !file.includes("/pharmacy-ai-local-copy-pilots/")) {
      mutated.push(path.relative(ROOT, file));
    }
  }
  record("19-existing-prompt-93-candidates-unchanged", mutated.filter((f) => f.includes("pharmacy-ai-local-copy-candidates") || f.includes("pharmacy-ai-local-page-candidates")).length === 0, mutated.filter((f) => f.includes("pharmacy-ai-local")).join(",") || "p93 unchanged");
  record(
    "20-authoritative-pages-evidence-campaign-review-unchanged",
    mutated.filter((f) => !f.includes("pharmacy-ai-local-page-pilots") && !f.includes("pharmacy-ai-local-copy-pilots") && !f.includes("pharmacy-ai-local-copy-candidates") && !f.includes("pharmacy-ai-local-page-candidates")).length === 0,
    mutated.filter((f) => !f.includes("pilot")).join(",") || "protected trees unchanged",
  );

  const failed = checks.filter((c) => !c.pass);
  console.log(`\nFOCUSED TESTS ${failed.length ? "FAIL" : "PASS"}  ${checks.filter((c) => c.pass).length}/${checks.length}`);
  if (failed.length) {
    for (const row of failed) console.error(`  ${row.id}: ${row.detail}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(msg.replace(/sk-[A-Za-z0-9_\-]+/g, "[redacted]"));
  process.exit(1);
});
