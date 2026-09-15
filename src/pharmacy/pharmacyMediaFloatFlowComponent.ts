/**
 * Reusable media-float-flow section — proven wrap-around layout (figure-first DOM order).
 * Previous working source: pharmacyLocalClusterPageRenderer.ts → renderMediaFloatSection()
 * with body[data-split-composition="media-float-flow"] float CSS in pharmacyComponentDnaLayoutCss.ts
 */
import type { MediaTextLayoutThresholds, MediaTextLayoutVariant } from "./pharmacyMediaTextLayoutResolver.ts";
import {
  countWords,
  resolveMediaTextLayout,
  splitParagraphsForMediaLayout,
} from "./pharmacyMediaTextLayoutResolver.ts";

export interface MediaTextPartitionInput {
  paragraphs: string[];
  lists?: string[][];
  openingParagraphLimit?: number;
  maxOpeningWords?: number;
}

export interface MediaTextPartitionResult {
  openingContent: string[];
  continuationContent: string[];
  structuredSupportingContent: string[][];
}

export function partitionMediaTextContent(input: MediaTextPartitionInput): MediaTextPartitionResult {
  const paragraphs = input.paragraphs.filter((p) => String(p || "").trim());
  const maxOpeningWords = input.maxOpeningWords ?? 95;
  let openingLimit = input.openingParagraphLimit ?? 2;

  if (paragraphs.length && countWords(paragraphs[0]) > maxOpeningWords) {
    openingLimit = 1;
  } else if (paragraphs.length >= 2 && countWords(paragraphs[0]) + countWords(paragraphs[1]) > maxOpeningWords) {
    openingLimit = 1;
  }

  return {
    openingContent: paragraphs.slice(0, openingLimit),
    continuationContent: paragraphs.slice(openingLimit),
    structuredSupportingContent: input.lists || [],
  };
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderParagraphs(paragraphs: string[]): string {
  return paragraphs.map((p) => `<p>${esc(p)}</p>`).join("\n");
}

function renderLists(lists: string[][]): string {
  return lists
    .map((items) => `<ul class="clean">${items.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>`)
    .join("\n");
}

export interface MediaFloatFlowSectionInput {
  sectionId?: string;
  sectionClass?: string;
  templateBlock?: string;
  kicker?: string;
  headHtml?: string;
  title?: string;
  titleIntro?: string;
  paragraphs: string[];
  lists?: string[][];
  mediaHtml: string;
  layout?: MediaTextLayoutVariant;
  thresholds?: Partial<MediaTextLayoutThresholds>;
  hasImage?: boolean;
}

/** Balanced 50/50 grid split — short content only. */
export function renderBalancedSplitSection(input: MediaFloatFlowSectionInput): string {
  const openingHtml = [
    input.kicker ? `<span class="tag">${esc(input.kicker)}</span>` : "",
    renderParagraphs(input.paragraphs),
    renderLists(input.lists || []),
  ]
    .filter(Boolean)
    .join("\n");

  return `<section${input.sectionId ? ` id="${esc(input.sectionId)}"` : ""} class="${esc(input.sectionClass ?? "blue-band")}"${input.templateBlock ? ` data-template-block="${esc(input.templateBlock)}"` : ""} data-layout="balanced-split">
<div class="wrap">
${input.headHtml || (input.title ? `<div class="section-head center"><h2>${esc(input.title)}</h2>${input.titleIntro ? `<p>${esc(input.titleIntro)}</p>` : ""}</div>` : "")}
<div class="definition-split-row balanced-split-row">
<div class="definition-split-copy section-opening-copy">${openingHtml}</div>
<div class="definition-split-media section-media">${input.mediaHtml}</div>
</div>
</div>
</section>`;
}

/** Media-float-flow — floated figure with all copy in one flowing block. */
export function renderMediaFloatFlowSection(input: MediaFloatFlowSectionInput): string {
  const copyHtml = [
    input.kicker ? `<span class="tag">${esc(input.kicker)}</span>` : "",
    renderParagraphs(input.paragraphs),
    renderLists(input.lists || []),
  ]
    .filter(Boolean)
    .join("\n");

  return `<section${input.sectionId ? ` id="${esc(input.sectionId)}"` : ""} class="${esc(input.sectionClass ?? "blue-band")}"${input.templateBlock ? ` data-template-block="${esc(input.templateBlock)}"` : ""} data-layout="media-float-flow">
<div class="wrap">
${input.headHtml || (input.title ? `<div class="section-head center"><h2>${esc(input.title)}</h2>${input.titleIntro ? `<p>${esc(input.titleIntro)}</p>` : ""}</div>` : "")}
<figure class="section-media definition-split-media">${input.mediaHtml}</figure>
<div class="section-copy definition-split-copy">${copyHtml}</div>
</div>
</section>`;
}

export function renderMediaTextSection(input: MediaFloatFlowSectionInput): string {
  const wordCount = input.paragraphs.reduce((sum, p) => sum + countWords(p), 0);
  const layout =
    input.layout ||
    resolveMediaTextLayout({
      paragraphCount: input.paragraphs.length,
      wordCount,
      listCount: (input.lists || []).length,
      hasImage: input.hasImage !== false && Boolean(input.mediaHtml),
      thresholds: input.thresholds,
    });

  if (layout === "full-width-editorial" || !input.mediaHtml) {
    return `<section${input.sectionId ? ` id="${esc(input.sectionId)}"` : ""} class="${esc(input.sectionClass ?? "blue-band")}"${input.templateBlock ? ` data-template-block="${esc(input.templateBlock)}"` : ""} data-layout="full-width-editorial">
<div class="wrap">
${input.headHtml || (input.title ? `<div class="section-head center"><h2>${esc(input.title)}</h2>${input.titleIntro ? `<p>${esc(input.titleIntro)}</p>` : ""}</div>` : "")}
<div class="section-opening-copy">${renderParagraphs(input.paragraphs)}${renderLists(input.lists || [])}</div>
</div>
</section>`;
  }

  if (layout === "balanced-split") {
    return renderBalancedSplitSection({ ...input, layout });
  }

  return renderMediaFloatFlowSection({ ...input, layout });
}

/** @deprecated use renderMediaFloatFlowSection — cluster legacy helper preserved for reference. */
export function renderLegacyMediaFloatSection(copyLeadHtml: string, mediaHtml: string, continuationHtml = ""): string {
  return `<div class="definition-split-row">
<div class="definition-split-copy">${copyLeadHtml}</div>
<div class="definition-split-media">${mediaHtml}</div>
</div>
${continuationHtml ? `<div class="definition-split-continuation">${continuationHtml}</div>` : ""}`;
}
