/**
 * PharmaConnect Design Lockdown V1 — permanent service page design system.
 * Profile-driven theme; no LSE cluster template dependency.
 */
import type { PharmacyServicePageProfile } from "./pharmacyServicePageProfileContext.ts";
import { normalizeTelHref } from "./pharmacyServicePageProfileContext.ts";
import { resolveProductionGphcDisplay, resolveProductionSuperintendentDisplay, PRODUCTION_FALLBACKS } from "./pharmacyProfileProductionSafety.ts";
import {
  buildPharmacyTheme,
  pharmacyThemeRootCss,
  type PharmacyTheme,
} from "./pharmacyThemeEngine.ts";
import { applyBrandDnaToServicePageProfile, buildPharmacyThemeWithBrandDna } from "./pharmacyBrandDnaResolver.ts";
import { resolveBrandDnaForRender } from "./pharmacyBrandDnaEngine.ts";
import { professionalReviewPanelCss } from "./pharmacyProfessionalReviewPanel.ts";
import {
  brandComponentLayoutCss,
  renderBrandFooterComponent,
  renderBrandHeaderComponent,
  resolvePageComponents,
  resolvePageComponentDna,
} from "./pharmacyBrandDnaComponentRenderers.ts";
import { componentDnaBodyAttributes } from "./pharmacyComponentDnaResolver.ts";
import { resolveTenantTypographyRoleCss, TENANT_DNA_TEMPLATE_ID } from "./pharmacyTenantDnaRenderActivation.ts";
import {
  isPharmaconnectDesignSystemV1Locked,
  pharmaconnectDesignSystemV1CommercialBodyLayoutCss,
  pharmaconnectDesignSystemV1PlatformLayoutCss,
  pharmaconnectDesignSystemV1ServicePagePresentationContractCss,
  pharmaconnectDesignSystemV1TypographyCss,
  renderPharmaconnectDesignSystemV1Footer,
  renderPharmaconnectDesignSystemV1Header,
} from "./pharmacyDesignSystemV1.ts";
import {
  renderBrookHomepageFooter,
  renderBrookHomepageHeader,
  usesBrookDemoHomepageChrome,
} from "./pharmacyBrookDemoHomepageChrome.ts";
import { heroContactTreatmentCss } from "./pharmacyComponentDnaContactRenderer.ts";
export { TENANT_DNA_TEMPLATE_ID } from "./pharmacyTenantDnaRenderActivation.ts";

