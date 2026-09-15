/**
 * Brand DNA footer component — evidence-driven four-column layout.
 */
import type { PharmacyServicePageProfile } from "./pharmacyServicePageProfileContext.ts";
import { normalizeTelHref } from "./pharmacyServicePageProfileContext.ts";
import type { BrandDnaComponents } from "./pharmacyBrandDnaComponentTypes.ts";
import { resolveBrandDnaFooterProfile } from "./pharmacyBrandDnaFooterModel.ts";
import type { BrandDNA, BrandDnaV1 } from "./pharmacyBrandDnaTypes.ts";
import type { ComponentDna } from "./pharmacyComponentDnaTypes.ts";
import { resolveProductionGphcDisplay } from "./pharmacyProfileProductionSafety.ts";
import { resolveOpeningHoursRows } from "./pharmacyOpeningHoursTable.ts";
import { resolveStrictFooterDnaComposition, shouldUseStrictFooterDna } from "./pharmacyStrictFooterDnaService.ts";
import type { NavLink } from "../generator/brandImporter.ts";

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

function isValidNavUrl(url: string): boolean {
  const normalized = String(url || "").trim();
  if (!normalized || normalized === "#") return false;
  if (/^javascript:/i.test(normalized)) return false;
  if (/localhost|127\.0\.0\.1/i.test(normalized)) return false;
  return true;
}

function normalizeHeaderNavUrl(url: string, profile?: PharmacyServicePageProfile): string {
  const normalized = String(url || "").trim();
  if (normalized === "#split-section-one") return "#service-definition";
  if (normalized === "#" && profile?.website) return profile.website;
  if (/localhost|127\.0\.0\.1/i.test(normalized)) return profile?.website || "#";
  return normalized;
}

const ICON_EMAIL = `<svg class="footer-icon-svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 6h16v12H4V6zm8 6.8L6.8 8h10.4L12 12.8z"/></svg>`;
const ICON_PHONE = `<svg class="footer-icon-svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6.6 10.8c1.5 2.9 3.7 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.3 21 3 13.7 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg>`;
const ICON_LOCATION = `<svg class="footer-icon-svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.5c-1.4 0-2.5-1.1-2.5-2.5S10.6 6.5 12 6.5s2.5 1.1 2.5 2.5S13.4 11.5 12 11.5z"/></svg>`;
const ICON_GPHC = `<svg class="footer-icon-svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2l7 4v6c0 5-3.5 9.5-7 10-3.5-.5-7-5-7-10V6l7-4zm0 3.2L7 7.5V12c0 3.6 2.4 7 5 7.5 2.6-.5 5-3.9 5-7.5V7.5l-5-2.3z"/></svg>`;

function renderSocialIcon(label: string): string {
  const key = label.toLowerCase();
  if (key.includes("facebook")) return "f";
  if (key.includes("instagram")) return "ig";
  if (key.includes("linkedin")) return "in";
  if (key === "x" || key.includes("twitter")) return "x";
  if (key.includes("youtube")) return "yt";
  return label.slice(0, 2).toUpperCase();
}

function renderOpeningHoursTable(profile: PharmacyServicePageProfile): string {
  const rows = resolveOpeningHoursRows(profile);
  return `<div class="footer-hours-table" role="table" aria-label="Pharmacy opening hours">
${rows
  .map(
    (row) =>
      `<div class="footer-hours-row" role="row"><span class="footer-hours-day" role="rowheader">${esc(row.label)}</span><span class="footer-hours-time" role="cell">${esc(row.hours)}</span></div>`,
  )
  .join("\n")}
</div>`;
}

function renderContactRow(icon: string, content: string): string {
  return `<div class="footer-contact-row"><div class="footer-icon-wrap">${icon}</div><div class="footer-contact-text">${content}</div></div>`;
}

function renderQuickLinksColumn(items: NavLink[], profile: PharmacyServicePageProfile, heading = "Quick Links"): string {
  if (!items.length) return "";
  return `<div class="footer-col footer-col--links">
<h3 class="footer-heading">${esc(heading)}</h3>
<ul class="footer-link-list">
${items
  .filter((l) => isValidNavUrl(l.href))
  .map((l) => `<li><a href="${esc(normalizeHeaderNavUrl(l.href, profile))}">${esc(l.label)}</a></li>`)
  .join("\n")}
</ul>
</div>`;
}

