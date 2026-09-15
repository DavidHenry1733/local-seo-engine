/**
 * Resolve Component DNA from Brand DNA — presentation only, no business content.
 */
import type { BrandDNA, BrandDnaV1 } from "./pharmacyBrandDnaTypes.ts";
import type { ComponentDna } from "./pharmacyComponentDnaTypes.ts";
import { getPharmaConnectComponentDnaDefaults } from "./pharmacyComponentDnaDefaults.ts";
import { normalizeComponentDna, normalizeLogoMaxHeight } from "./pharmacyComponentDnaNormalize.ts";
import { resolveBrandDnaComponents } from "./pharmacyBrandDnaComponentResolver.ts";
import { resolveProminentTelephoneCta, confirmedNavToProfileLinks, resolveConfirmedNavigationItems } from "./pharmacyBrandDnaConfirmedNavigation.ts";
import { getPharmacyComponentDnaPath } from "./masterAdminComponentDnaPersistenceService.ts";
import fs from "node:fs";
import {
  defaultImageSlotTreatments,
  resolveHeaderCtaButtonStyles,
  resolveHeroContactTreatment,
} from "./pharmacyComponentDnaStyleResolver.ts";

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function mergePartial<T extends Record<string, unknown>>(base: T, patch?: Partial<T>): T {
  if (!patch) return base;
  return { ...base, ...patch };
}

function loadPersistedComponentDna(slug: string): ComponentDna | null {
  const file = getPharmacyComponentDnaPath(slug);
  if (!fs.existsSync(file)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as ComponentDna & Record<string, unknown>;
    if (!raw.header || !raw.footer || !raw.variants) return null;
    return normalizeComponentDna(raw);
  } catch {
    return null;
  }
}

function mergePersistedComponentDna(inferred: ComponentDna, persisted: ComponentDna): ComponentDna {
  return normalizeComponentDna({
    ...inferred,
    ...persisted,
    variants: { ...inferred.variants, ...(persisted.variants || {}) },
    header: mergePartial(inferred.header, persisted.header),
    footer: mergePartial(inferred.footer, persisted.footer),
    hero: mergePartial(inferred.hero, persisted.hero),
    splitSection: mergePartial(inferred.splitSection, persisted.splitSection),
    image: mergePartial(inferred.image, persisted.image),
    map: mergePartial(inferred.map, persisted.map),
    card: mergePartial(inferred.card, persisted.card),
    cta: mergePartial(inferred.cta, persisted.cta),
    contact: mergePartial(inferred.contact, persisted.contact),
    faq: mergePartial(inferred.faq, persisted.faq),
    process: mergePartial(inferred.process, persisted.process),
    trust: mergePartial(inferred.trust, persisted.trust),
    table: mergePartial(inferred.table, persisted.table),
  });
}

export function resolveComponentDnaForRender(slug: string, brand: BrandDNA | BrandDnaV1): ComponentDna {
  const inferred = resolveComponentDna(brand);
  const persisted = loadPersistedComponentDna(slug);
  if (persisted) return mergePersistedComponentDna(inferred, persisted);
  return inferred;
}

