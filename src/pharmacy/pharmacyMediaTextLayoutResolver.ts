/**
 * Deterministic media/text layout selection — content length drives presentation variant.
 */
export type MediaTextLayoutVariant = "balanced-split" | "media-float-flow" | "full-width-editorial";

export interface MediaTextLayoutThresholds {
  maxWordsBalancedSplit: number;
  maxParagraphsBalancedSplit: number;
  minWordsFloatFlow: number;
  minParagraphsFloatFlow: number;
  floatFlowOpeningParagraphs: number;
}

export interface MediaTextLayoutInput {
  paragraphCount: number;
  wordCount: number;
  listCount?: number;
  hasImage: boolean;
  thresholds?: Partial<MediaTextLayoutThresholds>;
}

export function getDefaultMediaTextLayoutThresholds(): MediaTextLayoutThresholds {
  return {
    maxWordsBalancedSplit: 110,
    maxParagraphsBalancedSplit: 2,
    minWordsFloatFlow: 90,
    minParagraphsFloatFlow: 3,
    floatFlowOpeningParagraphs: 2,
  };
}

function resolveThresholds(partial?: Partial<MediaTextLayoutThresholds>): MediaTextLayoutThresholds {
  return { ...getDefaultMediaTextLayoutThresholds(), ...partial };
}

export function countWords(text: string): number {
  return String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export function resolveMediaTextLayout(input: MediaTextLayoutInput): MediaTextLayoutVariant {
  if (!input.hasImage) return "full-width-editorial";

  const thresholds = resolveThresholds(input.thresholds);
  const listCount = input.listCount ?? 0;

  const fitsBalanced =
    input.paragraphCount <= thresholds.maxParagraphsBalancedSplit &&
    input.wordCount <= thresholds.maxWordsBalancedSplit &&
    listCount === 0;

  const needsFloat =
    input.paragraphCount >= thresholds.minParagraphsFloatFlow ||
    input.wordCount >= thresholds.minWordsFloatFlow ||
    listCount > 0;

  if (needsFloat) return "media-float-flow";
  if (fitsBalanced) return "balanced-split";
  return input.paragraphCount > 1 ? "media-float-flow" : "balanced-split";
}

export type SectionMediaPosition = "left" | "right";

export function resolveSectionMediaPosition(input: {
  sectionIndex: number;
  previousMediaPosition?: SectionMediaPosition | null;
  preferredPosition?: SectionMediaPosition;
  componentVariant?: string;
}): SectionMediaPosition {
  void input.componentVariant;
  if (input.preferredPosition) return input.preferredPosition;
  if (!input.previousMediaPosition) return "right";
  return input.previousMediaPosition === "right" ? "left" : "right";
}

export function splitParagraphsForMediaLayout(
  paragraphs: string[],
  layout: MediaTextLayoutVariant,
  thresholds?: Partial<MediaTextLayoutThresholds>,
): { beside: string[]; below: string[] } {
  if (layout === "full-width-editorial") {
    return { beside: [], below: paragraphs };
  }
  if (layout === "balanced-split") {
    return { beside: paragraphs, below: [] };
  }
  const openingCount = resolveThresholds(thresholds).floatFlowOpeningParagraphs;
  return {
    beside: paragraphs.slice(0, openingCount),
    below: paragraphs.slice(openingCount),
  };
}
