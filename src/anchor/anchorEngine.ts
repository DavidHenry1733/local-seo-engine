/**
 * anchorEngine.ts
 *
 * Internal anchor text engine for the local SEO page builder.
 *
 * Entry point:
 *   applyInternalAnchors(input: AnchorEngineInput): AnchorEngineOutput
 *
 * Responsibilities:
 *   - Generate exact, partial, and natural anchor text candidates per link
 *   - Choose the right style per link type (hub → exact/partial, cluster → partial,
 *     supporting → natural)
 *   - Insert links into <p> body text without touching headings or existing anchors
 *   - Distribute links across sections (max 2 per section)
 *   - Avoid duplicate anchor text
 *   - Emit a full insertion report with status + message per link
 */

import type {
  AnchorStyle,
  LinkType,
  AnchorInsertion,
  AnchorEngineInput,
  AnchorEngineOutput,
} from "./anchorTypes";

// ── Section key order ─────────────────────────────────────────────────────────

type SectionKey =
  | "splitSectionOne"
  | "splitSectionTwo"
  | "about"
  | "localRelevance"
  | "resourcesIntro";

const SECTION_ORDER: SectionKey[] = [
  "splitSectionOne",
  "splitSectionTwo",
  "about",
  "localRelevance",
  "resourcesIntro",
];

// ── Regex helpers ─────────────────────────────────────────────────────────────

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── HTML position guards ──────────────────────────────────────────────────────

/**
 * Returns true if `pos` falls inside an HTML tag (between < and >).
 * Prevents wrapping text that is part of an attribute value or tag name.
 */
function isInHtmlTag(html: string, pos: number): boolean {
  let i = pos;
  while (i >= 0) {
    if (html[i] === "<") return true;
    if (html[i] === ">") return false;
    i--;
  }
  return false;
}

/**
 * Returns true if `pos` is inside an existing <a>…</a> element.
 * Prevents double-wrapping already linked text.
 */
function isInAnchor(html: string, pos: number): boolean {
  const before = html.slice(0, pos);
  const opens  = (before.match(/<a[\s>]/gi) ?? []).length;
  const closes = (before.match(/<\/a>/gi) ?? []).length;
  return opens > closes;
}

// ── Anchor text candidate generators ─────────────────────────────────────────

/**
 * Exact anchors — match as close to the primary keyword as possible.
 * Maximum 1 exact anchor per page.
 */
function exactCandidates(
  serviceName: string,
  location:    string,
  primaryKeyword: string
): string[] {
  return [
    primaryKeyword,
    `${serviceName} ${location}`,
    serviceName,
  ];
}

/**
 * Partial anchors — natural-sounding commercial phrases that contain the
 * service name, location, or both.
 */
function partialCandidates(
  serviceName: string,
  location:    string,
  label:       string
): string[] {
  const svc = serviceName.toLowerCase();
  return [
    label,
    `professional ${svc} in ${location}`,
    `${svc} services in ${location}`,
    `our ${svc} service`,
    `${svc} in ${location}`,
    svc,
  ];
}

/**
 * Natural anchors — editorial "learn more" style phrases.
 * Used for supporting content and as a fallback for any link that cannot
 * be placed via exact or partial matching.
 */
function naturalCandidates(
  serviceName: string,
  location:    string,
  label:       string
): string[] {
  const svc = serviceName.toLowerCase();
  return [
    `learn more about ${svc} in ${location}`,
    `see why ${svc} matters for your business`,
    `find out how ${svc} generates enquiries`,
    `learn more about ${label.toLowerCase()}`,
    `see how ${svc} can help`,
  ];
}

function getCandidates(
  style:       AnchorStyle,
  serviceName: string,
  location:    string,
  primaryKeyword: string,
  label:       string
): string[] {
  switch (style) {
    case "exact":
      return exactCandidates(serviceName, location, primaryKeyword);
    case "partial":
      return partialCandidates(serviceName, location, label);
    case "natural":
      return naturalCandidates(serviceName, location, label);
  }
}

// ── Style selection ───────────────────────────────────────────────────────────

/**
 * Chooses the preferred anchor style for a given link type.
 * The hub gets one exact anchor; after that it falls back to partial.
 */
function chooseStyle(
  linkType:        LinkType,
  exactUsedCount:  number
): AnchorStyle {
  if (linkType === "hub")       return exactUsedCount === 0 ? "exact" : "partial";
  if (linkType === "cluster")   return "partial";
  return "natural";
}

// ── Wrap insertion ────────────────────────────────────────────────────────────