export function resolveComponentDna(brand: BrandDNA | BrandDnaV1): ComponentDna {
  const stored = (brand as BrandDnaV1 & BrandDNA).componentDna;
  const variants = resolveBrandDnaComponents(brand);
  const defaults = getPharmaConnectComponentDnaDefaults();
  const layout = brand.layout;
  const surfaces = brand.surfaces;
  const footerEvidence = brand.footerEvidence;
  const imagery = "imagery" in brand ? brand.imagery : undefined;
  const maps = "maps" in brand ? brand.maps : undefined;
  const cards = "cards" in brand ? brand.cards : undefined;
  const tables = "tables" in brand ? brand.tables : undefined;
  const ctaStyles = "ctaStyles" in brand ? brand.ctaStyles : undefined;
  const spacing = "spacing" in brand ? brand.spacing : undefined;
  const responsive = "responsive" in brand ? brand.responsive : undefined;

  const withTopBar = layout.headerLayout === "with-top-bar" && layout.topInfoBar;
  const phoneTreatment = resolveProminentTelephoneCta(brand) ? "prominent" : "hidden";

  const headerVariant = variants.headerVariant;
  const logoPosition = headerVariant === "centred-logo-navigation" ? "center" : "left";
  const navGap =
    variants.navigationVariant === "horizontal-multi-link"
      ? "16px"
      : variants.navigationVariant === "horizontal-compact"
        ? "18px"
        : "24px";

  const heroReverse = variants.heroVariant === "split-image-left-text-right";
  const splitDesktop = heroReverse ? "image-left" : "text-left";

  const cardColumns =
    variants.serviceCardVariant === "card-grid-two" ? 2 : variants.serviceCardVariant === "card-led-band" ? 1 : 3;

  const processColumns = variants.processVariant === "compact-list" ? 1 : variants.processVariant === "timeline" ? 2 : 4;

  const mapLayout = variants.mapContactVariant;
  const buttonRadius = str(ctaStyles?.buttonRadius) || str(surfaces?.buttonRadius) || defaults.cta.buttonRadius;
  const buttonPadding = str(ctaStyles?.buttonPadding) || defaults.cta.spacing;
  const headerCtaStyles = resolveHeaderCtaButtonStyles(brand, buttonRadius, buttonPadding);
  const slotTreatments = defaultImageSlotTreatments(
    str(imagery?.heroAspectRatio) || defaults.image.heroAspectRatio,
    str(imagery?.supportAspectRatio) || defaults.image.inlineAspectRatio,
    str(imagery?.conversionAspectRatio) || defaults.image.sectionAspectRatio,
  );
  const compositionMode =
    variants.mediaTextVariant === "split-balanced" ||
    variants.sectionFlowVariant === "alternating-media" ||
    variants.mediaTextVariant === "split-wide-image"
      ? "media-float-flow"
      : "fixed-split";

  const imageRadius =
    variants.imageTreatmentVariant === "square-contained"
      ? "0"
      : variants.imageTreatmentVariant === "rounded-soft"
        ? str(surfaces?.cardRadius) || "32px"
        : str(surfaces?.cardRadius) || "10px";

  const resolved: ComponentDna = {
    variants,
    header: {
      ...defaults.header,
      logoPosition,
      logoMaxHeight: normalizeLogoMaxHeight(str(layout.logoMaxHeight) || defaults.header.logoMaxHeight, defaults.header.logoMaxHeight),
      navGap,
      navAlign: logoPosition === "center" ? "center" : "end",
      navFontSize: variants.navigationVariant === "horizontal-multi-link" ? "13px" : "14px",
      sticky: true,
      topBar: withTopBar || variants.topBarVariant === "contact-hours-strip",
      phoneTreatment,
      variant: headerVariant,
      topBarVariant: variants.topBarVariant,
      navigationVariant: variants.navigationVariant,
      mobileHeaderVariant: variants.mobileHeaderVariant,
      desktopBreakpoint: str(responsive?.stackNavBelow) || defaults.header.desktopBreakpoint,
      mobileBreakpoint: str(responsive?.breakpointSm) || defaults.header.mobileBreakpoint,
    },
    footer: {
      ...defaults.footer,
      columnOrder: footerEvidence?.columnOrder || defaults.footer.columnOrder,
      hoursTableLayout: footerEvidence?.openingHoursLayout === "table" ? "table" : "paragraph",
      patternTreatment:
        footerEvidence?.backgroundTreatment === "pattern-imported"
          ? "imported"
          : footerEvidence?.backgroundTreatment === "solid"
            ? "solid"
            : "generic",
      backToTop: footerEvidence?.backToTop ?? defaults.footer.backToTop,
      badgePlacement:
        (footerEvidence?.badgeAssets?.length || footerEvidence?.badges?.length || 0) > 0 ? "brand-column" : "none",
      badgeMaxHeight: str(surfaces?.iconRadius) ? "56px" : defaults.footer.badgeMaxHeight,
      badgeAlignment: defaults.footer.badgeAlignment,
      badgeSpacing: defaults.footer.badgeSpacing,
      badgeImageFallbackText: defaults.footer.badgeImageFallbackText,
      variant: variants.footerVariant,
      columnWidths:
        variants.footerVariant === "compact"
          ? "1fr 1fr"
          : variants.footerVariant === "three-column"
            ? "2fr 1fr 1.2fr"
            : str(footerEvidence?.columnWidths) || defaults.footer.columnWidths,
    },
    hero: {
      ...defaults.hero,
      layout: variants.heroVariant,
      variant: variants.heroVariant,
      textColumnRatio: "1fr",
      imageColumnRatio: "1fr",
      paddingY: str(surfaces?.heroPadding) || str(spacing?.heroPadding) || defaults.hero.paddingY,
      gap: variants.heroVariant === "centred-contained" ? "24px" : "48px",
    },
    splitSection: {
      ...defaults.splitSection,
      variant: variants.mediaTextVariant,
      flowVariant: variants.sectionFlowVariant,
      desktopLayout: splitDesktop,
      textRatio: "1fr",
      imageRatio: "1fr",
      compositionMode,
      contentContinuation: compositionMode === "media-float-flow",
      gap: str(spacing?.contentGap) || defaults.splitSection.gap,
      paddingY: str(spacing?.sectionY) || str(surfaces?.sectionPadding) || defaults.splitSection.paddingY,
      maxWidth: str(spacing?.containerMax) || defaults.splitSection.maxWidth,
    },
    image: {
      ...defaults.image,
      variant: variants.imageTreatmentVariant,
      heroAspectRatio: str(imagery?.heroAspectRatio) || defaults.image.heroAspectRatio,
      inlineAspectRatio: str(imagery?.supportAspectRatio) || defaults.image.inlineAspectRatio,
      sectionAspectRatio: str(imagery?.conversionAspectRatio) || defaults.image.sectionAspectRatio,
      borderRadius: str(imagery?.imageRadius) || imageRadius,
      objectFit: imagery?.objectFit || defaults.image.objectFit,
      maxHeight: slotTreatments.hero.maxHeight,
      shadow: str(surfaces?.cardShadow) || defaults.image.shadow,
      splitRatio: "1fr 1fr",
      slotTreatments,
    },
    map: {
      ...defaults.map,
      layout: mapLayout,
      minHeight: str(maps?.minHeight) || defaults.map.minHeight,
      borderRadius: str(maps?.borderRadius) || defaults.map.borderRadius,
      stackBelow: str(responsive?.stackCardsBelow) || defaults.map.stackBelow,
      mapColumnRatio: str(maps?.mapColumnRatio) || defaults.map.mapColumnRatio,
      detailsColumnRatio: str(maps?.detailsColumnRatio) || defaults.map.detailsColumnRatio,
      stackOrder: maps?.stackOrder === "map-first" ? "map-first" : defaults.map.stackOrder,
    },
    card: {
      ...defaults.card,
      variant: variants.serviceCardVariant,
      radius: str(cards?.radius) || str(surfaces?.cardRadius) || defaults.card.radius,
      shadow: str(cards?.shadow) || str(surfaces?.cardShadow) || defaults.card.shadow,
      padding: str(cards?.padding) || defaults.card.padding,
      border: str(cards?.border) || str(surfaces?.cardBorder) || defaults.card.border,
      gap: str(cards?.gap) || defaults.card.gap,
      columns: cardColumns,
    },
    cta: {
      ...defaults.cta,
      variant: variants.ctaVariant,
      buttonRadius,
      spacing: buttonPadding,
      alignment: ctaStyles?.alignment || (variants.ctaVariant === "contact-split" ? "split" : "center"),
      dualCta: variants.ctaVariant !== "centred-band",
      bandPadding: str(spacing?.sectionY) || defaults.cta.bandPadding,
      headerPrimary: headerCtaStyles.headerPrimary,
      headerSecondary: headerCtaStyles.headerSecondary,
    },
    contact: resolveHeroContactTreatment(brand),
    faq: {
      ...defaults.faq,
      style: variants.faqVariant,
      icon: variants.faqVariant === "accordion" ? "chevron" : "none",
      itemSpacing: variants.faqVariant === "compact-list" ? "10px" : "16px",
      padding: variants.faqVariant === "stacked-cards" ? "20px" : "14px",
    },
    process: {
      ...defaults.process,
      layout: variants.processVariant,
      connector: variants.processVariant === "timeline",
      numberStyle: variants.processVariant === "numbered-cards" ? "badge" : "circle",
      columns: processColumns,
    },
    trust: {
      ...defaults.trust,
      layout: variants.trustPanelVariant,
      cardColumns: variants.trustPanelVariant === "minimal-list" ? 1 : variants.trustPanelVariant === "card-grid" ? 4 : 2,
      evidenceLayout: variants.trustPanelVariant === "minimal-list" ? "list" : "grid",
    },
    table: {
      ...defaults.table,
      rowBorder: str(tables?.rowBorder) || defaults.table.rowBorder,
      cellPadding: str(tables?.cellPadding) || defaults.table.cellPadding,
    },
  };

  if (!stored) return normalizeComponentDna(resolved);

  return normalizeComponentDna({
    ...resolved,
    ...stored,
    variants: { ...resolved.variants, ...(stored.variants || {}) },
    header: mergePartial(resolved.header, stored.header),
    footer: mergePartial(resolved.footer, stored.footer),
    hero: mergePartial(resolved.hero, stored.hero),
    splitSection: mergePartial(resolved.splitSection, stored.splitSection),
    image: mergePartial(resolved.image, stored.image),
    map: mergePartial(resolved.map, stored.map),
    card: mergePartial(resolved.card, stored.card),
    cta: mergePartial(resolved.cta, stored.cta),
    contact: mergePartial(resolved.contact, stored.contact),
    faq: mergePartial(resolved.faq, stored.faq),
    process: mergePartial(resolved.process, stored.process),
    trust: mergePartial(resolved.trust, stored.trust),
    table: mergePartial(resolved.table, stored.table),
  });
}

