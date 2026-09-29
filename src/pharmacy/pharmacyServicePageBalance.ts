/**
 * PharmaConnect card content balance V1.
 * Presentation-only — sentence-boundary shaping; equal height via CSS flex.
 */
export type ContentCard = { title: string; body: string; icon?: string };

export type BalanceOptions = {
  /** Soft cap: remove last complete sentences only — never word/char clipping. */
  maxSentences?: number;
  titleLineThreshold?: number;
};

const DANGLING_END = /\b(and|or|to|for|with|of|by|should|would|could|may also|can also)\s*[,]?\s*$/i;

export function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

const SENTENCE_ABBREVIATIONS: Array<[RegExp, string]> = [
  [/\be\.g\./gi, "e_g_"],
  [/\bi\.e\./gi, "i_e_"],
  [/\betc\./gi, "etc_"],
  [/\bvs\./gi, "vs_"],
  [/\bMr\./g, "Mr_"],
  [/\bMrs\./g, "Mrs_"],
  [/\bDr\./g, "Dr_"],
];

function protectSentenceAbbreviations(text: string): string {
  let out = text;
  for (const [pattern, token] of SENTENCE_ABBREVIATIONS) {
    out = out.replace(pattern, token);
  }
  return out;
}

function restoreSentenceAbbreviations(text: string): string {
  return text
    .replace(/e_g_/g, "e.g.")
    .replace(/i_e_/g, "i.e.")
    .replace(/etc_/g, "etc.")
    .replace(/vs_/g, "vs.")
    .replace(/Mr_/g, "Mr.")
    .replace(/Mrs_/g, "Mrs.")
    .replace(/Dr_/g, "Dr.");
}

export function splitSentences(text: string): string[] {
  const clean = stripHtml(text);
  if (!clean) return [];
  const protectedText = protectSentenceAbbreviations(clean);
  const parts = protectedText.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g);
  return parts?.map((s) => restoreSentenceAbbreviations(s.trim())).filter(Boolean) ?? [];
}

