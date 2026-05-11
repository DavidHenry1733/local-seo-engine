/**
 * templateTypes.ts
 *
 * Type definitions for the SEO page template library.
 * Templates are composed from an ordered list of reusable blocks rather than
 * being monolithic full-page designs, making them easy to mix, extend, and
 * adapt for different industry verticals.
 */

// ── Block ────────────────────────────────────────────────────────────────────

/**
 * A single reusable page block.
 *
 * blockId is the canonical identifier used in blockOrder arrays and any
 * render dispatcher. It should be lowercase_snake_case.
 *
 * placeholders lists the {{TOKEN}} strings this block reads from a generated
 * payload — useful for validation and template diffing.
 */
export interface BlockDefinition {
  blockId:      string;
  label:        string;
  required:     boolean;
  contentHints: string[];
  placeholders: string[];
}

// ── Style ────────────────────────────────────────────────────────────────────

/** Visual presentation style choices that affect CSS generation. */
export type HeroStyle =
  | "split_image_right"
  | "split_image_left"
  | "centred"
  | "fullwidth_overlay";

export type BorderRadius = "sharp" | "soft" | "rounded";

/** Named font stacks — no external font loading required for default stacks. */
export type FontStack =
  | "system"
  | "sans_modern"
  | "serif_trust"
  | "display_bold";

export type CtaStyle = "solid" | "gradient" | "outline";

export interface DefaultStyle {
  primaryColor: string;
  accentColor:  string;
  heroStyle:    HeroStyle;
  fontStack:    FontStack;
  borderRadius: BorderRadius;
  ctaStyle:     CtaStyle;
}

// ── Page types ───────────────────────────────────────────────────────────────

export type PageType = "hub" | "area" | "service" | "landing" | "contact";

// ── Template ─────────────────────────────────────────────────────────────────

/**
 * A complete template definition.
 *
 * - templateId          Unique slug, used in PagePlanItem.template and the
 *                       render dispatcher.
 * - templateName        Human-readable display name shown in the wizard UI.
 * - industryType        One or more industry tags this template suits.
 * - supportedPageTypes  Page roles this template can render.
 * - blockOrder          Ordered list of blocks that make up the page layout.
 * - defaultStyle        Starting visual style — overridable per project.
 * - requiredImageSlots  Image slot keys the renderer expects (hero, support…).
 * - recommendedContentSections
 *                       Ordered list of content section labels recommended for
 *                       AI content generation prompts.
 * - description         One-sentence summary shown in template picker UI.
 */
export interface TemplateDefinition {
  templateId:                  string;
  templateName:                string;
  description:                 string;
  industryType:                string[];
  supportedPageTypes:          PageType[];
  blockOrder:                  BlockDefinition[];
  defaultStyle:                DefaultStyle;
  requiredImageSlots:          string[];
  recommendedContentSections:  string[];
}