function renderSocialColumn(items: NavLink[]): string {
  if (!items.length) return "";
  return `<div class="footer-col footer-col--social">
<h3 class="footer-heading">Social Media</h3>
<div class="footer-social">${items
    .map(
      (item) =>
        `<a class="footer-social-link" href="${esc(item.href)}" rel="noopener noreferrer" target="_blank" aria-label="${esc(item.label)}"><span>${esc(renderSocialIcon(item.label))}</span></a>`,
    )
    .join("")}</div>
</div>`;
}

function renderFooterBadges(footerProfile: ReturnType<typeof resolveBrandDnaFooterProfile>): string {
  const approvedAssets = (footerProfile.badgeAssets || []).filter(
    (asset) => asset.usageStatus === "approved" && asset.sourceUrl,
  );
  if (approvedAssets.length) {
    return `<div class="footer-badges">${approvedAssets
      .map(
        (asset) =>
          `<img class="footer-badge-image" src="${esc(asset.sourceUrl)}" alt="${esc(asset.altText || asset.label)}" loading="lazy" decoding="async"/>`,
      )
      .join("")}</div>`;
  }

  const textBadges = (footerProfile.badges || [])
    .map((badge) => `<span class="footer-badge">${esc(badge)}</span>`)
    .join("");
  return textBadges ? `<div class="footer-badges">${textBadges}</div>` : "";
}

function renderOpeningHoursFromDna(hoursText: string, tableLayout: boolean): string {
  if (!hoursText) return "";
  if (tableLayout && /monday/i.test(hoursText)) {
    const lines = hoursText.split(/;|\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length >= 2) {
      return `<div class="footer-hours-table" role="table" aria-label="Pharmacy opening hours">
${lines
  .map((line) => {
    const parts = line.split(/:\s*/);
    const day = parts[0] || line;
    const time = parts.slice(1).join(": ") || "";
    return `<div class="footer-hours-row" role="row"><span class="footer-hours-day" role="rowheader">${esc(day)}</span><span class="footer-hours-time" role="cell">${esc(time)}</span></div>`;
  })
  .join("\n")}
</div>`;
    }
  }
  return `<p class="footer-hours-text">${esc(hoursText)}</p>`;
}

function renderContactFromDna(contactHtml: string): string {
  if (!contactHtml) return "";
  return `<div class="footer-col footer-col--contact">
<h3 class="footer-heading">Contact</h3>
<div class="footer-contact-list"><p class="footer-contact-dna">${esc(contactHtml)}</p></div>
</div>`;
}

function renderBrandColumn(
  profile: PharmacyServicePageProfile,
  footerProfile: ReturnType<typeof resolveBrandDnaFooterProfile>,
  footerLine: string,
): string {
  const footerLogo = profile.footerLogoUrl || profile.logoUrl;
  const badges = renderFooterBadges(footerProfile);
  const socialLinks = (footerProfile.socialLinks || []).filter((l) => isValidNavUrl(l.href));
  const socialFromProfile: NavLink[] = [];
  for (const [label, url] of [
    ["Facebook", profile.socialFacebook],
    ["Instagram", profile.socialInstagram],
    ["LinkedIn", profile.socialLinkedIn],
    ["X", profile.socialX],
    ["YouTube", profile.socialYouTube],
  ] as const) {
    if (isValidNavUrl(url)) socialFromProfile.push({ label, href: url });
  }
  const socialItems = socialLinks.length ? socialLinks : socialFromProfile;
  const socialHtml = socialItems.length
    ? `<div class="footer-social">${socialItems
        .map(
          (item) =>
            `<a class="footer-social-link" href="${esc(item.href)}" rel="noopener noreferrer" target="_blank" aria-label="${esc(item.label)}"><span>${esc(renderSocialIcon(item.label))}</span></a>`,
        )
        .join("")}</div>`
    : "";

  return `<div class="footer-col footer-col--brand">
${footerProfile.logo && footerLogo ? `<img src="${esc(footerLogo)}" alt="${esc(profile.pharmacyName)}" class="footer-logo"/>` : ""}
<p class="footer-brand-description">${esc(footerProfile.description || footerLine)}</p>
${badges}
${socialHtml}
</div>`;
}

