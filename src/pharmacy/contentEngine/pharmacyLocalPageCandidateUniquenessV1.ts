/**
 * Candidate local-page uniqueness and provenance checks.
 * Name, distance and URL substitutions do not count as uniqueness.
 */
import { copySimilarityScore } from "../pharmacyLocalClusterVariantFamilies.ts";
import { identityStrippedLocalityBody } from "../pharmacyLocalityPageDuplicationGateV1.ts";
import { evaluateAutomatedReadabilityPreflight } from "./pharmacyLocalCandidateReadabilityV1.ts";

export const LOCALITY_NARRATIVE_SIMILARITY_THRESHOLD = 0.80;
export { LOCALITY_IDENTITY_STRIPPED_BODY_THRESHOLD } from "./pharmacyLocalEvidencePackContractV1.ts";

const CLINICAL_BLOCKS = [
  "child-areas",
  "local-relevance",
  "consultation",
  "trust-split",
  "conversion-image",
  "final-cta",
];

const LOCALITY_BLOCKS = ["hero", "service-definition", "local", "faq"];

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function stripHtmlToText(html: string): string {
  return String(html || "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function matchBlock(html: string, re: RegExp): string {
  return html.match(re)?.[0] || "";
}

export function extractTemplateBlock(html: string, block: string): string {
  return matchBlock(html, new RegExp(`<(?:section|nav)\\b[^>]*data-template-block="${block}"[\\s\\S]*?<\\/(?:section|nav)>`, "i"));
}

export function extractCustomerVisibleBody(html: string): string {
  const main = html.match(/<main\b[\s\S]*?<\/main>/i)?.[0] || html;
  return stripHtmlToText(main.replace(/<nav\b[\s\S]*?<\/nav>/gi, " ").replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, " "));
}

export function extractLocalityNarrativeHtml(html: string): string {
  const main = html.match(/<main\b[\s\S]*?<\/main>/i)?.[0] || html;
  return LOCALITY_BLOCKS.map((block) => {
    if (block === "faq") {
      const faq = extractTemplateBlock(main, "faq");
      const first = faq.match(/<div class="cluster-faq-item[\s\S]*?<\/div>/i)?.[0] || "";
      return first;
    }
    if (block === "local") {
      return matchBlock(main, /<p class="local-intro-lead">[\s\S]*?<\/p>/i);
    }
    return extractTemplateBlock(main, block);
  }).join("\n");
}

export function extractSharedClinicalHtml(html: string): string {
  const main = html.match(/<main\b[\s\S]*?<\/main>/i)?.[0] || html;
  return CLINICAL_BLOCKS.map((block) => extractTemplateBlock(main, block)).join("\n");
}

export function stripIdentityTokens(
  text: string,
  input: {
    pharmacyName: string;
    areaName: string;
    telephone?: string;
    address?: string;
    distanceLabel?: string;
    siblingAreaNames?: string[];
  },
): string {
  let out = String(text || "").toLowerCase();
  const replacements: Array<[string, string]> = [];
  if (input.pharmacyName) replacements.push([input.pharmacyName, "{pharmacy}"]);
  if (input.areaName) replacements.push([input.areaName, "{area}"]);
  for (const sibling of input.siblingAreaNames || []) {
    if (sibling && sibling.toLowerCase() !== input.areaName.toLowerCase()) {
      replacements.push([sibling, "{area}"]);
    }
  }
  if (input.address) replacements.push([input.address, "{address}"]);
  if (input.telephone) replacements.push([input.telephone, "{phone}"]);
  if (input.distanceLabel) replacements.push([input.distanceLabel, "{distance}"]);
  replacements.sort((a, b) => b[0].length - a[0].length);
  for (const [raw, token] of replacements) {
    const needle = String(raw || "").trim();
    if (needle.length < 2) continue;
    out = out.replace(new RegExp(escapeRe(needle.toLowerCase()), "g"), token);
  }
  out = out
    .replace(/\b0\d[\d\s]{8,}\b/g, "{phone}")
    .replace(/\+44[\d\s]{8,}/g, "{phone}")
    .replace(/https?:\/\/\S+/g, "{url}")
    .replace(/\b[a-z]{1,2}\d{1,2}[a-z]?\s*\d[a-z]{2}\b/gi, "{postcode}")
    .replace(/\babout\s+\d+(?:\.\d+)?\s*km\b/g, "{distance}")
    .replace(/\bless than 1 km\b/g, "{distance}")
    .replace(/\b\d+(?:\.\d+)?\s*km\b/g, "{distance}")
    .replace(/\s+/g, " ")
    .trim();
  return out;
}

export function extractParagraphsFromHtml(html: string): string[] {
  // FAQ answers are <p class="faq-a"> and are already collected by the <p> matcher.
  // Do not add a second faq-a matcher — that double-counts answers as in-page duplicates.
  const parts = [
    ...String(html || "").matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi),
    ...String(html || "").matchAll(/<h3 class="faq-q">([\s\S]*?)<\/h3>/gi),
  ];
  return parts
    .map((m) => stripHtmlToText(m[1] || ""))
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.split(/\s+/).filter(Boolean).length >= 12);
}

