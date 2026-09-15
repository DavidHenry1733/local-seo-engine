/**
 * Brand Component DNA renderers — variant-driven header, footer, hero, map, and layout CSS.
 */
import type { PharmacyServicePageProfile } from "./pharmacyServicePageProfileContext.ts";
import { normalizeTelHref } from "./pharmacyServicePageProfileContext.ts";
import type { PharmacyTheme } from "./pharmacyThemeEngine.ts";
import { resolveProductionGphcDisplay, PRODUCTION_FALLBACKS } from "./pharmacyProfileProductionSafety.ts";
import type { BrandDnaComponents } from "./pharmacyBrandDnaComponentTypes.ts";
import { resolveBrandDnaComponents } from "./pharmacyBrandDnaComponentResolver.ts";
import type { BrandDNA, BrandDnaV1 } from "./pharmacyBrandDnaTypes.ts";
import { getPharmaConnectBrandDnaComponentDefaults } from "./pharmacyBrandDnaComponentDefaults.ts";
import { resolveBrandDnaForRender } from "./pharmacyBrandDnaEngine.ts";
import { renderBrandDnaFooterComponent } from "./pharmacyBrandDnaFooterRenderer.ts";
import { resolveComponentDna, resolveComponentDnaForRender } from "./pharmacyComponentDnaResolver.ts";
import { hasActivatedTenantDesignDna } from "./pharmacyTenantDnaRenderActivation.ts";
import { componentDnaLayoutCss } from "./pharmacyComponentDnaLayoutCss.ts";
import { getPharmaConnectComponentDnaDefaults } from "./pharmacyComponentDnaDefaults.ts";
import { renderHeroContactTreatment } from "./pharmacyComponentDnaContactRenderer.ts";
import type { CtaButtonStyleDna } from "./pharmacyComponentDnaTypes.ts";
import { resolveSiteChromeNavigation } from "./pharmacySiteChromeNavigationService.ts";
import { resolveSiteChromeColourTokens, siteChromeColourCssVariables } from "./pharmacySiteChromeColourService.ts";
import { tryLoadDesignIntelligence } from "./pharmacyDesignIntelligenceResolver.ts";
import { recordRenderFallback } from "./pharmacyTenantDnaRenderActivation.ts";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function normalizeHeaderNavUrl(url: string, profile?: PharmacyServicePageProfile): string {
  const normalized = String(url || "").trim();
  if (normalized === "#split-section-one") return "#service-definition";
  if (normalized === "#" && profile?.website) return profile.website;
  if (/localhost|127\.0\.0\.1/i.test(normalized)) return profile?.website || "#";
  return normalized;
}

function isValidNavUrl(url: string): boolean {
  const normalized = String(url || "").trim();
  if (!normalized || normalized === "#") return false;
  if (/^javascript:/i.test(normalized)) return false;
  if (/localhost|127\.0\.0\.1/i.test(normalized)) return false;
  return true;
}

function renderHeaderCtaButton(
  label: string,
  href: string,
  style: CtaButtonStyleDna,
  className: string,
  profile?: PharmacyServicePageProfile,
): string {
  return `<a class="${className} btn" data-cta-style="${esc(style.style)}" href="${esc(normalizeHeaderNavUrl(href, profile))}">${esc(label)}</a>`;
}

