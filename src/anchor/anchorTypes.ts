/**
 * anchorTypes.ts
 *
 * Shared TypeScript types for the internal anchor text engine.
 */

// ── Primitives ────────────────────────────────────────────────────────────────

/** How the anchor text relates to the target keyword */
export type AnchorStyle = "exact" | "partial" | "natural";

/** The role of the linked page in the site hierarchy */
export type LinkType = "hub" | "cluster" | "supporting";

// ── Domain types ──────────────────────────────────────────────────────────────

/** A page that can receive an internal link */
export interface AnchorTarget {
  /** Human-readable label, used to generate anchor text candidates */
  label:    string;
  /** Full or root-relative URL */
  url:      string;
  /** Role of this page in the internal link hierarchy */
  linkType: LinkType;
}

/** A record of a single link insertion attempt */
export interface AnchorInsertion {
  /** The anchor text that was (or would have been) used */
  anchorText:  string;
  /** Destination URL */
  url:         string;
  /** Role of the target page */
  linkType:    LinkType;
  /** Style category of the chosen anchor text */
  anchorStyle: AnchorStyle;
  /** Which input section key the link was placed in (empty string if not placed) */
  sectionUsed: string;
  /** Outcome of the insertion attempt */
  status:      "inserted" | "warning" | "skipped";
  /** Human-readable description of what happened */
  message:     string;
}

// ── Engine I/O ────────────────────────────────────────────────────────────────

/**
 * Input to applyInternalAnchors.
 *
 * Section HTML fields should contain the full rendered `<section>...</section>`
 * (or equivalent block) as written to the output template.  The engine only
 * mutates `<p>` body text — headings, images, and existing links are left alone.
 */
export interface AnchorEngineInput {
  /** Whether this is a hub or cluster page */
  pageType:            "hub" | "cluster";
  /** Primary SEO keyword, e.g. "Web Design Sheffield" */
  primaryKeyword:      string;
  /** Supporting keywords for partial anchor generation */
  supportingKeywords:  string[];
  /** Core service name without location, e.g. "Web Design" */
  serviceName:         string;
  /** Location string, e.g. "Sheffield" */
  location:            string;
  /** The hub page that receives a mandatory link from every page */
  hubPage:             AnchorTarget;
  /** Cluster pages related to this page (supply 1–3; engine picks up to 2) */
  relatedClusterPages: AnchorTarget[];
  /** Supporting content pages such as blog posts or guides (supply 1–3; engine picks up to 2) */
  supportingPages:     AnchorTarget[];

  // ── Section HTML (the engine reads and returns these) ──────────────────────
  splitSectionOneHtml:      string;
  splitSectionTwoHtml:      string;
  aboutSectionHtml?:        string;
  localRelevanceSectionHtml?: string;
  resourcesIntroHtml?:      string;
}

/**
 * Output from applyInternalAnchors.
 *
 * Same section keys as the input — each section may have links injected.
 * `insertions` provides a full audit trail of every attempt.
 */
export interface AnchorEngineOutput {
  splitSectionOneHtml:      string;
  splitSectionTwoHtml:      string;
  aboutSectionHtml?:        string;
  localRelevanceSectionHtml?: string;
  resourcesIntroHtml?:      string;
  insertions:               AnchorInsertion[];
}
