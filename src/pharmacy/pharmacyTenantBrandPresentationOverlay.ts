/**
 * Reversible tenant-brand presentation overlay for locked previews and staging.
 * Mutates request/package HTML only — never source page files.
 */
import {
  TENANT_BRAND_IDENTITY_OVERLAY_MARKER,
  buildTenantBrandOverlayCss,
  resolveTenantBrandIdentity,
  type TenantBrandIdentityResolved,
} from "./pharmacyTenantBrandIdentityContract.ts";

function escAttr(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function injectOverlayCss(html: string, resolved: TenantBrandIdentityResolved): string {
  const css = buildTenantBrandOverlayCss(resolved);
  const style = `<style data-tenant-brand-overlay="v1">${css}</style>`;
  const fontLink = resolved.googleFontsHref
    ? `<link rel="stylesheet" href="${escAttr(resolved.googleFontsHref)}" data-tenant-brand-fonts="v1"/>`
    : "";
  const block = `${fontLink}\n${style}`;
  if (html.includes(TENANT_BRAND_IDENTITY_OVERLAY_MARKER)) {
    return html
      .replace(/<link[^>]*data-tenant-brand-fonts="v1"[^>]*>/i, fontLink || "")
      .replace(/<style data-tenant-brand-overlay="v1">[\s\S]*?<\/style>/i, style);
  }
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${block}\n</head>`);
  return `${block}\n${html}`;
}

function applyLogoOverlay(html: string, logoUrl: string): string {
  const src = String(logoUrl || "").trim();
  if (!src) return html;
  const img = `<img src="${escAttr(src)}" alt="" data-tenant-brand-logo="overlay"/>`;
  if (/data-tenant-brand-logo="overlay"/i.test(html)) {
    return html.replace(
      /(<img\b[^>]*data-tenant-brand-logo="overlay"[^>]*src=")[^"]*(")/i,
      `$1${escAttr(src)}$2`,
    );
  }
  if (/<a class="brand"[^>]*>\s*<img\b/i.test(html)) {
    return html.replace(
      /(<a class="brand"[^>]*>\s*<img\b[^>]*src=")[^"]*(")/i,
      `$1${escAttr(src)}$2`,
    );
  }
  if (/<a class="brand"[^>]*>/i.test(html)) {
    return html.replace(/<a class="brand"[^>]*>/i, (open) => `${open}${img}`);
  }
  return html;
}

function stampBody(html: string, resolved: TenantBrandIdentityResolved): string {
  if (/data-tenant-brand-revision=/.test(html)) {
    return html.replace(
      /data-tenant-brand-revision="[^"]*"/,
      `data-tenant-brand-revision="${escAttr(resolved.revision)}"`,
    );
  }
  return html.replace(
    /<body\b([^>]*)>/i,
    `<body data-tenant-brand-revision="${escAttr(resolved.revision)}" data-tenant-brand-contract="${escAttr(resolved.contractId)}"$1>`,
  );
}

export function applyTenantBrandPresentationOverlay(html: string, slug: string): string {
  const source = String(html || "");
  if (!source) return source;
  const resolved = resolveTenantBrandIdentity(slug);
  let out = injectOverlayCss(source, resolved);
  out = applyLogoOverlay(out, resolved.logoUrl.value);
  out = stampBody(out, resolved);
  return out;
}

export function extractTenantBrandOverlayCss(html: string): string {
  const match = String(html || "").match(/<style data-tenant-brand-overlay="v1">([\s\S]*?)<\/style>/i);
  return match?.[1] || "";
}

export function extractTenantBrandRevisionFromHtml(html: string): string {
  const fromBody = String(html || "").match(/data-tenant-brand-revision="([^"]+)"/i)?.[1] || "";
  if (fromBody) return fromBody;
  const fromCss = extractTenantBrandOverlayCss(html).match(/revision:([a-f0-9]+)/i)?.[1] || "";
  return fromCss;
}

export function extractTenantBrandLogoFromHtml(html: string): string {
  const overlayTag = String(html || "").match(/<img\b[^>]*data-tenant-brand-logo="overlay"[^>]*>/i)?.[0] || "";
  const overlay = overlayTag.match(/\bsrc="([^"]+)"/i)?.[1];
  if (overlay) return overlay.replace(/&amp;/g, "&");
  const brandImg = String(html || "").match(/<a class="brand"[^>]*>\s*<img\b[^>]*src="([^"]+)"/i)?.[1];
  return brandImg ? brandImg.replace(/&amp;/g, "&") : "";
}

export function protectTenantBrandLogoDuringHostRewrite(
  html: string,
  logoUrl: string,
  rewrite: (input: string) => string,
): string {
  const logo = String(logoUrl || "").trim();
  if (!logo || !/^https?:\/\//i.test(logo)) return rewrite(html);
  const token = "___TENANT_BRAND_LOGO_URL___";
  const protectedHtml = html.split(logo).join(token);
  return rewrite(protectedHtml).split(token).join(logo);
}