function formatTopBarHtml(text: string, profile: PharmacyServicePageProfile): string {
  const telHref = normalizeTelHref(profile.phone);
  const displayPhone = profile.displayPhone || profile.phone;
  let html = esc(text);
  if (profile.phone) {
    html = html.replace(
      /(\+?44\s?1709\s?361398|01709\s?361398|\+441709361398)/gi,
      `<a href="${esc(telHref)}">${esc(displayPhone)}</a>`,
    );
  }
  if (profile.email) {
    html = html.replace(
      new RegExp(esc(profile.email).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"),
      `<a href="mailto:${esc(profile.email)}">${esc(profile.email)}</a>`,
    );
  }
  return html;
}

export function resolvePageComponentDna(theme?: PharmacyTheme, brand?: BrandDNA | BrandDnaV1 | null, slug?: string) {
  const source = brand || theme?.brandDna;
  const resolvedSlug = slug || (source && "slug" in source ? str(source.slug) : "");
  if (source && resolvedSlug) return resolveComponentDnaForRender(resolvedSlug, source);
  if (source) return resolveComponentDna(source);
  return getPharmaConnectComponentDnaDefaults();
}

export function resolvePageComponents(theme?: PharmacyTheme, brand?: BrandDNA | BrandDnaV1 | null): BrandDnaComponents {
  return resolvePageComponentDna(theme, brand).variants;
}

export function renderBrandHeaderComponent(
  profile: PharmacyServicePageProfile,
  theme: PharmacyTheme | undefined,
  components: BrandDnaComponents,
  componentDna?: ReturnType<typeof resolvePageComponentDna>,
): string {
  const telHref = normalizeTelHref(profile.phone);
  const displayPhone = profile.displayPhone || profile.phone;
  const gphc = resolveProductionGphcDisplay(profile, { demoMode: false, trustDataStatus: "" });
  const gphcLabel = gphc.verified ? gphc.display : PRODUCTION_FALLBACKS.gphcShort;
  const logoSrc = profile.headerLogoUrl || profile.logoUrl;
  const logo = logoSrc
    ? `<img src="${esc(logoSrc)}" alt="${esc(profile.pharmacyName)}">`
    : `<span class="brand-text">${esc(profile.pharmacyName)}</span>${profile.town || gphcLabel ? `<span class="brand-tag">${esc(profile.town)}${gphcLabel ? ` · ${esc(gphcLabel)}` : ""}</span>` : ""}`;

  const pharmacyNameKey = profile.pharmacyName.trim().toLowerCase();
  const tenantDnaActive = hasActivatedTenantDesignDna(profile.slug);
  const designIntelligence = tenantDnaActive ? tryLoadDesignIntelligence(profile.slug) : null;
  const siteChromeNav = tenantDnaActive ? resolveSiteChromeNavigation(profile.slug) : null;

  const navLinks = (profile.headerNavLinks || [])
    .filter(
      (l) =>
        l.visible &&
        l.label.trim() &&
        isValidNavUrl(l.url) &&
        l.label.trim().toLowerCase() !== pharmacyNameKey,
    )
    .sort((a, b) => a.order - b.order);

  const brandNavFallback = (theme?.brandDna?.navigationLinks || [])
    .map((l, i) => ({
      label: str(l.label),
      url: str(l.href),
      order: i + 1,
      visible: true,
    }))
    .filter((l) => l.label && isValidNavUrl(l.url) && l.label.toLowerCase() !== pharmacyNameKey);

  const effectiveNavLinks = navLinks.length ? navLinks : brandNavFallback;

  function renderPrimaryNavLink(label: string, url: string): string {
    return `<a href="${esc(normalizeHeaderNavUrl(url, profile))}">${esc(label)}</a>`;
  }

  function renderDropdownNav(): string {
    if (!siteChromeNav?.dropdownParent && !siteChromeNav?.dropdownChildren.length) return "";
    const parent = siteChromeNav.dropdownParent;
    if (!parent) return "";
    const childLinks = siteChromeNav.dropdownChildren
      .map(
        (l) =>
          `<a class="nav-dropdown-item" href="${esc(normalizeHeaderNavUrl(l.href, profile))}">${esc(l.label)}</a>`,
      )
      .join("\n");
    return `<div class="nav-dropdown">
<button type="button" class="nav-dropdown-trigger" aria-haspopup="true" aria-expanded="false">${esc(parent.label)}</button>
<div class="nav-dropdown-menu" role="menu">${childLinks}</div>
</div>`;
  }

  function renderNavFromDesignIntelligenceTree(): string {
    const tree = siteChromeNav?.orderedPrimaryTree || [];
    if (!tree.length) return "";
    return tree
      .map((node) => {
        if (node.children.length) {
          const childLinks = node.children
            .map(
              (l) =>
                `<a class="nav-dropdown-item" href="${esc(normalizeHeaderNavUrl(l.href, profile))}">${esc(l.label)}</a>`,
            )
            .join("\n");
          return `<div class="nav-dropdown">
<button type="button" class="nav-dropdown-trigger" aria-haspopup="true" aria-expanded="false">${esc(node.label)}</button>
<div class="nav-dropdown-menu" role="menu">${childLinks}</div>
</div>`;
        }
        return renderPrimaryNavLink(node.label, node.href);
      })
      .join("\n");
  }

  const navHtml = designIntelligence || siteChromeNav?.orderedPrimaryTree?.length
    ? renderNavFromDesignIntelligenceTree()
    : siteChromeNav?.primaryNavigation.length
      ? `${siteChromeNav.primaryNavigation.map((l) => renderPrimaryNavLink(l.label, l.href)).join("\n")}
${renderDropdownNav()}`
      : effectiveNavLinks.length
        ? (recordRenderFallback("navigation", "profile-derived-nav-fallback", true),
          effectiveNavLinks.map((l) => renderPrimaryNavLink(l.label, l.url)).join("\n"))
        : (recordRenderFallback("navigation", "generic-nav-fallback", true),
          `<a href="#service-definition">Services</a>
<a href="#conditions-grid">Conditions</a>
<a href="#local-access">Contact</a>`);

  const headerCtaLabels = designIntelligence?.header.ctaBlock.labels.filter(Boolean) || [];
  const ctaText = headerCtaLabels[0] || profile.headerCtaText || "";
  const ctaUrl =
    designIntelligence && headerCtaLabels.length === 0
      ? ""
      : /contact the pharmacy/i.test(ctaText)
        ? isValidNavUrl(profile.website)
          ? profile.website
          : profile.phone
            ? telHref
            : "#contact"
        : /call/i.test(ctaText) && profile.phone
          ? telHref
          : isValidNavUrl(designIntelligence?.header.ctaBlock.hrefs[0] || profile.headerCtaUrl)
            ? designIntelligence?.header.ctaBlock.hrefs[0] || profile.headerCtaUrl
            : isValidNavUrl(profile.website)
              ? profile.website
              : "#contact";

  const dna = componentDna || resolvePageComponentDna(theme);
  const secondaryCtaText = str(profile.secondaryCtaText);
  const secondaryCtaUrl = str(profile.secondaryCtaUrl);
  const secondaryCtaHtml =
    secondaryCtaText && isValidNavUrl(secondaryCtaUrl)
      ? renderHeaderCtaButton(
          secondaryCtaText,
          secondaryCtaUrl,
          dna.cta.headerSecondary,
          "nav-cta-secondary",
          profile,
        )
      : "";

  const primaryCtaHtml =
    ctaText && ctaUrl ? renderHeaderCtaButton(ctaText, ctaUrl, dna.cta.headerPrimary, "nav-cta", profile) : "";
  const ctaGroupHtml =
    secondaryCtaHtml || primaryCtaHtml
      ? `<div class="nav-cta-group">${secondaryCtaHtml}${primaryCtaHtml}</div>`
      : "";

  const topBarText = theme?.brandDna?.topInfoBarText?.trim() || "";
  const tenantDna = tenantDnaActive;
  const colourTokens = tenantDna ? resolveSiteChromeColourTokens(profile.slug, theme?.brandDna) : null;
  const chromeColours = colourTokens ? siteChromeColourCssVariables(colourTokens) : "";
  const hasAnnouncementBar = Boolean(designIntelligence?.header.announcementBar);
  const showTopBar =
    hasAnnouncementBar &&
    topBarText &&
    (components.topBarVariant === "contact-hours-strip" ||
      (tenantDna && (theme?.brandDna?.layout?.topInfoBar || theme?.brandDna?.layout?.headerLayout === "with-top-bar")));
  const topBar = showTopBar
    ? `<div class="site-top-bar" data-component="pharmacy-top-info-bar" data-component-variant="${esc(components.topBarVariant === "none" ? "contact-hours-strip" : components.topBarVariant)}">
<div class="wrap"><span>${formatTopBarHtml(topBarText, profile)}</span></div>
</div>`
    : "";

  const navStyle =
    components.navigationVariant === "horizontal-multi-link"
      ? "multi-link"
      : components.navigationVariant === "horizontal-compact"
        ? "compact"
        : "inline";

  const headerClass =
    components.headerVariant === "topbar-white-navigation"
      ? "site-header site-header--white-nav"
      : components.headerVariant === "compact-navigation"
        ? "site-header site-header--compact"
        : "site-header";

  const phoneTreatment = dna.header.phoneTreatment;
  const phoneLink =
    phoneTreatment === "prominent" && profile.phone
      ? `<a class="nav-phone" href="${esc(telHref)}">${esc(displayPhone)}</a>`
      : "";

  const headerRows = siteChromeNav?.headerRowCount || designIntelligence?.header.rowCount || 1;
  const headerStyle = colourTokens ? ` style="${chromeColours}color:${colourTokens.primaryNavigationText};"` : "";
  const headerSticky = designIntelligence?.header.sticky ? ' data-header-sticky="true"' : "";
  const headerLogoSrc = designIntelligence?.header.logoBlock.logoUrl || logoSrc;
  const headerLogo = headerLogoSrc
    ? `<img src="${esc(headerLogoSrc)}" alt="${esc(profile.pharmacyName)}"${designIntelligence?.header.logoBlock.logoMaxHeight ? ` style="max-height:${esc(designIntelligence.header.logoBlock.logoMaxHeight)}"` : ""}>`
    : logo;
  const mobileMenuBehaviour = designIntelligence?.header.responsive.mobileMenuBehaviour || "stacked";

  return `${topBar}<header class="${headerClass}" data-component="pharmacy-page-header" data-component-variant="${esc(components.headerVariant)}" data-nav-style="${esc(navStyle)}" data-mobile-header="${esc(mobileMenuBehaviour === "stacked" ? "stacked-nav" : components.mobileHeaderVariant)}" data-logo-position="${esc(designIntelligence?.header.alignment.logo || dna.header.logoPosition)}" data-phone-treatment="${esc(phoneTreatment)}" data-header-rows="${headerRows}"${headerSticky}${headerStyle}>
<div class="wrap nav">
<a class="brand" href="${profile.website && isValidNavUrl(profile.website) ? esc(profile.website) : "#"}">${headerLogo}</a>
<nav class="nav-links" aria-label="Primary">
${navHtml}
</nav>
${phoneLink}
${ctaGroupHtml}
</div>
</header>`;
}

export function renderBrandFooterComponent(
  profile: PharmacyServicePageProfile,
  serviceName: string,
  components: BrandDnaComponents,
  slug?: string,
  componentDna?: ReturnType<typeof resolvePageComponentDna>,
): string {
  const brand = resolveBrandDnaForRender(slug || profile.slug);
  return renderBrandDnaFooterComponent(profile, serviceName, components, brand, componentDna);
}

export interface BrandHeroInput {
  serviceName: string;
  profile: PharmacyServicePageProfile;
  heroImageHtml: string;
  eyebrow: string;
  headline: string;
  intro: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel?: string;
  secondaryCtaHref?: string;
  componentDna?: ReturnType<typeof resolvePageComponentDna>;
}

export function renderBrandHeroComponent(components: BrandDnaComponents, input: BrandHeroInput): string {
  const reverse = components.heroVariant === "split-image-left-text-right";
  const gridClass = reverse ? "hero-grid hero-grid--reverse" : "hero-grid hero-grid--split-left";
  const secondary =
    input.secondaryCtaLabel && input.secondaryCtaHref
      ? `<a class="btn secondary" href="${esc(input.secondaryCtaHref)}">${esc(input.secondaryCtaLabel)}</a>`
      : "";
  // Omit redundant hero telephone chip when the primary CTA already contacts the pharmacy.
  const contactHtml = /contact the pharmacy|call\b/i.test(input.primaryCtaLabel)
    ? ""
    : renderHeroContactTreatment(input.profile, input.componentDna?.contact);

  const copy = `<div class="hero-copy">
<div class="eyebrow">${esc(input.eyebrow)}</div>
<h1>${esc(input.headline)}</h1>
<p>${esc(input.intro)}</p>
<div class="btns">
<a class="btn" href="${esc(input.primaryCtaHref)}">${esc(input.primaryCtaLabel)}</a>
${secondary}
</div>
${contactHtml}
</div>`;

  const media = `<div class="hero-media">${input.heroImageHtml}</div>`;

  return `<section class="hero" id="hero-section" data-template-block="hero" data-component-variant="${esc(components.heroVariant)}">
<div class="wrap ${gridClass}">
${reverse ? `${media}${copy}` : `${copy}${media}`}
</div>
</section>`;
}

export function brandComponentLayoutCss(componentDna: ReturnType<typeof resolvePageComponentDna>): string {
  return componentDnaLayoutCss(componentDna);
}

export function ensureBusinessNameInHeading(heading: string, pharmacyName: string): string {
  const h = heading.trim();
  const name = pharmacyName.trim();
  if (!h || !name) return h;
  if (h.toLowerCase().includes(name.toLowerCase())) return h;
  return `${h} — ${name}`;
}
