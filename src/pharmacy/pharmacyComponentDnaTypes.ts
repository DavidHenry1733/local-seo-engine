/**
 * Component DNA — presentation-only reusable component definitions.
 * Never contains business content; Brand DNA owns identity, profiles own facts.
 */
import type { BrandDnaComponents } from "./pharmacyBrandDnaComponentTypes.ts";

export interface HeaderComponentDna {
  logoPosition: "left" | "center";
  logoMaxHeight: string;
  navGap: string;
  navAlign: "start" | "center" | "end";
  navFontSize: string;
  ctaLayout: "group" | "inline";
  ctaGap: string;
  sticky: boolean;
  topBar: boolean;
  phoneTreatment: "plain" | "hidden" | "prominent";
  emailTreatment: "plain" | "hidden";
  socialTreatment: "hidden" | "icons";
  desktopBreakpoint: string;
  mobileBreakpoint: string;
  variant: BrandDnaComponents["headerVariant"];
  topBarVariant: BrandDnaComponents["topBarVariant"];
  navigationVariant: BrandDnaComponents["navigationVariant"];
  mobileHeaderVariant: BrandDnaComponents["mobileHeaderVariant"];
}

export interface FooterComponentDna {
  columnWidths: string;
  columnOrder: string[];
  columnGap: string;
  headingSpacing: string;
  paragraphSpacing: string;
  sectionPaddingTop: string;
  sectionPaddingBottom: string;
  bottomBarPadding: string;
  hoursTableLayout: "table" | "paragraph";
  contactIconSize: string;
  contactIconStyle: "circular-outlined" | "plain";
  socialIconSize: string;
  socialIconStyle: "circular-outlined" | "plain";
  badgePlacement: "brand-column" | "none";
  badgeMaxHeight: string;
  badgeAlignment: "start" | "center";
  badgeSpacing: string;
  badgeImageFallbackText: boolean;
  legalBarLayout: "split" | "stacked";
  patternTreatment: "generic" | "imported" | "solid";
  backToTop: boolean;
  stackOrder: string[];
  variant: BrandDnaComponents["footerVariant"];
}

export interface HeroComponentDna {
  layout: BrandDnaComponents["heroVariant"];
  textColumnRatio: string;
  imageColumnRatio: string;
  verticalAlign: "center" | "start";
  gap: string;
  paddingY: string;
  maxTextWidth: string;
  variant: BrandDnaComponents["heroVariant"];
}

import type { MediaTextLayoutThresholds } from "./pharmacyMediaTextLayoutResolver.ts";

export interface SplitSectionComponentDna {
  textRatio: string;
  imageRatio: string;
  desktopLayout: "text-left" | "image-left" | "stacked";
  mobileStack: "text-first" | "image-first";
  verticalAlign: "center" | "start";
  gap: string;
  paddingY: string;
  maxWidth: string;
  sectionSpacing: string;
  variant: BrandDnaComponents["mediaTextVariant"];
  flowVariant: BrandDnaComponents["sectionFlowVariant"];
  compositionMode: "fixed-split" | "media-float-flow";
  contentContinuation: boolean;
  layoutThresholds: MediaTextLayoutThresholds;
}

export interface CtaButtonStyleDna {
  style: "filled" | "outline";
  background: string;
  foreground: string;
  border: string;
  padding: string;
  radius: string;
  fontWeight: string;
}

export interface ContactTreatmentDna {
  role: "plain" | "linked" | "boxed" | "top-bar" | "hero-contact" | "footer-contact";
  background: string;
  foreground: string;
  showIcon: boolean;
  clickable: boolean;
  padding: string;
  radius: string;
}

export interface ImageSlotTreatmentDna {
  widthRatio: string;
  maxHeight: string;
  aspectRatio: string;
}

export interface ImageSlotTreatmentsDna {
  hero: ImageSlotTreatmentDna;
  support: ImageSlotTreatmentDna;
  trust: ImageSlotTreatmentDna;
  conversion: ImageSlotTreatmentDna;
  local: ImageSlotTreatmentDna;
  fullWidthFeature: ImageSlotTreatmentDna;
}

export interface ImageComponentDna {
  heroAspectRatio: string;
  inlineAspectRatio: string;
  sectionAspectRatio: string;
  maxHeight: string;
  borderRadius: string;
  shadow: string;
  splitRatio: string;
  alignment: "center" | "start" | "end";
  objectFit: "cover" | "contain";
  responsiveCrop: boolean;
  variant: BrandDnaComponents["imageTreatmentVariant"];
  slotTreatments: ImageSlotTreatmentsDna;
}

export interface MapComponentDna {
  minHeight: string;
  borderRadius: string;
  containerPadding: string;
  headingStyle: "section-head" | "inline";
  gap: string;
  layout: BrandDnaComponents["mapContactVariant"];
  iframeBorder: string;
  stackBelow: string;
  mapColumnRatio: string;
  detailsColumnRatio: string;
  stackOrder: "map-first" | "details-first";
}

export interface CardComponentDna {
  radius: string;
  shadow: string;
  padding: string;
  headingSpacing: string;
  iconPlacement: "top" | "left" | "none";
  border: string;
  hoverTreatment: "lift" | "none" | "border";
  columns: number;
  gap: string;
  variant: BrandDnaComponents["serviceCardVariant"];
}

export interface CtaComponentDna {
  buttonFamily: "filled-outline" | "filled-only" | "outline-only";
  spacing: string;
  alignment: "center" | "left" | "split";
  dualCta: boolean;
  iconSpacing: string;
  buttonRadius: string;
  bandPadding: string;
  variant: BrandDnaComponents["ctaVariant"];
  headerPrimary: CtaButtonStyleDna;
  headerSecondary: CtaButtonStyleDna;
}

export interface FaqComponentDna {
  style: BrandDnaComponents["faqVariant"];
  itemSpacing: string;
  icon: "chevron" | "plus" | "none";
  headingSize: string;
  bodySpacing: string;
  padding: string;
}

export interface ProcessComponentDna {
  layout: BrandDnaComponents["processVariant"];
  stepSpacing: string;
  numberStyle: "badge" | "circle" | "plain";
  connector: boolean;
  cardPadding: string;
  columns: number;
}

export interface TrustComponentDna {
  layout: BrandDnaComponents["trustPanelVariant"];
  cardColumns: number;
  badgeLayout: "inline" | "stacked";
  evidenceLayout: "grid" | "list";
  iconTreatment: "circular-outlined" | "plain";
  spacing: string;
  gap: string;
}

export interface TableComponentDna {
  rowBorder: string;
  cellPadding: string;
  headerWeight: string;
  columnAlign: "split" | "left";
  stripe: boolean;
}

/** Canonical Component DNA bundle — presentation only. */
export interface ComponentDna {
  header: HeaderComponentDna;
  footer: FooterComponentDna;
  hero: HeroComponentDna;
  splitSection: SplitSectionComponentDna;
  image: ImageComponentDna;
  map: MapComponentDna;
  card: CardComponentDna;
  cta: CtaComponentDna;
  contact: ContactTreatmentDna;
  faq: FaqComponentDna;
  process: ProcessComponentDna;
  trust: TrustComponentDna;
  table: TableComponentDna;
  /** Legacy variant bridge for gradual migration. */
  variants: BrandDnaComponents;
}