interface WrapResult {
  html:    string;
  matched: string;
}

/**
 * Searches `html` for the first occurrence of `candidate` (case-insensitive,
 * whole-word) that is not inside an HTML tag or existing anchor, then wraps it.
 * Returns null if no safe match is found.
 */
function tryWrap(
  html:      string,
  candidate: string,
  url:       string
): WrapResult | null {
  const pattern = new RegExp(`\\b${escapeRegex(candidate)}\\b`, "i");
  const match   = pattern.exec(html);
  if (!match) return null;
  if (isInHtmlTag(html, match.index))  return null;
  if (isInAnchor(html, match.index))   return null;

  const wrapped =
    html.slice(0, match.index) +
    `<a href="${url}">${match[0]}</a>` +
    html.slice(match.index + match[0].length);

  return { html: wrapped, matched: match[0] };
}

// ── Natural (append) insertion ────────────────────────────────────────────────

interface AppendResult {
  html:     string;
  inserted: boolean;
}

/**
 * Finds the first `<p>` in `html` that does not already contain an `<a>` tag
 * and appends a natural-language linked phrase before its closing `</p>`.
 */
function appendNaturalLink(
  html:       string,
  anchorText: string,
  url:        string
): AppendResult {
  // Split on </p> boundaries; look for a paragraph without an existing link
  const closeTag = "</p>";
  const parts    = html.split(closeTag);

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    // Must contain an opening <p and must not already have a link
    if (!part.includes("<p") || part.includes("<a ")) continue;

    const trimmed  = part.trimEnd();
    const lastChar = trimmed[trimmed.length - 1];
    const sep      = [".", "!", "?"].includes(lastChar ?? "") ? " " : ". ";

    parts[i] = trimmed + sep + `<a href="${url}">${anchorText}</a>`;
    return { html: parts.join(closeTag), inserted: true };
  }

  return { html, inserted: false };
}

// ── Link queue builder ────────────────────────────────────────────────────────

interface LinkTask {
  url:      string;
  label:    string;
  linkType: LinkType;
}

function buildLinkQueue(input: AnchorEngineInput): LinkTask[] {
  const queue: LinkTask[] = [];

  // 1 mandatory hub link
  queue.push({
    url:      input.hubPage.url,
    label:    input.hubPage.label,
    linkType: "hub",
  });

  // 1–2 cluster links
  for (const page of input.relatedClusterPages.slice(0, 2)) {
    queue.push({ url: page.url, label: page.label, linkType: "cluster" });
  }

  // 1–2 supporting links (cap total at 5)
  const remaining = Math.max(1, 5 - queue.length);
  for (const page of input.supportingPages.slice(0, Math.min(2, remaining))) {
    queue.push({ url: page.url, label: page.label, linkType: "supporting" });
  }

  return queue;
}

// ── Section distribution helper ───────────────────────────────────────────────

const MAX_LINKS_PER_SECTION = 2;

/**
 * Returns SECTION_ORDER sorted so that sections with fewer existing links
 * come first — ensures even distribution across the page.
 */
function distributedOrder(
  counts: Partial<Record<SectionKey, number>>
): SectionKey[] {
  return [...SECTION_ORDER].sort(
    (a, b) => (counts[a] ?? 0) - (counts[b] ?? 0)
  );
}

// ── Main engine ───────────────────────────────────────────────────────────────

