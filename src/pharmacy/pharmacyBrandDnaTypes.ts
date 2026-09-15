/**
 * Brand DNA Engine — canonical visual identity model for every pharmacy tenant.
 * Renderers consume resolved Brand DNA from tenant storage; they never scan websites.
 */
import type { NavLink } from "../generator/brandImporter.ts";
import type {
  BrandDnaCompletenessScore,
  BrandDnaConflict,
  BrandDnaFooterBlock,
  BrandDnaFooterEvidence,
  BrandDnaMapConfig,
  BrandDnaNavigationBlock,
  BrandDnaSemanticColours,
  BrandDnaStyleEvidenceSample,
  BrandDnaTypographyRoles,
} from "./pharmacyBrandDnaSemanticTypes.ts";
import type { BrandDnaComponentEvidence, BrandDnaComponents } from "./pharmacyBrandDnaComponentTypes.ts";
import type { ComponentDna } from "./pharmacyComponentDnaTypes.ts";

/** Legacy frozen file version (website import output). */
export const BRAND_DNA_VERSION = "brand-dna-v1";

/** Resolved engine model version (full platform layer). */
export const BRAND_DNA_ENGINE_VERSION = "brand-dna-engine-v1";

export interface BrandDnaTypography {
  headingFont: string;
  bodyFont: string;
  headingWeight: string;
  bodyWeight: string;
  h1Scale: string;
  h2Scale: string;
  h3Size: string;
  bodySize: string;
}

export interface BrandDnaSpacing {
  sectionY: string;
  sectionX: string;
  contentGap: string;
  stackGap: string;
  inlineGap: string;
  heroPadding: string;
  containerMax: string;
}

export interface BrandDnaLayout {
  headerLayout: "standard" | "with-top-bar";
  topInfoBar: boolean;
  navigationStyle: "inline" | "compact" | "multi-link";
  heroLayout: "split" | "centered";
  footerLayout: "multi-column" | "minimal";
  logoMaxHeight: string;
}

export interface BrandDnaImagery {
  heroAspectRatio: string;
  supportAspectRatio: string;
  conversionAspectRatio: string;
  imageRadius: string;
  objectFit: "cover" | "contain";
  imageStyle: string;
}

export interface BrandDnaCards {
  radius: string;
  border: string;
  shadow: string;
  padding: string;
  gap: string;
  background: string;
}

export interface BrandDnaButtons {
  radius: string;
  weight: string;
  shadow: boolean;
  minHeight: string;
  paddingX: string;
  paddingY: string;
  primaryVariant: "solid" | "gradient";
  secondaryVariant: "outline" | "ghost";
}

export interface BrandDnaNavigation {
  links: NavLink[];
  /** Customer-facing header/footer navigation — never service inventory. */
  confirmedItems: NavLink[];
  style: "inline" | "compact" | "multi-link";
  ctaText: string;
  ctaUrl: string;
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  logoMaxHeight: string;
}

export interface BrandDnaFooter {
  links: NavLink[];
  confirmedItems?: NavLink[];
  legalItems?: NavLink[];
  layout: "multi-column" | "minimal";
  showLogo: boolean;
  showAddress: boolean;
  showPhone: boolean;
}

export interface BrandDnaIcons {
  radius: string;
  style: "rounded" | "square" | "circle";
  size: string;
}

export interface BrandDnaForms {
  fieldRadius: string;
  fieldBorder: string;
  fieldPadding: string;
  labelWeight: string;
  focusRing: string;
}

export interface BrandDnaTrustPanels {
  cardRadius: string;
  itemStyle: "pill" | "card" | "minimal";
  gridColumns: number;
  iconStyle: "rounded" | "square" | "circle";
}

export interface BrandDnaMaps {
  minHeight: string;
  borderRadius: string;
  border: string;
  shadow: string;
  googlePlaceId?: string;
  latitude?: number | null;
  longitude?: number | null;
  canonicalAddress?: string;
  embedMode?: BrandDnaMapConfig["embedMode"];
  fallbackMode?: BrandDnaMapConfig["fallbackMode"];
}