export function componentDnaBodyAttributes(dna: ComponentDna): string {
  const v = dna.variants;
  return [
    `data-header-variant="${v.headerVariant}"`,
    `data-hero-variant="${v.heroVariant}"`,
    `data-section-flow="${v.sectionFlowVariant}"`,
    `data-split-variant="${v.mediaTextVariant}"`,
    `data-footer-variant="${v.footerVariant}"`,
    `data-map-contact-variant="${v.mapContactVariant}"`,
    `data-image-treatment="${v.imageTreatmentVariant}"`,
    `data-card-variant="${v.serviceCardVariant}"`,
    `data-cta-variant="${v.ctaVariant}"`,
    `data-faq-variant="${v.faqVariant}"`,
    `data-trust-variant="${v.trustPanelVariant}"`,
    `data-process-variant="${v.processVariant}"`,
    `data-split-composition="${dna.splitSection.compositionMode}"`,
    `data-split-continuation="${dna.splitSection.contentContinuation ? "true" : "false"}"`,
    `data-component-dna="v1"`,
  ].join(" ");
}

export function componentDnaRootVariables(dna: ComponentDna): string {
  const h = dna.header;
  const f = dna.footer;
  const hero = dna.hero;
  const img = dna.image;
  const map = dna.map;
  const card = dna.card;
  const cta = dna.cta;
  const split = dna.splitSection;
  const table = dna.table;
  const process = dna.process;
  const trust = dna.trust;
  return `:root{
--component-header-logo-max:min(${h.logoMaxHeight},56px);
--component-header-nav-gap:${h.navGap};
--component-header-cta-gap:${h.ctaGap};
--component-header-desktop-bp:${h.desktopBreakpoint};
--component-header-mobile-bp:${h.mobileBreakpoint};
--component-footer-columns:${f.columnWidths};
--component-footer-column-gap:${f.columnGap};
--component-footer-padding-top:${f.sectionPaddingTop};
--component-footer-bottom-padding:${f.bottomBarPadding};
--component-footer-contact-icon-size:${f.contactIconSize};
--component-footer-social-icon-size:${f.socialIconSize};
--component-hero-text-ratio:${hero.textColumnRatio};
--component-hero-image-ratio:${hero.imageColumnRatio};
--component-hero-gap:${hero.gap};
--component-hero-padding-y:${hero.paddingY};
--component-hero-max-text:${hero.maxTextWidth};
--component-split-text-ratio:${split.textRatio};
--component-split-image-ratio:${split.imageRatio};
--component-split-gap:${split.gap};
--component-split-max-width:${split.maxWidth};
--component-image-hero-aspect:${img.heroAspectRatio};
--component-image-inline-aspect:${img.inlineAspectRatio};
--component-image-section-aspect:${img.sectionAspectRatio};
--component-image-max-height:${img.maxHeight};
--component-image-radius:${img.borderRadius};
--component-image-object-fit:${img.objectFit};
--component-map-min-height:${map.minHeight};
--component-map-radius:${map.borderRadius};
--component-map-gap:${map.gap};
--component-card-radius:${card.radius};
--component-card-padding:${card.padding};
--component-card-gap:${card.gap};
--component-card-columns:${card.columns};
--component-card-heading-spacing:${card.headingSpacing};
--component-trust-columns:${trust.cardColumns};
--component-process-columns:${process.columns};
--component-process-gap:${process.stepSpacing};
--component-trust-gap:${trust.gap};
--component-cta-header-primary-bg:${cta.headerPrimary.background};
--component-cta-header-primary-fg:${cta.headerPrimary.foreground};
--component-cta-header-primary-border:${cta.headerPrimary.border};
--component-cta-header-primary-weight:${cta.headerPrimary.fontWeight};
--component-cta-header-secondary-bg:${cta.headerSecondary.background};
--component-cta-header-secondary-fg:${cta.headerSecondary.foreground};
--component-cta-header-secondary-border:${cta.headerSecondary.border};
--component-cta-header-secondary-weight:${cta.headerSecondary.fontWeight};
--component-contact-hero-bg:${dna.contact.background};
--component-contact-hero-fg:${dna.contact.foreground};
--component-contact-hero-padding:${dna.contact.padding};
--component-contact-hero-radius:${dna.contact.radius};
--component-image-hero-max-height:${img.slotTreatments.hero.maxHeight};
--component-image-support-max-height:${img.slotTreatments.support.maxHeight};
--component-image-trust-max-height:${img.slotTreatments.trust.maxHeight};
--component-image-conversion-max-height:${img.slotTreatments.conversion.maxHeight};
--component-image-local-max-height:${img.slotTreatments.local.maxHeight};
--component-image-fullwidth-max-height:${img.slotTreatments.fullWidthFeature.maxHeight};
--component-image-conversion-aspect:${img.slotTreatments.conversion.aspectRatio};
--component-image-fullwidth-aspect:${img.slotTreatments.fullWidthFeature.aspectRatio};
--component-map-column-ratio:${map.mapColumnRatio};
--component-map-details-ratio:${map.detailsColumnRatio};
--component-footer-badge-max-height:${f.badgeMaxHeight};
--component-footer-badge-spacing:${f.badgeSpacing};
--component-cta-radius:${cta.buttonRadius};
--component-cta-spacing:${cta.spacing};
--component-table-row-border:${table.rowBorder};
--component-table-cell-padding:${table.cellPadding};
}`;
}
