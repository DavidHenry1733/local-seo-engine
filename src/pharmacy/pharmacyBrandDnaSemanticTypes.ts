/**
 * Sprint 5E — semantic Brand DNA types (roles, evidence, conflicts, completeness).
 */
import type { NavLink } from "../generator/brandImporter.ts";

export interface BrandDnaSemanticColours {
  pageBackground: string;
  surface: string;
  headingPrimary: string;
  headingSecondary: string;
  bodyText: string;
  mutedText: string;
  primaryAction: string;
  primaryActionText: string;
  secondaryAction: string;
  secondaryActionText: string;
  link: string;
  iconPrimary: string;
  iconSecondary: string;
  border: string;
  topBarBackground: string;
  topBarText: string;
  headerBackground: string;
  headerText: string;
  footerBackground: string;
  footerText: string;
  footerLink: string;
  footerBottomBarBackground: string;
  trustBackground: string;
  cardBackground: string;
  mapPanelBackground: string;
}

export interface BrandDnaTypographyRole {
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  lineHeight: string;
  colour: string;
}

export interface BrandDnaTypographyRoles {
  h1: BrandDnaTypographyRole;
  h2: BrandDnaTypographyRole;
  h3: BrandDnaTypographyRole;
  body: BrandDnaTypographyRole;
  navigation: BrandDnaTypographyRole;
  button: BrandDnaTypographyRole;
  footer: BrandDnaTypographyRole;
}

export interface BrandDnaStyleEvidenceSample {
  role: string;
  pageUrl: string;
  selectorOrSignature: string;
  property: string;
  computedValue: string;
  extractionMethod: string;
  confidence: number;
  importedAt: string;
}

export interface BrandDnaNavCta {
  label: string;
  href: string;
}

export interface BrandDnaNavigationBlock {
  confirmedItems: NavLink[];
  primaryCta?: BrandDnaNavCta;
  secondaryCta?: BrandDnaNavCta;
  /** Prominent telephone CTA button — only when explicitly imported in header chrome. */
  telephoneCta?: BrandDnaNavCta;
}

export interface BrandDnaFooterBlock {
  confirmedItems: NavLink[];
  legalItems: NavLink[];
  showLogo?: boolean;
  columnCount?: number;
}

export interface BrandDnaFooterBadgeAsset {
  id: string;
  label: string;
  sourceUrl: string;
  altText: string;
  width?: number;
  height?: number;
  sourcePage: string;
  sourceSelector: string;
  confidence: number;
  importedAt: string;
  tenantSlug: string;
  usageStatus: "approved" | "pending" | "rejected";
}

export interface BrandDnaFooterEvidence {
  background: string;
  bottomBarBackground: string;
  headingColour: string;
  textColour: string;
  linkColour: string;
  columnCount: number;
  showLogo: boolean;
  hasDescriptionBlock: boolean;
  hasQuickLinks: boolean;
  hasOpeningHours: boolean;
  hasContactBlock: boolean;
  hasSocialLinks: boolean;
  hasRegulatoryRow: boolean;
  hasCopyrightRow: boolean;
  hasLegalLinks: boolean;
  backgroundPattern?: string;
  description?: string;
  badges?: string[];
  badgeAssets?: BrandDnaFooterBadgeAsset[];
  socialLinks?: NavLink[];
  openingHoursLayout?: "column" | "inline" | "block" | "table";
  contactLayout?: "column" | "card";
  columnWidths?: string;
  backgroundTreatment?: "pattern-generic" | "pattern-imported" | "solid";
  regulatoryRows?: string[];
  copyrightText?: string;
  attributionText?: string;
  backToTop?: boolean;
  columnOrder?: string[];
}

/** Structured footer component profile — Brand DNA presentation layer. */
export interface BrandDnaFooterProfile {
  variant?: string;
  background?: string;
  backgroundPattern?: string;
  bottomBarBackground?: string;
  textColour?: string;
  headingColour?: string;
  linkColour?: string;
  logo?: boolean;
  description?: string;
  badges?: string[];
  badgeAssets?: BrandDnaFooterBadgeAsset[];
  socialLinks?: NavLink[];
  confirmedItems?: NavLink[];
  legalItems?: NavLink[];
  openingHoursLayout?: "column" | "inline" | "block" | "table";
  contactLayout?: "column" | "card";
  columnWidths?: string;
  backgroundTreatment?: "pattern-generic" | "pattern-imported" | "solid";
  regulatoryRows?: string[];
  copyrightText?: string;
  attributionText?: string;
  backToTop?: boolean;
  columnCount?: number;
  columnOrder?: string[];
  hasOpeningHours?: boolean;
  hasContactBlock?: boolean;
  hasQuickLinks?: boolean;
  hasSocialLinks?: boolean;
  hasRegulatoryRow?: boolean;
  hasCopyrightRow?: boolean;
  hasLegalLinks?: boolean;
}

export interface BrandDnaMapConfig {
  googlePlaceId?: string;
  latitude?: number | null;
  longitude?: number | null;
  canonicalAddress?: string;
  embedMode: "coordinates" | "place-id" | "address-query" | "profile-embed";
  fallbackMode: "address-query" | "details-only" | "none";
}

export interface BrandDnaConflict {
  field: string;
  businessProfileValue: string;
  websiteEvidenceValue: string;
  resolution: "business-profile-wins";
  requiresCustomerConfirmation: boolean;
}

export type BrandDnaCompletenessStatus =
  | "extracted"
  | "partial"
  | "default-fallback"
  | "customer-confirmation-required";

export interface BrandDnaCompletenessCategory {
  category: string;
  status: BrandDnaCompletenessStatus;
  score: number;
  notes?: string;
}

export interface BrandDnaCompletenessScore {
  overall: number;
  categories: BrandDnaCompletenessCategory[];
  computedAt: string;
}