export interface BrandDnaTables {
  headerBackground: string;
  rowBorder: string;
  cellPadding: string;
  stripeBackground: string;
}

export interface BrandDnaCtaStyles {
  bandStyle: "gradient" | "solid" | "outline";
  buttonRadius: string;
  alignment: "center" | "left";
  stackOnMobile: boolean;
}

export interface BrandDnaRadius {
  sm: string;
  md: string;
  lg: string;
  xl: string;
  pill: string;
}

export interface BrandDnaShadows {
  sm: string;
  md: string;
  lg: string;
  card: string;
}

export interface BrandDnaAnimations {
  enabled: boolean;
  duration: string;
  easing: string;
  hoverLift: string;
}

export interface BrandDnaResponsive {
  breakpointMd: string;
  breakpointSm: string;
  stackCardsBelow: string;
  stackNavBelow: string;
  fluidType: boolean;
}

export interface BrandDnaSurfaceStyle {
  buttonRadius: string;
  buttonWeight: string;
  buttonShadow: boolean;
  cardRadius: string;
  cardBorder: string;
  cardShadow: string;
  sectionPadding: string;
  heroPadding: string;
  iconRadius: string;
  iconStyle: "rounded" | "square" | "circle";
}

export interface BrandDnaTrustCta {
  trustCardRadius: string;
  trustItemStyle: "pill" | "card" | "minimal";
  ctaBandStyle: "gradient" | "solid" | "outline";
  ctaButtonRadius: string;
}

export interface BrandDnaColours {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  heading: string;
  /** Primary heading treatment — usually brand green. */
  headingPrimary: string;
  /** Secondary heading accent — usually brand blue. */
  headingSecondary: string;
  body: string;
  muted: string;
  button: string;
  buttonText: string;
  headerBackground: string;
  headerText: string;
  footerBackground: string;
  footerText: string;
  footerLink: string;
  footerAccent: string;
  sectionBackground: string;
  /** Sprint 5E — top information bar (distinct from main header). */
  topBarBackground?: string;
  topBarText?: string;
}

export interface BrandDnaProvenance {
  websiteImport: boolean;
  customerOverrides: boolean;
  platformDefaults: boolean;
  resolvedAt: string;
}

export type BrandDnaSource =
  | "website-import"
  | "brand-profile"
  | "customer-override"
  | "manual"
  | "platform-default";

/** Full Brand DNA Engine model — visual source for every generated page. */
export interface BrandDNA {
  version: typeof BRAND_DNA_ENGINE_VERSION;
  slug: string;
  sourceUrl: string;
  frozenAt: string;
  businessName: string;
  logoUrl: string;
  faviconUrl: string;
  colours: BrandDnaColours;
  typography: BrandDnaTypography;
  spacing: BrandDnaSpacing;
  layout: BrandDnaLayout;
  imagery: BrandDnaImagery;
  cards: BrandDnaCards;
  buttons: BrandDnaButtons;
  navigation: BrandDnaNavigation;
  footer: BrandDnaFooter;
  icons: BrandDnaIcons;
  forms: BrandDnaForms;
  trustPanels: BrandDnaTrustPanels;
  maps: BrandDnaMaps;
  tables: BrandDnaTables;
  ctaStyles: BrandDnaCtaStyles;
  radius: BrandDnaRadius;
  shadows: BrandDnaShadows;
  animations: BrandDnaAnimations;
  responsive: BrandDnaResponsive;
  /** Legacy render bridge — derived from cards/buttons/icons. */
  surfaces: BrandDnaSurfaceStyle;
  /** Legacy render bridge — derived from trustPanels/ctaStyles. */
  trustCta: BrandDnaTrustCta;
  /** Legacy header/footer nav arrays. */
  navigationLinks: NavLink[];
  footerLinks: NavLink[];
  headerCtaText: string;
  headerCtaUrl: string;
  topInfoBarText: string;
  components?: BrandDnaComponents;
  componentEvidence?: BrandDnaComponentEvidence;
  componentDna?: ComponentDna;
  confidence: {
    logo: number;
    colours: number;
    fonts: number;
    layout: number;
  };
  source: BrandDnaSource;
  provenance: BrandDnaProvenance;
  semanticColours?: BrandDnaSemanticColours;
  typographyRoles?: BrandDnaTypographyRoles;
  styleEvidence?: BrandDnaStyleEvidenceSample[];
  footerEvidence?: BrandDnaFooterEvidence;
  mapConfig?: BrandDnaMapConfig;
  conflicts?: BrandDnaConflict[];
  completeness?: BrandDnaCompletenessScore;
  detectedServiceLinks?: NavLink[];
}

