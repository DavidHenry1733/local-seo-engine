/**
 * Shared business-name candidate extraction + corroboration for Website BI import.
 * Taglines / slogans must not automatically outrank repeated canonical brand identity.
 */
import type { WebsiteImportFieldCandidate, WebsiteImportFieldValue } from "./growthEngineWebsiteIntelligenceImportV2Model.ts";

const TAGLINE_WORDS =
  /\b(partner|partners|growth|solutions?|experts?|specialists?|agency|consultants?|marketing|digital|smarter|better|helping|empowering|your\s+local)\b/i;
const COMPANY_SUFFIX = /\b(ltd|limited|llc|inc|plc|llp|group|co\.?|company)\b/i;
const GENERIC_TITLE = /^(home|welcome|homepage|contact|about|services?|faq|blog)$/i;

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function nowIso(): string {
  return new Date().toISOString();
}

function domainBrandToken(host: string): string {
  const bare = host.replace(/^www\./i, "").split(".")[0] || "";
  return bare.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function normalizeNameKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeTagline(value: string): boolean {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 4 && !COMPANY_SUFFIX.test(value)) return true;
  if (TAGLINE_WORDS.test(value) && words.length >= 2 && !COMPANY_SUFFIX.test(value)) {
    // Short brand-like names containing "Pharmacy" alone are OK; "Pharmacy Growth Partner" is not.
    if (/^[\w&'.-]+\s+(pharmacy|chemist|clinic)$/i.test(value)) return false;
    return true;
  }
  return false;
}

function methodWeight(method: string): number {
  switch (method) {
    case "schema.org-organization":
    case "schema.org-website":
      return 30;
    case "logo-alt":
    case "logo-title":
      return 26;
    case "header-brand":
      return 24;
    case "footer-copyright":
    case "footer-company":
      return 22;
    case "og:site_name":
      return 14;
    case "about-page":
    case "contact-page":
      return 18;
    case "nav-brand":
      return 16;
    case "page-title":
      return 8;
    case "h1":
      return 6;
    case "brand-importer":
      return 10;
    case "admin-baseline":
      return 4;
    default:
      return 8;
  }
}

export function extractBusinessNameCandidatesFromHtml(
  html: string,
  sourceUrl: string,
  pageClass: string = "page",
): WebsiteImportFieldCandidate[] {
  const out: WebsiteImportFieldCandidate[] = [];
  const push = (value: string, confidence: number, method: string) => {
    const v = str(value).replace(/\s+/g, " ");
    if (!v || v.length < 2 || v.length > 80 || GENERIC_TITLE.test(v) || isProviderNoise(v)) return;
    out.push({ value: v, confidence, sourceUrl, detectionMethod: method });
  };

  const ogSite = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i)?.[1]
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i)?.[1];
  if (ogSite) push(ogSite, 70, "og:site_name");

  // JSON-LD Organization / WebSite name
  const ldBlocks = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const block of ldBlocks) {
    const json = block.replace(/^[\s\S]*?>/, "").replace(/<\/script>$/i, "");
    try {
      const data = JSON.parse(json);
      const nodes = Array.isArray(data) ? data : data?.["@graph"] ? data["@graph"] : [data];
      for (const node of nodes) {
        if (!node || typeof node !== "object") continue;
        const type = String(node["@type"] || "");
        const name = str(node.name);
        if (!name) continue;
        if (/Organization|LocalBusiness|Pharmacy|Corporation|ProfessionalService/i.test(type)) {
          push(name, 88, "schema.org-organization");
        } else if (/WebSite/i.test(type)) {
          push(name, 82, "schema.org-website");
        }
      }
    } catch {
      const orgName =
        json.match(/"@type"\s*:\s*"(?:Organization|LocalBusiness|Pharmacy)"[^]{0,200}?"name"\s*:\s*"([^"]+)"/i)?.[1]
        || json.match(/"name"\s*:\s*"([^"]+)"[^]{0,200}?"@type"\s*:\s*"(?:Organization|LocalBusiness|Pharmacy)"/i)?.[1];
      if (orgName) push(orgName, 84, "schema.org-organization");
      const siteName = json.match(/"@type"\s*:\s*"WebSite"[^]{0,200}?"name"\s*:\s*"([^"]+)"/i)?.[1];
      if (siteName) push(siteName, 80, "schema.org-website");
    }
  }

  const logoAlt =
    html.match(/<img[^>]+(?:class|id)=["'][^"']*logo[^"']*["'][^>]+alt=["']([^"']+)["']/i)?.[1]
    || html.match(/<img[^>]+alt=["']([^"']*logo[^"']*)["']/i)?.[1]
    || html.match(/<img[^>]+alt=["']([^"']+)["'][^>]*(?:class|id)=["'][^"']*logo/i)?.[1];
  if (logoAlt) push(logoAlt.replace(/\blogo\b/gi, "").trim(), 78, "logo-alt");

  const logoTitle = html.match(/<img[^>]+(?:class|id)=["'][^"']*logo[^"']*["'][^>]+title=["']([^"']+)["']/i)?.[1];
  if (logoTitle) push(logoTitle, 76, "logo-title");

  const headerBrand =
    html.match(/<a[^>]+(?:class|id)=["'][^"']*(?:logo|brand|site-title|navbar-brand)[^"']*["'][^>]*>([\s\S]*?)<\/a>/i)?.[1]
      ?.replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  if (headerBrand && headerBrand.length <= 60) push(headerBrand, 74, "header-brand");

  const copyright = html.match(/©\s*(?:\d{4}\s*)+([^|<\n]{2,60})/i)?.[1]
    || html.match(/copyright\s+(?:\d{4}\s+)?([^|<\n]{2,60})/i)?.[1];
  if (copyright) push(copyright.replace(/\.\s*$/, "").trim(), 72, "footer-copyright");

  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim();
  if (title) {
    const parts = title.split(/\s*[|\-–—]\s*/).map((p) => p.trim()).filter(Boolean);
    // Prefer shorter brand-like segment; do not prefer long tagline segments
    const brandish = [...parts].sort((a, b) => a.split(/\s+/).length - b.split(/\s+/).length)[0];
    if (brandish) push(brandish, 55, "page-title");
  }

  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (h1 && h1.length <= 80) push(h1, 48, "h1");

  if (pageClass === "about" || pageClass === "contact") {
    // Boost org-like names already found on identity pages via duplicate with page method
    for (const c of [...out]) {
      if (c.detectionMethod.startsWith("schema") || c.detectionMethod === "footer-copyright") {
        out.push({
          ...c,
          confidence: Math.min(92, c.confidence + 6),
          detectionMethod: pageClass === "about" ? "about-page" : "contact-page",
        });
      }
    }
  }

  return out;
}

function isProviderNoise(value: string): boolean {
  return /wordpress\.com|wix\.com|squarespace|shopify|godaddy|ionos|hostinger|inboxingproweb|brook pharmacy|broom lane/i.test(
    value,
  );
}

export interface BusinessNameSelectionResult {
  field: WebsiteImportFieldValue;
  selectionReasoning: string;
  taglineProtected: boolean;
}

export function selectCorroboratedBusinessName(
  candidates: WebsiteImportFieldCandidate[],
  host: string,
): BusinessNameSelectionResult {
  const token = domainBrandToken(host);
  const groups = new Map<
    string,
    {
      value: string;
      score: number;
      methods: Set<string>;
      sources: Set<string>;
      best: WebsiteImportFieldCandidate;
      tagline: boolean;
    }
  >();

  for (const c of candidates) {
    const value = str(c.value);
    if (!value) continue;
    const key = normalizeNameKey(value);
    if (!key) continue;
    const tagline = looksLikeTagline(value);
    let score = (c.confidence || 0) * 0.35 + methodWeight(c.detectionMethod);
    if (tagline) score -= 35;
    const compact = key.replace(/\s+/g, "");
    if (token && (compact.includes(token) || token.includes(compact))) score += 40;
    // Prefer names that appear as single/double token brand forms
    const wordCount = value.split(/\s+/).length;
    if (wordCount <= 3 && !tagline) score += 12;
    if (COMPANY_SUFFIX.test(value)) score += 8;

    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        value,
        score,
        methods: new Set([c.detectionMethod]),
        sources: new Set([c.sourceUrl]),
        best: c,
        tagline,
      });
    } else {
      existing.score += score * 0.55;
      existing.methods.add(c.detectionMethod);
      existing.sources.add(c.sourceUrl);
      if (c.confidence > existing.best.confidence) existing.best = c;
      existing.tagline = existing.tagline && tagline;
    }
  }

  // Corroboration bonus
  for (const g of groups.values()) {
    g.score += Math.max(0, g.methods.size - 1) * 14;
    g.score += Math.max(0, g.sources.size - 1) * 10;
  }

  const ranked = [...groups.values()].sort((a, b) => b.score - a.score);
  const sortedCandidates = [...candidates]
    .filter((c) => c.value && !isProviderNoise(c.value))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 8);

  const best = ranked.find((g) => !g.tagline) || ranked[0];
  const taglineProtected = Boolean(ranked[0]?.tagline && best && best !== ranked[0]);

  if (!best) {
    return {
      field: { selected: "", confidence: 0, candidates: sortedCandidates, evidence: null, selectionReasoning: "No credible business-name candidates." },
      selectionReasoning: "No credible business-name candidates.",
      taglineProtected: false,
    };
  }

  // High confidence requires corroboration or strong identity method
  const strongIdentity = [...best.methods].some((m) =>
    /schema\.org-organization|logo-alt|header-brand|footer-copyright|about-page|contact-page/.test(m),
  );
  const corroborated = best.methods.size >= 2 || best.sources.size >= 2 || (strongIdentity && !best.tagline);
  let confidence = Math.min(95, Math.round(40 + best.score * 0.35));
  if (!corroborated) confidence = Math.min(confidence, 62);
  if (best.tagline) confidence = Math.min(confidence, 48);
  if (token && !normalizeNameKey(best.value).replace(/\s+/g, "").includes(token) && !strongIdentity) {
    confidence = Math.min(confidence, 58);
  }

  const AUTO = 55;
  // Prefer empty over selecting a tagline as canonical identity
  const finalSelected = !best.tagline && confidence >= AUTO ? best.value : "";

  const reasoning = [
    `Selected "${finalSelected || "(none)"}"`,
    `score=${best.score.toFixed(1)}`,
    `methods=${[...best.methods].join(",")}`,
    `sources=${best.sources.size}`,
    `tagline=${best.tagline}`,
    `domainToken=${token || "—"}`,
    taglineProtected ? `demotedTagline="${ranked[0]?.value}"` : "",
    `confidence=${finalSelected ? confidence : Math.min(confidence, 48)}`,
  ]
    .filter(Boolean)
    .join("; ");

  const fieldConfidence = finalSelected ? confidence : Math.min(confidence, 48);

  return {
    field: {
      selected: finalSelected,
      confidence: fieldConfidence,
      candidates: sortedCandidates,
      evidence: finalSelected
        ? {
            sourceUrl: best.best.sourceUrl,
            confidence: fieldConfidence,
            detectionMethod: [...best.methods].join("+"),
            detectedAt: nowIso(),
          }
        : null,
      selectionReasoning: reasoning,
    },
    selectionReasoning: reasoning,
    taglineProtected,
  };
}