export function visibleWordCount(html: string): number {
  return extractCustomerVisibleBody(html).split(/\s+/).filter(Boolean).length;
}

export type CandidatePageUniquenessInput = {
  areaSlug: string;
  areaName: string;
  pharmacyName: string;
  telephone?: string;
  address?: string;
  identityTown?: string;
  distanceLabel?: string;
  html: string;
  acceptedNames: string[];
  rejectedNames: string[];
  siblingAreaNames: string[];
};

/** Chrome that may legally contain the parent town (address, pharmacy identity). Not another area's evidence. */
export function canonicalIdentityChrome(input: {
  pharmacyName: string;
  address?: string;
  telephone?: string;
  identityTown?: string;
}): string[] {
  const town = String(input.identityTown || "").trim();
  const pharmacy = String(input.pharmacyName || "").trim();
  const address = String(input.address || "").trim();
  const phone = String(input.telephone || "").trim();
  return [
    address,
    pharmacy,
    phone,
    pharmacy && town ? `${pharmacy}, ${town}` : "",
    pharmacy && town ? `${pharmacy} in ${town}` : "",
    town ? `· ${town} ·` : "",
    town ? ` · ${town} · ` : "",
  ]
    .map((s) => s.trim())
    .filter((s) => s.length >= 4)
    .sort((a, b) => b.length - a.length);
}

export function textWithoutCanonicalIdentity(
  visible: string,
  input: {
    pharmacyName: string;
    address?: string;
    telephone?: string;
    identityTown?: string;
  },
): string {
  let out = String(visible || "").toLowerCase();
  for (const chrome of canonicalIdentityChrome(input)) {
    out = out.split(chrome.toLowerCase()).join(" ");
  }
  return out.replace(/\s+/g, " ").trim();
}

/**
 * True when a rejected pack entity appears in customer copy as evidence,
 * not merely as the parent town inside the canonical address/identity chrome.
 */
export function acceptedEntityCoversName(
  acceptedNames: string[],
  candidateName: string,
  areaName = "",
): boolean {
  const n = String(candidateName || "").trim().toLowerCase();
  if (!n) return false;
  const area = String(areaName || "").trim().toLowerCase();
  return acceptedNames.some((accepted) => {
    const a = String(accepted || "").trim().toLowerCase();
    if (!a) return false;
    if (a === n) return true;
    if (a.startsWith(`${n} `) || a.startsWith(`${n},`)) return true;
    if (n.startsWith(`${a} `) || n.startsWith(`${a},`)) return true;
    if (area && a.replace(new RegExp(`\\s+${escapeRe(area)}\\s*$`), "") === n) return true;
    if (a.split(/\s+/).length > n.split(/\s+/).length && (a.endsWith(` ${n}`) || a.startsWith(`${n} `))) return true;
    if (a.includes(n) && n.split(/\s+/).length >= 2) return true;
    return false;
  });
}