/** Frozen website-import file shape (brand-dna.json on disk). */
export interface BrandDnaV1 {
  version: typeof BRAND_DNA_VERSION;
  slug: string;
  sourceUrl: string;
  frozenAt: string;
  businessName: string;
  logoUrl: string;
  faviconUrl: string;
  colours: BrandDnaColours;
  typography: BrandDnaTypography;
  layout: BrandDnaLayout;
  surfaces: BrandDnaSurfaceStyle;
  trustCta: BrandDnaTrustCta;
  navigationLinks: NavLink[];
  footerLinks: NavLink[];
  headerCtaText: string;
  headerCtaUrl: string;
  topInfoBarText: string;
  navigation?: BrandDnaNavigationBlock;
  footer?: BrandDnaFooterBlock;
  detectedServiceLinks?: NavLink[];
  semanticColours?: BrandDnaSemanticColours;
  typographyRoles?: BrandDnaTypographyRoles;
  styleEvidence?: BrandDnaStyleEvidenceSample[];
  footerEvidence?: BrandDnaFooterEvidence;
  mapConfig?: BrandDnaMapConfig;
  conflicts?: BrandDnaConflict[];
  completeness?: BrandDnaCompletenessScore;
  components?: BrandDnaComponents;
  componentEvidence?: BrandDnaComponentEvidence;
  componentDna?: ComponentDna;
  confidence: {
    logo: number;
    colours: number;
    fonts: number;
    layout: number;
  };
  source: "website-import" | "brand-profile" | "manual";
  sourceImportRevision?: string;
  websiteIntelligenceRevision?: string;
  generatedAt?: string;
  updatedAt?: string;
  approvedAt?: string;
}

/** Partial customer override layer (brand-dna-overrides.json). */
export type BrandDnaOverrides = Partial<
  Omit<BrandDNA, "version" | "provenance"> & {
    colours?: Partial<BrandDnaColours>;
    semanticColours?: Partial<BrandDnaSemanticColours>;
    typography?: Partial<BrandDnaTypography>;
    typographyRoles?: Partial<BrandDnaTypographyRoles>;
    spacing?: Partial<BrandDnaSpacing>;
    layout?: Partial<BrandDnaLayout>;
    imagery?: Partial<BrandDnaImagery>;
    cards?: Partial<BrandDnaCards>;
    buttons?: Partial<BrandDnaButtons>;
    navigation?: Partial<BrandDnaNavigation>;
    footer?: Partial<BrandDnaFooter>;
    icons?: Partial<BrandDnaIcons>;
    forms?: Partial<BrandDnaForms>;
    trustPanels?: Partial<BrandDnaTrustPanels>;
    maps?: Partial<BrandDnaMaps>;
    tables?: Partial<BrandDnaTables>;
    ctaStyles?: Partial<BrandDnaCtaStyles>;
    radius?: Partial<BrandDnaRadius>;
    shadows?: Partial<BrandDnaShadows>;
    animations?: Partial<BrandDnaAnimations>;
    responsive?: Partial<BrandDnaResponsive>;
    surfaces?: Partial<BrandDnaSurfaceStyle>;
    trustCta?: Partial<BrandDnaTrustCta>;
    components?: Partial<BrandDnaComponents>;
    componentEvidence?: BrandDnaComponentEvidence;
    componentDna?: Partial<ComponentDna>;
  }
>;
