/**
 * PharmaConnect Design System V1 — commercial lock (Growth Engine presentation).
 * Website import supplies identity tokens only; layout/chrome never clone customer sites.
 */
import type { PharmacyServicePageProfile } from "./pharmacyServicePageProfileContext.ts";
import { normalizeTelHref } from "./pharmacyServicePageProfileContext.ts";
import type { PharmacyTheme } from "./pharmacyThemeEngine.ts";
import { resolveProductionGphcDisplay, PRODUCTION_FALLBACKS } from "./pharmacyProfileProductionSafety.ts";
import { resolveSanitizedOpeningHours, validateRenderedHtmlPresentation } from "./pharmacyBusinessFieldSanitizer.ts";
import { resolveApprovedImportedWebsiteShell } from "./pharmacyImportedWebsiteShell.ts";

export const PHARMACONNECT_DESIGN_SYSTEM_V1_ID = "pharmaconnect-design-system-v1";
export const PHARMACONNECT_DESIGN_SYSTEM_V1_REVISION = "2026-08-05-service-page-presentation-lock";

/** Official V1 lock — disables tenant layout cloning (V2 feature). */
export const PHARMACONNECT_DESIGN_SYSTEM_V1_COMMERCIAL_LOCK = true;

/** Marker for the locked global service-page typography + alignment contract. */
export const PHARMACONNECT_SERVICE_PAGE_PRESENTATION_CONTRACT_ID =
  "cpr-design-system-lock-01-service-page-presentation";

