import fs from "node:fs";
import path from "node:path";

import { assemblePharmacyAiLocalPagePilotsV3 } from "/home/inboxingproweb/pharmaconnect-growth-engine/src/pharmacy/pharmacyAiLocalPagePilotAssemblerV3.ts";
import {
  AI_LOCAL_NARRATIVE_PROVIDER_V3,
  AI_LOCAL_NARRATIVE_MODEL_V3,
  buildPharmacyAiLocalCopyInputV3,
  validateAiLocalCopyPilotV3,
} from "/home/inboxingproweb/pharmaconnect-growth-engine/src/pharmacy/contentEngine/pharmacyAiLocalNarrativeEngineV3.ts";
import {
  AI_LOCAL_NARRATIVE_PROMPT_CONTRACT_ID_V3,
  AI_LOCAL_NARRATIVE_PROMPT_CONTRACT_PATH,
  AI_LOCAL_NARRATIVE_PROMPT_VERSION_V3,
} from "/home/inboxingproweb/pharmaconnect-growth-engine/src/pharmacy/contentEngine/pharmacyAiLocalNarrativePromptContractV1.ts";
import { loadEditorialEvidencePack } from "/home/inboxingproweb/pharmaconnect-growth-engine/src/pharmacy/contentEngine/pharmacyLocalEditorialEvidenceCollectorV3.ts";
import { hashFileSha256, estimateGpt41CostUsd } from "/home/inboxingproweb/pharmaconnect-growth-engine/src/pharmacy/contentEngine/pharmacyAiLocalNarrativeEngineV1.ts";
import { localEvidencePackPath } from "/home/inboxingproweb/pharmaconnect-growth-engine/src/pharmacy/contentEngine/pharmacyLocalEvidencePackContractV1.ts";
import { aiLocalCopyPilotPath, AI_LOCAL_PILOT_CONTRACT_VERSION_V3 } from "/home/inboxingproweb/pharmaconnect-growth-engine/src/pharmacy/contentEngine/pharmacyAiLocalPageCandidatePaths.ts";
import type { EditorialFactV3 } from "/home/inboxingproweb/pharmaconnect-growth-engine/src/pharmacy/contentEngine/pharmacyLocalEditorialEvidenceContractV3.ts";
import type { AiLocalCopyV3 } from "/home/inboxingproweb/pharmaconnect-growth-engine/src/pharmacy/contentEngine/pharmacyAiLocalCopySchemaV1.ts";

const ROOT = "/home/inboxingproweb/pharmaconnect-growth-engine";
const SLUG = "yorkshire-pharmacy-and-health-clinic";
const SERVICE = "pharmacy-first";
const ORIGINAL_PACK = path.join(ROOT, "data/pharmacy-local-editorial-evidence-pilots", SLUG, SERVICE, "v3/wombwell.json");
const RESEARCH = path.join(
  ROOT,
  "data/pharmacy-local-editorial-research-supplements",
  SLUG,
  SERVICE,
  "v3/wombwell/2026-09-01-live-page-research.json",
);
const GENERATE = path.join(
  ROOT,
  "data/pharmacy-ai-local-copy-diagnostics",
  SLUG,
  SERVICE,
  "v3/wombwell/2026-09-01-live-page/generate-result.json",
);
const DECISIONS = path.join(
  ROOT,
  "data/pharmacy-ai-local-copy-diagnostics",
  SLUG,
  SERVICE,
  "v3/wombwell/2026-09-01-live-page/review-decisions.json",
);
const ATTEMPT1 =
  "/home/inboxingproweb/pharmaconnect-growth-engine/data/pharmacy-ai-local-copy-attempt-logs/yorkshire-pharmacy-and-health-clinic/pharmacy-first/v3/wombwell/2026-09-01T14-21-14-373Z-attempt-1.json";
const ATTEMPT2 =
  "/home/inboxingproweb/pharmaconnect-growth-engine/data/pharmacy-ai-local-copy-attempt-logs/yorkshire-pharmacy-and-health-clinic/pharmacy-first/v3/wombwell/2026-09-01T14-21-19-136Z-attempt-2.json";