export function rejectedEntityReachedCustomerCopy(
  visible: string,
  rejectedName: string,
  identity: {
    pharmacyName: string;
    address?: string;
    telephone?: string;
    identityTown?: string;
  },
): boolean {
  const name = String(rejectedName || "").trim();
  if (name.length < 4) return false;
  const visibleLc = String(visible || "").toLowerCase();
  const nameLc = name.toLowerCase();
  if (!visibleLc.includes(nameLc)) return false;
  const remainder = textWithoutCanonicalIdentity(visible, identity);
  return remainder.includes(nameLc);
}

export function classifyParagraphKind(
  para: string,
  page: CandidatePageUniquenessInput,
): "approved-shared-clinical" | "shared-navigation-footer" | "duplicated-local-narrative" | "accidental-within-page" {
  const text = String(para || "").toLowerCase();
  if (
    /sore throat|earache|impetigo|shingles|sinusitis|uncomplicated uti|patient group direction|nhs 111|breathing difficulties|chest pain|non-blanching|medicines list|pathway criteria/.test(
      text,
    )
  ) {
    return "approved-shared-clinical";
  }
  if (/nearby areas we also help|help for patients in|pharmacy first main page|opening hours|all rights reserved/.test(text)) {
    return "shared-navigation-footer";
  }
  if (
    page.acceptedNames.some((name) => text.includes(name.toLowerCase())) ||
    text.includes(page.areaName.toLowerCase())
  ) {
    return "duplicated-local-narrative";
  }
  return "accidental-within-page";
}

export function evaluateHumanReadabilityIntegrity(
  html: string,
  acceptedNames: string[],
  areaName: string,
): { ok: boolean; failures: string[] } {
  const result = evaluateAutomatedReadabilityPreflight(html, acceptedNames, areaName);
  return { ok: result.ok, failures: result.failures };
}

export type PairwiseScore = {
  a: string;
  b: string;
  locality: number;
  fullBody: number;
};

