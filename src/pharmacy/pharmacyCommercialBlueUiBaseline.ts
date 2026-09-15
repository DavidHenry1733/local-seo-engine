/**
 * COMMERCIAL-BLUE-UI-BASELINE-LOCK-42
 *
 * Shared customer-facing PharmaConnect blue UI. Product screens and
 * generated-page presentation contracts use these tokens. Internal Master
 * Admin keeps its black theme and must not be applied to customer routes.
 */
export const COMMERCIAL_BLUE_UI_BASELINE_ID = "pharmaconnect-commercial-blue-ui-baseline-v1";
export const COMMERCIAL_BLUE_UI_BASELINE_ATTR = 'data-commercial-ui-baseline="blue-v1"';
export const INTERNAL_ADMIN_BLACK_THEME_ID = "pharmaconnect-internal-admin-theme-black";
export const INTERNAL_ADMIN_BLACK_THEME_ATTR = 'data-internal-admin-theme="black"';

export const COMMERCIAL_BLUE_UI_TOKENS = {
  primary: "#005eb8",
  secondary: "#003087",
  ink: "#0f172a",
  muted: "#64748b",
  heading: "#0f172a",
  pageBackground: "#f0f4f8",
  pageBackgroundHi: "#f0f7ff",
  surface: "#ffffff",
  surfaceSoft: "#f8fafc",
  surfaceTint: "#eff6ff",
  line: "#e2e8f0",
  lineStrong: "#dbeafe",
  radiusCard: "16px",
  radiusButton: "9px",
  radiusPill: "999px",
  space: "24px",
} as const;

export function commercialBlueChromeGradientCss(): string {
  return `linear-gradient(135deg,${COMMERCIAL_BLUE_UI_TOKENS.primary},${COMMERCIAL_BLUE_UI_TOKENS.secondary})`;
}

export function commercialBlueUiBaselineCss(): string {
  const t = COMMERCIAL_BLUE_UI_TOKENS;
  return `/* ${COMMERCIAL_BLUE_UI_BASELINE_ID} */
:root{
--pc-commercial-primary:${t.primary};
--pc-commercial-secondary:${t.secondary};
--pc-commercial-ink:${t.ink};
--pc-commercial-muted:${t.muted};
--pc-commercial-heading:${t.heading};
--pc-commercial-page-bg:${t.pageBackground};
--pc-commercial-page-bg-hi:${t.pageBackgroundHi};
--pc-commercial-surface:${t.surface};
--pc-commercial-surface-soft:${t.surfaceSoft};
--pc-commercial-surface-tint:${t.surfaceTint};
--pc-commercial-line:${t.line};
--pc-commercial-line-strong:${t.lineStrong};
--pc-commercial-radius-card:${t.radiusCard};
--pc-commercial-radius-button:${t.radiusButton};
--pc-commercial-radius-pill:${t.radiusPill};
--pc-commercial-space:${t.space};
}
body[data-commercial-ui-baseline="blue-v1"]{
background:${t.pageBackground};
color:${t.ink};
font-family:Inter,Arial,sans-serif;
}
@media(max-width:960px){
body[data-commercial-ui-baseline="blue-v1"]{--pc-commercial-space:16px}
}
@media(max-width:720px){
.ge-grid-2{grid-template-columns:1fr}
}
`;
}

export function withCommercialBlueUiBaseline(html: string): string {
  if (/data-commercial-ui-baseline=/.test(html)) return html;
  return html.replace(/<body\b([^>]*)>/i, `<body ${COMMERCIAL_BLUE_UI_BASELINE_ATTR}$1>`);
}

export function usesCommercialBlueBaseline(html: string): boolean {
  const lower = html.toLowerCase();
  return (
    html.includes(COMMERCIAL_BLUE_UI_BASELINE_ID) &&
    /data-commercial-ui-baseline=["']blue-v1["']/.test(html) &&
    lower.includes(COMMERCIAL_BLUE_UI_TOKENS.primary) &&
    (lower.includes(COMMERCIAL_BLUE_UI_TOKENS.pageBackground) ||
      lower.includes(COMMERCIAL_BLUE_UI_TOKENS.pageBackgroundHi) ||
      /background:#fff/i.test(html) ||
      /background:\s*#ffffff/i.test(html) ||
      /--brand-primary/.test(html))
  );
}

export function usesGeneratedPageBlueContract(html: string): boolean {
  const lower = html.toLowerCase();
  const hasBlue =
    /--brand-primary/.test(html) ||
    lower.includes(COMMERCIAL_BLUE_UI_TOKENS.primary) ||
    html.includes("approved-core-page-service-overview-align-29j") ||
    html.includes("cpr-design-system-lock-01-service-page-presentation");
  const lightSurface =
    /background:#fff/i.test(html) ||
    /background:\s*#ffffff/i.test(html) ||
    /--page-background/.test(html) ||
    lower.includes(COMMERCIAL_BLUE_UI_TOKENS.pageBackground) ||
    lower.includes("#f8fafc");
  return hasBlue && lightSurface;
}

export function customerFacingBlackThemeLeakage(html: string): string[] {
  const reasons: string[] = [];
  if (/data-internal-admin-theme=["']black["']/.test(html)) {
    reasons.push("internal-admin-theme-on-customer-route");
  }
  if (/\/\* pharmaconnect-internal-admin-theme-black \*\//.test(html)) {
    reasons.push("admin-black-css-on-customer-route");
  }
  if (/body\{[^}]*background:#(?:0b1220|111827|0f172a)/i.test(html)) {
    reasons.push("black-body-background");
  }
  if (/linear-gradient\(\s*135deg\s*,\s*#0f172a/i.test(html)) {
    reasons.push("navy-black-chrome-gradient");
  }
  if (/linear-gradient\(\s*\d+deg\s*,\s*#005eb8[^;)]*#0f766e/i.test(html)) {
    reasons.push("teal-chrome-gradient");
  }
  return reasons;
}

export function isIsolatedInternalAdminBlackTheme(html: string): boolean {
  return (
    /data-internal-admin-theme=["']black["']/.test(html) &&
    html.includes(INTERNAL_ADMIN_BLACK_THEME_ID) &&
    /body\{[^}]*background:#0b1220/i.test(html) &&
    !/data-commercial-ui-baseline=["']blue-v1["']/.test(html)
  );
}
