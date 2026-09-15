/**
 * Resolve Component DNA CTA and contact treatments from Brand DNA style evidence.
 */
import type { BrandDNA, BrandDnaV1 } from "./pharmacyBrandDnaTypes.ts";
import type { CtaButtonStyleDna, ContactTreatmentDna } from "./pharmacyComponentDnaTypes.ts";
import { resolveBrandButtonColor } from "./pharmacyBrandButtonColorResolver.ts";

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function styleEvidenceValue(brand: BrandDNA | BrandDnaV1, role: string): string {
  const samples = "styleEvidence" in brand ? brand.styleEvidence : undefined;
  if (!Array.isArray(samples)) return "";
  const match = samples.find((item) => str(item.role) === role);
  return str(match?.computedValue);
}

function isOutlineBackground(value: string): boolean {
  const normalized = value.toLowerCase();
  return !normalized || normalized === "transparent" || normalized === "#fff" || normalized === "#ffffff" || normalized === "white";
}

export function resolveHeaderCtaButtonStyles(
  brand: BrandDNA | BrandDnaV1,
  buttonRadius: string,
  buttonPadding: string,
): { headerPrimary: CtaButtonStyleDna; headerSecondary: CtaButtonStyleDna } {
  const semantic = brand.semanticColours;
  const resolvedAction = resolveBrandButtonColor({
    button: str(brand.colours.button),
    primary: str(brand.colours.primary),
    accent: str(brand.colours.accent),
    secondary: str(brand.colours.secondary),
  });
  const primaryBg =
    styleEvidenceValue(brand, "primary-button") ||
    resolvedAction ||
    str(brand.colours.primary) ||
    "#66a960";
  const primaryFg =
    styleEvidenceValue(brand, "primary-button-text") ||
    str(semantic?.primaryActionText) ||
    str(brand.colours.buttonText) ||
    "#ffffff";
  const secondaryBg = styleEvidenceValue(brand, "secondary-button");
  const secondaryFg = styleEvidenceValue(brand, "secondary-button-text") || primaryFg;
  const secondaryUsesOutline = isOutlineBackground(secondaryBg);

  const filledPrimary: CtaButtonStyleDna = {
    style: "filled",
    background: primaryBg,
    foreground: primaryFg,
    border: "none",
    padding: buttonPadding,
    radius: buttonRadius,
    fontWeight: str(brand.surfaces?.buttonWeight) || "700",
  };

  const headerSecondary: CtaButtonStyleDna = secondaryUsesOutline
    ? {
        style: "outline",
        background: "transparent",
        foreground: primaryBg,
        border: `2px solid ${primaryBg}`,
        padding: buttonPadding,
        radius: buttonRadius,
        fontWeight: str(brand.surfaces?.buttonWeight) || "700",
      }
    : {
        style: "filled",
        background: secondaryBg || primaryBg,
        foreground: secondaryFg,
        border: "none",
        padding: buttonPadding,
        radius: buttonRadius,
        fontWeight: str(brand.surfaces?.buttonWeight) || "700",
      };

  const navUsesPrimaryStyleForBoth =
    Boolean(brand.navigation?.primaryCta?.label) && Boolean(brand.navigation?.secondaryCta?.label);

  return {
    headerPrimary: filledPrimary,
    headerSecondary: navUsesPrimaryStyleForBoth ? { ...filledPrimary } : headerSecondary,
  };
}

export function resolveHeroContactTreatment(brand: BrandDNA | BrandDnaV1): ContactTreatmentDna {
  const semantic = brand.semanticColours;
  const resolvedAction = resolveBrandButtonColor({
    button: str(brand.colours.button),
    primary: str(brand.colours.primary),
    accent: str(brand.colours.accent),
    secondary: str(brand.colours.secondary),
  });
  const background =
    styleEvidenceValue(brand, "top-bar") ||
    str(semantic?.topBarBackground) ||
    str(brand.colours.primary) ||
    resolvedAction ||
    "#66a960";
  const foreground =
    styleEvidenceValue(brand, "top-bar-text") ||
    str(semantic?.primaryActionText) ||
    str(brand.colours.buttonText) ||
    "#ffffff";
  const radius = str(brand.surfaces?.buttonRadius) || "10px";

  return {
    role: "hero-contact",
    background,
    foreground,
    showIcon: true,
    clickable: true,
    padding: "12px 18px",
    radius,
  };
}

export function defaultImageSlotTreatments(
  heroAspect: string,
  inlineAspect: string,
  sectionAspect: string,
): import("./pharmacyComponentDnaTypes.ts").ImageSlotTreatmentsDna {
  return {
    hero: { widthRatio: "1fr", maxHeight: "520px", aspectRatio: heroAspect },
    support: { widthRatio: "1fr", maxHeight: "480px", aspectRatio: inlineAspect },
    trust: { widthRatio: "1fr", maxHeight: "480px", aspectRatio: inlineAspect },
    conversion: { widthRatio: "100%", maxHeight: "560px", aspectRatio: sectionAspect },
    local: { widthRatio: "1fr", maxHeight: "480px", aspectRatio: inlineAspect },
    fullWidthFeature: { widthRatio: "100%", maxHeight: "560px", aspectRatio: "21 / 9" },
  };
}