const operatorReview = {
  automatedOk: false,
  proseEdited: false,
  wordListAdded: false,
  unresolvedFactualClaims: [],
  decisions: [
    {
      finding:
        "REVIEW REQUIRED | field=heroIntroduction | unmatched wording (who)",
      sentence:
        "Pharmacy First is available to people in Wombwell who need NHS advice or treatment for eligible common conditions.",
      exactSourcePassages: [
        "Locked clinical / offer: Pharmacy First can help with eligible common conditions. Eligibility depends on symptoms and NHS pathway criteria, not on the area the patient travels from.",
        "Prompt allowance: You may say Pharmacy First can help with eligible common conditions.",
      ],
      leftoverToken: "who",
      decision: "accept",
      reason:
        "The leftover token is a relative pronoun. It does not add a local fact, waiting time, GP-referral, travel or occupancy claim. The sentence stays within permitted Pharmacy First / eligible common conditions framing.",
    },
    {
      finding:
        "REVIEW REQUIRED | field=localContextParagraphs[0] | unmatched wording (holds)",
      sentence: "Citizens Advice also holds advice and welfare rights drop-in sessions at the library.",
      exactSourcePassages: [
        "Saved barnsley.gov.uk Wombwell Library body (retrieved 2026-09-01T11:22:31.612Z): 'Citizens Advice run advice and welfare rights drop in sessions.'",
        "Accepted fact: 'Citizens Advice runs advice and welfare rights drop-in sessions at Wombwell Library.'",
      ],
      leftoverToken: "holds",
      decision: "accept",
      reason:
        "'holds' paraphrases the official 'run'/'runs' drop-in sessions. 'the library' is Wombwell Library, named in the previous sentence. This is not a new factual claim and does not invent attendance or a pharmacy relationship.",
    },
  ],
  completeProseRead: true,
  otherCheckedClaims: [
    {
      sentence: "Wombwell is in the Metropolitan Borough of Barnsley, South Yorkshire.",
      source: "barnsley.gov.uk Wombwell Library page; accepted fact",
      decision: "pass",
    },
    {
      sentence: "Wombwell Library hosts local history sessions run by Wombwell Heritage Group.",
      source: "barnsley.gov.uk: 'Local history sessions run by Wombwell Heritage Group.'",
      decision: "pass",
    },
    {
      sentence:
        "Artwork at Wombwell station refers to the Roly Poly Hill and Wishing Tree at Wombwell Park, and features the Wombwell unicorn emblem.",
      source:
        "travelsouthyorkshire.com 2026-09-01T14:18:05.581Z: 'Featuring the distinctive Wombwell “unicorn” emblem and references to the Roly Poly Hill and Wishing Tree at Wombwell Park'",
      decision: "pass",
    },
    {
      sentence: "Wombwell has a National Rail station.",
      source: "nationalrail.co.uk/stations/wombwell/",
      decision: "pass",
    },
    {
      sentence: "Consultations take place at Yorkshire Pharmacy & Health Clinic in Darfield.",
      source: "canonical premises locality Darfield; 91 Snape Hill Rd, Darfield",
      decision: "pass",
    },
  ],
  omittedAsUnsupported: [
    "Wombwell is a village (car-park news refers to Barnsley's towns and villages generally, not Wombwell's settlement type).",
    "Undated ward-profile statistics (11,477, employment shares, housing mix) — no census year in the saved body.",
    "South Area Council administrative padding.",
    "Coal mining / colliery history — no usable official body after Historic England 403.",
  ],
  operatorAcceptedForCandidateRender: true,
  awaitingProductOwnerVisualReview: true,
  approved: false,
};