export function evaluateCandidateSemanticUniqueness(pages: CandidatePageUniquenessInput[]): {
  ok: boolean;
  failures: string[];
  localityMatrix: number[][];
  fullBodyMatrix: number[][];
  honestFullBodyMatrix: number[][];
  maxLocality: number;
  maxFullBody: number;
  maxHonestFullBody: number;
  maxLocalityPair: PairwiseScore | null;
  maxFullBodyPair: PairwiseScore | null;
  maxHonestFullBodyPair: PairwiseScore | null;
  inPageDuplicates: Array<{ areaSlug: string; kind: string; excerpt: string }>;
  perArea: Array<{
    areaSlug: string;
    visibleWords: number;
    uniqueLocalParagraphs: number;
    evidenceMentions: string[];
  }>;
} {
  const failures: string[] = [];
  const identityOf = (page: CandidatePageUniquenessInput, text: string) =>
    stripIdentityTokens(text, {
      pharmacyName: page.pharmacyName,
      areaName: page.areaName,
      telephone: page.telephone,
      address: page.address,
      distanceLabel: page.distanceLabel,
      siblingAreaNames: page.siblingAreaNames,
    });

  const localityTexts = pages.map((page) => identityOf(page, stripHtmlToText(extractLocalityNarrativeHtml(page.html))));
  const fullBodies = pages.map((page) =>
    identityStrippedLocalityBody(page.html, page.areaName, page.pharmacyName, page.siblingAreaNames),
  );
  const honestFullBodies = pages.map((page) => identityOf(page, extractCustomerVisibleBody(page.html)));
  const n = pages.length;
  const localityMatrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  const fullBodyMatrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  const honestFullBodyMatrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  let maxLocality = 0;
  let maxFullBody = 0;
  let maxHonestFullBody = 0;
  let maxLocalityPair: PairwiseScore | null = null;
  let maxFullBodyPair: PairwiseScore | null = null;
  let maxHonestFullBodyPair: PairwiseScore | null = null;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const loc = copySimilarityScore(localityTexts[i]!, localityTexts[j]!);
      const full = copySimilarityScore(fullBodies[i]!, fullBodies[j]!);
      const honest = copySimilarityScore(honestFullBodies[i]!, honestFullBodies[j]!);
      localityMatrix[i]![j] = loc;
      localityMatrix[j]![i] = loc;
      fullBodyMatrix[i]![j] = full;
      fullBodyMatrix[j]![i] = full;
      honestFullBodyMatrix[i]![j] = honest;
      honestFullBodyMatrix[j]![i] = honest;
      const pair: PairwiseScore = {
        a: pages[i]!.areaSlug,
        b: pages[j]!.areaSlug,
        locality: loc,
        fullBody: full,
      };
      if (loc >= maxLocality) {
        maxLocality = loc;
        maxLocalityPair = pair;
      }
      if (full >= maxFullBody) {
        maxFullBody = full;
        maxFullBodyPair = pair;
      }
      if (honest >= maxHonestFullBody) {
        maxHonestFullBody = honest;
        maxHonestFullBodyPair = { ...pair, fullBody: honest };
      }
      if (loc > LOCALITY_NARRATIVE_SIMILARITY_THRESHOLD) {
        failures.push(
          `${pages[i]!.areaSlug}/${pages[j]!.areaSlug}: locality similarity ${loc.toFixed(3)} > ${LOCALITY_NARRATIVE_SIMILARITY_THRESHOLD}`,
        );
      }
      // Full-body similarity is scored and returned (maxFullBody) but does not fail
      // local-narrative uniqueness. Shared approved clinical copy is excluded from the
      // locality comparison (0.80) and must not be rewritten to game the 0.85 body gate.
    }
  }

  const inPageDuplicates: Array<{ areaSlug: string; kind: string; excerpt: string }> = [];
  const perArea = pages.map((page) => {
    const localHtml = extractLocalityNarrativeHtml(page.html);
    const localParas = extractParagraphsFromHtml(localHtml).filter((para) =>
      page.acceptedNames.some((name) => para.toLowerCase().includes(name.toLowerCase())),
    );
    const uniqueNormalized = new Set(localParas.map((para) => identityOf(page, para)));
    const visible = extractCustomerVisibleBody(page.html);
    const mentions = page.acceptedNames.filter((name) => visible.toLowerCase().includes(name.toLowerCase()));
    for (const rejected of page.rejectedNames) {
      if (acceptedEntityCoversName(page.acceptedNames, rejected, page.areaName)) continue;
      if (
        rejectedEntityReachedCustomerCopy(visible, rejected, {
          pharmacyName: page.pharmacyName,
          address: page.address,
          telephone: page.telephone,
          identityTown: page.identityTown,
        })
      ) {
        failures.push(`${page.areaSlug}: rejected evidence reached HTML (${rejected})`);
      }
    }
    const main = page.html.match(/<main\b[\s\S]*?<\/main>/i)?.[0] || page.html;
    const paraCounts = new Map<string, string[]>();
    for (const para of extractParagraphsFromHtml(main)) {
      const key = para.toLowerCase().replace(/\s+/g, " ");
      const list = paraCounts.get(key) || [];
      list.push(para);
      paraCounts.set(key, list);
    }
    for (const [key, list] of paraCounts) {
      if (list.length < 2) continue;
      const kind = classifyParagraphKind(list[0]!, page);
      inPageDuplicates.push({ areaSlug: page.areaSlug, kind, excerpt: key.slice(0, 140) });
      if (kind === "duplicated-local-narrative" || kind === "accidental-within-page") {
        failures.push(`${page.areaSlug}: in-page ${kind}: ${key.slice(0, 100)}`);
      }
    }
    return {
      areaSlug: page.areaSlug,
      visibleWords: visibleWordCount(page.html),
      uniqueLocalParagraphs: uniqueNormalized.size,
      evidenceMentions: mentions,
    };
  });

  const paragraphPages = new Map<string, number>();
  for (const page of pages) {
    const paras = new Set(
      extractParagraphsFromHtml(extractLocalityNarrativeHtml(page.html)).map((para) => identityOf(page, para)),
    );
    for (const para of paras) {
      paragraphPages.set(para, (paragraphPages.get(para) || 0) + 1);
    }
  }
  for (const [para, count] of paragraphPages) {
    if (count >= pages.length && pages.length >= 2) {
      failures.push(`non-clinical paragraph duplicated across all ${pages.length} pages: ${para.slice(0, 120)}`);
    }
  }

  return {
    ok: failures.length === 0,
    failures,
    localityMatrix,
    fullBodyMatrix,
    honestFullBodyMatrix,
    maxLocality,
    maxFullBody,
    maxHonestFullBody,
    maxLocalityPair,
    maxFullBodyPair,
    maxHonestFullBodyPair,
    inPageDuplicates,
    perArea,
  };
}

