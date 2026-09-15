import fs from "node:fs";
import path from "node:path";
import {
  buildPharmacyAiLocalCopyInputV3,
  generateAiLocalCopyPilotV3,
  getAiPilotLedgerV3,
  hydrateOpenAiEnvIfNeeded,
  loadAiLocalCopyPilotV3,
  resetAiPilotLedgerV3,
} from "/home/inboxingproweb/pharmaconnect-growth-engine/src/pharmacy/contentEngine/pharmacyAiLocalNarrativeEngineV3.ts";
import { formatCustomerFacingLocalCopyV3, localNarrativeFingerprint } from "/home/inboxingproweb/pharmaconnect-growth-engine/src/pharmacy/contentEngine/pharmacyAiLocalCopyQualityV1.ts";
import { stripIdentityTokens } from "/home/inboxingproweb/pharmaconnect-growth-engine/src/pharmacy/contentEngine/pharmacyLocalPageCandidateUniquenessV1.ts";
import { loadEditorialEvidencePack } from "/home/inboxingproweb/pharmaconnect-growth-engine/src/pharmacy/contentEngine/pharmacyLocalEditorialEvidenceCollectorV3.ts";
import { hashFileSha256 } from "/home/inboxingproweb/pharmaconnect-growth-engine/src/pharmacy/contentEngine/pharmacyAiLocalNarrativeEngineV1.ts";
import type { EditorialFactV3 } from "/home/inboxingproweb/pharmaconnect-growth-engine/src/pharmacy/contentEngine/pharmacyLocalEditorialEvidenceContractV3.ts";

const ROOT = "/home/inboxingproweb/pharmaconnect-growth-engine";
const SLUG = "yorkshire-pharmacy-and-health-clinic";
const SERVICE = "pharmacy-first";
const TASK_BUDGET = 0.2;
const ORIGINAL_PACK = path.join(ROOT, "data/pharmacy-local-editorial-evidence-pilots", SLUG, SERVICE, "v3/wombwell.json");
const SUPPLEMENT_PATH = path.join(
  ROOT,
  "data/pharmacy-local-editorial-research-supplements",
  SLUG,
  SERVICE,
  "v3/wombwell/2026-09-01-local-editorial-copy-research.json",
);
const COMPLETE_PILOT_PATH = path.join(
  ROOT,
  "data/pharmacy-local-editorial-research-supplements",
  SLUG,
  SERVICE,
  "v3/wombwell/2026-09-01-complete-pilot.json",
);
const OUT = "/tmp/wombwell-complete-from-saved-generate-result.json";