async function main() {
  process.chdir(ROOT);
  const originalPackHash = hashFileSha256(ORIGINAL_PACK);
  const generate = JSON.parse(fs.readFileSync(GENERATE, "utf8")) as {
    copy: AiLocalCopyV3;
    raw: string;
    openaiLedger: { promptTokens: number; completionTokens: number; estimatedCostUsd: number };
    mergedFactStatements: string[];
  };
  const research = JSON.parse(fs.readFileSync(RESEARCH, "utf8")) as {
    savedLibraryReuse: { facts: EditorialFactV3[] };
    tsyFactsFromSavedBody?: EditorialFactV3[];
  };
  const original = loadEditorialEvidencePack(SLUG, SERVICE, "wombwell");
  if (!original) throw new Error("missing original pack");
  const extra = [...(research.savedLibraryReuse.facts || []), ...(research.tsyFactsFromSavedBody || [])];
  const seen = new Set(original.facts.map((f) => f.normalizedStatement));
  const mergedFacts = [...original.facts];
  for (const fact of extra) {
    if (fact.validationStatus !== "accepted") continue;
    if (seen.has(fact.normalizedStatement)) continue;
    if (/south area council|is a village|11,477|19\.8%|13\.2%|semi-detached/i.test(fact.normalizedStatement)) continue;
    seen.add(fact.normalizedStatement);
    mergedFacts.push(fact);
  }
  const editorial = { ...original, facts: mergedFacts };
  const input = buildPharmacyAiLocalCopyInputV3({
    slug: SLUG,
    serviceId: SERVICE,
    areaName: "Wombwell",
    areaSlug: "wombwell",
    editorial,
  });
  const validated = validateAiLocalCopyPilotV3(generate.copy, input, editorial.facts, []);
  if (validated.failures.length) {
    throw new Error(`unexpected FAIL after operator review gate: ${validated.failures.join(" | ")}`);
  }
  fs.writeFileSync(DECISIONS, `${JSON.stringify(operatorReview, null, 2)}\n`);

  const attempt1 = JSON.parse(fs.readFileSync(ATTEMPT1, "utf8")) as { rawResponse: string };
  const attempt2 = JSON.parse(fs.readFileSync(ATTEMPT2, "utf8")) as { rawResponse: string };
  const record = {
    promptContractId: AI_LOCAL_NARRATIVE_PROMPT_CONTRACT_ID_V3,
    promptContractVersion: AI_LOCAL_NARRATIVE_PROMPT_VERSION_V3,
    promptContractPath: AI_LOCAL_NARRATIVE_PROMPT_CONTRACT_PATH,
    provider: AI_LOCAL_NARRATIVE_PROVIDER_V3,
    model: AI_LOCAL_NARRATIVE_MODEL_V3,
    generatedAt: "2026-09-01T14:21:19.136Z",
    tokenUsage: {
      promptTokens: generate.openaiLedger.promptTokens,
      completionTokens: generate.openaiLedger.completionTokens,
      totalTokens: generate.openaiLedger.promptTokens + generate.openaiLedger.completionTokens,
    },
    estimatedCostUsd: estimateGpt41CostUsd(generate.openaiLedger.promptTokens, generate.openaiLedger.completionTokens),
    inputEvidencePackHash: hashFileSha256(localEvidencePackPath(SLUG, "wombwell")),
    editorialEvidencePackHash: originalPackHash,
    areaSlug: "wombwell",
    areaName: "Wombwell",
    editorialFactIdsUsed: generate.copy.editorialFactIdsUsed,
    outputCopy: generate.copy,
    claimMap: validated.claims,
    sentencePurposes: validated.sentencePurposes,
    repetitionAnalysis: validated.repetitionAnalysis,
    validationResult: {
      ok: true,
      failures: [],
      automatedReviews: validated.reviews,
      operatorReview,
    },
    reviewStatus: "candidate",
    approved: false,
    rawOpenAiResponse: attempt2.rawResponse || generate.raw,
    rawOpenAiResponses: [attempt1.rawResponse, attempt2.rawResponse],
  };

  const file = aiLocalCopyPilotPath(SLUG, SERVICE, "wombwell", AI_LOCAL_PILOT_CONTRACT_VERSION_V3);
  if (file.includes("/pharmacy-ai-local-copy-candidates/") || file.includes("/v2/")) {
    throw new Error("refusing to write a v3 pilot into v1/v2 paths");
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(record, null, 2), "utf8");

  const assembled = assemblePharmacyAiLocalPagePilotsV3(SLUG, SERVICE, ["wombwell"]);
  const afterPack = hashFileSha256(ORIGINAL_PACK);
  console.log(
    JSON.stringify(
      {
        wrote: file,
        originalPackUnchanged: afterPack === originalPackHash,
        assembled,
        automatedFailures: validated.failures,
        automatedReviews: validated.reviews,
        operatorAccepted: true,
      },
      null,
      2,
    ),
  );
  if (!assembled.ok) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
