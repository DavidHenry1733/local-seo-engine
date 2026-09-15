/**
 * Website Design Evidence — full-fidelity visual identity capture from rendered pages.
 */
export const WEBSITE_DESIGN_EVIDENCE_VERSION = "website-design-evidence-v1";

export interface DesignEvidenceItem {
  source: string;
  selector: string;
  computedValue: string;
  confidence: number;
  capturedAt: string;
  property?: string;
  role?: string;
}

export interface DesignEvidenceAsset {
  originalUrl: string;
  sourcePage: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  checksum: string;
  localPath: string;
  usageLocations: string[];
  classification: "logo" | "favicon" | "hero" | "service" | "background" | "icon" | "social" | "decorative" | "other";
  importStatus: "imported" | "skipped" | "failed";
  skipReason?: string;
}

export interface DesignEvidenceTypographyRole {
  fontFamily: string;
  fallbackStack: string;
  fontWeight: string;
  fontStyle: string;
  fontSize: string;
  lineHeight: string;
  letterSpacing: string;
  sourceUrl: string;
  loadingMethod: string;
  substituted: boolean;
  substitutionReason?: string;
  confidence: number;
  evidence: DesignEvidenceItem[];
}

export interface DesignEvidenceColourToken {
  role: string;
  hex: string;
  frequency: number;
  prominence: number;
  source: string;
  selector: string;
  confidence: number;
}

export interface DesignEvidenceNavigationItem {
  label: string;
  href: string;
  level: number;
  isDropdown: boolean;
  children: DesignEvidenceNavigationItem[];
}

export interface DesignEvidenceHeader {
  rowCount: number;
  hasTopBar: boolean;
  topBarText: string;
  logoSelector: string;
  logoUrl: string;
  logoMaxHeight: string;
  logoPosition: "left" | "center" | "right";
  navPlacement: "inline" | "below-logo" | "right";
  navItems: DesignEvidenceNavigationItem[];
  ctaLabels: string[];
  ctaHrefs: string[];
  phoneDisplay: string;
  emailDisplay: string;
  backgroundColour: string;
  textColour: string;
  borderColour: string;
  paddingY: string;
  paddingX: string;
  sticky: boolean;
  desktopBreakpoint: string;
  mobileMenuBehaviour: string;
  completeness: number;
  evidence: DesignEvidenceItem[];
}

export interface DesignEvidenceFooter {
  columnCount: number;
  columnOrder: string[];
  logoPlacement: "brand-column" | "none" | "bottom";
  logoUrl: string;
  backgroundColour: string;
  textColour: string;
  linkColour: string;
  headingFontSize: string;
  bodyFontSize: string;
  paddingTop: string;
  paddingBottom: string;
  columnGap: string;
  socialLinks: Array<{ label: string; href: string }>;
  legalLinks: Array<{ label: string; href: string }>;
  quickLinks: Array<{ label: string; href: string }>;
  copyrightText: string;
  openingHoursPresent: boolean;
  contactBlockPresent: boolean;
  mapRelationship: "embedded" | "link" | "none";
  mobileStackOrder: string[];
  completeness: number;
  evidence: DesignEvidenceItem[];
}

export interface DesignEvidenceButton {
  role: "primary" | "secondary" | "cta" | "nav";
  backgroundColour: string;
  textColour: string;
  borderColour: string;
  borderRadius: string;
  paddingX: string;
  paddingY: string;
  fontWeight: string;
  fontSize: string;
  hoverBackgroundColour: string;
  selector: string;
  confidence: number;
}

export interface DesignEvidenceLayout {
  maxContentWidth: string;
  sectionPaddingY: string;
  sectionPaddingX: string;
  gridGap: string;
  cardRadius: string;
  cardShadow: string;
  cardPadding: string;
  heroTextRatio: string;
  heroImageRatio: string;
  heroGap: string;
  heroPaddingY: string;
  imageAspectRatios: Record<string, string>;
  headingScale: Record<string, string>;
  whitespaceDensity: "compact" | "balanced" | "spacious";
  breakpoints: Record<string, string>;
  completeness: number;
}

export interface DesignEvidencePageSample {
  url: string;
  role: "branch" | "homepage" | "services" | "contact" | "shared";
  title: string;
  screenshotDesktop: string;
  screenshotMobile: string;
  viewportDesktop: { width: number; height: number };
  viewportMobile: { width: number; height: number };
}

export interface DesignEvidenceFallback {
  field: string;
  reason: string;
  fallbackUsed: string;
  severity: "info" | "warning" | "critical";
}