export const PHARMACY_SERVICE_PAGE_TEMPLATE_ID = "lockdown-v1";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Self-contained layout CSS for visual service pages (cluster architecture, pharmacy palette). */
export function pharmacyServicePageBaseLayoutCss(theme: PharmacyTheme): string {
  const slug = theme.brandDna?.slug || "";
  const componentDna = isPharmaconnectDesignSystemV1Locked()
    ? null
    : resolvePageComponentDna(theme, theme?.brandDna, slug);
  const layoutCss = isPharmaconnectDesignSystemV1Locked()
    ? `${pharmaconnectDesignSystemV1PlatformLayoutCss()}\n${pharmaconnectDesignSystemV1CommercialBodyLayoutCss()}\n${heroContactTreatmentCss()}`
    : brandComponentLayoutCss(componentDna!);
  return `${pharmacyThemeRootCss(theme)}
*{box-sizing:border-box}
body{margin:0;font-family:var(--font-body);color:var(--text);background:var(--page-bg);line-height:1.65}
.wrap{max-width:var(--brand-container-width,1180px);margin:0 auto;padding:0 var(--brand-section-x,24px)}
section{padding:var(--brand-section-spacing,var(--section-padding,84px)) 0}
h1,h2,h3,.nav-links a,.btn,.stat strong,.tag,.trust-item{font-family:var(--font-heading)}
h1,h2,h3,.section-head h2,.section-head h3,.card h3,.faq .faq-q,.faq h3,.cluster-title,.section-title,.professional-review-panel h2,.professional-review-panel h3,.profile-review-name,.trust-item{color:var(--brand-heading-primary,var(--brand-heading));margin:0 0 16px;line-height:1.08}
h1{font-size:var(--h1-scale,clamp(2.2rem,5vw,3.5rem));letter-spacing:-2px;font-weight:var(--heading-weight,700)}
h2{font-size:var(--h2-scale,clamp(1.75rem,3.5vw,2.5rem));letter-spacing:-1px;font-weight:var(--heading-weight,700)}
h3{font-size:var(--h3-size,22px);letter-spacing:-.3px;font-weight:var(--heading-weight,700)}
p{font-size:var(--body-size,17px);margin:0 0 18px;color:var(--brand-muted);font-weight:var(--body-weight,400);max-width:72ch}
a{color:inherit}
.site-top-bar{background:var(--brand-top-bar-bg,var(--brand-primary));color:var(--brand-top-bar-text,#fff);font-size:13px;padding:10px 0}
.site-top-bar .wrap{display:flex;justify-content:center;text-align:center;gap:12px;flex-wrap:wrap}
.site-top-bar span{opacity:.95}
.site-header{background:var(--header-bg,var(--brand-nav-bg,#fff));border-bottom:1px solid var(--brand-border,var(--line));position:sticky;top:0;z-index:50}
.brand{display:flex;align-items:center;gap:12px;text-decoration:none;font-weight:900;color:var(--header-text,var(--ink))}
.brand img{max-height:var(--brand-radius-nav-logo,var(--logo-max-height,48px));width:auto}
.nav-links a{text-decoration:none;color:var(--header-text,var(--brand-text));font-weight:600;font-size:14px}
.nav-links a:hover{color:var(--brand-accent)}
.nav-links a.nav-phone{font-weight:700;color:var(--brand-secondary,var(--brand-primary))}
.hero{position:relative;overflow:hidden;background:linear-gradient(180deg,var(--brand-surface,var(--section-background)) 0%,var(--page-background) 100%);color:var(--brand-text);padding:var(--component-hero-padding-y,var(--hero-padding,96px)) 0 88px;border-bottom:1px solid var(--line)}
.hero h1{color:var(--brand-heading-primary,var(--brand-heading))}
.hero p{color:var(--brand-muted);font-size:21px;max-width:720px}
.eyebrow,.eyebrow{display:inline-flex;align-items:center;gap:8px;padding:8px 13px;border-radius:999px;background:color-mix(in srgb,var(--brand-primary) 12%,white);font-weight:800;text-transform:uppercase;letter-spacing:.08em;font-size:12px;margin-bottom:18px}
.hero-grid>*,.hero-copy{min-width:0;max-width:100%}
.btns{display:flex;flex-wrap:wrap;gap:var(--brand-inline-gap,14px);margin-top:30px;width:100%;max-width:100%}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:var(--brand-button-min-height,52px);padding:var(--brand-button-padding-y,14px) var(--brand-button-padding-x,23px);border-radius:var(--brand-radius-button,var(--btn-radius));background:var(--brand-cta);color:var(--brand-button-text,#fff);text-decoration:none;font-weight:var(--brand-button-weight,var(--heading-weight,900));box-shadow:0 12px 30px color-mix(in srgb,var(--brand-cta) 28%,transparent);box-sizing:border-box;max-width:100%;min-width:0;white-space:normal;text-align:center;overflow-wrap:anywhere;hyphens:auto}
.btn.secondary{background:#fff;color:var(--brand-primary);border:2px solid var(--brand-primary);box-shadow:none}
.btns>.btn{flex:1 1 auto;max-width:100%}
.process-steps .step-icon{width:44px;height:44px;border-radius:var(--icon-radius,14px);background:var(--soft2);color:var(--brand-primary);display:flex;align-items:center;justify-content:center;font-weight:900;margin-bottom:16px}
.process-steps .step-number{line-height:1;font-size:18px}
.visually-hidden{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.image-panel,.hero-image-wrap{border-radius:var(--brand-radius-image,32px);background:linear-gradient(135deg,var(--section-background),#fff);border:1px solid var(--line);box-shadow:var(--brand-card-shadow,var(--shadow));display:flex;align-items:center;justify-content:center;overflow:hidden}
.image-panel:has(img),.hero-image-wrap:has(img){background:transparent}
.image-panel img,.hero-image-wrap img{width:100%;height:100%;object-fit:cover;object-position:center;display:block}
.v3-placeholder{background:linear-gradient(135deg,var(--section-background),#ffffff);border:2px dashed var(--line);color:var(--brand-heading);text-align:center}
.v3-placeholder div{padding:28px}
.v3-placeholder strong{display:block;font-family:var(--font-heading);font-size:24px;margin-bottom:8px;color:var(--brand-heading)}
.v3-placeholder span{display:block;font-size:15px;color:var(--brand-muted)}
.section-head{max-width:800px;margin-bottom:34px}
.section-head.center{text-align:center;margin-left:auto;margin-right:auto}
.card{background:var(--brand-surface,#fff);border:var(--brand-card-border,1px solid var(--line));border-radius:var(--brand-radius-card,var(--radius));padding:var(--brand-card-padding,26px);box-shadow:var(--brand-card-shadow,var(--shadow2));height:100%;display:flex;flex-direction:column}
.card p{flex:1;font-size:16px}
.icon{width:44px;height:44px;border-radius:var(--icon-radius,14px);background:var(--soft2);color:var(--brand-primary);display:flex;align-items:center;justify-content:center;font-weight:900;margin-bottom:16px}
.soft{background:var(--brand-surface,var(--section-background))}
.blue-band{background:linear-gradient(180deg,var(--brand-surface,var(--section-background)),var(--page-background))}
ul.clean{list-style:none;padding:0;margin:18px 0 0}
ul.clean li{padding:12px 0;border-bottom:1px solid rgba(148,163,184,.22);font-weight:750}
.tag{display:inline-block;padding:7px 11px;border-radius:999px;background:color-mix(in srgb,var(--brand-heading-secondary,var(--brand-accent)) 14%,white);font-size:12px;font-weight:900;text-transform:uppercase;margin-bottom:14px}
.tag.nhs{display:inline-block;padding:7px 11px;border-radius:999px;background:#e7f3ff;color:var(--nhs);font-size:12px;font-weight:900;text-transform:uppercase;margin-bottom:14px}
.impact{background:var(--section-background);color:var(--brand-text)}
.impact h2,.impact h3{color:var(--brand-heading)}.impact p{color:var(--brand-muted)}
.impact .card{background:#fff;border-color:var(--line);box-shadow:var(--shadow2)}
.impact .card p{color:var(--brand-muted)}
.local{background:linear-gradient(135deg,var(--page-background) 0%,var(--section-background) 100%)}
.about{background:var(--section-background)}
.about-card{background:white;border-radius:var(--brand-radius-card,32px);padding:var(--brand-card-padding,38px);border:1px solid var(--line);box-shadow:var(--shadow)}
.trust-item{padding:var(--component-card-padding,18px);border-radius:var(--trust-radius,18px);background:#fff;border:1px solid var(--line);font-weight:850;color:var(--brand-heading)}
.money-page-band{background:color-mix(in srgb,var(--brand-cta) 8%,white);color:var(--brand-text);padding:var(--brand-section-spacing,44px) 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.money-page-band p{color:var(--brand-muted);font-size:19px;text-align:center;margin:0}
.money-page-band a{color:var(--brand-primary);font-weight:950}
.question{border-left:5px solid var(--brand-accent)}
.final{background:var(--section-background);color:var(--brand-text)}
.final h2{color:var(--brand-heading)}.final p{color:var(--brand-muted)}
.site-footer{background:var(--brand-footer-bg,var(--footer-bg,var(--brand-heading)));color:var(--brand-footer-text,var(--footer-text,#fff))}.site-footer h3{color:var(--brand-footer-text,var(--footer-text,#fff))}.site-footer p,.site-footer a{color:var(--brand-footer-link,var(--footer-link,var(--footer-text,#fff)))}.site-footer a:hover{color:var(--brand-footer-accent,var(--footer-accent,var(--footer-link)))}
.conditions-grid .card h3{color:var(--brand-heading-primary,var(--brand-heading));min-height:0}
.conditions-authority-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:14px}
.conditions-authority-grid .condition-track-card{display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center;padding:22px 12px}
.conditions-authority-grid .condition-track-icon{width:2.5rem;height:2.5rem;color:var(--brand-heading,#005EB8);display:flex;align-items:center;justify-content:center}
.conditions-authority-grid .condition-track-icon svg{width:1.75rem;height:1.75rem}
.conditions-authority-grid .condition-track-card h3{margin:0;font-size:15px;line-height:1.35}
@media(max-width:1100px){.conditions-authority-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}
@media(max-width:720px){.conditions-authority-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
.safety-media img,.safety-media .image-panel{width:100%;height:100%;min-height:22rem;object-fit:cover;display:block;border-radius:16px}
${layoutCss}`;
}

