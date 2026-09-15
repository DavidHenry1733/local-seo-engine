/**
 * Diagnostic COPY-INSPECTION for isolated AI local-page candidates.
 * Not customer-visible. Claim maps must never appear in customer HTML.
 */
import fs from "node:fs";
import path from "node:path";

import type { AiLocalCopyRecordV1 } from "./pharmacyAiLocalNarrativeEngineV1.ts";
import { buildPharmacyAiLocalCopyInputV1 } from "./pharmacyAiLocalNarrativeEngineV1.ts";
import { copySimilarityScore } from "../pharmacyLocalClusterVariantFamilies.ts";
import { localNarrativeFingerprint } from "./pharmacyAiLocalCopyQualityV1.ts";
import { stripIdentityTokens, LOCALITY_NARRATIVE_SIMILARITY_THRESHOLD } from "./pharmacyLocalPageCandidateUniquenessV1.ts";
import { evaluateGrammarAndFragments, evaluateProhibitedCustomerLanguage } from "./pharmacyLocalCandidateReadabilityV1.ts";
import { flattenAiLocalCopyText } from "./pharmacyAiLocalCopySchemaV1.ts";
import { aiLocalCopyInspectionPath } from "./pharmacyAiLocalPageCandidatePaths.ts";
import { attributableEntities, loadPharmacyLocalEvidencePack } from "./pharmacyLocalEvidencePackContractV1.ts";

function formatCopy(record: AiLocalCopyRecordV1): string {
  const copy = record.outputCopy;
  const faqs = copy.localFaqs.map((faq) => `Q: ${faq.question}\nA: ${faq.answer}`).join("\n\n");
  return [
    `heroHeading: ${copy.heroHeading}`,
    `heroIntroduction: ${copy.heroIntroduction}`,
    `localIntroduction: ${copy.localIntroduction}`,
    `localContextHeading: ${copy.localContextHeading}`,
    ...copy.localContextParagraphs.map((p, i) => `localContextParagraphs[${i}]: ${p}`),
    `relationshipToPharmacy: ${copy.relationshipToPharmacy}`,
    `localAccessIntroduction: ${copy.localAccessIntroduction}`,
    "localFaqs:",
    faqs,
    `localCtaBridge: ${copy.localCtaBridge}`,
  ].join("\n");
}

function whyRetained(name: string, record: AiLocalCopyRecordV1): string {
  const hay = flattenAiLocalCopyText(record.outputCopy);
  const claim = record.claimMap.find((row) => row.exactSentence.toLowerCase().includes(name.toLowerCase()));
  if (claim) return claim.exactSentence;
  if (hay.toLowerCase().includes(name.toLowerCase())) return "named in generated local copy";
  return "listed in evidenceEntityIdsUsed";
}

export function formatAiLocalCopyInspection(opts: {
  slug: string;
  serviceId: string;
  records: AiLocalCopyRecordV1[];
}): string {
  const fingerprints = opts.records.map((record) => {
    const input = buildPharmacyAiLocalCopyInputV1({
      slug: opts.slug,
      serviceId: opts.serviceId,
      areaName: record.areaName,
      areaSlug: record.areaSlug,
      pack: loadPharmacyLocalEvidencePack(opts.slug, record.areaSlug) as never,
    });
    return stripIdentityTokens(localNarrativeFingerprint(record.outputCopy), {
      pharmacyName: input.business.name,
      areaName: input.locality.areaName,
      telephone: input.business.telephone,
      address: input.business.address,
      distanceLabel: input.locality.distanceLabel,
      siblingAreaNames: input.locality.neighbouringSelectedAreas,
    });
  });

  const blocks = opts.records.map((record, index) => {
    const pack = loadPharmacyLocalEvidencePack(opts.slug, record.areaSlug) as never;
    const accepted = attributableEntities(pack);
    const usedNames = accepted.filter((entity) =>
      flattenAiLocalCopyText(record.outputCopy).toLowerCase().includes(entity.name.toLowerCase()),
    );
    const omitted = accepted.filter((entity) => !usedNames.some((u) => u.name === entity.name));
    const hay = flattenAiLocalCopyText(record.outputCopy);
    const grammar = evaluateGrammarAndFragments(hay);
    const prohibited = evaluateProhibitedCustomerLanguage(hay);
    const scores = fingerprints.map((fp, j) =>
      j === index ? 0 : copySimilarityScore(fingerprints[index]!, fp),
    );
    const maxSim = Math.max(0, ...scores);
    const pairIdx = scores.indexOf(maxSim);
    const pair = pairIdx >= 0 && maxSim > 0 ? opts.records[pairIdx]?.areaName : "n/a";
    return [
      `AREA: ${record.areaName} (${record.areaSlug})`,
      "========",
      `promptContract: ${record.promptContractId} ${record.promptContractVersion}`,
      `provider/model: ${record.provider} / ${record.model}`,
      `claim-map: ${record.claimMap.every((row) => row.validationResult === "pass") ? "PASS" : "FAIL"} (${record.claimMap.length} rows)`,
      `validation: ${record.validationResult.ok ? "PASS" : "FAIL"} ${record.validationResult.failures.join("; ")}`,
      `grammar/readability: ${grammar.length || prohibited.length ? "FAIL" : "PASS"} ${(grammar.concat(prohibited)).slice(0, 3).join("; ")}`,
      `locality similarity max: ${maxSim.toFixed(3)} vs ${pair} (threshold ${LOCALITY_NARRATIVE_SIMILARITY_THRESHOLD})`,
      "",
      "COMPLETE AI-GENERATED LOCAL COPY",
      formatCopy(record),
      "",
      "NAMED LOCAL ENTITIES USED",
      usedNames.length
        ? usedNames.map((e) => `- ${e.name} [${e.category}] — ${whyRetained(e.name, record)}`).join("\n")
        : "- none",
      "",
      "EVIDENCE ENTITIES OMITTED",
      omitted.length
        ? omitted.map((e) => `- ${e.name} [${e.category}] — not needed for orientation or healthcare context`).join("\n")
        : "- none",
      "",
    ].join("\n");
  });

  return [
    "Pharmacy First AI local-page candidate copy inspection",
    "Diagnostic only — not customer-visible. Claim maps are internal.",
    `Generated for ${opts.records.length} area(s).`,
    "",
    ...blocks,
  ].join("\n");
}

export function writeAiLocalCopyInspection(slug: string, serviceId: string, records: AiLocalCopyRecordV1[]): string {
  const file = aiLocalCopyInspectionPath(slug, serviceId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, formatAiLocalCopyInspection({ slug, serviceId, records }), "utf8");
  return file;
}