async function main() {
  process.chdir(ROOT);
  const openai = hydrateOpenAiEnvIfNeeded();
  if (!openai.ok) throw new Error(openai.detail);
  const original = loadEditorialEvidencePack(SLUG, SERVICE, "wombwell");
  if (!original) throw new Error("missing original pack");
  const originalPackHash = hashFileSha256(ORIGINAL_PACK);
  const supplement = JSON.parse(fs.readFileSync(SUPPLEMENT_PATH, "utf8")) as Record<string, unknown> & {
    retrievedPages?: Array<{ requestedUrl?: string; textSample?: string; wombwellWardSection?: string }>;
  };
  const completePilot = JSON.parse(fs.readFileSync(COMPLETE_PILOT_PATH, "utf8")) as {
    extractedFacts?: EditorialFactV3[];
    newFacts?: EditorialFactV3[];
  };
  const wardPage = (supplement.retrievedPages || []).find((page) => String(page.requestedUrl || "").includes("ward-profiles"));
  const wardHay = `${wardPage?.textSample || ""} ${wardPage?.wombwellWardSection || ""}`;
  const wardStatVerification = {
    sourceUrl: "https://www.barnsley.gov.uk/services/council-and-democracy/research-data-and-statistics/ward-profiles/",
    retrievedAt: "2026-09-01T12:07:52.384Z",
    restoredAt: "2026-09-01T12:09:10.723Z",
    geography: "Wombwell ward, compared with Barnsley borough and national averages",
    populationStatement: "11,477 people live in Wombwell, or 5% of Barnsley’s total population",
    populationDenominator: "Barnsley total population",
    employmentStatement: "Wholesale and retail trades employ the most workers at 19.8%, followed by construction at 13.2%",
    employmentDenominator: "workers in the Wombwell ward (source later refers to working adults for a related occupation share)",
    referenceYearInSavedBody: null,
    censusOrOnsVintageInSavedBody: false,
    dashboardNotePresent: /interactive dashboard/i.test(wardHay),
    omittedFromThisGeneration: true,
    reason:
      "The saved official page does not state a census year, publication date or ONS vintage. It points readers to an interactive dashboard for up-to-date information. Retrieval on 2026-09-01 is not a reference year. The statistics are omitted rather than described as current.",
  };
  const extra = [...(completePilot.extractedFacts || []), ...(completePilot.newFacts || [])].filter((fact) => {
    if (fact.validationStatus !== "accepted") return false;
    if (/south area council/i.test(fact.normalizedStatement)) return false;
    if (/11,477|19\.8%|13\.2%|semi-detached/i.test(fact.normalizedStatement)) return false;
    return /public library|metropolitan borough of barnsley/i.test(fact.normalizedStatement);
  });
  const seen = new Set(original.facts.map((f) => f.factId));
  const newFacts: EditorialFactV3[] = [];
  for (const fact of extra) {
    if (seen.has(fact.factId)) continue;
    if (newFacts.some((row) => row.normalizedStatement === fact.normalizedStatement)) continue;
    seen.add(fact.factId);
    newFacts.push(fact);
  }
  const mergedFacts = [...original.facts, ...newFacts];
  supplement.wardStatVerification = wardStatVerification;
  supplement.thisGenerationOmittedUndatedWardStatistics = true;
  supplement.thisGenerationFacts = mergedFacts.map((f) => f.normalizedStatement);
  fs.writeFileSync(SUPPLEMENT_PATH, `${JSON.stringify(supplement, null, 2)}\n`);

  const editorial = { ...original, facts: mergedFacts };
  const darfield = loadAiLocalCopyPilotV3(SLUG, SERVICE, "darfield");
  const previousFingerprints: string[] = [];
  if (darfield) {
    const input = buildPharmacyAiLocalCopyInputV3({
      slug: SLUG,
      serviceId: SERVICE,
      areaName: "Darfield",
      areaSlug: "darfield",
      editorial: loadEditorialEvidencePack(SLUG, SERVICE, "darfield")!,
    });
    previousFingerprints.push(
      stripIdentityTokens(localNarrativeFingerprint(darfield.outputCopy), {
        pharmacyName: input.business.name,
        areaName: input.locality.areaName,
        telephone: input.business.telephone,
        address: input.business.address,
        distanceLabel: input.locality.distanceLabel,
        siblingAreaNames: input.locality.neighbouringSelectedAreas,
      }),
    );
  }

  resetAiPilotLedgerV3(0.026946);
  const generated = await generateAiLocalCopyPilotV3({
    slug: SLUG,
    serviceId: SERVICE,
    areaName: "Wombwell",
    areaSlug: "wombwell",
    previousFingerprints,
    writeRecord: false,
    maxCostUsd: TASK_BUDGET,
    maxAttempts: 2,
    editorial,
    varietyHints: [
      "Write a recognisable Wombwell setting, not a statistical profile. Choose two or three useful supplied details and omit the rest. Do not list a library, surgery and employment facts together. Do not invent residents’ habits, health needs or referral relationships. Do not write that the library is a familiar spot, that many residents use it, or that the area has a distinct character.",
      "The Barnsley Council ward profile retrieved on 1 September 2026 does not state a census year or ONS vintage. Omit 11,477, 5%, employment percentages and housing-mix figures. Do not call them current. Do not use coal-mining history. Do not force the National Rail station. Do not write community resources, local amenities, or that the area is recognised for something.",
      "Useful details you may weave: Wombwell is a ward in the Metropolitan Borough of Barnsley; Wombwell has a public library; NHS general practice services in Wombwell are provided from Wombwell Medical Centre. Name the Medical Centre only as that GP setting. Name Darfield once in relationshipToPharmacy. Say eligible common conditions. Keep optional fields empty when they add nothing.",
    ],
  });
  const ledger = getAiPilotLedgerV3();
  const payload = {
    ok: generated.ok,
    originalPackHash,
    originalPackUnchanged: hashFileSha256(ORIGINAL_PACK) === originalPackHash,
    wardStatVerification,
    newFactStatements: newFacts.map((f) => f.normalizedStatement),
    mergedFactStatements: editorial.facts.map((f) => f.normalizedStatement),
    ledger,
    remainingUsd: TASK_BUDGET - ledger.estimatedCostUsd,
    attemptLogPaths: generated.attemptLogPaths,
    detail: generated.ok ? undefined : generated.detail,
    failures: generated.ok ? [] : generated.failures,
    formatted: generated.ok
      ? formatCustomerFacingLocalCopyV3(generated.record.outputCopy)
      : generated.copy
        ? formatCustomerFacingLocalCopyV3(generated.copy)
        : "",
    copy: generated.ok ? generated.record.outputCopy : generated.copy,
    claimMap: generated.ok ? generated.record.claimMap : [],
    sentencePurposes: generated.ok ? generated.record.sentencePurposes : [],
    repetitionAnalysis: generated.ok ? generated.record.repetitionAnalysis : null,
    generatedAt: generated.ok ? generated.record.generatedAt : null,
    tokenUsage: generated.ok ? generated.record.tokenUsage : null,
    estimatedCostUsd: generated.ok ? generated.record.estimatedCostUsd : null,
    raw: generated.ok ? generated.record.rawOpenAiResponse : generated.raw,
    raws: generated.ok ? generated.record.rawOpenAiResponses : undefined,
    record: generated.ok ? generated.record : null,
  };
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2));
  console.log(
    JSON.stringify(
      {
        ok: generated.ok,
        originalPackUnchanged: payload.originalPackUnchanged,
        omittedStats: wardStatVerification.omittedFromThisGeneration,
        mergedFactStatements: payload.mergedFactStatements,
        ledger,
        attemptLogPaths: generated.attemptLogPaths,
        failures: payload.failures,
        formatted: payload.formatted,
      },
      null,
      2,
    ),
  );
  if (!generated.ok) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