export function pharmacyServicePageExtensionCss(theme: PharmacyTheme): string {
  return `
body[data-pharmacy-template="${PHARMACY_SERVICE_PAGE_TEMPLATE_ID}"] [data-component="pharmacy-trust-demo-notice"],
body[data-pharmacy-template="${TENANT_DNA_TEMPLATE_ID}"] [data-component="pharmacy-trust-demo-notice"] { display: none !important; }
.brand { text-decoration: none; }
.brand-text { font-family: 'Poppins', system-ui, sans-serif; font-weight: 900; font-size: 1.15rem; color: var(--ink); line-height: 1.2; }
.brand-tag { display: block; font-size: 12px; font-weight: 600; color: var(--brand-accent); margin-top: 2px; }
.header-phone { font-weight: 700; color: var(--header-text, var(--ink)); white-space: nowrap; font-size: 14px; }
.nav-placeholder { color: var(--muted); font-size: 13px; font-weight: 600; opacity: 0.85; }
#pharmacy-trust-cards { padding-top: var(--brand-section-spacing,72px); padding-bottom: var(--brand-section-spacing,72px); background: var(--page-background); }
.conversion-image-section { padding: 0 0 64px; background: var(--section-background); }
.conversion-image-section .wrap { padding-top: 64px; }
.cta-band { background: linear-gradient(180deg, var(--section-background), var(--page-background)); color: var(--brand-text); padding: var(--brand-section-spacing,72px) 0; text-align: center; border-top: 1px solid var(--line); }
.cta-band h2 { color: var(--brand-heading); margin: 0 0 16px; font-size: var(--h2-scale, clamp(1.75rem, 3.5vw, 2.5rem)); }
.cta-close { font-size: var(--cta-intro-size, 1.05rem); color: var(--brand-muted); max-width: var(--reading-width-narrative, 720px); margin: 0 auto 28px; line-height: var(--body-line-height, 1.65); }
.cta-actions { display: flex; flex-wrap: wrap; gap: 14px; justify-content: center; max-width: 100%; }
.btn-white { display: inline-flex; align-items: center; justify-content: center; min-height: var(--brand-button-min-height,52px); padding: var(--brand-button-padding-y,14px) var(--brand-button-padding-x,24px); border-radius: var(--component-cta-radius,var(--brand-radius-button,14px)); background: var(--brand-cta); color: #fff !important; font-weight: 900; text-decoration: none; box-shadow: 0 12px 30px color-mix(in srgb, var(--brand-cta) 22%, transparent); box-sizing: border-box; max-width: 100%; min-width: 0; white-space: normal; text-align: center; overflow-wrap: anywhere; }
.btn-white-outline { display: inline-flex; align-items: center; justify-content: center; min-height: var(--brand-button-min-height,52px); padding: var(--brand-button-padding-y,14px) var(--brand-button-padding-x,24px); border-radius: var(--component-cta-radius,var(--brand-radius-button,14px)); background: transparent; color: var(--brand-primary) !important; border: 2px solid var(--brand-primary); font-weight: 900; text-decoration: none; box-sizing: border-box; max-width: 100%; min-width: 0; white-space: normal; text-align: center; overflow-wrap: anywhere; }
.local-access-cta { display: flex; flex-wrap: wrap; gap: 12px; max-width: 100%; margin-top: auto; padding-top: 22px; }
.local-access-cta .btn, .cta-actions .btn, .cta-actions .btn-white, .cta-actions .btn-white-outline { flex: 1 1 auto; max-width: 100%; }
@media (max-width: 640px) {
  .btns > .btn,
  .local-access-cta .btn,
  .cta-actions .btn,
  .cta-actions .btn-white,
  .cta-actions .btn-white-outline,
  .btn,
  .btn-white,
  .btn-white-outline {
    width: 100%;
    max-width: 100%;
    flex: 1 1 100%;
  }
}
.faq .cluster-faq-item, .faq .faq-card { border: 1px solid var(--line); border-radius: 18px; padding: 20px 22px; margin-bottom: 14px; background: #fff; box-shadow: var(--shadow2); }
.faq .faq-q { font-size: 18px; margin: 0 0 10px; color: var(--brand-heading); }
.faq .faq-a { margin: 0; color: var(--muted); font-size: 16px; line-height: 1.65; }
.pharmacy-local-details { background: #fff; border: 1px solid var(--line); border-radius: var(--radius); padding: 28px; box-shadow: var(--shadow2); display: flex; flex-direction: column; height: 100%; }
.pharmacy-local-details h3 { margin: 0 0 12px; font-size: 20px; }
.pharmacy-local-details p { margin: 0 0 10px; font-size: 16px; }
.coverage-tags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
.coverage-tag { display: inline-block; padding: 7px 12px; border-radius: 999px; background: color-mix(in srgb,var(--brand-primary) 10%,white); border: 1px solid var(--line); font-size: 13px; font-weight: 700; color: var(--brand-primary); text-decoration: none; }
.coverage-tag:hover { background: color-mix(in srgb,var(--brand-primary) 16%,white); }
.hours-placeholder { padding: 12px 14px; border-radius: 12px; background: var(--section-background); border: 1px dashed var(--line); color: var(--brand-muted); font-size: 14px; margin-top: 8px; }
.map-placeholder { min-height: var(--component-map-min-height,280px); border-radius: var(--component-map-radius,var(--radius)); background: linear-gradient(135deg, var(--section-background), #fff); border: 1px dashed var(--line); display: flex; align-items: center; justify-content: center; text-align: center; padding: 24px; color: var(--brand-muted); box-shadow: var(--shadow2); }
.map-placeholder strong { display: block; color: var(--brand-heading); font-family: var(--font-heading); margin-bottom: 8px; }
.image-panel figcaption, .hero-image-wrap figcaption { display: none; }
.image-panel .pharmacy-image, .hero-image-wrap .pharmacy-image { width: 100%; height: 100%; margin: 0; }
.image-panel .pharmacy-image img, .hero-image-wrap .pharmacy-image img { width: 100%; height: 100%; object-fit: cover; border-radius: 0; max-height: none; border: none; box-shadow: none; }
.definition-split-copy .tag { margin-bottom: 14px; }
.definition-split-copy p { font-size: var(--body-size, 17px); color: var(--muted); margin: 0 0 18px; }
.definition-split-continuation p { font-size: var(--body-size, 17px); color: var(--muted); margin: 0 0 18px; }
.safety-prose p { font-size: var(--body-size, 17px); color: var(--brand-muted); margin: 0 0 16px; }
.trust-prose p { font-size: var(--body-size, 17px); color: var(--muted); margin: 0 0 16px; }
.trust-media h3 { margin: 0 0 12px; font-size: var(--h3-size, 22px); }
`;
}