function renderBrandColumnStrict(
  profile: PharmacyServicePageProfile,
  footerProfile: ReturnType<typeof resolveBrandDnaFooterProfile>,
  composition: ReturnType<typeof resolveStrictFooterDnaComposition>,
): string {
  const footerLogo = profile.footerLogoUrl || profile.logoUrl;
  const badges = renderFooterBadges(footerProfile);

  return `<div class="footer-col footer-col--brand">
${composition.showLogo && footerLogo ? `<img src="${esc(footerLogo)}" alt="${esc(profile.pharmacyName)}" class="footer-logo"/>` : ""}
${composition.description ? `<p class="footer-brand-description">${esc(composition.description)}</p>` : ""}
${badges}
</div>`;
}

function renderContactColumn(profile: PharmacyServicePageProfile): string {
  const telHref = normalizeTelHref(profile.phone);
  const displayPhone = profile.displayPhone || profile.phone;
  const gphc = resolveProductionGphcDisplay(profile, { demoMode: false, trustDataStatus: "" });
  const rows: string[] = [];

  if (profile.email) {
    rows.push(renderContactRow(ICON_EMAIL, `<a href="mailto:${esc(profile.email)}">${esc(profile.email)}</a>`));
  }
  if (profile.phone) {
    rows.push(renderContactRow(ICON_PHONE, `<a href="${esc(telHref)}">${esc(displayPhone)}</a>`));
  }
  if (profile.customerFacingAddress || profile.fullAddress) {
    rows.push(renderContactRow(ICON_LOCATION, esc(profile.customerFacingAddress || profile.fullAddress)));
  }
  if (gphc.verified && gphc.raw) {
    const gphcContent = isValidNavUrl(profile.gphcPremisesUrl)
      ? `<a href="${esc(profile.gphcPremisesUrl)}" rel="noopener noreferrer">${esc(gphc.display)}</a>`
      : esc(gphc.display);
    rows.push(renderContactRow(ICON_GPHC, gphcContent));
  }

  if (!rows.length) return "";

  return `<div class="footer-col footer-col--contact">
<h3 class="footer-heading">Contact Us</h3>
<div class="footer-contact-list">${rows.join("\n")}</div>
</div>`;
}

function renderLegalBottomBar(
  profile: PharmacyServicePageProfile,
  footerProfile: ReturnType<typeof resolveBrandDnaFooterProfile>,
  copyright: string,
  showBackToTop = false,
  strictLegalOnly = false,
  strictLegalLinks: NavLink[] = [],
): string {
  const legalFromDna = strictLegalOnly
    ? strictLegalLinks.filter((l) => isValidNavUrl(l.href))
    : (footerProfile.legalItems || []).filter((l) => isValidNavUrl(l.href));
  const legalLinks: string[] = legalFromDna.map(
    (l) => `<a href="${esc(normalizeHeaderNavUrl(l.href, profile))}" rel="noopener noreferrer">${esc(l.label)}</a>`,
  );
  if (!strictLegalOnly && !legalLinks.length) {
    if (isValidNavUrl(profile.footerTermsUrl)) legalLinks.push(`<a href="${esc(profile.footerTermsUrl)}" rel="noopener noreferrer">Terms &amp; Conditions</a>`);
    if (isValidNavUrl(profile.footerPrivacyPolicyUrl)) legalLinks.push(`<a href="${esc(profile.footerPrivacyPolicyUrl)}" rel="noopener noreferrer">Privacy Policy</a>`);
    if (isValidNavUrl(profile.footerCookiePolicyUrl)) legalLinks.push(`<a href="${esc(profile.footerCookiePolicyUrl)}" rel="noopener noreferrer">GDPR</a>`);
  }

  const attribution = footerProfile.attributionText
    ? `<span class="footer-attribution">${esc(footerProfile.attributionText)}</span>`
    : "";

  const backToTop = showBackToTop
    ? `<button type="button" class="footer-back-to-top" aria-label="Back to top" onclick="window.scrollTo({top:0,behavior:'smooth'})"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 4l-8 8h5v8h6v-8h5z"/></svg></button>`
    : "";

  return `<div class="footer-bottom-bar">
<div class="wrap footer-bottom-inner">
<p class="footer-copyright">${esc(copyright)}</p>
${legalLinks.length ? `<nav class="footer-legal-links" aria-label="Legal">${legalLinks.join("")}</nav>` : ""}
${attribution}
${backToTop}
</div>
</div>`;
}

