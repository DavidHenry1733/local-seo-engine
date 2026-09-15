/**
 * PharmaConnect platform defaults — lowest-priority Brand DNA layer.
 * Used when website import and customer overrides do not supply a value.
 */
import { BRAND_DNA_ENGINE_VERSION, type BrandDNA } from "./pharmacyBrandDnaTypes.ts";
import { DEFAULT_BRANDING } from "./pharmacyProfileDashboardConfig.ts";
import { getPharmaConnectBrandDnaComponentDefaults } from "./pharmacyBrandDnaComponentDefaults.ts";

export function getPharmaConnectBrandDnaDefaults(slug = "pharmaconnect"): BrandDNA {
  const primary = DEFAULT_BRANDING.brandPrimaryColor;
  const secondary = DEFAULT_BRANDING.brandSecondaryColor;
  const accent = DEFAULT_BRANDING.brandAccentColor;
  const background = DEFAULT_BRANDING.brandBackgroundColor;
  const heading = DEFAULT_BRANDING.brandTextColor;
  const muted = DEFAULT_BRANDING.brandMutedTextColor;
  const buttonRadius = DEFAULT_BRANDING.buttonRadius;
  const cardRadius = DEFAULT_BRANDING.cardRadius;

  return {
    version: BRAND_DNA_ENGINE_VERSION,
    slug,
    sourceUrl: "",
    frozenAt: "",
    businessName: "",
    logoUrl: "",
    faviconUrl: "",
    colours: {
      primary,
      secondary,
      accent,
      background,
      heading,
      headingPrimary: heading,
      headingSecondary: secondary,
      body: heading,
      muted,
      button: DEFAULT_BRANDING.brandCtaColor,
      buttonText: "#ffffff",
      headerBackground: background,
      headerText: heading,
      topBarBackground: primary,
      topBarText: "#ffffff",
      footerBackground: secondary,
      footerText: "#ffffff",
      footerLink: "#ffffff",
      footerAccent: "#cbd5e1",
      sectionBackground: "#f8fafc",
    },
    typography: {
      headingFont: DEFAULT_BRANDING.fontHeading.split(",")[0]?.trim() || "Poppins",
      bodyFont: DEFAULT_BRANDING.fontBody.split(",")[0]?.trim() || "Inter",
      headingWeight: DEFAULT_BRANDING.fontHeadingWeight,
      bodyWeight: DEFAULT_BRANDING.fontBodyWeight,
      h1Scale: "clamp(2.2rem,5vw,3.5rem)",
      h2Scale: "clamp(1.75rem,3.5vw,2.5rem)",
      h3Size: "22px",
      bodySize: "17px",
    },
    spacing: {
      sectionY: "72px",
      sectionX: "24px",
      contentGap: "28px",
      stackGap: "18px",
      inlineGap: "14px",
      heroPadding: "88px",
      containerMax: "1180px",
    },
    layout: {
      headerLayout: "standard",
      topInfoBar: false,
      navigationStyle: "inline",
      heroLayout: "split",
      footerLayout: "multi-column",
      logoMaxHeight: "48px",
    },
    imagery: {
      heroAspectRatio: "16/10",
      supportAspectRatio: "4/3",
      conversionAspectRatio: "21/9",
      imageRadius: cardRadius,
      objectFit: "cover",
      imageStyle: DEFAULT_BRANDING.imageStyle,
    },
    cards: {
      radius: cardRadius,
      border: "1px solid var(--line)",
      shadow: "var(--shadow2)",
      padding: "28px",
      gap: "20px",
      background: "#ffffff",
    },
    buttons: {
      radius: buttonRadius,
      weight: "700",
      shadow: true,
      minHeight: "52px",
      paddingX: "24px",
      paddingY: "14px",
      primaryVariant: "solid",
      secondaryVariant: "outline",
    },
    navigation: {
      links: [],
      confirmedItems: [],
      style: "inline",
      ctaText: "Book An Appointment",
      ctaUrl: "#contact",
      logoMaxHeight: "48px",
    },
    footer: {
      links: [],
      layout: "multi-column",
      showLogo: true,
      showAddress: true,
      showPhone: true,
    },
    icons: {
      radius: "14px",
      style: "rounded",
      size: "24px",
    },
    forms: {
      fieldRadius: buttonRadius,
      fieldBorder: "1px solid var(--line)",
      fieldPadding: "12px 16px",
      labelWeight: "600",
      focusRing: "0 0 0 3px color-mix(in srgb, var(--brand-primary) 25%, transparent)",
    },
    trustPanels: {
      cardRadius: cardRadius,
      itemStyle: "card",
      gridColumns: 4,
      iconStyle: "rounded",
    },
    maps: {
      minHeight: "320px",
      borderRadius: cardRadius,
      border: "1px solid var(--line)",
      shadow: "var(--shadow2)",
    },
    tables: {
      headerBackground: "#f8fafc",
      rowBorder: "1px solid var(--line)",
      cellPadding: "12px 14px",
      stripeBackground: "#fbfdff",
    },
    ctaStyles: {
      bandStyle: "gradient",
      buttonRadius: buttonRadius,
      alignment: "center",
      stackOnMobile: true,
    },
    radius: {
      sm: "8px",
      md: buttonRadius,
      lg: cardRadius,
      xl: "32px",
      pill: "999px",
    },
    shadows: {
      sm: "0 8px 24px rgba(15,23,42,.06)",
      md: "0 16px 40px rgba(15,23,42,.08)",
      lg: "0 24px 60px rgba(15,23,42,.12)",
      card: "var(--shadow2)",
    },
    animations: {
      enabled: true,
      duration: "220ms",
      easing: "cubic-bezier(0.4, 0, 0.2, 1)",
      hoverLift: "translateY(-2px)",
    },
    responsive: {
      breakpointMd: "980px",
      breakpointSm: "640px",
      stackCardsBelow: "980px",
      stackNavBelow: "980px",
      fluidType: true,
    },
    surfaces: {
      buttonRadius,
      buttonWeight: "700",
      buttonShadow: true,
      cardRadius,
      cardBorder: "1px solid var(--line)",
      cardShadow: "var(--shadow2)",
      sectionPadding: "72px",
      heroPadding: "88px",
      iconRadius: "14px",
      iconStyle: "rounded",
    },
    trustCta: {
      trustCardRadius: cardRadius,
      trustItemStyle: "card",
      ctaBandStyle: "gradient",
      ctaButtonRadius: buttonRadius,
    },
    navigationLinks: [],
    footerLinks: [],
    headerCtaText: "Book An Appointment",
    headerCtaUrl: "#contact",
    topInfoBarText: "",
    components: getPharmaConnectBrandDnaComponentDefaults(),
    confidence: {
      logo: 0,
      colours: 0,
      fonts: 0,
      layout: 0,
    },
    source: "platform-default",
    provenance: {
      websiteImport: false,
      customerOverrides: false,
      platformDefaults: true,
      resolvedAt: "",
    },
  };
}