export function isPharmaconnectDesignSystemV1Locked(): boolean {
  return PHARMACONNECT_DESIGN_SYSTEM_V1_COMMERCIAL_LOCK;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildPharmaconnectDesignSystemV1FontsLink(): string {
  return `<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@600;700;800&display=swap" rel="stylesheet"/>`;
}

export function pharmaconnectDesignSystemV1TypographyCss(): string {
  return `:root{
--font-heading:'Poppins',system-ui,-apple-system,Segoe UI,sans-serif;
--font-body:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
--heading-weight:700;
--body-weight:400;
--h1-scale:clamp(2.2rem,5vw,3.5rem);
--h2-scale:clamp(1.75rem,3.5vw,2.5rem);
--h3-size:22px;
--body-size:17px;
--h1-line-height:1.08;
--h2-line-height:1.15;
--h3-line-height:1.25;
--body-line-height:1.65;
}`;
}

/**
 * CPR-DESIGN-SYSTEM-LOCK-01 — single global service-page presentation contract.
 * Loaded last so Brand DNA / theme tokens cannot diverge typography, reading
 * widths, or narrative alignment per service.
 */
export function pharmaconnectDesignSystemV1ServicePagePresentationContractCss(): string {
  return `/* ${PHARMACONNECT_SERVICE_PAGE_PRESENTATION_CONTRACT_ID} */
:root{
--font-heading:'Poppins',system-ui,-apple-system,Segoe UI,sans-serif;
--font-body:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
--heading-font:var(--font-heading);
--body-font:var(--font-body);
--brand-font-heading:var(--font-heading);
--brand-font-body:var(--font-body);
--heading-weight:700;
--body-weight:400;
--h1-scale:clamp(2.2rem,5vw,3.5rem);
--h2-scale:clamp(1.75rem,3.5vw,2.5rem);
--h3-size:22px;
--body-size:17px;
--h1-line-height:1.08;
--h2-line-height:1.15;
--h3-line-height:1.25;
--body-line-height:1.65;
--reading-width-narrative:720px;
--reading-width-list:720px;
--section-head-max:720px;
--hero-intro-size:clamp(1.05rem,2.2vw,1.3125rem);
--card-body-size:16px;
--faq-q-size:18px;
--faq-a-size:var(--body-size);
--cta-intro-size:1.05rem;
}
body{font-family:var(--font-body);font-size:var(--body-size);line-height:var(--body-line-height);font-weight:var(--body-weight)}
h1,h2,h3,.section-head h2,.section-head h3,.card h3,.faq .faq-q,.faq h3,.cluster-title,.section-title{font-family:var(--font-heading);font-weight:var(--heading-weight)}
h1{font-size:var(--h1-scale);line-height:var(--h1-line-height)}
h2,.section-head h2{font-size:var(--h2-scale);line-height:var(--h2-line-height)}
h3,.card h3{font-size:var(--h3-size);line-height:var(--h3-line-height)}
p{font-size:var(--body-size);line-height:var(--body-line-height);max-width:var(--reading-width-narrative)}
.hero p{font-size:var(--hero-intro-size);max-width:var(--reading-width-narrative);line-height:var(--body-line-height)}
.section-head{max-width:var(--section-head-max);margin-bottom:34px}
.section-head.center{text-align:center;margin-left:auto;margin-right:auto}
.section-head.center>h2,.section-head.center>h3,.section-head.center>.tag,.section-head.center>p{text-align:center;margin-left:auto;margin-right:auto;max-width:var(--reading-width-narrative)}
/* Lists never centred — markers and text stay left inside constrained containers */
.section-head ul,.section-head ol,
.content-card.master-prose ul,.content-card.master-prose ol,
.narrative-prose ul,.narrative-prose ol{
text-align:left!important;list-style-position:outside;margin-left:auto;margin-right:auto;max-width:var(--reading-width-list);padding-left:1.35rem
}
.section-head ul li,.section-head ol li,
.content-card.master-prose li,.narrative-prose li{text-align:left!important}
.content-card.master-prose,.narrative-prose{
max-width:var(--reading-width-narrative);margin-left:auto;margin-right:auto;text-align:left;font-size:var(--body-size);line-height:var(--body-line-height)
}
.content-card.master-prose p,.narrative-prose p{text-align:left;max-width:none;margin:0 0 1rem;font-size:var(--body-size);line-height:var(--body-line-height)}
.content-card.master-prose h3,.narrative-prose h3{text-align:left;font-size:var(--h3-size);line-height:var(--h3-line-height)}
.card p,.equal-height-card p{font-size:var(--card-body-size);line-height:var(--body-line-height);text-align:left;max-width:none}
.faq .section-head{text-align:center;margin-left:auto;margin-right:auto;max-width:var(--section-head-max)}
.faq .faq-q{font-size:var(--faq-q-size);line-height:var(--h3-line-height);font-family:var(--font-heading);text-align:left}
.faq .faq-a{font-size:var(--faq-a-size);line-height:var(--body-line-height);text-align:left;max-width:none}
.cta-band{text-align:center}
.cta-band h2{font-size:var(--h2-scale);line-height:var(--h2-line-height);font-family:var(--font-heading)}
.cta-close,.cta-band>.wrap>p{font-size:var(--cta-intro-size);line-height:var(--body-line-height);max-width:var(--reading-width-narrative);margin-left:auto;margin-right:auto;text-align:center}
#conditions-grid .section-head{max-width:var(--section-head-max)}
.definition-split-copy p,.definition-split-continuation p,.safety-prose p,.trust-prose p{font-size:var(--body-size);line-height:var(--body-line-height)}
/* approved-core-page-service-overview-align-29j */
#service-definition .section-copy,
#service-definition .definition-split-copy,
#service-definition .section-opening-copy{text-align:center}
#service-definition .section-copy>.tag,
#service-definition .definition-split-copy>.tag,
#service-definition .section-opening-copy>.tag{display:inline-block;text-align:center;margin-left:auto;margin-right:auto}
#service-definition .section-copy>p,
#service-definition .definition-split-copy>p,
#service-definition .section-opening-copy>p{text-align:center;max-width:var(--reading-width-narrative);margin:0 auto 18px}
.pharmacy-local-details,.pharmacy-local-details p,.pharmacy-map-card,.site-header,.nav-links{text-align:left}
@media(max-width:960px){
:root{
--h1-scale:clamp(1.85rem,7vw,2.4rem);
--h2-scale:clamp(1.45rem,5vw,1.9rem);
--h3-size:20px;
--body-size:16px;
--card-body-size:15px;
--faq-q-size:17px;
--hero-intro-size:1.05rem;
--section-head-max:100%;
--reading-width-narrative:100%;
--reading-width-list:100%
}
}
`;
}

/**
 * Request-time presentation-contract refresh for stored approved core pages.
 * Replaces the locked contract CSS in <head> only; visible body HTML is unchanged.
 */
export function applyApprovedCorePagePresentationContractCss(html: string): string {
  const source = String(html || "");
  const css = pharmaconnectDesignSystemV1ServicePagePresentationContractCss();
  const marker = `/* ${PHARMACONNECT_SERVICE_PAGE_PRESENTATION_CONTRACT_ID} */`;
  const start = source.indexOf(marker);
  if (start === -1) {
    if (!/<\/head>/i.test(source)) return source;
    return source.replace(/<\/head>/i, `<style>\n${css}\n</style>\n</head>`);
  }
  const end = source.indexOf("</style>", start);
  if (end === -1) return source;
  return `${source.slice(0, start)}${css}${source.slice(end)}`;
}

export function pharmaconnectDesignSystemV1CommercialBodyLayoutCss(): string {
  return `.hero-grid,.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:center}
@media(max-width:960px){.hero-grid,.grid-2{grid-template-columns:1fr}}
.grid-3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:22px}
.grid-4{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px}
@media(max-width:960px){.grid-3,.grid-4{grid-template-columns:1fr}}
${servicePageBalancedCardGridCss()}
.definition-split-row,.grid-2.trust-split-row,.grid-2.safety-split{display:grid;grid-template-columns:1fr 1fr;gap:32px;align-items:start}
@media(max-width:960px){.definition-split-row,.grid-2.trust-split-row,.grid-2.safety-split{grid-template-columns:1fr}}
.hero-image-wrap{aspect-ratio:4/3;max-height:520px;width:100%;overflow:hidden;border-radius:var(--brand-radius-card,16px)}
.image-panel{aspect-ratio:4/3;max-height:480px;width:100%;overflow:hidden;border-radius:var(--brand-radius-card,16px)}
.image-panel img,.hero-image-wrap img{object-fit:cover;width:100%;height:100%;max-width:100%;display:block}
.conversion-image-section .image-panel,.support-image-band .support-band-media{aspect-ratio:21/9;max-height:420px;width:100%;overflow:hidden}
.pharmacy-local-grid{display:grid;grid-template-columns:1fr 1.6fr;gap:32px;align-items:stretch;margin-top:28px}
@media(max-width:960px){.pharmacy-local-grid{grid-template-columns:1fr}}
.pharmacy-map-card{background:#fff;border:1px solid var(--line,#e2e8f0);border-radius:12px;box-shadow:0 8px 24px rgba(15,23,42,.06);overflow:hidden;min-height:360px;height:100%;display:flex;flex-direction:column;width:100%}
.pharmacy-map-card iframe{width:100%;height:100%;min-height:360px;flex:1;border:0;border-radius:12px}
.card-grid-equal{align-items:stretch}
.card-grid-equal .equal-height-card{display:flex;flex-direction:column;height:100%}
.trust-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-top:24px}
@media(max-width:960px){.trust-grid{grid-template-columns:1fr}}
.site-header .brand img{max-height:min(48px,56px);width:auto;object-fit:contain}
`;
}

export function pharmaconnectDesignSystemV1PlatformLayoutCss(): string {
  return `.pc-v1-header .pc-v1-nav-toggle{display:none;background:transparent;border:0;font-size:28px;line-height:1;padding:8px;color:var(--header-text,var(--ink));cursor:pointer}
@media(max-width:960px){
.pc-v1-header .pc-v1-nav-toggle{display:inline-flex;align-items:center;justify-content:center}
.pc-v1-header .nav-links{display:none;flex-direction:column;align-items:stretch;width:100%;padding:12px 0 8px;gap:4px;border-top:1px solid var(--brand-border,var(--line));margin-top:8px}
.pc-v1-header.pc-v1-nav-open .nav-links{display:flex}
.pc-v1-header .header-row{flex-wrap:wrap}
}
.pc-v1-header .header-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 0}
.pc-v1-header .nav-links{display:flex;flex-wrap:wrap;align-items:center;gap:18px}
.pc-v1-header .nav-cta{margin-left:4px}
.pc-v1-footer .footer-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:28px;padding:48px 0 32px}
@media(max-width:960px){.pc-v1-footer .footer-grid{grid-template-columns:1fr 1fr}}
@media(max-width:640px){.pc-v1-footer .footer-grid{grid-template-columns:1fr}}
.pc-v1-footer .footer-bottom{border-top:1px solid color-mix(in srgb,var(--brand-footer-text,#fff) 18%,transparent);padding:18px 0;font-size:13px;opacity:.92}
.pc-v1-footer .footer-map{margin-top:12px;border-radius:12px;overflow:hidden;border:1px solid color-mix(in srgb,var(--brand-footer-text,#fff) 12%,transparent)}
.pc-v1-footer .footer-map iframe{display:block;width:100%;min-height:180px;border:0}
`;
}

export function servicePageBalancedCardGridCss(): string {
  return `/* service-page-card-grid-balance */
.card-grid-equal[data-card-count="1"]{grid-template-columns:minmax(0,640px);justify-content:center}
.card-grid-equal[data-card-count="2"]{grid-template-columns:repeat(2,minmax(0,1fr))}
.card-grid-equal[data-card-count="3"]{grid-template-columns:repeat(3,minmax(0,1fr))}
.card-grid-equal.grid-2[data-card-count="4"]{grid-template-columns:repeat(2,minmax(0,1fr))}
.card-grid-equal[data-card-count="5"]{grid-template-columns:repeat(6,minmax(0,1fr))}
.card-grid-equal[data-card-count="5"]>.card:nth-child(-n+3){grid-column:span 2}
.card-grid-equal[data-card-count="5"]>.card:nth-child(4){grid-column:2 / span 2}
.card-grid-equal[data-card-count="5"]>.card:nth-child(5){grid-column:4 / span 2}
.card-grid-equal[data-card-count="6"]{grid-template-columns:repeat(3,minmax(0,1fr))}
@media(max-width:960px){
.card-grid-equal[data-card-count]{grid-template-columns:1fr;max-width:none}
.card-grid-equal[data-card-count="5"]>.card{grid-column:auto}
}`;
}

function platformNavLinks(profile: PharmacyServicePageProfile): Array<{ label: string; href: string }> {
  const links: Array<{ label: string; href: string }> = [
    { label: "Services", href: "#service-definition" },
  ];
  if (profile.nhsServicesAvailable) links.push({ label: "NHS Services", href: "#nhs-services" });
  if (profile.privateServicesAvailable) links.push({ label: "Private Services", href: "#private-services" });
  links.push({ label: "About", href: "#trust" });
  links.push({ label: "Contact", href: profile.phone ? normalizeTelHref(profile.phone) : "#local-access" });
  return links;
}

function resolvePrimaryCta(profile: PharmacyServicePageProfile): { label: string; href: string } {
  const label = profile.headerCtaText?.trim() || profile.primaryCta?.trim() || "Book consultation";
  const website = String(profile.website || "").trim();
  const tel = profile.phone ? normalizeTelHref(profile.phone) : "";
  if (/contact the pharmacy/i.test(label)) {
    return {
      label,
      href: /^https?:\/\//i.test(website) ? website : tel || "#local-access",
    };
  }
  const href =
    profile.headerCtaUrl?.trim() ||
    profile.bookingUrl?.trim() ||
    (profile.phone ? normalizeTelHref(profile.phone) : "#local-access");
  return { label, href };
}

export function renderPharmaconnectDesignSystemV1Header(
  profile: PharmacyServicePageProfile,
  _theme?: PharmacyTheme,
): string {
  const shell = resolveApprovedImportedWebsiteShell(profile.slug);
  const telHref = normalizeTelHref(profile.phone);
  const displayPhone = profile.displayPhone || profile.phone;
  const logoSrc = shell?.logoUrl || profile.headerLogoUrl || profile.logoUrl;
  const logo = logoSrc
    ? `<img src="${esc(logoSrc)}" alt="${esc(profile.pharmacyName)} logo">`
    : `<span class="brand-text">${esc(profile.pharmacyName)}</span>`;
  const navLinks = shell?.navigation.length ? shell.navigation : platformNavLinks(profile);
  const nav = navLinks.map((l) => `<a href="${esc(l.href)}">${esc(l.label)}</a>`).join("");
  const cta = shell?.cta || (shell ? null : resolvePrimaryCta(profile));
  const phoneLink = shell
    ? ""
    : profile.phone
      ? `<a class="header-phone nav-phone" href="${esc(telHref)}">${esc(displayPhone)}</a>`
      : "";
  const ctaHtml = cta ? `<a class="nav-cta btn" href="${esc(cta.href)}">${esc(cta.label)}</a>` : "";
  const primary = shell?.colours.primary || _theme?.primaryColor || "";
  const secondary = shell?.colours.secondary || _theme?.secondaryColor || "";
  const accent = shell?.colours.accent || _theme?.accentColor || "";
  const ctaColour = shell?.colours.primary || _theme?.ctaColor || "";
  const heading = _theme?.headingColor || "";
  const colourAttrs = primary
    ? ` data-pharmaconnect-colour-tokens="v1" data-imported-website-shell="${shell ? "design-intelligence-v1" : "generic-fallback"}" data-brand-primary="${esc(primary)}" data-brand-secondary="${esc(secondary)}" data-brand-accent="${esc(accent)}" data-brand-cta="${esc(ctaColour)}" data-brand-heading="${esc(heading)}"`
    : ` data-pharmaconnect-colour-tokens="v1" data-imported-website-shell="${shell ? "design-intelligence-v1" : "generic-fallback"}"`;

  return `<header class="site-header pc-v1-header" data-pharmaconnect-component="platform-header-v1" data-design-system="${PHARMACONNECT_DESIGN_SYSTEM_V1_ID}"${colourAttrs}>
<div class="wrap">
<div class="header-row">
<a class="brand" href="${profile.website ? esc(profile.website) : "#"}">${logo}</a>
<button type="button" class="pc-v1-nav-toggle" aria-label="Open menu" onclick="this.closest('.pc-v1-header').classList.toggle('pc-v1-nav-open')">☰</button>
<nav class="nav-links" aria-label="Primary">
${nav}
${phoneLink}
${ctaHtml}
</nav>
</div>
</div>
</header>`;
}

function footerLinkList(title: string, links: Array<{ label: string; href: string }>): string {
  if (!links.length) return "";
  return `<div><h3>${esc(title)}</h3><ul class="clean">${links.map((l) => `<li><a href="${esc(l.href)}">${esc(l.label)}</a></li>`).join("")}</ul></div>`;
}

export function renderPharmaconnectDesignSystemV1Footer(
  profile: PharmacyServicePageProfile,
  serviceName: string,
  _theme?: PharmacyTheme,
): string {
  void _theme;
  const shell = resolveApprovedImportedWebsiteShell(profile.slug);
  const telHref = normalizeTelHref(profile.phone);
  const displayPhone = profile.displayPhone || profile.phone;
  const gphc = resolveProductionGphcDisplay(profile, { demoMode: false, trustDataStatus: "" });
  const gphcLabel = gphc.verified ? gphc.display : "";
  const logoSrc = shell?.logoUrl || profile.footerLogoUrl || profile.headerLogoUrl || profile.logoUrl;
  const logo = logoSrc
    ? `<img src="${esc(logoSrc)}" alt="${esc(profile.pharmacyName)}" style="max-height:44px;width:auto;margin-bottom:12px">`
    : `<strong>${esc(profile.pharmacyName)}</strong>`;
  const hours = resolveSanitizedOpeningHours(profile);
  const mapBlock = profile.googleMapsEmbedUrl
    ? `<div class="footer-map"><iframe title="Map — ${esc(profile.pharmacyName)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="${esc(profile.googleMapsEmbedUrl)}"></iframe></div>`
    : "";

  const serviceLinks: Array<{ label: string; href: string }> = shell
    ? []
    : [{ label: serviceName, href: "#main-content" }];
  if (!shell && profile.nhsServicesAvailable) serviceLinks.push({ label: "NHS Services", href: "#nhs-services" });
  if (!shell && profile.privateServicesAvailable) serviceLinks.push({ label: "Private Services", href: "#private-services" });

  const legalLinks: Array<{ label: string; href: string }> = [];
  if (!shell && profile.footerPrivacyPolicyUrl) legalLinks.push({ label: "Privacy", href: profile.footerPrivacyPolicyUrl });
  if (!shell && profile.footerTermsUrl) legalLinks.push({ label: "Terms", href: profile.footerTermsUrl });
  if (!shell && profile.footerCookiePolicyUrl) legalLinks.push({ label: "Cookies", href: profile.footerCookiePolicyUrl });
  const importedFooter = shell?.footerLinks.length
    ? footerLinkList(shell.footerHeading, shell.footerLinks)
    : "";
  const genericContact = shell
    ? ""
    : footerLinkList("Contact", [
        { label: "Contact us", href: profile.phone ? telHref : "#local-access" },
        ...(profile.website ? [{ label: "Website", href: profile.website }] : []),
      ]);

  const copyright =
    profile.footerCopyright?.trim() ||
    `© ${new Date().getFullYear()} ${profile.pharmacyName}. All rights reserved.`;

  return `<footer class="site-footer pc-v1-footer" data-pharmaconnect-component="platform-footer-v1" data-design-system="${PHARMACONNECT_DESIGN_SYSTEM_V1_ID}" data-imported-website-shell="${shell ? "design-intelligence-v1" : "generic-fallback"}">
<div class="wrap footer-grid">
<div>
${logo}
<p>${esc(profile.customerFacingAddress || profile.fullAddress || profile.displayAddress)}</p>
${profile.phone ? `<p><a href="${esc(telHref)}">${esc(displayPhone)}</a></p>` : ""}
${profile.email ? `<p><a href="mailto:${esc(profile.email)}">${esc(profile.email)}</a></p>` : ""}
${hours ? `<p><strong>Opening hours</strong><br>${esc(hours)}</p>` : ""}
${mapBlock}
</div>
${importedFooter}
${footerLinkList("Services", serviceLinks)}
${genericContact}
${footerLinkList("Legal", legalLinks)}
</div>
<div class="wrap footer-bottom">
<p>${esc(copyright)}${gphcLabel ? ` · ${esc(gphcLabel)}` : ""}${profile.footerCompanyNumber ? ` · Co. ${esc(profile.footerCompanyNumber)}` : ""}</p>
</div>
</footer>`;
}

function gridDirectCardCount(html: string, from: number): { count: number; end: number } {
  let depth = 1;
  let pos = from;
  let count = 0;
  while (pos < html.length && depth > 0) {
    const nextOpen = html.indexOf("<div", pos);
    const nextClose = html.indexOf("</div>", pos);
    if (nextClose === -1) return { count, end: html.length };
    if (nextOpen !== -1 && nextOpen < nextClose) {
      if (depth === 1) {
        const tagEnd = html.indexOf(">", nextOpen);
        const tag = html.slice(nextOpen, tagEnd + 1);
        if (/class="card equal-height-card"/.test(tag)) count += 1;
      }
      depth += 1;
      pos = nextOpen + 4;
    } else {
      depth -= 1;
      if (depth === 0) return { count, end: nextClose };
      pos = nextClose + 6;
    }
  }
  return { count, end: pos };
}

function annotateCardGridCounts(html: string): string {
  const pattern = /<div\b[^>]*class="[^"]*\bcard-grid-equal\b[^"]*"[^>]*>/g;
  let cursor = 0;
  let out = "";
  for (const match of html.matchAll(pattern)) {
    const tagStart = match.index ?? 0;
    const open = match[0];
    const tagEnd = tagStart + open.length - 1;
    const counted = gridDirectCardCount(html, tagEnd + 1);
    let nextOpen = open;
    if (counted.count > 0) {
      nextOpen = /data-card-count="\d+"/.test(open)
        ? open.replace(/data-card-count="\d+"/, `data-card-count="${counted.count}"`)
        : open.replace(/>$/, ` data-card-count="${counted.count}">`);
    }
    out += html.slice(cursor, tagStart) + nextOpen;
    cursor = tagEnd + 1;
  }
  return out + html.slice(cursor);
}

/** Presentation-only refresh of an already generated service page. Does not rewrite section copy. */
export function applyStoredServicePagePresentation(
  html: string,
  profile: PharmacyServicePageProfile,
  serviceName: string,
  theme?: PharmacyTheme,
): string {
  const header = renderPharmaconnectDesignSystemV1Header(profile, theme);
  const footer = renderPharmaconnectDesignSystemV1Footer(profile, serviceName, theme);
  let out = html.replace(/<header\b[^>]*class="[^"]*\bsite-header\b[^"]*"[\s\S]*?<\/header>/i, header);
  out = out.replace(/<footer\b[^>]*class="[^"]*\bsite-footer\b[^"]*"[\s\S]*?<\/footer>/i, footer);
  out = annotateCardGridCounts(out);
  const css = `<style>\n${servicePageBalancedCardGridCss()}\n</style>`;
  if (out.includes("service-page-card-grid-balance")) {
    out = out.replace(/<style>\s*\/\* service-page-card-grid-balance \*\/[\s\S]*?<\/style>/, css);
  } else {
    out = /<\/head>/i.test(out) ? out.replace(/<\/head>/i, `${css}\n</head>`) : `${css}${out}`;
  }
  return out;
}

export interface DesignSystemV1QaCheck {
  id: string;
  passed: boolean;
  detail: string;
}

/**
 * Internal navigation is either in-page anchors, root-relative paths, or the
 * approved imported shell's own site links. The minimum stays three.
 */
export function servicePageInternalLinkCount(html: string): number {
  const chrome = `${html.match(/<header\b[\s\S]*?<\/header>/i)?.[0] || ""}\n${html.match(/<footer\b[\s\S]*?<\/footer>/i)?.[0] || ""}`;
  const importedShell = /data-imported-website-shell="design-intelligence-v1"/.test(chrome);
  const hostCounts = new Map<string, number>();
  if (importedShell) {
    for (const match of chrome.matchAll(/href="([^"]*)"/gi)) {
      const href = match[1].trim();
      if (!/^https?:\/\//i.test(href)) continue;
      try {
        const host = new URL(href).host.toLowerCase();
        if (!host || host === "localhost" || host.endsWith(".localhost")) continue;
        hostCounts.set(host, (hostCounts.get(host) || 0) + 1);
      } catch {
        /* ignore malformed absolute hrefs */
      }
    }
  }
  let ownHost = "";
  let ownCount = 0;
  for (const [host, count] of hostCounts) {
    if (count > ownCount) {
      ownHost = host;
      ownCount = count;
    }
  }
  let count = 0;
  for (const match of html.matchAll(/href="([^"]*)"/gi)) {
    const href = match[1].trim();
    if (/^#[a-z0-9-]+$/i.test(href) || (href.startsWith("/") && !href.startsWith("//"))) {
      count++;
      continue;
    }
    if (!ownHost || !/^https?:\/\//i.test(href)) continue;
    try {
      if (new URL(href).host.toLowerCase() === ownHost) count++;
    } catch {
      /* ignore malformed absolute hrefs */
    }
  }
  return count;
}

export function validatePharmaconnectDesignSystemV1Page(html: string): {
  passed: boolean;
  checks: DesignSystemV1QaCheck[];
} {
  const checks: DesignSystemV1QaCheck[] = [];
  const add = (id: string, passed: boolean, detail: string) => checks.push({ id, passed, detail });

  add("platform-header", /data-pharmaconnect-component="platform-header-v1"/.test(html) || /data-sales-demo-brook="header"/.test(html) || /brook-demo-header/.test(html), "Platform header marker");
  add("platform-footer", /data-pharmaconnect-component="platform-footer-v1"/.test(html) || /data-sales-demo-brook="footer"/.test(html) || /brook-demo-footer/.test(html), "Platform footer marker");
  add("design-system-id", html.includes(PHARMACONNECT_DESIGN_SYSTEM_V1_ID), "Design system id");
  add("lockdown-template", /data-pharmacy-template="lockdown-v1"/.test(html), "lockdown-v1 template");
  add("typography-poppins", /--font-heading:\s*'Poppins'/.test(html) || /family=Poppins/.test(html), "Poppins heading stack");
  add(
    "service-page-presentation-contract",
    html.includes(PHARMACONNECT_SERVICE_PAGE_PRESENTATION_CONTRACT_ID),
    "Global service-page presentation contract",
  );
  add("cta-visible", /class="[^"]*btn[^"]*"[^>]*nav-cta|nav-cta[^>]*btn/.test(html), "Primary CTA in header");
  add("faq-min-5", (html.match(/class="faq-q"|class="[^"]*faq-card|cluster-faq-item/gi) || []).length >= 5, "≥5 FAQ blocks");
  add("schema-present", /application\/ld\+json/.test(html), "Structured data scripts");
  add("main-content", /<main[^>]+id="main-content"/.test(html), "Main landmark");
  add("responsive-viewport", /<meta name="viewport"/.test(html), "Viewport meta");
  add("no-imported-stylesheet", !/<link[^>]+rel="stylesheet"[^>]+href="https?:\/\/(?!fonts\.googleapis)/i.test(html), "No external customer CSS");
  add("hero-region", /id="hero"|data-slot="hero"|class="hero"/.test(html), "Hero region");
  const internalLinkCount = servicePageInternalLinkCount(html);
  add("internal-links", internalLinkCount >= 3, `Internal links count=${internalLinkCount} expected>=3`);
  add("no-contaminated-hours", !/monospace,monospace;font-size:1em/.test(html), "Opening hours free of CSS contamination");
  add("no-stock-icon-img", !/<img[^>]+src="[^"]*\/isteam\/stock\//i.test(html), "No stock icon URLs in img tags");
  add("commercial-layout-css", /\.grid-3|\.hero-image-wrap|\.pharmacy-local-grid/.test(html), "Commercial layout CSS present");
  add("local-map-component", /data-component="pharmacy-local-map"|pharmacy-map-card/.test(html), "Locked map component");

  const presentation = validateRenderedHtmlPresentation(html);
  for (const err of presentation.errors) {
    add(`presentation-${err}`, false, err);
  }

  return { passed: checks.every((c) => c.passed), checks };
}