export function endsCompleteSentence(text: string): boolean {
  const t = stripHtml(text);
  if (!t || t.endsWith("…") || t.endsWith("...")) return false;
  if (/,\s*$/.test(t)) return false;
  if (DANGLING_END.test(t)) return false;
  return /[.!?]["']?\s*$/.test(t);
}

/** Ensure text ends on a complete sentence — never clip mid-sentence. */
export function normalizeBodyText(text: string): string {
  const clean = stripHtml(text);
  if (!clean) return "";
  if (endsCompleteSentence(clean)) return clean;

  const sentences = splitSentences(clean);
  if (!sentences.length) return clean;

  for (let i = sentences.length - 1; i >= 0; i--) {
    const candidate = sentences.slice(0, i + 1).join(" ");
    if (endsCompleteSentence(candidate)) return candidate;
  }

  const first = sentences[0]!;
  return endsCompleteSentence(first) ? first : `${first.replace(/[,;:\s]+$/, "")}.`;
}

/** Remove last complete sentence until at most maxSentences remain. */
export function shortenToSentenceCount(text: string, maxSentences: number): string {
  const sentences = splitSentences(text);
  if (sentences.length <= maxSentences) return normalizeBodyText(text);
  return normalizeBodyText(sentences.slice(0, maxSentences).join(" "));
}

/**
 * Balance cards at sentence boundaries only.
 * Rule 3: shorten by removing last complete sentences (when maxSentences set).
 * Rule 4: extend short cards with next master sentences when below grid minimum.
 */
export function balanceCards(cards: ContentCard[], options: BalanceOptions = {}): ContentCard[] {
  if (!cards.length) return [];

  const meta = cards.map((c) => ({
    ...c,
    masterSentences: splitSentences(c.body),
  }));

  let balanced = meta.map((c) => {
    let sentences = [...c.masterSentences];
    if (options.maxSentences && sentences.length > options.maxSentences) {
      sentences = sentences.slice(0, options.maxSentences);
    }
    const body = normalizeBodyText(sentences.join(" ") || c.body);
    return { ...c, sentences: splitSentences(body), body };
  });

  const counts = balanced.map((c) => c.sentences.length).filter((n) => n > 0);
  if (counts.length > 0) {
    const gridMin = Math.min(...counts);
    balanced = balanced.map((c) => {
      let sentences = [...c.sentences];
      while (sentences.length < gridMin && sentences.length < c.masterSentences.length) {
        sentences.push(c.masterSentences[sentences.length]!);
      }
      return { ...c, sentences, body: normalizeBodyText(sentences.join(" ")) };
    });
  }

  return balanced.map(({ title, body, icon }) => ({ title, body, icon }));
}

/** @deprecated word-count balancing removed — returns normalized full copy */
export function balanceBodyText(fullText: string, _minWords?: number, _maxWords?: number): string {
  return normalizeBodyText(fullText);
}

export function balanceProcessSteps(bodies: string[]): string[] {
  return bodies.map((b) => normalizeBodyText(b));
}

export function resolveTitleLineClass(
  titles: string[],
  threshold = 22,
): "card-title-line-1" | "card-title-line-2" {
  const needsTwoLines = titles.some((t) => t.length > threshold || t.split(/\s+/).length > 3 || /[()]/.test(t));
  return needsTwoLines ? "card-title-line-2" : "card-title-line-1";
}

export type BalancedGridRenderOptions = {
  cols: 2 | 3 | 4;
  maxSentences?: number;
  stepNumbers?: boolean;
  gridClass?: string;
};

export function renderBalancedCardGrid(cards: ContentCard[], options: BalancedGridRenderOptions): string {
  if (!cards.length) return "";

  const balanced = balanceCards(cards, { maxSentences: options.maxSentences });
  const titleLineClass = resolveTitleLineClass(balanced.map((c) => c.title));
  const baseGrid = options.cols === 4 ? "grid-4" : options.cols === 2 ? "grid-2" : "grid-3";
  const gridClass = `${baseGrid} card-grid-equal equal-title-height ${options.gridClass ?? ""}`.trim();

  const items = balanced
    .map((c, i) => {
      const icon = options.stepNumbers
        ? `<div class="icon step-icon" aria-hidden="true"><span class="step-number">${i + 1}</span></div>`
        : c.icon
          ? `<div class="icon">${escapeHtml(c.icon)}</div>`
          : "";
      const titleBlock = c.title
        ? `<div class="card-title-block">${icon}<h3 class="${titleLineClass}">${escapeHtml(c.title)}</h3></div>`
        : icon
          ? `<div class="card-title-block">${icon}</div>`
          : "";
      return `<div class="card equal-height-card"${
        options.stepNumbers ? ` data-step="${i + 1}" aria-label="Step ${i + 1}. ${escapeHtml(c.title)}"` : ""
      }>${titleBlock}<p class="card-body">${escapeHtml(c.body)}</p></div>`;
    })
    .join("\n");

  return `<div class="${gridClass}${options.stepNumbers ? " process-steps" : ""}" ${options.stepNumbers ? 'role="list"' : ""} data-card-count="${balanced.length}" data-balance-title-lines="${titleLineClass}">${items}</div>`;
}

/** First complete sentence for compact list summaries — no mid-sentence char clipping. */
export function firstCompleteSentence(text: string): string {
  const sentences = splitSentences(text);
  return sentences.length ? normalizeBodyText(sentences[0]!) : normalizeBodyText(text);
}

export interface CardCompletenessIssue {
  text: string;
  reason: string;
  context?: string;
}

export function auditCardBodyCompleteness(text: string): CardCompletenessIssue | null {
  const body = stripHtml(text);
  if (!body) return { text: body, reason: "empty body" };
  if (!endsCompleteSentence(body)) {
    if (body.endsWith("…") || body.endsWith("...")) return { text: body, reason: "ellipsis truncation" };
    if (/,\s*$/.test(body)) return { text: body, reason: "trailing comma" };
    if (DANGLING_END.test(body)) return { text: body, reason: "dangling conjunction or phrase" };
    return { text: body, reason: "missing sentence terminator" };
  }
  return null;
}

export function extractCardBodiesFromHtml(html: string): Array<{ text: string; context: string }> {
  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  let scope = mainMatch?.[1] ?? html;
  scope = scope.replace(/<footer[\s\S]*$/i, "");

  const results: Array<{ text: string; context: string }> = [];
  const patterns: Array<[RegExp, string]> = [
    [/<p class="card-body">([^<]*)<\/p>/g, "card-body"],
    [/<p class="faq-a">([^<]*)<\/p>/g, "faq-a"],
    [/<div class="timeline[^"]*">[\s\S]*?<p class="card-body">([^<]*)<\/p>/g, "timeline"],
  ];
  for (const [re, context] of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(scope)) !== null) {
      const text = decodeHtmlEntities(m[1] ?? "").trim();
      if (text) results.push({ text, context });
    }
  }
  return results;
}

export function validateCardBodiesComplete(html: string): { pass: boolean; issues: CardCompletenessIssue[] } {
  const bodies = extractCardBodiesFromHtml(html);
  const issues: CardCompletenessIssue[] = [];
  for (const { text, context } of bodies) {
    const issue = auditCardBodyCompleteness(text);
    if (issue) issues.push({ ...issue, context });
  }
  return { pass: issues.length === 0, issues };
}

export function validateCardBodiesCompleteInSection(
  html: string,
  sectionPattern: RegExp,
): { pass: boolean; issues: CardCompletenessIssue[] } {
  const sectionMatch = html.match(sectionPattern);
  if (!sectionMatch) return { pass: false, issues: [{ text: "", reason: "section not found" }] };
  return validateCardBodiesComplete(sectionMatch[0]);
}

/** @deprecated word-count range checks removed in V1 */
export function validateCardBodiesInRange(
  html: string,
  selectorPattern: RegExp,
  _minWords: number,
  _maxWords: number,
): boolean {
  return validateCardBodiesCompleteInSection(html, selectorPattern).pass;
}

export function validateEqualTitleClass(html: string, sectionPattern: RegExp): boolean {
  const sectionMatch = html.match(sectionPattern);
  if (!sectionMatch) return false;
  const classes = [...sectionMatch[0].matchAll(/<h3 class="(card-title-line-[12])"/g)].map((m) => m[1]);
  if (!classes.length) return false;
  return classes.every((c) => c === classes[0]);
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
