/**
 * Brand Component DNA — reusable component variant selections for tenant renderers.
 */
export type BrandHeaderVariant =
  | "topbar-white-navigation"
  | "compact-navigation"
  | "centred-logo-navigation"
  | "standard-navigation";

export type BrandTopBarVariant = "contact-hours-strip" | "none";

export type BrandNavigationVariant = "horizontal-multi-link" | "horizontal-compact" | "inline";

export type BrandHeroVariant =
  | "split-text-left-image-right"
  | "split-image-left-text-right"
  | "full-width-overlay"
  | "centred-contained";

export type BrandSectionFlowVariant = "alternating-media" | "card-led" | "editorial" | "compact";

export type BrandMediaTextVariant = "split-balanced" | "split-wide-image" | "stacked";

export type BrandServiceCardVariant = "card-grid-three" | "card-grid-two" | "card-led-band";

export type BrandTrustPanelVariant = "split-image-trust" | "card-grid" | "minimal-list";

export type BrandProcessVariant = "numbered-cards" | "timeline" | "compact-list";

export type BrandFaqVariant = "stacked-cards" | "accordion" | "compact-list";

export type BrandCtaVariant = "split-image-phone" | "centred-band" | "contact-split";

export type BrandMapContactVariant = "split-map-details" | "stacked-map" | "details-only";

export type BrandFooterVariant = "four-column-contact" | "three-column" | "compact";

export type BrandMobileHeaderVariant = "stacked-nav" | "compact-stack";

export type BrandImageTreatmentVariant = "rounded-balanced" | "rounded-soft" | "square-contained";

export interface BrandDnaComponents {
  headerVariant: BrandHeaderVariant;
  topBarVariant: BrandTopBarVariant;
  navigationVariant: BrandNavigationVariant;
  heroVariant: BrandHeroVariant;
  sectionFlowVariant: BrandSectionFlowVariant;
  mediaTextVariant: BrandMediaTextVariant;
  serviceCardVariant: BrandServiceCardVariant;
  trustPanelVariant: BrandTrustPanelVariant;
  processVariant: BrandProcessVariant;
  faqVariant: BrandFaqVariant;
  ctaVariant: BrandCtaVariant;
  mapContactVariant: BrandMapContactVariant;
  footerVariant: BrandFooterVariant;
  mobileHeaderVariant: BrandMobileHeaderVariant;
  imageTreatmentVariant: BrandImageTreatmentVariant;
}

export interface BrandDnaComponentEvidenceEntry {
  value: string;
  source: "website-import" | "brand-profile" | "layout-inference" | "platform-default";
  confidence: number;
  evidenceKey?: string;
  extractionMethod?: string;
}

export type BrandDnaComponentEvidence = Partial<
  Record<keyof BrandDnaComponents, BrandDnaComponentEvidenceEntry>
>;