export function buildPharmacyServicePageStyleBlock(themeOrProfile: PharmacyTheme | PharmacyServicePageProfile): string {
  const theme =
    "primaryColor" in themeOrProfile
      ? themeOrProfile
      : buildPharmacyThemeWithBrandDna(themeOrProfile, resolveBrandDnaForRender(themeOrProfile.slug));
  const slug = theme.brandDna?.slug || ("slug" in themeOrProfile ? themeOrProfile.slug : "");
  const roleCss =
    slug && !isPharmaconnectDesignSystemV1Locked() ? resolveTenantTypographyRoleCss(slug, theme.brandDna) : "";
  const v1Typography = isPharmaconnectDesignSystemV1Locked() ? pharmaconnectDesignSystemV1TypographyCss() : "";
  // Presentation contract must load last so tenant Brand DNA cannot diverge service-page type/align.
  const v1PresentationContract = isPharmaconnectDesignSystemV1Locked()
    ? pharmaconnectDesignSystemV1ServicePagePresentationContractCss()
    : "";
  const css = [
    v1Typography,
    pharmacyServicePageBaseLayoutCss(theme),
    pharmacyServicePageExtensionCss(theme),
    professionalReviewPanelCss(),
    roleCss,
    v1PresentationContract,
  ]
    .filter(Boolean)
    .join("\n");
  return `<style>\n${css}\n</style>`;
}

