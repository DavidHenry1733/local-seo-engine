/**
 * Computed-style evidence extraction from imported website CSS/HTML snapshots.
 */
import type { BrandDnaStyleEvidenceSample } from "./pharmacyBrandDnaSemanticTypes.ts";
import type { WebsiteCssEvidence } from "./pharmacyBrandDnaCssImportEvidence.ts";
import { normalizeHex } from "./pharmacyThemeEngine.ts";

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function extractHexFromValue(value: string): string | null {
  const match = str(value).match(/#([0-9a-fA-F]{3,8})\b/);
  return match ? normalizeHex(`#${match[1]}`, "") : null;
}

/** Extract first matching colour from CSS rules for selector hints. */
export function extractCssRuleColor(
  css: string,
  selectorHints: string[],
  property: "background" | "background-color" | "color" | "border-color",
): string | null {
  const propPattern =
    property === "background"
      ? "background(?:-color)?"
      : property === "color"
        ? "color"
        : "border-color";
  for (const hint of selectorHints) {
    const escaped = hint.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const blockRe = new RegExp(`${escaped}[^{]*\\{([^}]+)\\}`, "gi");
    let blockMatch: RegExpExecArray | null;
    while ((blockMatch = blockRe.exec(css)) !== null) {
      const declRe = new RegExp(`${propPattern}\\s*:\\s*([^;!]+)`, "i");
      const decl = blockMatch[1].match(declRe);
      if (!decl) continue;
      const hex = extractHexFromValue(decl[1]);
      if (hex) return hex;
    }
  }
  return null;
}

export function mergeStylesheetText(evidence: WebsiteCssEvidence): string {
  return evidence.stylesheets.map((s) => s.sourceUrl).join("\n") + "\n" + Object.entries(evidence.mergedVariables).map(([k, v]) => `--${k}:${v}`).join("\n");
}

export interface StyleEvidenceInput {
  sourceUrl: string;
  cssEvidence: WebsiteCssEvidence;
  cssText: string;
  vars: Record<string, string>;
  importedAt: string;
}

function sample(
  input: StyleEvidenceInput,
  role: string,
  selector: string,
  property: string,
  value: string,
  method: string,
  confidence: number,
): BrandDnaStyleEvidenceSample {
  return {
    role,
    pageUrl: input.sourceUrl,
    selectorOrSignature: selector,
    property,
    computedValue: value,
    extractionMethod: method,
    confidence,
    importedAt: input.importedAt,
  };
}

function cssVarHex(vars: Record<string, string>, ...names: string[]): string {
  for (const name of names) {
    const val = vars[name.toLowerCase()];
    const hex = val ? extractHexFromValue(val) : null;
    if (hex) return hex;
  }
  return "";
}

/** Build representative style evidence samples from CSS variables and rule parsing. */
export function buildStyleEvidenceSamples(input: StyleEvidenceInput): BrandDnaStyleEvidenceSample[] {
  const { cssText, vars, sourceUrl, importedAt } = input;
  const out: BrandDnaStyleEvidenceSample[] = [];
  const push = (role: string, selector: string, property: string, value: string, method: string, confidence: number) => {
    if (!value) return;
    out.push(sample(input, role, selector, property, value, method, confidence));
  };

  const headingColour = cssVarHex(vars, "heading-color", "black-dark-color") || extractCssRuleColor(cssText, ["h1", ".banner-content h1"], "color") || "";
  const bodyColour = cssVarHex(vars, "text-color") || extractCssRuleColor(cssText, ["p", "body"], "color") || "";
  const actionColour = cssVarHex(vars, "main-color", "primary-color", "bs-primary") || extractCssRuleColor(cssText, [".theme-btn.style-one", ".theme-btn"], "background") || "";
  const accentColour = extractCssRuleColor(cssText, [".main-menu a:hover", "a:hover"], "color") || cssVarHex(vars, "secondary-color") || "";
  const topBarBg = extractCssRuleColor(cssText, [".top-header"], "background") || actionColour;
  const topBarText = extractCssRuleColor(cssText, [".top-header"], "color") || "#ffffff";
  const headerBg =
    extractCssRuleColor(cssText, [".header-upper", ".main-header", ".header-lower", ".header-upper-wrap"], "background") ||
    cssVarHex(vars, "white-color", "bg-color") ||
    "#ffffff";
  const headerText = extractCssRuleColor(cssText, [".main-menu a", ".navigation a"], "color") || headingColour;
  const footerBg =
    extractCssRuleColor(cssText, [".footer-widget", ".main-footer", ".footer-area", "footer"], "background") ||
    extractCssRuleColor(cssText, [".footer-bottom"], "background") ||
    "";
  const footerBottomBg = extractCssRuleColor(cssText, [".footer-bottom"], "background") || footerBg;
  const buttonText = extractCssRuleColor(cssText, [".theme-btn.style-one"], "color") || "#ffffff";
  const pageBg = cssVarHex(vars, "bg-color", "gray-light-color", "white-color") || "#ffffff";
  const surfaceBg = cssVarHex(vars, "bg-color", "gray-light-color") || pageBg;

  push("h1", "h1 / --heading-color", "color", headingColour, "css-variable-or-rule", headingColour ? 82 : 0);
  push("h2", "h2", "color", headingColour, "css-rule-inheritance", headingColour ? 78 : 0);
  push("h3", "h3", "color", headingColour, "css-rule-inheritance", headingColour ? 75 : 0);
  push("paragraph", "p / --text-color", "color", bodyColour, "css-variable", bodyColour ? 82 : 0);
  push("navigation-link", ".main-menu a", "color", headerText, "css-rule", headerText ? 70 : 0);
  push("primary-button", ".theme-btn.style-one", "background-color", actionColour, "css-rule", actionColour ? 85 : 0);
  push("primary-button-text", ".theme-btn.style-one", "color", buttonText, "css-rule", 80);
  push("secondary-button", ".theme-btn.style-two", "background-color", extractCssRuleColor(cssText, [".theme-btn.style-two"], "background") || accentColour, "css-rule", 60);
  push("top-bar", ".top-header", "background-color", topBarBg, "css-rule", topBarBg ? 88 : 0);
  push("top-bar-text", ".top-header", "color", topBarText, "css-rule", 80);
  push("main-header", ".header-upper / .main-header", "background-color", headerBg, "css-rule", 75);
  push("hero", ".banner-section", "background-color", pageBg, "css-inferred", 55);
  push("service-card", ".choose-item, .service-card", "background-color", surfaceBg, "css-inferred", 50);
  push("icon", ".choose-item .icon", "color", actionColour, "css-inferred", actionColour ? 65 : 0);
  push("content-section", "section", "background-color", pageBg, "css-inferred", 50);
  push("cta-section", ".cta-section", "background-color", actionColour, "css-inferred", 55);
  push("footer", ".footer-widget / footer", "background-color", footerBg, "css-rule", footerBg ? 72 : 35);
  push("footer-heading", ".footer-widget h3", "color", extractCssRuleColor(cssText, [".footer-widget h3"], "color") || "#ffffff", "css-rule", 60);
  push("footer-link", ".footer-widget a", "color", extractCssRuleColor(cssText, [".footer-widget a"], "color") || "#ffffff", "css-rule", 60);
  push("map-contact", ".contact-section", "background-color", surfaceBg, "css-inferred", 45);
  push("mobile-navigation", ".mobile-menu", "background-color", headerBg, "css-inferred", 40);

  void sourceUrl;
  void importedAt;
  return out;
}