export const HEADINGLEY_TEMPLATE_BLOCKS = [
  "breadcrumbs",
  "hero",
  "service-definition",
  "child-areas",
  "local-relevance",
  "consultation",
  "local",
  "trust-split",
  "faq",
  "conversion-image",
  "final-cta",
  "parent-child-links",
] as const;

export function evaluateHeadingleyTemplateParity(html: string): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const main = html.match(/<main\b[\s\S]*?<\/main>/i)?.[0] || html;
  const order: string[] = [];
  const re = /data-template-block="([^"]+)"/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(main))) {
    const id = match[1] || "";
    if (!order.includes(id)) order.push(id);
  }
  const expected = [...HEADINGLEY_TEMPLATE_BLOCKS];
  for (const block of expected) {
    if (!order.includes(block)) failures.push(`missing template block ${block}`);
  }
  const expectedIndex = expected.filter((b) => order.includes(b));
  const actualIndex = order.filter((b) => expected.includes(b as (typeof expected)[number]));
  if (expectedIndex.join(">") !== actualIndex.join(">")) {
    failures.push(`block order ${actualIndex.join(" > ")} != ${expectedIndex.join(" > ")}`);
  }
  if (/\{\{[a-z0-9._-]+\}\}|%%[A-Z_]+%%/i.test(html)) failures.push("unresolved placeholder");
  if (/```|^\s*\{"/.test(stripHtmlToText(html))) failures.push("raw json or markdown");
  if (/data\/pharmacy-local-relevance-packs|src\/pharmacy\//i.test(html)) failures.push("internal identifier or file path");
  const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  for (const img of imgs) {
    if (/src="[^"]+\.(?:html|json|md)"/i.test(img)) failures.push("broken image reference");
    const alt = img.match(/alt="([^"]*)"/i)?.[1] || "";
    if (!alt.trim()) failures.push("empty image alt");
    if (/slot-|asset-id|platform-asset/i.test(alt)) failures.push("internal image alt");
  }
  const emptySection = /<section\b[^>]*>\s*<div class="wrap">\s*<\/div>\s*<\/section>/i.test(html);
  if (emptySection) failures.push("empty required section");
  const headings = [...main.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)].map((m) => stripHtmlToText(m[1] || "").toLowerCase());
  const headingSet = new Set(headings);
  if (headingSet.size !== headings.length) failures.push("duplicate normalized heading");
  const paras = extractParagraphsFromHtml(main).map((p) => p.toLowerCase().replace(/\s+/g, " "));
  const paraSet = new Set(paras);
  if (paraSet.size !== paras.length) failures.push("duplicate normalized paragraph within the page");
  return { ok: failures.length === 0, failures };
}