export interface WebsiteDesignEvidence {
  version: typeof WEBSITE_DESIGN_EVIDENCE_VERSION;
  sourceRevision: string;
  capturedAt: string;
  primaryUrl: string;
  pagesSampled: DesignEvidencePageSample[];
  screenshots: string[];
  assets: DesignEvidenceAsset[];
  typography: {
    body: DesignEvidenceTypographyRole;
    heading: DesignEvidenceTypographyRole;
    navigation: DesignEvidenceTypographyRole;
    button: DesignEvidenceTypographyRole;
    footer: DesignEvidenceTypographyRole;
  };
  colourSystem: {
    primary: DesignEvidenceColourToken[];
    secondary: DesignEvidenceColourToken[];
    accent: DesignEvidenceColourToken[];
    neutral: DesignEvidenceColourToken[];
    text: DesignEvidenceColourToken[];
    background: DesignEvidenceColourToken[];
    border: DesignEvidenceColourToken[];
    link: DesignEvidenceColourToken[];
    button: DesignEvidenceColourToken[];
    footer: DesignEvidenceColourToken[];
    header: DesignEvidenceColourToken[];
  };
  header: DesignEvidenceHeader;
  navigation: {
    items: DesignEvidenceNavigationItem[];
    hierarchyDepth: number;
    completeness: number;
    evidence: DesignEvidenceItem[];
  };
  footer: DesignEvidenceFooter;
  buttons: DesignEvidenceButton[];
  cards: Array<{ selector: string; radius: string; shadow: string; padding: string; gap: string }>;
  imagery: Array<{ url: string; role: string; aspectRatio: string; width: number; height: number }>;
  map: { present: boolean; embedType: string; selector: string; minHeight: string };
  contactBlocks: Array<{ type: string; selector: string; content: string }>;
  openingHours: { format: "table" | "list" | "paragraph" | "unknown"; selector: string; rawText: string };
  layout: DesignEvidenceLayout;
  responsiveRules: Array<{ breakpoint: string; rule: string; value: string }>;
  confidence: {
    overall: number;
    logo: number;
    colours: number;
    typography: number;
    header: number;
    footer: number;
    navigation: number;
    layout: number;
    imagery: number;
  };
  warnings: string[];
  fallbacks: DesignEvidenceFallback[];
}

function str(v: unknown): string {
  return String(v ?? "").trim();
}

export function emptyWebsiteDesignEvidence(primaryUrl: string): WebsiteDesignEvidence {
  const capturedAt = new Date().toISOString();
  const emptyTypo = (): DesignEvidenceTypographyRole => ({
    fontFamily: "",
    fallbackStack: "",
    fontWeight: "",
    fontStyle: "",
    fontSize: "",
    lineHeight: "",
    letterSpacing: "",
    sourceUrl: primaryUrl,
    loadingMethod: "unknown",
    substituted: false,
    confidence: 0,
    evidence: [],
  });
  return {
    version: WEBSITE_DESIGN_EVIDENCE_VERSION,
    sourceRevision: "",
    capturedAt,
    primaryUrl,
    pagesSampled: [],
    screenshots: [],
    assets: [],
    typography: {
      body: emptyTypo(),
      heading: emptyTypo(),
      navigation: emptyTypo(),
      button: emptyTypo(),
      footer: emptyTypo(),
    },
    colourSystem: {
      primary: [],
      secondary: [],
      accent: [],
      neutral: [],
      text: [],
      background: [],
      border: [],
      link: [],
      button: [],
      footer: [],
      header: [],
    },
    header: {
      rowCount: 0,
      hasTopBar: false,
      topBarText: "",
      logoSelector: "",
      logoUrl: "",
      logoMaxHeight: "",
      logoPosition: "left",
      navPlacement: "inline",
      navItems: [],
      ctaLabels: [],
      ctaHrefs: [],
      phoneDisplay: "",
      emailDisplay: "",
      backgroundColour: "",
      textColour: "",
      borderColour: "",
      paddingY: "",
      paddingX: "",
      sticky: false,
      desktopBreakpoint: "980px",
      mobileMenuBehaviour: "stacked",
      completeness: 0,
      evidence: [],
    },
    navigation: { items: [], hierarchyDepth: 0, completeness: 0, evidence: [] },
    footer: {
      columnCount: 0,
      columnOrder: [],
      logoPlacement: "none",
      logoUrl: "",
      backgroundColour: "",
      textColour: "",
      linkColour: "",
      headingFontSize: "",
      bodyFontSize: "",
      paddingTop: "",
      paddingBottom: "",
      columnGap: "",
      socialLinks: [],
      legalLinks: [],
      quickLinks: [],
      copyrightText: "",
      openingHoursPresent: false,
      contactBlockPresent: false,
      mapRelationship: "none",
      mobileStackOrder: [],
      completeness: 0,
      evidence: [],
    },
    buttons: [],
    cards: [],
    imagery: [],
    map: { present: false, embedType: "", selector: "", minHeight: "" },
    contactBlocks: [],
    openingHours: { format: "unknown", selector: "", rawText: "" },
    layout: {
      maxContentWidth: "",
      sectionPaddingY: "",
      sectionPaddingX: "",
      gridGap: "",
      cardRadius: "",
      cardShadow: "",
      cardPadding: "",
      heroTextRatio: "",
      heroImageRatio: "",
      heroGap: "",
      heroPaddingY: "",
      imageAspectRatios: {},
      headingScale: {},
      whitespaceDensity: "balanced",
      breakpoints: {},
      completeness: 0,
    },
    responsiveRules: [],
    confidence: {
      overall: 0,
      logo: 0,
      colours: 0,
      typography: 0,
      header: 0,
      footer: 0,
      navigation: 0,
      layout: 0,
      imagery: 0,
    },
    warnings: [],
    fallbacks: [],
  };
}

export function normalizeWebsiteDesignEvidence(raw: unknown): WebsiteDesignEvidence | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Partial<WebsiteDesignEvidence>;
  if (str(item.version) !== WEBSITE_DESIGN_EVIDENCE_VERSION) return null;
  return {
    ...emptyWebsiteDesignEvidence(str(item.primaryUrl)),
    ...item,
    version: WEBSITE_DESIGN_EVIDENCE_VERSION,
    pagesSampled: Array.isArray(item.pagesSampled) ? item.pagesSampled : [],
    screenshots: Array.isArray(item.screenshots) ? item.screenshots.map(String) : [],
    assets: Array.isArray(item.assets) ? item.assets : [],
    warnings: Array.isArray(item.warnings) ? item.warnings.map(String) : [],
    fallbacks: Array.isArray(item.fallbacks) ? item.fallbacks : [],
  } as WebsiteDesignEvidence;
}