export function pharmacyServicePageBodyAttributes(serviceId: string, theme?: PharmacyTheme): string {
  const componentDna = resolvePageComponentDna(theme);
  return `data-service-id="${serviceId}" ${componentDnaBodyAttributes(componentDna)}`;
}

/** @deprecated use buildPharmacyServicePageStyleBlock */
export const buildPharmacyClusterStyleBlock = buildPharmacyServicePageStyleBlock;

function normalizeHeaderNavUrl(url: string, profile?: PharmacyServicePageProfile): string {
  const normalized = String(url || "").trim();
  if (normalized === "#split-section-one") return "#service-definition";
  if (normalized === "#" && profile?.website) return profile.website;
  return normalized;
}

function renderTopInfoBar(profile: PharmacyServicePageProfile, theme: PharmacyTheme): string {
  void profile;
  void theme;
  return "";
}

function resolveBrandDnaProfile(
  profile: PharmacyServicePageProfile,
  theme?: PharmacyTheme,
): PharmacyServicePageProfile {
  if (!theme?.brandDna) return profile;
  return applyBrandDnaToServicePageProfile(profile, theme.brandDna);
}

export function renderPharmacyServicePageHeader(profile: PharmacyServicePageProfile, theme?: PharmacyTheme): string {
  if (usesBrookDemoHomepageChrome(profile.slug)) {
    return renderBrookHomepageHeader();
  }
  if (isPharmaconnectDesignSystemV1Locked()) {
    return renderPharmaconnectDesignSystemV1Header(profile, theme);
  }
  const resolvedProfile = resolveBrandDnaProfile(profile, theme);
  const componentDna = resolvePageComponentDna(theme, theme?.brandDna, resolvedProfile.slug);
  return renderBrandHeaderComponent(resolvedProfile, theme, componentDna.variants, componentDna);
}

export function renderPharmacyServicePageFooter(
  profile: PharmacyServicePageProfile,
  serviceName: string,
  theme?: PharmacyTheme,
): string {
  if (usesBrookDemoHomepageChrome(profile.slug)) {
    return renderBrookHomepageFooter();
  }
  if (isPharmaconnectDesignSystemV1Locked()) {
    return renderPharmaconnectDesignSystemV1Footer(profile, serviceName, theme);
  }
  const resolvedProfile = resolveBrandDnaProfile(profile, theme);
  const componentDna = resolvePageComponentDna(theme, theme?.brandDna, resolvedProfile.slug);
  return renderBrandFooterComponent(resolvedProfile, serviceName, componentDna.variants, resolvedProfile.slug, componentDna);
}

/** @deprecated use renderPharmacyServicePageHeader */
export const renderPharmacyClusterHeader = renderPharmacyServicePageHeader;
/** @deprecated use renderPharmacyServicePageFooter */
export const renderPharmacyClusterFooter = renderPharmacyServicePageFooter;
