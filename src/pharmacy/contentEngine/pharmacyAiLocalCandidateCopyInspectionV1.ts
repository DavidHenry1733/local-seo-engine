/**
 * Diagnostic copy-inspection artefact for isolated AI local-page candidates.
 */
import fs from "node:fs";
import path from "node:path";

import {
  extractCustomerVisibleBody,
  extractTemplateBlock,
  stripHtmlToText,
} from "./pharmacyLocalPageCandidateUniquenessV1.ts";
import { attributableEntities, type PharmacyLocalEvidencePackV3 } from "./pharmacyLocalEvidencePackContractV1.ts";
import { evidenceEntityId } from "./pharmacyAiLocalCopyClaimGroundingV1.ts";
import type { AiLocalCopyRecordV1 } from "./pharmacyAiLocalNarrativeEngineV1.ts";
import { aiLocalCopyInspectionPath } from "./pharmacyAiLocalPageCandidatePaths.ts";
import { evaluateAiLocalCopyQualityV1 } from "./pharmacyAiLocalCopyQualityV1.ts";
import { buildPharmacyAiLocalCopyInputV1 } from "./pharmacyAiLocalNarrativeEngineV1.ts";

function paragraphsIn(html: string): string[] {
  return [...String(html || "").matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => stripHtmlToText(m[1] || "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function faqsIn(html: string): Array<{ question: string; answer: string }> {
  const faq = extractTemplateBlock(html, "faq");
  const items = [...faq.matchAll(/<div class="cluster-faq-item[\s\S]*?<\/div>/gi)].map((m) => m[0]);
  return items
    .map((item) => ({
      question: stripHtmlToText(item.match(/<h3 class="faq-q">([\s\S]*?)<\/h3>/i)?.[1] || "").trim(),
      answer: stripHtmlToText(item.match(/<p class="faq-a">([\s\S]*?)<\/p>/i)?.[1] || "").trim(),
    }))
    .filter((row) => row.question || row.answer);
}

export type AiCopyInspectionAreaInput = {
  areaName: string;
  areaSlug: string;
  html: string;
  record: AiLocalCopyRecordV1;
  pack: PharmacyLocalEvidencePackV3 | null;
};

export function formatAiLocalCandidateCopyInspection(
  slug: string,
  serviceId: string,
  areas: AiCopyInspectionAreaInput[],
): string {
  const blocks = areas.map((area) => {
    const copy = area.record.outputCopy;
    const packEntities = area.pack ? attributableEntities(area.pack) : [];
    const usedIds = new Set(copy.evidenceEntityIdsUsed);
    const mentioned = packEntities.filter((e) => usedIds.has(evidenceEntityId(e.name, e.category)));
    const omitted = packEntities.filter((e) => !usedIds.has(evidenceEntityId(e.name, e.category)));
    const input = area.pack
      ? buildPharmacyAiLocalCopyInputV1({
          slug,
          serviceId,
          areaName: area.areaName,
          areaSlug: area.areaSlug,
          pack: area.pack,
        })
      : null;
    const quality = input ? evaluateAiLocalCopyQualityV1(copy, input) : { ok: false, failures: ["missing pack"] };
    const claimFail = area.record.claimMap.filter((row) => row.validationResult !== "pass");
    return [
      `AREA: ${area.areaName} (${area.areaSlug})`,
      "========",
      "AI-GENERATED LOCAL COPY",
      `heroHeading: ${copy.heroHeading}`,
      `heroIntroduction: ${copy.heroIntroduction}`,
      `localContextHeading: ${copy.localContextHeading}`,
      `localIntroduction: ${copy.localIntroduction}`,
      ...copy.localContextParagraphs.map((p, i) => `localContextParagraphs[${i}]: ${p}`),
      `relationshipToPharmacy: ${copy.relationshipToPharmacy}`,
      `localAccessIntroduction: ${copy.localAccessIntroduction}`,
      `localCtaBridge: ${copy.localCtaBridge}`,
      "",
      "LOCAL FAQS",
      copy.localFaqs.map((faq) => `Q: ${faq.question}\nA: ${faq.answer}`).join("\n\n"),
      "",
      "RENDERED HERO",
      paragraphsIn(extractTemplateBlock(area.html, "hero")).join("\n") || "(none)",
      "",
      "RENDERED LOCAL ACCESS",
      stripHtmlToText(extractTemplateBlock(area.html, "local").match(/<p class="local-intro-lead">([\s\S]*?)<\/p>/i)?.[1] || "").trim(),
      "",
      "RENDERED FAQS (first local)",
      faqsIn(area.html)
        .slice(0, 5)
        .map((faq) => `Q: ${faq.question}\nA: ${faq.answer}`)
        .join("\n\n"),
      "",
      "EVIDENCE ENTITIES USED",
      mentioned.length
        ? mentioned.map((e) => `- ${e.name} [${e.category}] — useful orientation or healthcare context`).join("\n")
        : "- none",
      "",
      "EVIDENCE ENTITIES OMITTED",
      omitted.length ? omitted.map((e) => `- ${e.name} [${e.category}]`).join("\n") : "- none",
      "",
      `CLAIM-MAP: ${claimFail.length ? "FAIL" : "PASS"} (${area.record.claimMap.length} sentences)`,
      claimFail.length ? claimFail.map((row) => `- ${row.detail || row.exactSentence}`).join("\n") : "",
      `GRAMMAR/READABILITY: ${quality.ok ? "PASS" : "FAIL"} ${quality.failures.slice(0, 4).join(" | ")}`,
      "",
    ].join("\n");
  });
  return [
    "Pharmacy First isolated AI local-page candidate copy inspection",
    "Diagnostic only — not customer-visible.",
    `Generated for ${areas.length} area(s).`,
    "",
    ...blocks,
  ].join("\n");
}

export function writeAiLocalCandidateCopyInspection(
  slug: string,
  serviceId: string,
  areas: AiCopyInspectionAreaInput[],
): string {
  const file = aiLocalCopyInspectionPath(slug, serviceId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, formatAiLocalCandidateCopyInspection(slug, serviceId, areas), "utf8");
  return file;
}

void extractCustomerVisibleBody;
void path;
