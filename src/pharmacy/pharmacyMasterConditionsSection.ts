/**
 * Pharmacy First conditions — renderer binding from canonical master section 2.
 * Does not rewrite clinical master content.
 */
import type { MasterLibrarySection } from "./pharmacyMasterLibraryParser.ts";
import type { PharmacyServicePageProfile } from "./pharmacyServicePageProfileContext.ts";
import { renderBalancedCardGrid, splitSentences, type ContentCard } from "./pharmacyServicePageBalance.ts";
import { localiseServicePageBodyText } from "./pharmacyServicePageBodyLocalisation.ts";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderSectionHead(title: string, intro = ""): string {
  return `<div class="section-head">${title ? `<h2>${esc(title)}</h2>` : ""}${intro ? `<p>${esc(intro)}</p>` : ""}</div>`;
}

function cleanConditionTitle(raw: string): string {
  return raw
    .replace(/^\d+(?:\.\d+)?\s+/, "")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function extractDescriptionParagraph(block: string): string {
  const match = block.match(/\*\*Description:\*\*\s*\n([\s\S]*?)(?=\n\*\*|$)/i);
  if (match?.[1]) {
    return match[1]
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .join(" ");
  }
  const lines = block
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && !line.startsWith("---"));
  return lines.slice(1).join(" ").trim();
}

function extractConditionCards(bodyMarkdown: string): ContentCard[] {
  const chunks = bodyMarkdown.split(/\n(?=###\s+\d+\.\d+\s+)/).filter(Boolean);
  const cards: ContentCard[] = [];
  for (const chunk of chunks) {
    const headingMatch = chunk.match(/^###\s+\d+(?:\.\d+)?\s+(.+)$/m);
    if (!headingMatch?.[1]) continue;
    const title = cleanConditionTitle(headingMatch[1]);
    const body = extractDescriptionParagraph(chunk);
    if (title && body) cards.push({ title, body });
  }
  return cards.slice(0, 7);
}

function conciseBody(body: string, maxSentences = 2): string {
  const sentences = splitSentences(body.replace(/\*\*/g, ""));
  return sentences.slice(0, maxSentences).join(" ").trim();
}

export function renderPharmacyFirstConditionsSection(
  sections: MasterLibrarySection[],
  profile: PharmacyServicePageProfile,
  serviceName: string,
): string {
  const section = sections.find((s) => s.number === 2);
  if (!section?.bodyMarkdown.trim()) return "";

  const loc = (text: string) =>
    localiseServicePageBodyText(text, profile, serviceName, profile.privateServicesAvailable);

  const cards = extractConditionCards(section.bodyMarkdown).map((card) => ({
    title: loc(card.title),
    body: conciseBody(loc(card.body), 2),
  }));

  if (!cards.length) return "";

  return `<section id="conditions-grid" class="soft" data-template-block="conditions">
<div class="wrap">
${renderSectionHead(section.heading, "The pharmacist will confirm whether your symptoms fit an NHS Pharmacy First pathway before any treatment is supplied.")}
${renderBalancedCardGrid(cards, { cols: 3, gridClass: "conditions-grid", maxSentences: 2 })}
</div>
</section>`;
}