export function renderBrandDnaFooterComponent(
  profile: PharmacyServicePageProfile,
  serviceName: string,
  components: BrandDnaComponents,
  brand: BrandDNA | BrandDnaV1,
  componentDna?: ComponentDna,
): string {
  const footerProfile = resolveBrandDnaFooterProfile(brand);
  const footerDna = componentDna?.footer;
  const composition = resolveStrictFooterDnaComposition(profile.slug, brand, componentDna);
  const strict = shouldUseStrictFooterDna(profile.slug);

  if (strict) {
    const brandCol = renderBrandColumnStrict(profile, footerProfile, composition);
    const companyCol =
      composition.showQuickLinks && composition.companyLinks.length
        ? renderQuickLinksColumn(composition.companyLinks, profile, "Company")
        : "";
    const customerCareCol =
      composition.showLegalLinks && composition.customerCareLinks.length
        ? renderQuickLinksColumn(composition.customerCareLinks, profile, "Customer Care")
        : "";
    const socialCol =
      composition.showSocialLinks && composition.socialLinks.length ? renderSocialColumn(composition.socialLinks) : "";
    const columnMap: Record<string, string> = {
      about: brandCol,
      logo: brandCol,
      company: companyCol,
      customerCare: customerCareCol,
      social: socialCol,
      quickLinks: companyCol,
      legal: customerCareCol,
    };
    const columns = composition.columnOrder.map((key) => columnMap[key]).filter(Boolean).join("\n");
    const columnCount = composition.columnOrder.length || 1;
    const gridClass =
      components.footerVariant === "compact"
        ? "footer-grid footer-grid--compact"
        : columnCount <= 3 || components.footerVariant === "three-column"
          ? "footer-grid footer-grid--three"
          : "footer-grid footer-grid--four";

    const copyright = composition.copyrightText || `© ${new Date().getFullYear()} ${profile.pharmacyName}`;
    const patternClass = composition.patternClass;
    const patternStyle = composition.patternStyle ? ` style="${composition.patternStyle}"` : "";
    const footerColourStyle = `--brand-footer-bg:${composition.backgroundColour};--brand-footer-text:${composition.textColour};--brand-footer-link:${composition.linkColour};--brand-footer-bottom-bg:${composition.lowerBackgroundColour};--component-footer-padding-top:${composition.paddingTop};--component-footer-column-gap:${composition.columnGap};`;
    const bottomLegalLinks = composition.showLegalLinks && !customerCareCol ? composition.legalLinks : [];

    return `<footer class="site-footer${patternClass}" id="site-footer" data-component="pharmacy-page-footer" data-component-variant="${esc(components.footerVariant)}" data-footer-columns="${columnCount}" data-footer-dna="strict" data-footer-groups="logo,company,customerCare,social,copyright" style="${footerColourStyle}${patternStyle ? composition.patternStyle : ""}">
<div class="wrap ${gridClass}" style="--footer-column-widths:${esc(composition.columnWidths)}">
${columns}
</div>
${renderLegalBottomBar(profile, footerProfile, copyright, composition.backToTop, true, bottomLegalLinks)}
</footer>`;
  }

  const footerLine =
    profile.footerText ||
    `${profile.pharmacyName} provides NHS pharmacy services including ${serviceName}.`;
  const gphc = resolveProductionGphcDisplay(profile, { demoMode: false, trustDataStatus: "" });
  const copyright =
    footerProfile.copyrightText ||
    profile.footerCopyright ||
    `© ${new Date().getFullYear()} ${profile.pharmacyName}${profile.town ? ` · ${profile.town}` : ""}${gphc.verified && gphc.display ? ` · ${gphc.display}` : ""}`;

  const quickLinks = footerProfile.confirmedItems || [];
  const showQuickLinks = footerProfile.hasQuickLinks || quickLinks.length > 0;
  const brandCol = renderBrandColumn(profile, footerProfile, footerLine);
  const linksCol = showQuickLinks ? renderQuickLinksColumn(quickLinks, profile) : "";
  const hoursCol = footerProfile.hasOpeningHours
    ? `<div class="footer-col footer-col--hours">
<h3 class="footer-heading">Pharmacy Working Hours</h3>
${(footerDna?.hoursTableLayout || footerProfile.openingHoursLayout) === "table" || footerProfile.columnCount === 4 ? renderOpeningHoursTable(profile) : `<p>${esc(profile.openingHours)}</p>`}
</div>`
    : "";
  const contactCol = footerProfile.hasContactBlock ? renderContactColumn(profile) : "";

  const columnMap: Record<string, string> = {
    about: brandCol,
    quickLinks: linksCol,
    openingHours: hoursCol,
    contact: contactCol,
  };
  const columnOrder = (footerProfile.columnOrder || ["about", "quickLinks", "openingHours", "contact"]).filter(
    (key) => key !== "social" && key !== "legal",
  );
  const columns = columnOrder.map((key) => columnMap[key]).filter(Boolean).join("\n");

  const columnCount = footerProfile.columnCount || columns.split("footer-col").length - 1 || 4;
  const gridClass =
    components.footerVariant === "compact"
      ? "footer-grid footer-grid--compact"
      : columnCount <= 3 || components.footerVariant === "three-column"
        ? "footer-grid footer-grid--three"
        : "footer-grid footer-grid--four";

  const patternClass =
    footerDna?.patternTreatment === "solid" || footerProfile.backgroundTreatment === "solid"
      ? ""
      : footerProfile.backgroundTreatment === "pattern-imported" && footerProfile.backgroundPattern
        ? " site-footer--imported-pattern"
        : footerProfile.backgroundTreatment !== "solid"
          ? " site-footer--pattern"
          : "";

  const patternStyle =
    footerProfile.backgroundTreatment === "pattern-imported" && footerProfile.backgroundPattern
      ? ` style="--footer-pattern-url:url('${esc(footerProfile.backgroundPattern)}')"`
      : "";

  const columnWidths = footerDna?.columnWidths || footerProfile.columnWidths || "2.2fr 1fr 1.15fr 1.5fr";

  return `<footer class="site-footer${patternClass}" id="site-footer" data-component="pharmacy-page-footer" data-component-variant="${esc(components.footerVariant)}" data-footer-columns="${columnCount}"${patternStyle}>
<div class="wrap ${gridClass}" style="--footer-column-widths:${esc(columnWidths)}">
${columns}
</div>
${renderLegalBottomBar(profile, footerProfile, copyright, footerDna?.backToTop ?? footerProfile.backToTop ?? false)}
</footer>`;
}

