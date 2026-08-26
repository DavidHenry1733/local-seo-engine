/**
 * Local cluster quality validation — lockdown V3.
 */
import fs from "node:fs";
import path from "node:path";
import { slugifyArea } from "./pharmacyAreaNarrativeProfiles.ts";
import { buildPharmacyServicePageProfile } from "./pharmacyServicePageProfileContext.ts";
import {
  countLocalClusterImages,
  countNearbyAreaLinks,
  detectEmptyLocalClusterSections,
  localClusterPageHasImage,
  localClusterPageHasIrrelevantHeartSection,
  localPageWordCount,
} from "./pharmacyLocalAreaPageDiagnostics.ts";
import { contentHasAreaPrefix } from "./pharmacyLocalClusterContentEngine.ts";
import {
  copySimilarityScore,
  detectAreaPrefixParagraphs,
  extractLocalUniqueContentHtml,
  normalizeCopyForSimilarity,
} from "./pharmacyLocalClusterVariantFamilies.ts";
import { evaluateLocalityPageDuplicationGate } from "./pharmacyLocalityPageDuplicationGateV1.ts";
import { isInvalidGenericMapEmbedUrl, validateMapInHtml } from "./pharmacyMapResolver.ts";
import { resolveTenantProfileSlug } from "./pharmacyTenantSlug.ts";
import { PHARMACY_WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";

export const LOCAL_PAGE_MIN_WORD_COUNT = 350;
export const LOCAL_SIMILARITY_FAIL_THRESHOLD = 0.82;
export const LOCAL_MIN_NEARBY_LINKS = 6;

export interface LocalCopyDepthValidation {
  ok: boolean;
  detail: string;
  minWordCount: number;
  pagesBelowMin: string[];
}

export interface LocalClusterQualityValidation {
  ok: boolean;
  detail: string;
  localPagesExpected: number;
  localPagesGenerated: number;
  localPagesWithImages: number;
  localPagesWithBusinessMap: number;
  localPagesWithAreaSpecificCopy: number;
  localPagesWithInternalLinks: number;
  localPagesWithMoneyLinks: number;
  duplicateCopyWarnings: string[];
  emptySectionsDetected: string[];
  localIntelligenceUsed: number;
  failedLocalPages: string[];
  servicePageLinksAllLocalAreas: boolean;
  localCopyDepthValidation: LocalCopyDepthValidation;
  localSimilarityScores: Array<{ pair: string; score: number }>;
  localityDuplicationGate?: { ok: boolean; message: string };
  areaPrefixDetected: string[];
  mapUsesBusinessLocation: boolean;
  servicePageLocalLinksCount: number;
  localNearbyLinksCount: number;
  irrelevantSectionsDetected: string[];
  localPageWordCounts: Record<string, number>;
  localPageImageCounts: Record<string, number>;
  failedLocalQualityReasons: string[];
}

function localPagePath(slug: string, serviceId: string, areaSlug: string): string {
  return path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-content-ecosystem", slug, serviceId, "local", areaSlug, "index.html");
}

function extractMainText(html: string): string {
  const main = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1] || html;
  return main.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function checkMapUsesBusinessLocation(
  html: string,
  profile: ReturnType<typeof buildPharmacyServicePageProfile>,
  areaNames: string[],
): { ok: boolean; detail: string; src: string } {
  const mapCheck = validateMapInHtml(html);
  if (!mapCheck.ok) return { ok: false, detail: mapCheck.detail, src: "" };

  const src = html.match(/<iframe[^>]+src=["']([^"']+)["']/i)?.[1] || "";
  if (!src && mapCheck.hasFallback) {
    return { ok: true, detail: "address fallback", src: "" };
  }
  if (!src) return { ok: false, detail: "no map iframe", src: "" };
  if (isInvalidGenericMapEmbedUrl(src)) return { ok: false, detail: "invalid embed", src };

  const decoded = decodeURIComponent(src.replace(/&amp;/g, "&")).toLowerCase();
  for (const area of areaNames) {
    const token = area.toLowerCase().split(/\s+/)[0];
    if (token && token.length > 3 && decoded.includes(token)) {
      return { ok: false, detail: `map query contains area: ${area}`, src };
    }
  }

  const postcode = String(profile.postcode || "").replace(/\s+/g, "").toLowerCase();
  if (postcode && decoded.includes(postcode)) {
    return { ok: true, detail: "postcode in embed", src };
  }
  if (/\d+\.\d+,\s*-?\d+\.\d+/.test(decoded)) {
    return { ok: true, detail: "coordinates in embed", src };
  }
  const addressToken = String(profile.addressLine1 || "").trim().split(/\s+/)[0]?.toLowerCase();
  if (addressToken && addressToken.length > 3 && decoded.includes(addressToken)) {
    return { ok: true, detail: "address in embed", src };
  }
  if (profile.town && decoded.includes(profile.town.toLowerCase())) {
    return { ok: true, detail: "town in embed", src };
  }
  return { ok: mapCheck.hasFallback, detail: mapCheck.detail, src };
}

function pageHasMoneyLinks(html: string): boolean {
  return /money-page-band|btn-white|tel:/i.test(html) && /pharmacy-visual-experience|Main .* page/i.test(html);
}

function pageMentionsPharmacy(html: string, pharmacyName: string): boolean {
  return pharmacyName ? html.includes(pharmacyName) : true;
}

function pageMentionsArea(html: string, areaName: string): boolean {
  return areaName ? html.toLowerCase().includes(areaName.toLowerCase()) : true;
}

function countServicePageLocalLinks(visualHtml: string, areaSlugs: string[]): number {
  return areaSlugs.filter((slug) => visualHtml.includes(`local/${slug}`)).length;
}

export function validateLocalClusterQuality(
  slug: string,
  serviceId: string,
  selectedAreas: string[],
  visualHtml: string,
): LocalClusterQualityValidation {
  const key = resolveTenantProfileSlug(slug) || slug;
  const profile = buildPharmacyServicePageProfile(key);
  const expected = selectedAreas.length;
  const areaSlugs = selectedAreas.map(slugifyArea);
  const normalizedPages = new Map<string, string>();
  const duplicateCopyWarnings: string[] = [];
  const emptySectionsDetected: string[] = [];
  const failedLocalPages: string[] = [];
  const failedLocalQualityReasons: string[] = [];
  const areaPrefixDetected: string[] = [];
  const irrelevantSectionsDetected: string[] = [];
  const localPageWordCounts: Record<string, number> = {};
  const localPageImageCounts: Record<string, number> = {};
  const localSimilarityScores: Array<{ pair: string; score: number }> = [];
  const pagesBelowMin: string[] = [];

  let generated = 0;
  let withImages = 0;
  let withBusinessMap = 0;
  let withAreaCopy = 0;
  let withInternalLinks = 0;
  let withMoneyLinks = 0;
  let intelligenceUsed = 0;
  let localNearbyLinksCount = 0;
  let mapUsesBusinessLocation = true;

  for (const areaName of selectedAreas) {
    const areaSlug = slugifyArea(areaName);
    const file = localPagePath(key, serviceId, areaSlug);
    if (!fs.existsSync(file)) {
      failedLocalPages.push(`${areaSlug}:missing`);
      failedLocalQualityReasons.push(`${areaSlug}:missing page`);
      continue;
    }

    generated++;
    const html = fs.readFileSync(file, "utf8");
    const failures: string[] = [];
    const words = localPageWordCount(html);
    localPageWordCounts[areaSlug] = words;
    localPageImageCounts[areaSlug] = countLocalClusterImages(html);

    if (words < LOCAL_PAGE_MIN_WORD_COUNT) {
      pagesBelowMin.push(`${areaSlug}:${words}`);
      failures.push("low-word-count");
    }

    const prefixes = detectAreaPrefixParagraphs(html, [areaName]);
    if (prefixes.length) {
      areaPrefixDetected.push(...prefixes);
      failures.push("area-prefix");
    }

    const heroText = html.match(/<h1[^>]*>[\s\S]*?<\/h1>\s*<p>([^<]+)/i)?.[1] || "";
    if (contentHasAreaPrefix(heroText, areaName)) {
      areaPrefixDetected.push(`${areaSlug}:hero`);
      failures.push("hero-area-prefix");
    }

    if (localClusterPageHasIrrelevantHeartSection(html)) {
      irrelevantSectionsDetected.push(`${areaSlug}:heart-section`);
      failures.push("irrelevant-heart-section");
    }

    if (!pageMentionsPharmacy(html, profile.pharmacyName)) failures.push("no-pharmacy-name");
    if (!pageMentionsArea(html, areaName)) failures.push("no-area-name");
    if (!localClusterPageHasImage(html)) failures.push("no-image");
    else withImages++;

    const mapCheck = checkMapUsesBusinessLocation(html, profile, selectedAreas);
    if (!mapCheck.ok) {
      failures.push("wrong-map");
      mapUsesBusinessLocation = false;
    } else withBusinessMap++;

    if (!html.includes("data-publish-source=\"local-area-v1\"")) failures.push("wrong-template");

    const nearbyCount = countNearbyAreaLinks(html);
    localNearbyLinksCount = Math.max(localNearbyLinksCount, nearbyCount);
    const minNearby = Math.max(LOCAL_MIN_NEARBY_LINKS, expected - 1);
    if (nearbyCount < minNearby && expected > 1) failures.push(`nearby-links-${nearbyCount}`);

    const hasMainServiceLink = html.includes("pharmacy-visual-experience") || /Main .* page/i.test(html);
    if (!hasMainServiceLink) failures.push("no-main-service-link");
    if (hasMainServiceLink && nearbyCount >= Math.min(minNearby, expected - 1)) withInternalLinks++;

    if (pageHasMoneyLinks(html)) withMoneyLinks++;
    else failures.push("no-money-links");

    const empty = detectEmptyLocalClusterSections(html);
    if (empty.length) {
      emptySectionsDetected.push(`${areaSlug}:${empty.join(",")}`);
      failures.push("empty-sections");
    }

    if (/local-relevance|local-area-access/i.test(html)) intelligenceUsed++;

    const normalized = normalizeCopyForSimilarity(
      extractLocalUniqueContentHtml(html).replace(/<[^>]+>/g, " "),
      selectedAreas,
      profile.pharmacyName,
    );
    normalizedPages.set(areaSlug, normalized);
    withAreaCopy++;

    if (failures.length) {
      failedLocalPages.push(`${areaSlug}:${failures.join(",")}`);
      failedLocalQualityReasons.push(`${areaSlug}: ${failures.join(", ")}`);
    }
  }

  const slugs = [...normalizedPages.keys()];
  for (let i = 0; i < slugs.length; i++) {
    for (let j = i + 1; j < slugs.length; j++) {
      const a = slugs[i]!;
      const b = slugs[j]!;
      const score = copySimilarityScore(normalizedPages.get(a)!, normalizedPages.get(b)!);
      localSimilarityScores.push({ pair: `${a}~${b}`, score: Math.round(score * 100) / 100 });
    }
  }

  const duplicationGate = evaluateLocalityPageDuplicationGate(slug, serviceId, selectedAreas, profile.pharmacyName);
  if (!duplicationGate.ok) {
    for (const pair of duplicationGate.pairs.filter((p) => p.blocked)) {
      duplicateCopyWarnings.push(`${pair.a}~${pair.b}:${pair.reason}`);
      failedLocalPages.push(`${pair.a}~${pair.b}:substantive-duplicate`);
      failedLocalQualityReasons.push(pair.reason);
    }
  }

  const servicePageLocalLinksCount = countServicePageLocalLinks(visualHtml, areaSlugs);
  const servicePageLinksAllLocalAreas =
    expected === 0 || servicePageLocalLinksCount >= expected;

  if (!servicePageLinksAllLocalAreas) {
    failedLocalPages.push("service-page:missing-local-links");
    failedLocalQualityReasons.push(`service page links ${servicePageLocalLinksCount}/${expected}`);
  }

  if (visualHtml) {
    const serviceMap = checkMapUsesBusinessLocation(visualHtml, profile, selectedAreas);
    if (!serviceMap.ok) {
      mapUsesBusinessLocation = false;
      failedLocalQualityReasons.push(`service page map: ${serviceMap.detail}`);
    }
  }

  const copyDepthOk = pagesBelowMin.length === 0;
  const localCopyDepthValidation: LocalCopyDepthValidation = {
    ok: copyDepthOk,
    detail: copyDepthOk ? "word counts ok" : `below min: ${pagesBelowMin.join(", ")}`,
    minWordCount: LOCAL_PAGE_MIN_WORD_COUNT,
    pagesBelowMin,
  };

  const ok =
    expected === generated &&
    withImages === expected &&
    withBusinessMap === expected &&
    withMoneyLinks === expected &&
    duplicateCopyWarnings.length === 0 &&
    emptySectionsDetected.length === 0 &&
    areaPrefixDetected.length === 0 &&
    irrelevantSectionsDetected.length === 0 &&
    copyDepthOk &&
    failedLocalPages.length === 0 &&
    servicePageLinksAllLocalAreas &&
    mapUsesBusinessLocation &&
    withInternalLinks === expected;

  return {
    ok,
    detail: ok ? "local cluster quality ok" : `failed: ${failedLocalQualityReasons.slice(0, 5).join("; ")}`,
    localPagesExpected: expected,
    localPagesGenerated: generated,
    localPagesWithImages: withImages,
    localPagesWithBusinessMap: withBusinessMap,
    localPagesWithAreaSpecificCopy: withAreaCopy,
    localPagesWithInternalLinks: withInternalLinks,
    localPagesWithMoneyLinks: withMoneyLinks,
    duplicateCopyWarnings,
    emptySectionsDetected,
    localIntelligenceUsed: intelligenceUsed,
    failedLocalPages,
    servicePageLinksAllLocalAreas,
    localCopyDepthValidation,
    localSimilarityScores,
    localityDuplicationGate: { ok: duplicationGate.ok, message: duplicationGate.message },
    areaPrefixDetected,
    mapUsesBusinessLocation,
    servicePageLocalLinksCount,
    localNearbyLinksCount,
    irrelevantSectionsDetected,
    localPageWordCounts,
    localPageImageCounts,
    failedLocalQualityReasons,
  };
}
