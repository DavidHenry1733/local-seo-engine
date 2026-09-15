/**
 * Pharmacy Content Assembly Validation V1 —
 * audit generated page JSON before publish.
 */
import type { PharmacyPageType } from "./pharmacyPublishingValidation.ts";

export type ContentAssemblyIssueType =
  | "danglingParagraphEnd"
  | "internalLabel"
  | "placeholderToken"
  | "duplicateEntityCard"
  | "shortHeadingBody"
  | "ellipsisEnd"
  | "narrativeIncomplete";

export interface ContentAssemblyIssue {
  type: ContentAssemblyIssueType;
  detail: string;
  field: string;
  autoFixable: boolean;
  excerpt?: string;
}

export interface ContentAssemblyPageResult {
  pageSlug: string;
  pageType: PharmacyPageType;
  passed: boolean;
  issues: ContentAssemblyIssue[];
}

export interface ContentAssemblyReport {
  slug: string;
  auditedAt: string;
  totalPages: number;
  affectedPageCount: number;
  passedPageCount: number;
  failedPageCount: number;
  publishBlocked: boolean;
  issueCountByType: Record<ContentAssemblyIssueType, number>;
  autoFixableCount: number;
  publishBlockerCount: number;
  pages: ContentAssemblyPageResult[];
}

const DANGLING_ENDINGS = new Set([
  "and",
  "with",
  "for",
  "to",
  "in",
  "near",
  "around",
  "serving",
  "supporting",
]);

const PLACEHOLDER_TOKENS = ["{area}", "{service}", "{entity}", "{pharmacyName}"] as const;

const INTERNAL_LABEL_REGEXES: Array<{ label: string; re: RegExp }> = [
  { label: "Bridge [number]", re: /\bBridge\s+\d+\b/gi },
  { label: "Question [number]", re: /\bQuestion\s+\d+\b/gi },
  { label: "Eligibility question [number]", re: /\bEligibility question\s+\d+\b/gi },
  { label: "Cost/value question [number]", re: /\bCost\/value question\s+\d+\b/gi },
  { label: "Variant [number]", re: /\bVariant\s+\d+\b/gi },
];

const ENTITY_CARD_BULLET_PATTERNS = [
  /^Near\s+(.+)$/i,
  /^Community:\s*(.+)$/i,
  /^Healthcare signal:\s*(.+)$/i,
  /^Community anchor:\s*(.+)$/i,
  /^Local access:\s*(.+)$/i,
];

const AUTO_FIXABLE: Record<ContentAssemblyIssueType, boolean> = {
  danglingParagraphEnd: true,
  internalLabel: true,
  placeholderToken: true,
  duplicateEntityCard: true,
  shortHeadingBody: true,
  ellipsisEnd: true,
  narrativeIncomplete: true,
};

