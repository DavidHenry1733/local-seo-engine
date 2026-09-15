/**
 * Diagnostic copy-inspection artefact for isolated Pharmacy First local-page candidates.
 * Not customer-visible. Used so copy can be reviewed without searching HTML.
 */
import fs from "node:fs";
import path from "node:path";

import {
  extractCustomerVisibleBody,
  extractTemplateBlock,
  stripHtmlToText,
} from "./pharmacyLocalPageCandidateUniquenessV1.ts";
import type { EvidenceEntityOmission, EvidenceEntityUse } from "./pharmacyEvidenceLedLocalNarrativeV1.ts";
import { getLocalPageCandidateRoot } from "./pharmacyLocalPageCandidatePaths.ts";

export const LOCAL_CANDIDATE_COPY_INSPECTION_FILENAME = "COPY-INSPECTION.txt";

export function localCandidateCopyInspectionPath(slug: string, serviceId: string): string {
  return path.join(getLocalPageCandidateRoot(slug, serviceId), LOCAL_CANDIDATE_COPY_INSPECTION_FILENAME);
}

function paragraphsIn(html: string): string[] {
  return [...String(html || "").matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => stripHtmlToText(m[1] || "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function faqsIn(html: string): Array<{ question: string; answer: string }> {
  const faq = extractTemplateBlock(html, "faq");
  const items = [...faq.matchAll(/<div class="cluster-faq-item[\s\S]*?<\/div>/gi)].map((m) => m[0]);
  return items.map((item) => ({
    question: stripHtmlToText(item.match(/<h3 class="faq-q">([\s\S]*?)<\/h3>/i)?.[1] || "").trim(),
    answer: stripHtmlToText(item.match(/<p class="faq-a">([\s\S]*?)<\/p>/i)?.[1] || "").trim(),
  })).filter((row) => row.question || row.answer);
}

function ctaCopy(html: string): string[] {
  const hero = extractTemplateBlock(html, "hero");
  const finalCta = extractTemplateBlock(html, "final-cta");
  const access = extractTemplateBlock(html, "local");
  const labels = [...`${hero}\n${finalCta}\n${access}`.matchAll(/<a class="btn[^"]*"[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((m) => stripHtmlToText(m[1] || "").trim())
    .filter(Boolean);
  const closes = paragraphsIn(finalCta).filter((p) => /call\b|\b01226\b|contact|book|appointment|directions/i.test(p));
  return [...new Set([...labels, ...closes])];
}

export type CopyInspectionAreaInput = {
  areaName: string;
  areaSlug: string;
  html: string;
  mentionedEntities: EvidenceEntityUse[];
  omittedEntities: EvidenceEntityOmission[];
};

export function formatLocalCandidateCopyInspection(areas: CopyInspectionAreaInput[]): string {
  const blocks = areas.map((area) => {
    const hero = extractTemplateBlock(area.html, "hero");
    const definition = extractTemplateBlock(area.html, "service-definition");
    const access = extractTemplateBlock(area.html, "local");
    const heroCopy = paragraphsIn(hero).join("\n");
    const localParas = [
      ...paragraphsIn(definition),
      ...paragraphsIn(access).filter((p) => /local-intro-lead|local-access/i.test(access) || true),
    ];
    const accessLead = stripHtmlToText(
      access.match(/<p class="local-intro-lead">([\s\S]*?)<\/p>/i)?.[1] || "",
    ).trim();
    const faqLines = faqsIn(area.html)
      .map((faq) => `Q: ${faq.question}\nA: ${faq.answer}`)
      .join("\n\n");
    const mentioned = area.mentionedEntities.length
      ? area.mentionedEntities.map((e) => `- ${e.name} [${e.category}] — ${e.patientValue}`).join("\n")
      : "- none";
    const omitted = area.omittedEntities.length
      ? area.omittedEntities.map((e) => `- ${e.name} [${e.category}] — ${e.reason}`).join("\n")
      : "- none";
    return [
      `AREA: ${area.areaName} (${area.areaSlug})`,
      "========",
      "HERO",
      heroCopy || "(none)",
      "",
      "LOCAL-SPECIFIC PARAGRAPHS",
      localParas.map((p, i) => `${i + 1}. ${p}`).join("\n") || "(none)",
      "",
      "LOCAL ACCESS",
      accessLead || paragraphsIn(access).join("\n") || "(none)",
      "",
      "LOCAL FAQS",
      faqLines || "(none)",
      "",
      "CTA COPY",
      ctaCopy(area.html).map((c) => `- ${c}`).join("\n") || "(none)",
      "",
      "EVIDENCE ENTITIES MENTIONED",
      mentioned,
      "",
      "EVIDENCE ENTITIES OMITTED",
      omitted,
      "",
    ].join("\n");
  });
  return [
    "Pharmacy First isolated local-page candidate copy inspection",
    "Diagnostic only — not customer-visible.",
    `Generated for ${areas.length} area(s).`,
    "",
    ...blocks,
  ].join("\n");
}

export function writeLocalCandidateCopyInspection(
  slug: string,
  serviceId: string,
  areas: CopyInspectionAreaInput[],
): string {
  const file = localCandidateCopyInspectionPath(slug, serviceId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, formatLocalCandidateCopyInspection(areas), "utf8");
  return file;
}

void extractCustomerVisibleBody;