export function brandDnaFooterLayoutCss(dna?: import("./pharmacyComponentDnaTypes.ts").ComponentDna): string {
  const bp = dna?.header.desktopBreakpoint || "980px";
  return `
.site-footer{padding:var(--component-footer-padding-top,56px) 0 0;background:var(--brand-footer-bg,#10263D);color:var(--brand-footer-text,#fff);position:relative;overflow:hidden}
.site-footer--pattern{background-image:radial-gradient(circle at 12px 12px,color-mix(in srgb,var(--brand-footer-accent,#66a960) 10%,transparent) 0 1px,transparent 1px);background-size:28px 28px}
.site-footer--imported-pattern{background-image:var(--footer-pattern-url);background-size:cover;background-blend-mode:soft-light}
.footer-grid{display:grid;gap:var(--component-footer-column-gap,40px);align-items:start}
.footer-col--brand .footer-logo{max-height:min(var(--component-header-logo-max,48px),52px);margin-bottom:16px;display:block}
.footer-brand-description{margin:0;max-width:36ch;line-height:1.65;font-size:15px;color:color-mix(in srgb,var(--brand-footer-text,#fff) 92%,transparent)}
.footer-badges{display:flex;flex-wrap:wrap;gap:var(--component-footer-badge-spacing,10px);margin-top:14px;align-items:center}
.footer-badge{display:inline-flex;align-items:center;padding:6px 12px;border-radius:999px;border:1px solid color-mix(in srgb,var(--brand-footer-accent,#66a960) 55%,transparent);color:var(--brand-footer-accent,#66a960);font-size:12px;font-weight:700;letter-spacing:.02em;text-transform:uppercase}
.footer-badge-image{display:block;max-height:var(--component-footer-badge-max-height,56px);width:auto;object-fit:contain}
.footer-social{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}
.footer-social-link{display:inline-flex;align-items:center;justify-content:center;width:var(--component-footer-social-icon-size,38px);height:var(--component-footer-social-icon-size,38px);border-radius:50%;border:1.5px solid color-mix(in srgb,var(--brand-footer-text,#fff) 55%,transparent);color:var(--brand-footer-text,#fff);text-decoration:none;font-size:11px;font-weight:800;transition:background .2s,border-color .2s}
.footer-social-link:hover{background:color-mix(in srgb,var(--brand-footer-accent,#66a960) 18%,transparent);border-color:var(--brand-footer-accent,#66a960)}
.footer-heading{margin:0 0 16px;font-size:1.05rem;font-weight:700;color:var(--brand-footer-text,#fff);letter-spacing:.01em}
.footer-link-list{list-style:none;margin:0;padding:0}
.footer-link-list li{margin:0 0 10px}
.footer-link-list a{color:var(--brand-footer-link,var(--brand-footer-text,#fff));text-decoration:none;font-size:15px;line-height:1.5}
.footer-link-list a:hover{text-decoration:underline;color:var(--brand-footer-accent,#66a960)}
.footer-hours-table{display:flex;flex-direction:column;gap:0}
.footer-hours-row{display:grid;grid-template-columns:1fr auto;gap:16px;padding:10px 0;border-bottom:1px solid color-mix(in srgb,var(--brand-footer-text,#fff) 14%,transparent);font-size:14px;line-height:1.4}
.footer-hours-row:last-child{border-bottom:none}
.footer-hours-day{font-weight:600;color:var(--brand-footer-text,#fff)}
.footer-hours-time{text-align:right;color:color-mix(in srgb,var(--brand-footer-text,#fff) 88%,transparent);white-space:nowrap}
.footer-contact-list{display:flex;flex-direction:column;gap:14px}
.footer-contact-row{display:flex;align-items:flex-start;gap:12px}
.footer-icon-wrap,.footer-contact-row svg.footer-icon-svg{flex:0 0 var(--component-footer-contact-icon-size,36px);width:var(--component-footer-contact-icon-size,36px);height:var(--component-footer-contact-icon-size,36px);padding:8px;border-radius:50%;border:1.5px solid color-mix(in srgb,var(--brand-footer-accent,#66a960) 45%,transparent);color:var(--brand-footer-accent,#66a960);box-sizing:border-box}
.footer-contact-text{font-size:14px;line-height:1.55;color:var(--brand-footer-text,#fff)}
.footer-contact-text a{color:inherit;text-decoration:none}
.footer-contact-text a:hover{text-decoration:underline;color:var(--brand-footer-accent,#66a960)}
.footer-bottom-bar{margin-top:36px;background:var(--brand-footer-bottom-bg,color-mix(in srgb,var(--brand-footer-bg,#10263D) 82%,#000));border-top:1px solid color-mix(in srgb,var(--brand-footer-text,#fff) 12%,transparent)}
.footer-bottom-inner{display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap;padding:var(--component-footer-bottom-padding,18px) 0;min-height:56px}
.footer-copyright{margin:0;font-size:13px;color:color-mix(in srgb,var(--brand-footer-text,#fff) 82%,transparent)}
.footer-legal-links{display:flex;flex-wrap:wrap;gap:18px}
.footer-legal-links a{color:var(--brand-footer-link,var(--brand-footer-text,#fff));text-decoration:none;font-size:13px}
.footer-legal-links a:hover{text-decoration:underline;color:var(--brand-footer-accent,#66a960)}
.footer-attribution{font-size:12px;color:color-mix(in srgb,var(--brand-footer-text,#fff) 70%,transparent)}
.footer-back-to-top{display:inline-flex;align-items:center;justify-content:center;width:42px;height:42px;border:none;border-radius:50%;background:var(--brand-footer-accent,#66a960);color:#fff;cursor:pointer;box-shadow:0 8px 20px color-mix(in srgb,var(--brand-footer-accent,#66a960) 35%,transparent)}
.footer-back-to-top svg{width:18px;height:18px}
@media(max-width:${bp}){
  .footer-bottom-inner{flex-direction:column;align-items:flex-start}
}
`;
}