function excerpt(text: string, max = 80): string {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function splitParagraphs(text: string): string[] {
  return String(text || "")
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function lastWord(paragraph: string): string {
  const cleaned = String(paragraph || "")
    .trim()
    .replace(/[.!?…]+$/u, "")
    .trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  return parts.length ? parts[parts.length - 1].toLowerCase().replace(/[^a-z'-]/gi, "") : "";
}

function endsWithEllipsis(paragraph: string): boolean {
  const t = String(paragraph || "").trim();
  return /\.\.\.\s*$/.test(t) || /…\s*$/.test(t);
}

function endsWithIncompleteBridge(paragraph: string): boolean {
  return /\bBridge\s+\d+\.\s*$/i.test(String(paragraph || "").trim());
}

function isDanglingSentence(sentence: string): boolean {
  const words = String(sentence || "")
    .trim()
    .replace(/[.!?…]+$/u, "")
    .split(/\s+/)
    .filter(Boolean);
  const dangling = lastWord(sentence);
  if (!DANGLING_ENDINGS.has(dangling)) return false;
  if (dangling === "and" || dangling === "with") return true;
  if (dangling === "serving" || dangling === "supporting") return words.length <= 8;
  return words.length <= 5;
}

function isDanglingCheckField(field: string): boolean {
  if (field.includes(".heading")) return false;
  if (field.includes(".bullets[")) return false;
  if (field.startsWith("metaTitle")) return false;
  if (field.startsWith("h1")) return false;
  if (field.startsWith("cta.")) return false;
  return (
    field === "intro" ||
    field.startsWith("metaDescription") ||
    field.includes(".body") ||
    field.includes(".answer")
  );
}

function findInternalLabels(text: string): string[] {
  const found = new Set<string>();
  for (const { label, re } of INTERNAL_LABEL_REGEXES) {
    re.lastIndex = 0;
    if (re.test(text)) found.add(label);
  }
  return [...found];
}

function findPlaceholderTokens(text: string): string[] {
  return PLACEHOLDER_TOKENS.filter((token) => text.includes(token));
}

function normalizeEntityName(name: string): string {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function extractEntityNamesFromBullet(bullet: string): string | null {
  for (const re of ENTITY_CARD_BULLET_PATTERNS) {
    const m = String(bullet || "").trim().match(re);
    if (m?.[1]) return normalizeEntityName(m[1]);
  }
  return null;
}

function collectTextFields(page: Record<string, any>): Array<{ field: string; text: string }> {
  const fields: Array<{ field: string; text: string }> = [];

  const push = (field: string, value: unknown) => {
    if (typeof value === "string" && value.trim()) fields.push({ field, text: value });
  };

  push("intro", page.intro);
  push("h1", page.h1);
  push("metaTitle", page.metaTitle);
  push("metaDescription", page.metaDescription);

  if (page.cta && typeof page.cta === "object") {
    for (const [key, value] of Object.entries(page.cta)) {
      push(`cta.${key}`, value);
    }
  }

  const sections = Array.isArray(page.sections) ? page.sections : [];
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i] || {};
    const prefix = `sections[${i}].${section.type || "unknown"}`;
    push(`${prefix}.heading`, section.heading);
    push(`${prefix}.body`, section.body);
    if (Array.isArray(section.bullets)) {
      for (let j = 0; j < section.bullets.length; j++) {
        push(`${prefix}.bullets[${j}]`, section.bullets[j]);
      }
    }
  }

  if (Array.isArray(page.faq)) {
    for (let i = 0; i < page.faq.length; i++) {
      const item = page.faq[i] || {};
      push(`faq[${i}].question`, item.question);
      push(`faq[${i}].answer`, item.answer);
    }
  }

  if (Array.isArray(page.faqs)) {
    for (let i = 0; i < page.faqs.length; i++) {
      const item = page.faqs[i] || {};
      push(`faqs[${i}].question`, item.question);
      push(`faqs[${i}].answer`, item.answer);
    }
  }

  return fields;
}

export function auditPharmacyContentAssembly(
  page: Record<string, any>,
  pageType: PharmacyPageType,
): ContentAssemblyPageResult {
  const pageSlug = String(page.pageSlug || "unknown");
  const issues: ContentAssemblyIssue[] = [];
  const fields = collectTextFields(page);

  for (const { field, text } of fields) {
    if (!isDanglingCheckField(field)) {
      // skip dangling check for headings and short bullet labels
    } else {
      for (const paragraph of splitParagraphs(text)) {
        if (isDanglingSentence(paragraph)) {
          issues.push({
            type: "danglingParagraphEnd",
            detail: `Paragraph ends with "${lastWord(paragraph)}"`,
            field,
            autoFixable: AUTO_FIXABLE.danglingParagraphEnd,
            excerpt: excerpt(paragraph),
          });
        }
      }
    }

    for (const paragraph of splitParagraphs(text)) {
      if (endsWithEllipsis(paragraph)) {
        issues.push({
          type: "ellipsisEnd",
          detail: "Paragraph ends in ellipsis",
          field,
          autoFixable: AUTO_FIXABLE.ellipsisEnd,
          excerpt: excerpt(paragraph),
        });
      }

      if (endsWithIncompleteBridge(paragraph)) {
        issues.push({
          type: "narrativeIncomplete",
          detail: "Narrative block missing completion text after Bridge label",
          field,
          autoFixable: AUTO_FIXABLE.narrativeIncomplete,
          excerpt: excerpt(paragraph),
        });
      }
    }

    const labels = findInternalLabels(text);
    for (const label of labels) {
      issues.push({
        type: "internalLabel",
        detail: `Visible internal label: ${label}`,
        field,
        autoFixable: AUTO_FIXABLE.internalLabel,
        excerpt: excerpt(text),
      });
    }

    const tokens = findPlaceholderTokens(text);
    for (const token of tokens) {
      issues.push({
        type: "placeholderToken",
        detail: `Visible placeholder token: ${token}`,
        field,
        autoFixable: AUTO_FIXABLE.placeholderToken,
        excerpt: excerpt(text),
      });
    }
  }

  const sections = Array.isArray(page.sections) ? page.sections : [];
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i] || {};
    const heading = String(section.heading || "").trim();
    const body = String(section.body || "").trim();
    if (heading && body.length > 0 && body.length < 30) {
      issues.push({
        type: "shortHeadingBody",
        detail: `Heading "${heading}" has body under 30 characters (${body.length})`,
        field: `sections[${i}].${section.type || "unknown"}.body`,
        autoFixable: AUTO_FIXABLE.shortHeadingBody,
        excerpt: body,
      });
    }
  }

  const entityNames: Array<{ name: string; field: string }> = [];
  for (const { field, text } of fields) {
    if (!field.includes(".bullets[")) continue;
    const entity = extractEntityNamesFromBullet(text);
    if (entity) entityNames.push({ name: entity, field });
  }

  const seen = new Map<string, string>();
  for (const { name, field } of entityNames) {
    if (seen.has(name)) {
      issues.push({
        type: "duplicateEntityCard",
        detail: `Duplicate entity card "${name}" (${seen.get(name)} and ${field})`,
        field,
        autoFixable: AUTO_FIXABLE.duplicateEntityCard,
        excerpt: name,
      });
    } else {
      seen.set(name, field);
    }
  }

  return {
    pageSlug,
    pageType,
    passed: issues.length === 0,
    issues,
  };
}

export function summariseContentAssemblyReport(
  slug: string,
  results: ContentAssemblyPageResult[],
): ContentAssemblyReport {
  const issueCountByType: Record<ContentAssemblyIssueType, number> = {
    danglingParagraphEnd: 0,
    internalLabel: 0,
    placeholderToken: 0,
    duplicateEntityCard: 0,
    shortHeadingBody: 0,
    ellipsisEnd: 0,
    narrativeIncomplete: 0,
  };

  let autoFixableCount = 0;
  let publishBlockerCount = 0;

  for (const result of results) {
    for (const issue of result.issues) {
      issueCountByType[issue.type] += 1;
      publishBlockerCount += 1;
      if (issue.autoFixable) autoFixableCount += 1;
    }
  }

  const failedPageCount = results.filter((r) => !r.passed).length;

  return {
    slug,
    auditedAt: new Date().toISOString(),
    totalPages: results.length,
    affectedPageCount: failedPageCount,
    passedPageCount: results.length - failedPageCount,
    failedPageCount,
    publishBlocked: failedPageCount > 0,
    issueCountByType,
    autoFixableCount,
    publishBlockerCount,
    pages: results,
  };
}

export function formatContentAssemblyErrors(result: ContentAssemblyPageResult): string[] {
  return result.issues.map((issue) => `content assembly [${issue.type}]: ${issue.detail} (${issue.field})`);
}