export function applyInternalAnchors(
  input: AnchorEngineInput
): AnchorEngineOutput {
  // ── Mutable section map ────────────────────────────────────────────────────
  const sections: Partial<Record<SectionKey, string>> = {
    splitSectionOne: input.splitSectionOneHtml,
    splitSectionTwo: input.splitSectionTwoHtml,
    about:           input.aboutSectionHtml,
    localRelevance:  input.localRelevanceSectionHtml,
    resourcesIntro:  input.resourcesIntroHtml,
  };

  const insertions:      AnchorInsertion[]                    = [];
  const usedAnchorTexts: Set<string>                          = new Set();
  const sectionCounts:   Partial<Record<SectionKey, number>>  = {};
  let   exactUsedCount = 0;

  // ── Process each link task ─────────────────────────────────────────────────
  const linkQueue = buildLinkQueue(input);

  for (const task of linkQueue) {
    const preferredStyle = chooseStyle(task.linkType, exactUsedCount);

    let inserted       = false;
    let insertedIn:    SectionKey | "" = "";
    let insertedText   = "";
    let insertedStyle: AnchorStyle = preferredStyle;

    // ── Phase 1: wrap an existing phrase (exact / partial) ─────────────────
    if (preferredStyle !== "natural") {
      const stylestoTry: AnchorStyle[] = [preferredStyle, "partial"];

      outerWrap:
      for (const style of stylestoTry) {
        const candidates = getCandidates(
          style,
          input.serviceName,
          input.location,
          input.primaryKeyword,
          task.label
        );

        for (const sectionKey of distributedOrder(sectionCounts)) {
          const html = sections[sectionKey];
          if (!html) continue;
          if ((sectionCounts[sectionKey] ?? 0) >= MAX_LINKS_PER_SECTION) continue;

          for (const candidate of candidates) {
            if (usedAnchorTexts.has(candidate.toLowerCase())) continue;

            const result = tryWrap(html, candidate, task.url);
            if (result) {
              sections[sectionKey]      = result.html;
              sectionCounts[sectionKey] = (sectionCounts[sectionKey] ?? 0) + 1;
              insertedIn    = sectionKey;
              insertedText  = result.matched;
              insertedStyle = style;
              inserted      = true;
              break outerWrap;
            }
          }
        }
      }
    }

    // ── Phase 2: natural append fallback ────────────────────────────────────
    if (!inserted) {
      const naturalTexts = naturalCandidates(
        input.serviceName,
        input.location,
        task.label
      );

      for (const sectionKey of distributedOrder(sectionCounts)) {
        const html = sections[sectionKey];
        if (!html) continue;
        if ((sectionCounts[sectionKey] ?? 0) >= MAX_LINKS_PER_SECTION) continue;

        for (const candidate of naturalTexts) {
          if (usedAnchorTexts.has(candidate.toLowerCase())) continue;

          const result = appendNaturalLink(html, candidate, task.url);
          if (result.inserted) {
            sections[sectionKey]      = result.html;
            sectionCounts[sectionKey] = (sectionCounts[sectionKey] ?? 0) + 1;
            insertedIn    = sectionKey;
            insertedText  = candidate;
            insertedStyle = "natural";
            inserted      = true;
            break;
          }
        }
        if (inserted) break;
      }
    }

    // ── Record result ────────────────────────────────────────────────────────
    if (inserted) {
      usedAnchorTexts.add(insertedText.toLowerCase());
      if (insertedStyle === "exact") exactUsedCount++;

      insertions.push({
        anchorText:  insertedText,
        url:         task.url,
        linkType:    task.linkType,
        anchorStyle: insertedStyle,
        sectionUsed: insertedIn,
        status:      "inserted",
        message:     `${insertedStyle} anchor placed in "${insertedIn}"`,
      });
    } else {
      const fallbackText = getCandidates(
        preferredStyle,
        input.serviceName,
        input.location,
        input.primaryKeyword,
        task.label
      )[0] ?? task.label;

      insertions.push({
        anchorText:  fallbackText,
        url:         task.url,
        linkType:    task.linkType,
        anchorStyle: preferredStyle,
        sectionUsed: "",
        status:      "warning",
        message:     `No suitable insertion point found for ${task.linkType} link → ${task.url}`,
      });
    }
  }

  // ── Post-insertion validation warnings ────────────────────────────────────

  if (exactUsedCount > 1) {
    insertions.push({
      anchorText:  "",
      url:         "",
      linkType:    "hub",
      anchorStyle: "exact",
      sectionUsed: "",
      status:      "warning",
      message:     `Exact anchor overuse: ${exactUsedCount} exact anchors on one page. Recommended maximum is 1.`,
    });
  }

  const hubPlaced = insertions.some(
    (ins) => ins.linkType === "hub" && ins.status === "inserted"
  );
  if (!hubPlaced) {
    insertions.push({
      anchorText:  "",
      url:         input.hubPage.url,
      linkType:    "hub",
      anchorStyle: "exact",
      sectionUsed: "",
      status:      "warning",
      message:     "Required hub link could not be inserted. Ensure section HTML contains at least one <p> tag.",
    });
  }

  // ── Build output ──────────────────────────────────────────────────────────
  return {
    splitSectionOneHtml:      sections.splitSectionOne  ?? input.splitSectionOneHtml,
    splitSectionTwoHtml:      sections.splitSectionTwo  ?? input.splitSectionTwoHtml,
    aboutSectionHtml:         sections.about,
    localRelevanceSectionHtml: sections.localRelevance,
    resourcesIntroHtml:       sections.resourcesIntro,
    insertions,
  };
}
