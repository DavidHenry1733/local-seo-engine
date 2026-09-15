/**
 * Presentation-only re-render batch after confirmed profile changes.
 * Does not regenerate written content or local intelligence.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { buildVisualExperiencePage } from "./pharmacyVisualExperience.ts";
import { buildContentGenerationContext } from "./contentEngine/buildContentGenerationContext.ts";
import { scopeContentGenerationContextForArea } from "./contentEngine/contentEngineContextScope.ts";
import { getEcosystemRoot } from "./contentEngine/contentEnginePaths.ts";
import { resolveLocalLocationHierarchy } from "./pharmacyLocalAreaResolver.ts";
import { renderLocalLocationAreaFullPage } from "./pharmacyLocalHierarchyFullPageRenderer.ts";
import { resolveTenantProfileSlug } from "./pharmacyTenantSlug.ts";
import {
  markPharmacyPresentationRendered,
  resolveCurrentPharmacyPresentationProfile,
} from "./pharmacyPresentationProfileResolver.ts";
import type { VisualExperienceServiceId } from "./pharmacyVisualExperienceConfig.ts";
import { mergeLivePresentationFactsIntoContext } from "./pharmacyPresentationContextMerge.ts";
import { slugifyArea } from "./pharmacyAreaNarrativeProfiles.ts";

export interface PresentationRenderPageProof {
  page: string;
  outputPath: string;
  profileRevision: number;
  profileUpdatedAt: string;
  renderTime: string;
  outputModifiedTime: string;
  gphcNumberBound: string;
  displayAddressBound: string;
  mediaLayoutMarker: string;
  outputMd5: string;
}

export interface PresentationRenderBatchResult {
  slug: string;
  serviceId: VisualExperienceServiceId;
  pagesRendered: number;
  renderTime: string;
  proofs: PresentationRenderPageProof[];
}

export interface PresentationRenderBatchInput {
  slug: string;
  serviceId?: VisualExperienceServiceId;
  localSlugs?: string[];
}

function md5(content: string): string {
  return crypto.createHash("md5").update(content).digest("hex");
}

function extractMediaLayoutMarker(html: string): string {
  const match = html.match(/data-layout="([^"]+)"/);
  return match?.[1] || "";
}

function proofForPage(
  page: string,
  outputPath: string,
  html: string,
  presentation: ReturnType<typeof resolveCurrentPharmacyPresentationProfile>,
  renderTime: string,
): PresentationRenderPageProof {
  const stat = fs.statSync(outputPath);
  return {
    page,
    outputPath,
    profileRevision: presentation.profileRevision,
    profileUpdatedAt: presentation.updatedAt,
    renderTime,
    outputModifiedTime: stat.mtime.toISOString(),
    gphcNumberBound: presentation.data.gphcNumber || "",
    displayAddressBound: presentation.servicePageProfile.customerFacingAddress || "",
    mediaLayoutMarker: extractMediaLayoutMarker(html),
    outputMd5: md5(html),
  };
}

export function renderPresentationPagesBatch(input: PresentationRenderBatchInput): PresentationRenderBatchResult {
  const serviceId = input.serviceId || "pharmacy-first";
  const localSlugs = input.localSlugs || ["wickersley", "bramley"];
  const resolvedSlug = resolveTenantProfileSlug(input.slug) || input.slug;
  const renderTime = new Date().toISOString();
  const presentation = resolveCurrentPharmacyPresentationProfile(resolvedSlug);
  const proofs: PresentationRenderPageProof[] = [];

  const serviceResult = buildVisualExperiencePage(resolvedSlug, serviceId);
  const serviceHtml = fs.readFileSync(serviceResult.outputPath, "utf8");
  proofs.push(proofForPage("service", serviceResult.outputPath, serviceHtml, presentation, renderTime));

  const baseCtx = mergeLivePresentationFactsIntoContext(
    buildContentGenerationContext(resolvedSlug, serviceId),
    presentation,
  );
  const ecosystemRoot = getEcosystemRoot(serviceId, resolvedSlug);
  const hierarchy = resolveLocalLocationHierarchy(resolvedSlug, serviceId, baseCtx.rawProfile);
  if (!hierarchy.ok) {
    throw new Error(hierarchy.blockedReason || "Local hierarchy blocked for presentation batch");
  }

  for (const areaSlug of localSlugs) {
    const areaRecord = hierarchy.areas.find((a) => a.slug === areaSlug || slugifyArea(a.name) === areaSlug);
    if (!areaRecord) continue;
    const scopedCtx = mergeLivePresentationFactsIntoContext(
      scopeContentGenerationContextForArea(baseCtx, areaRecord.name),
      presentation,
    );
    const outPath = path.join(ecosystemRoot, "local", areaRecord.slug, "index.html");
    const html = renderLocalLocationAreaFullPage(scopedCtx, hierarchy, areaRecord);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, html, "utf8");
    proofs.push(proofForPage(areaRecord.slug, outPath, html, presentation, renderTime));
  }

  markPharmacyPresentationRendered(resolvedSlug, renderTime);

  return {
    slug: resolvedSlug,
    serviceId,
    pagesRendered: proofs.length,
    renderTime,
    proofs,
  };
}

export function verifyPresentationOutputContains(
  html: string,
  expected: { gphcNumber?: string; displayAddress?: string },
): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  if (expected.gphcNumber) {
    const label = `GPhC registration number: ${expected.gphcNumber}`;
    if (!html.includes(label) && !html.includes(expected.gphcNumber)) {
      missing.push(`GPhC:${expected.gphcNumber}`);
    }
  }
  if (expected.displayAddress && !html.includes(expected.displayAddress)) {
    missing.push(`displayAddress:${expected.displayAddress}`);
  }
  return { ok: missing.length === 0, missing };
}
